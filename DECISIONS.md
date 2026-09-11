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

## v2: naming and environment

22. **Renamed to Foreground.** The brief ranked three names and said pick
    the first unless pushed back; no pushback, so Foreground it is. Applied
    to package metadata, the page title, a small wordmark header on every
    screen, and a new favicon (a vivid circle in front of a faded one: the
    name as a picture). The localStorage key stays `planner-db-v1` so
    existing users keep their data; renaming a storage key buys nothing.
23. **Real git from v2 on.** The Xcode CLT breakage that forced
    isomorphic-git in v1 has been fixed (system git 2.50.1 works).
    `scripts/git.mjs` stays in the repo as history but v2 commits use plain
    git.

## v2: Product module

24. **Tap-to-move, not drag-and-drop.** The brief allowed either. Drag on a
    phone needs a gesture library, fights scroll on a horizontally snapping
    board, and hides the affordance; tap a card, tap a column name is
    discoverable and testable with zero dependencies. Reversible if a
    desktop-heavy audience materializes.
25. **'Later' is a status with a shelf, not a fifth column.** The brief asks
    for a Backlog / Groomed / In Progress / Done board plus a Later set of
    v3 items. A fifth swipe column would put speculative work on equal
    visual footing with committed work; a collapsed shelf below the board
    keeps the pipeline honest.
26. **The morning check-in ships as a groomed story, not a feature.** The
    brief embeds it (verbatim, with acceptance criteria) under "seed it
    honestly", and the definition of done doesn't list it as a build
    requirement. Reading it as seed content keeps the backlog truthful:
    it is real planned work, groomed and unbuilt.
27. **`raw` is an explicit flag on stories.** Raw captures could be
    inferred (empty criteria), but grooming needs a crisp target for
    "show the groom action" and the inference breaks the moment someone
    writes criteria by hand on an ungroomed capture.
28. **Story scores are three 1..5 sliders plus fibonacci-ish size.**
    Value, urgency, and enablement mirror WSJF's cost-of-delay components
    at backlog granularity; size is story points in {1, 2, 3, 5, 8}. Same
    shape as the item scorer's cost of delay, so FRAMEWORK.md documents one
    model at two zoom levels.

## v2: scoring rework

29. **Cost-of-delay budgets carry over from v1 unchanged** (deadline 35 >
    importance 25 > unblocks 20 > momentum 6). The v1 rationale still
    holds and continuity means v1 users can read v2 cards. What changed is
    the arithmetic around them.
30. **Job size divides (S 1, M 2, L 3) instead of not counting.** This is
    the WSJF core the brief asked for. Honest consequence, documented in
    FRAMEWORK.md: a large near-deadline item can now rank below a small
    stale one. Deadline dominance is preserved within a size class (pinned
    by tests) rather than globally, and that is a defensible reading of
    what WSJF is for.
31. **Staleness became a multiplier (1 + days/60, 3-day grace, cap 1.5),
    was additive 0..15.** Additive staleness manufactures value from age;
    a multiplier amplifies value that is already there. Keeps staleness
    first-class (it is the differentiator) while fixing its worst failure
    mode, a trivial item leapfrogging critical work purely by being
    ignored.
32. **Quick wins is now steeper divisors (1/3/6), was a ±12 addend.** Same
    intent, expressed inside the framework instead of alongside it. Both
    directions still label themselves on the card.
33. **Momentum stays, filed under cost of delay.** Restart cost is a real
    delay cost. Still 6 points, still deliberately tie-break sized.
34. **Scores show one decimal now.** Division makes integer collisions
    common and the decimal keeps adjacent ranks explainable.

## v2: dependency view

35. **Nested lists, both directions, following the chain.** "Waits on"
    and "Would unblock" render transitively (a visited set guards the
    recursion), so a blocked card shows the whole path to unblocking, not
    just the first hop. Lives on blocked What-now cards and in the item
    editor; the checkbox picker in the editor stays the edit surface and
    got renamed to "Change what this waits on" so the two don't read as
    duplicates. Score integration already existed (blocked items are
    separated, unblockers get points) and is pinned by tests.
