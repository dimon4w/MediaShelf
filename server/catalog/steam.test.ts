import { describe, expect, it } from 'vitest'
import {
  parseAppDetails,
  parseAppReviews,
  parseMostPlayed,
  parseSteamTagNames,
  parseStoreSearch,
  normalizeSteamItem,
  steamGenres,
  steamItemExtras,
  steamOfferFromDetails,
  steamOfferFromItem,
  steamStoreItems,
} from './steam.ts'
import { fixture } from './testing.ts'

const tags = parseSteamTagNames(fixture('steam-tags.json'))
const items = steamStoreItems(fixture('steam-getitems.json'))
const byId = (appid: number) => items.find((item) => (item as { appid?: number }).appid === appid)

describe('normalizeSteamItem', () => {
  it('builds a game summary from GetItems', () => {
    const hades = normalizeSteamItem(byId(1145360), tags)
    expect(hades).toMatchObject({
      appid: 1145360,
      type: 0,
      adult: false,
      visible: true,
      reviews: 285871,
      percentPositive: 97,
    })
    expect(hades?.record).toMatchObject({
      id: 'steam-1145360',
      kind: 'game',
      names: { original: 'Hades', en: 'Hades' },
      year: 2020,
      releaseDate: '2020-09-17',
      poster:
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1145360/library_600x900.jpg?t=1758127023',
      backdrop:
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1145360/library_hero.jpg?t=1758127023',
      genres: ['Action Roguelike', 'Roguelite', 'Hack and Slash', 'Indie', 'Mythology'],
      ratings: [{ source: 'steam', value: 97, max: 100, votes: 285871 }],
      links: [{ source: 'steam', url: 'https://store.steampowered.com/app/1145360/' }],
      externalIds: { steam: '1145360' },
    })
  })

  it('uses hashed asset paths from asset_url_format', () => {
    const witcher = normalizeSteamItem(byId(292030), tags)
    expect(witcher?.record.poster).toMatch(
      /^https:\/\/shared\.fastly\.steamstatic\.com\/store_item_assets\/steam\/apps\/292030\/[0-9a-f]+\/library_capsule\.jpg\?t=\d+$/,
    )
    expect(witcher?.record.year).toBe(2015)
  })

  it('prefers the pre-Steam original release year', () => {
    expect(normalizeSteamItem(byId(20920), tags)?.record.year).toBe(2011)
  })

  it('keeps only genre-like tags', () => {
    const cs2 = normalizeSteamItem(byId(730), tags)
    expect(cs2?.record.genres).toEqual(['FPS', 'Shooter', 'Action', 'Tactical', 'Co-op'])
    expect(
      steamGenres([
        'Singleplayer',
        'Great Soundtrack',
        'Sci-fi',
        'Free to Play',
        'Massively Multiplayer',
      ]),
    ).toEqual(['Sci-Fi', 'Free to Play', 'MMO'])
  })

  it('reports app types so software and DLC can be filtered', () => {
    expect(normalizeSteamItem(byId(431960), tags)?.type).toBe(6)
    const dlc = normalizeSteamItem(byId(5006530), tags)
    expect(dlc?.type).toBe(4)
    expect(dlc?.record.ratings).toEqual([])
    // Coming soon: no library capsule yet, falls back to the header.
    expect(dlc?.record.poster).toMatch(/header_alt_assets_0\.jpg/)
  })

  it('flags adult content and rejects unusable items', () => {
    expect(normalizeSteamItem({ appid: 1, name: 'X', content_descriptorids: [1, 3] })?.adult).toBe(
      true,
    )
    expect(normalizeSteamItem({ appid: 1, name: 'X', success: 2 })).toBeNull()
    expect(normalizeSteamItem({ name: 'No id' })).toBeNull()
    expect(normalizeSteamItem('garbage')).toBeNull()
  })

  it('guesses the library capsule only when assets were not requested', () => {
    expect(normalizeSteamItem({ appid: 10, name: 'Counter-Strike' })?.record.poster).toBe(
      'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/10/library_600x900.jpg',
    )
  })
})

