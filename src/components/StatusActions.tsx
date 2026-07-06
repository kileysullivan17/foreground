import type { Item, Status } from '../types'
import { useSetStatus } from '../hooks/useData'

const btn =
  'rounded-lg px-3 py-1.5 text-sm font-medium active:scale-95 transition-transform disabled:opacity-50'

// One-tap status changes. Which buttons show depends on where the item is.
export function StatusActions({ item }: { item: Item }) {
  const setStatus = useSetStatus()
  const move = (status: Status) => setStatus.mutate({ id: item.id, status })

  if (item.status === 'done' || item.status === 'parked') {
    return (
      <button type="button" className={`${btn} bg-zinc-200 dark:bg-zinc-700`} onClick={() => move('open')}>
        Reopen
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      {item.status === 'open' && (
        <button
          type="button"
          className={`${btn} bg-indigo-600 text-white`}
          onClick={() => move('in_progress')}
        >
          Start
        </button>
      )}
      <button
        type="button"
        className={`${btn} bg-emerald-600 text-white`}
        onClick={() => move('done')}
      >
        Done
      </button>
      <button
        type="button"
        className={`${btn} bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200`}
        onClick={() => move('parked')}
      >
        Park
      </button>
    </div>
  )
}
