// Shared by the client (dev fallback) and api/groom.ts (stub mode), so the
// grooming flow behaves identically wherever the LLM is unavailable.

import { z } from 'zod'

const scoreField = z.number().int().min(1).max(5)

// The draft's content, without the source tag. Both wire ends validate the
// model's JSON against this before trusting it; a miss means we fall back to
// the stub rather than feeding a malformed draft into the editor.
export const groomDraftContentSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  businessValue: scoreField,
  timeCriticality: scoreField,
  enablement: scoreField,
  // Story points the size selector actually offers; anything else would show
  // as a blank option in the editor.
  jobSize: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8)]),
  rationale: z.string(),
})

// A draft the UI can render. 'stub' is the deterministic heuristic, 'llm' is
// the model, and 'stub-fallback' is the heuristic served after a live call
// failed or returned something malformed. The three are labeled distinctly in
// the UI so stub output is never passed off as the model's.
export const groomDraftSchema = groomDraftContentSchema.extend({
  source: z.enum(['stub', 'llm', 'stub-fallback']),
})

export type GroomDraft = z.infer<typeof groomDraftSchema>

/**
 * Deterministic story draft from a raw capture. Intentionally modest: it puts
 * the capture into story form and proposes middle-of-the-road scores, and its
 * rationale says so. The point of the flow is the review step, not the draft.
 */
export function draftStoryHeuristic(rawTitle: string): GroomDraft {
  const capability = rawTitle.trim().replace(/[.!?]+$/, '')
  const lower = capability.charAt(0).toLowerCase() + capability.slice(1)
  return {
    title: `As a daily user, I want ${lower} so that the app keeps earning its place in my day.`,
    description: `Drafted from the raw capture "${capability}". Sharpen the outcome clause: what changes for the user when this ships?`,
    acceptanceCriteria: [
      'Reachable in two taps or fewer from the relevant screen',
      'Works at 390px with no horizontal scrolling',
      'Survives a reload with no lost state',
    ],
    businessValue: 3,
    timeCriticality: 2,
    enablement: 2,
    jobSize: 3,
    rationale:
      'Stub draft: story form applied, mid scores proposed, sized medium until scoped. Edit anything before accepting.',
    source: 'stub',
  }
}
