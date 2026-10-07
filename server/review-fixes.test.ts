import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { computeStats } from './library/stats.ts'
import { staticFiles } from './static.ts'
import { sampleTitles, testApp, registerAccount } from './test-utils.ts'

const account = { name: 'Дима', email: 'dima@example.com', password: 'correct horse battery' }

async function signedIn(email = account.email, t = testApp()) {
  expect((await registerAccount(t, { ...account, email })).status).toBe(201)
  return t
}

describe('import isolation', () => {
  it('keeps imported metadata away from other users and rejects foreign images', async () => {
    const t = await signedIn()
    const forged = {
      format: 'mediashelf',
      version: 4,
      entries: [
        {
          titleId: 'steam-1145360',
          status: 'planned',
          title: {
            id: 'steam-1145360',
            kind: 'game',
            names: { original: 'FORGED', ru: 'ПОДДЕЛКА' },
            year: 2020,
            poster: 'https://tracker.example/pixel.gif',
            backdrop: null,
            genres: [],
            ratings: [],
            externalIds: {},
          },
        },
      ],
    }
    expect((await t.request('POST', '/api/me/import', forged)).body).toEqual({
      imported: 1,
      skipped: 0,
    })
    const mine = (await t.request('GET', '/api/library')).body.entries[0]
    expect(mine.title.poster).toBeNull()

    t.clearCookie()
    await signedIn('other@example.com', t)
    const added = await t.request('POST', '/api/library', { titleId: 'steam-1145360' })
    expect(added.body.entry.title.names).toEqual({ original: 'Hades' })
    const details = await t.request('GET', '/api/titles/steam-1145360?lang=ru')
    expect(details.body.title.names.ru).toBeUndefined()
  })

  it('does not let an import exceed the library limit silently', async () => {
    const t = await signedIn()
    const result = await t.request('POST', '/api/me/import', {
      format: 'mediashelf',
      version: 4,
      entries: [{}],
    })
    expect(result.body).toEqual({ imported: 0, skipped: 1 })
  })
})

describe('series completion undo', () => {
  it('removes only the marks that completing added', async () => {
    const t = await signedIn()
    await t.request('POST', '/api/library', { titleId: 'series-tt0903747' })
    await t.request('POST', '/api/library/series-tt0903747/episodes', {
      episodes: [{ season: 1, number: 1 }],
      watched: true,
    })
    const done = await t.request('PATCH', '/api/library/series-tt0903747', { status: 'completed' })
    expect(done.body.entry.watchedEpisodes).toBe(4)
    const undone = await t.request('PATCH', '/api/library/series-tt0903747', {
      status: 'in_progress',
    })
    expect(undone.body.entry).toMatchObject({ watchedEpisodes: 1, progress: 25 })
    expect(undone.body.entry.nextEpisode).toMatchObject({ season: 1, number: 2 })
  })
})

describe('account safety', () => {
  it('requires the current password to change the email', async () => {
    const t = await signedIn()
    const without = await t.request('PATCH', '/api/me', { email: 'new@example.com' })
    expect(without.status).toBe(400)
    expect(without.body.error.fields).toEqual({ currentPassword: 'required' })
    const wrong = await t.request('PATCH', '/api/me', {
      email: 'new@example.com',
      currentPassword: 'nope',
    })
    expect(wrong.body.error.fields).toEqual({ currentPassword: 'wrong_password' })
    const ok = await t.request('PATCH', '/api/me', {
      email: 'new@example.com',
      currentPassword: account.password,
    })
    expect(ok.body.user.email).toBe('new@example.com')
    const nameOnly = await t.request('PATCH', '/api/me', {
      name: 'Дмитрий',
      email: 'NEW@example.com',
    })
    expect(nameOnly.status).toBe(200)
  })

  it('rejects cross-site requests flagged by Sec-Fetch-Site', async () => {
    const t = await signedIn()
    const res = await t.request(
      'POST',
      '/api/library',
      { titleId: 'steam-1145360' },
      {
        Origin: '',
        'Sec-Fetch-Site': 'cross-site',
      },
    )
    expect(res.status).toBe(403)
  })
})

