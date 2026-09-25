import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { catalog } from '../src/lib/catalog'
import type { EpisodeCatalog, MediaItem } from '../src/lib/types'
import { createEntry, updateLibraryEntry } from '../src/lib/library'

// Deterministic API fixtures isolate UI behavior from external availability and prices.
const fixtures: MediaItem[] = catalog.map((item) => ({
  ...item,
  screenshots: [
    'http://127.0.0.1:4173/backdrops/game-cyberpunk.webp',
    'http://127.0.0.1:4173/backdrops/movie-dune.webp',
  ],
  ...(item.type === 'game'
    ? {
        offers: [
          {
            store: 'gog' as const,
            url: 'https://www.gog.com/',
            price: 1999,
            currency: 'USD',
            country: 'US',
          },
          {
            store: 'steam' as const,
            url: 'https://store.steampowered.com/',
            price: 2999,
            originalPrice: 5999,
            currency: 'USD',
            country: 'US',
          },
        ],
        ratings: [
          {
            source: 'steam' as const,
            value: 95,
            votes: 10000,
            checkedAt: '2026-09-09T00:00:00.000Z',
          },
        ],
        languages: ['русский', 'английский'],
      }
    : item.type === 'movie'
      ? {
          ratings: [
            {
              source: 'imdb' as const,
              value: 8.3,
              votes: 12000,
              checkedAt: '2026-09-09T00:00:00.000Z',
            },
          ],
        }
      : {}),
}))
const normalize = (s: string) => s.toLowerCase().replaceAll('ё', 'е')
const episodeFixture: EpisodeCatalog = {
  source: 'tvmaze',
  complete: true,
  ended: false,
  episodes: [
    { key: '1:1', season: 1, number: 1, title: 'The Journey’s End', airdate: '2023-09-29' },
    { key: '1:2', season: 1, number: 2, title: 'It Didn’t Have to Be Magic…' },
    { key: '2:1', season: 2, number: 1, title: 'A test episode in another season' },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('mediashelf-library'))
      localStorage.setItem(
        'mediashelf-library',
        JSON.stringify({
          state: {
            entries: {},
            customItems: [],
            preferences: { onboarded: true, platforms: [], stores: [], country: 'US' },
          },
          version: 0,
        }),
      )
  })
  await page.route(/^https:\/\//, (route) => route.abort())
  await page.route('**/api/catalog?*', (route) => {
    const url = new URL(route.request().url()),
      q = normalize(url.searchParams.get('q') ?? ''),
      type = url.searchParams.get('type')
    const items = fixtures.filter(
      (i) =>
        (type === 'all' || type === i.type) &&
        normalize(`${i.title} ${i.originalTitle} ${i.genres.join(' ')}`).includes(q),
    )
    return route.fulfill({
      json: {
        items,
        sources: [{ id: 'steam', label: 'Steam', status: 'available', count: items.length }],
        page: Number(url.searchParams.get('page')),
        hasMore: false,
      },
    })
  })
  await page.route('**/api/details?*', (route) => {
    const supplied = route.request().postDataJSON() as MediaItem[] | null
    return route.fulfill({
      json: { items: (supplied ?? []).map((i) => fixtures.find((f) => f.id === i.id) ?? i) },
    })
  })
  await page.route('**/api/episodes?*', (route) => route.fulfill({ json: episodeFixture }))
})

