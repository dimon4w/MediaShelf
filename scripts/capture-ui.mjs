import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

const output = resolve(import.meta.dirname, '../.impeccable/review')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
})
const errors = []
try {
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'reduce',
      isMobile: name === 'mobile',
      hasTouch: name === 'mobile',
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(process.env.SITE_URL ?? 'http://127.0.0.1:5173')
    await page.locator('.media-card').first().waitFor({ timeout: 45000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(3500)
    await page.screenshot({ path: resolve(output, `${name}-top.png`), animations: 'disabled' })
    await page.locator('#catalog').evaluate((e) => e.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(800)
    await page.screenshot({ path: resolve(output, `${name}-online.png`), animations: 'disabled' })
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      throw new Error(`${name}: horizontal overflow`)
    await expect(page.locator('canvas')).toHaveCount(0)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect(page.locator('.app-shell')).not.toHaveClass(/header-hidden/)
    await page.getByRole('link', { name: 'Поиск', exact: true }).click()
    await page.getByRole('combobox', { name: 'Поиск по названию или жанру' }).focus()
    await page.screenshot({ path: resolve(output, `${name}-search.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    if (name === 'desktop') {
      const searchResponse = page.waitForResponse(
        (response) => {
          const url = new URL(response.url())
          return url.pathname === '/api/catalog' && url.searchParams.get('q') === 'the witcher 3'
        },
        { timeout: 45000 },
      )
      await page
        .getByRole('combobox', { name: 'Поиск по названию или жанру' })
        .fill('the witcher 3')
      await page.keyboard.press('Escape')
      await searchResponse
      await expect(page.locator('#catalog')).toHaveAttribute('aria-busy', 'false')
      await page
        .locator('.card-title')
        .filter({ hasText: /The Witcher 3: Wild Hunt.*Complete Edition$/i })
        .first()
        .waitFor({ timeout: 40000 })
      await page
        .locator('.card-title')
        .filter({ hasText: /The Witcher 3: Wild Hunt.*Complete Edition$/i })
        .first()
        .click()
      await expect(page.locator('.store-offers a').first()).toContainText('Steam', {
        timeout: 45000,
      })
      await expect(page.locator('.store-offers')).toContainText('GOG', { timeout: 45000 })
      await expect(page.getByRole('dialog').locator('.public-ratings')).toContainText('Steam', {
        timeout: 45000,
      })
      await page.screenshot({ path: resolve(output, 'desktop-game.png'), animations: 'disabled' })
      console.log('Steam first, real game offers:', await page.locator('.store-offers').innerText())
      await page.keyboard.press('Escape')
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect(page.locator('.app-shell')).not.toHaveClass(/header-hidden/)
    await page.getByRole('link', { name: 'Что сегодня?', exact: true }).click()
    await page.getByRole('button', { name: 'Крутить', exact: true }).click()
    await page.locator('.roulette-result h3').waitFor()
    await page.screenshot({ path: resolve(output, `${name}-roulette.png`), animations: 'disabled' })
    console.log(`${name}: navigation, catalog, search and roulette OK`)
    await context.close()
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(process.env.SITE_URL ?? 'http://127.0.0.1:5173')
  await page.getByRole('link', { name: 'Что сегодня?', exact: true }).click()
  await page.getByRole('button', { name: 'Крутить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Выбираем…', exact: true })).toBeDisabled()
  await page.locator('.roulette-result h3').waitFor({ timeout: 10000 })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(page.locator('.app-shell')).not.toHaveClass(/header-hidden/)
  await page.getByRole('link', { name: 'Чарты', exact: true }).click()
  await expect(page.locator('.roulette-page')).toHaveCount(0)
  await context.close()
  console.log('Real 3.8-second roulette animation and page navigation: OK')
  if (errors.length) throw new Error(errors.join('\n'))
} finally {
  await browser.close()
}
