import type {
  ExternalRating,
  PlatformId,
  StoreOffer,
  TitleRecord,
  Trailer,
} from '../../shared/types.ts'
import { canonicalGenres } from '../../shared/genres.ts'
import { titleId } from '../../shared/ids.ts'
import { DAY, HOUR, MINUTE, type HttpClient } from './http.ts'
import {
  asArray,
  asRecord,
  chunk,
  cleanName,
  cleanText,
  dateFromUnix,
  httpsUrl,
  int,
  mapLimit,
  positiveInt,
  records,
  str,
  strings,
  unique,
  type Dict,
} from './util.ts'

export const STEAM_ASSET_BASE = 'https://shared.fastly.steamstatic.com/store_item_assets/'
const STEAM_VIDEO_BASE = 'https://video.fastly.steamstatic.com/store_trailers/'

export function steamStoreUrl(appid: number | string): string {
  return `https://store.steampowered.com/app/${appid}/`
}

/** GetItems `type`: 0 game, 1 demo, 4 DLC, 6 software, 10 hardware, 11 music. */
export const STEAM_TYPE_GAME = 0
/** Content descriptors 3 (adult only sexual content) and 4 (frequent nudity or sexual content). */
export const STEAM_ADULT_DESCRIPTORS: readonly number[] = [3, 4]

// Steam tags that describe a genre or setting. Everything else ("Singleplayer", "2D",
// "Great Soundtrack", …) is noise for a genre list.
const GENRE_TAGS = new Set(
  [
    'Action',
    'Adventure',
    'Action-Adventure',
    'RPG',
    'Action RPG',
    'JRPG',
    'CRPG',
    'Party-Based RPG',
    'Strategy RPG',
    'Tactical RPG',
    'Strategy',
    'Turn-Based Strategy',
    'Turn-Based Tactics',
    'Grand Strategy',
    'RTS',
    '4X',
    'Tower Defense',
    'Wargame',
    'Auto Battler',
    'City Builder',
    'Colony Sim',
    'Simulation',
    'Life Sim',
    'Farming Sim',
    'Space Sim',
    'Automobile Sim',
    'Racing',
    'Sports',
    'Fighting',
    '2D Fighter',
    '3D Fighter',
    "Beat 'em up",
    'Hack and Slash',
    'Character Action Game',
    'Spectacle fighter',
    'Shooter',
    'FPS',
    'Third-Person Shooter',
    'Hero Shooter',
    'Looter Shooter',
    'Extraction Shooter',
    'Arena Shooter',
    'Boomer Shooter',
    'Twin Stick Shooter',
    'Top-Down Shooter',
    "Shoot 'Em Up",
    'Bullet Hell',
    'Battle Royale',
    'MOBA',
    'MMORPG',
    'Massively Multiplayer',
    'Platformer',
    '2D Platformer',
    '3D Platformer',
    'Precision Platformer',
    'Puzzle Platformer',
    'Metroidvania',
    'Roguelike',
    'Roguelite',
    'Action Roguelike',
    'Roguelike Deckbuilder',
    'Deckbuilding',
    'Card Game',
    'Card Battler',
    'Trading Card Game',
    'Board Game',
    'Puzzle',
    'Visual Novel',
    'Interactive Fiction',
    'Dating Sim',
    'Point & Click',
    'Hidden Object',
    'Walking Simulator',
    'Horror',
    'Survival Horror',
    'Psychological Horror',
    'Survival',
    'Open World Survival Craft',
    'Open World',
    'Sandbox',
    'Immersive Sim',
    'Stealth',
    'Souls-like',
    'Dungeon Crawler',
    'Rhythm',
    'Party Game',
    'Sci-fi',
    'Fantasy',
    'Dark Fantasy',
    'Cyberpunk',
    'Post-apocalyptic',
    'Mystery',
    'Detective',
    'Thriller',
    'Comedy',
    'Romance',
    'Anime',
    'Casual',
    'Arcade',
    'Indie',
    'Free to Play',
    'Early Access',
    'Co-op',
    'Tactical',
    'Management',
    'Crafting',
    'Base Building',
    'Building',
    'Automation',
    'Story Rich',
    'Mythology',
    'War',
    'Military',
    'Historical',
    'Western',
    'Zombies',
    'Superhero',
    'Space',
    'Cozy',
  ].map((tag) => tag.toLowerCase()),
)

/** Canonical genres from Steam tag or genre names, most relevant first. */
export function steamGenres(names: readonly string[]): string[] {
  return canonicalGenres(names.filter((name) => GENRE_TAGS.has(name.trim().toLowerCase())))
}

