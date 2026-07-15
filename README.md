# Foreground

Foreground is a personal prioritization tool: one place for every open
project and task across work and home, built to answer a single question on
demand. What should I work on right now? Work you keep putting off climbs
the ranking instead of sinking; that is the product's differentiator, and
v2 makes the whole thing double as a product management showcase. The app
manages its own development: its roadmap lives inside it as a groomed
backlog.

React 18 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Hook Form +
Zod · TanStack Query · Supabase-shaped data layer · Vercel-ready.

## The framework

Ranking is WSJF (Weighted Shortest Job First), adapted for one person:

```
priority = cost of delay ÷ job size × staleness multiplier
```

Cost of delay adds deadline urgency (max 35), importance (max 25), unblock
value (max 20), and a small momentum nudge for started work (6). Job size
divides (S 1, M 2, L 3; the quick-wins toggle steepens this to 1/3/6).
Staleness multiplies: after three quiet days an item's score grows by
1/60th per untouched day, capped at 1.5x, so age amplifies value that is
already there instead of manufacturing points from neglect. Every card
shows its full arithmetic in plain language. The model, the weights, and
the rationale for each choice live in [FRAMEWORK.md](FRAMEWORK.md); the
engine is a pure function in `src/scoring/score.ts` with the boundaries
pinned by `npx vitest run`.

## Screens

1. **What now**: every workable item ranked by the framework, each card
   listing the exact factors that put it there ("+24 Due in 6 days",
   "÷2 Medium job", "×1.43 Untouched for 26 days"). Area filter,
   quick-wins toggle, one-tap Start/Done/Park. Blocked items sit in a
   collapsed section showing their full dependency chain, so the top of
   the list is always startable.
2. **Stuff I've put off**: open items sorted purely by time since last
   touched. "Touch it" resets the clock and keeps a one-line note of where
   things stand.
3. **Projects**: projects grouped by area; add items inline, tap any item
   to edit everything, including dependencies with a cycle-safe picker and
   a nested view of what the item waits on and would unblock.
4. **Product**: this app's own backlog as user stories with acceptance
   criteria and WSJF scores on a Backlog / Groomed / In progress / Done
   board (tap to move; a Later shelf holds v3 candidates). Raw captures
   get a "Groom this" action that drafts them into story form with
   proposed criteria and scores; nothing applies until you accept.
5. **Add item**: fast capture. Title and area make a valid item; the rest
   waits behind "More detail".

An About view (linked from the header) carries the case study copy. Seed
data is placeholder-clean throughout, so any screen is screenshot-safe.

## Run it

```bash
npm install
npm run dev
```

That's it. With no configuration the app uses a built-in localStorage
adapter seeded with realistic demo data, so every screen renders
meaningfully on first load. To reset the demo data, clear the site's
localStorage.

### Running against Supabase

The same `DataProvider` interface has a real Supabase implementation. With
Docker and the Supabase CLI installed:

```bash
supabase init      # if not linked yet
supabase start
supabase db reset  # applies supabase/migrations + supabase/seed.sql
```

Then copy `.env.example` to `.env.local`, fill in the URL and anon key that
`supabase start` printed, and restart the dev server. Both backends seed
from one source: `src/data/seed-data.json` is materialized at runtime by
the local adapter, and `scripts/gen-seed-sql.mjs` generates
`supabase/seed.sql` from the same file.

### The grooming assistant

`api/groom.ts` is a Vercel serverless function holding the Anthropic call
(structured JSON output against the draft schema). It is stubbed by
default: without `GROOM_LLM=live` and `ANTHROPIC_API_KEY` in the Vercel
project env it returns a deterministic local draft, clearly labeled in the
UI, so the whole flow works with no key anywhere in the repo or client.

## Repo notes

- `FRAMEWORK.md`: the prioritization model as a PM artifact.
- `DECISIONS.md`: every judgment call made during the build, and why.
- `scripts/verify-drive.mjs`: Playwright end-to-end drive of every screen
  (see `.claude/skills/verify/SKILL.md`).
- `scripts/git.mjs`: v1-era git via isomorphic-git, kept as history; the
  machine's git works again and v2 commits use it.

## What got cut (and where it went)

v1's cut list (auth, Asana import, touch-note history, notifications,
manual reordering) is now the Product board's Later shelf: real stories
with acceptance criteria instead of a list in a README. Rationale for
every cut and call is in `DECISIONS.md`.
