import type { ActivityItem, ActivityType, Kind, TitleRecord } from '../../shared/types.ts'
import { isoOrNull, parseJson, sql, type DB } from '../db/index.ts'

const COALESCE_MS: Partial<Record<ActivityType, number>> = {
  episodes: 30 * 60_000,
  rated: 10 * 60_000,
  status: 2 * 60_000,
}

export function logActivity(
  db: DB,
  userId: string,
  titleId: string,
  kind: Kind,
  type: ActivityType,
  data: ActivityItem['data'] = {},
) {
  const now = Date.now()
  const window = COALESCE_MS[type]
  if (window) {
    const last = sql(
      db,
      'SELECT id, type, title_id, data, created_at FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    ).get(userId) as
      { id: number; type: string; title_id: string; data: string; created_at: number } | undefined
    if (last && last.type === type && last.title_id === titleId && now - last.created_at < window) {
      const previous = parseJson<ActivityItem['data']>(last.data, {})
      const merged =
        type === 'episodes'
          ? { ...data, count: (previous.count ?? 0) + (data.count ?? 0) }
          : type === 'status'
            ? { ...data, from: previous.from ?? data.from }
            : data
      if (type === 'status' && merged.from === merged.status) {
        sql(db, 'DELETE FROM activity WHERE id = ?').run(last.id)
        return
      }
      sql(db, 'UPDATE activity SET data = ?, created_at = ? WHERE id = ?').run(
        JSON.stringify(merged),
        now,
        last.id,
      )
      return
    }
  }
  sql(
    db,
    'INSERT INTO activity (user_id, title_id, kind, type, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(userId, titleId, kind, type, JSON.stringify(data), now)
}

export function listActivity(db: DB, userId: string, limit = 50, before?: number): ActivityItem[] {
  const rows = sql(
    db,
    `SELECT a.id, a.title_id, a.kind, a.type, a.data, a.created_at, t.data AS title
     FROM activity a LEFT JOIN titles t ON t.id = a.title_id
     WHERE a.user_id = ? AND a.id < ? ORDER BY a.id DESC LIMIT ?`,
  ).all(userId, before ?? Number.MAX_SAFE_INTEGER, limit) as {
    id: number
    title_id: string
    kind: Kind
    type: ActivityType
    data: string
    created_at: number
    title: string | null
  }[]
  return rows.map((row) => {
    const title = parseJson<TitleRecord | null>(row.title, null)
    return {
      id: row.id,
      titleId: row.title_id,
      kind: row.kind,
      type: row.type,
      data: parseJson(row.data, {}),
      createdAt: isoOrNull(row.created_at)!,
      title: title
        ? {
            id: title.id,
            kind: title.kind,
            names: title.names,
            poster: title.poster,
            year: title.year,
          }
        : null,
    }
  })
}