async function home(page: Page) {
  await page.goto('/')
  await page.getByRole('heading', { name: 'Чарты', exact: true }).waitFor()
  const intro = page.getByRole('dialog', { name: 'На чём играешь?' })
  if (await intro.isVisible()) await intro.getByRole('button', { name: 'Позже' }).click()
}
async function category(page: Page, label: string) {
  if (new URL(page.url()).pathname === '/') {
    await page
      .getByRole('group', { name: 'Категории чартов' })
      .getByRole('button', { name: label, exact: true })
      .click()
    return
  }
  await page.getByRole('button', { name: /^Категории:/ }).click()
  await page.getByRole('menuitemradio', { name: label, exact: true }).click()
}
async function navigate(page: Page, name: string | RegExp) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(page.locator('.app-shell')).not.toHaveClass(/header-hidden/)
  const link = page.getByRole('link', { name, exact: typeof name === 'string' })
  const path = await link.getAttribute('href')
  await link.click()
  const view = {
    '/': '.charts-page',
    '/search': '.search-page',
    '/library': '.library-page',
    '/today': '.today-page',
    '/profile': '.profile-page',
  }[path ?? '']
  if (view) await expect(page.locator(view)).toBeVisible()
}
async function search(page: Page, value: string) {
  if (new URL(page.url()).pathname !== '/search') await navigate(page, 'Поиск')
  const response = page.waitForResponse(
    (r) => r.url().includes('/api/catalog?') && new URL(r.url()).searchParams.get('q') === value,
  )
  await page.getByRole('combobox', { name: 'Поиск по названию или жанру' }).fill(value)
  await page.keyboard.press('Escape')
  await response
  await expect(page.locator('#catalog')).toHaveAttribute('aria-busy', 'false')
}

