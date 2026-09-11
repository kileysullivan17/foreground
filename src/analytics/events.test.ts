// The taxonomy: exactly six event names, the property shapes the docs
// promise, and the privacy rule that no item content ever leaves the browser.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../types'
import { rankItems } from '../scoring/score'

const track = vi.fn()
vi.mock('./posthog', () => ({ track: (...args: unknown[]) => track(...args) }))

import {
  comparePromotion,
  promotionReport,
  resetEventState,
  trackItemCompleted,
  trackItemCreated,
  trackRankingReordered,
  trackScoreBreakdownExpanded,
  trackSessionStarted,
  trackWeightsAdjusted,
  wsjfBucket,
} from './events'

const NOW = new Date('2026-09-04T12:00:00')
const DAY = 86_400_000
const iso = (daysFromNow: number) => new Date(NOW.getTime() + daysFromNow * DAY).toISOString()
const date = (daysFromNow: number) => iso(daysFromNow).slice(0, 10)

// Deliberately distinctive content so a leak is unmistakable in a payload.
const SECRET = 'SECRET-TITLE-do-the-taxes-before-they-audit-me'
const SECRET_NOTE = 'SECRET-NOTE-owes-money-to-cousin'

let n = 0
function makeItem(overrides: Partial<Item> = {}): Item {
  n += 1
  return {
    id: `itm-${n}`,
    title: `${SECRET}-${n}`,
    notes: SECRET_NOTE,
    area: 'home',
    projectId: null,
    section: null,
    assignee: null,
    effort: 'M',
    hardDeadline: null,
    importance: 3,
    dependsOn: [],
    status: 'open',
    createdAt: iso(-10),
    lastTouchedAt: iso(0),
    lastTouchNote: null,
    ...overrides,
  }
}

// fresh: importance 5, small, touched today: 25.
// stale: importance 4, small, untouched 30 days: 19 x 1.5 = 28.5.
// With staleness the stale item leads; without it the fresh one does.
function fixture() {
  const fresh = makeItem({ importance: 5, effort: 'S', createdAt: iso(-2) })
  const stale = makeItem({ importance: 4, effort: 'S', lastTouchedAt: iso(-30), createdAt: iso(-45) })
  const quiet = makeItem({ importance: 1, effort: 'L', createdAt: iso(-100), lastTouchedAt: iso(-100) })
  return { fresh, stale, quiet, items: [fresh, stale, quiet] }
}

beforeEach(() => {
  track.mockClear()
  resetEventState()
})

describe('wsjfBucket', () => {
  it('splits at 10 and 20', () => {
    expect(wsjfBucket(0)).toBe('low')
    expect(wsjfBucket(9.9)).toBe('low')
    expect(wsjfBucket(10)).toBe('mid')
    expect(wsjfBucket(19.9)).toBe('mid')
    expect(wsjfBucket(20)).toBe('high')
    expect(wsjfBucket(37)).toBe('high')
  })
})

describe('promotion by staleness', () => {
  it('finds the item that only leads because it was put off', () => {
    const { fresh, stale, items } = fixture()
    const withS = rankItems(items, { now: NOW }).ready
    const without = rankItems(items, { now: NOW, staleness: false }).ready
    expect(withS[0]!.item.id).toBe(stale.id)
    expect(without[0]!.item.id).toBe(fresh.id)
    expect(comparePromotion(withS, without)).toEqual({
      promotedIds: [stale.id],
      itemsPromotedCount: 1,
      maxMultiplier: 1.5,
    })
    expect(promotionReport(items, NOW).promotedIds).toEqual([stale.id])
  })

  it('reports nothing when the order is unchanged', () => {
    const a = makeItem({ importance: 5 })
    const b = makeItem({ importance: 2 })
    expect(promotionReport([a, b], NOW)).toEqual({
      promotedIds: [],
      itemsPromotedCount: 0,
      maxMultiplier: 1,
    })
  })
})

