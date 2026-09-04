# PostHog instrumentation: session report

Branch: `posthog-instrumentation` (one commit, not merged, no PR opened).
Scope: `posthog-foreground-instructions.md` v2, executed from Step 0.
Date: 2026-09-03 (evening), intended deploy 2026-09-04.

## Step 0: what was found

**Framework.** Vite 8 (rolldown) building a React 18 single-page app in
strict TypeScript, routed by `react-router-dom` v7 `BrowserRouter`, data via
TanStack Query over a `DataProvider` interface whose default implementation is
localStorage (Supabase is the alternative, unused in production). Vercel serves
`index.html` for every path through a rewrite.

**Server component.** None that renders the app. Two Vercel serverless
functions exist: `api/groom.ts` (the Anthropic call for grooming drafts) and
`api/clientlog.ts` (a client-error drain). Neither sees an item, a score, or a
ranking, so `posthog-node` is not needed and was not installed.

**Where things happen.**

| Concern | File |
|---|---|
| Item created | `src/screens/AddItem.tsx` (form), `src/screens/Projects.tsx` (inline add), `src/screens/Import.tsx` (bulk). All go through `useCreateItem` / `useCreateItemsBulk` in `src/hooks/useData.ts`, which call `db.createItem` in `src/data/local.ts`. |
| WSJF score computed | `src/scoring/score.ts` (`scoreItem`, `rankItems`). Stories use `src/scoring/wsjf.ts`, out of scope. |
| Ranked list rendered | `src/screens/WhatNow.tsx` (`ForegroundCard` for rank 1, `QueueCard` for the rest). |
| Score breakdown expanded | `src/screens/WhatNow.tsx`, the `QueueCard` toggle (`open` state), which mounts `src/components/ScoreLedger.tsx`. Rank 1's ledger is always open. |

## Files changed

New:

- `src/analytics/config.ts`: key, host, the exact-match production hostname allowlist, the opt-out storage key and query parameter. The only file that reads `import.meta.env` for analytics.
- `src/analytics/posthog.ts`: the gate (`applyOptOutParam`, `decideCapture`, `initAnalytics`), the lazy `import('posthog-js')`, `track`, `capturePageview`.
- `src/analytics/events.ts`: the six typed event functions, `wsjfBucket`, `comparePromotion` / `promotionReport`.
- `src/analytics/AnalyticsBoot.tsx`: manual `$pageview` on route change and `session_started` once per page load.
- `src/analytics/posthog.test.ts`: 20 tests on the suppression rules and the init path (posthog-js mocked).
- `src/analytics/events.test.ts`: 12 tests on event shapes, dedupe, promotion, and the no-content rule.
- `docs/analytics.md`: the Step 4 document, plus the opt-out limitation, data-start date, insight recipe, verification recipe.
- `POSTHOG-SESSION-REPORT.md`: this file.

Modified:

- `package.json`, `package-lock.json`: `posthog-js` 1.426.3 added as a dependency.
- `src/main.tsx`: calls `initAnalytics()` before the first render.
- `src/App.tsx`: mounts `AnalyticsBoot` inside the router.
- `src/screens/WhatNow.tsx`: fires `score_breakdown_expanded`, `weights_adjusted`, `ranking_reordered_by_staleness`; computes the no-staleness counterfactual ranking.
- `src/hooks/useData.ts`: fires `item_created` (both create paths) and `item_completed` (`useSetStatus` and `useUpdateItem`), after the save lands.
- `src/scoring/score.ts`: new `staleness?: boolean` option on `ScoreOptions`; default behaviour unchanged.
- `src/scoring/score.test.ts`: one test pinning that option and the unchanged default.
- `.env.example`: `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` placeholders with a note that capture is hostname-gated.
- `README.md`: one Repo notes bullet pointing to `docs/analytics.md`.
- `DECISIONS.md`: v2.6 section, decisions 64 to 67.

No key or host value appears in any file. The build on this machine had no
env set, and `grep phc_ dist/assets/*.js` finds nothing.

## Step 1 and 1b: configuration and self-exclusion

`posthog.init` runs with: `persistence: 'localStorage'` (no cookies),
`person_profiles: 'identified_only'` (no profiles, no identify call anywhere),
`capture_pageview: false` with manual `$pageview` on route change,
`capture_pageleave: false`, `autocapture: false`, `rageclick: false`,
`capture_dead_clicks: false`, `capture_heatmaps: false`,
`capture_performance: false`, `capture_exceptions: false`,
`disable_session_recording: true`, `disable_surveys: true`,
`disable_web_experiments: true`, `disable_external_dependency_loading: true`,
`advanced_disable_flags: true`. The last two mean no recorder, survey, or
site-app script is ever fetched and no remote config is consulted, so nothing
can be switched on from the dashboard.

Suppression order in `initAnalytics`: `?fg_optout=1` writes the flag and
returns before anything else; `?fg_optout=0` removes it and continues. Then:
no key or host, hostname not exactly in `PRODUCTION_HOSTNAMES`
(`['foreground-self.vercel.app']`), opt-out flag set, localStorage unreadable,
`navigator.webdriver` true. Every localStorage access is in try/catch. When
suppressed, `posthog-js` is not imported at all; Vite splits it into its own
chunk (`module-*.js`, about 90 KB gzipped) that only loads on a capturing page.

