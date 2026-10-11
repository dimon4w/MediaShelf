import { kindOfTitleId } from '../../shared/ids.ts'
import type { EpisodeList, Locale, TitleRecord } from '../../shared/types.ts'
import { CatalogUnavailableError } from '../catalog/types.ts'
import type { AppDeps } from '../context.ts'
import { ApiError } from '../http/errors.ts'
import { readEpisodeList, refreshEpisodeCountersForAll, storeEpisodeList } from './entries.ts'

const DETAILS_TTL = 3 * 86_400_000
const EPISODES_TTL_AIRING = 12 * 3_600_000
const EPISODES_TTL_ENDED = 7 * 86_400_000

const inflight = new Map<string, Promise<unknown>>()

function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = inflight.get(key)
  if (running) return running as Promise<T>
  const promise = run().finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CatalogUnavailableError('Timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const detailsKey = (id: string, locale: Locale) => `details-attempt:${id}:${locale}`

function fetchDetails(deps: AppDeps, id: string, locale: Locale, region: string) {
  return once(`details:${id}:${locale}`, async () => {
    const record = await deps.catalog.details(id, { locale, region })
    if (!record) return null
    const merged = deps.titles.put({ ...record, id, kind: kindOfTitleId(id) ?? record.kind }, true)
    deps.cache.set(detailsKey(id, locale), Date.now(), DETAILS_TTL)
    return merged
  })
}

/** Details with stale-while-revalidate semantics backed by the titles table. */
export async function titleDetails(
  deps: AppDeps,
  id: string,
  locale: Locale,
  region: string,
): Promise<TitleRecord> {
  const stored = deps.titles.get(id)
  const attempted = deps.cache.get<number>(detailsKey(id, locale))
  if (stored?.verified && stored.detailedAt && attempted) return stored.record
  if (stored?.verified && stored.detailedAt && stored.record.descriptions?.[locale]) {
    void fetchDetails(deps, id, locale, region).catch(() => undefined)
    return stored.record
  }
  try {
    const record = await withTimeout(fetchDetails(deps, id, locale, region), 15_000)
    if (record) return record
  } catch (error) {
    // A slow or unreachable catalog should not hide a title the user just saw in a list.
    if (stored) return stored.record
    const recent = deps.titles.recent(id)
    if (recent) return recent
    throw error
  }
  if (stored) return stored.record
  throw new ApiError(404, 'TITLE_NOT_FOUND', 'Title not found')
}

/** A trusted record for adding to the library: stored → recently served → fetched. */
export async function resolveTitle(deps: AppDeps, id: string, locale: Locale, region: string) {
  const stored = deps.titles.get(id)
  if (stored?.verified) return stored.record
  const recent = deps.titles.recent(id)
  if (recent) {
    const record = deps.titles.put(recent, false)
    void fetchDetails(deps, id, locale, region).catch(() => undefined)
    return record
  }
  const record = await withTimeout(fetchDetails(deps, id, locale, region), 15_000)
  if (!record) throw new ApiError(404, 'TITLE_NOT_FOUND', 'Title not found')
  return record
}

export async function episodeList(
  deps: AppDeps,
  id: string,
  locale: Locale,
  region: string,
): Promise<EpisodeList | null> {
  const stored = readEpisodeList(deps.db, id)
  const ttl = stored?.list.ended ? EPISODES_TTL_ENDED : EPISODES_TTL_AIRING
  if (stored && Date.now() - stored.fetchedAt < ttl) return stored.list
  try {
    const list = await withTimeout(
      once(`episodes:${id}`, () => deps.catalog.episodes(id, { locale, region })),
      15_000,
    )
    if (list && list.seasons.some((season) => season.episodes.length)) {
      storeEpisodeList(deps.db, id, list)
      refreshEpisodeCountersForAll(deps.db, id)
      return list
    }
    return stored?.list ?? list
  } catch (error) {
    if (stored) return stored.list
    throw error
  }
}

/** Best effort: library operations work without an episode list, just with less detail. */
export async function ensureEpisodeList(deps: AppDeps, id: string, locale: Locale, region: string) {
  if (readEpisodeList(deps.db, id)) return
  await episodeList(deps, id, locale, region).catch(() => null)
}
