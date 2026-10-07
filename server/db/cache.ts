import type { PersistentCache } from '../catalog/types.ts'
import { sql, type DB } from './index.ts'

/** Durable cache for expensive upstream lookups (e.g. Wikidata labels). */
export function sqliteCache(db: DB): PersistentCache {
  return {
    get<T>(key: string) {
      const row = sql(db, 'SELECT value, expires_at FROM cache WHERE key = ?').get(key) as
        { value: string; expires_at: number } | undefined
      if (!row || row.expires_at < Date.now()) return undefined
      try {
        return JSON.parse(row.value) as T
      } catch {
        return undefined
      }
    },
    set(key, value, ttlMs) {
      sql(
        db,
        `INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      ).run(key, JSON.stringify(value ?? null), Date.now() + ttlMs)
    },
  }
}

export function pruneCache(db: DB) {
  sql(db, 'DELETE FROM cache WHERE expires_at < ?').run(Date.now())
}
