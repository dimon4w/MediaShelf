import type { TitleRecord } from '../../shared/types.ts'
import { titleId } from '../../shared/ids.ts'
import { HOUR, MINUTE, type HttpClient } from './http.ts'
import { imdbUrl } from './cinemeta.ts'
import { asRecord, cleanName, httpsUrl, positiveInt, records, str, yearFrom } from './util.ts'

const MOVIE_TYPES = new Set(['movie', 'tvMovie', 'tvSpecial', 'video'])
const SERIES_TYPES = new Set(['tvSeries', 'tvMiniSeries'])

/** Resized IMDb artwork; the raw `._V1_.jpg` originals can be several thousand pixels tall. */
export function imdbImage(value: unknown, width = 600): string | undefined {
  const url = httpsUrl(value)
  if (!url) return undefined
  return url.replace(/\._V1_[^/]*\.(jpg|png)$/i, `._V1_QL80_UX${width}_.$1`)
}

export interface ImdbSuggestion {
  record: TitleRecord
  /** IMDb popularity rank (1 = most popular), when present. */
  rank: number | null
}

/** v3.sg.media-imdb.com/suggestion payload: movies and series only. */
export function normalizeImdbSuggestions(payload: unknown): ImdbSuggestion[] {
  const result: ImdbSuggestion[] = []
  for (const item of records(asRecord(payload).d)) {
    const imdb = str(item.id)
    const qid = str(item.qid)
    const name = cleanName(item.l)
    if (!imdb || !/^tt\d{5,12}$/.test(imdb) || !qid || !name) continue
    const kind = MOVIE_TYPES.has(qid) ? 'movie' : SERIES_TYPES.has(qid) ? 'series' : null
    if (!kind) continue
    const range = str(item.yr)?.match(/^(\d{4})-(\d{4})?$/)
    const record: TitleRecord = {
      id: kind === 'movie' ? titleId.movie(imdb) : titleId.series(imdb),
      kind,
      names: { original: name, en: name },
      year: yearFrom(item.y),
      poster: imdbImage(asRecord(item.i).imageUrl) ?? null,
      backdrop: null,
      genres: [],
      ratings: [],
      links: [{ source: 'imdb', url: imdbUrl(imdb) }],
      externalIds: { imdb },
    }
    if (kind === 'series' && range) record.endYear = range[2] ? Number(range[2]) : null
    result.push({ record, rank: positiveInt(item.rank) ?? null })
  }
  return result
}

function suggestionUrl(query: string) {
  const term = query.trim().toLowerCase().replace(/\s+/g, ' ')
  return `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(term)}.json`
}

export async function searchImdb(http: HttpClient, query: string): Promise<ImdbSuggestion[]> {
  return normalizeImdbSuggestions(await http.json(suggestionUrl(query), { ttlMs: 10 * MINUTE }))
}

/** Suggestion entry for one IMDb id (the endpoint resolves `tt…` queries to that title). */
export async function lookupImdb(http: HttpClient, imdb: string): Promise<ImdbSuggestion | null> {
  const found = normalizeImdbSuggestions(await http.json(suggestionUrl(imdb), { ttlMs: 6 * HOUR }))
  return found.find((item) => item.record.externalIds.imdb === imdb) ?? null
}