The per-browser limitation is stated in `docs/analytics.md`, in
`DECISIONS.md`, in the `config.ts` comment, and here: the flag lives in one
browser profile on one device. Sully must open `?fg_optout=1` once in every
browser he uses, phone included, and again after clearing site data.

Data-start date recorded in `docs/analytics.md` as 2026-09-04 with an
instruction to correct it if the deploy lands on a different day.

Reverse proxy: not built, recorded as a known limitation and follow-up.

## Step 2: the six events and where each fires

| Event | Fires from | Properties |
|---|---|---|
| `item_created` | `useCreateItem` and `useCreateItemsBulk` in `src/hooks/useData.ts`, once per item after `db.createItem` resolves. Covers Add item, Projects inline add, and Import. | `has_due_date`, `initial_wsjf_bucket` (low under 10, mid 10 to under 20, high 20 and up; scored against the full list at creation) |
| `score_breakdown_expanded` | `QueueCard` toggle in `src/screens/WhatNow.tsx`, only on open. Blocked cards and the always-open rank 1 ledger do not fire. | `item_wsjf_bucket`, `staleness_multiplier_applied` |
| `ranking_reordered_by_staleness` | `useEffect` in `WhatNow` after the visible ranking is computed. The list is ranked again with `staleness: false`; an item is promoted when its position is better with the multiplier. Deduped per distinct promoted set per page load; never fires with a count of zero. | `items_promoted_count`, `max_multiplier` (largest multiplier among promoted items) |
| `item_completed` | `useSetStatus` and `useUpdateItem` in `useData.ts`, after a save that sets status to done, computed from the cached list as it stood before the save. | `days_open`, `staleness_multiplier_at_completion`, `was_promoted_by_staleness` |
| `weights_adjusted` | The Quick wins toggle in `WhatNow`. Foreground has no per-weight editor; this toggle is the one user-facing change to the model (divisors 1/2/3 to 1/3/6). | `weight_changed: 'job_size_divisor'`, `direction` (`up` when the toggle goes on) |
| `session_started` | `AnalyticsBoot` once per page load, after the item query resolves. | `items_in_backlog` (open plus in progress), `oldest_item_days` (from `createdAt`) |

Plus one manual `$pageview` per route change, as Step 1 requires. Step 5's
"exactly six event types" check should therefore read: six custom events plus
`$pageview`, and nothing else. This is stated in `docs/analytics.md`.

Judgment calls worth a second look in review:

- `was_promoted_by_staleness` and `staleness_multiplier_at_completion` use
  default divisors even if the person completed the item from the Quick wins
  view. Documented as a limitation.
- `session_started` is per page load, not per PostHog session. A refresh
  counts again. Documented.
- `ranking_reordered_by_staleness` does not fire when zero items are
  promoted, so "how often" is read as sessions with the event over
  `session_started`.

## Step 3: the saved insight

**Not created.** I have no access to the PostHog project from this session
(no PostHog connector is configured, and I did not use your browser session
to act in your account). Independently of access, PostHog's insight builder
only lists events the project has already received, and the project receives
its first event when this branch deploys. `docs/analytics.md` records the
name ("Staleness promotion: does it work"), the definition (Trends on
`item_completed`, breakdown by `was_promoted_by_staleness`), and a line to
paste the URL into once it exists. This is a two-minute task after the first
events arrive.

## Step 4: documentation

`docs/analytics.md` covers all five required sections: why PostHog and not
Amplitude; the six events as hypotheses; what is deliberately not tracked and
why; known limitations (no reverse proxy, single-digit users, the completion
signal, per-browser opt-out, per-page-load sessions, default-divisor
promotion, observational not experimental); and four decision rules written
before any data exists, each with a data threshold below which the answer is
"not enough data." The honesty constraints from the instructions are
restated: cite the design and the decision rule, never the counts.

## Step 5: what was verified, and how

Everything below ran on this machine against `localhost`. Nothing below ran
against production, because the branch is not deployed.

**Ran and observed:**

1. `npm run build` passes (tsc, api typecheck, vite build). posthog-js lands
   in a separate chunk. Ran twice: after the code and again before the
   commit.
2. `npm run lint` passes with the same one pre-existing warning (`Tour.tsx`
   fast-refresh) as on main.
3. `npx vitest run`: 95 tests pass, 33 of them new. Three suites
   (`App.test.tsx`, `WhatNow.test.tsx`, `Import.test.tsx`) fail at import
   with `localStorage` undefined. **They fail identically on the untouched
   tree** (checked with `git stash`), so this is a pre-existing happy-dom
   environment problem, not a regression. It does mean the App-level tests
   gave me no signal on my UI changes; the Playwright drive below is what
   covered them.
