import type { ScoredItem } from '../scoring/score'
import { equationLine, factorParts, isOverdue, lower } from '../lib/scoreDisplay'

// The score arithmetic as an instrument readout: a three-column mono grid
// (label | detail | points), then a dotted rule, then the equation restated
// beside its answer. 'foreground' sits directly on the lit panel; 'card' is
// the raised inner ledger inside an expanded queue row.
//
// Color roles: the accent for time pressure (deadline points, the staleness
// multiplier), `overdue` for a genuinely overdue deadline, plain text for
// everything else. There is no second accent: unblocks and momentum read
// white, so orange means time and white means flow.

type Context = 'foreground' | 'card'

const boxes: Record<Context, string> = {
  foreground: 'rounded-inner',
  card: 'rounded-inner bg-raised p-3',
}

const timeTone: Partial<Record<'deadline' | 'importance' | 'unblocks' | 'momentum', string>> = {
  deadline: 'text-accent',
}

export function ScoreLedger({
  scored,
  context,
  size = 'md',
}: {
  scored: ScoredItem
  context: Context
  size?: 'md' | 'lg'
}) {
  const lg = size === 'lg'
  const row = `grid grid-cols-[86px_minmax(0,1fr)_auto] items-baseline gap-x-3 font-mono tabular-nums ${
    lg ? 'text-ledger' : 'text-[12px] leading-[1.3]'
  }`
  const label = 'text-text'
  const detail = 'truncate text-text-2'
  const value = 'text-right'

  return (
    <div className={`flex flex-col gap-[7px] ${boxes[context]}`}>
      {scored.delayFactors.map((f) => {
        const parts = factorParts(f, scored.item.importance)
        const overdue = isOverdue(f)
        const tone = overdue ? 'text-overdue' : (timeTone[f.key] ?? 'text-text')
        return (
          <div key={f.key} className={row}>
            <span className={overdue ? 'text-overdue' : label}>{parts.label}</span>
            <span className={overdue ? 'truncate text-overdue' : detail}>{parts.detail}</span>
            <span className={`${value} ${tone}`}>+{f.points}</span>
          </div>
        )
      })}
      <div className={row}>
        <span className={label}>Effort</span>
        <span className={detail}>{lower(scored.size.label)}</span>
        <span className={`${value} text-text`}>÷ {scored.size.divisor}</span>
      </div>
      {scored.staleness && (
        <div className={row}>
          <span className={label}>Staleness</span>
          <span className={detail}>
            {lower(scored.staleness.label).replace('untouched for ', 'untouched ')}
          </span>
          <span className={`${value} text-accent`}>× {scored.staleness.multiplier}</span>
        </div>
      )}
      <div className="mt-1.5 flex items-baseline gap-3 border-t border-dotted border-line-strong pt-3">
        <span className="font-mono text-equation tabular-nums text-text-3">{equationLine(scored)}</span>
        <span
          className={`ml-auto font-display tabular-nums ${
            lg
              ? 'text-score text-accent [text-shadow:0_0_26px_var(--color-accent-glow)] lg:text-[56px]'
              : 'text-score-row text-text'
          }`}
        >
          {scored.score}
        </span>
      </div>
    </div>
  )
}
