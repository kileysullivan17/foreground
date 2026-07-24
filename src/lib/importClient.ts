import {
  importResponseSchema,
  MAX_IMPORT_CHARS,
  parseImportText,
  type ImportItem,
  type ImportResponse,
} from './importDraft'
import type { Area, Effort } from '../types'

// A row in the review table. Every parsed/proposed field is editable; `origin`
// records whether the values came from the model or from the local parse, so
// the UI can mark AI-proposed fields honestly. `include` is the per-row gate.
export interface ReviewRow extends ImportItem {
  origin: 'ai' | 'local'
  include: boolean
}

export interface StructureResult {
  source: ImportResponse['source']
  rows: ReviewRow[]
}

// What the local parse fills for fields it cannot infer. Deliberately the same
// defaults fast capture uses, so a locally-parsed item matches a hand-added one.
const LOCAL_DEFAULTS: Pick<ImportItem, 'area' | 'effort' | 'importance' | 'deadline'> = {
  area: 'home' as Area,
  effort: 'M' as Effort,
  importance: 3,
  deadline: null,
}

/** Local parse only: one row per line, titles cleaned, everything else default. */
export function structureLocally(raw: string): ReviewRow[] {
  return parseImportText(raw).map((line) => ({
    title: line.title,
    ...LOCAL_DEFAULTS,
    origin: 'local',
    include: true,
  }))
}

/**
 * AI-assisted structuring through the shared, gated groom endpoint. Anywhere
 * the model is unavailable (dev server, LLM off, missing secret, rate limit,
 * network error, malformed body) this falls back to the local parse and
 * reports the source honestly so the UI never passes a stub off as the model.
 */
export async function structureWithAI(raw: string): Promise<StructureResult> {
  const text = raw.slice(0, MAX_IMPORT_CHARS)

  // The Vite dev server has no serverless runtime; skip the doomed fetch and
  // parse locally, labeled as the not-wired stub.
  if (import.meta.env.DEV) return { source: 'stub', rows: structureLocally(text) }

  try {
    // Same cost-gate secret the grooming client echoes; injected at build time.
    const secret = import.meta.env.VITE_GROOM_SECRET
    const res = await fetch('/api/groom', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-groom-secret': secret } : {}),
      },
      body: JSON.stringify({ mode: 'import', text }),
    })
    if (res.ok) {
      const parsed = importResponseSchema.safeParse(await res.json())
      if (parsed.success && parsed.data.source === 'llm') {
        return {
          source: 'llm',
          rows: parsed.data.items.map((item) => ({ ...item, origin: 'ai', include: true })),
        }
      }
      // 200 but the server signalled stub / stub-fallback (LLM off, or the live
      // call failed server-side): parse locally, keep the server's label.
      if (parsed.success) return { source: parsed.data.source, rows: structureLocally(text) }
    }
  } catch {
    // fall through to the labeled local fallback
  }
  // A deployed call was attempted and failed (non-OK status incl. 401/429,
  // malformed body, or network error). Label it a failure, not "not wired".
  return { source: 'stub-fallback', rows: structureLocally(text) }
}
