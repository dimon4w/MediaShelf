import type { PersistentCache } from './types.ts'
import { DAY, HOUR, isNotFound, type HttpClient } from './http.ts'
import {
  asRecord,
  chunk,
  cleanName,
  cleanText,
  positiveInt,
  records,
  str,
  unique,
  withTimeout,
} from './util.ts'

const SPARQL = 'https://query.wikidata.org/sparql'
const RU_WIKI = 'https://ru.wikipedia.org/wiki/'
const LABEL_TTL = 30 * DAY
const MISS_TTL = 3 * DAY

export interface RuLabel {
  label?: string
  /** ru.wikipedia.org article URL. */
  article?: string
  qid?: string
}

function binding(row: Record<string, unknown>, name: string): string | undefined {
  return str(asRecord(row[name]).value)
}

function qidOf(uri: string | undefined): string | undefined {
  return uri?.match(/\/entity\/(Q\d+)$/)?.[1]
}

/** Some labels copy the article title, e.g. "Груз (фильм, 2026)". */
function stripDisambiguation(label: string | undefined): string | undefined {
  return label?.replace(/\s*\([^()]*(?:фильм|сериал|аниме|шоу)[^()]*\)\s*$/i, '') || undefined
}

export function buildLabelsQuery(imdbIds: readonly string[]): string {
  const values = imdbIds
    .filter((id) => /^tt\d{5,12}$/.test(id))
    .map((id) => `"${id}"`)
    .join(' ')
  return `SELECT ?imdb ?item ?label ?article WHERE {
  VALUES ?imdb { ${values} }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = "ru") }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://ru.wikipedia.org/> }
}`
}

/** SPARQL rows → Russian label and ruwiki article per IMDb id (rows with a label win). */
export function parseLabelsResponse(payload: unknown): Map<string, RuLabel> {
  const result = new Map<string, RuLabel>()
  for (const row of records(asRecord(asRecord(payload).results).bindings)) {
    const imdb = binding(row, 'imdb')
    if (!imdb) continue
    const label = stripDisambiguation(cleanName(binding(row, 'label')))
    const articleUri = binding(row, 'article')
    const article = articleUri?.startsWith(RU_WIKI) ? articleUri : undefined
    const entry = result.get(imdb) ?? {}
    if (label && !entry.label) {
      entry.label = label
      entry.qid = qidOf(binding(row, 'item'))
    }
    if (article && !entry.article) entry.article = article
    entry.qid ??= qidOf(binding(row, 'item'))
    result.set(imdb, entry)
  }
  return result
}

export function parseWikipediaSummary(payload: unknown): string | undefined {
  const page = asRecord(payload)
  if (page.type === 'disambiguation') return undefined
  return cleanText(page.extract)
}

export interface WikidataHit {
  qid: string
  labelRu?: string
  labelEn?: string
  imdb?: string
  steam?: number
  mal?: number
}

export function parseEntitySearch(payload: unknown): string[] {
  return unique(
    records(asRecord(payload).search)
      .map((item) => str(item.id))
      .filter((id): id is string => !!id && /^Q\d+$/.test(id)),
  )
}

export function buildClaimsQuery(qids: readonly string[]): string {
  const values = qids
    .filter((id) => /^Q\d+$/.test(id))
    .map((id) => `wd:${id}`)
    .join(' ')
  return `SELECT ?item ?imdb ?steam ?mal ?label ?labelEn WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P345 ?imdb }
  OPTIONAL { ?item wdt:P1733 ?steam }
  OPTIONAL { ?item wdt:P4086 ?mal }
  OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = "ru") }
  OPTIONAL { ?item rdfs:label ?labelEn FILTER(lang(?labelEn) = "en") }
}`
}

/** One hit per item, in `order`, keeping only items that link to a source we can hydrate. */
export function parseClaimsResponse(payload: unknown, order: readonly string[]): WikidataHit[] {
  const hits = new Map<string, WikidataHit>()
  for (const row of records(asRecord(asRecord(payload).results).bindings)) {
    const qid = qidOf(binding(row, 'item'))
    if (!qid) continue
    const hit = hits.get(qid) ?? { qid }
    const imdb = binding(row, 'imdb')
    if (imdb && /^tt\d{5,12}$/.test(imdb)) hit.imdb ??= imdb
    hit.steam ??= positiveInt(binding(row, 'steam'))
    hit.mal ??= positiveInt(binding(row, 'mal'))
    hit.labelRu ??= stripDisambiguation(cleanName(binding(row, 'label')))
    hit.labelEn ??= cleanName(binding(row, 'labelEn'))
    hits.set(qid, hit)
  }
  return order
    .map((qid) => hits.get(qid))
    .filter((hit): hit is WikidataHit => !!hit && !!(hit.imdb || hit.steam || hit.mal))
}

