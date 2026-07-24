import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
// The .js extension is required: with "type": "module" the deployed
// function runs as node ESM, where extensionless relative imports fail at
// runtime (ERR_MODULE_NOT_FOUND took the live grooming path down; the
// client quietly fell back to the stub). Vercel's builder maps the .js
// specifier back to the .ts source when compiling.
import { draftStoryHeuristic, groomDraftContentSchema } from '../src/lib/groomDraft.js'
import { importResponseContentSchema, MAX_IMPORT_CHARS } from '../src/lib/importDraft.js'

// Grooming proxy. The Anthropic call is gated behind two Vercel env vars,
// GROOM_LLM=live and ANTHROPIC_API_KEY; with either missing the endpoint
// returns the deterministic stub draft, so the whole flow works before the
// key is wired in a supervised session. The key only ever lives here.
//
// Two guards sit in front of the handler as a COST gate, not a security
// boundary: a shared secret (GROOM_SECRET) the client must echo in a header,
// and a best-effort per-IP rate limit. The client's copy of the secret is a
// build-time VITE_ var and therefore ships in the browser bundle, so anyone
// who wants it can read it; the point is to keep casual/accidental traffic
// off the paid endpoint, not to authenticate callers.

const MAX_TITLE_LEN = 300

// Best-effort per-IP throttle. Serverless instances are ephemeral and not
// shared, so this only bounds bursts hitting the same warm instance; it is a
// cost speed-bump, not a real limiter. Kept in-process deliberately (no
// external store) for a single-user portfolio app.
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 12
const ipHits = new Map<string, number[]>()

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const raw = Array.isArray(fwd) ? fwd[0] : fwd
  return raw?.split(',')[0]?.trim() || 'unknown'
}

function overRateLimit(ip: string): boolean {
  const now = Date.now()
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  ipHits.set(ip, recent)
  return recent.length > RATE_MAX
}

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'The story in "As a [user], I want [capability] so that [outcome]" form',
    },
    description: { type: 'string', description: 'One or two sentences of context' },
    acceptanceCriteria: {
      type: 'array',
      items: { type: 'string' },
      description: 'Three to five checkable criteria',
    },
    businessValue: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    timeCriticality: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    enablement: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    jobSize: { type: 'integer', enum: [1, 2, 3, 5, 8] },
    rationale: { type: 'string', description: 'One sentence on why these scores' },
  },
  required: [
    'title',
    'description',
    'acceptanceCriteria',
    'businessValue',
    'timeCriticality',
    'enablement',
    'jobSize',
    'rationale',
  ],
  additionalProperties: false,
} as const

const SYSTEM = `You groom raw backlog captures for Foreground, a personal
prioritization app that ranks work by WSJF (cost of delay over job size)
with a staleness boost. Draft the capture into a user story: a title in
"As a [user], I want [capability] so that [outcome]" form, a short
description, three to five checkable acceptance criteria, and proposed
scores (businessValue, timeCriticality, enablement each 1-5; jobSize in
story points 1, 2, 3, 5, or 8). Propose conservatively; a human reviews
and edits everything before it applies.`

