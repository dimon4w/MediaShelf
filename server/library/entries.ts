import { randomUUID } from 'node:crypto'
import type { EntryPatch, PlaythroughInput, PlaythroughPatch } from '../../shared/schemas.ts'
import { isStatusAllowed } from '../../shared/status.ts'
import type {
  Episode,
  EpisodeList,
  EpisodeMark,
  Kind,
  LibraryEntry,
  NextEpisode,
  PlatformId,
  Playthrough,
  Status,
  StoreId,
  TitleRecord,
} from '../../shared/types.ts'
import { MAX_ENTRIES, MAX_PLAYTHROUGHS } from '../../shared/limits.ts'
import { isoOrNull, parseJson, sql, transaction, type DB } from '../db/index.ts'
import { ApiError, notFound } from '../http/errors.ts'
import { logActivity } from './activity.ts'
import { summarize } from './titles.ts'

export { MAX_ENTRIES, MAX_PLAYTHROUGHS }

interface EntryRow {
  user_id: string
  title_id: string
  kind: Kind
  status: Status
  rating: number | null
  favorite: number
  notes: string
  progress: number
  platform: string | null
  store: string | null
  hours: number | null
  watched_episodes: number
  total_episodes: number | null
  next_episode: string | null
  position: number
  added_at: number
  updated_at: number
  started_at: number | null
  finished_at: number | null
  title_data?: string
}

interface PlaythroughRow {
  id: string
  user_id: string
  title_id: string
  label: string
  platform: string | null
  store: string | null
  status: Status
  progress: number
  hours: number | null
  started_at: number | null
  finished_at: number | null
  note: string
  created_at: number
  updated_at: number
}

export interface EntryChange {
  entry: LibraryEntry
  statusChanged: { from: Status; to: Status } | null
}

const toMs = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null)

function toPlaythrough(row: PlaythroughRow): Playthrough {
  return {
    id: row.id,
    label: row.label,
    platform: row.platform as PlatformId | null,
    store: row.store as StoreId | null,
    status: row.status,
    progress: row.progress,
    hours: row.hours,
    startedAt: isoOrNull(row.started_at),
    finishedAt: isoOrNull(row.finished_at),
    note: row.note,
    updatedAt: isoOrNull(row.updated_at)!,
  }
}

function toEntry(row: EntryRow, playthroughs: Playthrough[]): LibraryEntry {
  const title = parseJson<TitleRecord | null>(row.title_data, null)
  return {
    titleId: row.title_id,
    kind: row.kind,
    status: row.status,
    rating: row.rating,
    favorite: row.favorite === 1,
    notes: row.notes,
    progress: row.progress,
    platform: row.platform as PlatformId | null,
    store: row.store as StoreId | null,
    hours: row.hours,
    watchedEpisodes: row.watched_episodes,
    totalEpisodes: row.total_episodes,
    nextEpisode: parseJson<NextEpisode | null>(row.next_episode, null),
    addedAt: isoOrNull(row.added_at)!,
    updatedAt: isoOrNull(row.updated_at)!,
    startedAt: isoOrNull(row.started_at),
    finishedAt: isoOrNull(row.finished_at),
    position: row.position,
    playthroughs,
    title: title
      ? summarize(title)
      : {
          id: row.title_id,
          kind: row.kind,
          names: { original: row.title_id },
          year: null,
          poster: null,
          backdrop: null,
          genres: [],
          ratings: [],
          externalIds: {},
        },
  }
}

const ENTRY_SELECT = `SELECT e.*, t.data AS title_data FROM entries e JOIN titles t ON t.id = e.title_id`

function playthroughsFor(db: DB, userId: string, titleId?: string) {
  const rows = (titleId
    ? sql(
        db,
        'SELECT * FROM playthroughs WHERE user_id = ? AND title_id = ? ORDER BY created_at',
      ).all(userId, titleId)
    : sql(db, 'SELECT * FROM playthroughs WHERE user_id = ? ORDER BY created_at').all(
        userId,
      )) as unknown as PlaythroughRow[]
  const grouped = new Map<string, Playthrough[]>()
  for (const row of rows) {
    const list = grouped.get(row.title_id) ?? []
    list.push(toPlaythrough(row))
    grouped.set(row.title_id, list)
  }
  return grouped
}

