import { expect, test } from '@playwright/test'
import { register } from './helpers.ts'

test('registration validates input and signs the user in', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText('Обязательное поле').first()).toBeVisible()
  await page.getByLabel('Эл. почта').fill('not-an-email')
  await page.getByLabel('Пароль', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText('Введите корректную почту')).toBeVisible()
  await expect(page.getByText('Минимум 8 символов')).toBeVisible()

  await register(page, 'Анна')
  await expect(page.getByText('Ваша библиотека пока пуста')).toBeVisible()
})

test('sign out, wrong password, sign in and return to the requested page', async ({ page }) => {
  const { email, password } = await register(page)
  await page.getByRole('button', { name: 'Аккаунт' }).click()
  await page.getByRole('menuitem', { name: 'Выйти' }).click()
  await expect(page.getByRole('link', { name: 'Войти' }).first()).toBeVisible()

  await page.goto('/library')
  await expect(page).toHaveURL(/\/login\?next=%2Flibrary/)
  await page.getByLabel('Эл. почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('alert')).toContainText('Неверная почта или пароль')

  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByText('Библиотека пуста')).toBeVisible()
})

test('guests can browse but must sign in to save', async ({ page }) => {
  await page.goto('/title/series-tt0903747')
  await expect(page.getByRole('heading', { name: 'Во все тяжкие' })).toBeVisible()
  await page.getByTestId('add-to-library').click()
  await expect(page).toHaveURL(/\/login\?next=/)
})
