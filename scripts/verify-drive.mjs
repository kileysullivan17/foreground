// Drives the planner app end-to-end in headless Chromium at phone size.
// Usage: npm run dev -- --port 5199, then `node scripts/verify-drive.mjs`.
// SHOTS=<dir> controls where screenshots land (default cwd).
import { chromium } from 'playwright'

const BASE = 'http://localhost:5199'
const SHOTS = process.env.SHOTS ?? '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()))

const readyCards = () =>
  page.$$eval('main > ul > li', (lis) =>
    lis.map((li) => ({
      title: li.querySelector('h3')?.textContent,
      score: li.querySelector('span[title="Priority score"]')?.textContent,
      factors: [...li.querySelectorAll('ul li')].map((f) => f.textContent?.trim()),
    })),
  )

const gotoTab = async (name, heading) => {
  await page.getByRole('link', { name }).click()
  await page.waitForSelector(`h1:has-text("${heading}")`)
}

// ---- Step 1: What now initial ranking ----
await page.goto(BASE)
await page.waitForSelector('main > ul > li h3')
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
await page.locator('main > ul > li').first().getByRole('button', { name: 'Done' }).click()
await page.waitForTimeout(300)
cards = await readyCards()
console.log('STEP3 done item:', topTitle)
console.log('STEP3 still listed:', cards.some((c) => c.title === topTitle))
console.log('STEP3 new top3:', JSON.stringify(cards.slice(0, 3).map((c) => `${c.score} ${c.title}`)))

// ---- Step 4: blocked section ----
const blockedToggle = page.getByRole('button', { name: /Blocked \(/ })
console.log('STEP4 blocked label:', await blockedToggle.textContent())
await blockedToggle.click()
await page.waitForTimeout(100)
const blockedTexts = await page.$$eval('section ul > li', (lis) =>
  lis.slice(0, 2).map((li) => li.textContent?.slice(0, 120)),
)
console.log('STEP4 first blocked:', JSON.stringify(blockedTexts))
await page.screenshot({ path: `${SHOTS}/4-blocked.png` })

// ---- Step 5: Put off view, stalest first + touch it ----
await gotoTab('Put off', 'put off')
await page.waitForSelector('main > ul > li h3')
let staleTitles = await page.$$eval('main > ul > li', (lis) =>
  lis.slice(0, 3).map((li) => `${li.querySelector('h3')?.textContent} | ${[...li.querySelectorAll('p')].map((p) => p.textContent).join(' | ')}`),
)
console.log('STEP5 stalest3:', JSON.stringify(staleTitles, null, 1))
await page.screenshot({ path: `${SHOTS}/5-putoff.png` })

const staleTop = await page.$eval('main > ul > li h3', (h) => h.textContent)
await page.getByRole('button', { name: 'Touch it' }).first().click()
await page.getByPlaceholder(/where does this stand/).fill('Called the contractor’s back; two more quotes booked for Tuesday')
await page.getByRole('button', { name: 'Save' }).click()
await page.waitForTimeout(300)
staleTitles = await page.$$eval('main > ul > li', (lis) => lis.slice(0, 2).map((li) => li.querySelector('h3')?.textContent))
console.log('STEP5 touched:', staleTop, '→ new top:', JSON.stringify(staleTitles))
const touchedNow = await page.$$eval('main > ul > li', (lis, t) => {
  const row = lis.find((li) => li.querySelector('h3')?.textContent === t)
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
await page.waitForSelector('main > ul > li h3')
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
await page.waitForSelector('main > ul > li h3')
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

await browser.close()
console.log('DONE')
