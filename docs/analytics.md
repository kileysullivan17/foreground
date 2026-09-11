# Analytics

Foreground captures a small, explicit set of product events with PostHog.
The point is not traffic reporting. The events exist to test the product's
own design claims against its own data, and this file states in advance what
result would change the product. Reading the counts as evidence about users
is a misuse of them: the user base is a handful of people, so nothing here
is statistically meaningful and no rate should be quoted as one.

## Data starts

**2026-09-04**, the day this instrumentation first deployed to
`foreground-self.vercel.app`. Nothing before that date exists in the PostHog
project, and nothing after it that arrived through a preview URL, localhost,
an automated browser, or an opted-out browser exists either (see the next
section). If the actual deploy date differs, correct this line in the same
change that deploys it.

## Self-exclusion and opt-out

Capture is suppressed, before `posthog.init` ever runs and before the
posthog-js chunk is even downloaded, when any of these is true:

1. `window.location.hostname` is not exactly `foreground-self.vercel.app`
   (the allowlist is `PRODUCTION_HOSTNAMES` in `src/analytics/config.ts`).
   This is an exact match, not a "not localhost" rule: every Vercel preview
   URL, every branch deployment, and every self-hosted fork sends nothing
   anywhere unless its owner adds their own hostname.
2. The opt-out flag `fg_analytics_optout` is `'1'` in `localStorage`, or
   `localStorage` cannot be read at all (site data blocked). The app renders
   normally in both cases and simply captures nothing.
3. `navigator.webdriver` is true. Playwright, headless checks, and bots are
   not users.
4. `VITE_POSTHOG_KEY` or `VITE_POSTHOG_HOST` was unset at build time.

To opt a browser out, open the app once with `?fg_optout=1` on the URL.
Nothing visible happens; the flag is written and the page continues. To opt
back in, open it once with `?fg_optout=0`.

**The flag is per browser profile on one device.** It does not follow a
person. The author must visit the opt-out URL once in every browser used to
open the app, phone included, and again after clearing site data. An opt-out
believed to be working everywhere while it is set on one laptop is worse
than no opt-out at all, because it converts contaminated data into trusted
data. The Amplitude instrumentation on the portfolio site shipped without
this mechanism and every event in that project is the author's own testing.

The suppression rules are pinned by `src/analytics/posthog.test.ts`.

## Why PostHog here and not Amplitude

The portfolio site uses Amplitude. Foreground uses PostHog, and the split is
deliberate:

- PostHog is open source. Foreground is MIT-licensed and its whole argument
  is that its scoring is inspectable. An open-source analytics tool matches
  that; a closed SaaS tool sitting inside it does not.
- PostHog's free tier is one million events a month, far more headroom than
  a small tool needs.
- Running both is the point. Building the same class of instrumentation in
  two tools produces a real answer to "what are the trade-offs between
  Amplitude and PostHog," which is a product-manager answer rather than a
  user answer.

## The six events, as hypotheses

Foreground's stated thesis is that avoided work surfaces instead of sinking,
and that every ranking shows its own arithmetic because a score a person
cannot audit is a score they will not trust. Six explicit events test those
two claims. Autocapture is off, so nothing else is recorded except one
manual `$pageview` per route change.

