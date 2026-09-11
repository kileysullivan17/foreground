// Case study and guided walkthrough as a screen: what Foreground is, how each
// surface works, and how it was built. Reachable from the wordmark header
// anywhere in the app. Written for a first-time visitor, a product or hiring
// manager included.

import { useNavigate } from 'react-router-dom'
import { useTour } from '../components/Tour'

export function About() {
  const navigate = useNavigate()
  const { startTour } = useTour()

  // The spotlight targets live on What Now, so route there first, then start.
  const takeTour = () => {
    navigate('/')
    startTour()
  }

  const lead = 'font-semibold text-text'

  return (
    <main className="mx-auto max-w-lg px-5 pb-8 pt-title-top">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="text-title text-text">About Foreground</h1>
        <button
          type="button"
          onClick={takeTour}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-accent px-3.5 text-[12.5px] font-semibold text-accent-ink hover:bg-accent-hover active:translate-y-px"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
          Take the tour
        </button>
      </div>

      <section className="mt-block space-y-4 text-[14px] leading-[1.6] text-text-2">
        <p>
          Foreground is a personal prioritization tool. It holds every open project and task across
          work and home in one place and answers one question on demand: what should I work on right
          now? The name is the point of view. The app decides what belongs in the foreground of your
          attention, and it treats the work you keep putting off as a real signal instead of letting
          it sink quietly to the bottom of a list.
        </p>
        <p className="rounded-inner border border-line bg-panel px-3.5 py-3 text-text-2">
          Everything on this site is a live, interactive demo. The data is sample data seeded into
          your browser, so you can rank, edit, complete, and import freely without touching anything
          real or anyone else's copy.
        </p>

        <p>
          <span className={lead}>How it ranks (What now).</span>{' '}
          The home screen orders your open work by a Weighted Shortest Job First (WSJF) score,
          adapted for one person. Cost of delay comes from deadline urgency, the importance you set,
          how much other work an item unblocks, and a small momentum nudge for anything already
          started. That divides by job size, then multiplies by a staleness boost that grows the
          longer an item goes untouched. Every card opens to show its full arithmetic in plain
          language, so a surprising rank is either trustworthy on inspection or fixable at the input.
          One item sits in the foreground; the rest queue below it, and anything blocked by
          unfinished work waits in its own section with the chain that is holding it up.
        </p>

        <p>
          <span className={lead}>What you keep avoiding (Put off).</span>{' '}
          A second view sorts by staleness alone, stalest first, so slow-moving work surfaces rather
          than hides. Logging a one-line note about where a thing stands resets its clock and records
          where you left it. Treating staleness as a first-class input is the piece most
          prioritization tools skip, and it is this one's differentiator.
        </p>

        <p>
          <span className={lead}>Projects.</span> Work and
          home projects group their items under a goal and an optional target date. Items can depend
          on each other, and the ranking reads those dependencies, so a blocked item never tops the
          list and whatever would unblock the most earns its place.
        </p>

        <p>
          <span className={lead}>The product board (Product).</span>{' '}
          This is where a product reviewer can inspect the practice instead of taking it on faith.
          The app manages its own roadmap as a groomed backlog on a kanban board: user-story tickets
          in standard form, each with acceptance criteria, an effort estimate in story points, and
          its own WSJF score, moving across Backlog, Groomed, In progress, and Done. A Later shelf
          holds candidates that are out of the math for now. A raw capture can be groomed by an LLM
          assistant that drafts a story with proposed criteria and proposed scores for review; it
          proposes and never applies, so nothing counts until you accept it. The same accept-gate
          governs bulk import, which turns a pasted list into many reviewed items in one pass.
        </p>

        <p>
          <span className={lead}>How it is built.</span>{' '}
          Foreground is mobile-first React with strict TypeScript, styled with Tailwind and served
          over a swappable data layer that runs on browser storage by default and Supabase when
          configured. The scoring engine is unit tested, every release is verified by driving the
          real interface in a headless browser, and each judgment call from the build is written down
          with its reasoning in DECISIONS.md. The full scoring model, with every weight and why it
          holds the value it does, is in FRAMEWORK.md. Built with Claude Code.
        </p>
      </section>
    </main>
  )
}
