// PostHog client wrapper. Decides once per page load whether capture is
// allowed, and only then loads posthog-js (as its own chunk, so a suppressed
// visit never downloads it). Everything else in the app talks to track() and
// capturePageview() and never touches the PostHog instance directly.
//
// Suppression rules, in the order they run (see docs/analytics.md):
//   0. ?fg_optout=1 writes the opt-out flag and stops; ?fg_optout=0 clears it
//      and continues to the checks below.
//   1. No key or host configured at build time.
//   2. The hostname is not on the exact-match production allowlist.
//   3. The opt-out flag is set, or localStorage cannot be read at all.
//   4. navigator.webdriver is true (Playwright, headless checks, bots).

import type { PostHog } from 'posthog-js'
import {
  OPTOUT_QUERY_PARAM,
  OPTOUT_STORAGE_KEY,
  POSTHOG_HOST,
  POSTHOG_KEY,
  PRODUCTION_HOSTNAMES,
} from './config'

export type SuppressReason =
  | 'opted-out'
  | 'no-config'
  | 'not-production'
  | 'storage-unavailable'
  | 'webdriver'
  | 'no-window'

export type CaptureDecision = { capture: true } | { capture: false; reason: SuppressReason }

export type OptOutFlag = 'set' | 'unset' | 'unavailable'

export type EventProperties = Record<string, string | number | boolean>

export function readOptOutFlag(): OptOutFlag {
  try {
    return localStorage.getItem(OPTOUT_STORAGE_KEY) === '1' ? 'set' : 'unset'
  } catch {
    return 'unavailable'
  }
}

function writeOptOutFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(OPTOUT_STORAGE_KEY, '1')
    else localStorage.removeItem(OPTOUT_STORAGE_KEY)
  } catch {
    // Storage blocked: nothing to persist, and capture is suppressed anyway.
  }
}

/**
 * Handle the opt-out query parameter. Silent by design: no UI, no redirect.
 * Returns what the parameter asked for, or null when it was absent.
 */
export function applyOptOutParam(search: string): 'opted-out' | 'opted-in' | null {
  const value = new URLSearchParams(search).get(OPTOUT_QUERY_PARAM)
  if (value === '1') {
    writeOptOutFlag(true)
    return 'opted-out'
  }
  if (value === '0') {
    writeOptOutFlag(false)
    return 'opted-in'
  }
  return null
}

export interface CaptureEnvironment {
  hostname: string
  optOut: OptOutFlag
  webdriver: boolean
  key: string | undefined
  host: string | undefined
}

/** Pure decision, so the rules are unit-testable without a browser. */
export function decideCapture(env: CaptureEnvironment): CaptureDecision {
  if (!env.key || !env.host) return { capture: false, reason: 'no-config' }
  if (!PRODUCTION_HOSTNAMES.includes(env.hostname)) {
    return { capture: false, reason: 'not-production' }
  }
  if (env.optOut === 'set') return { capture: false, reason: 'opted-out' }
  if (env.optOut === 'unavailable') return { capture: false, reason: 'storage-unavailable' }
  if (env.webdriver) return { capture: false, reason: 'webdriver' }
  return { capture: true }
}

let enabled = false
let client: PostHog | null = null
// Events fired between the decision and the chunk finishing its load.
let pending: Array<{ event: string; properties?: EventProperties }> = []

function flushPending(): void {
  if (!client) return
  for (const { event, properties } of pending) client.capture(event, properties)
  pending = []
}

/**
 * Run once from main.tsx before the first render. Returns the decision so a
 * caller can log or test it; the app itself ignores the return value.
 */
export function initAnalytics(): CaptureDecision {
  if (typeof window === 'undefined') return { capture: false, reason: 'no-window' }

  if (applyOptOutParam(window.location.search) === 'opted-out') {
    return { capture: false, reason: 'opted-out' }
  }

  const decision = decideCapture({
    hostname: window.location.hostname,
    optOut: readOptOutFlag(),
    webdriver: navigator.webdriver === true,
    key: POSTHOG_KEY,
    host: POSTHOG_HOST,
  })
  if (!decision.capture) return decision

  enabled = true
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY!, {
        api_host: POSTHOG_HOST!,
        // No cookies: the anonymous distinct id lives in localStorage only.
        persistence: 'localStorage',
        // Anonymous only. No identify() call exists in this app, so no person
        // profile is ever created.
        person_profiles: 'identified_only',
        // Every event is explicit. Page views are captured by hand on route
        // change (AnalyticsBoot), because automatic capture misfires in a SPA.
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        capture_exceptions: false,
        // Foreground holds the user's real backlog. Never record it.
        disable_session_recording: true,
        disable_surveys: true,
        disable_web_experiments: true,
        // No recorder, survey, or site-app scripts are ever fetched, and no
        // remote config is consulted, so nothing above can be switched back
        // on from the PostHog dashboard. Feature flags are not used here.
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
      })
      client = posthog
      flushPending()
    })
    .catch(() => {
      // Chunk blocked (content blocker, offline): behave as suppressed.
      enabled = false
      pending = []
    })

  return decision
}

/** Capture one explicit event. A no-op in every suppressed state. */
export function track(event: string, properties?: EventProperties): void {
  if (!enabled) return
  if (client) client.capture(event, properties)
  else pending.push({ event, properties })
}

/** Manual page view, called on every route change. */
export function capturePageview(): void {
  track('$pageview')
}

/** True when this page load is allowed to capture. Exposed for tests. */
export function isCaptureEnabled(): boolean {
  return enabled
}
