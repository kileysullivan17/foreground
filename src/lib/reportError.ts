// Client-error reporter. Posts uncaught errors to /api/clientlog so a crash
// in the wild leaves a trail in the Vercel runtime logs instead of only a
// fallback card the user never mentions. Deliberately unbreakable: it must
// never throw, never block, and never itself cause the thing it reports.

interface Report {
  kind: 'error' | 'unhandledrejection' | 'boundary'
  message: string
  stack?: string
  componentStack?: string
}

// A crashing render can loop; cap reports per page load so a bad frame can't
// flood the drain (or the user's network).
const MAX_PER_SESSION = 8
let sent = 0

// Collapse duplicates: a render error boundary and window.onerror often fire
// for the same throw within the same tick.
const seen = new Set<string>()

export function reportError(report: Report): void {
  // No serverless runtime in dev, and the console is right there anyway.
  if (import.meta.env.DEV) return
  try {
    if (sent >= MAX_PER_SESSION) return
    const key = `${report.kind}:${report.message}`.slice(0, 200)
    if (seen.has(key)) return
    seen.add(key)
    sent++

    const body = JSON.stringify({
      ...report,
      url: location.href,
      userAgent: navigator.userAgent,
    })
    // sendBeacon survives an unloading page and can't be blocked on; fall
    // back to a keepalive fetch where it's unavailable.
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/clientlog', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/clientlog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // A reporter that throws is worse than one that stays silent.
  }
}

// Global handlers for errors that escape React entirely (event handlers,
// async callbacks, effect teardown). Install once from main.tsx.
export function installGlobalErrorReporting(): void {
  if (import.meta.env.DEV) return
  window.addEventListener('error', (e) => {
    reportError({
      kind: 'error',
      message: e.message || String(e.error),
      stack: e.error instanceof Error ? e.error.stack : undefined,
    })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    reportError({
      kind: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
}
