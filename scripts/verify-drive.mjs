// Drives the planner app end-to-end in headless Chromium at phone size.
// Usage: npm run dev -- --port 5199, then `node scripts/verify-drive.mjs`.
// SHOTS=<dir> controls where screenshots land (default cwd).
// Selectors follow the Organic redesign: rank #1 lives in the foreground
// panel (section[aria-label]), the queue is main > ul, and story moves go
// through a pick-then-confirm flow in the sheet.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5199'
const SHOTS = process.env.SHOTS ?? '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()))

const FG = 'section[aria-label="In the foreground"]'

// The ready ranking: the foreground panel (#1) followed by the queue cards.
const readyCards = () =>
  page.evaluate(() => {
    const out = []
    const fg = document.querySelector('section[aria-label="In the foreground"]')
    if (fg) {
      out.push({
        title: fg.querySelector('h2')?.textContent,
        score: fg.querySelector('.font-display.tabular-nums')?.textContent,
        factors: [...fg.querySelectorAll('.rounded-ctl > div')].map((d) => d.textContent?.trim()),
      })
    }
    for (const li of document.querySelectorAll('main > ul > li')) {
      out.push({
        title: li.querySelector('.text-card')?.textContent,
        score: li.querySelector('.font-display.tabular-nums')?.textContent,
        factors: [...li.querySelectorAll('span.truncate')].map((s) => s.textContent?.trim()),
      })
    }
    return out
  })

const gotoTab = async (name, heading) => {
  await page.getByRole('link', { name }).click()
  await page.waitForSelector(`h1:has-text("${heading}")`)
}

// ---- Step 1: What now initial ranking ----
await page.goto(BASE)
await page.waitForSelector(FG)
let cards = await readyCards()
console.log('STEP1 top5:', JSON.stringify(cards.slice(0, 5), null, 1))
await page.screenshot({ path: `${SHOTS}/1-whatnow.png`, fullPage: false })

// ---- Step 2: quick wins toggle re-ranks live ----
const beforeOrder = cards.map((c) => c.title)
await page.getByRole('button', { name: /Quick wins/ }).click()
await page.waitForTimeout(150)
cards = await readyCards()
const afterOrder = cards.map((c) => c.title)
console.log('STEP2 quickwins top3:', JSON.stringify(cards.slice(0, 3).map((c) => `${c.score} ${c.title}`)))
console.log('STEP2 order changed:', JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder))
await page.screenshot({ path: `${SHOTS}/2-quickwins.png` })
await page.getByRole('button', { name: /Quick wins/ }).click() // off again

// ---- Step 3: one-tap Done on top item; dependent should unblock ----
await page.waitForTimeout(150)
cards = await readyCards()
const topTitle = cards[0].title
// two StatusActions render in the panel (desktop + mobile); the visible one is last
await page.locator(FG).getByRole('button', { name: 'Done' }).last().click()
await page.waitForTimeout(300)
cards = await readyCards()
console.log('STEP3 done item:', topTitle)
console.log('STEP3 still listed:', cards.some((c) => c.title === topTitle))
console.log('STEP3 new top3:', JSON.stringify(cards.slice(0, 3).map((c) => `${c.score} ${c.title}`)))