export function parseSteamTagNames(payload: unknown): Map<number, string> {
  const map = new Map<number, string>()
  for (const tag of records(payload)) {
    const id = positiveInt(tag.tagid)
    const name = str(tag.name)
    if (id && name) map.set(id, name)
  }
  return map
}

function steamAsset(assets: Dict, file: unknown): string | undefined {
  const name = str(file)
  const format = str(assets.asset_url_format)
  if (!name || !format?.includes('${FILENAME}')) return undefined
  return httpsUrl(STEAM_ASSET_BASE + format.replace('${FILENAME}', name))
}

export interface SteamSummary {
  appid: number
  record: TitleRecord
  type: number | null
  adult: boolean
  visible: boolean
  reviews: number
  percentPositive: number | null
  /** Unix seconds of the release date used for `year`. */
  releasedAt: number | null
}

/** Summary record from an IStoreBrowseService/GetItems or IStoreQueryService/Query store item. */
export function normalizeSteamItem(
  value: unknown,
  tags: ReadonlyMap<number, string> = new Map(),
): SteamSummary | null {
  const item = asRecord(value)
  const appid = positiveInt(item.appid) ?? positiveInt(item.id)
  const name = cleanName(item.name)
  if (!appid || !name || (item.success !== undefined && item.success !== 1)) return null

  const assets = asRecord(item.assets)
  const release = asRecord(item.release)
  // original_release_date predates Steam for re-releases; steam_release_date is the 1.0 date.
  const releasedAt =
    [release.original_release_date, release.steam_release_date, release.original_steam_release_date]
      .map(positiveInt)
      .find((ts) => ts !== undefined) ?? null
  const summary = asRecord(asRecord(item.reviews).summary_filtered)
  const reviews = int(summary.review_count) ?? 0
  const percent = int(summary.percent_positive)
  const weightedTags = records(item.tags)
  const tagIds = (
    weightedTags.length
      ? [...weightedTags]
          .sort((a, b) => (int(b.weight) ?? 0) - (int(a.weight) ?? 0))
          .map((tag) => tag.tagid)
      : asArray(item.tagids)
  )
    .map(positiveInt)
    .filter((id): id is number => id !== undefined)
  const descriptors = asArray(item.content_descriptorids).map(int)
  const hasAssets = Object.keys(assets).length > 0

  const record: TitleRecord = {
    id: titleId.steam(appid),
    kind: 'game',
    names: { original: name, en: name },
    year: releasedAt ? new Date(releasedAt * 1000).getUTCFullYear() : null,
    releaseDate: dateFromUnix(releasedAt),
    poster:
      steamAsset(assets, assets.library_capsule) ??
      steamAsset(assets, assets.header) ??
      (hasAssets ? null : `${STEAM_ASSET_BASE}steam/apps/${appid}/library_600x900.jpg`),
    backdrop:
      steamAsset(assets, assets.library_hero) ??
      steamAsset(assets, assets.raw_page_background) ??
      null,
    genres: steamGenres(tagIds.map((id) => tags.get(id)).filter((tag): tag is string => !!tag)),
    ratings:
      reviews > 0 && percent !== undefined
        ? [{ source: 'steam', value: percent, max: 100, votes: reviews }]
        : [],
    links: [{ source: 'steam', url: steamStoreUrl(appid) }],
    externalIds: { steam: String(appid) },
  }
  return {
    appid,
    record,
    type: int(item.type) ?? null,
    adult: descriptors.some((id) => id !== undefined && STEAM_ADULT_DESCRIPTORS.includes(id)),
    visible: item.visible !== false,
    reviews,
    percentPositive: percent ?? null,
    releasedAt,
  }
}

export interface SteamItemExtras {
  description?: string
  creators: string[]
  companies: string[]
  platforms: PlatformId[]
  screenshots: string[]
  trailer: Trailer | null
  isFree: boolean
}

