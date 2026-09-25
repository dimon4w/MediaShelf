import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { catalog } from '../src/lib/catalog.ts'
import { createEntry, updateLibraryEntry } from '../src/lib/library.ts'
import { attachEpisodeCatalog, changeEpisode } from '../src/lib/episodes.ts'
import { enrichItem } from '../server/metadata.ts'
import { getEpisodeCatalog } from '../server/episodes.ts'

const phase = process.argv[2] ?? 'pass-1'
const output = resolve(import.meta.dirname, `../.impeccable/review/${phase}`)
await mkdir(output, { recursive: true })
const gameBase = catalog.find((i) => i.id === 'game-cyberpunk')
const showBase = catalog.find((i) => i.id === 'series-severance')
const [game, episodeCatalog] = await Promise.all([
  enrichItem({ ...gameBase, externalIds: { steam: '1091500' } }, 'US').catch(() => gameBase),
  getEpisodeCatalog(showBase).catch(() => ({ episodes: [], source: 'manual', complete: false })),
])
const works = catalog.map((i) => (i.id === game.id ? game : i))
const entries = Object.fromEntries(
  works.slice(0, 10).map((item, index) => [
    item.id,
    updateLibraryEntry(item, createEntry(item, index), {
      favorite: index < 3,
      rating: index % 2 ? 8 : 9,
    }),
  ]),
)
entries[game.id] = updateLibraryEntry(game, entries[game.id], {
  playthroughs: [
    { id: 'xbox', platform: 'Xbox', store: 'xbox', progress: 80, statuses: ['completed'] },
    { id: 'epic', platform: 'PC', store: 'epic', progress: 24, statuses: ['active'] },
  ],
})
if (episodeCatalog.episodes.length) {
  entries[showBase.id] = attachEpisodeCatalog(entries[showBase.id], episodeCatalog)
  for (const episode of episodeCatalog.episodes.filter((e) => e.season === 1).slice(0, 2))
    entries[showBase.id] = changeEpisode(entries[showBase.id], episode.key, { watched: true })
}
const browser = await chromium.launch({ channel: 'msedge' })
const errors = [],
  measurements = []
