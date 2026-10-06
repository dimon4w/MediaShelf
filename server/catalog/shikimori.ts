import type { Episode, EpisodeList, TitleRecord, Trailer } from '../../shared/types.ts'
import { titleId } from '../../shared/ids.ts'
import { knownGenres } from './genres.ts'
import { HOUR, MINUTE, isNotFound, type HttpClient } from './http.ts'
import {
  asArray,
  asRecord,
  cleanName,
  cleanText,
  httpsUrl,
  isoDate,
  num,
  positiveInt,
  records,
  str,
  strings,
  yearFrom,
} from './util.ts'

export const SHIKIMORI_ORIGIN = 'https://shikimori.io'
const LIST_KINDS = 'tv,movie,ona,ova'
// Music videos, promos and commercials are not titles a library tracks.
const IGNORED_KINDS = new Set(['music', 'pv', 'cm'])

/** Absolute image URL; `/system/…` paths are relative, `/assets/globals/missing_*` are placeholders. */
export function shikimoriImage(value: unknown): string | undefined {
  const path = str(value)
  if (!path || path.includes('/assets/globals/missing')) return undefined
  return path.startsWith('/') && !path.startsWith('//')
    ? httpsUrl(SHIKIMORI_ORIGIN + path)
    : httpsUrl(path)
}

export interface ShikimoriStatus {
  airing: TitleRecord['airing']
  /** Planned episodes when known, otherwise aired. */
  total: number | null
  /** Episodes that have aired (released shows: all of them). */
  aired: number
}

export function shikimoriStatus(value: unknown): ShikimoriStatus {
  const item = asRecord(value)
  const status = str(item.status)
  const planned = positiveInt(item.episodes) ?? 0
  const airedCount = positiveInt(item.episodes_aired) ?? 0
  const airing =
    status === 'anons'
      ? 'upcoming'
      : status === 'ongoing'
        ? 'airing'
        : status === 'released'
          ? 'ended'
          : null
  // Released titles often keep a stale episodes_aired (0 or n-1); ongoing ones may have episodes = 0.
  const aired = airing === 'ended' ? planned || airedCount : airing === 'upcoming' ? 0 : airedCount
  return { airing, total: planned || airedCount || null, aired }
}

/** Record from a Shikimori anime (list item or full `/api/animes/<id>`). */
export function normalizeShikimoriAnime(value: unknown, detailed = false): TitleRecord | null {
  const item = asRecord(value)
  const id = positiveInt(item.id)
  const name = cleanName(item.name)
  if (!id || !name || IGNORED_KINDS.has(str(item.kind) ?? '')) return null
  const russian = cleanName(item.russian)
  const english = cleanName(strings(item.english)[0])
  const score = num(item.score)
  const status = shikimoriStatus(item)
  const url = str(item.url)
  const genres = records(item.genres)
  // Genres first, then themes, then demographics (Shounen, Seinen, …).
  const order = (kind: unknown) => (kind === 'genre' ? 0 : kind === 'theme' ? 1 : 2)
  const record: TitleRecord = {
    id: titleId.anime(id),
    kind: 'anime',
    names: {
      original: name,
      ...(english ? { en: english } : {}),
      ...(russian ? { ru: russian } : {}),
    },
    year: yearFrom(item.aired_on),
    endYear:
      status.airing === 'ended' ? (yearFrom(item.released_on) ?? yearFrom(item.aired_on)) : null,
    poster: shikimoriImage(asRecord(item.image).original) ?? null,
    backdrop: null,
    genres: knownGenres(
      [...genres]
        .sort((a, b) => order(a.kind) - order(b.kind))
        .map((genre) => str(genre.name) ?? ''),
    ),
    ratings:
      score !== undefined && score > 0 ? [{ source: 'shikimori', value: score, max: 10 }] : [],
    runtime: positiveInt(item.duration) ?? null,
    episodes: status.total,
    airing: status.airing,
    links: [
      {
        source: 'shikimori',
        url: url?.startsWith('/') ? SHIKIMORI_ORIGIN + url : `${SHIKIMORI_ORIGIN}/animes/${id}`,
      },
    ],
    externalIds: { mal: String(id) },
  }
  if (!detailed) return record
  const description = cleanText(item.description)
  if (description) record.descriptions = { ru: description }
  record.releaseDate = isoDate(item.aired_on)
  record.creators = records(item.studios)
    .map((studio) => cleanName(studio.name))
    .filter((studio): studio is string => !!studio)
    .slice(0, 5)
  return record
}