/** Detail fields of a GetItems store item requested with basic info, media and platforms. */
export function steamItemExtras(value: unknown): SteamItemExtras {
  const item = asRecord(value)
  const basic = asRecord(item.basic_info)
  const platforms = asRecord(item.platforms)
  const platformIds: PlatformId[] = []
  if (platforms.windows === true || platforms.steamos_linux === true || platforms.linux === true)
    platformIds.push('pc')
  if (platforms.mac === true) platformIds.push('mac')
  // 3 = Verified, 2 = Playable
  const deck = int(platforms.steam_deck_compat_category)
  if (deck === 2 || deck === 3) platformIds.push('steam-deck')

  const screenshots = records(asRecord(item.screenshots).all_ages_screenshots)
    .map((shot) => str(shot.filename))
    .filter((file): file is string => !!file)
    // Uploads can be 4K; the .1920x1080 variant caps the size.
    .map((file) => httpsUrl(STEAM_ASSET_BASE + file.replace(/\.(jpe?g)(\?|$)/i, '.1920x1080.$1$2')))
    .filter((url): url is string => !!url)
    .slice(0, 12)

  const trailers = asRecord(item.trailers)
  const trailer = [...records(trailers.highlights), ...records(trailers.other_trailers)]
    .map((entry): Trailer | null => {
      const hls = records(entry.adaptive_trailers).find((t) => t.encoding === 'hls_h264')
      const url = httpsUrl(
        hls && str(hls.cdn_path) ? STEAM_VIDEO_BASE + str(hls.cdn_path) : undefined,
      )
      if (!url) return null
      const format = str(entry.trailer_url_format)
      const still = str(entry.screenshot_full)
      const poster =
        format && still
          ? httpsUrl(STEAM_ASSET_BASE + format.replace('${FILENAME}', still))
          : undefined
      return poster ? { type: 'video', url, poster } : { type: 'video', url }
    })
    .find((entry) => entry !== null)

  return {
    description: cleanText(basic.short_description),
    creators: records(basic.developers)
      .map((d) => cleanName(d.name))
      .filter((n): n is string => !!n),
    companies: records(basic.publishers)
      .map((p) => cleanName(p.name))
      .filter((n): n is string => !!n),
    platforms: platformIds,
    screenshots,
    trailer: trailer ?? null,
    isFree: item.is_free === true,
  }
}

export interface SteamPrice {
  currency: string
  initial: number
  final: number
  discountPercent: number
}

export interface SteamAppDetails {
  appid: number
  /** 'game', 'dlc', 'demo', 'music', … */
  type?: string
  name?: string
  description?: string
  genres: string[]
  creators: string[]
  companies: string[]
  platforms: PlatformId[]
  metacritic?: number
  screenshots: string[]
  trailer: Trailer | null
  backdrop?: string
  isFree: boolean
  price?: SteamPrice
  comingSoon: boolean
}

function appDetailsEntry(payload: unknown, appid: number): Dict | null {
  const entries = Object.entries(asRecord(payload)).map(([key, value]) => ({
    key,
    value: asRecord(value),
  }))
  // The response key does not always equal the requested appid; data.steam_appid does.
  const match =
    entries.find((entry) => positiveInt(asRecord(entry.value.data).steam_appid) === appid) ??
    entries.find((entry) => entry.key === String(appid)) ??
    (entries.length === 1 ? entries[0] : undefined)
  return match && match.value.success === true ? match.value : null
}

function appDetailsTrailer(movies: Dict[]): Trailer | null {
  const ordered = [
    ...movies.filter((m) => m.highlight === true),
    ...movies.filter((m) => m.highlight !== true),
  ]
  for (const movie of ordered) {
    const mp4 = asRecord(movie.mp4)
    const webm = asRecord(movie.webm)
    const url =
      httpsUrl(mp4.max) ??
      httpsUrl(mp4['480']) ??
      httpsUrl(webm.max) ??
      httpsUrl(webm['480']) ??
      httpsUrl(movie.hls_h264)
    if (!url) continue
    const poster = httpsUrl(movie.thumbnail)
    return poster ? { type: 'video', url, poster } : { type: 'video', url }
  }
  return null
}

/** store.steampowered.com/api/appdetails payload; null when Steam reports no such app. */
export function parseAppDetails(payload: unknown, appid: number): SteamAppDetails | null {
  const entry = appDetailsEntry(payload, appid)
  if (!entry) return null
  const data = asRecord(entry.data)
  const platforms = asRecord(data.platforms)
  const platformIds: PlatformId[] = []
  if (platforms.windows === true || platforms.linux === true) platformIds.push('pc')
  if (platforms.mac === true) platformIds.push('mac')
  const price = asRecord(data.price_overview)
  const currency = str(price.currency)
  const initial = int(price.initial)
  const final = int(price.final)
  return {
    appid,
    type: str(data.type),
    name: cleanName(data.name),
    description: cleanText(data.short_description),
    genres: steamGenres(records(data.genres).map((g) => str(g.description) ?? '')),
    creators: strings(data.developers)
      .map((n) => cleanName(n))
      .filter((n): n is string => !!n),
    companies: strings(data.publishers)
      .map((n) => cleanName(n))
      .filter((n): n is string => !!n),
    platforms: platformIds,
    metacritic: positiveInt(asRecord(data.metacritic).score),
    screenshots: records(data.screenshots)
      .map((shot) => httpsUrl(shot.path_full))
      .filter((url): url is string => !!url)
      .slice(0, 12),
    trailer: appDetailsTrailer(records(data.movies)),
    backdrop: httpsUrl(data.background_raw),
    isFree: data.is_free === true,
    price:
      currency && initial !== undefined && final !== undefined
        ? { currency, initial, final, discountPercent: int(price.discount_percent) ?? 0 }
        : undefined,
    comingSoon: asRecord(data.release_date).coming_soon === true,
  }
}

