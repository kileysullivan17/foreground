import { describe, expect, it } from 'vitest'
import type { Item } from '../types'
import { daysUntilDeadline, rankByStaleness, rankItems, scoreItem } from './score'

const NOW = new Date('2026-07-05T12:00:00')
const DAY = 86_400_000

function iso(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * DAY).toISOString()
}

function date(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * DAY).toISOString().slice(0, 10)
}

let n = 0
function makeItem(overrides: Partial<Item> = {}): Item {
  n += 1
  return {
    id: `itm-${n}`,
    title: `Item ${n}`,
    notes: '',
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

describe('deadline factor', () => {
  it('scores closer deadlines higher', () => {
    const soon = scoreItem(makeItem({ hardDeadline: date(2) }), [], { now: NOW })
    const far = scoreItem(makeItem({ hardDeadline: date(25) }), [], { now: NOW })
    const none = scoreItem(makeItem(), [], { now: NOW })
    expect(soon.score).toBeGreaterThan(far.score)
    expect(far.score).toBeGreaterThan(none.score)
  })

  it('marks overdue items with the max deadline points and says so', () => {
    const overdue = scoreItem(makeItem({ hardDeadline: date(-3) }), [], { now: NOW })
    const deadline = overdue.factors.find((f) => f.key === 'deadline')
    expect(deadline?.points).toBe(35)
    expect(deadline?.label).toBe('Overdue by 3 days')
  })

  it('computes whole days until deadline, end-of-day inclusive', () => {
    expect(daysUntilDeadline(date(0), NOW)).toBe(0)
    expect(daysUntilDeadline(date(1), NOW)).toBe(1)
    expect(daysUntilDeadline(date(-1), NOW)).toBe(-1)
  })
})

describe('staleness factor', () => {
  it('makes an untouched item outrank an identical fresh one', () => {
    const fresh = makeItem({ lastTouchedAt: iso(-1) })
    const stale = makeItem({ lastTouchedAt: iso(-28) })
    const { ready } = rankItems([fresh, stale], { now: NOW })
    expect(ready[0]?.item.id).toBe(stale.id)
    expect(ready[0]?.factors.find((f) => f.key === 'staleness')?.label).toBe(
      'Untouched for 28 days',
    )
  })

  it('caps staleness so it cannot outweigh a near deadline', () => {
    const ancient = scoreItem(makeItem({ lastTouchedAt: iso(-200) }), [], { now: NOW })
    expect(ancient.factors.find((f) => f.key === 'staleness')?.points).toBe(15)
  })

  it('stays quiet for recently touched items', () => {
    const fresh = scoreItem(makeItem({ lastTouchedAt: iso(-1) }), [], { now: NOW })
    expect(fresh.factors.find((f) => f.key === 'staleness')).toBeUndefined()
  })
})

describe('dependency handling', () => {
  it('boosts items that other open work is waiting on', () => {
    const blocker = makeItem({ title: 'Freeze the field list' })
    const dependent = makeItem({ dependsOn: [blocker.id] })
    const all = [blocker, dependent]
    const scored = scoreItem(blocker, all, { now: NOW })
    const unblocks = scored.factors.find((f) => f.key === 'unblocks')
    expect(unblocks?.points).toBe(8)
    expect(unblocks?.label).toContain('Holding up')
  })

  it('ignores dependents that are already done', () => {
    const blocker = makeItem()
    const doneDependent = makeItem({ dependsOn: [blocker.id], status: 'done' })
    const scored = scoreItem(blocker, [blocker, doneDependent], { now: NOW })
    expect(scored.factors.find((f) => f.key === 'unblocks')).toBeUndefined()
  })

  it('separates blocked items out of the ready ranking', () => {
    const blocker = makeItem()
    const blocked = makeItem({ dependsOn: [blocker.id], importance: 5 })
    const { ready, blocked: blockedList } = rankItems([blocker, blocked], { now: NOW })
    expect(ready.map((s) => s.item.id)).toEqual([blocker.id])
    expect(blockedList[0]?.item.id).toBe(blocked.id)
    expect(blockedList[0]?.blockedBy[0]?.id).toBe(blocker.id)
  })

  it('treats items whose dependencies are done as ready', () => {
    const doneDep = makeItem({ status: 'done' })
    const item = makeItem({ dependsOn: [doneDep.id] })
    const { ready } = rankItems([doneDep, item], { now: NOW })
    expect(ready.map((s) => s.item.id)).toEqual([item.id])
  })
})

describe('quick wins toggle', () => {
  it('lifts small jobs over large ones when on', () => {
    const small = makeItem({ effort: 'S' })
    const large = makeItem({ effort: 'L', importance: 4 })
    const off = rankItems([small, large], { now: NOW })
    const on = rankItems([small, large], { now: NOW, quickWins: true })
    expect(off.ready[0]?.item.id).toBe(large.id)
    expect(on.ready[0]?.item.id).toBe(small.id)
  })

  it('adds no effort factor when off', () => {
    const small = scoreItem(makeItem({ effort: 'S' }), [], { now: NOW })
    expect(small.factors.find((f) => f.key === 'effort')).toBeUndefined()
  })
})

describe('ranking basics', () => {
  it('excludes done and parked items', () => {
    const open = makeItem()
    const done = makeItem({ status: 'done' })
    const parked = makeItem({ status: 'parked' })
    const { ready, blocked } = rankItems([open, done, parked], { now: NOW })
    expect([...ready, ...blocked].map((s) => s.item.id)).toEqual([open.id])
  })

  it('gives in-progress items a momentum nudge', () => {
    const started = scoreItem(makeItem({ status: 'in_progress' }), [], { now: NOW })
    expect(started.factors.find((f) => f.key === 'momentum')?.points).toBe(6)
  })

  it('re-ranks when fields change (same function, new data)', () => {
    const a = makeItem({ importance: 2 })
    const b = makeItem({ importance: 2 })
    const before = rankItems([a, b], { now: NOW })
    const after = rankItems([{ ...a, importance: 5 }, b], { now: NOW })
    expect(before.ready[0]?.score).toBe(before.ready[1]?.score)
    expect(after.ready[0]?.item.id).toBe(a.id)
    expect(after.ready[0]?.score).toBeGreaterThan(after.ready[1]?.score ?? 0)
  })
})

describe('put-off view', () => {
  it('sorts purely by staleness regardless of importance or deadlines', () => {
    const urgentButFresh = makeItem({
      importance: 5,
      hardDeadline: date(1),
      lastTouchedAt: iso(-1),
    })
    const trivialButStale = makeItem({ importance: 1, lastTouchedAt: iso(-40) })
    const ranked = rankByStaleness([urgentButFresh, trivialButStale], NOW)
    expect(ranked[0]?.id).toBe(trivialButStale.id)
  })
})
