import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/reportError'

// Render-error backstop. Without one, any render crash unmounts the whole
// root: a white page with nothing to do but guess at a refresh. This
// boundary keeps the shell alive and degrades the broken screen to a calm
// panel. It is keyed by route in App, so navigating to another tab retries
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
          <div role="alert" className="rounded-panel border border-overdue/40 bg-panel px-5 py-6 text-center">
            <span className="inline-grid size-[46px] place-items-center rounded-pill bg-raised text-overdue">
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </span>
            <p className="mt-3 text-[16.5px] font-semibold text-text">
              This screen hit an error
            </p>
            <p className="mt-1 text-[13px] leading-[1.5] text-text-2">
              Your items are safe on this device. Another tab may work fine; reloading resets this
              one.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-pill border border-line-strong px-8 text-[14px] font-semibold text-text hover:border-text active:translate-y-px"
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