36. **Found and fixed: render-phase mutation.** The first version mutated
    the visited set while rendering; StrictMode's double render left it
    pre-filled and silently hid every nested branch. The tree is now built
    in a pure step first. Logged because it is exactly the class of bug
    the verify-at-the-UI habit exists to catch.

## v2: grooming assistant

37. **The proposal is just the editor, prefilled.** "Groom this" fetches a
    draft and opens the normal story editor with it; Save is the accept,
    Cancel discards. No parallel apply path to keep honest, and the
    "nothing auto-applies" rule holds structurally instead of by
    discipline. Accepting (or hand-writing criteria into a raw capture)
    clears the raw flag and moves a backlog story to Groomed.
38. **One stub, shared by both sides of the wire.** The deterministic
    draft heuristic lives in `src/lib/groomDraft.ts` and is used by the
    serverless function when `GROOM_LLM`/`ANTHROPIC_API_KEY` are unset and
    by the client when no serverless runtime exists (Vite dev). Every
    draft is labeled with its source in the UI, and API failure falls back
    to the stub rather than erroring: the flow never dead-ends and never
    pretends stub output came from the model.
39. **Live path written but gated.** `api/groom.ts` carries the real
    Anthropic call (claude-opus-4-8, structured JSON output against the
    draft schema) behind two env vars set only in Vercel. No key is
    requested, read, or stored in this run; the supervised session just
    sets env and flips `GROOM_LLM=live`.

## v2: portfolio polish

40. **About lives behind a header link, not a sixth tab.** The bottom nav
    holds the five working screens; About is read once and linked from the
    wordmark header on every screen, one tap from anywhere without
    spending permanent navigation on it.
41. **Seed scrub for screenshot safety.** The seed carried a real first
    name as assignee, a colleague's name, and a business name. Replaced
    with "Me", "the ops lead", and "the first contractor" in the seed and
    the drive script; `supabase/seed.sql` regenerated. Existing local
    stores keep old text until reseeded, which is fine: the requirement is
    that fresh loads are clean.
42. **App copy follows the house writing rules** (no em dashes, plain
    specific prose). Two v1 leftovers fixed in passing: the Blocked
    section toggle and a seed note.

## v2.1: audit remediation

An audit of the v2 build surfaced a numbered findings list; this section
logs the fixes and the judgment in each. F2 (Supabase RLS) is deliberately
left for its own pass alongside the auth design, before any deploy points at
hosted Supabase.

43. **F1: the grooming endpoint is a cost gate, not an auth boundary.**
    `api/groom.ts` now checks a shared secret (`GROOM_SECRET`) echoed by the
    client in `x-groom-secret`, caps the title at 300 characters, and applies
    a best-effort per-IP rate limit (12/minute per warm instance). The
    client's secret comes from `VITE_GROOM_SECRET`, injected at build time,
    so it ships in the browser bundle and is readable by anyone: the goal is
    to keep casual traffic off the paid Anthropic call, not to authenticate
    callers, and the code and docs say so plainly. All three guards are
    skipped when unconfigured, so stub-only deploys and local dev (which
    never hit the network) keep working with zero setup. Real request
    authentication waits on the same auth pass as F2.

44. **F3 + F4: loading and failure are now visible.** Every screen read its
    queries as `data ?? []`, so a still-loading or failed fetch looked
    identical to an empty list, and a failed save vanished silently. A shared
    `QueryStates` component branches on query status and renders a loading
    line or an error panel with a retry, keeping each screen's header and
    controls mounted around it. A `MutationCache` `onError` in `main.tsx`
    raises a toast (via a tiny external store so non-component code can reach
    it) whose Retry re-runs the failed mutation with its original variables.
    One place each for read failures and write failures, instead of
    per-call handling that would drift.

45. **F7 + F11: the grooming path validates and tells the truth about
    failure.** The draft shape is now a Zod schema in `groomDraft.ts`
    (`GroomDraft` is inferred from it), validated on both wire ends: the
    server parses the model's JSON against it and the client parses the fetch
    response against it, so a malformed body falls back to the stub instead of
    reaching the editor. The server `catch` logs the error (`console.error`)
    before falling back, so a live-mode failure leaves a trail. And the
    fallback carries a distinct `stub-fallback` source, letting the UI say the
    model call failed rather than implying it was never wired, which is the
    honest difference between "not configured" and "configured but errored".

