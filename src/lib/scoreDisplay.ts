import type { ScoredItem, ScoreFactor } from '../scoring/score'

// Presentation-only helpers for the score ledger: split factors into the
// receipt's bold-label/quiet-detail shape and compress them into one line.
// No arithmetic happens here; the scoring module owns the numbers.

export const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export const isOverdue = (f: ScoreFactor) => f.key === 'deadline' && f.label.startsWith('Overdue')

/** Split a scoring factor into the ledger's bold label + quiet detail. */
export function factorParts(f: ScoreFactor, importance: number): { label: string; detail: string } {
  switch (f.key) {
    case 'deadline':
      return { label: 'Deadline', detail: lower(f.label) }
    case 'importance':
      return { label: 'Importance', detail: `${importance} / 5` }
    case 'unblocks':
      return { label: 'Unblocks', detail: f.label.replace(/^Holding up /, '') }
    case 'momentum':
      return { label: 'Momentum', detail: 'already started' }
  }
}

/** One collapsed line of the arithmetic, for a card that isn't open. */
export function teaserLine(scored: ScoredItem): string {
  const parts = scored.delayFactors.map((f) => {
    if (f.key === 'deadline') return `${lower(f.label)} +${f.points}`
    if (f.key === 'importance') return `+${f.points} importance`
    if (f.key === 'unblocks') return `+${f.points} unblocks`
    return `+${f.points} momentum`
  })
  parts.push(`÷ ${scored.size.divisor}`)
  if (scored.staleness) parts.push(`× ${scored.staleness.multiplier} stale`)
  return parts.join(' · ')
}

/** The equation restated in one line: adds, divide, multiplier. */
export function equationLine(scored: ScoredItem): string {
  const adds = scored.delayFactors.map((f) => f.points).join(' + ')
  const base = `(${adds || 0}) ÷ ${scored.size.divisor}`
  return scored.staleness ? `${base} × ${scored.staleness.multiplier}` : base
}
