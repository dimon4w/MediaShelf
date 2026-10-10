// Relative import (not @shared): unit tests type-check this file under tsconfig.node.json,
// which has no path aliases.
import { KINDS, type Kind, type LibraryEntry, type LibraryStats } from '../../../shared/types.ts'

/**
 * Everything the year story shows, computed only from what really belongs to the year:
 * titles finished this calendar year (local time), the months of this year, titles added
 * this year. All-time numbers (hours, streak, total episodes) stay on the Stats page.
 */
export interface YearStory {
  year: number
  completed: number
  completedByKind: Record<Kind, number>
  /** Months of this year so far, 'YYYY-MM', oldest first. */
  months: { month: string; count: number }[]
  bestMonth: { month: string; count: number } | null
  /** Up to 5 rated titles finished this year, best first (ties: most recent first). */
  top: LibraryEntry[]
  /** Top 3 genres among titles finished this year. */
  genres: { genre: string; count: number }[]
  averageRating: number | null
  added: number
}

const yearOf = (iso: string | null) => (iso ? new Date(iso).getFullYear() : null)

export function buildYearStory(
  year: number,
  stats: LibraryStats,
  entries: LibraryEntry[],
): YearStory {
  const done = entries.filter((e) => e.status === 'completed' && yearOf(e.finishedAt) === year)

  const completedByKind = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<Kind, number>
  for (const entry of done) completedByKind[entry.kind]++

  const months = stats.completedByMonth
    .filter((m) => m.month.startsWith(`${year}-`))
    .map((m) => ({ month: m.month, count: m.count }))
  let bestMonth: YearStory['bestMonth'] = null
  for (const m of months) if (m.count > (bestMonth?.count ?? 0)) bestMonth = m

  const rated = done.filter((e) => e.rating)
  const top = [...rated]
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) || (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
    )
    .slice(0, 5)

  const genreCounts = new Map<string, number>()
  for (const entry of done)
    for (const genre of entry.title.genres ?? [])
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
  const genres = [...genreCounts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([genre, count]) => ({ genre, count }))

  const averageRating = rated.length
    ? Math.round((rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length) * 10) / 10
    : null

  return {
    year,
    completed: done.length,
    completedByKind,
    months,
    bestMonth,
    top,
    genres,
    averageRating,
    added: stats.addedThisYear,
  }
}