try {
  const widths = process.argv
    .slice(3)
    .map(Number)
    .filter((width) => [1440, 1024, 768, 390].includes(width))
  for (const width of widths.length ? widths : [1440, 1024, 768, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: 'reduce',
      hasTouch: width <= 768,
      isMobile: width === 390,
    })
    await context.addInitScript(
      (data) =>
        localStorage.setItem('mediashelf-library', JSON.stringify({ state: data, version: 0 })),
      {
        entries,
        customItems: [],
        preferences: {
          onboarded: true,
          platforms: ['PC', 'Xbox'],
          stores: ['steam', 'epic'],
          country: 'US',
        },
      },
    )
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(`${width}: ${error.message}`))
    await page.route('**/api/catalog?*', async (route) => {
      const url = new URL(route.request().url()),
        query = (url.searchParams.get('q') ?? '').toLowerCase(),
        type = url.searchParams.get('type')
      if (query === '__error')
        return route.fulfill({ status: 503, json: { error: 'Controlled offline state' } })
      if (query === '__loading') await new Promise((resolve) => setTimeout(resolve, 3000))
      const items = works.filter(
        (i) =>
          (type === 'all' || i.type === type) &&
          `${i.title} ${i.originalTitle}`.toLowerCase().includes(query),
      )
      await route.fulfill({
        json: {
          items,
          sources: [{ id: 'steam', label: 'Steam', status: 'available', count: items.length }],
          page: 1,
          hasMore: false,
        },
      })
    })
    await page.route('**/api/details?*', (route) =>
      route.fulfill({
        json: {
          items: (route.request().postDataJSON() ?? []).map(
            (i) => works.find((v) => v.id === i.id) ?? i,
          ),
        },
      }),
    )
    await page.route('**/api/episodes?*', (route) => route.fulfill({ json: episodeCatalog }))
    const settle = async () => {
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(250)
    }
    const capture = async (name, save = true) => {
      await settle()
      const metric = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        header: document.querySelector('.site-header')?.getBoundingClientRect().bottom,
        nav: document.querySelector('.store-navigation')?.getBoundingClientRect().top,
      }))
      measurements.push({ width, name, ...metric })
      if (metric.scroll > width + 1)
        errors.push(`${width}/${name}: horizontal overflow ${metric.scroll}`)
      if (save)
        await page.screenshot({
          path: resolve(output, `${width}-${name}.png`),
          animations: 'disabled',
        })
    }
    const nav = async (name) => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await settle()
      await page.getByRole('link', { name, exact: typeof name === 'string' }).click()
    }
    await page.goto(process.env.SITE_URL ?? 'http://127.0.0.1:5173')
    await page.locator('.media-card').first().waitFor()
    await capture('home')
    await page
      .locator('#catalog')
      .evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }))
    await capture('catalog')
    await nav('Поиск')
    await page.getByRole('button', { name: /^Фильтры/ }).click()
    await capture('filters', width === 1024 || width === 390)
    await page.locator('.toolbar-end .choice-trigger').click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    const box = await menu.boundingBox()
    if (
      box.x < 0 ||
      box.x + box.width > width + 1 ||
      box.y < 0 ||
      box.y + box.height > (width === 390 ? 844 : 1000) + 1
    )
      errors.push(`${width}: menu out of viewport`)
    await capture('sort', width === 768 || width === 390)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Закрыть фильтры' }).click()
    const card = page
      .locator('.media-card')
      .filter({ has: page.getByRole('button', { name: 'Cyberpunk 2077', exact: true }) })
    if (
      await card.getByRole('button', { name: 'Предпросмотр: Cyberpunk 2077', exact: true }).count()
    ) {
      await card.getByRole('button', { name: 'Предпросмотр: Cyberpunk 2077', exact: true }).click()
      await card
        .locator('.preview-picture img')
        .evaluate(async (image) => {
          await image.decode().catch(() => {})
        })
        .catch(() => {})
      await capture('preview')
      await card.getByRole('button', { name: 'Закрыть предпросмотр' }).click()
      await expect(card.locator('.media-preview')).toHaveCount(0)
    }
    await nav(/^Моя полка/)
    await capture('library', width === 1440 || width === 390)
    await page.getByRole('button', { name: 'Подробнее: Cyberpunk 2077' }).click()
    await capture('game')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Подробнее: Разделение' }).click()
    if (episodeCatalog.episodes.length) {
      await page.locator('.episode-row').first().waitFor()
      await page.locator('.episode-review-button').first().click()
    }
    await page.locator('.episode-panel').scrollIntoViewIfNeeded()
    await capture('episodes')
    const closeBox = await page.getByRole('button', { name: 'Закрыть', exact: true }).boundingBox()
    if (!closeBox || closeBox.y < 0) errors.push(`${width}: close outside viewport`)
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await nav('Мой профиль')
    await capture('stats', width === 1440 || width === 390)
    await nav('Что сегодня?')
    await page.getByRole('button', { name: 'Крутить', exact: true }).click()
    await page.locator('.roulette-result h3').waitFor()
    await capture('roulette')
    await page.getByRole('button', { name: 'Открыть', exact: true }).click()
    await expect(page.locator('.detail-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await nav('Поиск')
    await page.getByRole('combobox', { name: 'Поиск по названию или жанру' }).focus()
    await capture('search', width === 1440 || width === 390)
    await page.keyboard.press('Escape')
    if (width === 1440 || width === 390) {
      const input = page.getByRole('combobox', { name: 'Поиск по названию или жанру' })
      for (const [query, state] of [
        ['__none', 'empty'],
        ['__error', 'error'],
        ['__loading', 'loading'],
      ]) {
        await input.fill(query)
        await page.keyboard.press('Escape')
        if (state === 'loading')
          await page.getByRole('status', { name: 'Загрузка онлайн-каталога' }).waitFor()
        else await expect(page.locator('#catalog')).toHaveAttribute('aria-busy', 'false')
        await page
          .locator('#catalog')
          .evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }))
        await capture(state)
      }
    }
    await page.waitForTimeout(width === 1440 || width === 390 ? 3100 : 0)
    await context.close()
  }
} finally {
  await browser.close()
}
console.log(
  JSON.stringify(
    {
      phase,
      measurements,
      errors,
      episodeSource: episodeCatalog.source,
      episodeCount: episodeCatalog.episodes.length,
    },
    null,
    2,
  ),
)
await writeFile(
  resolve(output, 'checks.json'),
  JSON.stringify(
    {
      phase,
      measurements,
      errors,
      episodeSource: episodeCatalog.source,
      episodeCount: episodeCatalog.episodes.length,
    },
    null,
    2,
  ),
)
if (errors.length) process.exitCode = 1