export function normalizeShikimoriList(payload: unknown): TitleRecord[] {
  return asArray(payload)
    .map((item) => normalizeShikimoriAnime(item))
    .filter((item): item is TitleRecord => item !== null)
}

export function shikimoriScreenshots(payload: unknown): string[] {
  return records(payload)
    .map((shot) => shikimoriImage(shot.original))
    .filter((url): url is string => !!url)
    .slice(0, 12)
}

/** First official promo video hosted on YouTube. */
export function shikimoriTrailer(payload: unknown): Trailer | null {
  const videos = records(payload).filter((video) => video.hosting === 'youtube')
  for (const kind of ['pv', 'cm', 'op']) {
    for (const video of videos.filter((entry) => entry.kind === kind)) {
      const match = str(video.url)?.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([\w-]{11})/)
      if (match) return { type: 'youtube', id: match[1] }
    }
  }
  return null
}

/** Numbered episode list from counts alone (one season). */
export function numberedEpisodes(count: number, runtime: number | null): Episode[] {
  return Array.from({ length: Math.max(0, Math.min(count, 5000)) }, (_, index) => ({
    season: 1,
    number: index + 1,
    name: null,
    airdate: null,
    runtime,
  }))
}

export function shikimoriEpisodes(anime: unknown): EpisodeList {
  const item = asRecord(anime)
  const status = shikimoriStatus(item)
  return {
    source: 'shikimori',
    seasons:
      status.aired > 0
        ? [
            {
              number: 1,
              episodes: numberedEpisodes(status.aired, positiveInt(item.duration) ?? null),
            },
          ]
        : [],
    ended: status.airing === null ? null : status.airing === 'ended',
  }
}

// ---------------------------------------------------------------------------
// Fetchers

export interface ShikimoriListQuery {
  order: 'popularity' | 'ranked' | 'aired_on'
  page: number
  limit?: number
  status?: string
  season?: string
}

export async function fetchShikimoriList(
  http: HttpClient,
  query: ShikimoriListQuery,
): Promise<unknown[]> {
  const params = new URLSearchParams({
    order: query.order,
    kind: LIST_KINDS,
    limit: String(query.limit ?? 50),
    page: String(query.page),
  })
  if (query.status) params.set('status', query.status)
  if (query.season) params.set('season', query.season)
  return asArray(
    await http.json(`${SHIKIMORI_ORIGIN}/api/animes?${params}`, { ttlMs: 30 * MINUTE }),
  )
}

export async function fetchShikimoriByIds(
  http: HttpClient,
  ids: readonly number[],
): Promise<unknown[]> {
  if (!ids.length) return []
  const url = `${SHIKIMORI_ORIGIN}/api/animes?ids=${ids.slice(0, 50).join(',')}&limit=50`
  return asArray(await http.json(url, { ttlMs: 6 * HOUR }))
}

export async function searchShikimori(http: HttpClient, query: string): Promise<unknown[]> {
  const url = `${SHIKIMORI_ORIGIN}/api/animes?search=${encodeURIComponent(query)}&limit=20`
  return asArray(await http.json(url, { ttlMs: 10 * MINUTE }))
}

/** Full anime or null when Shikimori has no such id. */
export async function fetchShikimoriAnime(http: HttpClient, id: number): Promise<unknown> {
  try {
    return await http.json(`${SHIKIMORI_ORIGIN}/api/animes/${id}`, { ttlMs: 6 * HOUR })
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

export async function fetchShikimoriScreenshots(http: HttpClient, id: number): Promise<string[]> {
  return shikimoriScreenshots(
    await http.json(`${SHIKIMORI_ORIGIN}/api/animes/${id}/screenshots`, { ttlMs: 6 * HOUR }),
  )
}

export async function fetchShikimoriTrailer(http: HttpClient, id: number): Promise<Trailer | null> {
  return shikimoriTrailer(
    await http.json(`${SHIKIMORI_ORIGIN}/api/animes/${id}/videos`, { ttlMs: 6 * HOUR }),
  )
}

/** Shikimori season filter for the current and previous anime season ("summer_2026,fall_2026"). */
export function recentSeasons(now: Date): string {
  const names = ['winter', 'spring', 'summer', 'fall']
  const index = Math.floor(now.getUTCMonth() / 3)
  const year = now.getUTCFullYear()
  const previous = index === 0 ? `${names[3]}_${year - 1}` : `${names[index - 1]}_${year}`
  return `${previous},${names[index]}_${year}`
}
