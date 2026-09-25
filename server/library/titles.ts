import type { TitleRecord } from '../../shared/types.ts'
import { parseJson, sql, type DB } from '../db/index.ts'

export interface StoredTitle {
  record: TitleRecord
  detailedAt: number | null
  updatedAt: number
  /** False for records that came from a user's import file rather than a catalog. */
  verified: boolean
}

/** Fields needed to render cards and lists; keeps library payloads small. */
export function summarize(record: TitleRecord): TitleRecord {
  return {
    id: record.id,
    kind: record.kind,
    names: record.names,
    year: record.year,
    endYear: record.endYear ?? null,
    poster: record.poster,
    backdrop: record.backdrop,
    genres: record.genres,
    ratings: record.ratings,
    runtime: record.runtime ?? null,
    seasons: record.seasons ?? null,
    episodes: record.episodes ?? null,
    airing: record.airing ?? null,
    platforms: record.platforms,
    externalIds: record.externalIds,
  }
}

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length)

/** Combines what we know; detailed data wins over summaries, languages accumulate. */
export function mergeTitle(
  existing: TitleRecord | undefined,
  incoming: TitleRecord,
  detailed: boolean,
) {
  if (!existing) return incoming
  const base = detailed ? { ...existing, ...incoming } : { ...incoming, ...existing }
  if (!detailed) {
    // Summaries may carry fresher list data; take it only where the stored record is empty.
    for (const key of ['poster', 'backdrop', 'year', 'genres', 'ratings'] as const)
      if (!hasValue(existing[key]) && hasValue(incoming[key]))
        Object.assign(base, { [key]: incoming[key] })
  }
  return {
    ...base,
    names: detailed
      ? { ...existing.names, ...incoming.names }
      : { ...incoming.names, ...existing.names },
    descriptions: { ...existing.descriptions, ...incoming.descriptions },
    externalIds: { ...existing.externalIds, ...incoming.externalIds },
    detailed: Boolean(existing.detailed || incoming.detailed),
  } satisfies TitleRecord
}

export class TitleStore {
  private readonly db: DB
  /** Records recently served from charts/search, trusted when a user adds them. */
  private readonly recentRecords = new Map<string, TitleRecord>()

  constructor(db: DB) {
    this.db = db
  }

  get(id: string): StoredTitle | undefined {
    const row = sql(
      this.db,
      'SELECT data, detailed_at, updated_at, verified FROM titles WHERE id = ?',
    ).get(id) as
      { data: string; detailed_at: number | null; updated_at: number; verified: number } | undefined
    if (!row) return undefined
    const record = parseJson<TitleRecord | null>(row.data, null)
    return record
      ? {
          record,
          detailedAt: row.detailed_at,
          updatedAt: row.updated_at,
          verified: row.verified === 1,
        }
      : undefined
  }

  put(record: TitleRecord, detailed: boolean): TitleRecord {
    const existing = this.get(record.id)
    // Catalog data replaces imported data outright instead of merging with it.
    const merged =
      existing?.verified === false ? record : mergeTitle(existing?.record, record, detailed)
    const now = Date.now()
    sql(
      this.db,
      `INSERT INTO titles (id, kind, data, detailed_at, updated_at, verified) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
         detailed_at = CASE WHEN titles.verified = 0 THEN excluded.detailed_at
           ELSE COALESCE(excluded.detailed_at, titles.detailed_at) END,
         verified = 1`,
    ).run(record.id, record.kind, JSON.stringify(merged), detailed ? now : null, now)
    return merged
  }

  /** Stores a title from an import file only when nothing is known about it yet. */
  putImported(record: TitleRecord) {
    sql(
      this.db,
      `INSERT INTO titles (id, kind, data, detailed_at, updated_at, verified) VALUES (?, ?, ?, NULL, ?, 0)
       ON CONFLICT(id) DO NOTHING`,
    ).run(record.id, record.kind, JSON.stringify(record), Date.now())
  }

  remember(records: TitleRecord[]) {
    for (const record of records) {
      this.recentRecords.delete(record.id)
      this.recentRecords.set(record.id, record)
    }
    while (this.recentRecords.size > 5000)
      this.recentRecords.delete(this.recentRecords.keys().next().value!)
  }

  recent(id: string) {
    return this.recentRecords.get(id)
  }
}
