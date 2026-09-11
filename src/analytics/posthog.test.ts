// @vitest-environment happy-dom

// The self-exclusion gate. These pin the rules that keep the author's own
// testing, every preview deployment, every fork, and every automated check
// out of the data. If one of these fails, the dashboard is contaminated.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OPTOUT_STORAGE_KEY, PRODUCTION_HOSTNAMES } from './config'

const PRODUCTION = PRODUCTION_HOSTNAMES[0]!

// happy-dom in this repo's vitest setup exposes no localStorage at all, so
// every test that touches storage installs its own.
function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  }
}

function blockedStorage(): Storage {
  const deny = () => {
    throw new DOMException('Access is denied for this document.', 'SecurityError')
  }
  return { getItem: deny, setItem: deny, removeItem: deny, clear: deny, key: deny, length: 0 }
}

const setUrl = (url: string) =>
  (window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL(url)

const flush = () => new Promise((r) => setTimeout(r, 0))

const initSpy = vi.fn()
const captureSpy = vi.fn()
vi.mock('posthog-js', () => ({ default: { init: initSpy, capture: captureSpy } }))

async function loadModule() {
  vi.resetModules()
  return import('./posthog')
}

describe('decideCapture', () => {
  const prod = {
    hostname: PRODUCTION,
    optOut: 'unset' as const,
    webdriver: false,
    key: 'phc_test',
    host: 'https://us.i.posthog.com',
  }

  it('captures on the production hostname with config present', async () => {
    const { decideCapture } = await loadModule()
    expect(decideCapture(prod)).toEqual({ capture: true })
  })

  it.each([
    'localhost',
    '127.0.0.1',
    'foreground-git-posthog-instrumentation-kileysullivan17.vercel.app',
    'foreground-abc123-kileysullivan17.vercel.app',
    `www.${PRODUCTION}`,
    `${PRODUCTION}.evil.example`,
    'my-fork.example.com',
  ])('suppresses on %s (exact match only)', async (hostname) => {
    const { decideCapture } = await loadModule()
    expect(decideCapture({ ...prod, hostname })).toEqual({
      capture: false,
      reason: 'not-production',
    })
  })

  it('suppresses when the key or host is missing', async () => {
    const { decideCapture } = await loadModule()
    expect(decideCapture({ ...prod, key: undefined })).toEqual({ capture: false, reason: 'no-config' })
    expect(decideCapture({ ...prod, key: '' })).toEqual({ capture: false, reason: 'no-config' })
    expect(decideCapture({ ...prod, host: undefined })).toEqual({ capture: false, reason: 'no-config' })
  })

  it('suppresses when the opt-out flag is set', async () => {
    const { decideCapture } = await loadModule()
    expect(decideCapture({ ...prod, optOut: 'set' })).toEqual({ capture: false, reason: 'opted-out' })
  })

  it('suppresses when storage cannot be read', async () => {
    const { decideCapture } = await loadModule()
    expect(decideCapture({ ...prod, optOut: 'unavailable' })).toEqual({
      capture: false,
      reason: 'storage-unavailable',
    })
  })

  it('suppresses under automation', async () => {
    const { decideCapture } = await loadModule()
    expect(decideCapture({ ...prod, webdriver: true })).toEqual({ capture: false, reason: 'webdriver' })
  })
})

describe('the opt-out query parameter', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('?fg_optout=1 writes the flag', async () => {
    const { applyOptOutParam, readOptOutFlag } = await loadModule()
    expect(applyOptOutParam('?fg_optout=1')).toBe('opted-out')
    expect(localStorage.getItem(OPTOUT_STORAGE_KEY)).toBe('1')
    expect(readOptOutFlag()).toBe('set')
  })

  it('?fg_optout=0 removes it', async () => {
    const { applyOptOutParam, readOptOutFlag } = await loadModule()
    localStorage.setItem(OPTOUT_STORAGE_KEY, '1')
    expect(applyOptOutParam('?fg_optout=0&x=1')).toBe('opted-in')
    expect(localStorage.getItem(OPTOUT_STORAGE_KEY)).toBeNull()
    expect(readOptOutFlag()).toBe('unset')
  })

  it('leaves the flag alone for any other value or no parameter', async () => {
    const { applyOptOutParam } = await loadModule()
    localStorage.setItem(OPTOUT_STORAGE_KEY, '1')
    expect(applyOptOutParam('')).toBeNull()
    expect(applyOptOutParam('?fg_optout=yes')).toBeNull()
    expect(localStorage.getItem(OPTOUT_STORAGE_KEY)).toBe('1')
  })

  it('never throws when site data is blocked, and reports storage as unavailable', async () => {
    vi.stubGlobal('localStorage', blockedStorage())
    const { applyOptOutParam, readOptOutFlag } = await loadModule()
    expect(() => applyOptOutParam('?fg_optout=1')).not.toThrow()
    expect(() => applyOptOutParam('?fg_optout=0')).not.toThrow()
    expect(readOptOutFlag()).toBe('unavailable')
  })
})