describe('stats time zones', () => {
  it('buckets completions by the user calendar, not UTC', async () => {
    const t = await signedIn()
    await t.request('POST', '/api/library', { titleId: 'series-tt0903747', status: 'completed' })
    // 2026-01-31 22:30 UTC is already February in Chisinau (UTC+2).
    const finishedAt = '2026-01-31T22:30:00.000Z'
    await t.request('PATCH', '/api/library/series-tt0903747', { finishedAt, startedAt: finishedAt })
    const user = (await t.request('GET', '/api/auth/session')).body.user
    const local = computeStats(t.db, user.id, { timeZone: 'Europe/Chisinau' })
    const utc = computeStats(t.db, user.id, { timeZone: 'UTC' })
    const month = (stats: typeof local, key: string) =>
      stats.completedByMonth.find((m) => m.month === key)?.count
    if (local.completedByMonth.some((m) => m.month === '2026-02'))
      expect(month(local, '2026-02')).toBe(1)
    if (utc.completedByMonth.some((m) => m.month === '2026-01'))
      expect(month(utc, '2026-01')).toBe(1)
    expect(computeStats(t.db, user.id, { timeZone: 'Not/AZone' }).total).toBe(1)
  })
})

describe('static files', () => {
  it('serves the SPA and blocks traversal', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mediashelf-dist-'))
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>ok</title>')
    const app = new Hono()
    app.use('*', staticFiles(root))
    expect(await (await app.request('http://localhost/library')).text()).toContain('ok')
    // Encoded dot segments are normalised by the URL parser, so this can only reach the SPA.
    const traversal = await app.request('http://localhost/%2e%2e/%2e%2e/etc/passwd')
    expect(await traversal.text()).toContain('<title>ok</title>')
    expect((await app.request('http://localhost/%E0%A4%A')).status).toBe(400)
    expect((await app.request('http://localhost/missing.js')).status).toBe(404)
  })
})

describe('streaks for imported libraries', () => {
  it('counts dated records even without an activity log', async () => {
    const t = await signedIn()
    const day = (d: number) => `2025-03-${String(d).padStart(2, '0')}T12:00:00.000Z`
    const entries = sampleTitles.map((title, i) => ({
      titleId: title.id,
      title,
      status: 'completed',
      addedAt: day(10 + i),
      finishedAt: day(10 + i),
    }))
    const imported = await t.request('POST', '/api/me/import', {
      format: 'mediashelf',
      version: 4,
      entries,
    })
    expect(imported.body).toMatchObject({ imported: 3, skipped: 0 })
    const user = (await t.request('GET', '/api/auth/session')).body.user
    t.db.prepare('DELETE FROM activity WHERE user_id = ?').run(user.id)
    expect(computeStats(t.db, user.id, { timeZone: 'UTC' }).longestStreakDays).toBe(3)
  })
})

describe('login throttling', () => {
  it('locks an account after repeated failures and resets after a success', async () => {
    const t = testApp(undefined, { limits: true })
    expect((await registerAccount(t, account)).status).toBe(201)
    t.clearCookie()
    const attempt = (password: string) =>
      t.request('POST', '/api/auth/login', { email: account.email, password })
    for (let i = 0; i < 9; i++) expect((await attempt('wrong password!')).status).toBe(401)
    expect((await attempt(account.password)).status).toBe(200)
    for (let i = 0; i < 10; i++) expect((await attempt('wrong password!')).status).toBe(401)
    const blocked = await attempt(account.password)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
  }, 30_000)
})

describe('session lifetime', () => {
  it('slides the expiry of an active session and rejects expired ones', async () => {
    const t = await signedIn()
    const now = Date.now()
    t.db
      .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ?')
      .run(now - 2 * 3_600_000, now + 60_000)
    const refreshed = await t.request('GET', '/api/auth/session')
    expect(refreshed.body.user?.email).toBe(account.email)
    const row = t.db.prepare('SELECT expires_at FROM sessions').get() as { expires_at: number }
    expect(row.expires_at).toBeGreaterThan(now + 24 * 3_600_000)

    t.db.prepare('UPDATE sessions SET expires_at = ?').run(now - 1)
    expect((await t.request('GET', '/api/auth/session')).body.user).toBeNull()
    expect((await t.request('GET', '/api/library')).status).toBe(401)
  })
})
