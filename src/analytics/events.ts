// The taxonomy: six explicit events, each a hypothesis about Foreground's own
// design claims. Property values are buckets, counts, and booleans only.
// Nothing here may ever carry an item title, a note, a project name, or any
// other free text; the tests in events.test.ts pin that.
//
// The claims and the decision rule are written out in docs/analytics.md.

import { rankItems, scoreItem, type ScoredItem } from '../scoring/score'
import type { Item } from '../types'
import { track } from './posthog'

const DAY = 86_400_000

export type WsjfBucket = 'low' | 'mid' | 'high'

// Grounded in the model, not the data: a default new item (medium effort,
// importance 3, no deadline) scores 6.25; importance 5 with no deadline and
// medium effort is 12.5; anything with a deadline inside two weeks, or that
// something else waits on, clears 20. The seed's fourteen ready items split
// 3 / 5 / 6 across these bands.
export const WSJF_BUCKET_LOW_BELOW = 10
export const WSJF_BUCKET_HIGH_FROM = 20

export function wsjfBucket(score: number): WsjfBucket {
  if (score < WSJF_BUCKET_LOW_BELOW) return 'low'
  if (score < WSJF_BUCKET_HIGH_FROM) return 'mid'
  return 'high'
}

export function daysBetween(fromIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY))
}

export interface PromotionReport {
  /** Ids of items ranked higher than they would be with no staleness. */
  promotedIds: string[]
  itemsPromotedCount: number
  /** Largest multiplier among the promoted items; 1 when none. */
  maxMultiplier: number
}

/**
 * Compare a ranking against the same list ranked with staleness switched
 * off. An item is promoted when its position improved. Both lists must be
 * the same items in their respective orders (already filtered the same way).
 */
export function comparePromotion(
  withStaleness: ScoredItem[],
  withoutStaleness: ScoredItem[],
): PromotionReport {
  const baseline = new Map(withoutStaleness.map((s, i) => [s.item.id, i]))
  const promoted = withStaleness.filter((s, i) => {
    const before = baseline.get(s.item.id)
    return before !== undefined && i < before
  })
  const maxMultiplier = promoted.reduce(
    (max, s) => Math.max(max, s.staleness?.multiplier ?? 1),
    1,
  )
  return {
    promotedIds: promoted.map((s) => s.item.id),
    itemsPromotedCount: promoted.length,
    maxMultiplier,
  }
}

/** Promotion over the full ready list with default divisors. */
export function promotionReport(items: Item[], now: Date = new Date()): PromotionReport {
  return comparePromotion(
    rankItems(items, { now }).ready,
    rankItems(items, { now, staleness: false }).ready,
  )
}

// 1. item_created: baseline volume.
export function trackItemCreated(item: Item, allItems: Item[], now: Date = new Date()): void {
  const scored = scoreItem(item, allItems, { now })
  track('item_created', {
    has_due_date: item.hardDeadline !== null,
    initial_wsjf_bucket: wsjfBucket(scored.score),
  })
}

// 2. score_breakdown_expanded: the auditability claim. Fires when a queue
// card is opened to show its ledger, never when it is closed.
export function trackScoreBreakdownExpanded(scored: ScoredItem): void {
  track('score_breakdown_expanded', {
    item_wsjf_bucket: wsjfBucket(scored.score),
    staleness_multiplier_applied: scored.staleness !== null,
  })
}

// 3. ranking_reordered_by_staleness: the core thesis. Fires once per distinct
// promoted set per page load, and only when at least one item moved up.
let lastReorderSignature: string | null = null

export function trackRankingReordered(report: PromotionReport): void {
  if (report.itemsPromotedCount === 0) return
  const signature = `${[...report.promotedIds].sort().join(',')}|${report.maxMultiplier}`
  if (signature === lastReorderSignature) return
  lastReorderSignature = signature
  track('ranking_reordered_by_staleness', {
    items_promoted_count: report.itemsPromotedCount,
    max_multiplier: report.maxMultiplier,
  })
}

// 4. item_completed: the payoff. `itemsBefore` is the list as it stood when
// the user pressed Done, so the multiplier and the promotion are the ones
// the ranking actually showed rather than the post-touch values.
export function trackItemCompleted(id: string, itemsBefore: Item[], now: Date = new Date()): void {
  const item = itemsBefore.find((i) => i.id === id)
  if (!item || item.status === 'done') return
  const scored = scoreItem(item, itemsBefore, { now })
  const report = promotionReport(itemsBefore, now)
  track('item_completed', {
    days_open: daysBetween(item.createdAt, now),
    staleness_multiplier_at_completion: scored.staleness?.multiplier ?? 1,
    was_promoted_by_staleness: report.promotedIds.includes(id),
  })
}

// 5. weights_adjusted: is the default model trusted or overridden? Foreground
// exposes exactly one user-facing knob on the model, the Quick wins toggle,
// which steepens the job-size divisors from 1/2/3 to 1/3/6.
export type AdjustableWeight = 'job_size_divisor'

export function trackWeightsAdjusted(weight: AdjustableWeight, direction: 'up' | 'down'): void {
  track('weights_adjusted', { weight_changed: weight, direction })
}

// 6. session_started: backlog health. Once per page load, after the item
// list has loaded, so the counts describe the backlog the session opened on.
let sessionStartedSent = false

export function trackSessionStarted(items: Item[], now: Date = new Date()): void {
  if (sessionStartedSent) return
  sessionStartedSent = true
  const open = items.filter((i) => i.status === 'open' || i.status === 'in_progress')
  const oldest = open.reduce((max, i) => Math.max(max, daysBetween(i.createdAt, now)), 0)
  track('session_started', {
    items_in_backlog: open.length,
    oldest_item_days: oldest,
  })
}

/** Test hook: forget per-page-load dedupe state. */
export function resetEventState(): void {
  lastReorderSignature = null
  sessionStartedSent = false
}
