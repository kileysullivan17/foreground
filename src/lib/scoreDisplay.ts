import type { ScoredItem, ScoreFactor } from '../scoring/score'

// Presentation-only helpers for the score ledger: split factors into the
// receipt's label/detail shape and compress them into one line.
// No arithmetic happens here; the scoring module owns the numbers.

export const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export const isOverdue = (f: ScoreFactor) => f.key === 'deadline' && f.label.startsWith('Overdue')

/** Split a scoring factor into the ledger's label + quiet detail. */
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

/** Color role for one piece of the collapsed line: time pressure reads in
 *  the accent, an overdue deadline in the one red, everything else plain. */
export type TeaserTone = 'accent' | 'overdue' | 'text'

export interface TeaserPart {
  text: string
  tone: TeaserTone
}

/** The collapsed arithmetic as parts, so the UI can color time pressure
 *  without changing the words. Joined with " · " they make `teaserLine`. */
export function teaserParts(scored: ScoredItem): TeaserPart[] {
  const parts: TeaserPart[] = scored.delayFactors.map((f) => {
    if (f.key === 'deadline')
      return { text: `${lower(f.label)} +${f.points}`, tone: isOverdue(f) ? 'overdue' : 'accent' }
    if (f.key === 'importance') return { text: `+${f.points} importance`, tone: 'text' }
    if (f.key === 'unblocks') return { text: `+${f.points} unblocks`, tone: 'text' }
    return { text: `+${f.points} momentum`, tone: 'text' }
  })
  parts.push({ text: `÷ ${scored.size.divisor}`, tone: 'text' })
  if (scored.staleness) parts.push({ text: `× ${scored.staleness.multiplier} stale`, tone: 'accent' })
  return parts
}

/** One collapsed line of the arithmetic, for a card that isn't open. The
 *  full string, always: the UI wraps it and never ellipsizes. */
export function teaserLine(scored: ScoredItem): string {
  return teaserParts(scored)
    .map((p) => p.text)
    .join(' · ')
}

/** The equation restated in one line: adds, divide, multiplier. */
export function equationLine(scored: ScoredItem): string {
  const adds = scored.delayFactors.map((f) => f.points).join(' + ')
  const base = `(${adds || 0}) ÷ ${scored.size.divisor}`
  return scored.staleness ? `${base} × ${scored.staleness.multiplier}` : base
}