46. **F5: the cycle guard now runs at save, not just in the picker.** The
    dependency picker already hid an item's transitive dependents so you
    could not pick a cycle, but the exclusion was computed once when the
    editor opened. If another editor added edges in between, a stale `dependsOn`
    could still commit a cycle. `save()` now recomputes the forbidden set from
    the current item list and filters `dependsOn` against it (and drops any
    self-reference) right before the mutation, so the invariant holds under
    concurrent edits instead of only in the happy path.

47. **F6: FRAMEWORK.md's deadline-dominance claim now matches the math.** The
    old text said that among items of similar size "deadlines still dominate",
    which overclaims: an important, stale, no-deadline item can and should
    outrank a far-off deadline, because staleness has real cost of delay to
    amplify there. The true guarantee is narrower and follows from staleness
    being a multiplier: a deadline beats any staleness-boosted *trivial* item,
    one with essentially zero cost of delay of its own, because the multiplier
    applied to zero is still zero. Rewrote the section to state exactly that
    and added a test pinning the boundary (a bare far-future deadline over a
    maximally stale importance-1 item that scores zero), documented as
    intended behavior.

48. **F12: the ranking re-ranks at midnight.** `rankItems` reads the current
    date internally, but What Now memoized it on `[items, quickWins]`, so a
    tab left open across midnight kept yesterday's ranking until something
    else changed, even though deadline urgency and staleness had both moved.
    Added the current day string to the memo dependencies so a render after
    midnight recomputes for the new day. It only forces recomputation when a
    render happens; it does not wake an idle tab, which is fine, the next
    interaction re-ranks correctly instead of showing a stale order.

## v2.2: the Organic redesign

49. **Tokens live in CSS `@theme`, not tailwind.config.js.** The design
    package ships a tailwind.config.js drop-in, but this repo runs Tailwind
    v4 via `@tailwindcss/vite`, where theme extension is CSS-first. The same
    tokens (ground/surface/ink, sand/clay/sage ramps, Caprasimo + Figtree,
    text/radius/shadow scales) went into `@theme` in `src/index.css`, which
    extends the default theme, so existing zinc/emerald classes keep working
    while screens migrate one commit at a time. Two deliberate deviations,
    noted in the CSS: the design's 4.4px spacing scale is not ported (it
    would silently repaint every `p-*`/`m-*` on unmigrated screens; only
    `tap` = 44px ships), and `shadow-sm/md/lg` are overridden with the
    ink-tinted values since the visual difference on old screens is
    imperceptible.

50. **Contrast verified programmatically; no ramp step needed darkening.**
    `scripts/contrast-check.mjs` computes WCAG ratios for all 48 small-text
    pairs the design uses (both themes, translucent ledger insets composited
    onto their real grounds before measuring). Every pair clears 4.5:1; the
    lowest are sand-700 meta on the dark theme's inverted ledger (4.94) and
    sand-500 meta on the ink panel's ledger (4.68). The script exits nonzero
    on failure so it can gate future palette retunes. This closes audit
    finding F10.

51. **Dark mode is a class, not a media query, and it's a user choice.** The
    design includes a dark What Now, so the app grew a small theme toggle
    (header, sun/moon). The choice persists in `planner-theme-v1` next to
    the app data; with nothing saved, the system preference applies. An
    inline script in index.html applies the class before first paint so a
    dark load never flashes light. New small feature, logged here per the
    design brief.

