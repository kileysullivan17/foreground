// Shared by the client (dev fallback) and api/groom.ts (stub mode), so the
// grooming flow behaves identically wherever the LLM is unavailable.

export interface GroomDraft {
  title: string
  description: string
  acceptanceCriteria: string[]
  businessValue: number
  timeCriticality: number
  enablement: number
  jobSize: number
  rationale: string
  source: 'stub' | 'llm'
}

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
