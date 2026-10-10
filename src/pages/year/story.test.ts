import { describe, expect, it } from 'vitest'
import type { LibraryEntry, LibraryStats } from '../../../shared/types.ts'
import { buildYearStory } from './story.ts'

function entry(id: string, over: Partial<LibraryEntry> & { genres?: string[] } = {}): LibraryEntry {
  const { genres = [], ...rest } = over
  return {
    titleId: id,
    kind: 'movie',
    status: 'completed',
    rating: null,
    favorite: false,
    finishedAt: '2026-05-10T12:00:00.000Z',
    title: { id, kind: rest.kind ?? 'movie', names: { original: id }, genres },
    ...rest,
  } as LibraryEntry
}

const stats = {
  addedThisYear: 7,
  completedByMonth: [
    { month: '2025-11', count: 9, byKind: {} },
    { month: '2026-03', count: 1, byKind: {} },
    { month: '2026-05', count: 3, byKind: {} },
    { month: '2026-06', count: 2, byKind: {} },
  ],
} as unknown as LibraryStats

describe('year story', () => {
  const entries = [
    entry('a', { rating: 9, genres: ['Drama', 'Crime'] }),
    entry('b', {
      rating: 10,
      kind: 'game',
      genres: ['Drama'],
      finishedAt: '2026-06-01T10:00:00.000Z',
    }),
    entry('c', { rating: 10, genres: ['Sci-Fi'], finishedAt: '2026-03-01T10:00:00.000Z' }),
    entry('d', { genres: ['Drama'] }),
    entry('last-year', { rating: 10, finishedAt: '2025-12-20T10:00:00.000Z' }),
    entry('planned', { status: 'planned', finishedAt: null }),
  ]
  const story = buildYearStory(2026, stats, entries)

  it('counts only titles finished this year', () => {
    expect(story.completed).toBe(4)
    expect(story.completedByKind).toMatchObject({ movie: 3, game: 1, series: 0, anime: 0 })
  })

  it('keeps this year months and picks the busiest one', () => {
    expect(story.months.map((m) => m.month)).toEqual(['2026-03', '2026-05', '2026-06'])
    expect(story.bestMonth).toEqual({ month: '2026-05', count: 3 })
  })

  it('ranks the top by rating, then by most recent finish', () => {
    expect(story.top.map((e) => e.titleId)).toEqual(['b', 'c', 'a'])
  })

  it('finds the year genres and average rating', () => {
    expect(story.genres[0]).toEqual({ genre: 'Drama', count: 3 })
    expect(story.averageRating).toBe(9.7)
    expect(story.added).toBe(7)
  })

  it('handles an empty year', () => {
    const empty = buildYearStory(2026, { ...stats, completedByMonth: [] } as LibraryStats, [])
    expect(empty.completed).toBe(0)
    expect(empty.bestMonth).toBeNull()
    expect(empty.top).toEqual([])
    expect(empty.averageRating).toBeNull()
  })
})
