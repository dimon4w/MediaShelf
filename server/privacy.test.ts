import { describe, expect, it } from 'vitest'
import { registerAccount, testApp } from './test-utils.ts'

/**
 * Privacy guard: every endpoint that shows one user's data to another user must leave out
 * notes (entries, playthroughs, episodes), the email and the SteamID. Add each new public
 * endpoint (lists, diary, feed…) to PUBLIC_ENDPOINTS.
 */
const PUBLIC_ENDPOINTS = (ownerId: string) => [`/api/users/${ownerId}/profile`]

const secrets = {
  entry: 'secret entry note 7f3a',
  playthrough: 'secret playthrough note 91bc',
  episode: 'secret episode note 2d4e',
}

describe('privacy guard', () => {
  it('never shows private fields to another user', async () => {
    const t = testApp()
    const owner = { name: 'Owner', email: 'owner@example.com', password: 'correct horse battery' }
    await registerAccount(t, owner)
    const ownerId = (await t.request('GET', '/api/auth/session')).body.user.id as string

    await t.request('POST', '/api/library', {
      titleId: 'series-tt0903747',
      status: 'in_progress',
      favorite: true,
    })
    await t.request('PATCH', '/api/library/series-tt0903747', { notes: secrets.entry })
    const episode = await t.request('PUT', '/api/library/series-tt0903747/episodes/note', {
      season: 1,
      number: 1,
      note: secrets.episode,
    })
    expect(episode.status).toBe(200)
    await t.request('POST', '/api/library', {
      titleId: 'steam-1145360',
      status: 'completed',
      favorite: true,
    })
    const run = await t.request('POST', '/api/library/steam-1145360/playthroughs', {
      label: 'NG+',
      note: secrets.playthrough,
    })
    expect(run.status).toBe(201)

    t.clearCookie()
    await registerAccount(t, {
      name: 'Viewer',
      email: 'viewer@example.com',
      password: 'correct horse battery',
    })

    for (const path of PUBLIC_ENDPOINTS(ownerId)) {
      const res = await t.request('GET', path)
      expect(res.status, path).toBe(200)
      const body = JSON.stringify(res.body)
      for (const secret of Object.values(secrets)) expect(body, path).not.toContain(secret)
      expect(body.toLowerCase(), path).not.toContain(owner.email)
      expect(body, path).not.toMatch(/"(notes|note|email|steamId|password_hash)"\s*:/)
    }
  })
})