// The import branch structures a whole pasted list at once. Same endpoint,
// same gate: it reuses the secret + rate limit checked in the handler before
// the branch. Per item the model returns a cleaned title, an area, an effort,
// an importance, and a deadline that is ONLY ever a date the text stated.
const IMPORT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'A cleaned, concise task title. Strip bullet/number noise and section headers.',
          },
          area: { type: 'string', enum: ['work', 'home'] },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          importance: { type: 'integer', enum: [1, 2, 3, 4, 5] },
          deadline: {
            type: ['string', 'null'],
            description:
              'ISO date (yyyy-mm-dd) ONLY if the text explicitly states a deadline for this item; otherwise null. Never invent a deadline.',
          },
        },
        required: ['title', 'area', 'effort', 'importance', 'deadline'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

const IMPORT_SYSTEM = `You structure a raw pasted backlog for Foreground, a
personal prioritization app. The paste is a rough list where each line is
roughly one task; it may carry bullets, numbers, section headers, and
trailing notes. Return one item per real task. For each: a cleaned concise
title (drop bullet/number noise and any trailing meta), an area ("work" or
"home") inferred from wording, an effort ("S", "M", or "L"), an importance
(1 low to 5 high), and a deadline. Set the deadline to an ISO date
(yyyy-mm-dd) ONLY when the text explicitly names one for that item, resolving
a stated relative date against the provided current date; otherwise null.
Never invent a deadline. Drop section-header and separator lines. A human
reviews and edits everything before anything is saved.`

async function handleImport(req: VercelRequest, res: VercelResponse) {
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  if (!text.trim()) {
    return res.status(400).json({ error: 'text required' })
  }
  if (text.length > MAX_IMPORT_CHARS) {
    return res.status(400).json({ error: `paste too long (max ${MAX_IMPORT_CHARS} characters)` })
  }

  // Not wired: tell the client to parse locally (and label it) rather than
  // pretend the model ran. Same stub principle as the grooming draft.
  if (process.env.GROOM_LLM !== 'live' || !process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ source: 'stub', items: [] })
  }

  try {
    const client = new Anthropic()
    const today = new Date().toISOString().slice(0, 10)
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: IMPORT_SYSTEM,
      messages: [
        { role: 'user', content: `Current date: ${today}.\n\nRaw pasted list:\n${text}` },
      ],
      output_config: { format: { type: 'json_schema', schema: IMPORT_SCHEMA } },
    })
    const out = response.content.find((block) => block.type === 'text')?.text
    if (!out) throw new Error('no text block in response')
    const parsed = importResponseContentSchema.parse(JSON.parse(out))
    return res.status(200).json({ source: 'llm', items: parsed.items })
  } catch (err) {
    // Fail soft: signal a fallback so the client parses locally and says the
    // model call failed, not that it was never wired.
    console.error('groom import: live structuring failed, signaling stub fallback', err)
    return res.status(200).json({ source: 'stub-fallback', items: [] })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  // Cost gate. Enforced only when GROOM_SECRET is configured, so stub-only
  // deployments and local dev keep working with no config. When set, the
  // client must echo it in x-groom-secret (injected at build time).
  const secret = process.env.GROOM_SECRET
  if (secret && req.headers['x-groom-secret'] !== secret) {
    return res.status(401).json({ error: 'bad or missing groom secret' })
  }

  if (overRateLimit(clientIp(req))) {
    return res.status(429).json({ error: 'too many requests, slow down' })
  }

  // Bulk import shares this gate rather than opening a second endpoint.
  if (req.body?.mode === 'import') {
    return handleImport(req, res)
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  if (!title) {
    return res.status(400).json({ error: 'title required' })
  }
  if (title.length > MAX_TITLE_LEN) {
    return res.status(400).json({ error: `title too long (max ${MAX_TITLE_LEN})` })
  }

  if (process.env.GROOM_LLM !== 'live' || !process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json(draftStoryHeuristic(title))
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Raw capture: ${JSON.stringify(title)}` }],
      output_config: { format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
    })
    const text = response.content.find((block) => block.type === 'text')?.text
    if (!text) throw new Error('no text block in response')
    // Validate the model's JSON before trusting it; a schema miss is treated
    // like any other failure and falls through to the labeled stub.
    const draft = groomDraftContentSchema.parse(JSON.parse(text))
    return res.status(200).json({ ...draft, source: 'llm' })
  } catch (err) {
    // Fail soft, but leave a server-side trail, and label the fallback
    // distinctly so the UI can say the model call failed rather than that it
    // was never wired.
    console.error('groom: live draft failed, serving stub fallback', err)
    return res.status(200).json({ ...draftStoryHeuristic(title), source: 'stub-fallback' })
  }
}