/** appreviews query_summary as a Steam rating. */
export function parseAppReviews(payload: unknown): ExternalRating | null {
  const summary = asRecord(asRecord(payload).query_summary)
  const total = int(summary.total_reviews) ?? 0
  const positive = int(summary.total_positive) ?? 0
  if (total <= 0) return null
  return { source: 'steam', value: Math.round((positive / total) * 100), max: 100, votes: total }
}

export function steamStoreItems(payload: unknown): unknown[] {
  return asArray(asRecord(asRecord(payload).response).store_items)
}

export function parseMostPlayed(payload: unknown): number[] {
  const ranks = records(asRecord(asRecord(payload).response).ranks)
  return unique(
    [...ranks]
      .sort((a, b) => (int(a.rank) ?? Infinity) - (int(b.rank) ?? Infinity))
      .map((rank) => positiveInt(rank.appid))
      .filter((id): id is number => id !== undefined),
  )
}

export function parseStoreSearch(payload: unknown): { appid: number; name: string }[] {
  return records(asRecord(payload).items)
    .filter((item) => item.type === 'app')
    .map((item) => ({ appid: positiveInt(item.id), name: cleanName(item.name) }))
    .filter((item): item is { appid: number; name: string } => !!item.appid && !!item.name)
}

export function steamOfferFromDetails(details: SteamAppDetails, region: string): StoreOffer | null {
  const base = { store: 'steam' as const, url: steamStoreUrl(details.appid), region }
  if (details.price) {
    const { currency, initial, final, discountPercent } = details.price
    return {
      ...base,
      currency,
      price: final,
      originalPrice: initial,
      ...(discountPercent > 0 ? { discountPercent } : {}),
      isFree: false,
    }
  }
  return details.isFree ? { ...base, price: 0, isFree: true } : null
}

/** Offer from a GetItems item (best purchase option priced in the context country). */
export function steamOfferFromItem(
  value: unknown,
  region: string,
  currency: string,
): StoreOffer | null {
  const item = asRecord(value)
  const appid = positiveInt(item.appid) ?? positiveInt(item.id)
  if (!appid) return null
  const base = { store: 'steam' as const, url: steamStoreUrl(appid), region }
  const option = asRecord(item.best_purchase_option)
  const final = int(option.final_price_in_cents)
  if (final !== undefined && final > 0) {
    const original = int(option.original_price_in_cents) ?? final
    const discount = int(option.discount_pct) ?? 0
    return {
      ...base,
      currency,
      price: final,
      originalPrice: original,
      ...(discount > 0 ? { discountPercent: discount } : {}),
      isFree: false,
    }
  }
  return item.is_free === true ? { ...base, price: 0, isFree: true } : null
}

// ---------------------------------------------------------------------------
// Fetchers

const SUMMARY_REQUEST = {
  include_assets: true,
  include_release: true,
  include_reviews: true,
  include_tag_count: 12,
}
const DETAIL_REQUEST = {
  ...SUMMARY_REQUEST,
  include_basic_info: true,
  include_screenshots: true,
  include_trailers: true,
  include_platforms: true,
}

export type SteamLanguage = 'english' | 'russian'
export type SteamItemsRequest = 'summary' | 'details' | 'names'

export interface SteamItemsOptions {
  language?: SteamLanguage
  country?: string
  request?: SteamItemsRequest
  ttlMs?: number
}