export function listEntries(db: DB, userId: string): LibraryEntry[] {
  const rows = sql(db, `${ENTRY_SELECT} WHERE e.user_id = ? ORDER BY e.updated_at DESC`).all(
    userId,
  ) as unknown as EntryRow[]
  const playthroughs = playthroughsFor(db, userId)
  return rows.map((row) => toEntry(row, playthroughs.get(row.title_id) ?? []))
}

function getRow(db: DB, userId: string, titleId: string) {
  return sql(db, 'SELECT * FROM entries WHERE user_id = ? AND title_id = ?').get(
    userId,
    titleId,
  ) as EntryRow | undefined
}

export function getEntry(db: DB, userId: string, titleId: string): LibraryEntry | null {
  const row = sql(db, `${ENTRY_SELECT} WHERE e.user_id = ? AND e.title_id = ?`).get(
    userId,
    titleId,
  ) as EntryRow | undefined
  if (!row) return null
  return toEntry(row, playthroughsFor(db, userId, titleId).get(titleId) ?? [])
}

function requireRow(db: DB, userId: string, titleId: string) {
  const row = getRow(db, userId, titleId)
  if (!row) throw notFound('Entry not found')
  return row
}

function topPosition(db: DB, userId: string, status: Status) {
  const row = sql(
    db,
    'SELECT MIN(position) AS position FROM entries WHERE user_id = ? AND status = ?',
  ).get(userId, status) as { position: number | null }
  return (row.position ?? 1) - 1
}

/** Date bookkeeping for a status transition. Mutates `row`. */
function applyStatus(row: EntryRow, to: Status, now: number) {
  const from = row.status
  row.status = to
  if (to === 'completed') {
    row.finished_at = from === 'completed' && row.finished_at ? row.finished_at : now
    row.started_at ??= row.finished_at
  } else if (to === 'planned') {
    row.started_at = null
    row.finished_at = null
  } else {
    row.started_at ??= now
    row.finished_at = null
  }
  if (row.kind === 'movie') row.progress = to === 'completed' ? 100 : 0
  if ((row.kind === 'series' || row.kind === 'anime') && to === 'completed') row.progress = 100
}

function writeRow(db: DB, row: EntryRow) {
  sql(
    db,
    `UPDATE entries SET status = ?, rating = ?, favorite = ?, notes = ?, progress = ?, platform = ?,
       store = ?, hours = ?, watched_episodes = ?, total_episodes = ?, next_episode = ?, position = ?,
       updated_at = ?, started_at = ?, finished_at = ?
     WHERE user_id = ? AND title_id = ?`,
  ).run(
    row.status,
    row.rating,
    row.favorite,
    row.notes,
    row.progress,
    row.platform,
    row.store,
    row.hours,
    row.watched_episodes,
    row.total_episodes,
    row.next_episode,
    row.position,
    row.updated_at,
    row.started_at,
    row.finished_at,
    row.user_id,
    row.title_id,
  )
}

// ---------------------------------------------------------------------------
// Episodes

export function readEpisodeList(db: DB, titleId: string) {
  const row = sql(db, 'SELECT data, fetched_at FROM episode_lists WHERE title_id = ?').get(
    titleId,
  ) as { data: string; fetched_at: number } | undefined
  const list = row ? parseJson<EpisodeList | null>(row.data, null) : null
  return list && row ? { list, fetchedAt: row.fetched_at } : null
}

