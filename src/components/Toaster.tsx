import { useSyncExternalStore } from 'react'
import { dismissToast, getToasts, subscribeToasts } from '../lib/toast'

// Renders the toast store. Sits above the bottom nav so a failed save is
// visible without covering the tab bar. Errors are announced politely for
// screen readers and stay calm: a panel pill with an accent Retry, no red.
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-28 z-50 mx-auto flex max-w-lg flex-col gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-pill border border-line bg-panel px-4 py-2.5 text-[13.5px] text-text shadow-frame"
        >
          <span className="flex-1">{toast.message}</span>
          {toast.retry && (
            <button
              type="button"
              onClick={() => {
                dismissToast(toast.id)
                toast.retry!()
              }}
              className="min-h-tap shrink-0 font-semibold text-accent underline underline-offset-2"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="grid size-tap shrink-0 place-items-center text-base font-semibold leading-none text-text-3 hover:text-text"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
