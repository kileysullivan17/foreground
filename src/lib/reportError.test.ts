// @vitest-environment happy-dom

// Locks the reporter's unbreakable contract: a no-op in dev, dedups repeats,
// caps per session, and never throws. This is the code that runs while the
// app is already crashing, so its own robustness is the point.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let beacons: string[]

beforeEach(() => {
  vi.resetModules() // reset the module's sent-count and seen-set between tests
  beacons = []
  vi.stubGlobal('navigator', {
    userAgent: 'test-agent',
    sendBeacon: (_url: string, blob: Blob) => {
      // Blob text is async; record synchronously that a beacon fired, plus
      // its size, which is enough to assert dedup/cap.
      beacons.push(String(blob.size))
      return true
    },
  })
  vi.stubGlobal('location', { href: 'https://example.test/product' })
})

afterEach(() => vi.unstubAllGlobals())

describe('reportError', () => {
  it('sends nothing in dev', async () => {
    vi.stubEnv('DEV', true)
    const { reportError } = await import('./reportError')
    reportError({ kind: 'boundary', message: 'boom' })
    expect(beacons).toHaveLength(0)
  })

  it('sends one beacon per distinct error in prod', async () => {
    vi.stubEnv('DEV', false)
    const { reportError } = await import('./reportError')
    reportError({ kind: 'boundary', message: 'boom' })
    reportError({ kind: 'boundary', message: 'different' })
    expect(beacons).toHaveLength(2)
  })

  it('dedups repeats of the same error', async () => {
    vi.stubEnv('DEV', false)
    const { reportError } = await import('./reportError')
    reportError({ kind: 'boundary', message: 'boom' })
    reportError({ kind: 'boundary', message: 'boom' })
    reportError({ kind: 'boundary', message: 'boom' })
    expect(beacons).toHaveLength(1)
  })

  it('caps a flood of distinct errors so a crash loop cannot spam the drain', async () => {
    vi.stubEnv('DEV', false)
    const { reportError } = await import('./reportError')
    for (let i = 0; i < 50; i++) {
      reportError({ kind: 'error', message: `boom ${i}` })
    }
    expect(beacons.length).toBeLessThanOrEqual(8)
  })

  it('never throws even if the send machinery is hostile', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('navigator', {
      userAgent: 'x',
      sendBeacon: () => {
        throw new Error('beacon exploded')
      },
    })
    const { reportError } = await import('./reportError')
    expect(() => reportError({ kind: 'error', message: 'boom' })).not.toThrow()
  })
})