export async function fetchSteamItems(
  http: HttpClient,
  appids: readonly number[],
  options: SteamItemsOptions = {},
) {
  const dataRequest =
    options.request === 'details'
      ? DETAIL_REQUEST
      : options.request === 'names'
        ? {}
        : SUMMARY_REQUEST
  const batches = chunk(unique(appids), 100)
  const pages = await mapLimit(batches, 3, (ids) => {
    const input = {
      ids: ids.map((appid) => ({ appid })),
      context: { language: options.language ?? 'english', country_code: options.country ?? 'US' },
      data_request: dataRequest,
    }
    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`
    return http.json(url, { ttlMs: options.ttlMs ?? 30 * MINUTE })
  })
  return pages.flatMap(steamStoreItems)
}

export async function fetchSteamTagNames(http: HttpClient): Promise<Map<number, string>> {
  return parseSteamTagNames(
    await http.json('https://store.steampowered.com/tagdata/populartags/english', { ttlMs: DAY }),
  )
}

export async function fetchMostPlayed(http: HttpClient): Promise<number[]> {
  return parseMostPlayed(
    await http.json('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/', {
      ttlMs: 30 * MINUTE,
    }),
  )
}

export interface SteamQuery {
  /** Empirically 10 = global top sellers, 20 = new & trending, 30 = most played. */
  sort: number
  start?: number
  count: number
  /** Unix seconds; restricts to games released in the window. */
  releasedAfter?: number
  releasedBefore?: number
  language?: SteamLanguage
}

/** IStoreQueryService/Query (no key) with summary data for every item, adult games excluded. */
export async function fetchSteamQuery(http: HttpClient, query: SteamQuery): Promise<unknown[]> {
  const filters: Dict = {
    released_only: true,
    type_filters: { include_games: true },
    content_descriptors_excluded: STEAM_ADULT_DESCRIPTORS,
  }
  if (query.releasedAfter) {
    // release_date_type 1 filters on the Steam release date (verified empirically).
    filters.release_date_filter = {
      release_date_type: 1,
      start_date: query.releasedAfter,
      end_date: query.releasedBefore ?? Math.floor(Date.now() / 1000),
    }
  }
  const input = {
    query: { start: query.start ?? 0, count: query.count, sort: query.sort, filters },
    context: { language: query.language ?? 'english', country_code: 'US' },
    data_request: SUMMARY_REQUEST,
  }
  const url = `https://api.steampowered.com/IStoreQueryService/Query/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`
  return steamStoreItems(await http.json(url, { ttlMs: 30 * MINUTE }))
}

export async function searchSteam(
  http: HttpClient,
  term: string,
  language: SteamLanguage = 'english',
) {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=${language}&cc=us`
  return parseStoreSearch(await http.json(url, { ttlMs: 10 * MINUTE }))
}

export async function fetchAppDetails(
  http: HttpClient,
  appid: number,
  options: { language?: SteamLanguage; country?: string; priceOnly?: boolean } = {},
): Promise<SteamAppDetails | null> {
  const params = new URLSearchParams({
    appids: String(appid),
    cc: (options.country ?? 'US').toLowerCase(),
  })
  if (options.priceOnly) params.set('filters', 'price_overview')
  else params.set('l', options.language ?? 'english')
  const payload = await http.json(`https://store.steampowered.com/api/appdetails?${params}`, {
    ttlMs: options.priceOnly ? HOUR : 6 * HOUR,
  })
  return parseAppDetails(payload, appid)
}

export async function fetchAppReviews(
  http: HttpClient,
  appid: number,
): Promise<ExternalRating | null> {
  const url = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all&purchase_type=all&num_per_page=0`
  return parseAppReviews(await http.json(url, { ttlMs: 6 * HOUR }))
}

/**
 * Acclaimed games for the all-time chart (verified appids, all with ≥ 10k reviews in 2026).
 * The order at runtime comes from live Steam review scores.
 */
export const STEAM_TOP_APPIDS: readonly number[] = [
  413150, 620, 1794680, 400, 546560, 2231450, 105600, 550, 1966720, 264710, 1145360, 526870, 294100,
  220, 427520, 646570, 2050650, 2379780, 1332010, 883710, 588650, 504230, 1366540, 1150690, 2001120,
  239030, 1113000, 205100, 787480, 4000, 2358720, 292030, 1086940, 367520, 250900, 391540, 1222140,
  268910, 1868140, 1057090, 457140, 1092790, 1817070, 1687950, 1284190, 1290000, 1062090, 1262350,
  1455840, 242760, 239140, 814380, 1426210, 22380, 1903340, 1593500, 8930, 1167630, 1145350,
  1313140, 1942280, 1196590, 753640, 418370, 2161700, 1127400, 1623730, 322330, 3527290, 374320,
  489830, 813780, 387290, 2124490, 1809540, 1336490, 1245620, 892970, 648800, 632360, 1771300,
  1190460, 2215430, 1817190, 1971650, 1174180, 945360, 976730, 632470, 323190, 594570, 1259420,
  1621690, 2138710, 440, 1888160, 1328670, 1627720, 1293830, 848450, 1158310, 1693980, 1030300,
  582010, 990080, 1551360, 812140, 1604030, 2322010, 271590, 1172620, 1326470, 1172380, 524220,
  1384160, 3017860, 1091500, 1151640, 1659040, 289070, 870780,
]
