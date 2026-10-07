// Test helpers: recorded fixtures and a routing fake fetch.
import { readFileSync } from 'node:fs'
import { createHttpClient, type HttpClient } from './http.ts'

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')) as T
}

/** JSON body, a Response, an Error (network failure), a status code or a function producing one. */
export type FakeReply = unknown

export interface FakeFetch {
  fetch: typeof fetch
  calls: { url: string; init?: RequestInit }[]
  count(pattern: RegExp): number
}

/** Routes are matched in order against the decoded URL; unmatched requests get a 404. */
export function fakeFetch(routes: readonly [RegExp, FakeReply][]): FakeFetch {
  const calls: { url: string; init?: RequestInit }[] = []
  const impl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push({ url, init })
    const decoded = decodeURIComponent(url)
    const route = routes.find(([pattern]) => pattern.test(decoded))
    let reply: unknown = route ? route[1] : 404
    if (typeof reply === 'function')
      reply = await (reply as (url: string, init?: RequestInit) => unknown)(decoded, init)
    if (reply instanceof Response) return reply
    if (reply instanceof Error) throw reply
    if (typeof reply === 'number')
      return new Response(JSON.stringify({ status: reply }), { status: reply })
    return Response.json(reply)
  }
  return {
    fetch: impl as typeof fetch,
    calls,
    count: (pattern) => calls.filter((call) => pattern.test(decodeURIComponent(call.url))).length,
  }
}

/** Upstream client without pacing or retry delays. */
export function testHttp(fetchImpl: typeof fetch): HttpClient {
  return createHttpClient({ fetch: fetchImpl, hosts: {}, sleep: async () => undefined })
}
