import { describe, expect, it } from 'vitest'
import { registerAccount, testApp } from './test-utils.ts'

const account = { name: 'Дима', email: 'Dima@Example.com', password: 'correct horse battery' }

async function signedIn() {
  const t = testApp()
  const res = await registerAccount(t, account)
  expect(res.status).toBe(201)
  return t
}

describe('auth', () => {
  it('registers, reads the session, logs out and logs back in', async () => {
    const t = testApp()
    const anonymous = await t.request('GET', '/api/auth/session')
    expect(anonymous.body).toEqual({ user: null, registrationOpen: true })

    const registered = await registerAccount(t, account)
    expect(registered.status).toBe(201)
    expect(registered.body.user.email).toBe('Dima@Example.com')
    expect(registered.headers.get('set-cookie')).toMatch(/ms_session=.+HttpOnly/i)

    const session = await t.request('GET', '/api/auth/session')
    expect(session.body.user.name).toBe('Дима')

    expect((await t.request('POST', '/api/auth/logout', {})).status).toBe(200)
    expect((await t.request('GET', '/api/auth/session')).body.user).toBeNull()

    const wrong = await t.request('POST', '/api/auth/login', {
      email: 'dima@example.com',
      password: 'nope-nope',
    })
    expect(wrong.status).toBe(401)
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS')

    const ok = await t.request('POST', '/api/auth/login', {
      email: ' DIMA@example.com ',
      password: account.password,
    })
    expect(ok.status).toBe(200)
    expect((await t.request('GET', '/api/auth/session')).body.user.email).toBe('Dima@Example.com')
  })

  it('rejects duplicate emails and weak input with field codes', async () => {
    const t = await signedIn()
    const duplicate = await t.request('POST', '/api/auth/register/start', {
      ...account,
      email: 'dima@example.com',
    })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.fields).toEqual({ email: 'taken' })
    const invalid = await t.request('POST', '/api/auth/register/start', {
      name: '',
      email: 'x',
      password: '123',
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.fields).toMatchObject({
      name: 'required',
      email: 'email',
      password: 'password_short',
    })
  })

  it('verifies email codes: wrong code fails, resend is throttled, then it succeeds', async () => {
    const t = testApp()
    const start = await t.request('POST', '/api/auth/register/start', {
      ...account,
      email: 'coded@example.com',
    })
    expect(start.status).toBe(202)
    expect(start.body.devCode).toMatch(/^\d{6}$/)

    const missing = await t.request('POST', '/api/auth/register/verify', {
      email: 'nobody@example.com',
      code: '123456',
    })
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('NO_PENDING')

    const wrong = await t.request('POST', '/api/auth/register/verify', {
      email: 'coded@example.com',
      code: '000000',
    })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.code).toBe('CODE_WRONG')

    const soon = await t.request('POST', '/api/auth/register/resend', {
      email: 'coded@example.com',
    })
    expect(soon.status).toBe(429)
    expect(soon.body.error.code).toBe('RESEND_TOO_SOON')

    const done = await t.request('POST', '/api/auth/register/verify', {
      email: 'coded@example.com',
      code: start.body.devCode,
    })
    expect(done.status).toBe(201)
    expect(done.body.user.email).toBe('coded@example.com')

    const reused = await t.request('POST', '/api/auth/register/verify', {
      email: 'coded@example.com',
      code: start.body.devCode,
    })
    expect(reused.status).toBe(404)
  })

  it('keeps Steam ids server-side: patch cannot forge them, import needs a link', async () => {
    const t = await signedIn()
    const forged = await t.request('PATCH', '/api/me', {
      preferences: { steamId: '76561198000000000' },
    })
    expect(forged.status).toBe(200)
    expect(forged.body.user.preferences.steamId).toBeUndefined()

    const status = await t.request('GET', '/api/me/steam')
    expect(status.body).toEqual({ steamId: null, importReady: true })

    const unlinked = await t.request('POST', '/api/me/steam/import', {})
    expect(unlinked.status).toBe(400)
    expect(unlinked.body.error.code).toBe('STEAM_NOT_LINKED')
  })

  it('blocks cross-origin writes and non-JSON bodies', async () => {
    const t = await signedIn()
    const cross = await t.request(
      'POST',
      '/api/library',
      { titleId: 'movie-tt0816692' },
      { Origin: 'https://evil.example' },
    )
    expect(cross.status).toBe(403)
    const form = await t.request('POST', '/api/auth/logout', undefined, {
      'Content-Type': 'text/plain',
    })
    expect(form.status).toBe(415)
  })

  it('requires a session for the library', async () => {
    const t = testApp()
    const res = await t.request('GET', '/api/library')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('changes password, revoking other sessions, and deletes the account', async () => {
    const t = await signedIn()
    const bad = await t.request('POST', '/api/me/password', {
      currentPassword: 'wrong-one',
      newPassword: 'another password',
    })
    expect(bad.body.error.code).toBe('WRONG_PASSWORD')
    const good = await t.request('POST', '/api/me/password', {
      currentPassword: account.password,
      newPassword: 'another password',
    })
    expect(good.status).toBe(200)
    expect((await t.request('GET', '/api/me/sessions')).body.sessions).toHaveLength(1)
    const deleted = await t.request('POST', '/api/me/delete', { password: 'another password' })
    expect(deleted.status).toBe(200)
    expect((await t.request('GET', '/api/auth/session')).body.user).toBeNull()
    const login = await t.request('POST', '/api/auth/login', {
      email: account.email,
      password: 'another password',
    })
    expect(login.status).toBe(401)
  }, 30_000)

  it('updates the profile and preferences', async () => {
    const t = await signedIn()
    const res = await t.request('PATCH', '/api/me', {
      name: 'Dmitry',
      preferences: { locale: 'en', theme: 'dark', platforms: ['pc', 'switch'], region: 'PL' },
    })
    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Dmitry')
    expect(res.body.user.preferences).toMatchObject({
      locale: 'en',
      theme: 'dark',
      region: 'PL',
      stores: ['steam'],
    })
    const invalid = await t.request('PATCH', '/api/me', { preferences: { region: 'XX' } })
    expect(invalid.status).toBe(400)
  })
})

describe('library', () => {
  it('adds a movie and enforces movie statuses', async () => {
    const t = await signedIn()
    const added = await t.request('POST', '/api/library', { titleId: 'movie-tt0816692' })
    expect(added.status).toBe(201)
    expect(added.body.entry).toMatchObject({ status: 'planned', kind: 'movie', progress: 0 })
    expect(added.body.entry.title.names.ru).toBe('Интерстеллар')

    const invalid = await t.request('PATCH', '/api/library/movie-tt0816692', {
      status: 'in_progress',
    })
    expect(invalid.status).toBe(422)
    expect(invalid.body.error.code).toBe('STATUS_NOT_ALLOWED')

    const done = await t.request('PATCH', '/api/library/movie-tt0816692', {
      status: 'completed',
      rating: 9,
    })
    expect(done.body.entry).toMatchObject({ status: 'completed', rating: 9, progress: 100 })
    expect(done.body.entry.finishedAt).toBeTruthy()
    expect(done.body.statusChanged).toEqual({ from: 'planned', to: 'completed' })

    const again = await t.request('POST', '/api/library', { titleId: 'movie-tt0816692' })
    expect(again.status).toBe(200)
    expect(again.body.entry.status).toBe('completed')
  })

  it('tracks episodes with automatic status transitions', async () => {
    const t = await signedIn()
    await t.request('POST', '/api/library', { titleId: 'series-tt0903747' })
    const first = await t.request('POST', '/api/library/series-tt0903747/episodes', {
      episodes: [{ season: 1, number: 1 }],
      watched: true,
    })
    expect(first.body.statusChanged).toEqual({ from: 'planned', to: 'in_progress' })
    expect(first.body.entry).toMatchObject({ watchedEpisodes: 1, totalEpisodes: 4, progress: 25 })
    expect(first.body.entry.nextEpisode).toMatchObject({ season: 1, number: 2 })

    const next = await t.request('POST', '/api/library/series-tt0903747/episodes/next', {})
    expect(next.body.entry.nextEpisode).toMatchObject({ season: 2, number: 1 })

    const rest = await t.request('POST', '/api/library/series-tt0903747/episodes', {
      episodes: [
        { season: 2, number: 1 },
        { season: 2, number: 2 },
      ],
      watched: true,
    })
    expect(rest.body.statusChanged).toEqual({ from: 'in_progress', to: 'completed' })
    expect(rest.body.entry).toMatchObject({ progress: 100, nextEpisode: null })

    const undo = await t.request('POST', '/api/library/series-tt0903747/episodes', {
      episodes: [{ season: 2, number: 2 }],
      watched: false,
    })
    expect(undo.body.entry.status).toBe('in_progress')
    expect(undo.body.entry.watchedEpisodes).toBe(3)

    const note = await t.request('PUT', '/api/library/series-tt0903747/episodes/note', {
      season: 1,
      number: 1,
      note: 'Great pilot',
      rating: 9,
    })
    expect(note.body.marks[0]).toMatchObject({
      season: 1,
      number: 1,
      note: 'Great pilot',
      rating: 9,
    })
    expect(note.body.marks[0].watchedAt).toBeTruthy()
  })

  it('marks every aired episode when a series is completed', async () => {
    const t = await signedIn()
    const res = await t.request('POST', '/api/library', {
      titleId: 'series-tt0903747',
      status: 'completed',
    })
    expect(res.body.entry).toMatchObject({ status: 'completed', watchedEpisodes: 4, progress: 100 })
  })

  it('manages game progress and playthroughs', async () => {
    const t = await signedIn()
    await t.request('POST', '/api/library', { titleId: 'steam-1145360' })
    const progress = await t.request('PATCH', '/api/library/steam-1145360', {
      progress: 40,
      hours: 12.5,
      platform: 'pc',
    })
    expect(progress.body.statusChanged).toEqual({ from: 'planned', to: 'in_progress' })
    expect(progress.body.entry).toMatchObject({ progress: 40, hours: 12.5, platform: 'pc' })

    const run = await t.request('POST', '/api/library/steam-1145360/playthroughs', {
      label: 'Switch',
      platform: 'switch',
      status: 'in_progress',
      progress: 10,
    })
    expect(run.status).toBe(201)
    const [playthrough] = run.body.entry.playthroughs
    expect(playthrough).toMatchObject({ label: 'Switch', platform: 'switch', progress: 10 })

    const updated = await t.request(
      'PATCH',
      `/api/library/steam-1145360/playthroughs/${playthrough.id}`,
      {
        status: 'completed',
        hours: 30,
      },
    )
    expect(updated.body.entry.playthroughs[0]).toMatchObject({ status: 'completed', hours: 30 })
    expect(updated.body.entry.status).toBe('in_progress')

    const removed = await t.request(
      'DELETE',
      `/api/library/steam-1145360/playthroughs/${playthrough.id}`,
    )
    expect(removed.body.entry.playthroughs).toHaveLength(0)
  })

  it('reports stats and activity, exports and re-imports', async () => {
    const t = await signedIn()
    await t.request('POST', '/api/library', {
      titleId: 'movie-tt0816692',
      status: 'completed',
      rating: 8,
    })
    await t.request('POST', '/api/library', { titleId: 'series-tt0903747', status: 'completed' })
    await t.request('POST', '/api/library', { titleId: 'steam-1145360', favorite: true })

    const stats = await t.request('GET', '/api/library/stats?tz=180')
    expect(stats.body).toMatchObject({
      total: 3,
      favorites: 1,
      rated: 1,
      averageRating: 8,
      episodesWatched: 4,
    })
    expect(stats.body.byStatus).toMatchObject({ completed: 2, planned: 1 })
    expect(stats.body.completedThisYear).toBe(2)
    expect(stats.body.minutes.movies).toBe(169)

    const activity = await t.request('GET', '/api/library/activity')
    expect(activity.body.items.length).toBeGreaterThanOrEqual(3)
    expect(activity.body.items[0].title.names.original).toBe('Hades')

    const exported = await t.request('GET', '/api/me/export')
    expect(exported.body.entries).toHaveLength(3)

    const other = testApp()
    const otherRegistered = await registerAccount(other, { ...account, email: 'other@example.com' })
    expect(otherRegistered.status).toBe(201)
    const imported = await other.request('POST', '/api/me/import', exported.body)
    expect(imported.body).toEqual({ imported: 3, skipped: 0 })
    const library = await other.request('GET', '/api/library')
    expect(library.body.entries).toHaveLength(3)
    const series = library.body.entries.find(
      (e: { titleId: string }) => e.titleId === 'series-tt0903747',
    )
    expect(series.watchedEpisodes).toBe(4)
  })

  it('deletes entries and validates ids', async () => {
    const t = await signedIn()
    await t.request('POST', '/api/library', { titleId: 'movie-tt0816692' })
    expect((await t.request('DELETE', '/api/library/movie-tt0816692')).status).toBe(200)
    expect((await t.request('DELETE', '/api/library/movie-tt0816692')).status).toBe(404)
    expect((await t.request('GET', '/api/library/not-an-id')).status).toBe(400)
    expect((await t.request('POST', '/api/library', { titleId: 'movie-tt9999999' })).status).toBe(
      404,
    )
  })
})

describe('catalog', () => {
  it('serves charts, search, details, episodes and offers', async () => {
    const t = testApp()
    const charts = await t.request('GET', '/api/catalog/charts?kind=movie&list=top')
    expect(charts.body.items[0].id).toBe('movie-tt0816692')
    const search = await t.request('GET', '/api/catalog/search?q=во все')
    expect(search.body.items[0].id).toBe('series-tt0903747')
    const short = await t.request('GET', '/api/catalog/search?q=a')
    expect(short.body.items).toEqual([])
    const details = await t.request('GET', '/api/titles/movie-tt0816692?lang=ru')
    expect(details.body.title.descriptions.ru).toBe('About movie-tt0816692')
    const episodes = await t.request('GET', '/api/titles/series-tt0903747/episodes')
    expect(episodes.body.list.seasons).toHaveLength(2)
    const offers = await t.request('GET', '/api/titles/steam-1145360/offers?region=US')
    expect(offers.body.offers[0]).toMatchObject({ store: 'steam', price: 2499 })
    expect((await t.request('GET', '/api/titles/movie-tt0000001')).status).toBe(404)
    expect((await t.request('GET', '/api/nope')).status).toBe(404)
  })
})

describe('public profile', () => {
  it('shows library highlights without private fields', async () => {
    const t = await signedIn()
    const me = (await t.request('GET', '/api/auth/session')).body.user
    await t.request('POST', '/api/library', {
      titleId: 'series-tt0903747',
      status: 'completed',
      favorite: true,
      rating: 9,
    })
    const patched = await t.request('PATCH', '/api/me', { preferences: { banner: 'ocean' } })
    expect(patched.status).toBe(200)

    const res = await t.request('GET', `/api/users/${me.id}/profile`)
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: me.id, name: account.name, banner: 'ocean' })
    expect(res.body.user.email).toBeUndefined()
    expect(res.body.user.steamId).toBeUndefined()
    expect(res.body.user.steamLinked).toBe(false)
    expect(res.body.inProgress).toEqual([])
    expect(Array.isArray(res.body.heroPosters)).toBe(true)
    expect(res.body.stats.total).toBe(1)
    expect(res.body.favorites.map((e: { titleId: string }) => e.titleId)).toEqual([
      'series-tt0903747',
    ])
    expect(res.body.completed).toHaveLength(1)
    expect(res.body.bannerImage).toBeNull()

    expect((await t.request('GET', '/api/users/nobody/profile')).status).toBe(404)
    await t.request('POST', '/api/auth/logout', {})
    expect((await t.request('GET', `/api/users/${me.id}/profile`)).status).toBe(401)
  })
})
