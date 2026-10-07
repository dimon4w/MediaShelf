import { expect, test } from '@playwright/test'
import type { LibraryEntry } from '../../shared/types.ts'
import { api, openTitle, register } from './helpers.ts'

test('search, add a series and track episodes with automatic status', async ({ page }) => {
  await register(page)
  await page.goto('/discover')
  await page.getByRole('searchbox', { name: 'Поиск' }).fill('во все')
  await page
    .getByRole('link', { name: /Во все тяжкие/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Во все тяжкие' })).toBeVisible()

  await page.getByTestId('add-to-library').click()
  await expect(page.getByTestId('status-button')).toContainText('Хочу посмотреть')

  await page.getByRole('checkbox', { name: /S1 · E1/ }).click()
  await expect(page.getByTestId('status-button')).toContainText('Смотрю')
  await expect(page.getByText('Просмотрено 1 из 12')).toBeVisible()

  await page.getByRole('button', { name: 'Отметить сезон' }).click()
  await expect(page.getByText('Просмотрено 6 из 12')).toBeVisible()
  await expect(page.getByText('S2 · E1').first()).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Продолжить' })).toBeVisible()
  await page.getByRole('button', { name: '+1 серия' }).click()
  await expect(page.getByText('S2 · E2').first()).toBeVisible()
})

test('movies: watched, rating, favourite, notes and removal', async ({ page }) => {
  await register(page)
  await openTitle(page, 'movie-tt1375666')
  await page.getByRole('button', { name: 'Добавить как…' }).click()
  await page.getByRole('menuitemradio', { name: 'Просмотрено' }).click()
  await expect(page.getByTestId('status-button')).toContainText('Просмотрено')

  await page.getByTestId('status-button').click()
  await expect(page.getByRole('menuitemradio')).toHaveCount(2)
  await page.keyboard.press('Escape')

  await page.getByTestId('rating-button').click()
  await page.getByRole('radio', { name: '9 из 10', exact: true }).first().click()
  await expect(page.getByTestId('rating-button')).toContainText('9/10')

  await page.getByRole('button', { name: 'В избранное' }).first().click()
  await expect(page.getByRole('button', { name: 'Убрать из избранного' }).first()).toBeVisible()

  await page.getByRole('textbox', { name: 'Заметки' }).fill('Пересмотреть в IMAX')
  await page.getByRole('textbox', { name: 'Заметки' }).blur()
  await expect(page.getByText('Заметка сохранена')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Заметки' })).toHaveValue('Пересмотреть в IMAX')

  await page.getByRole('button', { name: 'Удалить из библиотеки' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByTestId('add-to-library')).toBeVisible()
})

test('games: progress, hours and extra playthroughs', async ({ page }) => {
  await register(page)
  await openTitle(page, 'steam-292030')
  await page.getByTestId('add-to-library').click()
  await expect(page.getByRole('heading', { name: 'Прохождения' })).toBeVisible()
  await page.getByLabel('Часов в игре').fill('42,5')
  await page.getByLabel('Часов в игре').press('Enter')
  await page.getByRole('slider', { name: 'Прогресс' }).first().focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('PageUp')
  await expect(page.getByTestId('status-button')).toContainText('Играю')

  await page.getByRole('button', { name: 'Добавить прохождение' }).click()
  await expect(page.getByLabel('Название')).toHaveCount(1)
  const entry = await api<{ entry: LibraryEntry }>(page, 'GET', '/library/steam-292030')
  expect(entry.body.entry.hours).toBe(42.5)
  expect(entry.body.entry.progress).toBeGreaterThan(0)
  expect(entry.body.entry.playthroughs).toHaveLength(1)
})

test('library views, filters and board', async ({ page }) => {
  await register(page)
  for (const [titleId, status] of [
    ['movie-tt0111161', 'completed'],
    ['series-tt0944947', 'in_progress'],
    ['anime-5114', 'planned'],
    ['steam-367520', 'paused'],
  ])
    expect((await api(page, 'POST', '/library', { titleId, status })).status).toBe(201)

  await page.goto('/library')
  await expect(
    page.getByRole('main').getByRole('link', { name: /Побег из Шоушенка/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: /^Аниме/ }).click()
  await expect(page).toHaveURL(/kind=anime/)
  await expect(page.getByRole('main').getByRole('link', { name: /Стальной алхимик/ })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: /Побег из Шоушенка/ })).toHaveCount(
    0,
  )

  await page.getByRole('button', { name: /^Все/ }).first().click()
  await page.getByRole('radio', { name: 'Список' }).click()
  await expect(page.getByText('Изменено')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Искать в библиотеке' }).fill('игра')
  await expect(page.getByRole('main').getByRole('link', { name: /Игра престолов/ })).toBeVisible()

  await page.getByRole('radio', { name: 'Доска' }).click()
  for (const column of ['В процессе', 'В планах', 'Отложено', 'Завершено', 'Брошено'])
    await expect(page.getByRole('region', { name: column })).toBeVisible()

  // Keyboard: the handle picks a card up, arrows carry it to the next column, Space drops it.
  await page.getByRole('button', { name: 'Переместить «Игра престолов»' }).focus()
  // Each step waits for the localized live-region announcement, as a screen reader user would.
  await page.keyboard.press('Space')
  await expect(page.getByText('Карточка «Игра престолов» взята.')).toBeAttached()
  // dnd-kit attaches its arrow-key listener one macrotask after pickup.
  await page.waitForTimeout(100)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('«Игра престолов» над колонкой «В планах».')).toBeAttached()
  await page.keyboard.press('Space')
  await expect(page.getByText('«Игра престолов» перемещена в колонку «В планах».')).toBeAttached()
  await expect
    .poll(
      async () =>
        (await api<{ entry: { status: string } }>(page, 'GET', '/library/series-tt0944947')).body
          .entry.status,
    )
    .toBe('planned')

  // Enter on the card itself opens the title instead of starting a drag.
  await page
    .getByRole('main')
    .getByRole('link', { name: /Игра престолов/ })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/title\/series-tt0944947/)
})

test('command palette finds and adds titles', async ({ page }) => {
  await register(page)
  await page.keyboard.press('Control+K')
  await page.getByPlaceholder('Поиск по библиотеке и каталогу…').fill('шерлок')
  await page.getByRole('option', { name: /Шерлок/ }).click()
  await expect(page).toHaveURL(/\/title\/series-tt1475582/)

  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByPlaceholder('Найдите игру, фильм, сериал или аниме…').fill('паразиты')
  await page.getByRole('option', { name: /Паразиты/ }).click()
  await expect(page.getByText('Добавлено в библиотеку')).toBeVisible()
})

test('shuffle picks from the catalog and can add to plans', async ({ page }) => {
  await register(page)
  await page.goto('/shuffle')
  await page.getByRole('radio', { name: 'Популярное' }).click()
  await page.getByTestId('shuffle-roll').click()
  await expect(page.getByRole('button', { name: 'В планы' })).toBeVisible()
  await page.getByRole('button', { name: 'В планы' }).click()
  await expect(page.getByText('Добавлено в библиотеку')).toBeVisible()
  await expect(page.getByTestId('shuffle-roll')).toContainText('Ещё раз')
})
