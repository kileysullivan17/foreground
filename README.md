# Foreground

Foreground is a personal prioritization tool: one place for every open project and task
across work and home, built to answer a single question on demand — **what
should I work on right now?** Surfacing stale, avoided work is a first-class
feature: put-off items climb the ranking instead of sinking.

React 18 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Hook Form +
Zod · TanStack Query · Supabase-shaped data layer · Vercel-ready.

## Run it

```bash
npm install
npm run dev
```

That's it. With no configuration the app uses a built-in localStorage
adapter seeded with realistic demo data (7 projects, 27 items across work
and home), so every screen renders meaningfully on first load. To reset the
demo data, clear the site's localStorage.

### Running against Supabase

The same interface has a real Supabase implementation. With Docker and the
Supabase CLI installed:

```bash
supabase init      # if not linked yet
supabase start
supabase db reset  # applies supabase/migrations + supabase/seed.sql
```

Then copy `.env.example` to `.env.local`, fill in the URL and anon key that
`supabase start` printed, and restart the dev server. Seed data comes from
the same source in both modes: `src/data/seed-data.json` is materialized at
runtime by the local adapter, and `scripts/gen-seed-sql.mjs` generates
`supabase/seed.sql` from it.

## Screens

1. **What now** — every workable item ranked by a transparent score; each
   card lists the exact factors and points that put it there ("+24 Due in
   6 days", "+13 Untouched for 26 days", "+8 Holding up 'Book the
   insulation install'"). Area filter, quick-wins toggle for low-energy
   time, one-tap Start/Done/Park. Items waiting on other items sit in a
   collapsed Blocked section so the top of the list is always startable.
2. **Stuff I've put off** — open items sorted purely by time since last
   touched. "Touch it" resets the clock and asks for a one-line note of
   where things stand.
3. **Projects** — projects grouped by area with goals and target dates;
   add items inline, tap any item to edit everything (including
   dependencies, with a cycle-safe picker).
4. **Add item** — fast capture: title + area is a valid item; project,
   effort, importance, deadline, notes, and dependencies are optional
   behind "More detail".

## Scoring

Max points per factor: deadline **35** (overdue pegs it), importance **25**,
unblocking other work **20**, staleness **15** (capped so it can't beat a
real deadline), quick-wins effort fit **±12** (toggle only), momentum **6**
for in-progress work. Ranking is a pure function (`src/scoring/score.ts`)
computed on render, so it re-ranks live as items change. `npx vitest run`
covers it.

## Repo notes

- `scripts/git.mjs` — git via isomorphic-git, because this machine's Xcode
  CLT (and therefore system git) is broken. The `.git` it writes is
  standard; once `xcode-select --install` has run, plain git works on it.
- `scripts/verify-drive.mjs` — Playwright end-to-end drive of all four
  screens (see `.claude/skills/verify/SKILL.md`).
- `DECISIONS.md` — every judgment call made during the build, and why.

## What got cut (v1)

Auth/multi-user, the actual Asana integration (the item model mirrors Asana
task fields — name/notes/due date/project/section/assignee/completed — so
it maps cleanly later), touch-note history, item/project deletion, manual
re-ordering, and notifications. Details and rationale in `DECISIONS.md`.
