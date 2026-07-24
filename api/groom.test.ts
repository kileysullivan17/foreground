// The live AI import branch, with the Anthropic SDK mocked so the real model
// call, the Zod validation of its output, and every fallback are exercised
// without a key or a network. This is the path that only ever ran the offline
// stub before; here the model "responds" and we assert the handler's contract.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted mock: new Anthropic().messages.create -> our spy.
const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
  },
}))

import handler from './groom'
import { MAX_IMPORT_CHARS } from '../src/lib/importDraft'

type Res = {
  statusCode: number
  body: unknown
  status: (code: number) => Res
  json: (body: unknown) => Res
}

function mockRes(): Res {
  const res = { statusCode: 0, body: undefined as unknown } as Res
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (body) => {
    res.body = body
    return res
  }
  return res
}

// Each call uses a fresh IP so the per-instance rate limiter never trips
// across the suite.
let ipSeq = 0
function mockReq(body: unknown, extraHeaders: Record<string, string> = {}) {
  ipSeq += 1
  return {
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': `10.0.0.${ipSeq}`, ...extraHeaders },
  } as never
}

const modelReturns = (obj: unknown) =>
  create.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(obj) }] })

beforeEach(() => {
  create.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.GROOM_LLM = 'live'
  process.env.ANTHROPIC_API_KEY = 'test-key'
  delete process.env.GROOM_SECRET
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.GROOM_LLM
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.GROOM_SECRET
})

describe('groom import branch: live model call', () => {
  it('returns validated, source-tagged items and passes an explicit deadline through', async () => {
    modelReturns({
      items: [
        { title: 'Fix the leaking tap', area: 'home', effort: 'S', importance: 2, deadline: null },
        { title: 'Book the dentist', area: 'home', effort: 'S', importance: 3, deadline: '2026-08-14' },
      ],
    })
    const res = mockRes()
    await handler(
      mockReq({ mode: 'import', text: 'fix the tap\nbook the dentist by 2026-08-14' }),
      res as never,
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ source: 'llm' })
    const body = res.body as { items: Array<{ title: string; deadline: string | null }> }
    expect(body.items).toHaveLength(2)
    expect(body.items[1]).toMatchObject({ title: 'Book the dentist', deadline: '2026-08-14' })

    // The model was actually invoked, carrying the never-invent rule and the
    // paste (with a current-date line so relative dates can resolve).
    expect(create).toHaveBeenCalledOnce()
    const arg = create.mock.calls[0][0] as {
      system: string
      messages: Array<{ content: string }>
    }
    expect(arg.system).toMatch(/never invent a deadline/i)
    const userMsg = arg.messages[0].content
    expect(userMsg).toContain('fix the tap')
    expect(userMsg).toMatch(/Current date: \d{4}-\d{2}-\d{2}/)
  })

  it('rejects a model deadline that is not a plain ISO date and falls back to stub', async () => {
    // The "never invent" guarantee is prompt-level, but the schema is the
    // backstop: anything that is not yyyy-mm-dd or null cannot reach the client.
    modelReturns({
      items: [{ title: 'x', area: 'home', effort: 'S', importance: 3, deadline: 'next Friday' }],
    })
    const res = mockRes()
    await handler(mockReq({ mode: 'import', text: 'do x next friday' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ source: 'stub-fallback', items: [] })
  })

  it('rejects an out-of-range importance and falls back to stub', async () => {
    modelReturns({
      items: [{ title: 'x', area: 'work', effort: 'M', importance: 9, deadline: null }],
    })
    const res = mockRes()
    await handler(mockReq({ mode: 'import', text: 'x' }), res as never)
    expect(res.body).toEqual({ source: 'stub-fallback', items: [] })
  })

  it('signals a stub fallback when the model call throws', async () => {
    create.mockRejectedValueOnce(new Error('upstream 529'))
    const res = mockRes()
    await handler(mockReq({ mode: 'import', text: 'anything' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ source: 'stub-fallback', items: [] })
    expect(console.error).toHaveBeenCalled()
  })
})

describe('groom import branch: gate and guards', () => {
  it('returns the not-wired stub without calling the model when the key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = mockRes()
    await handler(mockReq({ mode: 'import', text: 'a real list' }), res as never)

    expect(res.body).toEqual({ source: 'stub', items: [] })
    expect(create).not.toHaveBeenCalled()
  })

  it('returns the not-wired stub when GROOM_LLM is not live', async () => {
    process.env.GROOM_LLM = 'off'
    const res = mockRes()
    await handler(mockReq({ mode: 'import', text: 'a real list' }), res as never)
    expect(res.body).toEqual({ source: 'stub', items: [] })
    expect(create).not.toHaveBeenCalled()
  })

  it('400s on empty text and never calls the model', async () => {
    const res = mockRes()
    await handler(mockReq({ mode: 'import', text: '   \n  ' }), res as never)
    expect(res.statusCode).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('400s on a paste over the character cap', async () => {
    const res = mockRes()
    await handler(
      mockReq({ mode: 'import', text: 'a'.repeat(MAX_IMPORT_CHARS + 1) }),
      res as never,
    )
    expect(res.statusCode).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('401s when a groom secret is configured but the header is missing', async () => {
    process.env.GROOM_SECRET = 's3cret'
    const res = mockRes()
    await handler(mockReq({ mode: 'import', text: 'x' }), res as never)
    expect(res.statusCode).toBe(401)
    expect(create).not.toHaveBeenCalled()
  })

  it('proceeds past the secret gate when the header matches', async () => {
    process.env.GROOM_SECRET = 's3cret'
    modelReturns({ items: [] })
    const res = mockRes()
    await handler(
      mockReq({ mode: 'import', text: 'x' }, { 'x-groom-secret': 's3cret' }),
      res as never,
    )
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ source: 'llm', items: [] })
  })
})
