import { describe, expect, it } from 'vitest'
import {
  cinemetaCatalogUrl,
  cinemetaEpisodes,
  cinemetaMetaUrl,
  metahubPoster,
  normalizeCinemetaCatalog,
  normalizeCinemetaMeta,
} from './cinemeta.ts'
import { fixture } from './testing.ts'

const meta = (name: string) => fixture<{ meta: unknown }>(name).meta

describe('Cinemeta URLs', () => {
  it('uses the catalog host and year pagination syntax', () => {
    expect(cinemetaCatalogUrl('movie', 'trending', 50, 0)).toBe(
      'https://cinemeta-catalogs.strem.io/top/catalog/movie/top/skip=50.json',
    )
    expect(cinemetaCatalogUrl('series', 'new', 0, 2026)).toBe(
      'https://cinemeta-catalogs.strem.io/year/catalog/series/year/genre=2026.json',
    )
    expect(cinemetaCatalogUrl('movie', 'new', 100, 2026)).toBe(
      'https://cinemeta-catalogs.strem.io/year/catalog/movie/year/genre=2026&skip=100.json',
    )
    expect(cinemetaMetaUrl('series', 'tt0903747')).toBe(
      'https://v3-cinemeta.strem.io/meta/series/tt0903747.json',
    )
    expect(metahubPoster('https://images.metahub.space/poster/small/tt1/img')).toBe(
      'https://images.metahub.space/poster/medium/tt1/img',
    )
  })
})

describe('normalizeCinemetaCatalog', () => {
  it('maps catalog metas to summary records', () => {
    const { items, hasMore } = normalizeCinemetaCatalog(fixture('cinemeta-catalog.json'), 'movie')
    expect(hasMore).toBe(true)
    expect(items).toHaveLength(3)
    expect(items[1]).toEqual({
      id: 'movie-tt28014327',
      kind: 'movie',
      names: { original: 'Mayday', en: 'Mayday' },
      year: 2026,
      poster: 'https://images.metahub.space/poster/medium/tt28014327/img',
      backdrop: 'https://images.metahub.space/background/medium/tt28014327/img',
      genres: ['Action', 'Adventure', 'Comedy'],
      ratings: [{ source: 'imdb', value: 6.9, max: 10 }],
      runtime: 111,
      links: [{ source: 'imdb', url: 'https://www.imdb.com/title/tt28014327/' }],
      externalIds: { imdb: 'tt28014327' },
    })
    expect(
      items.every((item) => item.descriptions === undefined && item.detailed === undefined),
    ).toBe(true)
  })

  it('skips entries without a usable IMDb id or name', () => {
    const { items } = normalizeCinemetaCatalog(
      { metas: [{ id: 'kitsu:1', name: 'X' }, { id: 'tt1234567' }, 'bad'] },
      'series',
    )
    expect(items).toEqual([])
  })
})

describe('normalizeCinemetaMeta (detailed)', () => {
  it('reads a movie meta', () => {
    const record = normalizeCinemetaMeta(meta('cinemeta-meta-movie.json'), 'movie', true)
    expect(record).toMatchObject({
      id: 'movie-tt0816692',
      names: { original: 'Interstellar', en: 'Interstellar' },
      year: 2014,
      runtime: 169,
      genres: ['Adventure', 'Drama', 'Sci-Fi'],
      ratings: [{ source: 'imdb', value: 8.7, max: 10 }],
      creators: ['Christopher Nolan'],
      cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
      country: 'United States, United Kingdom, Canada',
      releaseDate: '2014-11-07',
      trailer: { type: 'youtube' },
    })
    expect(record?.descriptions?.en).toMatch(/^When Earth becomes uninhabitable/)
    expect(record?.endYear).toBeUndefined()
  })

  it('reads a series meta with season counts that exclude specials', () => {
    const record = normalizeCinemetaMeta(meta('cinemeta-meta-series.json'), 'series', true)
    expect(record).toMatchObject({
      id: 'series-tt0903747',
      year: 2008,
      endYear: 2013,
      airing: 'ended',
      creators: ['Vince Gilligan'],
      seasons: 2,
      episodes: 3,
    })
  })

  it('understands the cinemeta-live shape behind the v3 redirect', () => {
    const record = normalizeCinemetaMeta(meta('cinemeta-meta-live.json'), 'series', true)
    expect(record?.creators).toEqual(['Vince Gilligan'])
    expect(record?.cast).toEqual(['Bryan Cranston', 'Aaron Paul'])
    expect(record?.poster).toMatch(/^https:\/\/live\.metahub\.space\/poster\/medium\//)
  })

  it('treats open-ended ranges as still running', () => {
    const record = normalizeCinemetaMeta(
      { id: 'tt2861424', name: 'Rick and Morty', releaseInfo: '2013–', status: 'Continuing' },
      'series',
    )
    expect(record).toMatchObject({ year: 2013, endYear: null, airing: 'airing' })
  })
})

describe('cinemetaEpisodes', () => {
  it('groups videos by season with specials in season 0', () => {
    const list = cinemetaEpisodes(fixture('cinemeta-meta-series.json'))
    expect(list?.source).toBe('cinemeta')
    expect(list?.ended).toBe(true)
    expect(list?.seasons.map((season) => [season.number, season.episodes.length])).toEqual([
      [0, 1],
      [1, 2],
      [2, 1],
    ])
    expect(list?.seasons[1].episodes[0]).toEqual({
      season: 1,
      number: 1,
      name: 'Pilot',
      airdate: '2008-01-21',
      runtime: 49,
    })
  })

  it('reads episode titles from either `name` or `title`', () => {
    expect(cinemetaEpisodes(fixture('cinemeta-meta-live.json'))?.seasons[0].episodes[1].name).toBe(
      "Cat's in the Bag...",
    )
    expect(cinemetaEpisodes({})).toBeNull()
  })
})
