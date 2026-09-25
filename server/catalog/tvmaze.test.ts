import { describe, expect, it } from 'vitest'
import {
  normalizeTvmazeEpisodes,
  normalizeTvmazeSearch,
  normalizeTvmazeShow,
  tvmazeEnded,
} from './tvmaze.ts'
import { fixture } from './testing.ts'

describe('normalizeTvmazeShow', () => {
  const show = fixture<Record<string, unknown>>('tvmaze-show.json')

  it('uses the IMDb id when TVMaze knows it', () => {
    const record = normalizeTvmazeShow(show, true)
    expect(record).toMatchObject({
      id: 'series-tt0903747',
      kind: 'series',
      names: { original: 'Breaking Bad' },
      year: 2008,
      airing: 'ended',
      runtime: 60,
      genres: ['Drama', 'Crime', 'Thriller'],
      ratings: [{ source: 'tvmaze', value: 9.2, max: 10 }],
      companies: ['AMC'],
      country: 'United States',
      seasons: 5,
      episodes: 62,
      links: [{ source: 'tvmaze', url: 'https://www.tvmaze.com/shows/169/breaking-bad' }],
      externalIds: { tvmaze: '169', imdb: 'tt0903747' },
    })
    expect(record?.descriptions?.en).toMatch(/^Breaking Bad follows protagonist Walter White/)
    expect(record?.descriptions?.en).not.toContain('<')
    expect(tvmazeEnded(show)).toBe(true)
  })

  it('falls back to tvmaze-<id> without an IMDb id', () => {
    const record = normalizeTvmazeShow({ ...show, externals: { imdb: null } })
    expect(record?.id).toBe('tvmaze-169')
    expect(record?.externalIds).toEqual({ tvmaze: '169' })
    expect(normalizeTvmazeShow({ id: 1 })).toBeNull()
  })

  it('scores search results by TVMaze weight', () => {
    expect(
      normalizeTvmazeSearch(fixture('tvmaze-search.json')).map((hit) => [
        hit.record.id,
        hit.weight,
      ]),
    ).toEqual([
      ['series-tt0903747', 1],
      ['series-tt2387761', 0.62],
    ])
  })
})

describe('normalizeTvmazeEpisodes', () => {
  it('groups by season and numbers specials in season 0 by air date', () => {
    const list = normalizeTvmazeEpisodes(fixture('tvmaze-episodes.json'), true)
    expect(list.source).toBe('tvmaze')
    expect(list.ended).toBe(true)
    expect(list.seasons.map((season) => season.number)).toEqual([0, 1, 2])
    expect(list.seasons[0].episodes).toEqual([
      {
        season: 0,
        number: 1,
        name: 'El Camino: A Breaking Bad Movie',
        airdate: '2019-10-11',
        runtime: 122,
      },
    ])
    expect(list.seasons[1].episodes[0]).toEqual({
      season: 1,
      number: 1,
      name: 'Pilot',
      airdate: '2008-01-20',
      runtime: 60,
    })
  })

  it('orders specials chronologically regardless of input order', () => {
    const list = normalizeTvmazeEpisodes(
      [
        {
          season: 2,
          number: null,
          type: 'insignificant_special',
          name: 'Later',
          airdate: '2020-05-01',
        },
        {
          season: 1,
          number: null,
          type: 'significant_special',
          name: 'Earlier',
          airdate: '2019-01-01',
        },
        { season: 1, number: 1, type: 'regular', name: 'One', airdate: '2019-02-01' },
      ],
      false,
    )
    expect(list.seasons[0].episodes.map((episode) => [episode.number, episode.name])).toEqual([
      [1, 'Earlier'],
      [2, 'Later'],
    ])
    expect(list.ended).toBe(false)
  })
})
