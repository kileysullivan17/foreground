import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { draftStoryHeuristic, type GroomDraft } from '../src/lib/groomDraft'

// Grooming proxy. The Anthropic call is gated behind two Vercel env vars,
// GROOM_LLM=live and ANTHROPIC_API_KEY; with either missing the endpoint
// returns the deterministic stub draft, so the whole flow works before the
// key is wired in a supervised session. The key only ever lives here.

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
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  if (!title) {
    return res.status(400).json({ error: 'title required' })
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
    const draft = JSON.parse(text) as Omit<GroomDraft, 'source'>
    return res.status(200).json({ ...draft, source: 'llm' } satisfies GroomDraft)
  } catch {
    // Fail soft: the stub is clearly labeled in the UI, never silently wrong.
    return res.status(200).json(draftStoryHeuristic(title))
  }
}
