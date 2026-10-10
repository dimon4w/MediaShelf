import { describe, expect, it } from 'vitest'
import { registerAccount, testApp } from './test-utils.ts'

const account = { name: 'Дима', email: 'dima@example.com', password: 'correct horse battery' }

// 1x1 PNG
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const png = `data:image/png;base64,${PNG}`

async function signedIn() {
  const t = testApp()
  expect((await registerAccount(t, account)).status).toBe(201)
  const session = await t.request('GET', '/api/auth/session')
  return { t, id: session.body.user.id as string }
}

describe('profile cover', () => {
  it('stores an uploaded picture and serves it on the profile', async () => {
    const { t, id } = await signedIn()
    expect((await t.request('PUT', '/api/me/cover', { dataUrl: png })).status).toBe(200)
    await t.request('PATCH', '/api/me', { preferences: { banner: 'image' } })

    const profile = await t.request('GET', `/api/users/${id}/profile`)
    expect(profile.body.user.banner).toBe('image')
    expect(profile.body.bannerImage).toMatch(new RegExp(`^/api/users/${id}/cover\\?v=\\d+$`))

    const image = await t.request('GET', `/api/users/${id}/cover`)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    const etag = image.headers.get('etag')
    expect(etag).toBeTruthy()
  })

  it('rejects anything that is not a real image', async () => {
    const { t } = await signedIn()
    const text = Buffer.from('<script>alert(1)</script>').toString('base64')
    const fake = await t.request('PUT', '/api/me/cover', { dataUrl: `data:image/png;base64,${text}` })
    expect(fake.status).toBe(400)
    const svg = await t.request('PUT', '/api/me/cover', {
      dataUrl: `data:image/svg+xml;base64,${text}`,
    })
    expect(svg.status).toBe(400)
  })

  it('falls back to the poster collage once the picture is removed', async () => {
    const { t, id } = await signedIn()
    await t.request('PUT', '/api/me/cover', { dataUrl: png })
    await t.request('PATCH', '/api/me', { preferences: { banner: 'image' } })
    expect((await t.request('DELETE', '/api/me/cover')).status).toBe(200)
    const profile = await t.request('GET', `/api/users/${id}/profile`)
    expect(profile.body.bannerImage).toBeNull()
    expect((await t.request('GET', `/api/users/${id}/cover`)).status).toBe(404)
  })

  it('only accepts library titles as the cover title', async () => {
    const { t } = await signedIn()
    const outside = await t.request('PATCH', '/api/me', {
      preferences: { banner: 'title', bannerTitleId: 'movie-tt0816692' },
    })
    expect(outside.status).toBe(404)
    await t.request('POST', '/api/library', { titleId: 'movie-tt0816692' })
    const inside = await t.request('PATCH', '/api/me', {
      preferences: { banner: 'title', bannerTitleId: 'movie-tt0816692' },
    })
    expect(inside.status).toBe(200)
  })

  it('maps covers from the old preset list to the collage', async () => {
    const { t, id } = await signedIn()
    const profile = await t.request('GET', `/api/users/${id}/profile`)
    expect(profile.body.user.banner).toBe('none')
  })
})
