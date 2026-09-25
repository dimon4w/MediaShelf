import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 4190)

// Runs against the production build with the offline fixture catalog and an in-memory database.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'ru-RU',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: 'node server/main.ts',
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(port),
      HOST: '127.0.0.1',
      CATALOG_MODE: 'fixtures',
      DB_FILE: ':memory:',
      DISABLE_RATE_LIMITS: '1',
    },
  },
})
