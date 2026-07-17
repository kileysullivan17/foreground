import { useSyncExternalStore } from 'react'
import { dismissToast, getToasts, subscribeToasts } from '../lib/toast'

// Renders the toast store. Sits above the bottom nav so a failed save is
// visible without covering the tab bar. Errors are announced politely for
// screen readers and stay calm: an ink panel with a clay Retry, no red.
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-lg flex-col gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-ctl bg-ink px-4 py-2.5 text-detail text-ink-inverse shadow-lg dark:bg-ink-inverse dark:text-ink"
        >
          <span className="flex-1">{toast.message}</span>
          {toast.retry && (
            <button
              type="button"
              onClick={() => {
                dismissToast(toast.id)
                toast.retry!()
              }}
              className="min-h-tap shrink-0 font-semibold text-clay-300 underline underline-offset-2 dark:text-clay-700"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="grid size-tap shrink-0 place-items-center text-base font-semibold leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