describe('steamItemExtras', () => {
  it('extracts description, platforms, screenshots and the HLS trailer', () => {
    const extras = steamItemExtras(byId(1145360))
    expect(extras.description).toMatch(/^Defy the god of the dead/)
    expect(extras.creators).toEqual(['Supergiant Games'])
    expect(extras.companies).toEqual(['Supergiant Games'])
    expect(extras.platforms).toEqual(['pc', 'mac', 'steam-deck'])
    expect(extras.screenshots).toHaveLength(2)
    for (const shot of extras.screenshots)
      expect(shot).toMatch(/\/ss_[0-9a-f]+\.1920x1080\.jpg\?t=\d+$/)
    expect(extras.trailer).toMatchObject({ type: 'video' })
    const trailer = extras.trailer as { url: string; poster: string }
    expect(trailer.url).toMatch(
      /^https:\/\/video\.fastly\.steamstatic\.com\/store_trailers\/1145360\/.+\/hls_264_master\.m3u8$/,
    )
    expect(trailer.poster).toMatch(/\/steam\/apps\/256801252\/movie_full\.jpg/)
  })
})

describe('parseAppDetails', () => {
  it('finds the app even when the response key differs from the requested appid', () => {
    const payload = fixture<Record<string, unknown>>('steam-appdetails.json')
    expect(Object.keys(payload)).not.toContain('1145360')
    const details = parseAppDetails(payload, 1145360)
    expect(details).toMatchObject({
      appid: 1145360,
      type: 'game',
      name: 'Hades',
      genres: ['Action', 'Indie', 'RPG'],
      metacritic: 93,
      platforms: ['pc', 'mac'],
      isFree: false,
      price: { currency: 'USD', initial: 2499, final: 624, discountPercent: 75 },
    })
    expect(details?.screenshots).toHaveLength(2)
    expect(details?.trailer).toMatchObject({ type: 'video' })
  })

  it('reads price-only and empty responses', () => {
    expect(parseAppDetails(fixture('steam-appdetails-price-pl.json'), 1145360)?.price).toEqual({
      currency: 'PLN',
      initial: 11499,
      final: 2874,
      discountPercent: 75,
    })
    const free = parseAppDetails(fixture('steam-appdetails-free.json'), 730)
    expect(free?.price).toBeUndefined()
    expect(parseAppDetails({ '999': { success: false } }, 999)).toBeNull()
    expect(parseAppDetails(null, 1)).toBeNull()
  })

  it('prefers progressive trailers over HLS when Steam still sends them', () => {
    const payload = {
      '1': {
        success: true,
        data: {
          steam_appid: 1,
          movies: [
            {
              hls_h264: 'https://v/x.m3u8',
              mp4: { max: 'https://v/max.mp4' },
              thumbnail: 'https://v/t.jpg',
            },
          ],
        },
      },
    }
    expect(parseAppDetails(payload, 1)?.trailer).toEqual({
      type: 'video',
      url: 'https://v/max.mp4',
      poster: 'https://v/t.jpg',
    })
  })
})

describe('other Steam payloads', () => {
  it('parses reviews, most played and store search', () => {
    expect(parseAppReviews(fixture('steam-appreviews.json'))).toEqual({
      source: 'steam',
      value: 98,
      max: 100,
      votes: 308722,
    })
    expect(parseAppReviews({ query_summary: { total_reviews: 0 } })).toBeNull()
    expect(parseMostPlayed(fixture('steam-mostplayed.json'))).toEqual([
      730, 570, 578080, 431960, 1867240, 1172470,
    ])
    const search = parseStoreSearch(fixture('steam-search.json'))
    expect(search[1]).toEqual({
      appid: 292030,
      name: 'The Witcher 3: Wild Hunt - Complete Edition',
    })
    expect(search).toHaveLength(6)
  })

  it('builds offers from appdetails and GetItems purchase options', () => {
    const details = parseAppDetails(fixture('steam-appdetails-price-pl.json'), 1145360)
    expect(details && steamOfferFromDetails(details, 'PL')).toEqual({
      store: 'steam',
      url: 'https://store.steampowered.com/app/1145360/',
      region: 'PL',
      currency: 'PLN',
      price: 2874,
      originalPrice: 11499,
      discountPercent: 75,
      isFree: false,
    })
    const [hades, cs2] = steamStoreItems(fixture('steam-getitems-offer-pl.json'))
    expect(steamOfferFromItem(hades, 'PL', 'PLN')).toMatchObject({
      currency: 'PLN',
      price: 2874,
      originalPrice: 11499,
      discountPercent: 75,
    })
    expect(steamOfferFromItem(cs2, 'PL', 'PLN')).toEqual({
      store: 'steam',
      url: 'https://store.steampowered.com/app/730/',
      region: 'PL',
      price: 0,
      isFree: true,
    })
  })
})