describe('the six events', () => {
  it('item_created carries a due-date flag and a bucket', () => {
    const { items } = fixture()
    const dated = makeItem({ hardDeadline: date(3), importance: 4, effort: 'S' })
    trackItemCreated(dated, [...items, dated], NOW)
    const plain = makeItem()
    trackItemCreated(plain, [...items, plain], NOW)
    expect(track).toHaveBeenNthCalledWith(1, 'item_created', {
      has_due_date: true,
      initial_wsjf_bucket: 'high',
    })
    expect(track).toHaveBeenNthCalledWith(2, 'item_created', {
      has_due_date: false,
      initial_wsjf_bucket: 'low',
    })
  })

  it('score_breakdown_expanded says whether the ledger had a staleness line', () => {
    const { items } = fixture()
    const [stale, fresh] = rankItems(items, { now: NOW }).ready
    trackScoreBreakdownExpanded(stale!)
    trackScoreBreakdownExpanded(fresh!)
    expect(track).toHaveBeenNthCalledWith(1, 'score_breakdown_expanded', {
      item_wsjf_bucket: 'high',
      staleness_multiplier_applied: true,
    })
    expect(track).toHaveBeenNthCalledWith(2, 'score_breakdown_expanded', {
      item_wsjf_bucket: 'high',
      staleness_multiplier_applied: false,
    })
  })

  it('ranking_reordered_by_staleness fires once per distinct promoted set and never for zero', () => {
    const report = { promotedIds: ['itm-9'], itemsPromotedCount: 1, maxMultiplier: 1.3 }
    trackRankingReordered(report)
    trackRankingReordered(report)
    trackRankingReordered({ promotedIds: [], itemsPromotedCount: 0, maxMultiplier: 1 })
    trackRankingReordered({ promotedIds: ['itm-9', 'itm-4'], itemsPromotedCount: 2, maxMultiplier: 1.5 })
    expect(track.mock.calls).toEqual([
      ['ranking_reordered_by_staleness', { items_promoted_count: 1, max_multiplier: 1.3 }],
      ['ranking_reordered_by_staleness', { items_promoted_count: 2, max_multiplier: 1.5 }],
    ])
  })

  it('item_completed reads the promotion and multiplier from the list as it stood', () => {
    const { fresh, stale, items } = fixture()
    trackItemCompleted(stale.id, items, NOW)
    trackItemCompleted(fresh.id, items, NOW)
    expect(track).toHaveBeenNthCalledWith(1, 'item_completed', {
      days_open: 45,
      staleness_multiplier_at_completion: 1.5,
      was_promoted_by_staleness: true,
    })
    expect(track).toHaveBeenNthCalledWith(2, 'item_completed', {
      days_open: 2,
      staleness_multiplier_at_completion: 1,
      was_promoted_by_staleness: false,
    })
  })

  it('item_completed ignores unknown ids and items already done', () => {
    const { items } = fixture()
    const done = makeItem({ status: 'done' })
    trackItemCompleted('nope', items, NOW)
    trackItemCompleted(done.id, [...items, done], NOW)
    expect(track).not.toHaveBeenCalled()
  })

  it('weights_adjusted names the knob and the direction', () => {
    trackWeightsAdjusted('job_size_divisor', 'up')
    trackWeightsAdjusted('job_size_divisor', 'down')
    expect(track.mock.calls).toEqual([
      ['weights_adjusted', { weight_changed: 'job_size_divisor', direction: 'up' }],
      ['weights_adjusted', { weight_changed: 'job_size_divisor', direction: 'down' }],
    ])
  })

  it('session_started counts open work once per page load', () => {
    const { items } = fixture()
    const done = makeItem({ status: 'done', createdAt: iso(-400) })
    const parked = makeItem({ status: 'parked', createdAt: iso(-300) })
    trackSessionStarted([...items, done, parked], NOW)
    trackSessionStarted([...items, done, parked], NOW)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('session_started', {
      items_in_backlog: 3,
      oldest_item_days: 100,
    })
  })
})

describe('privacy', () => {
  it('no payload ever contains item content, and every value is a bucket, count, or flag', () => {
    const { fresh, stale, items } = fixture()
    const ranked = rankItems(items, { now: NOW }).ready
    trackItemCreated(fresh, items, NOW)
    for (const s of ranked) trackScoreBreakdownExpanded(s)
    trackRankingReordered(promotionReport(items, NOW))
    trackItemCompleted(stale.id, items, NOW)
    trackWeightsAdjusted('job_size_divisor', 'up')
    trackSessionStarted(items, NOW)

    const names = new Set(track.mock.calls.map((c) => c[0]))
    expect([...names].sort()).toEqual([
      'item_completed',
      'item_created',
      'ranking_reordered_by_staleness',
      'score_breakdown_expanded',
      'session_started',
      'weights_adjusted',
    ])

    const allowedStrings = new Set(['low', 'mid', 'high', 'up', 'down', 'job_size_divisor'])
    for (const [, props] of track.mock.calls) {
      const raw = JSON.stringify(props)
      expect(raw).not.toContain('SECRET')
      expect(raw).not.toContain('itm-')
      for (const value of Object.values(props as Record<string, unknown>)) {
        if (typeof value === 'string') expect(allowedStrings.has(value)).toBe(true)
        else expect(['number', 'boolean']).toContain(typeof value)
      }
    }
  })
})
