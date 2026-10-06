import { describe, expect, it } from 'vitest'
import { HttpError, USER_AGENT, createHttpClient, isNotFound } from './http.ts'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function client(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  extra: Parameters<typeof createHttpClient>[0] = {},
) {
  const sleeps: number[] = []
  const http = createHttpClient({
    fetch: fetchImpl as typeof fetch,
    hosts: {},
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    ...extra,
  })
  return { http, sleeps }
}

describe('createHttpClient', () => {
  it('sends the User-Agent and caches successful responses for the TTL', async () => {
    let now = 1_000
    const seen: RequestInit[] = []
    const { http } = client(
      async (_url, init) => {
        seen.push(init ?? {})
        return jsonResponse({ n: seen.length })
      },
      { now: () => now },
    )
    expect(await http.json('https://api.example.com/a', { ttlMs: 1000 })).toEqual({ n: 1 })
    expect(await http.json('https://api.example.com/a', { ttlMs: 1000 })).toEqual({ n: 1 })
    now += 1001
    expect(await http.json('https://api.example.com/a', { ttlMs: 1000 })).toEqual({ n: 2 })
    expect(await http.json('https://api.example.com/a')).toEqual({ n: 3 })
    expect((seen[0].headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT)
  })

  it('shares one upstream request between concurrent identical calls', async () => {
    let calls = 0
    const { http } = client(async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 20))
      return jsonResponse({ ok: true })
    })
    const results = await Promise.all([
      http.json('https://x.test/a'),
      http.json('https://x.test/a'),
      http.json('https://x.test/a'),
    ])
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(calls).toBe(1)
  })

  it('posts JSON bodies', async () => {
    let body: unknown
    let headers: Record<string, string> = {}
    const { http } = client(async (_url, init) => {
      body = JSON.parse(String(init?.body))
      headers = init?.headers as Record<string, string>
      return jsonResponse({ data: 1 })
    })
    await http.json('https://graphql.test/', { method: 'POST', body: { query: '{ x }' } })
    expect(body).toEqual({ query: '{ x }' })
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('retries once after 5xx and network errors', async () => {
    const replies: (() => Promise<Response>)[] = [
      async () => new Response('busy', { status: 503 }),
      async () => jsonResponse({ ok: 1 }),
      async () => {
        throw new TypeError('fetch failed')
      },
      async () => jsonResponse({ ok: 2 }),
    ]
    const { http, sleeps } = client(async () => (replies.shift() as () => Promise<Response>)())
    expect(await http.json('https://x.test/a')).toEqual({ ok: 1 })
    expect(await http.json('https://x.test/b')).toEqual({ ok: 2 })
    expect(sleeps).toHaveLength(2)
  })

  it('gives up after one retry', async () => {
    let calls = 0
    const { http } = client(async () => {
      calls++
      return new Response('down', { status: 502 })
    })
    await expect(http.json('https://x.test/a')).rejects.toMatchObject({ status: 502 })
    expect(calls).toBe(2)
  })

  it('does not retry other 4xx and reports not-found', async () => {
    let calls = 0
    const { http } = client(async () => {
      calls++
      return new Response('missing', { status: 404 })
    })
    const error = await http.json('https://x.test/a').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect(isNotFound(error)).toBe(true)
    expect(calls).toBe(1)
  })

  it('honours short Retry-After and fails fast on long ones', async () => {
    const replies = [
      new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }),
      jsonResponse({ ok: true }),
      new Response('slow down', { status: 429, headers: { 'retry-after': '60' } }),
    ]
    const { http, sleeps } = client(async () => replies.shift() as Response)
    expect(await http.json('https://x.test/a')).toEqual({ ok: true })
    expect(sleeps).toEqual([2000])
    await expect(http.json('https://x.test/b')).rejects.toMatchObject({ status: 429 })
    expect(sleeps).toEqual([2000])
  })

  it('rejects invalid JSON without caching it', async () => {
    let calls = 0
    const { http } = client(async () => {
      calls++
      return new Response(calls === 1 ? '<html>oops</html>' : '{"ok":true}', { status: 200 })
    })
    await expect(http.json('https://x.test/a', { ttlMs: 60_000 })).rejects.toBeInstanceOf(
      SyntaxError,
    )
    expect(await http.json('https://x.test/a', { ttlMs: 60_000 })).toEqual({ ok: true })
    expect(calls).toBe(2)
  })

  it('aborts slow requests after the timeout without retrying', async () => {
    let calls = 0
    const { http } = client(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          calls++
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
      { timeoutMs: 30 },
    )
    await expect(http.json('https://x.test/slow')).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(calls).toBe(1)
  })

  it('limits global concurrency', async () => {
    let active = 0
    let peak = 0
    const { http } = client(
      async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 10))
        active--
        return jsonResponse({})
      },
      { concurrency: 3 },
    )
    await Promise.all(Array.from({ length: 10 }, (_, i) => http.json(`https://x.test/${i}`)))
    expect(peak).toBe(3)
  })

  it('paces requests per host and caps per-host concurrency', async () => {
    let now = 0
    let active = 0
    let peak = 0
    const { http, sleeps } = client(
      async (url) => {
        if (url.includes('wikidata')) {
          active++
          peak = Math.max(peak, active)
          await new Promise((resolve) => setTimeout(resolve, 5))
          active--
        }
        return jsonResponse({})
      },
      {
        now: () => now,
        hosts: {
          'shikimori.test': { minIntervalMs: 250 },
          'query.wikidata.test': { maxConcurrent: 2 },
        },
      },
    )
    await Promise.all([1, 2, 3].map((i) => http.json(`https://shikimori.test/${i}`)))
    expect(sleeps).toEqual([250, 500])
    now = 10_000
    await http.json('https://other.test/x')
    expect(sleeps).toHaveLength(2)
    await Promise.all(
      Array.from({ length: 6 }, (_, i) => http.json(`https://query.wikidata.test/${i}`)),
    )
    expect(peak).toBe(2)
  })
})
