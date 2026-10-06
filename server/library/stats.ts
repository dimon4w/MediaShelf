import type { Kind, LibraryStats, Status, TitleRecord } from '../../shared/types.ts'
import { KINDS, STATUSES } from '../../shared/types.ts'
import { parseJson, sql, type DB } from '../db/index.ts'

const DEFAULT_RUNTIME: Record<Kind, number> = { movie: 110, series: 45, anime: 24, game: 0 }

const zeroKinds = () => Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<Kind, number>

export interface StatsZone {
  /** IANA zone from the browser, e.g. Europe/Chisinau. Preferred: handles DST per date. */
  timeZone?: string
  /** Fallback: current UTC offset in minutes (east positive). */
  offsetMinutes?: number
}

/** Maps a timestamp to the user's calendar date. */
function calendar({ timeZone, offsetMinutes = 0 }: StatsZone) {
  let format: Intl.DateTimeFormat | null = null
  if (timeZone) {
    try {
      format = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      format = null
    }
  }
  const offset = Math.max(-840, Math.min(840, Math.round(offsetMinutes))) * 60_000
  return (ms: number) => {
    if (format) {
      const [y, m, d] = format.format(ms).split('-').map(Number)
      return { y, m, d }
    }
    const date = new Date(ms + offset)
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
  }
}

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

export function computeStats(db: DB, userId: string, zone: StatsZone = {}): LibraryStats {
  const local = calendar(zone)
  const now = local(Date.now())
  const year = now.y

  const rows = sql(
    db,
    `SELECT e.kind, e.status, e.rating, e.favorite, e.hours, e.watched_episodes, e.added_at,
            e.finished_at, t.data AS title
     FROM entries e JOIN titles t ON t.id = e.title_id WHERE e.user_id = ?`,
  ).all(userId) as {
    kind: Kind
    status: Status
    rating: number | null
    favorite: number
    hours: number | null
    watched_episodes: number
    added_at: number
    finished_at: number | null
    title: string
  }[]

  const byKind = zeroKinds()
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
    Status,
    number
  >
  const ratingDistribution = Array.from({ length: 10 }, () => 0)
  const genres = new Map<string, number>()
  const minutes = { movies: 0, episodes: 0, games: 0 }
  let ratingSum = 0
  let rated = 0
  let favorites = 0
  let completedThisYear = 0
  let addedThisYear = 0

  const months: LibraryStats['completedByMonth'] = []
  for (let i = 11; i >= 0; i--) {
    const date = new Date(Date.UTC(year, now.m - 1 - i, 1))
    months.push({ month: date.toISOString().slice(0, 7), count: 0, byKind: zeroKinds() })
  }
  const monthIndex = new Map(months.map((month, index) => [month.month, index]))

  for (const row of rows) {
    const title = parseJson<Partial<TitleRecord>>(row.title, {})
    byKind[row.kind]++
    byStatus[row.status]++
    if (row.favorite) favorites++
    if (row.rating) {
      rated++
      ratingSum += row.rating
      ratingDistribution[row.rating - 1]++
    }
    if (row.status !== 'dropped')
      for (const genre of title.genres ?? []) genres.set(genre, (genres.get(genre) ?? 0) + 1)
    const runtime = title.runtime || DEFAULT_RUNTIME[row.kind]
    if (row.kind === 'movie' && row.status === 'completed') minutes.movies += runtime
    if (row.kind === 'series' || row.kind === 'anime')
      minutes.episodes += row.watched_episodes * runtime
    if (row.kind === 'game' && row.hours) minutes.games += row.hours * 60
    if (local(row.added_at).y === year) addedThisYear++
    if (row.status === 'completed' && row.finished_at) {
      const finished = local(row.finished_at)
      if (finished.y === year) completedThisYear++
      const index = monthIndex.get(monthKey(finished.y, finished.m))
      if (index !== undefined) {
        months[index].count++
        months[index].byKind[row.kind]++
      }
    }
  }

  const extraHours = sql(
    db,
    'SELECT COALESCE(SUM(hours), 0) AS hours FROM playthroughs WHERE user_id = ?',
  ).get(userId) as { hours: number }
  minutes.games += extraHours.hours * 60

  const { episodes } = sql(
    db,
    'SELECT COUNT(*) AS episodes FROM episode_marks WHERE user_id = ? AND watched_at IS NOT NULL',
  ).get(userId) as { episodes: number }

  // Imported libraries have no activity log, so their dated records count as active days too.
  const stamps = sql(
    db,
    `SELECT created_at AS at FROM activity WHERE user_id = ?
     UNION SELECT added_at FROM entries WHERE user_id = ?
     UNION SELECT finished_at FROM entries WHERE user_id = ? AND finished_at IS NOT NULL
     UNION SELECT watched_at FROM episode_marks WHERE user_id = ? AND watched_at IS NOT NULL
     UNION SELECT finished_at FROM playthroughs WHERE user_id = ? AND finished_at IS NOT NULL`,
  ).all(userId, userId, userId, userId, userId) as { at: number }[]
  const days = [
    ...new Set(
      stamps.map((row) => {
        const day = local(row.at)
        return Date.UTC(day.y, day.m - 1, day.d) / 86_400_000
      }),
    ),
  ].sort((a, b) => a - b)
  let longest = 0
  let run = 0
  let previous: number | null = null
  for (const day of days) {
    if (day === previous) continue
    run = previous !== null && day === previous + 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }

  return {
    total: rows.length,
    byKind,
    byStatus,
    favorites,
    rated,
    averageRating: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
    ratingDistribution,
    completedByMonth: months,
    topGenres: [...genres]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([genre, count]) => ({ genre, count })),
    minutes: {
      movies: Math.round(minutes.movies),
      episodes: Math.round(minutes.episodes),
      games: Math.round(minutes.games),
    },
    episodesWatched: episodes,
    completedThisYear,
    addedThisYear,
    longestStreakDays: longest,
  }
}
