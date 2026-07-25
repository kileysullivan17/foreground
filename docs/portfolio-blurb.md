# Foreground: portfolio blurb

Two lengths, both answering the required bullets. The name is live as
Foreground (foreground-self.vercel.app). Items in *[brackets]* are still open
choices to make before publishing.

## Short blurb (card-length, for the Recent Builds grid)

Foreground is a personal prioritization engine that answers one question: what
should I work on right now. Built for a household and career with more open
loops than working memory, it scores every task across work and home with a
framework adapted from Weighted Shortest Job First (WSJF), explaining each
ranking in plain language and deliberately surfacing the work being avoided
instead of letting it sink to the bottom. Capture keeps up with real life: a
pasted list becomes many structured, reviewed items in one pass.
Product-managed in Claude and built autonomously by Claude Code, Foreground
runs its own roadmap as a groomed WSJF backlog inside the app, so the tool
prioritizes its own development. Live as an interactive demo at
foreground-self.vercel.app.

## Full blurb (case study intro)

**What it is:** A personal prioritization engine that answers one question:
what should I work on right now.

**The problem and what it does:** Task tools are good at storing work and bad
at ranking it, and they quietly bury the tasks being avoided, which is exactly
backwards for an ADHD-informed workflow. Foreground holds every open item
across work and home and scores each with a documented framework adapted from
Weighted Shortest Job First (WSJF): cost of delay over job size, with a
staleness multiplier so long-untouched work climbs instead of sinking. It maps
dependencies so unblocking work gets boosted, and shows the reasoning behind
every ranking. A dedicated "Stuff I've put off" view treats avoided work as a
first-class category. Capture scales too: paste a messy list and AI structures
it into titled, scored items you review before anything saves.

**Who it is for:** Built for myself, for now. The aim is bigger than a personal
to-do list: one place to organize and prioritize everything in life, run with
the product-management discipline I would use at work. It turns WSJF scoring
and groomed, criteria-backed backlogs on my own commitments instead of a
product team's roadmap.

**Outcome:** A working product, shipped end to end from a single brief and live
in production. The strongest signal is self-referential: it manages its own
development backlog with the same framework it applies to tasks. Usage metrics
will follow real use; none are claimed yet. *[Later: add a real figure the app
can back, e.g. "resurfaced N projects stalled past 30 days."]*

**How it was built:** Product management in Claude (the spec, the
prioritization framework it uses, and the build brief were developed
conversationally), then an autonomous build by Claude Code from a single
complete brief on Anthropic's Fable 5 model, with later features iterated on
Opus 4.8. The app's own roadmap is managed inside the app as user stories on a
Kanban board, groomed with the same WSJF framework it applies to my tasks. The
AI grooming and bulk-import features run against the live Anthropic API in
production, with a labeled local fallback when the model is off.

**Status:** Shipped. Live as an interactive public demo on Vercel
(foreground-self.vercel.app), with a guided tour for first-time visitors. The
public URL is intentionally a per-visitor demo: it runs on a local-first data
layer, so each visitor gets their own seeded copy and no personal data is
exposed. A synced personal backend (Supabase) is built into the same data layer
and kept on the roadmap's Later shelf.

**Screenshot:** *[Strongest candidates: the What Now view showing ranked items
with their plain-language explanations; the Product module Kanban showing the
app grooming its own backlog; and the bulk-import review step.]*

## Publishing notes

- The self-referential angle (a prioritization app that prioritizes its own
  development) is the hook; lead with it.
- FRAMEWORK.md is quotable material for the process section.
- Attribution stays precise: Claude for product work, Claude Code (Fable 5
  build, Opus 4.8 iteration) for engineering. That split is itself PM-of-AI
  practice, which is the portfolio's thesis.
- The live demo is guided: a visitor can take an in-app tour, so the link lands
  well without any setup.
