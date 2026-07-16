// A tiny external toast store, subscribed to with useSyncExternalStore. Kept
// out of React context so non-component code (the QueryClient's MutationCache
// onError in main.tsx) can raise a toast when a save fails.

export interface Toast {
  id: number
  message: string
  /** When present, the toast shows a Retry button that runs this. */
  retry?: () => void
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToasts(): Toast[] {
  return toasts
}

export function pushToast(toast: Omit<Toast, 'id'>): number {
  const id = nextId++
  toasts = [...toasts, { ...toast, id }]
  emit()
  return id
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}