52. **F8 + F9: sheets are real dialogs and every target clears 44px.** A
    shared `Sheet` component owns bottom-sheet behavior: it renders in a
    portal, sets `aria-modal` with a label, moves focus to the first control
    on open and returns it on close, closes on Escape and on the scrim, and
    puts the app root under `inert` while open, which is also what keeps Tab
    inside the dialog. The groom-draft editor layers its own Escape handler
    in the capture phase, so Esc there discards the draft (keeping the raw
    capture) without also closing the sheet; a second Esc closes it. The
    reference also lists swipe-down dismiss; that needs a gesture library or
    hand-rolled touch tracking, so it is deliberately not implemented and
    the scrim, Esc, and the close button carry dismissal (F8). Every
    interactive target now has at least a 44px hit area: controls that grew
    honestly (nav links, list rows, editor rows) use `min-h-tap`, and the
    38px filter chips and 36px board chips from the reference keep their
    drawn size but extend an invisible `::before` hit area to 44px, so
    density and reachability stop trading against each other (F9). With the
    contrast pass in decision 50 (F10), that closes the redesign's three
    audit findings.

## v2.2.1: the production white screen

53. **The first navigation could white-screen the whole app; the cause was
    one unbraced arrow.** `ScrollToTop` had
    `useEffect(() => window.scrollTo(0, 0), [pathname])`: an expression-body
    arrow returns its expression, and an effect's return value becomes its
    cleanup. React only ignores a cleanup of exactly `undefined`; anything
    else gets called as a function on the next effect cycle. In browsers
    where an extension or injected script patches `window.scrollTo` to
    return a value, the first route change (reported as "clicking Product")
    made React call that value: `TypeError: n is not a function` inside
    React's own commit internals, the tree unmounted, white page until
    reload. Reproduced exactly against the deployed production bundle by
    stubbing `scrollTo` to return `true`, matching the reported minified
    stack frame for frame. Fixed by bracing the effect body, with a comment
    saying why the braces are load-bearing. The regression test stubs
    `scrollTo` the same hostile way, mounts the real App over the seeded
    data shape, and navigates.

