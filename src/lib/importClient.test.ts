// The client half of the AI path: with import.meta.env.DEV forced off, the
// real fetch to /api/groom runs (mocked). Asserts a live 'llm' response maps to
// AI rows, and that every unhappy outcome (LLM off, 401, 429, network error,
// malformed body) degrades to a labeled local parse. The DEV short-circuit is
// what Import.test already covers; this covers the deployed branch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { structureWithAI } from './importClient'
import { MAX_IMPORT_CHARS } from './importDraft'

const fetchMock = vi.fn()

const PASTE = '# Errands\n- Buy milk\n1. Call the plumber\nRenew passport'

function llmResponse(items: unknown) {
  return { ok: true, json: async () => ({ source: 'llm', items }) }
}
function sentBody() {
  const args = fetchMock.mock.calls[0]
  if (!args) throw new Error('fetch was not called')
  const init = args[1] as { body: string; headers: Record<string, string> }
  return { body: JSON.parse(init.body), headers: init.headers }
}

beforeEach(() => {
  // Force the deployed branch: DEV true would short-circuit to a local parse.
  vi.stubEnv('DEV', false)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('structureWithAI: live response', () => {
  it('maps an llm response to AI-origin rows and passes deadlines through', async () => {
    fetchMock.mockResolvedValueOnce(
      llmResponse([
        { title: 'Buy oat milk', area: 'home', effort: 'S', importance: 2, deadline: null },
        { title: 'Book dentist', area: 'work', effort: 'M', importance: 4, deadline: '2026-08-14' },
      ]),
    )

    const result = await structureWithAI('buy milk\nbook dentist')
    expect(result.source).toBe('llm')
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((r) => r.origin === 'ai' && r.include)).toBe(true)
    expect(result.rows[1]).toMatchObject({ title: 'Book dentist', area: 'work', deadline: '2026-08-14' })

    // The request is the import mode, carrying the paste.
    const { body } = sentBody()
    expect(body).toMatchObject({ mode: 'import', text: 'buy milk\nbook dentist' })
  })

  it('caps the text it sends at MAX_IMPORT_CHARS', async () => {
    fetchMock.mockResolvedValueOnce(llmResponse([]))
    await structureWithAI('x'.repeat(MAX_IMPORT_CHARS + 500))
    expect(sentBody().body.text).toHaveLength(MAX_IMPORT_CHARS)
  })

  it('sends the cost-gate secret header when one is configured', async () => {
    vi.stubEnv('VITE_GROOM_SECRET', 'abc123')
    fetchMock.mockResolvedValueOnce(llmResponse([]))
    await structureWithAI('anything')
    expect(sentBody().headers['x-groom-secret']).toBe('abc123')
  })

  it('omits the secret header when none is configured', async () => {
    fetchMock.mockResolvedValueOnce(llmResponse([]))
    await structureWithAI('anything')
    expect(sentBody().headers['x-groom-secret']).toBeUndefined()
  })
})

describe('structureWithAI: honest fallbacks', () => {
  it('parses locally, labeled stub, when the server signals the model is off', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'stub', items: [] }) })
    const result = await structureWithAI(PASTE)
    expect(result.source).toBe('stub')
    expect(result.rows.map((r) => r.title)).toEqual(['Buy milk', 'Call the plumber', 'Renew passport'])
    expect(result.rows.every((r) => r.origin === 'local')).toBe(true)
  })

  it('falls back to a labeled local parse on a 401 (bad/missing secret)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    const result = await structureWithAI(PASTE)
    expect(result.source).toBe('stub-fallback')
    expect(result.rows.map((r) => r.title)).toEqual(['Buy milk', 'Call the plumber', 'Renew passport'])
  })

  it('falls back to a labeled local parse on a 429 (rate limited)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
    const result = await structureWithAI(PASTE)
    expect(result.source).toBe('stub-fallback')
    expect(result.rows).toHaveLength(3)
  })

  it('falls back to a labeled local parse when the fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const result = await structureWithAI(PASTE)
    expect(result.source).toBe('stub-fallback')
    expect(result.rows).toHaveLength(3)
  })

  it('falls back when the body is malformed (fails schema validation)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source: 'llm', items: [{ title: 'x', area: 'nope' }] }),
    })
    const result = await structureWithAI(PASTE)
    expect(result.source).toBe('stub-fallback')
    expect(result.rows.every((r) => r.origin === 'local')).toBe(true)
  })
})