| Event | Properties | The claim it tests |
|---|---|---|
| `item_created` | `has_due_date`, `initial_wsjf_bucket` (low / mid / high) | Baseline volume. Also answers whether people bother with deadlines, and whether new items enter the list already urgent or quietly at the bottom. |
| `score_breakdown_expanded` | `item_wsjf_bucket`, `staleness_multiplier_applied` | **The auditability claim.** Does anyone actually open the arithmetic? And do they open it more often when a staleness line is part of it, which would mean the multiplier is the thing people want explained? |
| `ranking_reordered_by_staleness` | `items_promoted_count`, `max_multiplier` | **The core thesis.** How often does the staleness multiplier actually change the order a person sees, versus merely decorating scores without moving anything? |
| `item_completed` | `days_open`, `staleness_multiplier_at_completion`, `was_promoted_by_staleness` | **The payoff.** Do items the multiplier pushed up get done, or only looked at? |
| `weights_adjusted` | `weight_changed`, `direction` (up / down) | Is the default model trusted or overridden? Foreground has one user-facing knob on the model, the Quick wins toggle, which steepens the job-size divisors from 1/2/3 to 1/3/6. `up` is the toggle going on. |
| `session_started` | `items_in_backlog`, `oldest_item_days` | Backlog health over time: is the list growing, and is the oldest open item aging or getting cleared? |

The third and fourth events together are the whole experiment. If items
promoted by staleness get completed at a higher rate than items that were
never promoted, the product's central claim is supported by its own data.
If they do not, the claim is wrong, and that is the more interesting result.

Where each one fires:

- `item_created`: `useCreateItem` and `useCreateItemsBulk` in
  `src/hooks/useData.ts`, once per item, after the save lands. This covers
  the Add item screen, inline add on Projects, and bulk import.
- `score_breakdown_expanded`: a queue card on What now being opened
  (`src/screens/WhatNow.tsx`). Closing a card does not fire. The rank #1
  card's ledger is always open, so it has no expand event.
- `ranking_reordered_by_staleness`: What now, whenever the visible ranking
  is computed. The same list is ranked again with the multiplier switched
  off (`staleness: false` in `src/scoring/score.ts`); an item is promoted
  when its position is better with staleness than without. The event fires
  once per distinct promoted set per page load, and only when at least one
  item was promoted. `max_multiplier` is the largest multiplier among the
  promoted items.
- `item_completed`: `useSetStatus` and `useUpdateItem` in `useData.ts`,
  after a save that sets status to done. The multiplier and the promotion
  flag are computed from the list as it stood before the save, with default
  divisors, so a completion made from the Quick wins view is scored against
  the normal ranking.
- `weights_adjusted`: the Quick wins toggle on What now.
- `session_started`: once per page load, from `src/analytics/AnalyticsBoot.tsx`,
  after the item list has loaded. A hard refresh counts again.

Bucket boundaries: `low` below 10, `mid` from 10 to below 20, `high` from
20. A default new item (medium effort, importance 3, no deadline) scores
6.25; importance 5 with no deadline scores 12.5 at medium effort; anything
with a deadline inside two weeks, or that something else waits on, clears
20. The seed's fourteen ready items split 3 / 5 / 6 across the bands.

## What is deliberately not tracked

- **No item content.** No titles, notes, project names, touch notes, or
  dependency names ever leave the browser. Property values are buckets,
  counts, and booleans only, and `src/analytics/events.test.ts` fails if a
  payload contains anything else. A person's backlog is a list of things
  they are ashamed of not doing.
- **No session recording.** Foreground holds the user's real backlog, which
  is work they have been avoiding. Recording that is a privacy violation
  dressed as a feature. `disable_session_recording` is set and the recorder
  script is never loaded.
- **No user identification.** There is no `identify()` call and
  `person_profiles` is `identified_only`, so no person profile is created.
  Distinct ids are anonymous and random.
- **No cookies.** `persistence` is `localStorage`. The tool sets nothing in
  `document.cookie`.
- **No autocapture, heatmaps, dead-click, rage-click, web-vitals, exception,
  or survey capture.** Every event is explicit. Remote configuration and
  feature flags are disabled (`advanced_disable_flags`), so none of the
  above can be switched back on from the PostHog dashboard.

## Known limitations

- **No reverse proxy.** Requests go straight to the PostHog host, so content
  blockers suppress an unknown share of events. A Vercel rewrite would
  improve completeness and add a maintenance surface; it is a noted
  follow-up, not a plan.
