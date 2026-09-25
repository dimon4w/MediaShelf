import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const output = resolve(import.meta.dirname, '../.impeccable/references')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })
try {
  const references = process.argv.includes('--additional')
    ? [
        ['apple-tv', 'https://tv.apple.com/'],
        ['bfi', 'https://www.bfi.org.uk/'],
      ]
    : [
        ['mubi', 'https://mubi.com/en'],
        ['criterion', 'https://www.criterion.com/'],
        ['letterboxd', 'https://letterboxd.com/'],
      ]
  for (const [name, url] of references) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    })
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2200)
      for (const label of [/accept all/i, /reject all/i, /allow all/i]) {
        const button = page.getByRole('button', { name: label }).first()
        if (await button.isVisible().catch(() => false)) {
          await button.click()
          break
        }
      }
      await page.screenshot({ path: resolve(output, `${name}.png`) })
      console.log(
        JSON.stringify({
          name,
          status: response?.status(),
          title: await page.title(),
          typography: await page.locator('h1,h2').evaluateAll((nodes) =>
            nodes.slice(0, 5).map((e) => ({
              text: e.textContent?.trim().slice(0, 90),
              size: getComputedStyle(e).fontSize,
              weight: getComputedStyle(e).fontWeight,
            })),
          ),
        }),
      )
    } catch (error) {
      console.log(`${name}: ${error.message}`)
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}
