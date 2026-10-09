import { expect, test } from '@playwright/test'
import { api, expectNoHorizontalOverflow, register } from './helpers.ts'

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

test('mobile layout: profile page fits the screen', async ({ page }) => {
  await register(page, 'Константинопольский')
  // A long two-word name must truncate inside the glass card, never wrap or overflow.
  const name = 'Константинопольский Александрович-Петровский'
  expect((await api(page, 'PATCH', '/me', { name })).status).toBe(200)
  const session = await api<{ user: { id: string } }>(page, 'GET', '/auth/session')
  await page.goto(`/users/${session.body.user.id}`)
  const heading = page.getByRole('heading', { level: 1, name })
  await expect(heading).toBeVisible()
  const box = await heading.boundingBox()
  expect(box?.height ?? 0).toBeLessThan(60)
  await expectNoHorizontalOverflow(page)
})
