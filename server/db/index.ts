import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { migrate } from './migrations.ts'

export type DB = DatabaseSync
export type SqlValue = string | number | bigint | null | Uint8Array

export function openDatabase(file: string): DB {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA temp_store = MEMORY;
  `)
  migrate(db)
  return db
}

const statements = new WeakMap<DB, Map<string, StatementSync>>()

/** Prepared statements are cached per connection. */
export function sql(db: DB, query: string): StatementSync {
  let cache = statements.get(db)
  if (!cache) statements.set(db, (cache = new Map()))
  let statement = cache.get(query)
  if (!statement) cache.set(query, (statement = db.prepare(query)))
  return statement
}

/** Runs fn inside a transaction; nested calls join the outer transaction. */
export function transaction<T>(db: DB, fn: () => T): T {
  if (db.isTransaction) return fn()
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw error
  }
}

export const toBit = (value: boolean) => (value ? 1 : 0)
export const json = (value: unknown) => JSON.stringify(value)

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const isoOrNull = (ms: unknown) =>
  typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null
