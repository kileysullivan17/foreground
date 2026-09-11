import type { Item, Status } from '../types'
import { useSetStatus } from '../hooks/useData'

// One-tap status changes as Ember pills. Terracotta means action, so Start
// is the one filled button; Done is outlined in plain text (white = flow)
// and Park is a ghost. 'foreground' is the 44px row inside the lit readout;
// 'card' is the 40px row inside an expanded queue row, where Start drops
// to the soft tint so only one thing on screen is lit.

type Context = 'foreground' | 'card'

const pill =
  'inline-flex items-center justify-center rounded-pill font-semibold transition-transform active:translate-y-px disabled:opacity-45'

const tones: Record<Context, { start: string; done: string; park: string; size: string }> = {
  foreground: {
    start: 'bg-accent text-accent-ink hover:bg-accent-hover',
    done: 'border border-text text-text hover:bg-line',
    park: 'text-text-3 hover:text-text',
    size: 'min-h-tap text-[14px]',
  },
  card: {
    start: 'bg-accent-soft text-accent hover:bg-accent-line',
    done: 'border border-text text-text hover:bg-line',
    park: 'text-text-3 hover:text-text',
    size: 'min-h-10 text-[13px]',
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
        className={`${pill} border border-line-strong text-text hover:border-text ${t.size} px-5`}
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
          className={`${pill} ${t.start} ${t.size} flex-[1.2]`}
          onClick={() => move('in_progress')}
        >
          Start
        </button>
      )}
      <button type="button" className={`${pill} ${t.done} ${t.size} flex-1`} onClick={() => move('done')}>
        Done
      </button>
      <button type="button" className={`${pill} ${t.park} ${t.size} flex-[0.9]`} onClick={() => move('parked')}>
        Park
      </button>
    </div>
  )
}
