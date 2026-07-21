import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/reportError'

// Render-error backstop. Without one, any render crash unmounts the whole
// root: a white page with nothing to do but guess at a refresh. This
// boundary keeps the shell alive and degrades the broken screen to a calm
// card. It is keyed by route in App, so navigating to another tab retries
// with a fresh subtree instead of staying stuck on the fallback.

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error)
    // Send it up so a crash in the wild shows in the Vercel logs, not just
    // as a fallback card the user never reports.
    reportError({
      kind: 'boundary',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-lg px-3.5 pt-6">
          <div role="alert" className="rounded-card bg-surface px-5 py-6 text-center dark:bg-surface-dark">
            <span className="inline-grid size-[46px] place-items-center rounded-pill bg-clay-100 text-clay-700 dark:bg-clay-900 dark:text-clay-300">
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </span>
            <p className="mt-3 text-[16.5px] font-semibold text-ink dark:text-ink-inverse">
              This screen hit an error
            </p>
            <p className="mt-1 text-[13px] leading-[1.5] text-sand-700 dark:text-sand-400">
              Your items are safe on this device. Another tab may work fine; reloading resets this
              one.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex min-h-[46px] items-center justify-center rounded-pill bg-clay-500 px-8 font-display text-[14.5px] text-ink hover:bg-clay-400 active:scale-95 dark:bg-clay-400 dark:hover:bg-clay-300"
            >
              Reload
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
