import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

// Shared gate for the screens' data queries. Renders a loading or error
// state (with a retry) in place of its children until every query is ready,
// so no screen silently shows an empty list while data is still loading or
// after a fetch failed. Header and controls stay mounted around it.

type GateQuery = Pick<UseQueryResult, 'isPending' | 'isError' | 'refetch'>

export function QueryStates({
  queries,
  children,
}: {
  queries: GateQuery[]
  children: ReactNode
}) {
  if (queries.some((q) => q.isError)) {
    return (
      <div
        role="alert"
        className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        <p>Could not load your data.</p>
        <button
          type="button"
          onClick={() => queries.forEach((q) => void q.refetch())}
          className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white active:scale-95"
        >
          Try again
        </button>
      </div>
    )
  }

  if (queries.some((q) => q.isPending)) {
    return <p className="mt-8 text-center text-sm text-zinc-500">Loading…</p>
  }

  return <>{children}</>
}