// ---- Step 4: blocked shelf with the dependency chain ----
const blockedToggle = page.getByRole('button', { name: /Blocked \(/ })
console.log('STEP4 blocked label:', await blockedToggle.textContent())
await blockedToggle.click()
await page.waitForTimeout(100)
const blockedTexts = await page.$$eval('section ul > li', (lis) =>
  lis.slice(0, 2).map((li) => li.textContent?.slice(0, 120)),
)
console.log('STEP4 first blocked:', JSON.stringify(blockedTexts))
// open the first blocked card: the chain replaces the score
await page.locator('section ul > li button[aria-expanded]').first().click()
await page.waitForTimeout(200)
const chain = await page.locator('section ul > li').first().textContent()
console.log('STEP4 chain shows waits-on:', chain?.includes('Waits on'), '| actionable link:', /ranked #\d/.test(chain ?? ''))
await page.screenshot({ path: `${SHOTS}/4-blocked.png` })

// ---- Step 5: Put off view, stalest first + touch it ----
await gotoTab('Put off', 'put off')
await page.waitForSelector('main ul > li')
let staleRows = await page.$$eval('main ul > li', (lis) =>
  lis.slice(0, 3).map(
    (li) =>
      `${li.querySelector('.flex-1 .font-semibold')?.textContent} | ${li.querySelector('.font-display')?.textContent} days`,
  ),
)
console.log('STEP5 stalest3:', JSON.stringify(staleRows, null, 1))
await page.screenshot({ path: `${SHOTS}/5-putoff.png` })

const staleTop = await page.$eval('main ul > li .flex-1 .font-semibold', (h) => h.textContent)
await page.getByRole('button', { name: 'Touch it' }).first().click()
await page.getByPlaceholder(/where does this stand/).fill('Called the first contractor back; two more quotes booked for Tuesday')
await page.getByRole('button', { name: 'Save' }).click()
await page.waitForTimeout(300)
staleRows = await page.$$eval('main ul > li', (lis) => lis.slice(0, 2).map((li) => li.querySelector('.flex-1 .font-semibold')?.textContent))
console.log('STEP5 touched:', staleTop, '→ new top:', JSON.stringify(staleRows))
const touchedNow = await page.$$eval('main ul > li', (lis, t) => {
  const row = lis.find((li) => li.querySelector('.flex-1 .font-semibold')?.textContent === t)
  return row?.textContent
}, staleTop)
console.log('STEP5 touched row now:', touchedNow?.slice(0, 160))

// ---- Step 6: Projects — inline add + edit importance ----
await gotoTab('Projects', 'Projects')
await page.screenshot({ path: `${SHOTS}/6-projects.png` })
const groceries = page.locator('section').filter({ has: page.locator('h3', { hasText: 'Groceries system' }) }).last()
await groceries.getByPlaceholder('Add an item…').fill('Print the weekly list template')
await groceries.getByRole('button', { name: 'Add', exact: true }).click()
await page.waitForTimeout(300)
const added = await groceries.textContent()
console.log('STEP6 inline add present:', added?.includes('Print the weekly list template'))

// open editor for "Label the pantry shelves", bump importance to 5
await groceries.getByRole('button', { name: /Label the pantry shelves/ }).click()
await page.waitForTimeout(100)
await groceries.locator('select').first().selectOption('5')
await page.screenshot({ path: `${SHOTS}/6b-item-editor.png` })
await groceries.getByRole('button', { name: 'Save' }).click()
await page.waitForTimeout(300)
console.log('STEP6 edited importance of "Label the pantry shelves" to 5')

// ---- Step 7: re-rank check on What now ----
await gotoTab('Now', 'What now')
await page.waitForSelector(FG)
cards = await readyCards()
const labelIdx = cards.findIndex((c) => c.title === 'Label the pantry shelves')
console.log('STEP7 top5 after edits:', JSON.stringify(cards.slice(0, 5).map((c) => `${c.score} ${c.title}`)))
console.log('STEP7 pantry item now at rank', labelIdx, JSON.stringify(cards[labelIdx]))

// ---- Step 8: Add item fast capture + appears ranked ----
await gotoTab('Add', 'Add item')
await page.getByPlaceholder('What needs doing?').fill('Sharpen the mower blade')
await page.getByRole('button', { name: /More detail/ }).click()
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
await page.locator('input[type="date"]').fill(tomorrow)
await page.locator('select').nth(1).selectOption('5') // importance (0 = project select)
await page.screenshot({ path: `${SHOTS}/8-additem.png` })
await page.getByRole('button', { name: 'Add item', exact: true }).click()
await page.waitForSelector('text=Added')
console.log('STEP8 banner shown: true')

await gotoTab('Now', 'What now')
await page.waitForSelector(FG)
cards = await readyCards()
const mower = cards.findIndex((c) => c.title === 'Sharpen the mower blade')
console.log('STEP8 mower rank:', mower, JSON.stringify(cards[mower]))
await page.screenshot({ path: `${SHOTS}/9-final-whatnow.png` })

// ---- Step 9 (probes): empty title on Add; area filter isolation ----
await gotoTab('Add', 'Add item')
await page.getByRole('button', { name: 'Add item', exact: true }).click()
await page.waitForTimeout(150)
const err = await page.$eval('main form p', (p) => p.textContent).catch(() => null)
console.log('PROBE empty title →', err)

await gotoTab('Now', 'What now')
await page.getByRole('radio', { name: 'Work' }).click()
await page.waitForTimeout(100)
cards = await readyCards()
console.log('PROBE work filter top3:', JSON.stringify(cards.slice(0, 3).map((c) => c.title)))
const nonWork = cards.some((c) => ['Sharpen the mower blade', 'Write the master staples list'].includes(c.title ?? ''))
console.log('PROBE home items leaked into work filter:', nonWork)

// ---- Step 10: Product board renders with the seeded backlog ----
await gotoTab('Product', 'Product')
const cols = await page.$$eval('section h2', (hs) => hs.map((h) => h.textContent))
console.log('STEP10 columns:', JSON.stringify(cols))
await page.screenshot({ path: `${SHOTS}/10-product-board.png` })

await page.getByLabel('Capture an idea').fill('Idea captured during the verify drive')
await page.getByRole('button', { name: 'Add idea' }).click()
await page.waitForTimeout(300)
const backlogText = await page.locator('section', { hasText: 'Backlog' }).first().textContent()
console.log('STEP10 capture shows as raw:', backlogText?.includes('Idea captured during the verify drive'))

// ---- Step 11: groom a raw capture, accept the draft ----
await page.locator('section ul button', { hasText: 'Idea captured during the verify drive' }).first().click()
await page.waitForSelector('[role="dialog"]')
await page.getByRole('button', { name: 'Groom this' }).click()
await page.waitForSelector('text=Proposed draft')
const draftTitle = await page.getByLabel('Story title').inputValue()
console.log('STEP11 draft in story form:', draftTitle.startsWith('As a '))
await page.screenshot({ path: `${SHOTS}/11-groom-draft.png` })
await page.getByRole('button', { name: 'Accept draft' }).click()
await page.waitForTimeout(400)
const groomedChip = await page.locator('[role="dialog"] span.bg-sand-200').first().textContent()
console.log('STEP11 status after accept:', groomedChip)

// ---- Step 12: move between columns (pick a destination, then confirm) ----
await page.getByRole('radio', { name: 'In progress' }).click()
await page.getByRole('button', { name: 'Move to In progress' }).click()
await page.waitForTimeout(300)
const movedChip = await page.locator('[role="dialog"] span.bg-sand-200').first().textContent()
console.log('STEP12 status after move:', movedChip)
await page.getByRole('button', { name: 'Close', exact: true }).click()
await page.waitForTimeout(200)
// grooming rewrote the title into story form, which lowercases the capture
const inProgressCol = await page
  .locator('section')
  .filter({ has: page.locator('h2', { hasText: 'In progress' }) })
  .first()
  .textContent()
console.log('STEP12 card landed in column:', inProgressCol?.includes('idea captured during the verify drive'))

// ---- Step 13: About view from the header ----
await page.getByRole('link', { name: 'About' }).click()
await page.waitForSelector('h1:has-text("About Foreground")')
const aboutText = await page.locator('main').textContent()
console.log('STEP13 about mentions framework:', aboutText?.includes('WSJF'))
await page.screenshot({ path: `${SHOTS}/13-about.png` })

await browser.close()
console.log('DONE')
