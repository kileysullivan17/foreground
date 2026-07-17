import type { ScoredItem } from '../scoring/score'
import { equationLine, factorParts, isOverdue, lower } from '../lib/scoreDisplay'

// The score arithmetic as a receipt-style ledger: adds first, then the
// effort divide, then the staleness multiplier, then the equation restated
// with its answer. Two grounds: 'foreground' sits on the ink panel (which
// inverts with the theme), 'card' sits on a queue card.
//
// Color roles, both themes: terracotta for time pressure (deadline,
// staleness), sage for flow (unblocks, momentum), sand for the divide,
// true red only on a genuinely overdue deadline.

type Context = 'foreground' | 'card'

const tones: Record<
  Context,
  {
    box: string
    label: string
    detail: string
    rule: string
    equation: string
    total: string
    value: Record<
      'deadline' | 'overdue' | 'importance' | 'unblocks' | 'momentum' | 'effort' | 'staleness',
      string
    >
  }
> = {
  foreground: {
    box: 'bg-ink-inverse/8 dark:bg-ink/6',
    label: 'text-ink-inverse dark:text-ink',
    detail: 'text-sand-500 dark:text-sand-700',
    rule: 'border-ink-inverse/30 dark:border-ink/28',
    equation: 'text-sand-500 dark:text-sand-700',
    total: 'text-ink-inverse dark:text-ink',
    value: {
      deadline: 'text-clay-300 dark:text-clay-700',
      overdue: 'text-overdue-dark dark:text-overdue',
      importance: 'text-ink-inverse dark:text-ink',
      unblocks: 'text-sage-300 dark:text-sage-700',
      momentum: 'text-sage-300 dark:text-sage-700',
      effort: 'text-sand-400 dark:text-sand-700',
      staleness: 'text-clay-300 dark:text-clay-700',
    },
  },
  card: {
    box: 'bg-surface-raised dark:bg-ink-inverse/6',
    label: 'text-ink dark:text-ink-inverse',
    detail: 'text-sand-700 dark:text-sand-400',
    rule: 'border-ink/25 dark:border-ink-inverse/25',
    equation: 'text-sand-700 dark:text-sand-400',
    total: 'text-ink dark:text-ink-inverse',
    value: {
      deadline: 'text-clay-700 dark:text-clay-400',
      overdue: 'text-overdue dark:text-overdue-dark',
      importance: 'text-ink dark:text-ink-inverse',
      unblocks: 'text-sage-700 dark:text-sage-400',
      momentum: 'text-sage-700 dark:text-sage-400',
      effort: 'text-sand-700 dark:text-sand-400',
      staleness: 'text-clay-700 dark:text-clay-400',
    },
  },
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
  const t = tones[context]
  const row = 'flex items-baseline gap-2.5'
  const label = `text-detail font-semibold ${t.label}`
  const detail = `text-meta ${t.detail}`
  const value = 'ml-auto shrink-0 text-[14px] font-bold tabular-nums'

  return (
    <div className={`flex flex-col gap-2 rounded-ctl px-3.5 py-3 ${t.box}`}>
      {scored.delayFactors.map((f) => {
        const parts = factorParts(f, scored.item.importance)
        const overdue = isOverdue(f)
        const tone = overdue ? t.value.overdue : t.value[f.key]
        const spread = f.key === 'unblocks'
        return (
          <div key={f.key} className={row}>
            <span className={`${label} shrink-0 ${overdue ? t.value.overdue : ''}`}>
              {parts.label}
            </span>
            <span
              className={`${detail} ${spread ? 'min-w-0 flex-1 truncate' : ''} ${
                overdue ? t.value.overdue : ''
              }`}
            >
              {parts.detail}
            </span>
            <span className={`${value} ${tone} ${spread ? 'ml-0' : ''}`}>+{f.points}</span>
          </div>
        )
      })}
      <div className={row}>
        <span className={`${label} shrink-0`}>Effort</span>
        <span className={detail}>{lower(scored.size.label)}</span>
        <span className={`${value} ${t.value.effort}`}>÷ {scored.size.divisor}</span>
      </div>
      {scored.staleness && (
        <div className={row}>
          <span className={`${label} shrink-0`}>Staleness</span>
          <span className={detail}>{lower(scored.staleness.label).replace('untouched for ', 'untouched ')}</span>
          <span className={`${value} ${t.value.staleness}`}>× {scored.staleness.multiplier}</span>
        </div>
      )}
      <div className={`${row} mt-0.5 border-t-[1.5px] border-dotted pt-2.5 ${t.rule}`}>
        <span className={`text-meta tabular-nums ${t.equation}`}>{equationLine(scored)}</span>
        <span
          className={`ml-auto font-display tabular-nums ${t.total} ${
            size === 'lg' ? 'text-score-lg' : 'text-score'
          }`}
        >
          {scored.score}
        </span>
      </div>
    </div>
  )
}
