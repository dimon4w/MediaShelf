import type {
  ChartList,
  ChartPage,
  EpisodeList,
  Kind,
  SearchResult,
  SourceId,
  StoreOffer,
  TitleRecord,
} from '../../shared/types.ts'
import { parseTitleId, titleId, type ParsedTitleId } from '../../shared/ids.ts'
import { REGIONS, isRegion, type RegionCode } from '../../shared/regions.ts'
import { fetchAniListByMalIds, fetchAniListMedia, fetchAniListTrending } from './anilist.ts'
import {
  cinemetaEpisodes,
  fetchCinemetaCatalog,
  fetchCinemetaMeta,
  normalizeCinemetaMeta,
  type ScreenKind,
} from './cinemeta.ts'
import { TOP_MOVIES, TOP_SERIES } from './curated.ts'
import {
  fetchGogProduct,
  findGogMatch,
  gameTitleKey,
  gogOffer,
  searchGog,
  type GogProduct,
} from './gog.ts'
import { HOUR, MINUTE, createHttpClient, type HttpClient } from './http.ts'
import { lookupImdb, searchImdb } from './imdb.ts'
import { fetchJikanEpisodes, type JikanEpisode } from './jikan.ts'
import { clamp01, mergeRecords, rankByRelevance, type RankedCandidate } from './records.ts'
import {
  fetchShikimoriAnime,
  fetchShikimoriByIds,
  fetchShikimoriList,
  fetchShikimoriScreenshots,
  fetchShikimoriTrailer,
  normalizeShikimoriAnime,
  normalizeShikimoriList,
  numberedEpisodes,
  recentSeasons,
  searchShikimori,
  shikimoriStatus,
} from './shikimori.ts'
import {
  STEAM_TOP_APPIDS,
  STEAM_TYPE_GAME,
  fetchAppDetails,
  fetchAppReviews,
  fetchMostPlayed,
  fetchSteamItems,
  fetchSteamQuery,
  fetchSteamTagNames,
  normalizeSteamItem,
  searchSteam,
  steamItemExtras,
  steamOfferFromDetails,
  steamOfferFromItem,
  steamStoreUrl,
  type SteamSummary,
} from './steam.ts'
import { createTtlCache } from './ttl-cache.ts'
import {
  fetchTvmazeEpisodes,
  fetchTvmazeShow,
  lookupTvmazeByImdb,
  normalizeTvmazeEpisodes,
  normalizeTvmazeShow,
  searchTvmaze,
  tvmazeEnded,
} from './tvmaze.ts'
import {
  CatalogUnavailableError,
  type CatalogContext,
  type CatalogService,
  type PersistentCache,
} from './types.ts'
import { asRecord, cleanName, foldForMatch, isCyrillic, mapLimit, unique } from './util.ts'
import {
  cachedWikipediaExtract,
  createRuLabelResolver,
  fetchWikipediaExtract,
  searchWikidata,
  type RuLabel,
} from './wikidata.ts'

export interface CatalogServiceOptions {
  cache: PersistentCache
  fetch?: typeof fetch
  /** Replaces the upstream client entirely (tests). */
  http?: HttpClient
  now?: () => Date
  /** Longest a list waits for Russian titles from Wikidata (default 2.5 s). */
  labelBudgetMs?: number
}

export const PAGE_SIZE = 30
const MAX_PAGE = 10
const CHART_TTL = 30 * MINUTE
const SEARCH_TTL = 10 * MINUTE
const DETAILS_TTL = 6 * HOUR
const OFFERS_TTL = HOUR
const PARTIAL_TTL = 2 * MINUTE
const MIN_TOP_REVIEWS = 10_000
const MIN_NEW_REVIEWS = 100

interface Loaded<T> {
  value: T
  /** Some upstream failed; cache briefly so a recovered source shows up soon. */
  partial: boolean
}

type Settled<T> = PromiseSettledResult<T>

function ok<T>(result: Settled<T>): T | undefined {
  return result.status === 'fulfilled' ? result.value : undefined
}

/** `{ value }` on success, undefined on failure: tells "not found" apart from "unreachable". */
function settle<T>(promise: Promise<T>): Promise<{ value: T } | undefined> {
  return promise.then(
    (value) => ({ value }),
    () => undefined,
  )
}

function createMemo() {
  const values = createTtlCache<unknown>({ maxEntries: 1500 })
  const pending = new Map<string, Promise<unknown>>()
  return function memo<T>(
    key: string,
    ttl: (value: T) => number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = values.get(key)
    if (hit !== undefined) return Promise.resolve(hit as T)
    const running = pending.get(key)
    if (running) return running as Promise<T>
    const promise = load()
      .then((value) => {
        values.set(key, value, ttl(value))
        return value
      })
      .finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
  }
}

const loadedTtl =
  (full: number) =>
  <T>(loaded: Loaded<T>) =>
    loaded.partial ? PARTIAL_TTL : full

function regionOf(region: string): RegionCode {
  const upper = region.toUpperCase()
  return isRegion(upper) ? upper : 'US'
}

function withRussianName(record: TitleRecord, russian: string | undefined): TitleRecord {
  if (!russian || record.names.ru || foldForMatch(russian) === foldForMatch(record.names.original))
    return record
  return { ...record, names: { ...record.names, ru: russian } }
}

/** GetItems may return items in any order (or unrelated ones); pick the requested app. */
function itemFor(items: unknown[], appid: number): unknown {
  return items.find((item) => {
    const entry = asRecord(item)
    return entry.appid === appid || entry.id === appid
  })
}

