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

test('mobile layout: profile page fits every phone width in both themes', async ({ page }) => {
  await register(page, 'Константинопольский')
  // A long two-word name must truncate, never wrap or overflow.
  const name = 'Константинопольский Александрович-Петровский'
  expect((await api(page, 'PATCH', '/me', { name })).status).toBe(200)
  const session = await api<{ user: { id: string } }>(page, 'GET', '/auth/session')
  const url = `/users/${session.body.user.id}`

  const check = async () => {
    const heading = page.getByRole('heading', { level: 1, name })
    await expect(heading).toBeVisible()
    expect((await heading.boundingBox())?.height ?? 0).toBeLessThan(60)
    // Buttons and chips stay on one line.
    for (const button of await page.locator('main a[href="/settings/profile"], main button').all())
      if (await button.isVisible())
        expect((await button.boundingBox())?.height ?? 0).toBeLessThan(48)
    await expectNoHorizontalOverflow(page)
  }

  // Empty library: the onboarding card and Top-4 slots.
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Собери свою полку' })).toBeVisible()
  for (const width of [320, 360, 393, 412])
    for (const colorScheme of ['dark', 'light'] as const) {
      await page.setViewportSize({ width, height: 800 })
      await page.emulateMedia({ colorScheme })
      await check()
    }

  // A filled library: stats strip, Top-4, Now.
  for (const [titleId, status] of [
    ['series-tt0903747', 'completed'],
    ['steam-292030', 'in_progress'],
    ['anime-52991', 'completed'],
  ] as const)
    await api(page, 'POST', '/library', { titleId, status, favorite: true, rating: 9 })
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Топ-4' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Сейчас' })).toBeVisible()
  for (const width of [320, 360, 393, 412]) {
    await page.setViewportSize({ width, height: 800 })
    await check()
  }
})
