import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow, register } from './helpers.ts'

test('mobile layout: tab bar navigation and no horizontal overflow', async ({ page }) => {
  await register(page)
  const tabs = page.getByRole('navigation', { name: 'Меню' })
  for (const [label, path] of [
    ['Обзор', '/discover'],
    ['Библиотека', '/library'],
    ['Жребий', '/shuffle'],
    ['Статистика', '/stats'],
    ['Главная', '/'],
  ]) {
    await tabs.getByRole('link', { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}`))
    await expectNoHorizontalOverflow(page)
  }
  for (const id of ['series-tt0903747', 'steam-292030', 'anime-52991']) {
    await page.goto(`/title/${id}`)
    await expect(page.locator('main h1').last()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})
