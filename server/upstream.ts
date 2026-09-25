const cache = new Map<string, { value: unknown; until: number }>()
const pending = new Map<string, Promise<unknown>>()
let active = 0
const waiting: (() => void)[] = []
let nextAnimeRequest = 0

export async function upstream(url: string, ttl = 15 * 60_000): Promise<unknown> {
  const saved = cache.get(url)
  if (saved && saved.until > Date.now()) return saved.value
  const running = pending.get(url)
  if (running) return running
  const request = (async () => {
    if (active >= 6) await new Promise<void>((resolve) => waiting.push(resolve))
    active++
    try {
      if (url.startsWith('https://shikimori.one/')) {
        const delay = Math.max(0, nextAnimeRequest - Date.now())
        nextAnimeRequest = Date.now() + delay + 500
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      }
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MediaShelf/3.0 (personal media catalog)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok) throw new Error(`Upstream ${response.status}`)
      const value: unknown = await response.json()
      if (cache.size >= 1000) cache.delete(cache.keys().next().value!)
      cache.set(url, { value, until: Date.now() + ttl })
      return value
    } finally {
      active--
      waiting.shift()?.()
    }
  })()
  pending.set(url, request)
  try {
    return await request
  } finally {
    pending.delete(url)
  }
}

export type Row = Record<string, unknown>
export const row = (v: unknown): Row => (v && typeof v === 'object' ? (v as Row) : {})
export const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.map(row) : [])
export const text = (v: unknown) => (typeof v === 'string' ? v : '')
export const clean = (v: unknown) =>
  text(v)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
