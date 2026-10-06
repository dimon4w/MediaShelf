import { describe, expect, it } from 'vitest'
import type { TitleRecord } from '../../shared/types.ts'
import { dedupeRecords, matchTier, mergeRecords, rankByRelevance } from './records.ts'

function record(
  id: string,
  names: TitleRecord['names'],
  extra: Partial<TitleRecord> = {},
): TitleRecord {
  return {
    id,
    kind: 'movie',
    names,
    year: null,
    poster: null,
    backdrop: null,
    genres: [],
    ratings: [],
    externalIds: {},
    ...extra,
  }
}

describe('mergeRecords', () => {
  it('keeps primary scalars and unions names, genres, ratings, links and descriptions', () => {
    const primary = record(
      'anime-1',
      { original: 'Cowboy Bebop', ru: 'Ковбой Бибоп' },
      {
        kind: 'anime',
        year: 1998,
        genres: ['Action', 'Sci-Fi'],
        ratings: [{ source: 'shikimori', value: 8.75, max: 10 }],
        links: [{ source: 'shikimori', url: 'https://shikimori.io/animes/1' }],
        descriptions: { ru: 'Охотники за головами.' },
        externalIds: { mal: '1' },
      },
    )
    const secondary = record(
      'anime-1',
      { original: 'Cowboy Bebop', en: 'Cowboy Bebop' },
      {
        kind: 'anime',
        year: 1999,
        poster: 'https://s4.anilist.co/cover.jpg',
        genres: ['Sci-Fi', 'Space', 'Drama', 'Mystery', 'Adventure'],
        ratings: [
          { source: 'anilist', value: 86, max: 100 },
          { source: 'shikimori', value: 1, max: 10 },
        ],
        links: [{ source: 'anilist', url: 'https://anilist.co/anime/1' }],
        descriptions: { en: 'Bounty hunters.', ru: 'ignored' },
        externalIds: { mal: '1', anilist: '1' },
      },
    )
    const merged = mergeRecords(primary, secondary)
    expect(merged.year).toBe(1998)
    expect(merged.poster).toBe('https://s4.anilist.co/cover.jpg')
    expect(merged.names).toEqual({
      original: 'Cowboy Bebop',
      en: 'Cowboy Bebop',
      ru: 'Ковбой Бибоп',
    })
    expect(merged.genres).toEqual(['Action', 'Sci-Fi', 'Space', 'Drama', 'Mystery'])
    expect(merged.ratings.map((r) => `${r.source}:${r.value}`)).toEqual([
      'shikimori:8.75',
      'anilist:86',
    ])
    expect(merged.links?.map((l) => l.source)).toEqual(['shikimori', 'anilist'])
    expect(merged.descriptions).toEqual({ en: 'Bounty hunters.', ru: 'Охотники за головами.' })
    expect(merged.externalIds).toEqual({ mal: '1', anilist: '1' })
  })

  it('dedupes by id keeping the first position', () => {
    const list = dedupeRecords([
      record('movie-tt1', { original: 'A' }),
      record('movie-tt2', { original: 'B' }),
      record('movie-tt1', { original: 'A', ru: 'А' }),
    ])
    expect(list.map((item) => item.id)).toEqual(['movie-tt1', 'movie-tt2'])
    expect(list[0].names.ru).toBe('А')
  })
})

describe('matchTier', () => {
  it('ranks exact, prefix, word and substring matches', () => {
    expect(matchTier(['The Witcher'], 'witcher')).toBe(4)
    expect(matchTier(['The Witcher'], 'The Witcher')).toBe(4)
    expect(matchTier(['The Witcher 3: Wild Hunt'], 'witcher')).toBe(3)
    expect(matchTier(['Reigns: The Witcher'], 'witcher')).toBe(2)
    expect(matchTier(['Mandragora: Whispers of the Witch Tree'], 'witch tree')).toBe(2)
    expect(matchTier(['Thewitcherverse'], 'witcher')).toBe(1)
    expect(matchTier(['Wild Hunt Witcher'], 'witcher wild')).toBe(1)
    expect(matchTier(['Creature Kitchen'], 'witcher')).toBe(0)
  })

  it('matches any language and folds ё', () => {
    expect(matchTier(['Interstellar', 'Интерстеллар'], 'интерстеллар')).toBe(4)
    expect(matchTier(['Крёстный отец'], 'крестный')).toBe(3)
    expect(matchTier([undefined, 'Во все тяжкие'], 'во все тяжкие')).toBe(4)
  })
})

describe('rankByRelevance', () => {
  it('orders by tier then popularity, merges duplicates and drops strict non-matches', () => {
    const items = rankByRelevance(
      [
        {
          record: record('steam-1', { original: 'The Witcher 3: Wild Hunt' }, { kind: 'game' }),
          weight: 0.9,
        },
        {
          record: record('series-tt1', { original: 'The Witcher' }, { kind: 'series' }),
          weight: 0.5,
        },
        {
          record: record('gog-9', { original: 'Creature Kitchen' }, { kind: 'game' }),
          weight: 0.9,
          strict: true,
        },
        { record: record('movie-tt2', { original: 'The Hexer' }), weight: 0.99 },
        {
          record: record('steam-2', { original: 'The Witcher 2' }, { kind: 'game' }),
          weight: 0.95,
        },
        {
          record: record(
            'steam-1',
            { original: 'The Witcher 3: Wild Hunt', ru: 'Ведьмак 3' },
            { kind: 'game' },
          ),
          weight: 0.1,
        },
      ],
      'witcher',
    )
    expect(items.map((item) => item.id)).toEqual(['series-tt1', 'steam-2', 'steam-1', 'movie-tt2'])
    expect(items.find((item) => item.id === 'steam-1')?.names.ru).toBe('Ведьмак 3')
  })

  it('caps the result size', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      record: record(`movie-tt${i}`, { original: `Alien ${i}` }),
      weight: i / 60,
    }))
    expect(rankByRelevance(many, 'alien', 40)).toHaveLength(40)
  })
})
