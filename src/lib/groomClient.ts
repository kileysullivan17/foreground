import { draftStoryHeuristic, groomDraftSchema, type GroomDraft } from './groomDraft'

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
      // Validate the response before handing it to the editor; a malformed
      // body falls through to the local stub instead of rendering garbage.
      const parsed = groomDraftSchema.safeParse(await res.json())
      if (parsed.success) return parsed.data
    }
  } catch {
    // fall through to the labeled local fallback
  }
  // A deployed call was attempted and failed (non-OK status, malformed body,
  // or no serverless runtime at all). Label it as a failure, not as
  // "not wired": the UI copy promises that distinction.
  return { ...draftStoryHeuristic(rawTitle), source: 'stub-fallback' }
}
