import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.ts'
import { steamAuthUrl, steamLoginCancelled, steamOrigin, verifySteamCallback } from './steam.ts'

const ID = '76561198012345678'

async function originFor(url: string, env: Record<string, string> = {}, headers: HeadersInit = {}) {
  const config = loadConfig([], env)
  const app = new Hono().get('/*', (c) => c.text(steamOrigin(c, config)))
  const response = await app.request(url, { headers })
  return response.text()
}

describe('steamOrigin', () => {
  it('uses the address the browser came in on, even with a stale PUBLIC_URL', async () => {
    expect(
      await originFor('http://localhost:4175/api/auth/steam/start', {
        PUBLIC_URL: 'https://old-tunnel.ngrok-free.dev',
      }),
    ).toBe('http://localhost:4175')
    expect(await originFor('http://127.0.0.1:4175/x')).toBe('http://127.0.0.1:4175')
  })

  it('keeps PUBLIC_URL for requests that did not arrive on a loopback name', async () => {
    expect(
      await originFor('http://app.internal:4173/x', { PUBLIC_URL: 'https://media.example.com/' }),
    ).toBe('https://media.example.com')
  })

  it('falls back to the request address without PUBLIC_URL', async () => {
    expect(await originFor('http://192.168.1.20:4175/x')).toBe('http://192.168.1.20:4175')
  })

  it('reads forwarded headers only when the proxy is trusted', async () => {
    const forwarded = { 'x-forwarded-host': 'media.example.com', 'x-forwarded-proto': 'https' }
    expect(await originFor('http://127.0.0.1:4173/x', { TRUST_PROXY: 'true' }, forwarded)).toBe(
      'https://media.example.com',
    )
    expect(await originFor('http://127.0.0.1:4173/x', {}, forwarded)).toBe('http://127.0.0.1:4173')
  })
})

describe('steamAuthUrl', () => {
  it('asks Steam to return to this origin', () => {
    const url = new URL(steamAuthUrl('http://localhost:4175'))
    expect(url.origin + url.pathname).toBe('https://steamcommunity.com/openid/login')
    expect(url.searchParams.get('openid.return_to')).toBe(
      'http://localhost:4175/api/auth/steam/callback',
    )
    expect(url.searchParams.get('openid.realm')).toBe('http://localhost:4175')
  })
})

describe('verifySteamCallback', () => {
  const origin = 'http://localhost:4175'
  const good = (): Record<string, string> => ({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': `https://steamcommunity.com/openid/id/${ID}`,
    'openid.identity': `https://steamcommunity.com/openid/id/${ID}`,
    'openid.return_to': `${origin}/api/auth/steam/callback`,
    'openid.sig': 'abc',
  })
  const steamSays = (text: string) => (async () => new Response(text)) as unknown as typeof fetch

  it('returns the SteamID64 once Steam confirms the signature', async () => {
    let sent = ''
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = String(init.body)
      return new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n')
    }) as unknown as typeof fetch
    expect(await verifySteamCallback(good(), origin, fetchImpl)).toBe(ID)
    expect(sent).toContain('openid.mode=check_authentication')
  })

  it('rejects an assertion issued for another address', async () => {
    const query = { ...good(), 'openid.return_to': 'https://evil.example/api/auth/steam/callback' }
    await expect(
      verifySteamCallback(query, origin, steamSays('is_valid:true')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a response that did not come from Steam', async () => {
    const query = { ...good(), 'openid.op_endpoint': 'https://evil.example/openid/login' }
    await expect(
      verifySteamCallback(query, origin, steamSays('is_valid:true')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a claimed id that is not a Steam profile', async () => {
    const query = { ...good(), 'openid.claimed_id': 'https://evil.example/id/76561198012345678' }
    await expect(
      verifySteamCallback(query, origin, steamSays('is_valid:true')),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rejects a signature Steam does not confirm', async () => {
    await expect(
      verifySteamCallback(good(), origin, steamSays('is_valid:false')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('reports Steam being unreachable', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(verifySteamCallback(good(), origin, down)).rejects.toMatchObject({
      code: 'CATALOG_UNAVAILABLE',
    })
  })

  it('recognises the Cancel button on the Steam page', () => {
    expect(steamLoginCancelled({ 'openid.mode': 'cancel' })).toBe(true)
    expect(steamLoginCancelled(good())).toBe(false)
  })
})
