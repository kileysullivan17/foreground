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

describe('cost of delay: deadline', () => {
  it('scores closer deadlines higher', () => {
    const soon = scoreItem(makeItem({ hardDeadline: date(2) }), [], { now: NOW })
    const far = scoreItem(makeItem({ hardDeadline: date(25) }), [], { now: NOW })
    const none = scoreItem(makeItem(), [], { now: NOW })
    expect(soon.score).toBeGreaterThan(far.score)
    expect(far.score).toBeGreaterThan(none.score)
  })

  it('marks overdue items with the max deadline points and says so', () => {
    const overdue = scoreItem(makeItem({ hardDeadline: date(-3) }), [], { now: NOW })
    const deadline = overdue.delayFactors.find((f) => f.key === 'deadline')
    expect(deadline?.points).toBe(35)
    expect(deadline?.label).toBe('Overdue by 3 days')
  })

  it('computes whole days until deadline, end-of-day inclusive', () => {
    expect(daysUntilDeadline(date(0), NOW)).toBe(0)
    expect(daysUntilDeadline(date(1), NOW)).toBe(1)
    expect(daysUntilDeadline(date(-1), NOW)).toBe(-1)
  })
})

describe('job size divides (the WSJF core)', () => {
  it('prefers the smaller of two otherwise-identical items', () => {
    const small = makeItem({ effort: 'S', importance: 4 })
    const large = makeItem({ effort: 'L', importance: 4 })
    const { ready } = rankItems([small, large], { now: NOW })
    expect(ready[0]?.item.id).toBe(small.id)
    expect(ready[0]!.size.divisor).toBe(1)
    expect(ready[1]!.size.divisor).toBe(3)
    expect(ready[0]!.costOfDelay).toBe(ready[1]!.costOfDelay)
  })

  it('exposes the divisor and a plain label on every scored item', () => {
    const medium = scoreItem(makeItem({ effort: 'M' }), [], { now: NOW })
    expect(medium.size).toEqual({ divisor: 2, label: 'Medium job' })
    expect(medium.score).toBe(medium.costOfDelay / 2)
  })
})

describe('staleness multiplier', () => {
  it('makes an untouched item outrank an identical fresh one', () => {
    const fresh = makeItem({ lastTouchedAt: iso(-1) })
    const stale = makeItem({ lastTouchedAt: iso(-28) })
    const { ready } = rankItems([fresh, stale], { now: NOW })
    expect(ready[0]?.item.id).toBe(stale.id)
    expect(ready[0]?.staleness?.label).toBe('Untouched for 28 days')
  })

  it('caps at x1.5 so age amplifies value instead of replacing it', () => {
    const ancient = scoreItem(makeItem({ lastTouchedAt: iso(-200) }), [], { now: NOW })
    expect(ancient.staleness?.multiplier).toBe(1.5)
  })

  it('cannot lift a same-size trivial item over near-deadline work', () => {
    const dueTomorrow = makeItem({ hardDeadline: date(1), importance: 4 })
    const staleTrivial = makeItem({ importance: 2, lastTouchedAt: iso(-90) })
    const { ready } = rankItems([dueTomorrow, staleTrivial], { now: NOW })
    expect(ready[0]?.item.id).toBe(dueTomorrow.id)
  })

  it('a bare deadline beats any staleness-boosted trivial item (the boundary)', () => {
    // A trivial item — lowest importance, nothing waiting on it, not in
    // progress — has zero cost of delay, and the staleness multiplier applied
    // to zero is still zero. So even the weakest deadline (far future, worth
    // 2 points) outranks the most stale trivial item there can be. This is the
    // documented boundary in FRAMEWORK.md: staleness amplifies an existing
    // signal, it never invents one. Intended behavior, pinned here.
    const farDeadline = makeItem({ hardDeadline: date(60), importance: 1 })
    const ancientTrivial = makeItem({ importance: 1, lastTouchedAt: iso(-1000) })
    const { ready } = rankItems([ancientTrivial, farDeadline], { now: NOW })
    expect(ready[0]?.item.id).toBe(farDeadline.id)

    const trivial = ready.find((s) => s.item.id === ancientTrivial.id)
    expect(trivial?.staleness?.multiplier).toBe(1.5) // fully boosted…
    expect(trivial?.costOfDelay).toBe(0) // …but there is nothing to boost,
    expect(trivial?.score).toBe(0) // so the score stays at zero.
  })

  it('stays quiet for recently touched items', () => {
    const fresh = scoreItem(makeItem({ lastTouchedAt: iso(-1) }), [], { now: NOW })
    expect(fresh.staleness).toBeNull()
  })

  it('multiplies rather than adds: boosts scale with what is at stake', () => {
    const staleImportant = scoreItem(
      makeItem({ importance: 5, lastTouchedAt: iso(-30) }),
      [],
      { now: NOW },
    )
    const staleTrivial = scoreItem(
      makeItem({ importance: 1, lastTouchedAt: iso(-30) }),
      [],
      { now: NOW },
    )
    const importantGain = staleImportant.score - staleImportant.costOfDelay / 2
    const trivialGain = staleTrivial.score - staleTrivial.costOfDelay / 2
    expect(importantGain).toBeGreaterThan(trivialGain)
  })
})