/** Adds a GOG listing to a Steam record without letting it override Steam data. */
function attachGog(
  record: TitleRecord,
  product: Pick<GogProduct, 'id' | 'storeLink'>,
): TitleRecord {
  const links = [...(record.links ?? [])]
  if (product.storeLink && !links.some((link) => link.source === 'gog'))
    links.push({ source: 'gog', url: product.storeLink })
  return { ...record, links, externalIds: { ...record.externalIds, gog: product.id } }
}

/** Shikimori leads (Russian names, score, status); AniList adds English titles, genres and art. */
function mergeAnime(
  shiki: TitleRecord | null | undefined,
  ani: TitleRecord | null | undefined,
): TitleRecord | null {
  if (!shiki || !ani) return shiki ?? ani ?? null
  const merged = mergeRecords(shiki, ani)
  // AniList covers are 460×650; Shikimori originals are 225×318.
  merged.poster = ani.poster ?? shiki.poster
  merged.backdrop = ani.backdrop ?? shiki.backdrop
  return merged
}

export function createCatalogService(options: CatalogServiceOptions): CatalogService {
  const http = options.http ?? createHttpClient({ fetch: options.fetch })
  const now = options.now ?? (() => new Date())
  const cache = options.cache
  const labels = createRuLabelResolver(http, cache, { budgetMs: options.labelBudgetMs })
  const memo = createMemo()

  // -------------------------------------------------------------------------
  // Shared helpers

  async function steamTags() {
    try {
      return await fetchSteamTagNames(http)
    } catch {
      return new Map<number, string>()
    }
  }

  async function steamRussianNames(appids: readonly number[]): Promise<Map<number, string>> {
    try {
      const items = await fetchSteamItems(http, appids, { language: 'russian', request: 'names' })
      const names = new Map<number, string>()
      for (const item of items) {
        const summary = normalizeSteamItem(item)
        if (summary) names.set(summary.appid, summary.record.names.original)
      }
      return names
    } catch {
      return new Map()
    }
  }

  function isListable(summary: SteamSummary) {
    return (
      summary.visible &&
      !summary.adult &&
      (summary.type === null || summary.type === STEAM_TYPE_GAME)
    )
  }

  async function localiseSteam(summaries: SteamSummary[]): Promise<SteamSummary[]> {
    if (!summaries.length) return summaries
    const russian = await steamRussianNames(summaries.map((s) => s.appid))
    return summaries.map((s) => ({ ...s, record: withRussianName(s.record, russian.get(s.appid)) }))
  }

  /** GetItems summaries in the order of `appids`; unknown and non-game apps are dropped. */
  async function steamSummaries(appids: readonly number[]): Promise<SteamSummary[]> {
    if (!appids.length) return []
    const [tags, items] = await Promise.all([steamTags(), fetchSteamItems(http, appids)])
    const byId = new Map<number, SteamSummary>()
    for (const item of items) {
      const summary = normalizeSteamItem(item, tags)
      if (summary) byId.set(summary.appid, summary)
    }
    return localiseSteam(
      appids
        .map((id) => byId.get(id))
        .filter((s): s is SteamSummary => !!s && (s.type === null || s.type === STEAM_TYPE_GAME)),
    )
  }

  /** Russian titles for movies/series: waits for Wikidata only when the reader wants Russian. */
  async function localise(items: TitleRecord[], ctx: CatalogContext): Promise<TitleRecord[]> {
    const ids = items
      .filter(
        (item) =>
          (item.kind === 'movie' || item.kind === 'series') &&
          item.externalIds.imdb &&
          !item.names.ru,
      )
      .map((item) => item.externalIds.imdb as string)
    if (!ids.length) return items
    const found = ctx.locale === 'ru' ? await labels.resolve(ids) : labels.peek(ids)
    return items.map((item) => {
      const label = item.externalIds.imdb ? found.get(item.externalIds.imdb)?.label : undefined
      return label && !item.names.ru ? { ...item, names: { ...item.names, ru: label } } : item
    })
  }

  async function enrichAnime(shikimori: TitleRecord[]): Promise<Loaded<TitleRecord[]>> {
    try {
      const ani = await fetchAniListByMalIds(
        http,
        shikimori.map((item) => Number(item.externalIds.mal)),
      )
      const byId = new Map(ani.map((item) => [item.id, item]))
      return {
        value: shikimori.map((item) => mergeAnime(item, byId.get(item.id)) ?? item),
        partial: false,
      }
    } catch {
      return { value: shikimori, partial: true }
    }
  }

  // -------------------------------------------------------------------------
  // Charts

  async function steamChart(list: ChartList): Promise<Loaded<TitleRecord[]>> {
    const tags = await steamTags()
    const normalize = (items: unknown[]) =>
      items
        .map((item) => normalizeSteamItem(item, tags))
        .filter((s): s is SteamSummary => !!s && isListable(s))

    if (list === 'top') {
      const summaries = (await steamSummaries(STEAM_TOP_APPIDS)).filter(
        (s) => isListable(s) && s.reviews >= MIN_TOP_REVIEWS,
      )
      if (!summaries.length) throw new CatalogUnavailableError()
      summaries.sort(
        (a, b) => (b.percentPositive ?? 0) - (a.percentPositive ?? 0) || b.reviews - a.reviews,
      )
      return { value: summaries.map((s) => s.record), partial: false }
    }

    if (list === 'new') {
      const nowSeconds = Math.floor(now().getTime() / 1000)
      const items = await fetchSteamQuery(http, {
        sort: 10,
        count: 200,
        releasedAfter: nowSeconds - 365 * 24 * 3600,
        releasedBefore: nowSeconds,
      })
      const summaries = await localiseSteam(
        normalize(items).filter((s) => s.reviews >= MIN_NEW_REVIEWS),
      )
      return { value: summaries.map((s) => s.record), partial: false }
    }

    // Trending: most played interleaved with top sellers, so the list is not only free shooters.
    const [played, sellers] = await Promise.allSettled([
      fetchMostPlayed(http).then((ids) => steamSummaries(ids.slice(0, 100))),
      fetchSteamQuery(http, { sort: 10, count: 100 }).then((items) =>
        localiseSteam(normalize(items)),
      ),
    ])
    const a = (ok(played) ?? []).filter(isListable)
    const b = ok(sellers) ?? []
    if (!a.length && !b.length) throw new CatalogUnavailableError()
    const merged: TitleRecord[] = []
    const seen = new Set<number>()
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      for (const summary of [a[i], b[i]]) {
        if (summary && !seen.has(summary.appid)) {
          seen.add(summary.appid)
          merged.push(summary.record)
        }
      }
    }
    return { value: merged, partial: played.status === 'rejected' || sellers.status === 'rejected' }
  }

  /**
   * Builds page `pageNo` from upstream pages of any size, fetching them in order until one
   * item past the page is known (so `hasMore` is exact).
   */
  async function accumulate(
    key: string,
    pageNo: number,
    fetchPage: (index: number) => Promise<Loaded<{ items: TitleRecord[]; hasMore: boolean }>>,
  ): Promise<Loaded<ChartPage>> {
    const start = (pageNo - 1) * PAGE_SIZE
    const items: TitleRecord[] = []
    const seen = new Set<string>()
    let partial = false
    let more = true
    for (let index = 0; more && items.length <= start + PAGE_SIZE && index < 25; index++) {
      let upstream: Loaded<{ items: TitleRecord[]; hasMore: boolean }>
      try {
        upstream = await memo(`${key}:${index}`, loadedTtl(CHART_TTL), () => fetchPage(index))
      } catch (error) {
        if (items.length <= start)
          throw error instanceof CatalogUnavailableError ? error : new CatalogUnavailableError()
        partial = true
        break
      }
      partial ||= upstream.partial
      const before = items.length
      for (const item of upstream.value.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          items.push(item)
        }
      }
      // A page without new items means the upstream is repeating itself; stop there.
      more = upstream.value.hasMore && items.length > before
    }
    const slice = items.slice(start, start + PAGE_SIZE)
    return {
      value: {
        items: slice,
        hasMore:
          pageNo < MAX_PAGE && (items.length > start + PAGE_SIZE || (partial && slice.length > 0)),
      },
      partial,
    }
  }

  async function curatedTop(kind: ScreenKind, pageNo: number): Promise<Loaded<ChartPage>> {
    const ids = kind === 'movie' ? TOP_MOVIES : TOP_SERIES
    const start = (pageNo - 1) * PAGE_SIZE
    const slice = ids.slice(start, start + PAGE_SIZE)
    let failures = 0
    const records = await mapLimit(slice, 8, async (imdb) => {
      try {
        return normalizeCinemetaMeta(asRecord(await fetchCinemetaMeta(http, kind, imdb)).meta, kind)
      } catch {
        failures++
        return null
      }
    })
    const items = records.filter((item): item is TitleRecord => item !== null)
    if (!items.length && slice.length) throw new CatalogUnavailableError()
    return {
      value: { items, hasMore: pageNo < MAX_PAGE && ids.length > start + PAGE_SIZE },
      partial: failures > 0,
    }
  }

  async function cinemetaYear(kind: ScreenKind): Promise<number> {
    const year = now().getUTCFullYear()
    return memo(
      `cinemeta-year:${kind}:${year}`,
      () => CHART_TTL,
      async () => {
        const first = await fetchCinemetaCatalog(http, kind, 'new', 0, year)
        return first.items.length ? year : year - 1
      },
    )
  }

  async function loadChart(
    kind: Kind,
    list: ChartList,
    pageNo: number,
  ): Promise<Loaded<ChartPage>> {
    if (kind === 'game') {
      const all = await memo(`steam-chart:${list}`, loadedTtl(CHART_TTL), () => steamChart(list))
      const start = (pageNo - 1) * PAGE_SIZE
      return {
        value: {
          items: all.value.slice(start, start + PAGE_SIZE),
          hasMore: pageNo < MAX_PAGE && all.value.length > start + PAGE_SIZE,
        },
        partial: all.partial,
      }
    }
    if (kind === 'movie' || kind === 'series') {
      if (list === 'top') return curatedTop(kind, pageNo)
      const year = list === 'new' ? await cinemetaYear(kind) : 0
      return accumulate(`cinemeta:${kind}:${list}:${year}`, pageNo, async (index) => ({
        value: await fetchCinemetaCatalog(http, kind, list, index * 50, year),
        partial: false,
      }))
    }
    if (list === 'trending') {
      return accumulate('anilist:trending', pageNo, async (index) => {
        const page = await fetchAniListTrending(http, index + 1, 50)
        let partial = false
        let shiki = new Map<string, TitleRecord>()
        try {
          const raw = await fetchShikimoriByIds(
            http,
            page.items.map((item) => Number(item.externalIds.mal)),
          )
          shiki = new Map(normalizeShikimoriList(raw).map((item) => [item.id, item]))
        } catch {
          partial = true
        }
        const items = page.items.map((item) => mergeAnime(shiki.get(item.id), item) ?? item)
        return { value: { items, hasMore: page.hasNextPage }, partial }
      })
    }
    const season = recentSeasons(now())
    return accumulate(
      `shikimori:${list}:${list === 'new' ? season : ''}`,
      pageNo,
      async (index) => {
        const raw = await fetchShikimoriList(
          http,
          list === 'top'
            ? { order: 'ranked', page: index + 1 }
            : { order: 'popularity', page: index + 1, season, status: 'ongoing,released' },
        )
        const enriched = await enrichAnime(normalizeShikimoriList(raw))
        return {
          value: { items: enriched.value, hasMore: raw.length >= 50 },
          partial: enriched.partial,
        }
      },
    )
  }

  async function charts(
    kind: Kind,
    list: ChartList,
    page: number,
    ctx: CatalogContext,
  ): Promise<ChartPage> {
    const pageNo = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
    if (pageNo > MAX_PAGE) return { items: [], hasMore: false }
    const loaded = await memo(`chart:${kind}:${list}:${pageNo}`, loadedTtl(CHART_TTL), () =>
      loadChart(kind, list, pageNo),
    )
    return structuredClone({
      items: await localise(loaded.value.items, ctx),
      hasMore: loaded.value.hasMore,
    })
  }

  // -------------------------------------------------------------------------
  // Search

  async function steamCandidates(query: string): Promise<RankedCandidate[]> {
    const hits = await searchSteam(http, query, isCyrillic(query) ? 'russian' : 'english')
    if (!hits.length) return []
    const localized = new Map(hits.map((hit) => [hit.appid, hit.name]))
    const summaries = await steamSummaries(hits.map((hit) => hit.appid))
    return summaries.map((s) => ({
      record: isCyrillic(query) ? withRussianName(s.record, localized.get(s.appid)) : s.record,
      weight: clamp01(Math.log10(s.reviews + 1) / 6.5),
    }))
  }

  async function gogCandidates(query: string): Promise<RankedCandidate[]> {
    return (await searchGog(http, query)).map((product) => ({
      record: product.record,
      weight: 0.15,
      strict: true,
    }))
  }

  async function imdbCandidates(query: string): Promise<RankedCandidate[]> {
    return (await searchImdb(http, query)).map((hit) => ({
      record: hit.record,
      weight: hit.rank ? clamp01(1 - Math.log10(hit.rank) / 6) : 0.1,
    }))
  }

  async function tvmazeCandidates(query: string): Promise<RankedCandidate[]> {
    return (await searchTvmaze(http, query)).map((hit) => ({
      record: hit.record,
      weight: hit.weight * 0.6,
    }))
  }

  async function animeCandidates(query: string): Promise<RankedCandidate[]> {
    const found = normalizeShikimoriList(await searchShikimori(http, query))
    const enriched = await enrichAnime(found)
    return enriched.value.map((record, index) => {
      const score = record.ratings.find((rating) => rating.source === 'shikimori')?.value ?? 0
      return { record, weight: clamp01(score / 12 - index * 0.01) }
    })
  }

  /** Russian titles → Wikidata items → hydrated through the regular sources. */
  async function wikidataCandidates(query: string): Promise<RankedCandidate[]> {
    const hits = (await searchWikidata(http, query)).slice(0, 8)
    if (!hits.length) return []
    const weightOf = (index: number) => clamp01(0.9 - index * 0.05)
    const byRank = new Map(hits.map((hit, index) => [hit.qid, index]))
    const anime = hits.filter((hit) => hit.mal)
    const games = hits.filter((hit) => !hit.mal && hit.steam)
    const screen = hits.filter((hit) => !hit.mal && !hit.steam && hit.imdb)
    const [animeR, gamesR, screenR] = await Promise.allSettled([
      anime.length
        ? fetchShikimoriByIds(
            http,
            anime.map((hit) => hit.mal as number),
          )
        : Promise.resolve([]),
      steamSummaries(games.map((hit) => hit.steam as number)),
      mapLimit(screen, 4, (hit) => lookupImdb(http, hit.imdb as string).catch(() => null)),
    ])
    const candidates: RankedCandidate[] = []
    for (const record of normalizeShikimoriList(ok(animeR) ?? [])) {
      const hit = anime.find((entry) => titleId.anime(entry.mal as number) === record.id)
      if (hit)
        candidates.push({
          record: withRussianName(record, hit.labelRu),
          weight: weightOf(byRank.get(hit.qid) ?? 9),
        })
    }
    for (const summary of ok(gamesR) ?? []) {
      const hit = games.find((entry) => entry.steam === summary.appid)
      if (hit)
        candidates.push({
          record: withRussianName(summary.record, hit.labelRu),
          weight: weightOf(byRank.get(hit.qid) ?? 9),
        })
    }
    ;(ok(screenR) ?? []).forEach((found, index) => {
      const hit = screen[index]
      if (found && hit) {
        const record = {
          ...found.record,
          externalIds: { ...found.record.externalIds, wikidata: hit.qid },
        }
        candidates.push({
          record: withRussianName(record, hit.labelRu),
          weight: weightOf(byRank.get(hit.qid) ?? 9),
        })
      }
    })
    return candidates
  }

  /** Folds GOG products into Steam results for the same game; the rest stay GOG-only records. */
  function mergeStores(candidates: RankedCandidate[]): RankedCandidate[] {
    const steamByKey = new Map<string, RankedCandidate>()
    for (const candidate of candidates) {
      if (candidate.record.id.startsWith('steam-'))
        steamByKey.set(gameTitleKey(candidate.record.names.original), candidate)
    }
    return candidates.filter((candidate) => {
      const gog = candidate.record.externalIds.gog
      if (!candidate.record.id.startsWith('gog-') || !gog) return true
      const target = steamByKey.get(gameTitleKey(candidate.record.names.original))
      if (!target) return true
      target.record = attachGog(target.record, {
        id: gog,
        storeLink: candidate.record.links?.[0]?.url,
      })
      return false
    })
  }

  async function runSearch(query: string, kind: Kind | 'all'): Promise<SearchResult> {
    const tasks: { source: SourceId; run: () => Promise<RankedCandidate[]> }[] = []
    if (kind === 'all' || kind === 'game') {
      tasks.push(
        { source: 'steam', run: () => steamCandidates(query) },
        { source: 'gog', run: () => gogCandidates(query) },
      )
    }
    if (kind === 'all' || kind === 'movie' || kind === 'series')
      tasks.push({ source: 'imdb', run: () => imdbCandidates(query) })
    if (kind === 'series') tasks.push({ source: 'tvmaze', run: () => tvmazeCandidates(query) })
    if (kind === 'all' || kind === 'anime')
      tasks.push({ source: 'shikimori', run: () => animeCandidates(query) })
    if (isCyrillic(query)) tasks.push({ source: 'wikidata', run: () => wikidataCandidates(query) })

    const settled = await Promise.allSettled(tasks.map((task) => task.run()))
    const failed = unique(
      tasks.filter((_, index) => settled[index].status === 'rejected').map((task) => task.source),
    )
    if (failed.length === tasks.length) throw new CatalogUnavailableError()
    const candidates = settled
      .flatMap((result) => ok(result) ?? [])
      .filter((candidate) => kind === 'all' || candidate.record.kind === kind)
    return { items: rankByRelevance(mergeStores(candidates), query, 40), failed }
  }

  async function search(
    query: string,
    kind: Kind | 'all',
    ctx: CatalogContext,
  ): Promise<SearchResult> {
    const normalized = query.trim().replace(/\s+/g, ' ').slice(0, 100).trim()
    if (normalized.length < 2) return { items: [], failed: [] }
    const result = await memo(
      `search:${kind}:${normalized.toLowerCase()}`,
      (value: SearchResult) => (value.failed.length ? PARTIAL_TTL : SEARCH_TTL),
      () => runSearch(normalized, kind),
    )
    return structuredClone({ items: await localise(result.items, ctx), failed: result.failed })
  }

  // -------------------------------------------------------------------------
  // Details

  async function gogListing(
    title: string,
    region: string,
    id?: string,
  ): Promise<GogProduct | undefined> {
    const products = await searchGog(http, title, region)
    return (
      (id ? products.find((product) => product.id === id) : undefined) ??
      findGogMatch(products, title)
    )
  }

  async function steamDetails(
    appid: number,
    ctx: CatalogContext,
  ): Promise<Loaded<TitleRecord | null>> {
    const country = regionOf(ctx.region)
    const russian = ctx.locale === 'ru'
    const first = (items: unknown[]) => itemFor(items, appid)
    const [tags, itemR, ruItemR, appR] = await Promise.all([
      steamTags(),
      settle(
        fetchSteamItems(http, [appid], { request: 'details', country, ttlMs: DETAILS_TTL }).then(
          first,
        ),
      ),
      russian
        ? settle(
            fetchSteamItems(http, [appid], {
              request: 'details',
              language: 'russian',
              country,
              ttlMs: DETAILS_TTL,
            }).then(first),
          )
        : Promise.resolve(undefined),
      settle(fetchAppDetails(http, appid, { country })),
    ])
    const item = itemR?.value
    const ruItem = ruItemR?.value
    const summary = item ? normalizeSteamItem(item, tags) : null
    const app = appR?.value ?? null
    if (!summary && !app) {
      if (!itemR && !appR) throw new CatalogUnavailableError()
      return { value: null, partial: !itemR || !appR }
    }
    if (
      (summary && summary.type !== null && summary.type !== STEAM_TYPE_GAME) ||
      (!summary && app?.type && app.type !== 'game')
    ) {
      return { value: null, partial: false }
    }
    let partial = !itemR || !appR || (russian && !ruItemR)
    const extras = item ? steamItemExtras(item) : undefined
    const ruExtras = ruItem ? steamItemExtras(ruItem) : undefined
    const name = summary?.record.names.original ?? app?.name ?? String(appid)

    let record: TitleRecord = summary?.record ?? {
      id: titleId.steam(appid),
      kind: 'game',
      names: { original: name, en: name },
      year: null,
      poster: null,
      backdrop: null,
      genres: [],
      ratings: [],
      links: [{ source: 'steam', url: steamStoreUrl(appid) }],
      externalIds: { steam: String(appid) },
    }
    if (ruItem) record = withRussianName(record, cleanName(asRecord(ruItem).name))
    const descriptions: TitleRecord['descriptions'] = {}
    const en = extras?.description ?? app?.description
    if (en) descriptions.en = en
    if (ruExtras?.description) descriptions.ru = ruExtras.description

    const ratings = [...record.ratings]
    if (!ratings.some((rating) => rating.source === 'steam')) {
      const rating = await fetchAppReviews(http, appid).catch(() => null)
      if (rating) ratings.push(rating)
    }
    if (app?.metacritic) ratings.push({ source: 'metacritic', value: app.metacritic, max: 100 })
    const screenshots = extras?.screenshots.length ? extras.screenshots : (app?.screenshots ?? [])
    const progressive = app?.trailer?.type === 'video' && !app.trailer.url.includes('.m3u8')

    record = {
      ...record,
      descriptions,
      genres: unique([...record.genres, ...(app?.genres ?? [])]).slice(0, 5),
      ratings,
      creators: extras?.creators.length ? extras.creators : (app?.creators ?? []),
      companies: extras?.companies.length ? extras.companies : (app?.companies ?? []),
      platforms: unique([...(extras?.platforms ?? []), ...(app?.platforms ?? [])]),
      screenshots,
      trailer: (progressive ? app?.trailer : (extras?.trailer ?? app?.trailer)) ?? null,
      backdrop: record.backdrop ?? app?.backdrop ?? screenshots[0] ?? null,
      detailed: true,
    }
    try {
      const gog = await gogListing(record.names.en ?? name, country)
      if (gog) record = attachGog(record, gog)
    } catch {
      partial = true
    }
    return { value: record, partial }
  }

  async function gogDetails(id: string, ctx: CatalogContext): Promise<Loaded<TitleRecord | null>> {
    let product
    try {
      product = await fetchGogProduct(http, id)
    } catch {
      throw new CatalogUnavailableError()
    }
    if (!product) return { value: null, partial: false }
    const country = regionOf(ctx.region)
    const [listingR, steamR] = await Promise.allSettled([
      gogListing(product.title, country, id),
      searchSteam(http, product.title),
    ])
    const listing = ok(listingR)
    // The listing may be a different product with the same title (e.g. a GOTY pack).
    const exact = listing?.id === id
    const base: TitleRecord = listing?.record ?? {
      id: titleId.gog(id),
      kind: 'game',
      names: { original: product.title, en: product.title },
      year: product.year,
      poster: null,
      backdrop: null,
      genres: [],
      ratings: [],
      externalIds: { gog: id },
    }
    const link = (exact ? listing?.storeLink : undefined) ?? product.link ?? listing?.storeLink
    let record: TitleRecord = {
      ...base,
      id: titleId.gog(id),
      names: { original: product.title, en: product.title },
      year: product.year ?? base.year,
      releaseDate: product.releaseDate ?? base.releaseDate ?? null,
      backdrop: base.backdrop ?? product.backdrop ?? null,
      platforms: product.platforms,
      links: link ? [{ source: 'gog', url: link }] : [],
      externalIds: { gog: id },
      detailed: true,
    }
    if (product.description) record.descriptions = { en: product.description }
    const key = gameTitleKey(product.title)
    const steamHit = (ok(steamR) ?? []).find((hit) => gameTitleKey(hit.name) === key)
    if (steamHit) {
      const summary = (await steamSummaries([steamHit.appid]).catch(() => []))[0]
      record = {
        ...record,
        ratings: summary ? summary.record.ratings : record.ratings,
        genres: record.genres.length ? record.genres : (summary?.record.genres ?? []),
        poster: record.poster ?? summary?.record.poster ?? null,
        links: [...(record.links ?? []), { source: 'steam', url: steamStoreUrl(steamHit.appid) }],
        externalIds: { ...record.externalIds, steam: String(steamHit.appid) },
      }
    }
    return {
      value: record,
      partial: listingR.status === 'rejected' || steamR.status === 'rejected',
    }
  }

  function applyLabel(record: TitleRecord, label: RuLabel | undefined): TitleRecord {
    if (!label) return record
    const links = [...(record.links ?? [])]
    if (label.article && !links.some((link) => link.source === 'wikipedia'))
      links.push({ source: 'wikipedia', url: label.article })
    return {
      ...withRussianName(record, label.label),
      links,
      externalIds: { ...record.externalIds, ...(label.qid ? { wikidata: label.qid } : {}) },
    }
  }

  async function screenDetails(
    kind: ScreenKind,
    imdb: string,
    ctx: CatalogContext,
  ): Promise<Loaded<TitleRecord | null>> {
    const russian = ctx.locale === 'ru'
    const [metaR, labelR, showR] = await Promise.allSettled([
      fetchCinemetaMeta(http, kind, imdb),
      russian ? labels.resolve([imdb], 5000) : Promise.resolve(labels.peek([imdb])),
      kind === 'series' ? lookupTvmazeByImdb(http, imdb) : Promise.resolve(null),
    ])
    let partial = showR.status === 'rejected'
    let record =
      metaR.status === 'fulfilled'
        ? normalizeCinemetaMeta(asRecord(metaR.value).meta, kind, true)
        : null
    if (!record) {
      // Cinemeta is missing very new or obscure titles; IMDb suggestions still know them.
      try {
        const hit = await lookupImdb(http, imdb)
        record = hit && hit.record.kind === kind ? { ...hit.record, detailed: true } : null
      } catch {
        if (metaR.status === 'rejected') throw new CatalogUnavailableError()
      }
      if (!record) return { value: null, partial: false }
      partial = true
    }

    const show = ok(showR)
    const tvmaze = show ? normalizeTvmazeShow(show, true) : null
    if (tvmaze) {
      const tvmazeLink = tvmaze.links?.find((link) => link.source === 'tvmaze')
      record = {
        ...record,
        seasons: tvmaze.seasons ?? record.seasons,
        episodes: tvmaze.episodes ?? record.episodes,
        airing: tvmaze.airing ?? record.airing,
        runtime: record.runtime ?? tvmaze.runtime,
        companies: tvmaze.companies ?? record.companies,
        country: record.country ?? tvmaze.country,
        poster: record.poster ?? tvmaze.poster,
        ratings: record.ratings.length ? [...record.ratings, ...tvmaze.ratings] : tvmaze.ratings,
        descriptions: { ...tvmaze.descriptions, ...record.descriptions },
        links: [...(record.links ?? []), ...(tvmazeLink ? [tvmazeLink] : [])],
        externalIds: { ...record.externalIds, tvmaze: tvmaze.externalIds.tvmaze },
      }
    }

    const label = ok(labelR)?.get(imdb)
    record = applyLabel(record, label)
    if (label?.article) {
      try {
        const extract = russian
          ? await fetchWikipediaExtract(http, cache, label.article)
          : cachedWikipediaExtract(cache, label.article)
        if (extract) record.descriptions = { ...record.descriptions, ru: extract }
      } catch {
        partial = true
      }
    } else if (russian && !labels.known(imdb)) {
      // The label lookup is still running in the background; retry soon to pick up Russian text.
      partial = true
    }
    return { value: { ...record, detailed: true }, partial }
  }

  async function tvmazeDetails(id: string): Promise<Loaded<TitleRecord | null>> {
    let show
    try {
      show = await fetchTvmazeShow(http, id)
    } catch {
      throw new CatalogUnavailableError()
    }
    const record = show ? normalizeTvmazeShow(show, true) : null
    return {
      value: record ? { ...record, id: titleId.tvmaze(id), detailed: true } : null,
      partial: false,
    }
  }

  async function animeDetails(mal: number): Promise<Loaded<TitleRecord | null>> {
    const [shikiR, aniR, shotsR, trailerR] = await Promise.allSettled([
      fetchShikimoriAnime(http, mal),
      fetchAniListMedia(http, mal),
      fetchShikimoriScreenshots(http, mal),
      fetchShikimoriTrailer(http, mal),
    ])
    const expected = titleId.anime(mal)
    const shikiRecord =
      shikiR.status === 'fulfilled' && shikiR.value
        ? normalizeShikimoriAnime(shikiR.value, true)
        : null
    const shiki = shikiRecord?.id === expected ? shikiRecord : null
    const aniRecord = ok(aniR) ?? null
    const ani = aniRecord?.id === expected ? aniRecord : null
    const merged = mergeAnime(shiki, ani)
    if (!merged) {
      if (shikiR.status === 'rejected' && aniR.status === 'rejected')
        throw new CatalogUnavailableError()
      return { value: null, partial: false }
    }
    const screenshots = ok(shotsR) ?? []
    const record: TitleRecord = {
      ...merged,
      descriptions: { ...ani?.descriptions, ...shiki?.descriptions },
      creators: shiki?.creators?.length ? shiki.creators : (ani?.creators ?? []),
      screenshots,
      trailer: ani?.trailer ?? ok(trailerR) ?? null,
      backdrop: merged.backdrop ?? screenshots[0] ?? null,
      releaseDate: shiki?.releaseDate ?? ani?.releaseDate ?? null,
      detailed: true,
    }
    const partial = [shikiR, aniR, shotsR, trailerR].some((result) => result.status === 'rejected')
    return { value: record, partial }
  }

  function loadDetails(
    parsed: ParsedTitleId,
    ctx: CatalogContext,
  ): Promise<Loaded<TitleRecord | null>> {
    switch (parsed.prefix) {
      case 'steam':
        return steamDetails(Number(parsed.value), ctx)
      case 'gog':
        return gogDetails(parsed.value, ctx)
      case 'movie':
      case 'series':
        return screenDetails(parsed.prefix, parsed.value, ctx)
      case 'tvmaze':
        return tvmazeDetails(parsed.value)
      case 'anime':
        return animeDetails(Number(parsed.value))
    }
  }

  async function details(id: string, ctx: CatalogContext): Promise<TitleRecord | null> {
    const parsed = parseTitleId(id)
    if (!parsed) return null
    const region = parsed.kind === 'game' ? regionOf(ctx.region) : ''
    const loaded = await memo(
      `details:${id}:${ctx.locale}:${region}`,
      (value: Loaded<TitleRecord | null>) =>
        value.partial ? PARTIAL_TTL : value.value ? DETAILS_TTL : HOUR,
      () => loadDetails(parsed, ctx),
    )
    return loaded.value ? structuredClone(loaded.value) : null
  }

  // -------------------------------------------------------------------------
  // Episodes

  async function seriesEpisodes(imdb: string): Promise<Loaded<EpisodeList | null>> {
    let tvmazeFailed = false
    try {
      const show = await lookupTvmazeByImdb(http, imdb)
      const id = asRecord(show).id
      if (show && typeof id === 'number') {
        const episodes = await fetchTvmazeEpisodes(http, id)
        if (episodes)
          return { value: normalizeTvmazeEpisodes(episodes, tvmazeEnded(show)), partial: false }
      }
    } catch {
      tvmazeFailed = true
    }
    try {
      return {
        value: cinemetaEpisodes(await fetchCinemetaMeta(http, 'series', imdb)),
        partial: tvmazeFailed,
      }
    } catch {
      throw new CatalogUnavailableError()
    }
  }

  async function tvmazeEpisodes(id: string): Promise<Loaded<EpisodeList | null>> {
    try {
      const show = await fetchTvmazeShow(http, id)
      if (!show) return { value: null, partial: false }
      const episodes = await fetchTvmazeEpisodes(http, id)
      return { value: normalizeTvmazeEpisodes(episodes ?? [], tvmazeEnded(show)), partial: false }
    } catch {
      throw new CatalogUnavailableError()
    }
  }

  async function animeEpisodes(mal: number): Promise<Loaded<EpisodeList | null>> {
    let anime
    try {
      anime = await fetchShikimoriAnime(http, mal)
    } catch {
      throw new CatalogUnavailableError()
    }
    if (!anime) return { value: null, partial: false }
    const status = shikimoriStatus(anime)
    const runtime = normalizeShikimoriAnime(anime)?.runtime ?? null
    const ended = status.airing === null ? null : status.airing === 'ended'
    if (status.airing === 'upcoming')
      return { value: { source: 'shikimori', seasons: [], ended }, partial: false }

    // Jikan (MyAnimeList) has episode titles but is often slow; numbered episodes are the fallback.
    const titles = new Map<number, JikanEpisode>()
    let partial = false
    try {
      const first = await fetchJikanEpisodes(http, mal, 1)
      const rest = first.hasNextPage
        ? await Promise.all(
            Array.from({ length: Math.min(first.lastPage, 10) - 1 }, (_, i) =>
              fetchJikanEpisodes(http, mal, i + 2),
            ),
          )
        : []
      for (const page of [first, ...rest])
        for (const episode of page.episodes) titles.set(episode.number, episode)
    } catch {
      partial = true
    }
    const today = now().toISOString().slice(0, 10)
    const airedByJikan = Math.max(
      0,
      ...[...titles.values()].filter((e) => e.airdate && e.airdate <= today).map((e) => e.number),
    )
    const count = Math.max(status.aired, airedByJikan)
    const episodes = numberedEpisodes(count, runtime).map((episode) => {
      const known = titles.get(episode.number)
      return known ? { ...episode, name: known.name, airdate: known.airdate } : episode
    })
    const named = episodes.some((episode) => episode.name)
    return {
      value: {
        source: named ? 'jikan' : 'shikimori',
        seasons: count ? [{ number: 1, episodes }] : [],
        ended,
      },
      partial,
    }
  }

  async function episodes(id: string, _ctx: CatalogContext): Promise<EpisodeList | null> {
    const parsed = parseTitleId(id)
    if (!parsed || (parsed.kind !== 'series' && parsed.kind !== 'anime')) return null
    const loaded = await memo(`episodes:${id}`, loadedTtl(DETAILS_TTL), () => {
      if (parsed.prefix === 'series') return seriesEpisodes(parsed.value)
      if (parsed.prefix === 'tvmaze') return tvmazeEpisodes(parsed.value)
      return animeEpisodes(Number(parsed.value))
    })
    return loaded.value ? structuredClone(loaded.value) : null
  }

  // -------------------------------------------------------------------------
  // Offers

  async function steamOffers(appid: number, region: RegionCode): Promise<Loaded<StoreOffer[]>> {
    const [priceR, itemR] = await Promise.allSettled([
      fetchAppDetails(http, appid, { country: region, priceOnly: true }),
      fetchSteamItems(http, [appid], { request: 'names', country: region, ttlMs: OFFERS_TTL }).then(
        (items) => itemFor(items, appid),
      ),
    ])
    const item = ok(itemR)
    const price = ok(priceR)
    const steam =
      (price ? steamOfferFromDetails(price, region) : null) ??
      (item ? steamOfferFromItem(item, region, REGIONS[region].currency) : null)
    const name = item ? cleanName(asRecord(item).name) : undefined
    let gog: StoreOffer | null = null
    let gogFailed = false
    if (name) {
      try {
        const product = await gogListing(name, region)
        gog = product ? gogOffer(product, region) : null
      } catch {
        gogFailed = true
      }
    }
    if (priceR.status === 'rejected' && itemR.status === 'rejected')
      throw new CatalogUnavailableError()
    return {
      value: [steam, gog].filter((offer): offer is StoreOffer => offer !== null),
      partial: gogFailed || priceR.status === 'rejected' || itemR.status === 'rejected',
    }
  }

  async function gogOffers(id: string, region: RegionCode): Promise<Loaded<StoreOffer[]>> {
    let product
    try {
      product = await fetchGogProduct(http, id)
    } catch {
      throw new CatalogUnavailableError()
    }
    if (!product) return { value: [], partial: false }
    const [listingR, steamR] = await Promise.allSettled([
      gogListing(product.title, region, id),
      searchSteam(http, product.title),
    ])
    const offers: StoreOffer[] = []
    const steamHit = (ok(steamR) ?? []).find(
      (hit) => gameTitleKey(hit.name) === gameTitleKey(product.title),
    )
    if (steamHit) {
      const price = await fetchAppDetails(http, steamHit.appid, {
        country: region,
        priceOnly: true,
      }).catch(() => null)
      const offer = price ? steamOfferFromDetails(price, region) : null
      if (offer) offers.push(offer)
    }
    const listing = ok(listingR)
    const offer = listing ? gogOffer(listing, region) : null
    if (offer) offers.push(offer)
    if (listingR.status === 'rejected' && steamR.status === 'rejected')
      throw new CatalogUnavailableError()
    return {
      value: offers,
      partial: listingR.status === 'rejected' || steamR.status === 'rejected',
    }
  }

  async function offers(id: string, region: string): Promise<StoreOffer[]> {
    const parsed = parseTitleId(id)
    if (!parsed || parsed.kind !== 'game') return []
    const code = regionOf(region)
    const loaded = await memo(`offers:${id}:${code}`, loadedTtl(OFFERS_TTL), () =>
      parsed.prefix === 'steam'
        ? steamOffers(Number(parsed.value), code)
        : gogOffers(parsed.value, code),
    )
    return structuredClone(loaded.value)
  }

  return { charts, search, details, episodes, offers }
}
