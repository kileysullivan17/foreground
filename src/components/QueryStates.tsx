import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

// Shared gate for the screens' data queries. Renders a loading or error
// state (with a retry) in place of its children until every query is ready,
// so no screen silently shows an empty list while data is still loading or
// after a fetch failed. Header and controls stay mounted around it.
//
// Loading keeps the destination's shape (1i): the 'foreground' variant
// pulses the ink-panel silhouette, 'cards' pulses list cards. Errors stay
// calm; red is reserved for overdue deadlines, so the alert wears clay.

type GateQuery = Pick<UseQueryResult, 'isPending' | 'isError' | 'refetch'>

export function QueryStates({
  queries,
  children,
  variant = 'cards',
  loadingLabel = 'Loading…',
  className = '',
}: {
  queries: GateQuery[]
  children: ReactNode
  variant?: 'foreground' | 'cards'
  loadingLabel?: string
  className?: string
}) {
  if (queries.some((q) => q.isError)) {
    return (
      <div
        role="alert"
        className={`mt-1.5 rounded-card bg-surface px-5 py-6 text-center dark:bg-surface-dark ${className}`}
      >
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
          Could not load your data
        </p>
        <p className="mt-1 text-[13px] leading-[1.5] text-sand-700 dark:text-sand-400">
          Your items are safe on this device; nothing was lost.
        </p>
        <button
          type="button"
          onClick={() => queries.forEach((q) => void q.refetch())}
          className="mt-4 inline-flex min-h-[46px] items-center justify-center rounded-pill bg-clay-500 px-8 font-display text-[14.5px] text-ink hover:bg-clay-400 active:scale-95 dark:bg-clay-400 dark:hover:bg-clay-300"
        >
          Try again
        </button>
      </div>
    )
  }

  if (queries.some((q) => q.isPending)) {
    return (
      <div className={className}>
        <div className="mb-3.5 flex items-center gap-2.5 px-1.5">
          <span
            className="size-[18px] animate-spin rounded-pill border-[3px] border-sand-300 border-t-clay-500 dark:border-sand-700 dark:border-t-clay-400"
            aria-hidden
          />
          <span className="text-[13px] text-sand-700 dark:text-sand-400">{loadingLabel}</span>
        </div>
        {variant === 'foreground' && (
          <div className="animate-pulse rounded-hero bg-sand-300 p-5 dark:bg-surface-dark-raised">
            <div className="h-2.5 w-[110px] rounded-pill bg-sand-200 dark:bg-surface-dark" />
            <div className="mt-4 h-5 w-[220px] rounded-pill bg-sand-200 dark:bg-surface-dark" />
            <div className="mt-3 h-3 w-[140px] rounded-pill bg-sand-200 dark:bg-surface-dark" />
            <div className="mt-[18px] h-[92px] rounded-ctl bg-sand-200 dark:bg-surface-dark" />
          </div>
        )}
        <div className="mt-3 h-[84px] animate-pulse rounded-card bg-sand-300/70 [animation-delay:0.2s] dark:bg-surface-dark" />
        <div className="mt-2.5 h-[84px] animate-pulse rounded-card bg-sand-300/70 [animation-delay:0.4s] dark:bg-surface-dark" />
        {variant === 'cards' && (
          <div className="mt-2.5 h-[84px] animate-pulse rounded-card bg-sand-300/70 [animation-delay:0.6s] dark:bg-surface-dark" />
        )}
      </div>
    )
  }

  return <>{children}</>
}