describe('dependency handling', () => {
  it('boosts items that other open work is waiting on', () => {
    const blocker = makeItem({ title: 'Freeze the field list' })
    const dependent = makeItem({ dependsOn: [blocker.id] })
    const all = [blocker, dependent]
    const scored = scoreItem(blocker, all, { now: NOW })
    const unblocks = scored.delayFactors.find((f) => f.key === 'unblocks')
    expect(unblocks?.points).toBe(8)
    expect(unblocks?.label).toContain('Holding up')
  })

  it('ignores dependents that are already done', () => {
    const blocker = makeItem()
    const doneDependent = makeItem({ dependsOn: [blocker.id], status: 'done' })
    const scored = scoreItem(blocker, [blocker, doneDependent], { now: NOW })
    expect(scored.delayFactors.find((f) => f.key === 'unblocks')).toBeUndefined()
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
  it('steepens the size divisor so big jobs sink', () => {
    // Big enough cost of delay that the large item wins under normal
    // divisors; quick-wins mode must still sink it below the small one.
    const small = makeItem({ effort: 'S' })
    const large = makeItem({ effort: 'L', importance: 5, hardDeadline: date(3) })
    const off = rankItems([small, large], { now: NOW })
    const on = rankItems([small, large], { now: NOW, quickWins: true })
    expect(off.ready[0]?.item.id).toBe(large.id)
    expect(on.ready[0]?.item.id).toBe(small.id)
    expect(on.ready.find((s) => s.item.id === large.id)?.size.divisor).toBe(6)
  })

  it('labels the effort fit in both directions when on', () => {
    const small = scoreItem(makeItem({ effort: 'S' }), [], { now: NOW, quickWins: true })
    const large = scoreItem(makeItem({ effort: 'L' }), [], { now: NOW, quickWins: true })
    expect(small.size.label).toBe('Small job, good for right now')
    expect(large.size.label).toBe('Big job, wrong time for it')
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

  it('counts momentum into cost of delay for in-progress items', () => {
    const started = scoreItem(makeItem({ status: 'in_progress' }), [], { now: NOW })
    expect(started.delayFactors.find((f) => f.key === 'momentum')?.points).toBe(6)
    expect(started.costOfDelay).toBe(13 + 6)
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

  it('sums delay factors into costOfDelay and applies the formula', () => {
    const item = makeItem({
      effort: 'L',
      importance: 5,
      hardDeadline: date(10),
      lastTouchedAt: iso(-12),
    })
    const scored = scoreItem(item, [], { now: NOW })
    const summed = scored.delayFactors.reduce((s, f) => s + f.points, 0)
    expect(scored.costOfDelay).toBe(summed)
    expect(scored.score).toBe(
      Math.round((summed / 3) * scored.staleness!.multiplier * 10) / 10,
    )
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
