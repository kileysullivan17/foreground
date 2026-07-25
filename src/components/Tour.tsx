import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'

// A dependency-free guided tour. It spotlights a real element on the screen
// (a box-shadow cutout dims everything else) and floats a step card with the
// explanation. Steps target live selectors, so nothing here duplicates the UI;
// it points at it. Rendered by TourProvider only while active, so the default
// tree, and every test that does not start it, is untouched.

interface Step {
  /** CSS selector for the element to spotlight. Omit for a centered card. */
  target?: string
  title: string
  body: ReactNode
  /** Final-step action button, e.g. jump to the product board. */
  cta?: { label: string; path: string }
}

// Five steps, tuned for a first-time product or hiring-manager visitor. All
// targets live on What Now, so the tour never navigates mid-flight; the last
// card hands off to the product board on request.
const STEPS: Step[] = [
  {
    target: 'section[aria-label="In the foreground"]',
    title: 'One thing, front and center',
    body: 'Foreground picks a single item to do next and puts it in the foreground. The runner-up work queues below it, so the screen answers "what now?" before you scroll.',
  },
  {
    target: '[data-tour="fg-ledger"]',
    title: 'No black box',
    body: 'Every rank shows its math. Cost of delay (deadline urgency, importance, and what an item unblocks) divided by job size, times a staleness boost. This is the Weighted Shortest Job First (WSJF) model, adapted for one person.',
  },
  {
    target: '[data-tour="quickwins"]',
    title: 'Re-rank for the moment',
    body: 'Only have a few minutes? Quick wins re-ranks to favor small, high-value items. The filters above scope the list to work or home.',
  },
  {
    target: '[data-tour="queue"]',
    title: 'The rest, still ranked',
    body: 'Below the foreground, everything else stays in order. Anything blocked by unfinished work drops into its own section with the chain that is holding it up.',
  },
  {
    title: 'That is the daily driver',
    body: 'The Product tab manages the app’s own roadmap as a kanban board of user-story tickets with WSJF scores, and Import turns a pasted list into many reviewed items in one pass.',
    cta: { label: 'See the product board', path: '/product' },
  },
]

interface TourValue {
  startTour: () => void
}

// Default no-op so a component can call useTour() without a provider mounted
// (a screen rendered in isolation in a unit test, for instance).
const TourContext = createContext<TourValue>({ startTour: () => {} })

export function useTour(): TourValue {
  return useContext(TourContext)
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const startTour = useCallback(() => setActive(true), [])
  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {active && <TourOverlay onClose={() => setActive(false)} />}
    </TourContext.Provider>
  )
}

function TourOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  // Find and track the current target. Poll until it exists (a route or data
  // query may still be settling), scroll it into view, then keep the spotlight
  // aligned through scrolls and resizes. A missing target degrades to a
  // centered card rather than breaking the tour.
  useEffect(() => {
    if (!step) return
    if (!step.target) {
      setRect(null)
      return
    }
    let raf = 0
    let tries = 0
    const locate = () => {
      const el = document.querySelector(step.target as string)
      if (el) {
        el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
        setRect(el.getBoundingClientRect())
      } else if (tries++ < 120) {
        raf = requestAnimationFrame(locate)
      } else {
        setRect(null)
      }
    }
    locate()
    const track = () => {
      const el = document.querySelector(step.target as string)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', track)
    window.addEventListener('scroll', track, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', track)
      window.removeEventListener('scroll', track, true)
    }
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!step) return null

  const next = () => (last ? onClose() : setIndex((n) => n + 1))
  const back = () => setIndex((n) => Math.max(0, n - 1))
  const runCta = () => {
    if (step.cta) navigate(step.cta.path)
    onClose()
  }

  // Keep the card clear of the spotlight: below it when the target sits high,
  // above it when the target sits low. Centered when there is no target.
  const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight
  const cardAtTop = rect ? rect.top > viewportH * 0.55 : false
  const pad = 8

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Click-blocking layer. Dim comes from the spotlight's box-shadow when a
          target exists; otherwise this layer carries the dim itself. */}
      <div
        className="absolute inset-0"
        style={{ background: rect ? 'transparent' : 'rgba(23,20,17,0.62)' }}
        onClick={(e) => e.stopPropagation()}
      />

      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: 18,
            boxShadow: '0 0 0 2.5px var(--color-clay-400), 0 0 0 9999px rgba(23,20,17,0.62)',
          }}
        />
      )}

      <div
        className={`absolute inset-x-0 mx-auto max-w-[380px] px-4 ${
          cardAtTop
            ? 'top-[max(16px,env(safe-area-inset-top))]'
            : 'bottom-[calc(84px+env(safe-area-inset-bottom))] lg:bottom-6'
        }`}
      >
        <div className="rounded-card bg-surface-raised p-4 shadow-lg dark:bg-surface-dark-raised">
          <div className="flex items-center gap-2">
            <span className="text-micro font-semibold uppercase tracking-[0.05em] text-clay-700 dark:text-clay-300">
              Tour
            </span>
            <span className="text-[11.5px] font-semibold tabular-nums text-sand-600 dark:text-sand-500">
              {index + 1} / {STEPS.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-[12.5px] font-semibold text-sand-700 hover:text-clay-700 dark:text-sand-400 dark:hover:text-clay-300"
            >
              Skip
            </button>
          </div>
          <h2 className="mt-1.5 font-display text-[19px] text-ink dark:text-ink-inverse">
            {step.title}
          </h2>
          <p className="mt-1.5 text-detail leading-[1.5] text-sand-800 dark:text-sand-300">
            {step.body}
          </p>
          <div className="mt-3.5 flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex min-h-tap items-center rounded-pill px-3 text-[13.5px] font-semibold text-sand-800 hover:bg-ink/6 dark:text-sand-300 dark:hover:bg-ink-inverse/8"
              >
                Back
              </button>
            )}
            {step.cta && (
              <button
                type="button"
                onClick={runCta}
                className="ml-auto inline-flex min-h-tap items-center rounded-pill border-[1.5px] border-ink/25 px-4 text-[13.5px] font-semibold text-ink hover:bg-ink/6 dark:border-ink-inverse/30 dark:text-ink-inverse dark:hover:bg-ink-inverse/8"
              >
                {step.cta.label}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className={`inline-flex min-h-tap items-center rounded-pill bg-clay-500 px-5 font-display text-[14px] text-ink hover:bg-clay-400 dark:bg-clay-400 dark:hover:bg-clay-300 ${
                step.cta ? '' : 'ml-auto'
              }`}
            >
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
