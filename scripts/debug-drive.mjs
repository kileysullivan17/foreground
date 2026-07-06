import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text()))

await page.goto('http://localhost:5199/')
await page.waitForSelector('main > ul > li h3')

const top = await page.$eval('main > ul > li h3', (h) => h.textContent)
console.log('top card:', top)

// click Done via Playwright's real click on the first card
await page.locator('main > ul > li').first().getByRole('button', { name: 'Done' }).click()
await page.waitForTimeout(1000)

const topAfter = await page.$eval('main > ul > li h3', (h) => h.textContent)
console.log('top card after Done + 1s:', topAfter)

const stored = await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('planner-db-v1'))
  return db.items.filter((i) => i.status === 'done').map((i) => i.title)
})
console.log('done items in localStorage:', stored)

await browser.close()
