import { z } from 'zod'
import { isTitleId, kindOfTitleId } from '../../shared/ids.ts'
import { isStatusAllowed } from '../../shared/status.ts'
import type { LibraryEntry, TitleRecord, User } from '../../shared/types.ts'
import { KINDS, PLATFORMS, STATUSES, STORES } from '../../shared/types.ts'
import { sql, transaction, type DB } from '../db/index.ts'
import { listEntries, listEpisodeMarks, MAX_ENTRIES, MAX_PLAYTHROUGHS } from './entries.ts'
import type { TitleStore } from './titles.ts'

// Imported artwork may only point at the image CDNs the catalogs themselves use.
const IMAGE_HOSTS = [
  'steamstatic.com',
  'steampowered.com',
  'gog-statics.com',
  'gog.com',
  'media-amazon.com',
  'metahub.space',
  'strem.io',
  'tvmaze.com',
  'shikimori.io',
  'shikimori.one',
  'anilist.co',
  'myanimelist.net',
  'wikimedia.org',
]
const httpsUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value)
      return (
        url.protocol === 'https:' &&
        IMAGE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
      )
    } catch {
      return false
    }
  })
const text = (max: number) => z.string().max(max)
const iso = z.iso.datetime({ offset: true }).nullable().optional()

const titleSchema = z.object({
  id: z.string().refine(isTitleId),
  kind: z.enum(KINDS),
  names: z.object({
    original: text(300).min(1),
    en: text(300).optional(),
    ru: text(300).optional(),
  }),
  year: z.number().int().min(1850).max(2200).nullable(),
  poster: httpsUrl.nullable().catch(null),
  backdrop: httpsUrl.nullable().catch(null),
  genres: z.array(text(60)).max(10).catch([]),
  ratings: z
    .array(
      z.object({
        source: z.enum(['imdb', 'steam', 'shikimori', 'metacritic', 'tvmaze', 'anilist']),
        value: z.number().min(0).max(100),
        max: z.union([z.literal(10), z.literal(100)]),
        votes: z.number().int().min(0).optional(),
      }),
    )
    .max(6)
    .catch([]),
  runtime: z.number().int().min(0).max(100000).nullable().optional().catch(null),
  seasons: z.number().int().min(0).max(1000).nullable().optional().catch(null),
  episodes: z.number().int().min(0).max(100000).nullable().optional().catch(null),
  externalIds: z.record(z.string().max(30), text(40)).catch({}),
})

const entrySchema = z.object({
  titleId: z.string().refine(isTitleId),
  status: z.enum(STATUSES),
  rating: z.number().int().min(1).max(10).nullable().catch(null),
  favorite: z.boolean().catch(false),
  notes: text(5000).catch(''),
  progress: z.number().int().min(0).max(100).catch(0),
  platform: z.enum(PLATFORMS).nullable().catch(null),
  store: z.enum(STORES).nullable().catch(null),
  hours: z.number().min(0).max(100000).nullable().catch(null),
  addedAt: iso,
  startedAt: iso,
  finishedAt: iso,
  position: z.number().finite().catch(0),
  title: titleSchema,
  playthroughs: z
    .array(
      z.object({
        label: text(80).catch(''),
        platform: z.enum(PLATFORMS).nullable().catch(null),
        store: z.enum(STORES).nullable().catch(null),
        status: z.enum(STATUSES).catch('in_progress'),
        progress: z.number().int().min(0).max(100).catch(0),
        hours: z.number().min(0).max(100000).nullable().catch(null),
        startedAt: iso,
        finishedAt: iso,
        note: text(2000).catch(''),
      }),
    )
    .max(MAX_PLAYTHROUGHS)
    .catch([]),
  episodes: z
    .array(
      z.object({
        season: z.number().int().min(0).max(500),
        number: z.number().int().min(0).max(100000),
        watchedAt: iso,
        rating: z.number().int().min(1).max(10).nullable().catch(null),
        note: text(2000).catch(''),
      }),
    )
    .max(20000)
    .catch([]),
})

export const importSchema = z.object({
  format: z.literal('mediashelf'),
  version: z.literal(4),
  entries: z.array(z.unknown()).max(MAX_ENTRIES),
})

