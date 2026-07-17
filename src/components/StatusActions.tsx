import type { Item, Status } from '../types'
import { useSetStatus } from '../hooks/useData'

// One-tap status changes as Organic pills. Which buttons show depends on
// where the item is. 'foreground' sits on the ink panel (dark ground in the
// light theme, cream in the dark theme); 'card' sits on a queue card.

type Context = 'foreground' | 'card'

const pill =
  'inline-flex min-h-tap items-center justify-center rounded-pill font-display active:scale-95 transition-transform disabled:opacity-50'

const tones: Record<Context, { start: string; done: string; park: string; text: string }> = {
  foreground: {
    start: 'bg-clay-400 text-ink hover:bg-clay-300 dark:bg-clay-500 dark:hover:bg-clay-400',
    done: 'bg-sage-300 text-ink hover:bg-sage-200 dark:bg-sage-200 dark:text-sage-800 dark:hover:bg-sage-300 dark:hover:text-ink',
    park: 'border-[1.5px] border-sand-700 text-ink-inverse hover:bg-ink-inverse/8 dark:border-ink/25 dark:text-ink dark:hover:bg-ink/6',
    text: 'text-[15px]',
  },
  card: {
    start: 'bg-clay-500 text-ink hover:bg-clay-400 dark:bg-clay-400 dark:hover:bg-clay-300',
    done: 'bg-sage-200 text-sage-800 hover:bg-sage-300 hover:text-ink dark:bg-sage-300 dark:text-ink dark:hover:bg-sage-200 dark:hover:text-sage-800',
    park: 'border-[1.5px] border-ink/25 text-ink hover:bg-ink/6 dark:border-ink-inverse/30 dark:text-ink-inverse dark:hover:bg-ink-inverse/8',
    text: 'text-[14.5px]',
  },
}

export function StatusActions({
  item,
  context = 'card',
  className = '',
}: {
  item: Item
  context?: Context
  className?: string
}) {
  const setStatus = useSetStatus()
  const move = (status: Status) => setStatus.mutate({ id: item.id, status })
  const t = tones[context]

  if (item.status === 'done' || item.status === 'parked') {
    return (
      <button
        type="button"
        className={`${pill} ${t.park} ${t.text} px-5`}
        onClick={() => move('open')}
      >
        Reopen
      </button>
    )
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {item.status === 'open' && (
        <button
          type="button"
          className={`${pill} ${t.start} ${t.text} flex-[1.2]`}
          onClick={() => move('in_progress')}
        >
          Start
        </button>
      )}
      <button type="button" className={`${pill} ${t.done} ${t.text} flex-1`} onClick={() => move('done')}>
        Done
      </button>
      <button type="button" className={`${pill} ${t.park} ${t.text} flex-[0.9]`} onClick={() => move('parked')}>
        Park
      </button>
    </div>
  )
}
