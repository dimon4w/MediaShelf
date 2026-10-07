/** Bounded in-memory TTL cache with LRU eviction and an optional size budget. */
export interface TtlCache<V> {
  get(key: string): V | undefined
  set(key: string, value: V, ttlMs: number): void
  delete(key: string): void
  clear(): void
  readonly size: number
}

export interface TtlCacheOptions<V> {
  maxEntries: number
  /** Total budget in `sizeOf` units; entries above an eighth of it are not stored. */
  maxSize?: number
  sizeOf?: (value: V) => number
  now?: () => number
}

export function createTtlCache<V>(options: TtlCacheOptions<V>): TtlCache<V> {
  const { maxEntries, maxSize = Infinity, sizeOf = () => 0, now = Date.now } = options
  const entries = new Map<string, { value: V; until: number; size: number }>()
  let total = 0

  function remove(key: string) {
    const entry = entries.get(key)
    if (!entry) return
    entries.delete(key)
    total -= entry.size
  }

  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      if (entry.until <= now()) {
        remove(key)
        return undefined
      }
      // Refresh recency.
      entries.delete(key)
      entries.set(key, entry)
      return entry.value
    },
    set(key, value, ttlMs) {
      remove(key)
      if (!(ttlMs > 0)) return
      const size = sizeOf(value)
      if (size > maxSize / 8) return
      entries.set(key, { value, until: now() + ttlMs, size })
      total += size
      while (entries.size > maxEntries || total > maxSize) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        remove(oldest.value)
      }
    },
    delete: remove,
    clear() {
      entries.clear()
      total = 0
    },
    get size() {
      return entries.size
    },
  }
}