export function exportLibrary(db: DB, user: User) {
  const entries = listEntries(db, user.id).map((entry: LibraryEntry) => {
    const stored = sql(db, 'SELECT data FROM titles WHERE id = ?').get(entry.titleId) as {
      data: string
    }
    const title = JSON.parse(stored.data) as TitleRecord
    return {
      titleId: entry.titleId,
      status: entry.status,
      rating: entry.rating,
      favorite: entry.favorite,
      notes: entry.notes,
      progress: entry.progress,
      platform: entry.platform,
      store: entry.store,
      hours: entry.hours,
      addedAt: entry.addedAt,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      position: entry.position,
      title: {
        id: title.id,
        kind: title.kind,
        names: title.names,
        year: title.year,
        poster: title.poster,
        backdrop: title.backdrop,
        genres: title.genres,
        ratings: title.ratings,
        runtime: title.runtime ?? null,
        seasons: title.seasons ?? null,
        episodes: title.episodes ?? null,
        externalIds: title.externalIds,
      },
      playthroughs: entry.playthroughs.map(({ id: _id, updatedAt: _updated, ...rest }) => rest),
      episodes: listEpisodeMarks(db, user.id, entry.titleId),
    }
  })
  return {
    format: 'mediashelf' as const,
    version: 4 as const,
    exportedAt: new Date().toISOString(),
    profile: { name: user.name, preferences: user.preferences },
    entries,
  }
}

const ms = (value: string | null | undefined) => (value ? Date.parse(value) : null)

/** Merges an export into the user's library; existing entries are overwritten. */
export function importLibrary(db: DB, titles: TitleStore, userId: string, payload: unknown) {
  const { entries } = importSchema.parse(payload)
  let imported = 0
  let skipped = 0
  transaction(db, () => {
    const { count } = sql(db, 'SELECT COUNT(*) AS count FROM entries WHERE user_id = ?').get(
      userId,
    ) as { count: number }
    let room = MAX_ENTRIES - count
    for (const raw of entries) {
      const parsed = entrySchema.safeParse(raw)
      if (
        !parsed.success ||
        parsed.data.title.id !== parsed.data.titleId ||
        kindOfTitleId(parsed.data.titleId) !== parsed.data.title.kind ||
        !isStatusAllowed(parsed.data.title.kind, parsed.data.status)
      ) {
        skipped++
        continue
      }
      const entry = parsed.data
      const exists = sql(db, 'SELECT 1 FROM entries WHERE user_id = ? AND title_id = ?').get(
        userId,
        entry.titleId,
      )
      if (!exists && room <= 0) {
        skipped++
        continue
      }
      if (!exists) room--
      titles.putImported(entry.title as TitleRecord)
      const now = Date.now()
      sql(
        db,
        `INSERT INTO entries (user_id, title_id, kind, status, rating, favorite, notes, progress, platform,
           store, hours, watched_episodes, total_episodes, next_episode, position, added_at, updated_at,
           started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, title_id) DO UPDATE SET status = excluded.status, rating = excluded.rating,
           favorite = excluded.favorite, notes = excluded.notes, progress = excluded.progress,
           platform = excluded.platform, store = excluded.store, hours = excluded.hours,
           position = excluded.position, updated_at = excluded.updated_at,
           started_at = excluded.started_at, finished_at = excluded.finished_at`,
      ).run(
        userId,
        entry.titleId,
        entry.title.kind,
        entry.status,
        entry.rating,
        entry.favorite ? 1 : 0,
        entry.notes,
        entry.progress,
        entry.title.kind === 'game' ? entry.platform : null,
        entry.title.kind === 'game' ? entry.store : null,
        entry.title.kind === 'game' ? entry.hours : null,
        entry.title.episodes ?? null,
        entry.position,
        ms(entry.addedAt) ?? now,
        now,
        ms(entry.startedAt),
        ms(entry.finishedAt),
      )
      if (entry.title.kind === 'game') {
        sql(db, 'DELETE FROM playthroughs WHERE user_id = ? AND title_id = ?').run(
          userId,
          entry.titleId,
        )
        const insert = sql(
          db,
          `INSERT INTO playthroughs (id, user_id, title_id, label, platform, store, status, progress, hours,
             started_at, finished_at, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const p of entry.playthroughs)
          insert.run(
            crypto.randomUUID(),
            userId,
            entry.titleId,
            p.label,
            p.platform,
            p.store,
            p.status,
            p.progress,
            p.hours,
            ms(p.startedAt),
            ms(p.finishedAt),
            p.note,
            now,
            now,
          )
      } else if (entry.title.kind !== 'movie') {
        const insert = sql(
          db,
          `INSERT INTO episode_marks (user_id, title_id, season, number, watched_at, rating, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT DO UPDATE SET watched_at = excluded.watched_at, rating = excluded.rating, note = excluded.note`,
        )
        for (const e of entry.episodes)
          insert.run(userId, entry.titleId, e.season, e.number, ms(e.watchedAt), e.rating, e.note)
        const { count } = sql(
          db,
          'SELECT COUNT(*) AS count FROM episode_marks WHERE user_id = ? AND title_id = ? AND season > 0 AND watched_at IS NOT NULL',
        ).get(userId, entry.titleId) as { count: number }
        sql(db, 'UPDATE entries SET watched_episodes = ? WHERE user_id = ? AND title_id = ?').run(
          count,
          userId,
          entry.titleId,
        )
      }
      imported++
    }
  })
  return { imported, skipped }
}
