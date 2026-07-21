import type { VercelRequest, VercelResponse } from '@vercel/node'

// Client-error sink. The browser posts uncaught errors, unhandled rejections,
// and React error-boundary catches here; we console.error them so they land
// in the Vercel runtime logs, which is exactly where the 2026-07-19 white
// screen was finally diagnosed. Fire-and-forget: always 204, never make the
// page's reporter care about the response.
//
// This is a logging drain, not a data store: fields are truncated hard so a
// giant or hostile body can't bloat the logs, and there is no auth gate
// because it holds nothing worth gating (a best-effort per-IP throttle keeps
// a crash loop from flooding).

const MAX = { message: 500, stack: 4000, componentStack: 4000, url: 500, userAgent: 300 }

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 30
const ipHits = new Map<string, number[]>()

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const raw = Array.isArray(fwd) ? fwd[0] : fwd
  return raw?.split(',')[0]?.trim() || 'unknown'
}

function overRateLimit(ip: string): boolean {
  const now = Date.now()
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  ipHits.set(ip, recent)
  return recent.length > RATE_MAX
}

const str = (v: unknown, cap: number): string =>
  typeof v === 'string' ? v.slice(0, cap) : ''

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Always drains successfully; the client must never block or retry on this.
  if (req.method !== 'POST') return res.status(204).end()
  if (overRateLimit(clientIp(req))) return res.status(204).end()

  const b = (req.body ?? {}) as Record<string, unknown>
  const entry = {
    kind: str(b.kind, 40) || 'error',
    message: str(b.message, MAX.message),
    stack: str(b.stack, MAX.stack),
    componentStack: str(b.componentStack, MAX.componentStack),
    url: str(b.url, MAX.url),
    userAgent: str(b.userAgent, MAX.userAgent),
  }
  // One line, prefixed so it's greppable in the runtime logs.
  console.error('CLIENT-ERROR', JSON.stringify(entry))
  return res.status(204).end()
}
