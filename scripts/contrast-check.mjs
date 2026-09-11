// WCAG contrast audit for the Ember theme (design/EMBER.md §2). Checks every
// text/background pair the design uses at small sizes (< 18.66px bold /
// 24px regular). Semi-transparent fills (accent-soft, raised chips on the
// panel) are composited onto their grounds before measuring. Exits 1 if any
// pair lands under 4.5:1.
//
//   node scripts/contrast-check.mjs

const hex = (h) => {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}

/** Composite a foreground color with alpha over an opaque background. */
const over = (fgHex, alpha, bgHex) => {
  const fg = hex(fgHex)
  const bg = hex(bgHex)
  const mixed = fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const luminance = (h) => {
  const [r, g, b] = hex(h).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const ground = '#15171b'
const panel = '#1b1e23'
const raised = '#22262c'
const text = '#e9e7e1'
const text2 = '#a9abaf'
const text3 = '#8b8e94'
const accent = '#ee7a3c'
const accentInk = '#15171b'
const overdue = '#ff9d85'

// Composited fills: the soft accent tint on the panel (WSJF chip on a
// story card) and on the ground (Start inside an expanded queue row).
const softOnPanel = over(accent, 0.16, panel)
const softOnGround = over(accent, 0.16, ground)
const lineOnGround = over(text, 0.1, ground) // the Raw capture chip

const pairs = [
  ['text / ground', text, ground],
  ['text / panel', text, panel],
  ['text / raised', text, raised],
  ['text-2 body / ground', text2, ground],
  ['text-2 body / panel', text2, panel],
  ['text-2 detail / raised ledger', text2, raised],
  ['text-3 mono label / ground', text3, ground],
  ['text-3 mono label / panel', text3, panel],
  ['text-3 mono label / raised', text3, raised],
  ['accent / ground', accent, ground],
  ['accent / panel', accent, panel],
  ['accent / raised ledger', accent, raised],
  ['accent / soft tint on panel', accent, softOnPanel],
  ['accent / soft tint on ground', accent, softOnGround],
  ['accent-ink / accent button', accentInk, accent],
  ['accent-ink / accent-hover button', accentInk, '#f4955f'],
  ['overdue / panel', overdue, panel],
  ['overdue / raised ledger', overdue, raised],
  ['text / line chip on ground', text, lineOnGround],
]

let failed = 0
console.log('pair'.padEnd(38), 'fg'.padEnd(8), 'bg'.padEnd(8), 'ratio  verdict')
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg)
  const ok = r >= 4.5
  if (!ok) failed++
  console.log(
    name.padEnd(38),
    fg.padEnd(8),
    bg.padEnd(8),
    r.toFixed(2).padStart(5),
    ok ? '  pass' : '  FAIL',
  )
}
console.log(failed === 0 ? '\nAll pairs pass 4.5:1.' : `\n${failed} pair(s) under 4.5:1.`)
process.exit(failed === 0 ? 0 : 1)
