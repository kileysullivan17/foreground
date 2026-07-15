import type { Item } from '../types'

// WSJF-adapted priority score. See FRAMEWORK.md for the model and the
// rationale behind every weight; keep the two in sync.
//
//   priority = cost of delay ÷ job size × staleness multiplier
//
// Cost of delay is additive and fully attributed (max points):
//   deadline   35  — hard deadlines dominate when close or overdue
//   importance 25  — 1..5 mapped linearly
//   unblocks   20  — items other open work is waiting on
//   momentum    6  — restarting later costs context; finishing is cheap now
//
// Job size divides: S 1, M 2, L 3 (quick-wins mode steepens to 1 / 3 / 6).
// Staleness multiplies: quiet for 3 days, then 1 + days/60, capped at 1.5.
// Every component the UI shows carries a plain-language label.

const DAY = 86_400_000

export type DelayFactorKey = 'deadline' | 'importance' | 'unblocks' | 'momentum'

export interface ScoreFactor {
  key: DelayFactorKey
  points: number
  label: string
}

export interface ScoredItem {
  item: Item
  score: number
  costOfDelay: number
  /** Additive cost-of-delay components, each with points and a label. */
  delayFactors: ScoreFactor[]
  /** The job-size divisor applied to cost of delay. */
  size: { divisor: number; label: string }
  /** Staleness multiplier; null while the item was touched recently. */
  staleness: { multiplier: number; label: string } | null
  /** Unfinished items this one depends on. Non-empty = not actionable yet. */
  blockedBy: Item[]
}

export interface ScoreOptions {
  now?: Date
  quickWins?: boolean
}

export function daysSinceTouched(item: Item, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(item.lastTouchedAt).getTime()) / DAY))
}

/** Whole days until the deadline: negative = overdue, 0 = due today. */
export function daysUntilDeadline(deadline: string, now: Date): number {
  const due = new Date(`${deadline}T23:59:59`)
  return Math.floor((due.getTime() - now.getTime()) / DAY)
}

function deadlineFactor(item: Item, now: Date): ScoreFactor | null {
  if (!item.hardDeadline) return null
  const days = daysUntilDeadline(item.hardDeadline, now)
  if (days < 0) {
    return { key: 'deadline', points: 35, label: `Overdue by ${-days} day${days === -1 ? '' : 's'}` }
  }
  if (days === 0) return { key: 'deadline', points: 32, label: 'Due today' }
  if (days === 1) return { key: 'deadline', points: 29, label: 'Due tomorrow' }
  if (days <= 30) {
    return { key: 'deadline', points: Math.round(30 - (days / 30) * 28), label: `Due in ${days} days` }
  }
  return { key: 'deadline', points: 2, label: `Due in ${days} days` }
}

function importanceFactor(item: Item): ScoreFactor | null {
  const points = Math.round((item.importance - 1) * 6.25)
  if (points === 0) return null
  return { key: 'importance', points, label: `Importance ${item.importance}/5` }
}

function unblocksFactor(openDependents: Item[]): ScoreFactor | null {
  if (openDependents.length === 0) return null
  const names = openDependents.map((d) => `“${d.title}”`).slice(0, 2).join(' and ')
  const more = openDependents.length > 2 ? ` and ${openDependents.length - 2} more` : ''
  return {
    key: 'unblocks',
    points: Math.min(20, openDependents.length * 8),
    label: `Holding up ${names}${more}`,
  }
}

function momentumFactor(item: Item): ScoreFactor | null {
  if (item.status !== 'in_progress') return null
  return { key: 'momentum', points: 6, label: 'Already started, finish it' }
}

const SIZE_DIVISOR = { S: 1, M: 2, L: 3 } as const
const QUICK_WINS_DIVISOR = { S: 1, M: 3, L: 6 } as const

function sizeComponent(item: Item, quickWins: boolean): { divisor: number; label: string } {
  const divisor = (quickWins ? QUICK_WINS_DIVISOR : SIZE_DIVISOR)[item.effort]
  const base = { S: 'Small job', M: 'Medium job', L: 'Big job' }[item.effort]
  const label = !quickWins
    ? base
    : item.effort === 'S'
      ? `${base}, good for right now`
      : `${base}, wrong time for it`
  return { divisor, label }
}

const STALENESS_GRACE_DAYS = 3
const STALENESS_CAP = 1.5

function stalenessComponent(
  item: Item,
  now: Date,
): { multiplier: number; label: string } | null {
  const days = daysSinceTouched(item, now)
  if (days <= STALENESS_GRACE_DAYS) return null // recently touched: no boost, no label noise
  const multiplier = Math.round(Math.min(STALENESS_CAP, 1 + days / 60) * 100) / 100
  return { multiplier, label: `Untouched for ${days} days` }
}

export function scoreItem(item: Item, allItems: Item[], opts: ScoreOptions = {}): ScoredItem {
  const now = opts.now ?? new Date()
  const byId = new Map(allItems.map((i) => [i.id, i]))

  const blockedBy = item.dependsOn
    .map((id) => byId.get(id))
    .filter((dep): dep is Item => dep !== undefined && dep.status !== 'done')

  const openDependents = allItems.filter(
    (other) =>
      other.id !== item.id &&
      (other.status === 'open' || other.status === 'in_progress') &&
      other.dependsOn.includes(item.id),
  )

  const delayFactors = [
    deadlineFactor(item, now),
    importanceFactor(item),
    unblocksFactor(openDependents),
    momentumFactor(item),
  ].filter((f): f is ScoreFactor => f !== null)

  const costOfDelay = delayFactors.reduce((sum, f) => sum + f.points, 0)
  const size = sizeComponent(item, opts.quickWins ?? false)
  const staleness = stalenessComponent(item, now)

  const score =
    Math.round((costOfDelay / size.divisor) * (staleness?.multiplier ?? 1) * 10) / 10

  return { item, score, costOfDelay, delayFactors, size, staleness, blockedBy }
}

/**
 * Rank everything workable. Returns actionable items sorted by score
 * (ties: stalest first, then oldest), with blocked items in a separate list
 * so the top of "What now" is always something you can actually start.
 */
export function rankItems(
  items: Item[],
  opts: ScoreOptions = {},
): { ready: ScoredItem[]; blocked: ScoredItem[] } {
  const workable = items.filter((i) => i.status === 'open' || i.status === 'in_progress')
  const now = opts.now ?? new Date()
  const scored = workable.map((i) => scoreItem(i, items, { ...opts, now }))

  const byScore = (a: ScoredItem, b: ScoredItem) =>
    b.score - a.score ||
    daysSinceTouched(b.item, now) - daysSinceTouched(a.item, now) ||
    a.item.createdAt.localeCompare(b.item.createdAt)

  return {
    ready: scored.filter((s) => s.blockedBy.length === 0).sort(byScore),
    blocked: scored.filter((s) => s.blockedBy.length > 0).sort(byScore),
  }
}

/** "Stuff I've put off": open work, stalest first, pure staleness order. */
export function rankByStaleness(items: Item[], now: Date = new Date()): Item[] {
  return items
    .filter((i) => i.status === 'open' || i.status === 'in_progress')
    .sort(
      (a, b) =>
        daysSinceTouched(b, now) - daysSinceTouched(a, now) ||
        a.createdAt.localeCompare(b.createdAt),
    )
}