- **Single-digit user counts.** Nothing here is statistically meaningful.
  Cite the instrumentation design and the decision rule below; do not cite
  the counts.
- **The completion signal depends on people marking items Done**, which
  they may not do consistently. An item that was finished and then parked,
  or simply left open, is invisible to `item_completed`.
- **Per-browser opt-out.** See above. The mechanism removes the author's
  traffic only where it has been set.
- **`session_started` is per page load**, not per PostHog session. A person
  who refreshes counts twice; PostHog's own `$session_id` on every event is
  the better session key when it matters.
- **Promotion is computed against the default divisors.** A completion made
  with Quick wins on is scored against the normal ranking, so the promotion
  flag can disagree with the order that person was looking at in that view.
- **This is not an experiment.** There is no A/B test and no control group.
  The comparison is observational.

## What would change the product

Written before any data exists, so that reading the data later is
measurement rather than decoration. Each rule needs at least ninety days of
data after the start date above, and the completion rules need at least
thirty `item_completed` events, before it is read at all. With fewer, the
answer is "not enough data," not a rate.

1. **Promotion without completion lowers the cap.** If
   `ranking_reordered_by_staleness` fires in most sessions but fewer than one
   in five `item_completed` events carry `was_promoted_by_staleness: true`,
   the multiplier is reordering the list without changing behaviour: people
   look past what it surfaces. The change is to lower the cap from 1.5 to
   1.25 (`STALENESS_CAP` in `src/scoring/score.ts`) so promoted items rise
   less far, and to re-read after another ninety days.
2. **Promotion with completion keeps the model.** If the share of
   completions that were promoted is at or above the share of the visible
   ranking that was promoted (approximated by `items_promoted_count` over
   `items_in_backlog`), the multiplier is at least not hurting and stays as
   it is.
3. **Nobody opening the arithmetic changes the copy, not the ledger.** If
   `score_breakdown_expanded` fires in fewer than one in ten sessions, the
   "every ranking shows its arithmetic" claim is a design principle rather
   than a used feature. The ledger stays, because it is cheap and it is the
   argument, but the About copy stops presenting it as the reason people
   trust the ranking.
4. **Quick wins in most sessions means the default divisors are wrong.** If
   `weights_adjusted` with `direction: up` appears in more than half of
   sessions, the steeper divisors are what people actually want and the
   defaults should move toward them.

## The saved insight

PostHog: **"Staleness promotion: does it work"**, a Trends insight on
`item_completed` broken down by the event property
`was_promoted_by_staleness`. It is the artifact: a falsifiable test of a
design decision, published in the repo of the product it tests.

Status: **not yet created.** PostHog's insight builder only offers events the
project has already received, and the project receives its first event when
this instrumentation deploys. To create it once data has arrived: New insight,
Trends, series `item_completed` (Total count), Breakdown by event property
`was_promoted_by_staleness`, then Save with the name above. Record its URL
here when it exists.

## How to verify a deployment

1. Open `https://foreground-self.vercel.app/?fg_optout=1`, reload, and check
   the network panel: there must be zero requests to the PostHog host. A
   missing event in the dashboard is not proof, because the dashboard lags.
2. Open `.../?fg_optout=0` and confirm requests to the PostHog host resume,
   that `document.cookie` is empty, and that no request body contains an
   item title.
3. In PostHog's live events view, the only event names should be the six
   above plus `$pageview`. No `$autocapture`, no `$pageleave`, no
   `$snapshot`.
4. Run the app from localhost and confirm no PostHog request is made at all.
5. Then opt the testing browser back out with `?fg_optout=1`.

## Configuration

`VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` are set in the Vercel project.
Both are public by design; a project API key can only write events. Every
other setting (the hostname allowlist, the opt-out key and query parameter)
is in `src/analytics/config.ts`. The client wrapper is
`src/analytics/posthog.ts`, the taxonomy is `src/analytics/events.ts`.
