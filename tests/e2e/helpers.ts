import { expect, type Page } from '@playwright/test'

let counter = 0

export async function register(page: Page, name = 'Дмитрий') {
  const email = `user${Date.now()}${counter++}@example.com`
  await page.goto('/register')
  await page.getByLabel('Имя').fill(name)
  await page.getByLabel('Эл. почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill('correct-horse-42')
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible()
  return { email, password: 'correct-horse-42' }
}

export async function openTitle(page: Page, id: string) {
  await page.goto(`/title/${id}`)
  await expect(page.locator('main h1').last()).toBeVisible()
}

export async function api<T = Record<string, never>>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ([method, path, body]) => {
      const response = await fetch(`/api${path}`, {
        method: method as string,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
      })
      return { status: response.status, body: await response.json().catch(() => null) }
    },
    [method, path, body] as const,
  )
}

/** No element may push the page wider than the viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}