54. **Every screen now renders inside an error boundary (the crash
    report's F8).** There was none anywhere, so any render or commit crash
    unmounted the root with nothing to catch it. Two now exist: an outer
    one around the whole app, and a route-keyed one around the screens, so
    a crashed screen degrades to a calm card (same anatomy as the query
    error state) while the header and tabs keep working, and switching
    tabs retries with a fresh subtree. A test mounts a throwing child and
    asserts the fallback renders.

55. **Live grooming never actually ran in production; the function died on
    an extensionless import.** `api/groom.ts` imported
    `../src/lib/groomDraft` without an extension; deployed under
    `"type": "module"` the function runs as node ESM, which refuses
    extensionless relative specifiers, so every call 500'd
    (ERR_MODULE_NOT_FOUND in the runtime logs) and the client quietly
    served its local stub, labeled as if the model was never wired. The
    import now carries the `.js` extension Vercel's builder maps back to
    the TypeScript source. Relatedly, the client's fallback after a failed
    deployed call is now labeled 'stub-fallback' ("the model call failed")
    instead of 'stub' ("not wired yet"), which is the distinction the UI
    copy already promised.

## v2.3: bulk import with AI-assisted structuring

56. **Capture was one item at a time, so a pasted list became one item with
    a paragraph title. That friction is what kept the app off a real daily
    backlog.** The new `/import` screen takes a messy paste and turns it into
    many items. Two structuring paths feed one mandatory review step, and
    only that step can save.

57. **The local parser is a pure, well-tested function, deliberately modest.**
    `parseImportText` (in `src/lib/importDraft.ts`, shared so the api build can
    reuse the schemas beside it) splits on newlines, strips bullet
    (`- * • ‣ ◦ · –`) and list-number (`1.`, `2)`, `(3)`) prefixes, trims,
    drops blanks and bare-glyph lines, and ignores obvious headers (markdown
    `#`, rules, and bare labels ending in a colon). Bullet stripping requires
    a following space so it never mangles `-5 degrees`; a bare `•` or `-`
    with no task is caught separately. A trailing note is kept as part of the
    title (`Call Sam: about the invoice` survives whole) because separating
    notes is the AI path's job, not the parser's. It never throws; the worst
    case is an empty list. Works fully offline and with `GROOM_LLM` off.

58. **AI structuring reuses the existing gated groom endpoint; no second
    unauthenticated path.** `api/groom.ts` gained a `mode: 'import'` branch
    that shares the same `GROOM_SECRET` echo and per-IP rate limit checked
    before the branch. It returns, per item, a cleaned title, an area, an
    effort, an importance, and a deadline that is null unless the text stated
    one (the system prompt carries the never-invent-deadlines rule, and the
    Zod schema refuses anything that is not a plain `yyyy-mm-dd` or null). The
    paste is capped at 10,000 chars server- and client-side so a giant paste
    cannot run up the paid endpoint.

59. **The AI path fails soft to the local parse, labeled honestly, same
    three-way distinction grooming already draws.** Model off →`source: 'stub'`
    ("the model is not wired here"); a live call that failed, was rate-limited,
    or lacked the secret → `'stub-fallback'` ("the model call failed"). Either
    way the client parses locally and says so; a stub is never passed off as
    the model. Each review row also carries an `origin`, and every field shows
    a small provenance chip (`AI` vs `parsed`/`default`) so an AI proposal is
    never mistaken for a parsed value.

60. **The review step is the accept gate, matching the grooming assistant's
    principle: nothing auto-applies.** Every proposed field is editable
    inline, each row has an include/exclude checkbox, and a "set area for all"
    control retargets the batch. Save creates every included item through a new
    `useCreateItemsBulk` save path (the data-layer interface is unchanged) and
    routes to What Now so the imports rank immediately. A one-line privacy note
    on the paste screen states that AI structuring sends the text to the
    Anthropic API and local parse does not, because work items get pasted here.
    Tests cover the parser (bullets, numbers, blanks, headers, caps) and the
    accept gate (reaching review writes nothing; Save writes only included,
    reviewed rows and routes; the AI path degrades to a labeled local parse
    offline).

61. **The live AI path is tested with the model mocked, not just the offline
    stub.** Two suites close the gap the first pass left open. `api/groom.test.ts`
    mocks the Anthropic SDK and drives the import branch end to end: a valid
    model response returns `source: 'llm'` with the items validated and an
    explicit ISO deadline passed through; a model deadline that is not a plain
    `yyyy-mm-dd` (or an out-of-range importance) is rejected by the Zod backstop
    and falls to `stub-fallback`, so malformed or invented output can never
    reach the client; a thrown SDK call, a missing key, an off switch, empty or
    oversize text, and the secret gate all behave. `src/lib/importClient.test.ts`
    forces `import.meta.env.DEV` off to exercise the deployed fetch branch: an
    `llm` body maps to AI-origin rows with deadlines intact and sends
    `mode: 'import'` with the paste capped and the cost-gate secret header, while
    a 401, a 429, a network throw, a not-wired stub, and a malformed body each
    degrade to a labeled local parse. The api test lives under `api/` (the app
    tsconfig has no node types) and is wired into vitest's include but excluded
    from the api tsc build.

## v2.4: portfolio demo pass

62. **The deployed site is already a per-visitor demo, so the work was
    orientation, not isolation.** Production runs the local-first adapter with
    no Supabase configured (confirmed by inspecting the deployed bundle: zero
    `supabase.co` references, the seed baked in), so every visitor gets their
    own seeded copy in their browser and no one sees anyone else's data. What
    was missing was a way for a first-time visitor, a product or hiring manager
    included, to understand what they are looking at. Added a dismissible
    live-demo banner on What Now (persisted per browser so a returning or daily
    user never sees it twice) that links to the walkthrough, rewrote About into
    a guided walkthrough of each surface, and expanded the Product intro. The
    acronym is spelled out in full, "Weighted Shortest Job First (WSJF)", on the
    first use on each page, then shortened. The seed gained an in-progress
    roadmap ticket for bulk import, which both keeps the app's own backlog
    current and fills the board's previously empty In progress column. A test
    covers the banner (shows once, stays dismissed).

## v2.5: interactive guided tour

63. **The walkthrough got an interactive form, built without a tour library.**
    A dependency-free `Tour` component spotlights a real element (a box-shadow
    cutout dims everything else) and floats a step card beside it. Steps target
    live selectors rather than duplicating any UI, so the tour points at the
    real interface; a missing target degrades to a centered card instead of
    breaking. Five steps, tuned for a product or hiring-manager visitor, run on
    What Now (the foreground pick, the score ledger where the acronym is spelled
    out, Quick wins, and the ranked queue) and the last card hands off to the
    product board on request. It is opt-in: `TourProvider` renders nothing until
    a visitor clicks Take the tour on the demo banner or the About screen, so
    the default tree and every test that does not start it are untouched, and
    `useTour` has a no-op default so a screen rendered without the provider (a
    unit test) does not throw. The card flips above or below the target by which
    half of the viewport the target sits in, so the spotlight is never covered.
    A test covers start, step forward and back, the board hand-off, and close on
    Skip or Finish.

## v2.6: PostHog instrumentation

64. **Analytics exist to test the product's own claims, not to count
    visitors.** Six explicit events (`docs/analytics.md`), each a hypothesis
    about the staleness thesis or the auditability claim, with the rule for
    what result would change the multiplier written down before any data
    arrived. Autocapture, session recording, heatmaps, surveys, feature flags,
    and remote config are all off, so the taxonomy cannot grow from the
    dashboard side. PostHog rather than Amplitude because it is open source,
    which matches an MIT-licensed tool whose argument is that its scoring is
    inspectable; the portfolio site runs Amplitude so the two can be compared.

65. **Self-exclusion is a mechanism, not a caution.** Capture is decided
    before `posthog.init` and before the posthog-js chunk is downloaded: the
    hostname must exactly equal the production one, `navigator.webdriver` must
    be false, and a per-browser opt-out flag (`?fg_optout=1`) must be absent.
    The allowlist is an exact match rather than "not localhost" because the
    repo is public and a fork must send nothing anywhere. The Amplitude
    instrumentation on the portfolio shipped without this and recorded only
    the author's own testing; a warning in a document did not prevent that,
    so the control lives in code and is pinned by tests. The flag is per
    browser, which is stated as a limitation everywhere it is mentioned.

66. **No item content leaves the browser.** Property values are buckets,
    counts, and booleans only, and a test fails if a payload contains anything
    else. Persistence is localStorage so no cookie is set, and no person
    profile is ever created. Someone's backlog is the work they are avoiding.

67. **The counterfactual ranking is a scoring option, not a second engine.**
    `rankItems(items, { staleness: false })` ranks the same list as if nothing
    were stale; an item is "promoted" when its position is better with the
    multiplier than without. That keeps the analytics on the same code path
    the screen uses, so the event can never disagree with the arithmetic the
    card shows. The default is unchanged and a test pins that.

## v2.7: Ember

68. **One theme, one accent, one lit thing.** The Organic direction (cream
    ground, terracotta and sage, Caprasimo) is replaced by Ember
    (`design/EMBER.md`): a cool near-black ground with warm off-white type,
    Archivo for prose and Geist Mono for anything that is a measurement.
    Exactly one panel per screen carries the accent border and glow (the #1
    readout, the focused field, the active tab); lists are dotted rules, not
    cards. Terracotta is reserved for time and action (deadline points, the
    staleness multiplier, the primary button, the in-progress dot), and
    there is no second accent: unblocks, momentum and Done read in plain
    white so orange means time pressure and white means flow. Overdue stays
    the only red. The light theme and its toggle are gone rather than left
    as dead plumbing, because a toggle that does nothing is a broken
    control. The restyle kept every screen's DOM shape and copy; the only
    additions are readouts the design specifies and the data already
    carries (the staleness gauge and multiplier on Put off, area and column
    counts, "· blocked" in a project row's margin). The verify drive's
    selectors moved from Organic utility names to Ember type roles
    (`.text-row`, `.text-factor`, `.rounded-inner`), which is the one
    place the design names leak into a test.

## Cut from v1 (deliberately)

- Auth / multi-user; Asana API integration (data model is shaped for it).
- Touch-note history; item delete (statuses cover it); project delete.
- Manual re-ordering; notifications/reminders; offline sync beyond
  localStorage; drag-and-drop.
- "Reset demo data" button — clear the site's localStorage to reseed.