4. Unit tests on the gate (`posthog.test.ts`): exact-match hostname (seven
   near-miss hostnames including two Vercel preview shapes, `www.` and a
   suffix attack all suppressed), no-config, opt-out flag, blocked storage,
   webdriver. With posthog-js mocked and the happy-dom URL set to the
   production hostname: `?fg_optout=1` writes the flag and `init` is never
   called; the flag persists across loads until `?fg_optout=0` clears it;
   localhost and a preview URL never call `init`; blocked storage and
   automation never call `init`; on production, `init` receives exactly the
   configuration listed above and an event fired before the chunk lands is
   queued and delivered; `document.cookie` stays empty.
5. Unit tests on the taxonomy (`events.test.ts`): each event's exact
   property set; promotion detection on a fixture where a stale item leads
   only because of the multiplier; dedupe of `ranking_reordered_by_staleness`
   and `session_started`; `item_completed` ignores unknown ids and already
   done items. The privacy test fires every event with items whose titles
   and notes are marked `SECRET`, then asserts the set of event names is
   exactly the six, no payload string contains `SECRET` or an item id, and
   every value is a number, a boolean, or one of `low mid high up down
   job_size_divisor`.
6. Built bundle served with `vite preview` on port 5200, in the in-app
   browser: the What now screen renders (rank 1 card plus 13 queue cards),
   no console errors, the only requests are to `localhost:5200` and Google
   Fonts, `posthog-js`'s chunk is never fetched, `window.posthog` is
   undefined, `document.cookie` is empty. Opening `?fg_optout=1` wrote
   `fg_analytics_optout = '1'` and the screen rendered identically; opening
   `?fg_optout=0` removed it and the screen rendered identically. Zero
   requests matching `posthog` across all three loads.
7. The repo's own Playwright drive (`scripts/verify-drive.mjs`, pointed at
   port 5200) ran through Steps 1 to 10 and both probes with no page errors:
   Quick wins toggle re-ranks, Done on the top item removes it, blocked
   shelf, Put off touch, Projects inline add and edit, Add item fast capture,
   Product board. It failed at Step 11 (grooming) because `vite preview`
   does not serve `/api/groom`; that is expected outside Vercel and
   unrelated to this change. Playwright reports `navigator.webdriver: true`,
   so this whole drive also exercised the automation-suppressed state.
8. A second short Playwright script opened and closed a queue card (the
   ledger mounted with its full arithmetic), toggled Quick wins twice, loaded
   `?fg_optout=1`, and logged every request host for the session:
   `localhost:5200`, `fonts.googleapis.com`, `fonts.gstatic.com`. Cookies:
   none. Page errors: none.

**Could not verify, and why:**

- **Step 5.2, six event types and no autocapture in PostHog's live view.**
  Needs production traffic and PostHog access. Neither exists yet. The
  configuration that makes it true is pinned by the init test, which is
  evidence about the config passed to `init`, not about what the dashboard
  will show.
- **Step 5.4, inspecting raw network payloads for item content.** No real
  request was ever made, because every local state is suppressed by design.
  The equivalent check ran at the unit level against the exact property
  objects handed to `capture`, with a mocked client. posthog-js adds its own
  properties (`$current_url`, browser, OS, screen size); none of those can
  carry item content, but I did not observe a wire payload.
- **Step 5.5, `?fg_optout=1` on production showing zero PostHog requests in
  the network panel, then `?fg_optout=0` restoring capture.** Needs the
  deployed site. Locally, the flag behaviour and the zero-request state were
  observed, but on localhost the hostname rule suppresses capture anyway, so
  the local observation cannot distinguish the opt-out rule from the
  hostname rule. The init test does distinguish them.
- **Step 5.6, localhost makes no PostHog request.** Observed, with one
  caveat: the local build had no `VITE_POSTHOG_*` values, so the no-config
  rule also applied. The hostname rule alone is covered by the init test
  (env stubbed, URL set to localhost, `init` never called), not by the
  browser.
- **Step 5.1's "let one go stale or simulate it."** The seed already
  contains stale items (multipliers up to 1.5), and the Playwright drive
  completed a promoted item (rank 1, multiplier 1.37) and the fixture test
  completes one promoted and one non-promoted item. I did not manually age
  a freshly created item.
- **Step 5.7 with site data blocked, in a real browser.** Covered by the
  blocked-storage unit test only; I did not run a browser profile with
  storage disabled.
- **Step 3**, above.

Two environment notes: `npm run dev` hung on this machine at "Re-optimizing
dependencies because lockfile has changed" and never bound its port, both in
and out of the sandbox, which is why verification used `vite preview` of the
production build instead. That is a better target anyway. A temporary
`.claude/launch.json` was created for the preview tool and deleted; it is not
in the commit.

## Follow-ups, in order

1. Merge, deploy, then run the production checks in `docs/analytics.md`
   ("How to verify a deployment"), and correct the data-start date if it is
   not 2026-09-04.
2. Open `https://foreground-self.vercel.app/?fg_optout=1` once in every
   browser you use, phone included, before doing anything else on the site.
3. After the first real events arrive, create the saved insight and paste
   its URL into `docs/analytics.md`.
4. Optional: the reverse proxy through a Vercel rewrite.
5. Optional and unrelated: the three test suites that fail on happy-dom.
