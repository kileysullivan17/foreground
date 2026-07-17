// Case study copy as a screen: what Foreground is, how it ranks, how it was
// built. Reachable from the wordmark header anywhere in the app.

export function About() {
  return (
    <main className="mx-auto max-w-lg px-5 pb-4 pt-3">
      <h1 className="font-display text-display">About Foreground</h1>

      <section className="mt-4 space-y-4 text-detail leading-relaxed text-sand-800 dark:text-sand-300">
        <p>
          Foreground is a personal prioritization tool: one place for every open project and task
          across work and home, built to answer a single question on demand. What should I work on
          right now? Its point of view is in the name: the app decides what belongs in the
          foreground of your attention, and it treats the work you keep putting off as a
          first-class signal instead of letting it rot quietly at the bottom of a list.
        </p>

        <p>
          Ranking uses WSJF (Weighted Shortest Job First), adapted for one person: cost of delay
          (deadline urgency, declared importance, how much other work an item unblocks, and a small
          momentum nudge for started work) divided by job size, then multiplied by a staleness
          boost that grows the longer an item goes untouched. Every ranked card shows its full
          arithmetic in plain language, so a surprising rank is always either trustworthy or fixable at the
          input. The same model runs at backlog zoom in the Product tab, where this app's own
          roadmap lives as user stories with acceptance criteria on a kanban board, groomed with an
          LLM assistant that proposes and never applies. The full model, with every weight and its
          rationale, is documented in FRAMEWORK.md in the repository.
        </p>

        <p>
          Built mobile-first with React 18, strict TypeScript, Tailwind, and TanStack Query over a
          swappable data layer: localStorage with seeded demo data by default, Supabase when
          configured. The app has managed its own development since the v2 build began; the Product
          backlog you can browse here is the real one. Every judgment call made during the build is
          logged with its rationale in DECISIONS.md, the scoring engine is unit tested, and each
          release is verified by driving the real UI in a headless browser. Built with Claude Code.
        </p>
      </section>
    </main>
  )
}
