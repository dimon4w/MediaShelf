import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.ts'
import { errorResponse } from './errors.ts'
import { sameOriginOnly } from './security.ts'

function app(env: Record<string, string> = {}) {
  const config = loadConfig([], { DB_FILE: ':memory:', ...env })
  const a = new Hono()
  a.onError(errorResponse)
  a.use('*', sameOriginOnly(config))
  a.post('/x', (c) => c.json({ ok: true }))
  return a
}

const post = (a: Hono, headers: Record<string, string>, type = 'application/json') =>
  a.request('http://localhost:4175/x', {
    method: 'POST',
    headers: { 'Content-Type': type, ...headers },
    body: '{}',
  })

describe('CSRF and GitHub Codespaces', () => {
  const own = 'own-name-4175.app.github.dev'
  const proxied = { 'X-Forwarded-Host': own, 'Sec-Fetch-Site': 'cross-site' }

  it('lets the codespace through its own proxy, with or without Origin', async () => {
    const a = app({ TRUST_PROXY: 'true' })
    expect((await post(a, { ...proxied, Origin: `https://${own}` })).status).toBe(200)
    expect((await post(a, proxied)).status).toBe(200)
  })

  it('rejects another codespace', async () => {
    const a = app({ TRUST_PROXY: 'true' })
    const res = await post(a, { ...proxied, Origin: 'https://evil-4175.app.github.dev' })
    expect(res.status).toBe(403)
  })

  it('ignores X-Forwarded-Host unless the proxy is trusted', async () => {
    const a = app()
    expect((await post(a, { ...proxied, Origin: `https://${own}` })).status).toBe(403)
  })

  it('still requires JSON from the codespace', async () => {
    const a = app({ TRUST_PROXY: 'true' })
    expect((await post(a, proxied, 'text/plain')).status).toBe(415)
  })

  it('keeps the plain same-origin rule', async () => {
    const a = app()
    expect((await post(a, { Origin: 'http://localhost:4175' })).status).toBe(200)
    expect((await post(a, { Origin: 'https://evil.example' })).status).toBe(403)
  })
})
