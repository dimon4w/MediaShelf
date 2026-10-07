import type { Episode, EpisodeList, TitleRecord } from '../../shared/types.ts'
import { canonicalGenres } from '../../shared/genres.ts'
import { titleId } from '../../shared/ids.ts'
import { HOUR, MINUTE, isNotFound, type HttpClient } from './http.ts'
import {
  asRecord,
  cleanName,
  cleanText,
  httpsUrl,
  int,
  isoDate,
  num,
  positiveInt,
  records,
  str,
  strings,
  yearFrom,
} from './util.ts'

const API = 'https://api.tvmaze.com'

function airing(status: unknown): TitleRecord['airing'] {
  switch (str(status)) {
    case 'Ended':
      return 'ended'
    case 'Running':
      return 'airing'
    case 'To Be Determined':
      return 'airing'
    case 'In Development':
      return 'upcoming'
    default:
      return null
  }
}

/** Record from a TVMaze show; `series-<tt>` when TVMaze knows the IMDb id. */
export function normalizeTvmazeShow(value: unknown, detailed = false): TitleRecord | null {
  const show = asRecord(value)
  const id = positiveInt(show.id)
  const name = cleanName(show.name)
  if (!id || !name) return null
  const externals = asRecord(show.externals)
  const imdb = str(externals.imdb)
  const validImdb = imdb && /^tt\d{5,12}$/.test(imdb) ? imdb : undefined
  const rating = num(asRecord(show.rating).average)
  const image = asRecord(show.image)
  const url = httpsUrl(show.url)
  const record: TitleRecord = {
    id: validImdb ? titleId.series(validImdb) : titleId.tvmaze(id),
    kind: 'series',
    names: { original: name, en: name },
    year: yearFrom(show.premiered),
    endYear: str(show.status) === 'Ended' ? yearFrom(show.ended) : null,
    poster: httpsUrl(image.original) ?? httpsUrl(image.medium) ?? null,
    backdrop: null,
    genres: canonicalGenres(strings(show.genres)),
    ratings:
      rating !== undefined && rating > 0 ? [{ source: 'tvmaze', value: rating, max: 10 }] : [],
    runtime: positiveInt(show.averageRuntime) ?? positiveInt(show.runtime) ?? null,
    airing: airing(show.status),
    links: url ? [{ source: 'tvmaze', url }] : [],
    externalIds: { tvmaze: String(id), ...(validImdb ? { imdb: validImdb } : {}) },
  }
  if (!detailed) return record
  const summary = cleanText(show.summary)
  if (summary) record.descriptions = { en: summary }
  record.releaseDate = isoDate(show.premiered)
  const network =
    cleanName(asRecord(show.network).name) ?? cleanName(asRecord(show.webChannel).name)
  if (network) record.companies = [network]
  record.country =
    str(asRecord(asRecord(show.network).country).name) ??
    str(asRecord(asRecord(show.webChannel).country).name) ??
    null
  const seasons = records(asRecord(show._embedded).seasons).filter(
    (season) => (int(season.number) ?? 0) > 0,
  )
  if (seasons.length) {
    record.seasons = seasons.length
    const total = seasons.reduce((sum, season) => sum + (positiveInt(season.episodeOrder) ?? 0), 0)
    if (total > 0) record.episodes = total
  }
  return record
}

export function normalizeTvmazeSearch(payload: unknown): { record: TitleRecord; weight: number }[] {
  return records(payload)
    .map((entry) => ({
      record: normalizeTvmazeShow(entry.show),
      weight: (num(asRecord(entry.show).weight) ?? 0) / 100,
    }))
    .filter((entry): entry is { record: TitleRecord; weight: number } => entry.record !== null)
}

/** Episodes grouped by season; specials (no number) move to season 0 in air order. */
export function normalizeTvmazeEpisodes(payload: unknown, ended: boolean | null): EpisodeList {
  const seasons = new Map<number, Episode[]>()
  const specials: Episode[] = []
  for (const item of records(payload)) {
    const season = int(item.season)
    const number = int(item.number)
    const episode: Episode = {
      season: season ?? 0,
      number: number ?? 0,
      name: cleanName(item.name) ?? null,
      airdate: isoDate(item.airdate),
      runtime: positiveInt(item.runtime) ?? null,
    }
    const special =
      str(item.type)?.includes('special') || number === undefined || season === undefined
    if (special) {
      specials.push(episode)
      continue
    }
    const list = seasons.get(episode.season) ?? []
    list.push(episode)
    seasons.set(episode.season, list)
  }
  specials.sort((a, b) => (a.airdate ?? '9999').localeCompare(b.airdate ?? '9999'))
  if (specials.length)
    seasons.set(
      0,
      specials.map((episode, index) => ({ ...episode, season: 0, number: index + 1 })),
    )
  return {
    source: 'tvmaze',
    seasons: [...seasons.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, episodes]) => ({
        number,
        episodes: episodes.sort((a, b) => a.number - b.number),
      })),
    ended,
  }
}

export function tvmazeEnded(show: unknown): boolean | null {
  const status = str(asRecord(show).status)
  return status ? status === 'Ended' : null
}

async function orNull(promise: Promise<unknown>): Promise<unknown> {
  try {
    return await promise
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Show for an IMDb id (TVMaze answers with a redirect to the show), null when unknown. */
export async function lookupTvmazeByImdb(http: HttpClient, imdb: string): Promise<unknown> {
  return orNull(
    http.json(`${API}/lookup/shows?imdb=${encodeURIComponent(imdb)}`, { ttlMs: 6 * HOUR }),
  )
}

export async function fetchTvmazeShow(http: HttpClient, id: string | number): Promise<unknown> {
  return orNull(http.json(`${API}/shows/${id}?embed[]=seasons`, { ttlMs: 6 * HOUR }))
}

export async function fetchTvmazeEpisodes(http: HttpClient, id: string | number): Promise<unknown> {
  return orNull(http.json(`${API}/shows/${id}/episodes?specials=1`, { ttlMs: 6 * HOUR }))
}

export async function searchTvmaze(http: HttpClient, query: string) {
  return normalizeTvmazeSearch(
    await http.json(`${API}/search/shows?q=${encodeURIComponent(query)}`, { ttlMs: 10 * MINUTE }),
  )
}
