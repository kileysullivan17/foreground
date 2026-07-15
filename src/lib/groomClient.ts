import { draftStoryHeuristic, type GroomDraft } from './groomDraft'

/**
 * Ask the serverless proxy for a story draft. Anywhere the function isn't
 * deployed (the Vite dev server, static preview) the fetch fails or returns
 * HTML, and the local stub takes over, so the flow never dead-ends.
 */
export async function requestGroomDraft(rawTitle: string): Promise<GroomDraft> {
  try {
    const res = await fetch('/api/groom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: rawTitle }),
    })
    if (res.ok) {
      const data = (await res.json()) as Partial<GroomDraft>
      if (typeof data.title === 'string' && Array.isArray(data.acceptanceCriteria)) {
        return data as GroomDraft
      }
    }
  } catch {
    // no serverless runtime here; fall through to the local stub
  }
  return draftStoryHeuristic(rawTitle)
}
