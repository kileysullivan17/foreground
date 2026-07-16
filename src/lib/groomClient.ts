import { draftStoryHeuristic, type GroomDraft } from './groomDraft'

/**
 * Ask the serverless proxy for a story draft. Anywhere the function isn't
 * deployed (the Vite dev server, static preview) the fetch fails or returns
 * HTML, and the local stub takes over, so the flow never dead-ends.
 */
export async function requestGroomDraft(rawTitle: string): Promise<GroomDraft> {
  // The Vite dev server has no serverless runtime; skip the doomed fetch
  // (and its console 404) and draft locally.
  if (import.meta.env.DEV) return draftStoryHeuristic(rawTitle)
  try {
    // The endpoint's cost gate wants a shared secret. It is injected at build
    // time from VITE_GROOM_SECRET, so the deployed bundle carries it; unset
    // (e.g. stub-only deploys) means no header and the server skips the check.
    const secret = import.meta.env.VITE_GROOM_SECRET
    const res = await fetch('/api/groom', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-groom-secret': secret } : {}),
      },
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
