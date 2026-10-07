import type {
  ChartList,
  ChartPage,
  EpisodeList,
  Kind,
  Locale,
  SearchResult,
  StoreOffer,
  TitleRecord,
} from '../../shared/types.ts'

export interface CatalogContext {
  locale: Locale
  /** Price region, see shared/regions.ts */
  region: string
}

/**
 * Everything the HTTP layer needs from external catalogs. Implementations must never throw
 * for partial upstream failures; they throw CatalogUnavailableError only when nothing usable
 * could be produced for the request.
 */
export interface CatalogService {
  charts(kind: Kind, list: ChartList, page: number, ctx: CatalogContext): Promise<ChartPage>
  search(query: string, kind: Kind | 'all', ctx: CatalogContext): Promise<SearchResult>
  /** Full record (detailed: true) or null when the source says the id does not exist. */
  details(id: string, ctx: CatalogContext): Promise<TitleRecord | null>
  /** Null for kinds without episodes or when the title does not exist. */
  episodes(id: string, ctx: CatalogContext): Promise<EpisodeList | null>
  /** Verified store offers (games only); empty array for other kinds. */
  offers(id: string, region: string): Promise<StoreOffer[]>
}

/** Durable key/value cache backed by SQLite in production, a Map in tests. */
export interface PersistentCache {
  get<T>(key: string): T | undefined
  set(key: string, value: unknown, ttlMs: number): void
}

export class CatalogUnavailableError extends Error {
  constructor(message = 'Catalog temporarily unavailable') {
    super(message)
    this.name = 'CatalogUnavailableError'
  }
}

export function memoryCache(): PersistentCache {
  const values = new Map<string, { value: unknown; until: number }>()
  return {
    get<T>(key: string) {
      const hit = values.get(key)
      if (!hit) return undefined
      if (hit.until < Date.now()) {
        values.delete(key)
        return undefined
      }
      return hit.value as T
    },
    set(key, value, ttlMs) {
      values.set(key, { value, until: Date.now() + ttlMs })
    },
  }
}
