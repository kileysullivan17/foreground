# Decisions

Judgment calls made during the build, and why. Newest last.

## Environment workarounds

1. **Built in `planner/` instead of the folder root.** The target folder
   wasn't empty (it holds brief documents); scaffolding around them would
   have been messy.
2. **Commits via isomorphic-git (`scripts/git.mjs`).** This machine's Xcode
   Command Line Tools are broken: no system `git`, and Homebrew/`python3`
   fail for the same reason. isomorphic-git writes a standard `.git`, so
   history is fully usable once real git works (`xcode-select --install`
   fixes it). Commit authorship is set to Claude.
3. **Local data adapter as the default backend.** The brief says "mock data
   seeded through Supabase", but local Supabase requires Docker (not
   installed, needs admin/GUI) and hosted Supabase requires live
   credentials (explicitly out of scope). Compromise: one `DataProvider`
   interface with two implementations — a localStorage adapter seeded on
   first load (default, zero setup) and a real Supabase adapter that
   activates when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set.
   `supabase/migrations/0001_init.sql` + `supabase/seed.sql` are ready for
   `supabase start` && `supabase db reset`. Reversible by setting two env
   vars; no code changes.

## Stack details

4. **React pinned to 18.x.** The current Vite template ships React 19; the
   brief says React 18 exactly.
5. **Tailwind v4 via `@tailwindcss/vite`.** Brief says "Tailwind CSS"
   without a version; v4 is current and needs no PostCSS config.
6. **Zod v4 with `@hookform/resolvers` v5.** Current majors; the form
   schemas normalize `''` from selects/date inputs to `null`.
7. **Single seed source.** `src/data/seed-data.json` holds relative day
   offsets; the local adapter materializes it at runtime and
   `scripts/gen-seed-sql.mjs` emits `supabase/seed.sql` from the same file
   (deterministic md5-derived UUIDs), so the two backends cannot drift.
8. **No auth in v1.** Single-user tool, no credentials allowed in this run.
   The SQL enables RLS with a permissive policy and a comment marking where
   to lock down when auth lands.
9. **Asana mapping.** Items carry optional `section` and `assignee` fields
   beyond the brief's core model so the shape covers every Asana field the
   brief lists (name, notes, due date, project, section, assignee,
   completed). `dependsOn` is a Postgres `uuid[]` rather than a join table —
   simpler, and dependency math happens client-side in v1.

## Scoring design

10. **Factor budgets: deadline 35 > importance 25 > unblocks 20 >
    staleness 15 > quick-wins ±12 > momentum 6.** Rationale: a real
    deadline should beat everything; importance separates the 5s from the
    2s; being a blocker matters more than being stale; staleness is capped
    so put-off items climb steadily but can never outrank due-tomorrow
    work.
11. **Staleness is quiet for the first 3 days** — otherwise every item
    carries a noise factor from day one.
12. **Momentum factor (+6 for in-progress) added beyond the brief.** Cheap,
    transparent, and matches how work actually finishes. Logged here since
    the brief didn't ask for it.
13. **Blocked items are separated, not penalized.** An item whose
    dependencies aren't done can't be started, so ranking it lower is still
    wrong — the top of "What now" must always be startable. Blocked items
    sit in a collapsed section with "Waiting on …" instead of a score.
14. **Quick-wins toggle is ±12, including a penalty for Large items** — on
    a low-energy pass, big jobs should actively sink, not just fail to
    rise.
15. **Any status change resets the staleness clock.** Acting on an item is
    touching it.
16. **Only the latest touch note is kept** (`lastTouchNote`), not a
    history. A history table is a clean later addition; v1 needs the
    prompt-for-a-note ritual more than the archive.
17. **Dependency picker is same-area and cycle-safe.** The editor excludes
    the item's transitive dependents so you can't create a dependency
    cycle, and only offers same-area items to keep the list short.

## UI

18. **Bottom tab nav, 390px-first, no onboarding.** Cards show every
    scoring factor with its points in plain language — the "show the why"
    requirement is the center of the main screen, not a tooltip.
19. **Editing lives on the Projects screen; What-now cards only change
    status.** Keeps the ranked list fast to act on. Fields that change
    ranking (importance, deadline, effort, dependencies, status) are all
    inline-editable there.
20. **Scroll-to-top on tab change** — found during verification; SPA nav
    otherwise preserves scroll and tabs open mid-list.

## Verification

21. **Playwright kept as a devDependency with `scripts/verify-drive.mjs`.**
    Driving the real UI caught a real bug the unit tests couldn't: the
    local adapter mutated objects in place, which defeated TanStack Query's
    structural sharing — mutations persisted but no view ever re-ranked.
    Fixed by replacing objects immutably (see comment in
    `src/data/local.ts`).

## Cut from v1 (deliberately)

- Auth / multi-user; Asana API integration (data model is shaped for it).
- Touch-note history; item delete (statuses cover it); project delete.
- Manual re-ordering; notifications/reminders; offline sync beyond
  localStorage; drag-and-drop.
- "Reset demo data" button — clear the site's localStorage to reseed.
