import { DatabaseSync } from 'node:sqlite'
import { mkdir } from 'node:fs/promises'
import { createGunzip } from 'node:zlib'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import type { PublicRating } from '../src/lib/types.ts'

let database: DatabaseSync | undefined
let opening: Promise<DatabaseSync> | undefined
let refresh: Promise<void> | undefined
let retryAfter = 0
async function db() {
  if (database) return database
  return (opening ??= (async () => {
    const folder = new URL('../.cache/', import.meta.url)
    await mkdir(folder, { recursive: true })
    database = new DatabaseSync(fileURLToPath(new URL('imdb-ratings.sqlite', folder)))
    database.exec(
      'CREATE TABLE IF NOT EXISTS ratings (id TEXT PRIMARY KEY, score REAL NOT NULL, votes INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS metadata (updated TEXT)',
    )
    return database
  })())
}

/** Official daily IMDb ratings. Refresh off the request path; replace the snapshot atomically. */
export async function refreshImdbRatings() {
  if (refresh) return refresh
  refresh = (async () => {
    const sql = await db()
    const old = sql.prepare('SELECT updated FROM metadata LIMIT 1').get() as
      { updated: string } | undefined
    if (old && Date.now() - Date.parse(old.updated) < 24 * 3600_000) return
    if (Date.now() < retryAfter) return
    retryAfter = Date.now() + 5 * 60_000
    const response = await fetch('https://datasets.imdbws.com/title.ratings.tsv.gz', {
      signal: AbortSignal.timeout(120000),
    })
    if (!response.ok || !response.body) throw new Error('IMDb ratings unavailable')
    sql.exec(
      'DROP TABLE IF EXISTS ratings_next; CREATE TABLE ratings_next (id TEXT PRIMARY KEY, score REAL NOT NULL, votes INTEGER NOT NULL)',
    )
    const insert = sql.prepare('INSERT INTO ratings_next VALUES (?, ?, ?)')
    const stream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(
      createGunzip(),
    )
    let count = 0
    try {
      sql.exec('BEGIN')
      for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
        const [id, score, votes] = line.split('\t')
        if (!/^tt\d+$/.test(id)) continue
        const value = Number(score),
          total = Number(votes)
        if (
          !Number.isFinite(value) ||
          value < 0 ||
          value > 10 ||
          !Number.isInteger(total) ||
          total < 0
        )
          continue
        insert.run(id, value, total)
        if (++count % 10000 === 0) {
          sql.exec('COMMIT')
          await new Promise<void>((resolve) => setImmediate(resolve))
          sql.exec('BEGIN')
        }
      }
      if (count < 1000) throw new Error('Incomplete IMDb snapshot')
      sql.exec(
        'DROP TABLE ratings; ALTER TABLE ratings_next RENAME TO ratings; DELETE FROM metadata',
      )
      sql.prepare('INSERT INTO metadata VALUES (?)').run(new Date().toISOString())
      sql.exec('COMMIT')
    } catch (error) {
      sql.exec('ROLLBACK')
      throw error
    } finally {
      stream.destroy()
    }
  })()
  try {
    await refresh
  } finally {
    refresh = undefined
  }
}

export async function imdbRating(id: string): Promise<PublicRating | undefined> {
  const sql = await db()
  void refreshImdbRatings().catch(() => undefined)
  const value = sql.prepare('SELECT score, votes FROM ratings WHERE id = ?').get(id) as
    { score: number; votes: number } | undefined
  const meta = sql.prepare('SELECT updated FROM metadata LIMIT 1').get() as
    { updated: string } | undefined
  return value && meta
    ? { source: 'imdb', value: value.score, votes: value.votes, checkedAt: meta.updated }
    : undefined
}
