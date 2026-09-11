// Every analytics setting that someone might need to change lives here, and
// nothing else in src/analytics reads import.meta.env directly.
//
// Both env values are public by design: a PostHog project API key is meant to
// ship in the browser bundle (it can only write events, never read them). The
// personal API key is a different thing and is not used anywhere in this app.
// Leave both unset and the analytics module never loads posthog-js at all.

export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined

// Capture runs only when window.location.hostname is exactly one of these.
// This is an exact-match allowlist, not a "not localhost" check, so every
// Vercel preview URL, every branch deployment, and every self-hosted fork
// sends nothing anywhere unless its owner adds their own hostname here.
export const PRODUCTION_HOSTNAMES: readonly string[] = ['foreground-self.vercel.app']

// Per-browser opt-out. Visiting the app with ?fg_optout=1 writes '1' under
// this localStorage key and capture stays off in that browser until
// ?fg_optout=0 removes it. The flag lives in one browser profile on one
// device; it does not follow a person across their devices.
export const OPTOUT_STORAGE_KEY = 'fg_analytics_optout'
export const OPTOUT_QUERY_PARAM = 'fg_optout'