describe('initAnalytics end to end', () => {
  beforeEach(() => {
    initSpy.mockClear()
    captureSpy.mockClear()
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com')
    // happy-dom reports itself as automation; the real rule is tested above.
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('on production, loads posthog-js with every capture surface off and no cookies', async () => {
    setUrl(`https://${PRODUCTION}/`)
    const { initAnalytics, isCaptureEnabled, track } = await loadModule()
    expect(initAnalytics()).toEqual({ capture: true })
    expect(isCaptureEnabled()).toBe(true)
    // An event fired before the chunk lands is queued, then flushed.
    track('session_started', { items_in_backlog: 3, oldest_item_days: 12 })
    await flush()
    expect(initSpy).toHaveBeenCalledTimes(1)
    const [key, config] = initSpy.mock.calls[0]!
    expect(key).toBe('phc_test')
    expect(config).toMatchObject({
      api_host: 'https://us.i.posthog.com',
      persistence: 'localStorage',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      capture_heatmaps: false,
      capture_performance: false,
      capture_exceptions: false,
      capture_dead_clicks: false,
      rageclick: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
    })
    expect(captureSpy).toHaveBeenCalledWith('session_started', {
      items_in_backlog: 3,
      oldest_item_days: 12,
    })
    expect(document.cookie).toBe('')
  })

  it('?fg_optout=1 on production writes the flag and never initializes', async () => {
    setUrl(`https://${PRODUCTION}/?fg_optout=1`)
    const { initAnalytics, isCaptureEnabled, track } = await loadModule()
    expect(initAnalytics()).toEqual({ capture: false, reason: 'opted-out' })
    expect(localStorage.getItem(OPTOUT_STORAGE_KEY)).toBe('1')
    expect(isCaptureEnabled()).toBe(false)
    track('session_started', { items_in_backlog: 1, oldest_item_days: 1 })
    await flush()
    expect(initSpy).not.toHaveBeenCalled()
    expect(captureSpy).not.toHaveBeenCalled()
  })

  it('the flag persists across loads until ?fg_optout=0 clears it', async () => {
    localStorage.setItem(OPTOUT_STORAGE_KEY, '1')
    setUrl(`https://${PRODUCTION}/`)
    let mod = await loadModule()
    expect(mod.initAnalytics()).toEqual({ capture: false, reason: 'opted-out' })

    setUrl(`https://${PRODUCTION}/?fg_optout=0`)
    mod = await loadModule()
    expect(mod.initAnalytics()).toEqual({ capture: true })
    expect(localStorage.getItem(OPTOUT_STORAGE_KEY)).toBeNull()
  })

  it('on localhost, never initializes even with config present', async () => {
    setUrl('http://localhost:5199/')
    const { initAnalytics, track } = await loadModule()
    expect(initAnalytics()).toEqual({ capture: false, reason: 'not-production' })
    track('session_started', { items_in_backlog: 1, oldest_item_days: 1 })
    await flush()
    expect(initSpy).not.toHaveBeenCalled()
  })

  it('on a Vercel preview URL, never initializes', async () => {
    setUrl('https://foreground-git-posthog-instrumentation-kileysullivan17.vercel.app/')
    const { initAnalytics } = await loadModule()
    expect(initAnalytics()).toEqual({ capture: false, reason: 'not-production' })
    await flush()
    expect(initSpy).not.toHaveBeenCalled()
  })

  it('with site data blocked, the app runs and nothing is captured', async () => {
    vi.stubGlobal('localStorage', blockedStorage())
    setUrl(`https://${PRODUCTION}/`)
    const { initAnalytics } = await loadModule()
    expect(initAnalytics()).toEqual({ capture: false, reason: 'storage-unavailable' })
    await flush()
    expect(initSpy).not.toHaveBeenCalled()
  })

  it('under automation, never initializes', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })
    setUrl(`https://${PRODUCTION}/`)
    const { initAnalytics } = await loadModule()
    expect(initAnalytics()).toEqual({ capture: false, reason: 'webdriver' })
    await flush()
    expect(initSpy).not.toHaveBeenCalled()
  })
})
