import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

// Shared gate for the screens' data queries. Renders a loading or error
// state (with a retry) in place of its children until every query is ready,
// so no screen silently shows an empty list while data is still loading or
// after a fetch failed. Header and controls stay mounted around it.
//
// Loading keeps the destination's shape: the 'foreground' variant lays out
// the lit panel's silhouette in raised bars, 'cards' lays out dotted-rule
// rows. No spinners; one blinking accent dot marks the wait. Errors stay
// calm: the panel takes the overdue border, and retry is an outlined pill.

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
        className={`mt-1.5 rounded-panel border border-overdue/40 bg-panel px-5 py-6 text-center ${className}`}
      >
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
          Could not load your data
        </p>
        <p className="mt-1 text-[13px] leading-[1.5] text-text-2">
          Your items are safe on this device; nothing was lost.
        </p>
        <button
          type="button"
          onClick={() => queries.forEach((q) => void q.refetch())}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-pill border border-line-strong px-8 text-[14px] font-semibold text-text hover:border-text active:translate-y-px"
        >
          Try again
        </button>
      </div>
    )
  }

  if (queries.some((q) => q.isPending)) {
    const bar = 'rounded-pill bg-raised'
    return (
      <div className={className}>
        <div className="mb-3.5 flex items-center gap-2.5 px-1.5">
          <span className="fg-blink size-[7px] rounded-pill bg-accent" aria-hidden />
          <span className="text-[13px] text-text-2">{loadingLabel}</span>
        </div>
        {variant === 'foreground' && (
          <div className="rounded-panel border border-line bg-panel p-[18px]">
            <div className={`h-2.5 w-[110px] ${bar}`} />
            <div className={`mt-4 h-5 w-[220px] ${bar}`} />
            <div className={`mt-3 h-3 w-[140px] ${bar}`} />
            <div className="mt-[18px] flex flex-col gap-2 border-t border-dotted border-line-strong pt-3.5">
              <div className={`h-3 w-full ${bar}`} />
              <div className={`h-3 w-4/5 ${bar}`} />
              <div className={`h-3 w-3/5 ${bar}`} />
            </div>
          </div>
        )}
        <div className="mx-1.5 mt-[18px] border-b border-dotted border-line-strong">
          {[0, 1, variant === 'cards' ? 2 : -1]
            .filter((i) => i >= 0)
            .map((i) => (
              <div key={i} className="grid grid-cols-[26px_minmax(0,1fr)_auto] gap-x-2 border-t border-dotted border-line-strong py-[14px]">
                <div className={`h-3 w-4 ${bar}`} />
                <div>
                  <div className={`h-3.5 w-3/4 ${bar}`} />
                  <div className={`mt-2 h-2.5 w-1/2 ${bar}`} />
                </div>
                <div className={`h-4 w-8 ${bar}`} />
              </div>
            ))}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
