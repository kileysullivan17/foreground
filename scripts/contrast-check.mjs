// WCAG contrast audit for the Organic theme (F10). Checks every text/background
// pair the design uses at small sizes (< 18.66px bold / 24px regular), in both
// themes. Semi-transparent ledger insets are composited onto their grounds
// before measuring. Exits 1 if any pair lands under 4.5:1.
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

// Composited insets: the score ledger sits on a translucent panel.
const inkLedger = over('#f5ead8', 0.08, '#201e1d') // ledger on the ink panel
const darkCardLedger = over('#f5ead8', 0.06, '#2e2b25') // ledger on a dark queue card
const invertedLedger = over('#201e1d', 0.06, '#f5ead8') // ledger on the cream panel (dark theme)

const pairs = [
  // — light theme —
  ['ink / ground', '#201e1d', '#f5ead8'],
  ['ink / surface card', '#201e1d', '#ebddc5'],
  ['ink / raised ledger', '#201e1d', '#f9f4ed'],
  ['sand-700 meta / ground', '#645c50', '#f5ead8'],
  ['sand-700 meta / surface card', '#645c50', '#ebddc5'],
  ['sand-700 meta / raised ledger', '#645c50', '#f9f4ed'],
  ['sand-800 chip text / ground', '#474238', '#f5ead8'],
  ['clay-700 factor / raised ledger', '#8c491a', '#f9f4ed'],
  ['clay-700 link / ground', '#8c491a', '#f5ead8'],
  ['sage-700 factor / raised ledger', '#56633f', '#f9f4ed'],
  ['ink / clay-500 button', '#201e1d', '#d67f48'],
  ['ink / clay-400 button hover', '#201e1d', '#f6a06b'],
  ['sage-800 / sage-200 button', '#3d472b', '#e1eecc'],
  ['sage-800 / sage-100 note', '#3d472b', '#f0fae1'],
  ['clay-800 / clay-100 chip', '#643312', '#fff2eb'],
  ['clay-800 / clay-200 disc', '#643312', '#ffe1d0'],
  ['overdue / raised ledger', '#9c2f25', '#f9f4ed'],
  ['overdue / surface card', '#9c2f25', '#ebddc5'],
  // — ink foreground panel (light theme) —
  ['cream / ink panel', '#f5ead8', '#201e1d'],
  ['sand-500 meta / ink panel', '#a19786', '#201e1d'],
  ['sand-400 meta / ink panel', '#c0b6a5', '#201e1d'],
  ['clay-300 kicker / ink panel', '#ffc6a5', '#201e1d'],
  ['sage-300 factor / ink panel', '#ccdbb2', '#201e1d'],
  ['cream / ink ledger', '#f5ead8', inkLedger],
  ['sand-500 meta / ink ledger', '#a19786', inkLedger],
  ['clay-300 factor / ink ledger', '#ffc6a5', inkLedger],
  ['sage-300 factor / ink ledger', '#ccdbb2', inkLedger],
  ['sand-400 divisor / ink ledger', '#c0b6a5', inkLedger],
  // — dark theme —
  ['cream / ink ground', '#f5ead8', '#201e1d'],
  ['cream / dark card', '#f5ead8', '#2e2b25'],
  ['sand-400 meta / dark card', '#c0b6a5', '#2e2b25'],
  ['sand-300 chip text / ink ground', '#dcd3c4', '#201e1d'],
  ['clay-400 factor / dark ledger', '#f6a06b', darkCardLedger],
  ['sage-400 factor / dark ledger', '#aebf92', darkCardLedger],
  ['sand-400 meta / dark ledger', '#c0b6a5', darkCardLedger],
  ['cream / dark ledger', '#f5ead8', darkCardLedger],
  ['ink / clay-400 button (dark)', '#201e1d', '#f6a06b'],
  ['ink / sage-300 button (dark)', '#201e1d', '#ccdbb2'],
  ['overdue-dark / dark card', '#ff9d85', '#2e2b25'],
  ['overdue-dark / ink ground', '#ff9d85', '#201e1d'],
  // — cream foreground panel (dark theme) —
  ['ink / cream panel', '#201e1d', '#f5ead8'],
  ['sand-700 meta / cream panel', '#645c50', '#f5ead8'],
  ['clay-700 kicker / cream panel', '#8c491a', '#f5ead8'],
  ['ink / inverted ledger', '#201e1d', invertedLedger],
  ['sand-700 meta / inverted ledger', '#645c50', invertedLedger],
  ['clay-700 factor / inverted ledger', '#8c491a', invertedLedger],
  ['sage-700 factor / inverted ledger', '#56633f', invertedLedger],
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
