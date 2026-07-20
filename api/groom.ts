import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
// The .js extension is required: with "type": "module" the deployed
// function runs as node ESM, where extensionless relative imports fail at
// runtime (ERR_MODULE_NOT_FOUND took the live grooming path down; the
// client quietly fell back to the stub). Vercel's builder maps the .js
// specifier back to the .ts source when compiling.
import { draftStoryHeuristic, groomDraftContentSchema } from '../src/lib/groomDraft.js'

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
