---
name: verify
description: Build, launch, and drive the planner app end-to-end to verify changes at the UI surface.
---

# Verifying the planner

Surface: web GUI (React SPA), mobile-first at 390×844.

## Launch

```bash
npm run dev -- --port 5199   # background it; ready in ~1s
```

No env vars needed — the app defaults to the seeded localStorage adapter.
Each fresh headless-browser profile gets a fresh seed automatically.

## Drive

```bash
SHOTS=<screenshot-dir> node scripts/verify-drive.mjs
```

`scripts/verify-drive.mjs` (Playwright, headless Chromium already installed
via `npx playwright install chromium`) walks every screen: initial ranking +
factor labels, quick-wins re-rank, one-tap Done, blocked section with the
dependency chain, staleness order + touch-it, inline project add/edit,
re-rank after importance edit, fast capture with deadline, probes (empty
title, area-filter isolation), then v2: the Product kanban (capture a raw
idea, groom it, accept the draft, tap-to-move columns) and the About view.
Grep output for `STEP`/`PROBE` lines; `DONE` = full pass. Screenshots land
in `$SHOTS`.

## Gotchas

- This machine has broken Xcode CLT: **no system git, no brew, no python3**.
  Use `node scripts/git.mjs [commit <msg>|log|status]` for git.
- Ranking is derived state: if a mutation persists but the UI order doesn't
  change, suspect object identity — TanStack Query structural sharing needs
  immutable updates from the data provider (see LocalProvider comment).
- The drive script computes "tomorrow" in UTC; late-evening local runs can
  land a day later. Deadline labels in STEP8 may read "Due in 2 days".