export function storeEpisodeList(db: DB, titleId: string, list: EpisodeList) {
  sql(
    db,
    `INSERT INTO episode_lists (title_id, data, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(title_id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
  ).run(titleId, JSON.stringify(list), Date.now())
}

const today = () => new Date().toISOString().slice(0, 10)
const episodeKey = (season: number, number: number) => `${season}:${number}`

function regularEpisodes(list: EpisodeList | null): Episode[] {
  if (!list) return []
  return list.seasons
    .filter((season) => season.number >= 1)
    .flatMap((season) => season.episodes)
    .sort((a, b) => a.season - b.season || a.number - b.number)
}

const isAired = (episode: Episode, day: string) => !episode.airdate || episode.airdate <= day

function watchedKeys(db: DB, userId: string, titleId: string) {
  const rows = sql(
    db,
    'SELECT season, number FROM episode_marks WHERE user_id = ? AND title_id = ? AND watched_at IS NOT NULL',
  ).all(userId, titleId) as { season: number; number: number }[]
  return new Set(rows.map((row) => episodeKey(row.season, row.number)))
}

/** Recomputes the denormalised episode counters. Mutates `row`. */
function recomputeEpisodes(db: DB, row: EntryRow, titleEpisodes: number | null | undefined) {
  const list = readEpisodeList(db, row.title_id)?.list ?? null
  const watched = watchedKeys(db, row.user_id, row.title_id)
  const regular = regularEpisodes(list)
  const day = today()
  let watchedCount: number
  let total: number | null
  let next: NextEpisode | null = null
  let caughtUp = false
  if (regular.length) {
    watchedCount = regular.filter((e) => watched.has(episodeKey(e.season, e.number))).length
    total = regular.length
    const upcoming = regular.find((e) => !watched.has(episodeKey(e.season, e.number)))
    if (upcoming)
      next = {
        season: upcoming.season,
        number: upcoming.number,
        name: upcoming.name,
        airdate: upcoming.airdate,
      }
    const aired = regular.filter((e) => isAired(e, day))
    caughtUp = aired.length > 0 && aired.every((e) => watched.has(episodeKey(e.season, e.number)))
  } else {
    watchedCount = [...watched].filter((key) => !key.startsWith('0:')).length
    total = titleEpisodes ?? null
  }
  row.watched_episodes = watchedCount
  row.total_episodes = total
  row.next_episode = next ? JSON.stringify(next) : null
  row.progress =
    row.status === 'completed'
      ? 100
      : total
        ? Math.min(100, Math.round((watchedCount / total) * 100))
        : row.progress
  return { caughtUp, ended: list?.ended ?? null, hasList: regular.length > 0 }
}

function markAllAired(db: DB, row: EntryRow, now: number) {
  const list = readEpisodeList(db, row.title_id)?.list ?? null
  const day = today()
  const insert = sql(
    db,
    `INSERT INTO episode_marks (user_id, title_id, season, number, watched_at, auto) VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT DO UPDATE SET
       auto = CASE WHEN episode_marks.watched_at IS NULL THEN 1 ELSE episode_marks.auto END,
       watched_at = COALESCE(episode_marks.watched_at, excluded.watched_at)`,
  )
  for (const episode of regularEpisodes(list))
    if (isAired(episode, day))
      insert.run(row.user_id, row.title_id, episode.season, episode.number, now)
}

/** Undo of a completion: drop the marks that only the completion added. */
function clearAutoMarks(db: DB, row: EntryRow) {
  sql(
    db,
    `UPDATE episode_marks SET watched_at = NULL, auto = 0
     WHERE user_id = ? AND title_id = ? AND auto = 1`,
  ).run(row.user_id, row.title_id)
  sql(
    db,
    `DELETE FROM episode_marks WHERE user_id = ? AND title_id = ? AND watched_at IS NULL
       AND note = '' AND rating IS NULL`,
  ).run(row.user_id, row.title_id)
}

function titleEpisodeCount(db: DB, titleId: string) {
  const row = sql(db, 'SELECT data FROM titles WHERE id = ?').get(titleId) as
    { data: string } | undefined
  return parseJson<TitleRecord | null>(row?.data, null)?.episodes ?? null
}

/** Refreshes counters after a new episode list arrives (e.g. new episodes aired). */
export function refreshEpisodeCounters(db: DB, userId: string, titleId: string) {
  const row = getRow(db, userId, titleId)
  if (!row || (row.kind !== 'series' && row.kind !== 'anime')) return
  recomputeEpisodes(db, row, titleEpisodeCount(db, titleId))
  writeRow(db, row)
}

export function refreshEpisodeCountersForAll(db: DB, titleId: string) {
  const users = sql(db, 'SELECT user_id FROM entries WHERE title_id = ?').all(titleId) as {
    user_id: string
  }[]
  for (const { user_id } of users) refreshEpisodeCounters(db, user_id, titleId)
}

export function listEpisodeMarks(db: DB, userId: string, titleId: string): EpisodeMark[] {
  const rows = sql(
    db,
    `SELECT season, number, watched_at, rating, note FROM episode_marks
     WHERE user_id = ? AND title_id = ? ORDER BY season, number`,
  ).all(userId, titleId) as {
    season: number
    number: number
    watched_at: number | null
    rating: number | null
    note: string
  }[]
  return rows.map((row) => ({
    season: row.season,
    number: row.number,
    watchedAt: isoOrNull(row.watched_at),
    rating: row.rating,
    note: row.note,
  }))
}

export function markEpisodes(
  db: DB,
  userId: string,
  titleId: string,
  episodes: { season: number; number: number }[],
  watched: boolean,
): EntryChange {
  return transaction(db, () => {
    const row = requireRow(db, userId, titleId)
    if (row.kind !== 'series' && row.kind !== 'anime')
      throw new ApiError(400, 'BAD_REQUEST', 'Only series and anime have episodes')
    const now = Date.now()
    const before = watchedKeys(db, userId, titleId)
    const unique = [...new Map(episodes.map((e) => [episodeKey(e.season, e.number), e])).values()]
    if (watched) {
      const insert = sql(
        db,
        `INSERT INTO episode_marks (user_id, title_id, season, number, watched_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT DO UPDATE SET auto = 0,
           watched_at = COALESCE(episode_marks.watched_at, excluded.watched_at)`,
      )
      for (const e of unique) insert.run(userId, titleId, e.season, e.number, now)
    } else {
      const clear = sql(
        db,
        'UPDATE episode_marks SET watched_at = NULL, auto = 0 WHERE user_id = ? AND title_id = ? AND season = ? AND number = ?',
      )
      for (const e of unique) clear.run(userId, titleId, e.season, e.number)
      sql(
        db,
        `DELETE FROM episode_marks WHERE user_id = ? AND title_id = ? AND watched_at IS NULL
           AND note = '' AND rating IS NULL`,
      ).run(userId, titleId)
    }
    const from = row.status
    const state = recomputeEpisodes(db, row, titleEpisodeCount(db, titleId))
    let target: Status | null = null
    if (watched && state.caughtUp && state.ended) target = 'completed'
    else if (watched && from !== 'in_progress' && from !== 'completed') target = 'in_progress'
    else if (!watched && from === 'completed') target = 'in_progress'
    if (target && target !== from) {
      applyStatus(row, target, now)
      row.position = topPosition(db, userId, target)
      recomputeEpisodes(db, row, titleEpisodeCount(db, titleId))
    }
    row.updated_at = now
    writeRow(db, row)
    const added = unique.filter((e) => !before.has(episodeKey(e.season, e.number)))
    if (watched && added.length) {
      const last = added.at(-1)!
      logActivity(db, userId, titleId, row.kind, 'episodes', {
        count: added.length,
        season: last.season,
        number: last.number,
      })
    }
    if (target && target !== from)
      logActivity(db, userId, titleId, row.kind, 'status', { status: target, from })
    return {
      entry: getEntry(db, userId, titleId)!,
      statusChanged: target && target !== from ? { from, to: target } : null,
    }
  })
}

export function markNextEpisode(db: DB, userId: string, titleId: string): EntryChange {
  const row = requireRow(db, userId, titleId)
  const next = parseJson<NextEpisode | null>(row.next_episode, null)
  if (!next) throw new ApiError(409, 'CONFLICT', 'No next episode')
  return markEpisodes(db, userId, titleId, [next], true)
}

export function setEpisodeNote(
  db: DB,
  userId: string,
  titleId: string,
  input: { season: number; number: number; note?: string; rating?: number | null },
): EpisodeMark[] {
  return transaction(db, () => {
    const row = requireRow(db, userId, titleId)
    if (row.kind !== 'series' && row.kind !== 'anime')
      throw new ApiError(400, 'BAD_REQUEST', 'Only series and anime have episodes')
    sql(
      db,
      `INSERT INTO episode_marks (user_id, title_id, season, number, watched_at, rating, note)
       VALUES (?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT DO UPDATE SET
         note = CASE WHEN ? THEN excluded.note ELSE episode_marks.note END,
         rating = CASE WHEN ? THEN excluded.rating ELSE episode_marks.rating END`,
    ).run(
      userId,
      titleId,
      input.season,
      input.number,
      input.rating ?? null,
      input.note ?? '',
      input.note !== undefined ? 1 : 0,
      input.rating !== undefined ? 1 : 0,
    )
    sql(
      db,
      `DELETE FROM episode_marks WHERE user_id = ? AND title_id = ? AND watched_at IS NULL
         AND note = '' AND rating IS NULL`,
    ).run(userId, titleId)
    sql(db, 'UPDATE entries SET updated_at = ? WHERE user_id = ? AND title_id = ?').run(
      Date.now(),
      userId,
      titleId,
    )
    return listEpisodeMarks(db, userId, titleId)
  })
}

// ---------------------------------------------------------------------------
// Entries

export function createEntry(
  db: DB,
  userId: string,
  title: TitleRecord,
  input: {
    status?: Status
    favorite?: boolean
    rating?: number | null
    platform?: PlatformId | null
  },
): EntryChange & { created: boolean } {
  return transaction(db, () => {
    if (getRow(db, userId, title.id)) {
      const patch: EntryPatch = {}
      if (input.status) patch.status = input.status
      if (input.favorite !== undefined) patch.favorite = input.favorite
      if (input.rating !== undefined) patch.rating = input.rating
      return { ...updateEntry(db, userId, title.id, patch), created: false }
    }
    const { count } = sql(db, 'SELECT COUNT(*) AS count FROM entries WHERE user_id = ?').get(
      userId,
    ) as {
      count: number
    }
    if (count >= MAX_ENTRIES) throw new ApiError(409, 'LIMIT_REACHED', 'Library is full')
    const status = input.status ?? 'planned'
    if (!isStatusAllowed(title.kind, status))
      throw new ApiError(422, 'STATUS_NOT_ALLOWED', 'Status not available for this kind')
    const now = Date.now()
    const row: EntryRow = {
      user_id: userId,
      title_id: title.id,
      kind: title.kind,
      status: 'planned',
      rating: input.rating ?? null,
      favorite: input.favorite ? 1 : 0,
      notes: '',
      progress: 0,
      platform: title.kind === 'game' ? (input.platform ?? null) : null,
      store: null,
      hours: null,
      watched_episodes: 0,
      total_episodes: title.episodes ?? null,
      next_episode: null,
      position: topPosition(db, userId, status),
      added_at: now,
      updated_at: now,
      started_at: null,
      finished_at: null,
    }
    if (status !== 'planned') applyStatus(row, status, now)
    sql(
      db,
      `INSERT INTO entries (user_id, title_id, kind, status, rating, favorite, notes, progress, platform,
         store, hours, watched_episodes, total_episodes, next_episode, position, added_at, updated_at,
         started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.user_id,
      row.title_id,
      row.kind,
      row.status,
      row.rating,
      row.favorite,
      row.notes,
      row.progress,
      row.platform,
      row.store,
      row.hours,
      row.watched_episodes,
      row.total_episodes,
      row.next_episode,
      row.position,
      row.added_at,
      row.updated_at,
      row.started_at,
      row.finished_at,
    )
    if (row.kind === 'series' || row.kind === 'anime') {
      if (status === 'completed') markAllAired(db, row, now)
      recomputeEpisodes(db, row, title.episodes)
      writeRow(db, row)
    }
    logActivity(db, userId, title.id, title.kind, 'added', { status })
    if (input.rating)
      logActivity(db, userId, title.id, title.kind, 'rated', { rating: input.rating })
    return { entry: getEntry(db, userId, title.id)!, statusChanged: null, created: true }
  })
}

export function updateEntry(
  db: DB,
  userId: string,
  titleId: string,
  patch: EntryPatch,
): EntryChange {
  return transaction(db, () => {
    const row = requireRow(db, userId, titleId)
    const original = { ...row }
    const now = Date.now()
    let target: Status | null = null
    if (patch.status && patch.status !== row.status) {
      if (!isStatusAllowed(row.kind, patch.status))
        throw new ApiError(422, 'STATUS_NOT_ALLOWED', 'Status not available for this kind')
      target = patch.status
    }
    if (patch.rating !== undefined) row.rating = patch.rating
    if (patch.favorite !== undefined) row.favorite = patch.favorite ? 1 : 0
    if (patch.notes !== undefined) row.notes = patch.notes
    if (row.kind === 'game') {
      if (patch.platform !== undefined) row.platform = patch.platform
      if (patch.store !== undefined) row.store = patch.store
      if (patch.hours !== undefined) row.hours = patch.hours
      if (patch.progress !== undefined) {
        row.progress = patch.progress
        if (!target && patch.progress > 0 && row.status === 'planned') target = 'in_progress'
      }
    } else if (
      row.kind !== 'movie' &&
      patch.progress !== undefined &&
      row.total_episodes === null
    ) {
      row.progress = patch.progress
    }
    if (target) {
      applyStatus(row, target, now)
      row.position = patch.position ?? topPosition(db, userId, target)
    } else if (patch.position !== undefined) {
      row.position = patch.position
    }
    if (patch.startedAt !== undefined) row.started_at = toMs(patch.startedAt)
    if (patch.finishedAt !== undefined) row.finished_at = toMs(patch.finishedAt)
    if (row.started_at && row.finished_at && row.started_at > row.finished_at)
      throw new ApiError(400, 'VALIDATION', 'Start date is after finish date', {
        fields: { finishedAt: 'before_start' },
      })
    if ((row.kind === 'series' || row.kind === 'anime') && target) {
      if (target === 'completed') markAllAired(db, row, now)
      else if (original.status === 'completed') clearAutoMarks(db, row)
      recomputeEpisodes(db, row, titleEpisodeCount(db, titleId))
    }
    const changed = (Object.keys(row) as (keyof EntryRow)[]).some(
      (key) => row[key] !== original[key],
    )
    if (changed) {
      row.updated_at = now
      writeRow(db, row)
    }
    if (target)
      logActivity(db, userId, titleId, row.kind, 'status', {
        status: target,
        from: original.status,
      })
    if (patch.rating !== undefined && patch.rating !== original.rating && patch.rating !== null)
      logActivity(db, userId, titleId, row.kind, 'rated', { rating: patch.rating })
    if (patch.favorite === true && original.favorite === 0)
      logActivity(db, userId, titleId, row.kind, 'favorite', { favorite: true })
    return {
      entry: getEntry(db, userId, titleId)!,
      statusChanged: target ? { from: original.status, to: target } : null,
    }
  })
}

export function deleteEntry(db: DB, userId: string, titleId: string) {
  const { changes } = sql(db, 'DELETE FROM entries WHERE user_id = ? AND title_id = ?').run(
    userId,
    titleId,
  )
  if (!changes) throw notFound('Entry not found')
}

// ---------------------------------------------------------------------------
// Playthroughs (additional runs of a game)

export function addPlaythrough(
  db: DB,
  userId: string,
  titleId: string,
  input: Required<PlaythroughInput>,
): LibraryEntry {
  return transaction(db, () => {
    const row = requireRow(db, userId, titleId)
    if (row.kind !== 'game') throw new ApiError(400, 'BAD_REQUEST', 'Only games have playthroughs')
    const { count } = sql(
      db,
      'SELECT COUNT(*) AS count FROM playthroughs WHERE user_id = ? AND title_id = ?',
    ).get(userId, titleId) as { count: number }
    if (count >= MAX_PLAYTHROUGHS) throw new ApiError(409, 'LIMIT_REACHED', 'Too many playthroughs')
    const now = Date.now()
    sql(
      db,
      `INSERT INTO playthroughs (id, user_id, title_id, label, platform, store, status, progress, hours,
         started_at, finished_at, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      userId,
      titleId,
      input.label,
      input.platform,
      input.store,
      input.status,
      input.progress,
      input.hours,
      toMs(input.startedAt) ?? (input.status === 'planned' ? null : now),
      toMs(input.finishedAt) ?? (input.status === 'completed' ? now : null),
      input.note,
      now,
      now,
    )
    sql(db, 'UPDATE entries SET updated_at = ? WHERE user_id = ? AND title_id = ?').run(
      now,
      userId,
      titleId,
    )
    logActivity(db, userId, titleId, row.kind, 'playthrough', {
      label: input.label,
      status: input.status,
    })
    return getEntry(db, userId, titleId)!
  })
}

export function updatePlaythrough(
  db: DB,
  userId: string,
  titleId: string,
  id: string,
  patch: PlaythroughPatch,
): LibraryEntry {
  return transaction(db, () => {
    const row = sql(
      db,
      'SELECT * FROM playthroughs WHERE id = ? AND user_id = ? AND title_id = ?',
    ).get(id, userId, titleId) as PlaythroughRow | undefined
    if (!row) throw notFound('Playthrough not found')
    const now = Date.now()
    const next = { ...row }
    if (patch.label !== undefined) next.label = patch.label
    if (patch.platform !== undefined) next.platform = patch.platform
    if (patch.store !== undefined) next.store = patch.store
    if (patch.progress !== undefined) next.progress = patch.progress
    if (patch.hours !== undefined) next.hours = patch.hours
    if (patch.note !== undefined) next.note = patch.note
    if (patch.status !== undefined && patch.status !== row.status) {
      next.status = patch.status
      if (patch.status === 'completed') next.finished_at = now
      else next.finished_at = null
      if (patch.status !== 'planned') next.started_at ??= now
    }
    if (patch.startedAt !== undefined) next.started_at = toMs(patch.startedAt)
    if (patch.finishedAt !== undefined) next.finished_at = toMs(patch.finishedAt)
    sql(
      db,
      `UPDATE playthroughs SET label = ?, platform = ?, store = ?, status = ?, progress = ?, hours = ?,
         started_at = ?, finished_at = ?, note = ?, updated_at = ? WHERE id = ?`,
    ).run(
      next.label,
      next.platform,
      next.store,
      next.status,
      next.progress,
      next.hours,
      next.started_at,
      next.finished_at,
      next.note,
      now,
      id,
    )
    sql(db, 'UPDATE entries SET updated_at = ? WHERE user_id = ? AND title_id = ?').run(
      now,
      userId,
      titleId,
    )
    return getEntry(db, userId, titleId)!
  })
}

export function deletePlaythrough(
  db: DB,
  userId: string,
  titleId: string,
  id: string,
): LibraryEntry {
  const { changes } = sql(
    db,
    'DELETE FROM playthroughs WHERE id = ? AND user_id = ? AND title_id = ?',
  ).run(id, userId, titleId)
  if (!changes) throw notFound('Playthrough not found')
  return getEntry(db, userId, titleId)!
}
