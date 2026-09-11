import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Bottom-sheet dialog behavior in one place (F8): rendered in a portal so
// the app root can go inert behind it, aria-modal with a label, focus moves
// in on open and returns on close, Escape and the scrim both dismiss. With
// the root inert, Tab cannot reach the background, which is the trap.

export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')

    const firstFocusable = sheet.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    ;(firstFocusable ?? sheet).focus()

    return () => {
      root?.removeAttribute('inert')
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-20 font-sans text-[15px] text-text" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        aria-label={`Dismiss ${label.toLowerCase()}`}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-film/70"
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-screen border-t border-line bg-panel px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-frame outline-none"
      >
        <div className="grid min-h-[26px] place-items-center pt-2.5">
          <span className="h-[4px] w-11 rounded-pill bg-line-strong" aria-hidden />
        </div>
        <div className="mx-auto max-w-lg">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
