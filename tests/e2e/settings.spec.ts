import { expect, test } from '@playwright/test'
import type { User } from '../../shared/types.ts'
import { api, register } from './helpers.ts'

test('language and theme persist to the account', async ({ page }) => {
  await register(page)
  await page.getByRole('button', { name: 'Аккаунт' }).click()
  await page.getByRole('menuitem', { name: 'Язык' }).hover()
  await page.getByRole('menuitemradio', { name: 'English' }).click()
  await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Theme' }).hover()
  await page.getByRole('menuitemradio', { name: 'Light' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  await expect
    .poll(
      async () => (await api<{ user: User }>(page, 'GET', '/auth/session')).body.user.preferences,
    )
    .toMatchObject({ locale: 'en', theme: 'light' })

  // A fresh browser picks the account's preferences up after sign-in.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('stats and settings pages render for a signed-in user', async ({ page }) => {
  await register(page)
  await api(page, 'POST', '/library', {
    titleId: 'movie-tt0068646',
    status: 'completed',
    rating: 10,
  })
  await page.goto('/stats')
  await expect(page.getByRole('heading', { name: 'Статистика' }).first()).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Настройки' }).first()).toBeVisible()
  await page.goto('/settings/security')
  await expect(page.getByText('Это устройство')).toBeVisible()
})
