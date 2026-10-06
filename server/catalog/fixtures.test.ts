import { describe, expect, it } from 'vitest'
import { canonicalGenres } from '../../shared/genres.ts'
import { TITLE_ID_PATTERN, kindOfTitleId } from '../../shared/ids.ts'
import { KINDS, type TitleRecord } from '../../shared/types.ts'
import { createFixtureCatalog, fixtureTitles } from './fixtures.ts'

const catalog = createFixtureCatalog()
const ctx = { locale: 'ru', region: 'US' } as const

describe('fixture titles', () => {
  it('has six valid titles per kind with Russian names', () => {
    expect(fixtureTitles).toHaveLength(24)
    for (const kind of KINDS)
      expect(fixtureTitles.filter((title) => title.kind === kind)).toHaveLength(6)
    for (const title of fixtureTitles) {
      expect(title.id).toMatch(TITLE_ID_PATTERN)
      expect(kindOfTitleId(title.id)).toBe(title.kind)
      expect(title.names.original).toBeTruthy()
      expect(title.names.ru).toBeTruthy()
      expect(title.genres).toEqual(canonicalGenres(title.genres))
      expect(title.poster).toBeNull()
      expect(title.backdrop).toBeNull()
      expect(title.ratings[0].value).toBeLessThanOrEqual(title.ratings[0].max)
    }
  })

  it('uses the real ids and names of well-known titles', () => {
    const byId = new Map(fixtureTitles.map((title) => [title.id, title]))
    expect(byId.get('movie-tt0816692')?.names.ru).toBe('Интерстеллар')
    expect(byId.get('series-tt0903747')?.names.ru).toBe('Во все тяжкие')
    expect(byId.get('anime-52991')?.names).toEqual({
      original: 'Sousou no Frieren',
      en: "Frieren: Beyond Journey's End",
      ru: 'Провожающая в последний путь Фрирен',
    })
    expect(byId.get('steam-292030')?.externalIds).toEqual({ steam: '292030', gog: '1640424747' })
  })
})

describe('createFixtureCatalog', () => {
  it('orders chart lists differently', async () => {
    const order = async (list: 'trending' | 'top' | 'new') =>
      (await catalog.charts('movie', list, 1, ctx)).items.map((item) => item.id)
    const [trending, top, fresh] = await Promise.all([
      order('trending'),
      order('top'),
      order('new'),
    ])
    expect(trending).toHaveLength(6)
    expect(top[0]).toBe('movie-tt0111161')
    expect(fresh[0]).toBe('movie-tt6751668')
    expect(new Set([trending.join(), top.join(), fresh.join()]).size).toBe(3)
    expect(await catalog.charts('movie', 'top', 2, ctx)).toEqual({ items: [], hasMore: false })
  })

  it('searches every name case-insensitively', async () => {
    const names = async (query: string, kind: Parameters<typeof catalog.search>[1] = 'all') =>
      (await catalog.search(query, kind, ctx)).items.map((item: TitleRecord) => item.id)
    expect(await names('во все')).toEqual(['series-tt0903747'])
    expect(await names('FRIEREN')).toEqual(['anime-52991'])
    expect(await names('крестный')).toEqual(['movie-tt0068646'])
    expect(await names('the', 'series')).toEqual(['series-tt0386676'])
    expect(await names('x')).toEqual([])
    expect((await catalog.search('witcher', 'all', ctx)).failed).toEqual([])
  })

  it('returns detailed records and null for unknown ids', async () => {
    const record = await catalog.details('movie-tt0816692', ctx)
    expect(record).toMatchObject({ detailed: true, runtime: 169, creators: ['Christopher Nolan'] })
    expect(Object.keys(record?.descriptions ?? {}).sort()).toEqual(['en', 'ru'])
    expect(await catalog.details('movie-tt0000001', ctx)).toBeNull()
  })

  it('builds episode lists for series and anime only', async () => {
    const series = await catalog.episodes('series-tt0903747', ctx)
    expect(series?.seasons.map((season) => season.episodes.length)).toEqual([6, 6])
    const anime = await catalog.episodes('anime-52991', ctx)
    expect(anime?.seasons.map((season) => [season.number, season.episodes.length])).toEqual([
      [1, 12],
    ])
    expect(await catalog.episodes('movie-tt0816692', ctx)).toBeNull()
    expect(await catalog.episodes('series-tt0000001', ctx)).toBeNull()
  })

  it('offers Steam and GOG prices with one discount', async () => {
    const offers = await catalog.offers('steam-292030', 'PL')
    expect(offers.map((offer) => offer.store)).toEqual(['steam', 'gog'])
    expect(offers.filter((offer) => offer.discountPercent)).toHaveLength(1)
    expect(offers.every((offer) => offer.currency === 'USD' && offer.region === 'PL')).toBe(true)
    expect(await catalog.offers('movie-tt0816692', 'US')).toEqual([])
  })
})
