import { describe, expect, it } from 'vitest'
import type { TitleRecord } from '../../shared/types.ts'
import { TOP_MOVIES } from './curated.ts'
import { createCatalogService } from './service.ts'
import { fakeFetch, fixture, testHttp, type FakeReply } from './testing.ts'
import { CatalogUnavailableError, memoryCache, type CatalogContext } from './types.ts'

const en: CatalogContext = { locale: 'en', region: 'US' }
const ru: CatalogContext = { locale: 'ru', region: 'US' }

function steamInput(url: string): {
  context: { language: string; country_code: string }
  data_request: object
} {
  return JSON.parse(url.slice(url.indexOf('input_json=') + 'input_json='.length))
}

const imdbInterstellar = {
  d: [
    {
      id: 'tt0816692',
      l: 'Interstellar',
      qid: 'movie',
      y: 2014,
      rank: 181,
      i: { imageUrl: 'https://m.media-amazon.com/images/M/x@._V1_.jpg' },
    },
    { id: 'tt4415360', l: 'The Science of Interstellar', qid: 'movie', y: 2014, rank: 181129 },
  ],
}

const DEFAULT_ROUTES: [RegExp, FakeReply][] = [
  [
    /IStoreBrowseService\/GetItems/,
    (url: string) => {
      const input = steamInput(url)
      if (input.context.language === 'russian') return fixture('steam-getitems-names-ru.json')
      if (input.context.country_code === 'PL' && Object.keys(input.data_request).length === 0) {
        return fixture('steam-getitems-offer-pl.json')
      }
      return fixture('steam-getitems.json')
    },
  ],
  [/tagdata\/populartags/, fixture('steam-tags.json')],
  [/GetMostPlayedGames/, fixture('steam-mostplayed.json')],
  [/IStoreQueryService\/Query/, fixture('steam-query.json')],
  [/api\/storesearch\/\?term=witcher/, fixture('steam-search.json')],
  [/api\/storesearch/, { total: 0, items: [] }],
  [
    /store\.steampowered\.com\/api\/appdetails/,
    (url: string) => {
      const appid = url.match(/appids=(\d+)/)?.[1] ?? ''
      const priceOnly = url.includes('filters=price_overview')
      if (appid === '1145360' && priceOnly && url.includes('cc=pl'))
        return fixture('steam-appdetails-price-pl.json')
      if (appid === '1145360' && !priceOnly) return fixture('steam-appdetails.json')
      if (appid === '730' && priceOnly) return fixture('steam-appdetails-free.json')
      if (appid === '292030' && priceOnly) {
        return {
          '292030': {
            success: true,
            data: {
              price_overview: { currency: 'USD', initial: 3999, final: 999, discount_percent: 75 },
            },
          },
        }
      }
      return { [appid]: { success: false } }
    },
  ],
  [/appreviews/, fixture('steam-appreviews.json')],
  [
    /catalog\.gog\.com\/v1\/catalog\?query=like:(witcher|The Witcher)/i,
    fixture('gog-catalog.json'),
  ],
  [/catalog\.gog\.com/, { products: [] }],
  [/api\.gog\.com\/products\/1207664663/, fixture('gog-product.json')],
  [/suggestion\/x\/witcher\.json/, fixture('imdb-suggestion.json')],
  [/suggestion\/x\/(интерстеллар|tt0816692)\.json/, imdbInterstellar],
  [/suggestion\//, { d: [] }],
  [
    /cinemeta-catalogs\.strem\.io\/top\/catalog\/movie\/top\/skip=0\.json/,
    fixture('cinemeta-catalog.json'),
  ],
  [/cinemeta-catalogs\.strem\.io/, { metas: [], hasMore: false }],
  [/v3-cinemeta\.strem\.io\/meta\/movie\/tt0816692\.json/, fixture('cinemeta-meta-movie.json')],
  [/v3-cinemeta\.strem\.io\/meta\/series\/tt0903747\.json/, fixture('cinemeta-meta-series.json')],
  [/v3-cinemeta\.strem\.io\/meta\//, {}],
  [/api\.tvmaze\.com\/lookup\/shows\?imdb=tt0903747/, fixture('tvmaze-show.json')],
  [/api\.tvmaze\.com\/shows\/169\/episodes/, fixture('tvmaze-episodes.json')],
  [/api\.tvmaze\.com\/shows\/169/, fixture('tvmaze-show.json')],
  [/api\.tvmaze\.com/, 404],
  [/shikimori\.io\/api\/animes\/52991\/screenshots/, fixture('shikimori-screenshots.json')],
  [/shikimori\.io\/api\/animes\/52991\/videos/, fixture('shikimori-videos.json')],
  [/shikimori\.io\/api\/animes\/52991$/, fixture('shikimori-anime.json')],
  [/shikimori\.io\/api\/animes\/\d+$/, 404],
  [/shikimori\.io\/api\/animes\?search=/, []],
  [
    /shikimori\.io\/api\/animes\?ids=/,
    [
      {
        id: 59970,
        name: 'Tensei Shitara Slime Datta Ken 4th Season',
        russian: 'О моём перерождении в слизь 4',
        score: '8.2',
        status: 'released',
        kind: 'tv',
      },
    ],
  ],
  [/shikimori\.io\/api\/animes\?/, fixture('shikimori-list.json')],
  [
    /graphql\.anilist\.co/,
    (_url: string, init?: RequestInit) =>
      String(init?.body).includes('Media(idMal')
        ? fixture('anilist-media.json')
        : fixture('anilist-page.json'),
  ],
  [/api\.jikan\.moe/, 504],
  [/query\.wikidata\.org.*P1733/s, fixture('wikidata-claims.json')],
  [/query\.wikidata\.org/, fixture('wikidata-labels.json')],
  [/www\.wikidata\.org\/w\/api\.php/, fixture('wikidata-search.json')],
  [/ru\.wikipedia\.org\/api\/rest_v1\/page\/summary\//, fixture('wikipedia-summary.json')],
]

function setup(overrides: [RegExp, FakeReply][] = []) {
  const fake = fakeFetch([...overrides, ...DEFAULT_ROUTES])
  const catalog = createCatalogService({
    cache: memoryCache(),
    http: testHttp(fake.fetch),
    now: () => new Date('2026-09-25T12:00:00Z'),
  })
  return { catalog, fake }
}

const ids = (items: TitleRecord[]) => items.map((item) => item.id)

describe('search', () => {
  it('merges sources, folds GOG into Steam and orders by relevance', async () => {
    const { catalog } = setup()
    const result = await catalog.search('witcher', 'all', en)
    expect(result.failed).toEqual([])
    expect(ids(result.items)).toEqual([
      'series-tt5180504',
      'steam-292030',
      'steam-20920',
      'series-tt12785720',
      'movie-tt11657662',
      'movie-tt15495150',
      'movie-tt28283547',
      'gog-1971477531',
      'series-tt1070742',
    ])
    const witcher3 = result.items[1]
    expect(witcher3.externalIds).toEqual({ steam: '292030', gog: '1640424747' })
    expect(witcher3.links?.map((link) => link.source)).toEqual(['steam', 'gog'])
    expect(result.items[2].externalIds.gog).toBe('1207658930')
  })

  it('filters by kind', async () => {
    const { catalog, fake } = setup()
    const result = await catalog.search('witcher', 'movie', en)
    expect(result.items.every((item) => item.kind === 'movie')).toBe(true)
    expect(result.items).toHaveLength(3)
    expect(fake.count(/storesearch|shikimori/)).toBe(0)
  })

  it('reports failed sources and keeps partial results', async () => {
    const { catalog } = setup([[/shikimori\.io/, 500]])
    const result = await catalog.search('witcher', 'all', en)
    expect(result.failed).toEqual(['shikimori'])
    expect(result.items.length).toBeGreaterThan(5)
  })

  it('answers without a source that hangs past the deadline', async () => {
    const hang = () => new Promise(() => undefined)
    const fake = fakeFetch([[/shikimori\.io/, hang], ...DEFAULT_ROUTES])
    const catalog = createCatalogService({
      cache: memoryCache(),
      http: testHttp(fake.fetch),
      now: () => new Date('2026-09-25T12:00:00Z'),
      searchDeadlineMs: 50,
    })
    const started = Date.now()
    const result = await catalog.search('witcher', 'all', en)
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(result.failed).toEqual(['shikimori'])
    expect(result.items.length).toBeGreaterThan(5)
  })

  it('throws CatalogUnavailableError when every source fails', async () => {
    const { catalog } = setup([[/./, new TypeError('fetch failed')]])
    await expect(catalog.search('witcher', 'all', en)).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    )
  })

  it('ignores queries shorter than two characters without calling upstreams', async () => {
    const { catalog, fake } = setup()
    expect(await catalog.search('  a ', 'all', en)).toEqual({ items: [], failed: [] })
    expect(fake.calls).toHaveLength(0)
  })

  it('finds titles by Russian name through Wikidata', async () => {
    const { catalog } = setup()
    const result = await catalog.search('интерстеллар', 'all', ru)
    expect(result.failed).toEqual([])
    expect(result.items[0]).toMatchObject({
      id: 'movie-tt0816692',
      names: { original: 'Interstellar', ru: 'Интерстеллар' },
      externalIds: { imdb: 'tt0816692', wikidata: 'Q13417189' },
    })
  })

  it('caches results', async () => {
    const { catalog, fake } = setup()
    await catalog.search('witcher', 'all', en)
    const calls = fake.calls.length
    await catalog.search('Witcher ', 'all', en)
    expect(fake.calls).toHaveLength(calls)
  })
})

describe('charts', () => {
  it('ranks the curated Steam top list by review score with Russian names', async () => {
    const { catalog } = setup()
    const page = await catalog.charts('game', 'top', 1, ru)
    expect(ids(page.items)).toEqual(['steam-1145360', 'steam-292030'])
    expect(page.hasMore).toBe(false)
    expect(page.items[1].names.ru).toBe('Ведьмак 3: Дикая Охота — Полное издание')
    expect(page.items[0].names.ru).toBeUndefined()
  })

  it('interleaves most played and top sellers, dropping software', async () => {
    const { catalog } = setup()
    const page = await catalog.charts('game', 'trending', 1, en)
    expect(ids(page.items)).toEqual(['steam-730', 'steam-3669870', 'steam-1867240'])
  })

  it('survives one failing Steam chart and fails when both do', async () => {
    const partial = setup([[/GetMostPlayedGames/, 500]])
    expect(ids((await partial.catalog.charts('game', 'trending', 1, en)).items)).toEqual([
      'steam-3669870',
      'steam-1867240',
    ])
    const broken = setup([[/GetMostPlayedGames|IStoreQueryService/, 500]])
    await expect(broken.catalog.charts('game', 'trending', 1, en)).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    )
  })

  it('lists recent releases for game/new', async () => {
    const { catalog, fake } = setup()
    const page = await catalog.charts('game', 'new', 1, en)
    expect(ids(page.items)).toEqual(['steam-3669870', 'steam-1867240'])
    const query = fake.calls.find((call) => call.url.includes('IStoreQueryService'))
    expect(decodeURIComponent(query?.url ?? '')).toContain(
      '"release_date_filter":{"release_date_type":1',
    )
  })

  it('adds Russian titles for movies only when the reader wants Russian', async () => {
    const labels = {
      results: {
        bindings: [
          {
            imdb: { value: 'tt28014327' },
            item: { value: 'http://www.wikidata.org/entity/Q1' },
            label: { value: 'Сигнал бедствия' },
          },
        ],
      },
    }
    const { catalog, fake } = setup([[/query\.wikidata\.org/, labels]])
    const english = await catalog.charts('movie', 'trending', 1, en)
    expect(english.items).toHaveLength(3)
    expect(english.hasMore).toBe(false)
    expect(fake.count(/query\.wikidata\.org/)).toBe(0)
    expect(english.items[1].names.ru).toBeUndefined()

    const russian = await catalog.charts('movie', 'trending', 1, ru)
    expect(russian.items[1].names).toEqual({
      original: 'Mayday',
      en: 'Mayday',
      ru: 'Сигнал бедствия',
    })
    expect(fake.count(/query\.wikidata\.org/)).toBe(1)

    // English readers get labels that are already cached, without a new query.
    expect((await catalog.charts('movie', 'trending', 1, en)).items[1].names.ru).toBe(
      'Сигнал бедствия',
    )
    expect(fake.count(/query\.wikidata\.org/)).toBe(1)
  })

  it('pages through the curated movie top list and tolerates single failures', async () => {
    const meta = (url: string) => {
      const imdb = url.match(/meta\/movie\/(tt\d+)\.json/)?.[1]
      return imdb === 'tt0068646'
        ? 500
        : { meta: { id: imdb, name: `Title ${imdb}`, releaseInfo: '2000', imdbRating: '8.5' } }
    }
    const { catalog } = setup([[/v3-cinemeta\.strem\.io\/meta\/movie\//, meta]])
    const first = await catalog.charts('movie', 'top', 1, en)
    expect(first.hasMore).toBe(true)
    expect(ids(first.items)).toEqual(
      TOP_MOVIES.slice(0, 30)
        .filter((id) => id !== 'tt0068646')
        .map((id) => `movie-${id}`),
    )
    const last = await catalog.charts('movie', 'top', 6, en)
    expect(last.items).toHaveLength(TOP_MOVIES.length - 150)
    expect(last.hasMore).toBe(false)
  })

  it('merges AniList trending with Russian names from Shikimori', async () => {
    const { catalog } = setup()
    const page = await catalog.charts('anime', 'trending', 1, ru)
    expect(ids(page.items)).toEqual(['anime-59970', 'anime-63129'])
    expect(page.items[0].names).toMatchObject({
      en: 'That Time I Got Reincarnated as a Slime Season 4',
      ru: 'О моём перерождении в слизь 4',
    })
    expect(page.items[0].ratings.map((rating) => rating.source)).toEqual(['shikimori', 'anilist'])
    expect(page.items[0].poster).toMatch(/anilist\.co/)
    expect(page.hasMore).toBe(false)
  })

  it('uses the Shikimori ranking for anime/top', async () => {
    const { catalog, fake } = setup()
    const page = await catalog.charts('anime', 'top', 1, en)
    expect(ids(page.items)).toEqual(['anime-52991', 'anime-63816', 'anime-21'])
    expect(fake.calls.some((call) => call.url.includes('order=ranked'))).toBe(true)
  })

  it('caches chart pages and clamps odd page numbers', async () => {
    const { catalog, fake } = setup()
    await catalog.charts('anime', 'top', 1, en)
    const calls = fake.calls.length
    expect(ids((await catalog.charts('anime', 'top', 0, en)).items)).toHaveLength(3)
    expect(fake.calls).toHaveLength(calls)
    expect(await catalog.charts('anime', 'top', 99, en)).toEqual({ items: [], hasMore: false })
  })
})

describe('details', () => {
  it('combines GetItems, appdetails and reviews for Steam games', async () => {
    const russianItem = {
      response: {
        store_items: [
          {
            appid: 1145360,
            name: 'Hades',
            success: 1,
            basic_info: { short_description: 'Бросьте вызов богу мёртвых.' },
          },
        ],
      },
    }
    const { catalog } = setup([[/GetItems.*"language":"russian"/, russianItem]])
    const record = await catalog.details('steam-1145360', { locale: 'ru', region: 'PL' })
    expect(record).toMatchObject({
      id: 'steam-1145360',
      detailed: true,
      names: { original: 'Hades', en: 'Hades' },
      genres: ['Action Roguelike', 'Roguelite', 'Hack and Slash', 'Indie', 'Mythology'],
      ratings: [
        { source: 'steam', value: 97, max: 100, votes: 285871 },
        { source: 'metacritic', value: 93, max: 100 },
      ],
      creators: ['Supergiant Games'],
      companies: ['Supergiant Games'],
      platforms: ['pc', 'mac', 'steam-deck'],
      links: [{ source: 'steam', url: 'https://store.steampowered.com/app/1145360/' }],
      externalIds: { steam: '1145360' },
    })
    expect(record?.descriptions?.ru).toBe('Бросьте вызов богу мёртвых.')
    expect(record?.descriptions?.en).toMatch(/^Defy the god of the dead/)
    expect(record?.screenshots).toHaveLength(2)
    expect(record?.trailer).toMatchObject({ type: 'video' })
  })

  it('returns null for unknown ids and non-game Steam apps', async () => {
    const { catalog } = setup()
    expect(await catalog.details('steam-431960', en)).toBeNull()
    expect(await catalog.details('steam-99999999', en)).toBeNull()
    expect(await catalog.details('not-an-id', en)).toBeNull()
    expect(await catalog.details('anime-999999', en)).toBeNull()
  })

  it('merges Shikimori and AniList for anime', async () => {
    const { catalog } = setup()
    const record = await catalog.details('anime-52991', ru)
    expect(record).toMatchObject({
      id: 'anime-52991',
      detailed: true,
      names: {
        original: 'Sousou no Frieren',
        en: "Frieren: Beyond Journey's End",
        ru: 'Провожающая в последний путь Фрирен',
      },
      ratings: [
        { source: 'shikimori', value: 9.25, max: 10 },
        { source: 'anilist', value: 91, max: 100 },
      ],
      creators: ['Madhouse'],
      externalIds: { mal: '52991', anilist: '154587' },
      trailer: { type: 'youtube' },
    })
    expect(record?.poster).toMatch(/^https:\/\/s4\.anilist\.co\//)
    expect(record?.backdrop).toMatch(/\/banner\//)
    expect(Object.keys(record?.descriptions ?? {}).sort()).toEqual(['en', 'ru'])
    expect(record?.screenshots).toHaveLength(2)
    expect(record?.links?.map((link) => link.source)).toEqual(['shikimori', 'anilist'])
  })

  it('adds the Russian title and Wikipedia extract for movies in Russian', async () => {
    const { catalog, fake } = setup()
    const record = await catalog.details('movie-tt0816692', ru)
    expect(record).toMatchObject({
      names: { original: 'Interstellar', en: 'Interstellar', ru: 'Интерстеллар' },
      runtime: 169,
      creators: ['Christopher Nolan'],
      externalIds: { imdb: 'tt0816692', wikidata: 'Q13417189' },
    })
    expect(record?.descriptions?.en).toMatch(/^When Earth becomes uninhabitable/)
    expect(record?.descriptions?.ru).toMatch(/^«Интерстеллар»/)
    expect(record?.links?.map((link) => link.source)).toEqual(['imdb', 'wikipedia'])

    const english = setup()
    const plain = await english.catalog.details('movie-tt0816692', en)
    expect(plain?.descriptions).toEqual({ en: expect.stringMatching(/^When Earth/) })
    expect(english.fake.count(/wikidata|wikipedia/)).toBe(0)
    expect(fake.count(/ru\.wikipedia\.org\/api\//)).toBe(1)
  })

  it('adds TVMaze seasons, network and rating to series', async () => {
    const { catalog } = setup()
    const record = await catalog.details('series-tt0903747', en)
    expect(record).toMatchObject({
      seasons: 5,
      episodes: 62,
      airing: 'ended',
      endYear: 2013,
      companies: ['AMC'],
      ratings: [
        { source: 'imdb', value: 9.5, max: 10 },
        { source: 'tvmaze', value: 9.2, max: 10 },
      ],
      externalIds: { imdb: 'tt0903747', tvmaze: '169' },
    })
    expect(record?.links?.map((link) => link.source)).toEqual(['imdb', 'tvmaze'])
  })

  it('falls back to IMDb suggestions when Cinemeta is down, and throws when everything is', async () => {
    const degraded = setup([[/v3-cinemeta/, 500]])
    expect(await degraded.catalog.details('movie-tt0816692', en)).toMatchObject({
      names: { original: 'Interstellar' },
      year: 2014,
      detailed: true,
    })
    const down = setup([[/v3-cinemeta|suggestion/, 500]])
    await expect(down.catalog.details('movie-tt0816692', en)).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    )
  })

  it('reads GOG-only games from the product API and catalog listing', async () => {
    const { catalog } = setup()
    const record = await catalog.details('gog-1207664663', en)
    expect(record).toMatchObject({
      id: 'gog-1207664663',
      kind: 'game',
      names: { original: 'The Witcher 3: Wild Hunt - Complete Edition' },
      year: 2015,
      releaseDate: '2015-05-19',
      platforms: ['pc'],
      genres: ['RPG', 'Adventure', 'Fantasy'],
      externalIds: { gog: '1207664663' },
      detailed: true,
    })
    expect(record?.descriptions?.en).toMatch(/^Rewards for owning/)
    // The catalog only lists the GOTY pack; the product's own page wins for the link.
    expect(record?.links?.[0]).toEqual({
      source: 'gog',
      url: 'https://www.gog.com/en/game/the_witcher_3_wild_hunt',
    })
    expect(record?.poster).toMatch(/_glx_vertical_cover\.jpg$/)
  })
})

describe('episodes', () => {
  it('uses TVMaze for series with specials in season 0', async () => {
    const { catalog } = setup()
    const list = await catalog.episodes('series-tt0903747', en)
    expect(list?.source).toBe('tvmaze')
    expect(list?.ended).toBe(true)
    expect(list?.seasons.map((season) => season.number)).toEqual([0, 1, 2])
  })

  it('falls back to Cinemeta when TVMaze fails', async () => {
    const { catalog } = setup([[/api\.tvmaze\.com/, 500]])
    const list = await catalog.episodes('series-tt0903747', en)
    expect(list?.source).toBe('cinemeta')
    expect(list?.seasons.map((season) => season.number)).toEqual([0, 1, 2])
  })

  it('numbers anime episodes when Jikan is down and names them when it answers', async () => {
    const down = setup()
    const numbered = await down.catalog.episodes('anime-52991', en)
    expect(numbered).toMatchObject({ source: 'shikimori', ended: true })
    expect(numbered?.seasons).toHaveLength(1)
    expect(numbered?.seasons[0].episodes).toHaveLength(28)
    expect(numbered?.seasons[0].episodes[0]).toEqual({
      season: 1,
      number: 1,
      name: null,
      airdate: null,
      runtime: 24,
    })

    const up = setup([[/api\.jikan\.moe/, fixture('jikan-episodes.json')]])
    const named = await up.catalog.episodes('anime-52991', en)
    expect(named?.source).toBe('jikan')
    expect(named?.seasons[0].episodes[1]).toEqual({
      season: 1,
      number: 2,
      name: 'The First Day',
      airdate: '2009-04-12',
      runtime: 24,
    })
    expect(named?.seasons[0].episodes).toHaveLength(28)
  })

  it('returns null for kinds without episodes and unknown titles', async () => {
    const { catalog } = setup()
    expect(await catalog.episodes('movie-tt0816692', en)).toBeNull()
    expect(await catalog.episodes('steam-1145360', en)).toBeNull()
    expect(await catalog.episodes('anime-999999', en)).toBeNull()
  })
})

describe('offers', () => {
  it('prices Steam in the region currency', async () => {
    const { catalog } = setup()
    expect(await catalog.offers('steam-1145360', 'PL')).toEqual([
      {
        store: 'steam',
        url: 'https://store.steampowered.com/app/1145360/',
        region: 'PL',
        currency: 'PLN',
        price: 2874,
        originalPrice: 11499,
        discountPercent: 75,
        isFree: false,
      },
    ])
  })

  it('adds the matching GOG product', async () => {
    const { catalog } = setup()
    const offers = await catalog.offers('steam-292030', 'US')
    expect(
      offers.map((offer) => [offer.store, offer.price, offer.originalPrice, offer.discountPercent]),
    ).toEqual([
      ['steam', 999, 3999, 75],
      ['gog', 2499, 4999, 50],
    ])
  })

  it('marks free games and ignores non-games', async () => {
    const { catalog } = setup()
    expect(await catalog.offers('steam-730', 'XX')).toEqual([
      {
        store: 'steam',
        url: 'https://store.steampowered.com/app/730/',
        region: 'US',
        price: 0,
        isFree: true,
      },
    ])
    expect(await catalog.offers('movie-tt0816692', 'US')).toEqual([])
  })

  it('throws when Steam is unreachable', async () => {
    const { catalog } = setup([[/steampowered\.com/, new TypeError('fetch failed')]])
    await expect(catalog.offers('steam-1145360', 'US')).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    )
  })
})
