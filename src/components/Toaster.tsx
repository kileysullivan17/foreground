import { useSyncExternalStore } from 'react'
import { dismissToast, getToasts, subscribeToasts } from '../lib/toast'

// Renders the toast store. Sits above the bottom nav so a failed save is
// visible without covering the tab bar. Errors are announced politely for
// screen readers.
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
          className="pointer-events-auto flex items-center gap-3 rounded-lg bg-red-600 px-3 py-2 text-sm text-white shadow-lg"
        >
          <span className="flex-1">{toast.message}</span>
          {toast.retry && (
            <button
              type="button"
              onClick={() => {
                dismissToast(toast.id)
                toast.retry!()
              }}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="shrink-0 text-base font-semibold leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
