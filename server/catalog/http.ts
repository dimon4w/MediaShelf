import { createTtlCache } from './ttl-cache.ts'

export const USER_AGENT = 'MediaShell/4.0 (personal media library)'

export class HttpError extends Error {
  readonly status: number
  readonly url: string
  /** Parsed Retry-After in milliseconds, when the upstream sent one. */
  readonly retryAfterMs: number | undefined

  constructor(status: number, url: string, retryAfterMs?: number) {
    super(`HTTP ${status} from ${new URL(url).hostname}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
    this.retryAfterMs = retryAfterMs
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 404 || error.status === 410)
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST'
  /** Serialised as JSON. */
  body?: unknown
  headers?: Record<string, string>
  /** Cache successful responses for this long; 0 (default) disables caching. */
  ttlMs?: number
  timeoutMs?: number
  /** Extra attempts after network errors, 5xx and 429 (default 1). */
  retries?: number
}

export interface HttpClient {
  json(url: string, options?: HttpRequestOptions): Promise<unknown>
  text(url: string, options?: HttpRequestOptions): Promise<string>
}

export interface HostPolicy {
  /** Minimum spacing between request starts. */
  minIntervalMs?: number
  maxConcurrent?: number
}

/** Stay well below documented upstream limits. */
export const DEFAULT_HOST_POLICIES: Readonly<Record<string, HostPolicy>> = {
  'shikimori.io': { minIntervalMs: 250 }, // 5 rps / 90 rpm
  'api.jikan.moe': { minIntervalMs: 500 }, // 3 rps / 60 rpm
  'query.wikidata.org': { maxConcurrent: 2 },
  'api.tvmaze.com': { minIntervalMs: 500 }, // 20 requests per 10 s
  'graphql.anilist.co': { minIntervalMs: 700 }, // 90 rpm
  'store.steampowered.com': { minIntervalMs: 100 }, // appdetails: ~200 per 5 min
}

export interface HttpClientOptions {
  fetch?: typeof fetch
  maxEntries?: number
  /** Budget for cached response bodies, in characters. */
  maxCachedChars?: number
  concurrency?: number
  hosts?: Readonly<Record<string, HostPolicy>>
  userAgent?: string
  timeoutMs?: number
  maxRetryAfterMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

interface Limiter {
  acquire(): Promise<void>
  release(): void
}

function createLimiter(max: number): Limiter {
  let active = 0
  const waiting: (() => void)[] = []
  return {
    async acquire() {
      if (active < max) {
        active++
        return
      }
      // The releasing task hands its slot over, so `active` stays unchanged.
      await new Promise<void>((resolve) => waiting.push(resolve))
    },
    release() {
      const next = waiting.shift()
      if (next) next()
      else active--
    },
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function parseRetryAfter(header: string | null, now: number): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const userAgent = options.userAgent ?? USER_AGENT
  const defaultTimeout = options.timeoutMs ?? 10_000
  const maxRetryAfter = options.maxRetryAfterMs ?? 3_000
  const hostPolicies = options.hosts ?? DEFAULT_HOST_POLICIES

  const cache = createTtlCache<string>({
    maxEntries: options.maxEntries ?? 2000,
    maxSize: options.maxCachedChars ?? 48_000_000,
    sizeOf: (text) => text.length,
    now,
  })
  const inflight = new Map<string, Promise<string>>()
  const global = createLimiter(options.concurrency ?? 8)
  const hosts = new Map<string, { limiter?: Limiter; next: number; policy: HostPolicy }>()

  function hostState(hostname: string) {
    let state = hosts.get(hostname)
    if (!state) {
      const policy = hostPolicies[hostname] ?? {}
      state = {
        policy,
        next: 0,
        limiter: policy.maxConcurrent ? createLimiter(policy.maxConcurrent) : undefined,
      }
      hosts.set(hostname, state)
    }
    return state
  }

  async function attempt(url: string, init: RequestInit, timeoutMs: number, json: boolean) {
    const host = hostState(new URL(url).hostname)
    await host.limiter?.acquire()
    try {
      if (host.policy.minIntervalMs) {
        const start = now()
        const wait = Math.max(0, host.next - start)
        host.next = Math.max(start, host.next) + host.policy.minIntervalMs
        if (wait > 0) await sleep(wait)
      }
      await global.acquire()
      try {
        const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined)
          throw new HttpError(
            response.status,
            url,
            parseRetryAfter(response.headers.get('retry-after'), now()),
          )
        }
        const text = await response.text()
        // Validate before the body reaches the cache.
        if (json) JSON.parse(text)
        return text
      } finally {
        global.release()
      }
    } finally {
      host.limiter?.release()
    }
  }

  function retryDelay(error: unknown, attemptIndex: number): number | null {
    if (error instanceof HttpError) {
      if (error.status !== 429 && error.status < 500) return null
      if (error.retryAfterMs !== undefined)
        return error.retryAfterMs <= maxRetryAfter ? error.retryAfterMs : null
      return 400 * 2 ** attemptIndex + Math.floor(Math.random() * 200)
    }
    if (error instanceof SyntaxError || isTimeout(error)) return null
    // fetch() rejects with TypeError for DNS, TLS and connection failures.
    return error instanceof TypeError
      ? 300 * 2 ** attemptIndex + Math.floor(Math.random() * 200)
      : null
  }

  async function execute(
    url: string,
    init: RequestInit,
    request: HttpRequestOptions,
    json: boolean,
  ) {
    const attempts = 1 + Math.max(0, request.retries ?? 1)
    const timeoutMs = request.timeoutMs ?? defaultTimeout
    for (let index = 0; ; index++) {
      try {
        return await attempt(url, init, timeoutMs, json)
      } catch (error) {
        const delay = index + 1 < attempts ? retryDelay(error, index) : null
        if (delay === null) throw error
        await sleep(delay)
      }
    }
  }

  function request(url: string, request: HttpRequestOptions, json: boolean): Promise<string> {
    const method = request.method ?? 'GET'
    const body = request.body === undefined ? undefined : JSON.stringify(request.body)
    const key = `${json ? 'json' : 'text'} ${method} ${url} ${body ?? ''}`
    const ttl = request.ttlMs ?? 0
    if (ttl > 0) {
      const hit = cache.get(key)
      if (hit !== undefined) return Promise.resolve(hit)
    }
    const pending = inflight.get(key)
    if (pending) return pending

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      Accept: json ? 'application/json' : '*/*',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...request.headers,
    }
    const promise = execute(url, { method, headers, body, redirect: 'follow' }, request, json)
      .then((text) => {
        if (ttl > 0) cache.set(key, text, ttl)
        return text
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, promise)
    return promise
  }

  return {
    async json(url, options = {}) {
      return JSON.parse(await request(url, options, true)) as unknown
    },
    text(url, options = {}) {
      return request(url, options, false)
    },
  }
}

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
