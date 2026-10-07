import { describe, expect, it } from 'vitest'
import {
  normalizeShikimoriAnime,
  normalizeShikimoriList,
  numberedEpisodes,
  recentSeasons,
  shikimoriEpisodes,
  shikimoriImage,
  shikimoriScreenshots,
  shikimoriStatus,
  shikimoriTrailer,
} from './shikimori.ts'
import { fixture } from './testing.ts'

describe('shikimoriImage', () => {
  it('prefixes relative paths and drops placeholders', () => {
    expect(shikimoriImage('/system/animes/original/52991.jpg?1710731127')).toBe(
      'https://shikimori.io/system/animes/original/52991.jpg?1710731127',
    )
    expect(shikimoriImage('/assets/globals/missing_original.jpg')).toBeUndefined()
    expect(shikimoriImage('https://shikimori.io/x.jpg')).toBe('https://shikimori.io/x.jpg')
    expect(shikimoriImage('http://example.com/x.jpg')).toBeUndefined()
  })
})

describe('shikimoriStatus', () => {
  it('handles stale episode counters', () => {
    // Released titles keep a stale episodes_aired; ongoing ones may report episodes = 0.
    expect(shikimoriStatus({ status: 'released', episodes: 28, episodes_aired: 27 })).toEqual({
      airing: 'ended',
      total: 28,
      aired: 28,
    })
    expect(shikimoriStatus({ status: 'released', episodes: 64, episodes_aired: 0 })).toEqual({
      airing: 'ended',
      total: 64,
      aired: 64,
    })
    expect(shikimoriStatus({ status: 'ongoing', episodes: 0, episodes_aired: 1179 })).toEqual({
      airing: 'airing',
      total: 1179,
      aired: 1179,
    })
    expect(shikimoriStatus({ status: 'ongoing', episodes: 24, episodes_aired: 18 })).toEqual({
      airing: 'airing',
      total: 24,
      aired: 18,
    })
    expect(shikimoriStatus({ status: 'anons', episodes: 12, episodes_aired: 0 })).toEqual({
      airing: 'upcoming',
      total: 12,
      aired: 0,
    })
  })
})

describe('normalizeShikimoriAnime', () => {
  it('reads a full anime with Russian description and ordered genres', () => {
    const record = normalizeShikimoriAnime(fixture('shikimori-anime.json'), true)
    expect(record).toMatchObject({
      id: 'anime-52991',
      kind: 'anime',
      names: {
        original: 'Sousou no Frieren',
        en: "Frieren: Beyond Journey's End",
        ru: 'Провожающая в последний путь Фрирен',
      },
      year: 2023,
      endYear: 2024,
      poster: 'https://shikimori.io/system/animes/original/52991.jpg?1710731127',
      genres: ['Adventure', 'Drama', 'Fantasy', 'Shounen'],
      ratings: [{ source: 'shikimori', value: 9.25, max: 10 }],
      runtime: 24,
      episodes: 28,
      airing: 'ended',
      creators: ['Madhouse'],
      releaseDate: '2023-09-29',
      links: [{ source: 'shikimori', url: 'https://shikimori.io/animes/52991-sousou-no-frieren' }],
      externalIds: { mal: '52991' },
    })
    expect(record?.descriptions?.ru).toMatch(
      /^Одержав победу над Королём демонов, отряд героя Химмеля вернулся домой/,
    )
    expect(record?.descriptions?.ru).not.toMatch(/\[/)
  })

  it('normalises list items, including placeholders and long runners', () => {
    const [frieren, sequel, onePiece] = normalizeShikimoriList(fixture('shikimori-list.json'))
    expect(frieren.descriptions).toBeUndefined()
    expect(sequel).toMatchObject({
      id: 'anime-63816',
      poster: null,
      airing: 'upcoming',
      ratings: [],
      episodes: null,
    })
    expect(onePiece).toMatchObject({
      id: 'anime-21',
      names: { original: 'One Piece', ru: 'Ван-Пис' },
      episodes: 1179,
      airing: 'airing',
      endYear: null,
    })
  })

  it('skips music videos and malformed entries', () => {
    expect(
      normalizeShikimoriList([{ id: 5, name: 'Song', kind: 'music' }, { name: 'No id' }, null]),
    ).toEqual([])
  })
})

describe('media and episodes', () => {
  it('reads screenshots and prefers promo videos for the trailer', () => {
    const shots = shikimoriScreenshots(fixture('shikimori-screenshots.json'))
    expect(shots).toHaveLength(2)
    expect(shots[0]).toMatch(/^https:\/\/shikimori\.io\/system\/screenshots\/original\//)
    const trailer = shikimoriTrailer(fixture('shikimori-videos.json'))
    expect(trailer?.type).toBe('youtube')
    expect(trailer && 'id' in trailer ? trailer.id : '').toMatch(/^[\w-]{11}$/)
    expect(
      shikimoriTrailer([
        { kind: 'episode_preview', hosting: 'youtube', url: 'https://youtu.be/aaaaaaaaaaa' },
      ]),
    ).toBeNull()
  })

  it('builds numbered episode lists', () => {
    expect(numberedEpisodes(2, 24)).toEqual([
      { season: 1, number: 1, name: null, airdate: null, runtime: 24 },
      { season: 1, number: 2, name: null, airdate: null, runtime: 24 },
    ])
    const list = shikimoriEpisodes({
      status: 'ongoing',
      episodes: 12,
      episodes_aired: 3,
      duration: 23,
    })
    expect(list).toMatchObject({ source: 'shikimori', ended: false })
    expect(list.seasons[0].episodes).toHaveLength(3)
  })

  it('names the current and previous season', () => {
    expect(recentSeasons(new Date('2026-09-25T00:00:00Z'))).toBe('spring_2026,summer_2026')
    expect(recentSeasons(new Date('2026-10-02T00:00:00Z'))).toBe('summer_2026,fall_2026')
    expect(recentSeasons(new Date('2027-01-10T00:00:00Z'))).toBe('fall_2026,winter_2027')
  })
})