async function sparql(
  http: HttpClient,
  query: string,
  ttlMs: number,
  timeoutMs = 8_000,
): Promise<unknown> {
  return http.json(`${SPARQL}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json' },
    ttlMs,
    timeoutMs,
  })
}

/** Items whose Russian (or any) label matches a query, resolved to IMDb/Steam/MAL ids. */
export async function searchWikidata(http: HttpClient, query: string): Promise<WikidataHit[]> {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language: 'ru',
    uselang: 'ru',
    type: 'item',
    limit: '10',
    format: 'json',
  })
  const qids = parseEntitySearch(
    await http.json(`https://www.wikidata.org/w/api.php?${params}`, { ttlMs: HOUR }),
  )
  if (!qids.length) return []
  return parseClaimsResponse(await sparql(http, buildClaimsQuery(qids), HOUR), qids)
}

export interface RuLabelResolver {
  /** Labels already in the persistent cache; never touches the network. */
  peek(imdbIds: readonly string[]): Map<string, RuLabel>
  /** Whether a lookup already finished for this id (hit or cached miss). */
  known(imdb: string): boolean
  /**
   * Fetches missing labels (one query per 50 ids) and waits at most `budgetMs`; a slow query
   * keeps running and fills the cache for the next request.
   */
  resolve(imdbIds: readonly string[], budgetMs?: number): Promise<Map<string, RuLabel>>
}

export function createRuLabelResolver(
  http: HttpClient,
  cache: PersistentCache,
  options: { budgetMs?: number } = {},
): RuLabelResolver {
  const defaultBudget = options.budgetMs ?? 2500
  const pending = new Map<string, Promise<void>>()
  const cacheKey = (imdb: string) => `catalog:wikidata:ru:${imdb}`

  function peek(imdbIds: readonly string[]) {
    const result = new Map<string, RuLabel>()
    for (const imdb of imdbIds) {
      const entry = cache.get<RuLabel>(cacheKey(imdb))
      if (entry && (entry.label || entry.article)) result.set(imdb, entry)
    }
    return result
  }

  async function fetchLabels(imdbIds: readonly string[]) {
    for (const ids of chunk(imdbIds, 50)) {
      const found = parseLabelsResponse(await sparql(http, buildLabelsQuery(ids), HOUR, 20_000))
      for (const imdb of ids) {
        const entry = found.get(imdb) ?? {}
        cache.set(cacheKey(imdb), entry, entry.label ? LABEL_TTL : MISS_TTL)
      }
    }
  }

  return {
    peek,
    known: (imdb) => cache.get(cacheKey(imdb)) !== undefined,
    async resolve(imdbIds, budgetMs = defaultBudget) {
      const ids = unique(imdbIds.filter((id) => /^tt\d{5,12}$/.test(id)))
      const missing = ids.filter((id) => !pending.has(id) && cache.get(cacheKey(id)) === undefined)
      if (missing.length) {
        // Failures are not cached; the next request retries.
        const job = fetchLabels(missing).catch(() => undefined)
        for (const id of missing) pending.set(id, job)
        void job.finally(() => missing.forEach((id) => pending.delete(id)))
      }
      const waits = unique(
        ids.map((id) => pending.get(id)).filter((job): job is Promise<void> => !!job),
      )
      if (waits.length)
        await withTimeout(
          Promise.all(waits).then(() => undefined),
          budgetMs,
          undefined,
        )
      return peek(ids)
    },
  }
}

function extractKey(article: string): string | undefined {
  return article.startsWith(RU_WIKI)
    ? `catalog:wikipedia:ru:${article.slice(RU_WIKI.length)}`
    : undefined
}

/** Extract from the persistent cache only. */
export function cachedWikipediaExtract(
  cache: PersistentCache,
  article: string,
): string | undefined {
  const key = extractKey(article)
  return key ? cache.get<{ extract?: string }>(key)?.extract : undefined
}

/** Lead section of a ru.wikipedia.org article, cached for 30 days (misses for one day). */
export async function fetchWikipediaExtract(
  http: HttpClient,
  cache: PersistentCache,
  article: string,
): Promise<string | undefined> {
  const cacheKey = extractKey(article)
  if (!cacheKey) return undefined
  const title = article.slice(RU_WIKI.length)
  const cached = cache.get<{ extract?: string }>(cacheKey)
  if (cached) return cached.extract
  let extract: string | undefined
  try {
    extract = parseWikipediaSummary(
      await http.json(`https://ru.wikipedia.org/api/rest_v1/page/summary/${title}`, {
        ttlMs: HOUR,
        timeoutMs: 6_000,
      }),
    )
  } catch (error) {
    if (!isNotFound(error)) throw error
  }
  cache.set(cacheKey, extract ? { extract } : {}, extract ? 30 * DAY : DAY)
  return extract
}