test('category menu, filters, global search and keyboard navigation', async ({ page }) => {
  await home(page)
  await expect(page.locator('.media-card')).toHaveCount(12)
  for (const name of ['Игры', 'Фильмы', 'Сериалы', 'Аниме']) {
    await category(page, name)
    await expect(page.locator('.media-card')).toHaveCount(8)
  }
  await navigate(page, 'Поиск')
  await category(page, 'Фильмы')
  await search(page, 'dune')
  await expect(page.locator('.card-title')).toHaveText('Дюна: Часть вторая')
  await search(page, '')
  await page.getByRole('button', { name: /^Фильтры/ }).click()
  await page.getByRole('combobox', { name: 'Год', exact: true }).selectOption('2023')
  await expect(page.locator('.media-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click()
  await expect(page.locator('.media-card')).toHaveCount(8)
  await navigate(page, 'MediaShelf, главная')
  await page.keyboard.press('/')
  const input = page.getByRole('combobox', { name: 'Поиск по названию или жанру' })
  await expect(input).toBeFocused()
  await input.fill('dune')
  await expect(
    page.getByRole('listbox', { name: 'Подсказки поиска' }).getByRole('option'),
  ).toHaveCount(1)
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Дюна: Часть вторая' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(input).toBeFocused()
})

test('film has only planned and watched; public scores are separate from personal rating', async ({
  page,
}) => {
  await home(page)
  await search(page, 'dune')
  await page.getByRole('button', { name: 'Подробнее: Дюна: Часть вторая' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Добавить на полку', exact: true }).click()
  await expect(
    dialog.getByRole('group', { name: 'Статус произведения' }).getByRole('button'),
  ).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'Смотрю', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Просмотрено', exact: true }).click()
  await dialog.getByRole('button', { name: 'Оценка 9 из 10' }).click()
  await dialog.locator('.detail-information > summary').click()
  await expect(dialog.locator('.public-ratings')).toContainText('IMDb 8.3')
  await dialog.getByRole('button', { name: 'Готово', exact: true }).click()
  await page.reload()
  await navigate(page, /^Моя полка/)
  await page.locator('.card-title').click()
  await expect(page.getByRole('button', { name: 'Просмотрено', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Оценка 9 из 10' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('independent Xbox and Epic runs survive reload and deleting one preserves the other', async ({
  page,
}) => {
  await home(page)
  await search(page, 'cyberpunk')
  await page.getByRole('button', { name: 'Подробнее: Cyberpunk 2077' }).click()
  await page.getByRole('button', { name: 'Добавить на полку', exact: true }).click()
  const first = page.locator('.playthrough').first()
  await first.getByRole('combobox', { name: /^Платформа:/ }).selectOption('Xbox')
  await first.getByRole('slider').fill('80')
  await first.getByRole('button', { name: 'В планах', exact: true }).click()
  await first.getByRole('button', { name: 'Пройдено', exact: true }).click()
  await first.getByRole('button', { name: 'Играю', exact: true }).click()
  await expect(first.getByRole('slider')).toHaveValue('80')
  await page.getByRole('button', { name: 'Добавить прохождение' }).click()
  const second = page.locator('.playthrough').nth(1)
  await second.getByRole('combobox', { name: /^Магазин:/ }).selectOption('epic')
  await second.getByRole('slider').fill('25')
  await page.getByLabel('Заметка для себя', { exact: false }).fill('Разные сохранения')
  await page.locator('.detail-information > summary').click()
  await expect(page.locator('.store-offers a').first()).toContainText('Steam')
  await expect(page.locator('.store-offers a').first().locator('svg')).toHaveCount(2)
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await page.reload()
  await navigate(page, /^Моя полка/)
  await expect(page.locator('.card-run')).toHaveCount(2)
  await page.locator('.card-title').click()
  await expect(page.locator('.playthrough').first().getByRole('slider')).toHaveValue('80')
  await expect(page.locator('.playthrough').nth(1).getByRole('slider')).toHaveValue('25')
  await page.getByRole('button', { name: 'Удалить прохождение: PC / Epic Games' }).click()
  await expect(page.locator('.playthrough')).toHaveCount(2)
  await page
    .getByRole('group', { name: 'Подтверждение удаления прохождения' })
    .getByRole('button', { name: 'Отмена', exact: true })
    .click()
  await expect(page.locator('.playthrough')).toHaveCount(2)
  await page.getByRole('button', { name: 'Удалить прохождение: PC / Epic Games' }).click()
  await page.getByRole('button', { name: 'Удалить прохождение', exact: true }).click()
  await expect(page.locator('.playthrough')).toHaveCount(1)
  await expect(page.getByRole('slider')).toHaveValue('80')
  await expect(page.getByRole('button', { name: 'Пройдено', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Играю', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByLabel('Заметка для себя', { exact: false })).toHaveValue(
    'Разные сохранения',
  )
})

test('seasons, watched episodes and reviews survive refresh and remain independent', async ({
  page,
}) => {
  await home(page)
  await search(page, 'frieren')
  await page.locator('.card-title').click()
  await page.getByRole('button', { name: 'Добавить на полку', exact: true }).click()
  const watched = page.getByRole('button', { name: 'Просмотрено: сезон 1, эпизод 1', exact: true })
  await watched.click()
  await page.getByRole('button', { name: 'Отзыв: сезон 1, эпизод 1', exact: true }).click()
  await page.getByLabel('Отзыв об эпизоде 1', { exact: true }).fill('Сильное начало 🎬')
  await page.getByRole('button', { name: /^Сезон:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Сезон 2', exact: true }).click()
  await page.getByRole('button', { name: 'Отзыв: сезон 2, эпизод 1', exact: true }).click()
  await page.getByLabel('Отзыв об эпизоде 1', { exact: true }).fill('Вернуться позже')
  await page.getByRole('button', { name: 'В любимые', exact: true }).click()
  await page.getByLabel('Заметка для себя', { exact: false }).fill('Смотреть дальше')
  await page.getByRole('button', { name: 'Оценка 9 из 10' }).click()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await page.reload()
  await navigate(page, /^Моя полка/)
  await page.locator('.card-title').click()
  await expect(page.getByRole('button', { name: /^Сезон:/ })).toContainText('Сезон 2')
  await page.getByRole('button', { name: 'Отзыв: сезон 2, эпизод 1', exact: true }).click()
  await expect(page.getByLabel('Отзыв об эпизоде 1', { exact: true })).toHaveValue(
    'Вернуться позже',
  )
  await expect(
    page.getByRole('button', { name: 'Просмотрено: сезон 2, эпизод 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: /^Сезон:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Сезон 1', exact: true }).click()
  await expect(watched).toHaveAttribute('aria-pressed', 'true')
  await watched.click()
  await page.getByRole('button', { name: 'Отзыв: сезон 1, эпизод 1', exact: true }).click()
  await expect(page.getByLabel('Отзыв об эпизоде 1', { exact: true })).toHaveValue(
    'Сильное начало 🎬',
  )
  await expect(page.getByRole('button', { name: 'В любимых', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await navigate(page, 'Мой профиль')
  await expect(page.locator('.stats-numbers strong').nth(0)).toHaveText('1')
  await expect(page.locator('.stats-numbers strong').nth(3)).toContainText('9.0')
})

test('backup export and restore preserve collection; corrupt import cannot replace it', async ({
  page,
}) => {
  await home(page)
  await search(page, 'dune')
  await page.getByRole('button', { name: 'На полку: Дюна: Часть вторая' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать коллекцию', exact: true }).click()
  const json = await readFile((await (await download).path())!, 'utf8')
  expect(JSON.parse(json).version).toBe(3)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'copy.json', mimeType: 'application/json', buffer: Buffer.from(json) })
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(page.locator('.media-card')).toHaveCount(1)
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  })
  await expect(page.getByRole('alert')).toContainText('Не удалось прочитать JSON')
  await expect(page.locator('.media-card')).toHaveCount(1)
})

test('custom game board movement changes only status, and removal is confirmed', async ({
  page,
}) => {
  await home(page)
  await page.getByRole('button', { name: 'Добавить своё произведение' }).click()
  await page.getByRole('dialog').getByLabel('Категория').selectOption('game')
  await page.getByRole('dialog').getByLabel('Название', { exact: true }).fill('Тестовая история')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Добавить на полку', exact: true })
    .click()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await navigate(page, /^Моя полка/)
  await page.getByRole('button', { name: 'Доска по статусам' }).click()
  await page.getByRole('button', { name: 'Статус: Тестовая история' }).click()
  await page.getByRole('menuitem', { name: 'Пройдено', exact: true }).click()
  const completed = page.getByRole('region', { name: 'Завершено', exact: true })
  await expect(completed.locator('.board-card')).toHaveCount(1)
  await completed.getByRole('button', { name: 'Подробнее: Тестовая история' }).click()
  await expect(page.getByRole('slider')).toHaveValue('0')
  await page.getByRole('button', { name: 'Убрать произведение с полки' }).click()
  await page
    .getByRole('dialog', { name: 'Убрать с полки?' })
    .getByRole('button', { name: 'Убрать с полки', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Добавить на полку', exact: true }),
  ).toBeVisible()
})

test('roulette source and category filters select a valid result and support replay', async ({
  page,
}) => {
  await home(page)
  await navigate(page, 'Что сегодня?')
  const dialog = page.getByRole('region', { name: 'Что сегодня?' })
  await dialog.getByRole('button', { name: 'Моя библиотека', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Крутить', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Каталог', exact: true }).click()
  for (const label of ['Игры', 'Сериалы', 'Аниме'])
    await dialog.getByRole('checkbox', { name: label, exact: true }).uncheck()
  await dialog.getByRole('button', { name: 'Крутить', exact: true }).click()
  await expect(dialog.locator('.roulette-result small')).toContainText('Фильм')
  const title = await dialog.locator('.roulette-result h3').innerText()
  await dialog.getByRole('button', { name: 'Открыть', exact: true }).click()
  await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('profile choices, price filters and pinned navigation work on narrow screens', async ({
  page,
}) => {
  await home(page)
  await page.getByRole('button', { name: 'Управление коллекцией' }).click()
  await page.getByRole('menuitem', { name: 'Платформы и регион цен' }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: 'PC', exact: true }).check()
  await page
    .getByRole('dialog')
    .getByRole('checkbox', { name: 'Xbox', exact: true })
    .first()
    .check()
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await navigate(page, 'Поиск')
  await category(page, 'Игры')
  await page.getByRole('button', { name: /^Фильтры/ }).click()
  await page.getByRole('checkbox', { name: 'Со скидкой' }).check()
  await page.getByRole('combobox', { name: 'Магазин', exact: true }).selectOption('steam')
  await expect(page.locator('.media-card')).toHaveCount(8)
  await page.locator('#catalog').evaluate((e) => e.scrollIntoView())
  expect((await page.locator('.store-navigation').boundingBox())!.y).toBeGreaterThanOrEqual(0)
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 760 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    .toBe(true)
})

test('corrupt persisted data is kept intact; blocked storage retains in-memory edits', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('mediashelf-library', '{broken-original-data'),
  )
  await home(page)
  await expect(page.locator('.storage-warning')).toContainText('Исходная запись сохранена')
  await search(page, 'dune')
  await page.getByRole('button', { name: 'На полку: Дюна: Часть вторая' }).click()
  expect(await page.evaluate(() => localStorage.getItem('mediashelf-library'))).toBe(
    '{broken-original-data',
  )
  await navigate(page, /^Моя полка/)
  await expect(page.locator('.media-card')).toHaveCount(1)
})

test('clearing a search resets page one and an unavailable source offers retry', async ({
  page,
}) => {
  const requests: { q: string; page: number }[] = []
  await page.route('**/api/catalog?*', (route) => {
    const u = new URL(route.request().url()),
      q = u.searchParams.get('q') ?? '',
      number = Number(u.searchParams.get('page'))
    requests.push({ q, page: number })
    const items = Array.from({ length: q ? 1 : 16 }, (_, i) => ({
      ...fixtures[0],
      id: `steam-${q ? 9000 : number * 100 + i}`,
      title: q ? 'Результат поиска' : `Страница ${number}, игра ${i + 1}`,
      originalTitle: `Unique ${number}-${i}`,
    }))
    return route.fulfill({ json: { items, page: number, hasMore: !q && number < 3, sources: [] } })
  })
  await home(page)
  await expect(page.locator('.media-card')).toHaveCount(12)
  await page.getByRole('button', { name: 'Ещё истории', exact: true }).click()
  await expect(page.locator('.media-card')).toHaveCount(16)
  await page.getByRole('button', { name: 'Ещё истории', exact: true }).click()
  await expect(page.locator('.media-card')).toHaveCount(32)
  await search(page, 'arrival')
  await expect(page.locator('.card-title')).toHaveText('Результат поиска')
  await search(page, '')
  await expect(page.locator('.media-card')).toHaveCount(12)
  expect(requests.at(-1)).toEqual({ q: '', page: 1 })
  await page.route('**/api/catalog?*', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  )
  await search(page, 'network-failure')
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
})

test('server validates catalog region, method and metadata batch', async ({ request }) => {
  expect((await request.get('/api/health')).status()).toBe(200)
  expect((await request.get('/api/catalog?type=unknown')).status()).toBe(400)
  expect((await request.get('/api/catalog?country=INVALID')).status()).toBe(400)
  expect((await request.get('/api/catalog?page=-1')).status()).toBe(400)
  expect((await request.post('/api/catalog')).status()).toBe(405)
  expect(
    (await request.post('/api/details?country=US', { data: [{ id: 'not-a-work' }] })).status(),
  ).toBe(400)
  expect(
    (
      await request.post('/api/episodes', { data: [fixtures.find((i) => i.type === 'game')] })
    ).status(),
  ).toBe(400)
})

test('preview has usable close, focus return and stable poster bounds', async ({
  page,
  isMobile,
}) => {
  await home(page)
  await search(page, 'cyberpunk')
  await page.locator('.card-title').click()
  await page.getByRole('button', { name: 'Добавить на полку', exact: true }).click()
  await page.getByRole('button', { name: 'Оценка 8 из 10' }).click()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  const card = page.locator('.media-card').first()
  const trigger = card.getByRole('button', { name: /^Предпросмотр:/ })
  const size = await card.locator('.card-art-wrap').boundingBox()
  if (!isMobile) {
    await card.locator('.poster-stage').hover()
    await expect(card.locator('.media-preview')).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(card.locator('.media-preview')).toHaveCount(0)
  }
  await trigger.click()
  await expect(card.locator('.preview-picture img')).toBeVisible()
  await card.getByRole('button', { name: 'Следующий кадр' }).click()
  await expect(card.locator('.preview-navigation')).toContainText('2 / 2')
  await card.getByRole('button', { name: 'Закрыть предпросмотр' }).click()
  await expect(trigger).toBeFocused()
  expect((await card.locator('.card-art-wrap').boundingBox())?.height).toBe(size?.height)
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(card.locator('.media-preview')).toHaveCount(0)
  await trigger.click()
  await page.locator('#catalog h2').click()
  await expect(card.locator('.media-preview')).toHaveCount(0)
})

test('legacy episodes migrate explicitly; manual additions survive remote refresh and offline errors', async ({
  page,
}) => {
  const show = catalog.find((i) => i.id === 'anime-frieren')!
  const old = updateLibraryEntry(show, createEntry(show, 0), {
    progress: 2,
    notes: 'Прежняя заметка',
  })
  await home(page)
  await page.evaluate(
    (data) =>
      localStorage.setItem('mediashelf-library', JSON.stringify({ state: data, version: 0 })),
    {
      entries: { [show.id]: old },
      customItems: [],
    },
  )
  await page.reload()
  await navigate(page, /^Моя полка/)
  await page.locator('.card-title').click()
  await expect(page.locator('.legacy-progress')).toContainText('2 эпизодов')
  await expect(
    page.getByRole('button', { name: 'Просмотрено: сезон 1, эпизод 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Распределить по первым эпизодам' }).click()
  await expect(page.locator('.legacy-progress')).toHaveCount(0)
  await page.getByRole('button', { name: 'Добавить эпизод вручную' }).click()
  const form = page.locator('.episode-manual-form')
  await form.getByLabel('Сезон', { exact: true }).fill('3')
  await form.getByLabel('Номер', { exact: true }).fill('1')
  await form.getByLabel('Название', { exact: true }).fill('Мой эпизод 日本語')
  await form.getByRole('button', { name: 'Добавить эпизод', exact: true }).click()
  await page.getByRole('button', { name: 'Отзыв: сезон 3, эпизод 1', exact: true }).click()
  await page.getByLabel('Отзыв об эпизоде 1', { exact: true }).fill('Личная запись')
  await page.reload()
  await navigate(page, /^Моя полка/)
  await page.locator('.card-title').click()
  await expect(page.locator('.episode-name')).toContainText('Мой эпизод 日本語')
  await page.getByRole('button', { name: 'Отзыв: сезон 3, эпизод 1', exact: true }).click()
  await expect(page.getByLabel('Отзыв об эпизоде 1', { exact: true })).toHaveValue('Личная запись')
  await page.keyboard.press('Escape')
  await page.route('**/api/episodes?*', (route) =>
    route.fulfill({ status: 503, json: { error: 'offline' } }),
  )
  await page.locator('.card-title').click()
  await expect(page.locator('.episode-panel .inline-error')).toBeVisible()
  await expect(page.locator('.episode-name')).toContainText('Мой эпизод 日本語')
  await page.getByRole('button', { name: 'Просмотрено: сезон 3, эпизод 1', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Просмотрено: сезон 3, эпизод 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
})

test('unmarked games remain reachable on the board', async ({ page }) => {
  await home(page)
  await search(page, 'cyberpunk')
  await page.locator('.card-title').click()
  await page.getByRole('button', { name: 'Добавить на полку', exact: true }).click()
  await page.locator('.playthrough').getByRole('button', { name: 'В планах', exact: true }).click()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await navigate(page, /^Моя полка/)
  await page.getByRole('button', { name: 'Доска по статусам' }).click()
  await expect(
    page.getByRole('region', { name: 'Без отметок' }).locator('.board-card'),
  ).toHaveCount(1)
  await page.getByRole('button', { name: 'Статус: Cyberpunk 2077' }).click()
  await page.getByRole('menuitem', { name: 'Играю', exact: true }).click()
  await expect(page.locator('.board-unassigned')).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'В процессе', exact: true }).locator('.board-card'),
  ).toHaveCount(1)
})

test('custom sorting, fixed search and text scaling retain keyboard access', async ({ page }) => {
  await home(page)
  await navigate(page, 'Поиск')
  const trigger = page.getByRole('button', { name: /^Сортировка:/ })
  await trigger.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(trigger).toBeFocused()
  await expect(trigger).not.toContainText('По популярности')
  await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }))
  await expect(page.locator('.app-shell')).toHaveClass(/header-hidden/)
  await expect.poll(async () => (await page.locator('.store-navigation').boundingBox())!.y).toBe(0)
  await page.evaluate(() => window.scrollBy({ top: -100, behavior: 'instant' }))
  await expect(page.locator('.app-shell')).not.toHaveClass(/header-hidden/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.documentElement.style.fontSize = '200%'
  })
  await expect
    .poll(() => page.locator('.primary-nav').evaluate((e) => e.scrollWidth <= e.clientWidth + 1))
    .toBe(true)
  await page.getByRole('button', { name: 'Управление коллекцией' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  expect(
    (await page.locator('.skip-link').boundingBox())!.y +
      (await page.locator('.skip-link').boundingBox())!.height,
  ).toBeLessThan(0)
  await navigate(page, 'Мой профиль')
  await expect(page.locator('.stats-view')).toBeVisible()
})

test('enlarged text preserves header actions and a compact missing poster', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await home(page)
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll('body *')].filter(
      (e): e is HTMLElement => e instanceof HTMLElement && !['SCRIPT', 'STYLE'].includes(e.tagName),
    )
    const sizes = elements.map((e) => ({ e, size: parseFloat(getComputedStyle(e).fontSize) }))
    for (const { e, size } of sizes) e.style.setProperty('font-size', `${size * 2}px`, 'important')
  })
  await page.getByRole('button', { name: 'Управление коллекцией' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await page.getByRole('button', { name: 'Добавить своё произведение' }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Название', { exact: true })
    .fill('Личная история '.repeat(10).trim())
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Добавить на полку', exact: true })
    .click()
  await expect(page.locator('.detail-poster-side .poster-fallback-icon')).toBeVisible()
  await expect(page.locator('.detail-poster-side .poster-fallback strong')).not.toBeVisible()
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
})

test('separate pages support direct links, reload and browser history without losing search or collection', async ({
  page,
}) => {
  await home(page)
  await expect(page.getByRole('heading', { name: 'Чарты', exact: true })).toBeVisible()
  await expect(page.locator('.global-search')).toHaveCount(0)
  await expect(
    page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link'),
  ).toHaveCount(5)
  await navigate(page, 'Поиск')
  await category(page, 'Фильмы')
  await search(page, 'dune')
  await page.getByRole('button', { name: /^Фильтры/ }).click()
  await page.getByRole('combobox', { name: 'Год', exact: true }).selectOption('2024')
  await page.getByRole('button', { name: 'На полку: Дюна: Часть вторая' }).click()
  const searchUrl = page.url()
  await navigate(page, /^Моя полка/)
  await expect(page).toHaveURL(/\/library$/)
  await expect(page.locator('.media-card')).toHaveCount(1)
  await page.goBack()
  await expect(page).toHaveURL(searchUrl)
  await expect(page.getByRole('combobox', { name: 'Поиск по названию или жанру' })).toHaveValue(
    'dune',
  )
  await expect(page.locator('.card-title')).toHaveText('Дюна: Часть вторая')
  await page.reload()
  await expect(page.locator('.cinema-stage')).toHaveCount(0)
  await expect(page.locator('.card-title')).toHaveText('Дюна: Часть вторая')
  await page.getByRole('button', { name: /^Фильтры/ }).click()
  await expect(page.getByRole('combobox', { name: 'Год', exact: true })).toHaveValue('2024')
  await page.goForward()
  await expect(page).toHaveURL(/\/library$/)
  await expect(page.locator('.media-card')).toHaveCount(1)
  await page.goto('/today')
  await page.getByRole('button', { name: 'Крутить', exact: true }).click()
  await expect(page.locator('.roulette-result h3')).toHaveText('Дюна: Часть вторая')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Что сегодня?', exact: true })).toBeVisible()
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Мой профиль', exact: true })).toBeVisible()
  await expect(page.locator('.stats-numbers strong').first()).toHaveText('1')
  await page.goto('/missing-page')
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
  await page.getByRole('link', { name: 'Открыть чарты' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('five-page navigation stays within the viewport at all supported widths', async ({ page }) => {
  await home(page)
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const name of ['Поиск', 'Моя полка', 'Что сегодня?', 'Мой профиль', 'Чарты']) {
      await navigate(page, name)
      await expect(
        page
          .getByRole('navigation', { name: 'Основная навигация' })
          .getByRole('link', { name, exact: true }),
      ).toHaveAttribute('aria-current', 'page')
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        .toBe(true)
    }
  }
})

test('charts keep source ratings, independent poster controls and numbered categories', async ({
  page,
}) => {
  await home(page)
  await category(page, 'Фильмы')
  const card = page
    .locator('.chart-card')
    .filter({ has: page.getByRole('button', { name: 'Дюна: Часть вторая', exact: true }) })
  await expect(page.locator('.chart-position')).toHaveText([
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
  ])
  await expect(card.locator('.public-ratings')).toContainText('IMDb 8.3')
  await card.getByRole('button', { name: 'На полку: Дюна: Часть вторая', exact: true }).click()
  await expect(
    card.getByRole('button', { name: 'На твоей полке: Дюна: Часть вторая', exact: true }),
  ).toBeVisible()
  await card
    .getByRole('button', { name: 'На твоей полке: Дюна: Часть вторая', exact: true })
    .click()
  await page.getByRole('button', { name: 'Оценка 9 из 10' }).click()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await expect(card.locator('.public-ratings')).toContainText('IMDb 8.3')
  const preview = card.getByRole('button', {
    name: 'Предпросмотр: Дюна: Часть вторая',
    exact: true,
  })
  await preview.click()
  await card.getByRole('button', { name: 'Закрыть предпросмотр', exact: true }).click()
  await expect(preview).toBeFocused()
  await card.getByRole('button', { name: 'В избранное: Дюна: Часть вторая', exact: true }).click()
  await expect(
    card.getByRole('button', { name: 'Убрать из избранного: Дюна: Часть вторая', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Хиты всех времён', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Хиты всех времён', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    page
      .getByRole('group', { name: 'Категории чартов' })
      .getByRole('button', { name: 'Фильмы', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    card.getByRole('button', { name: 'На твоей полке: Дюна: Часть вторая', exact: true }),
  ).toBeVisible()
})

test('charts expose loading and recover from failed or empty sources', async ({ page }) => {
  let response: 'error' | 'empty' | 'items' = 'error'
  await page.route('**/api/catalog?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450))
    await route.fulfill(
      response === 'error'
        ? { status: 503, json: { error: 'offline' } }
        : {
            json: {
              items: response === 'items' ? fixtures : [],
              sources: [],
              page: 1,
              hasMore: false,
            },
          },
    )
  })
  await home(page)
  await expect(page.getByRole('status', { name: 'Загрузка чартов' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить чарты' })).toBeVisible()
  response = 'empty'
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'В этой подборке пока пусто' })).toBeVisible()
  response = 'items'
  await category(page, 'Игры')
  await expect(page.locator('.chart-card')).toHaveCount(12)
  await expect(page.locator('#catalog')).toHaveAttribute('aria-busy', 'false')
})
