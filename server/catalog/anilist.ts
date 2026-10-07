import type { TitleRecord } from '../../shared/types.ts'
import { canonicalGenres } from '../../shared/genres.ts'
import { titleId } from '../../shared/ids.ts'
import { HOUR, MINUTE, isNotFound, type HttpClient } from './http.ts'
import {
  asRecord,
  cleanName,
  cleanText,
  httpsUrl,
  positiveInt,
  records,
  str,
  strings,
} from './util.ts'

const ENDPOINT = 'https://graphql.anilist.co'

const SUMMARY_FIELDS = `id idMal title { romaji english native } coverImage { extraLarge large } bannerImage
  genres averageScore popularity episodes duration status seasonYear format isAdult
  startDate { year month day } endDate { year month day }`

const PAGE_QUERY = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $idMal: [Int]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: $sort, idMal_in: $idMal, isAdult: false) { ${SUMMARY_FIELDS} }
  }
}`

const MEDIA_QUERY = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    ${SUMMARY_FIELDS}
    description(asHtml: false) siteUrl trailer { id site }
    studios(isMain: true) { nodes { name } }
  }
}`

function airing(status: unknown): TitleRecord['airing'] {
  switch (str(status)) {
    case 'FINISHED':
    case 'CANCELLED':
      return 'ended'
    case 'RELEASING':
    case 'HIATUS':
      return 'airing'
    case 'NOT_YET_RELEASED':
      return 'upcoming'
    default:
      return null
  }
}

function fuzzyDate(value: unknown): string | null {
  const date = asRecord(value)
  const year = positiveInt(date.year)
  const month = positiveInt(date.month)
  const day = positiveInt(date.day)
  if (!year || !month || !day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Record keyed by MAL id; media without idMal cannot be matched to Shikimori and are skipped. */
export function normalizeAniListMedia(value: unknown, detailed = false): TitleRecord | null {
  const media = asRecord(value)
  const mal = positiveInt(media.idMal)
  const id = positiveInt(media.id)
  const title = asRecord(media.title)
  const romaji = cleanName(title.romaji)
  const english = cleanName(title.english)
  const original = romaji ?? english ?? cleanName(title.native)
  if (!mal || !id || !original || media.isAdult === true) return null
  const score = positiveInt(media.averageScore)
  const cover = asRecord(media.coverImage)
  const status = airing(media.status)
  const siteUrl = httpsUrl(media.siteUrl) ?? `https://anilist.co/anime/${id}`
  const record: TitleRecord = {
    id: titleId.anime(mal),
    kind: 'anime',
    names: { original, ...(english ? { en: english } : {}) },
    year: positiveInt(asRecord(media.startDate).year) ?? positiveInt(media.seasonYear) ?? null,
    endYear: status === 'ended' ? (positiveInt(asRecord(media.endDate).year) ?? null) : null,
    poster: httpsUrl(cover.extraLarge) ?? httpsUrl(cover.large) ?? null,
    backdrop: httpsUrl(media.bannerImage) ?? null,
    genres: canonicalGenres(strings(media.genres)),
    ratings: score ? [{ source: 'anilist', value: score, max: 100 }] : [],
    runtime: positiveInt(media.duration) ?? null,
    episodes: positiveInt(media.episodes) ?? null,
    airing: status,
    links: [{ source: 'anilist', url: siteUrl }],
    externalIds: { mal: String(mal), anilist: String(id) },
  }
  if (!detailed) return record
  const description = cleanText(media.description)
  if (description) record.descriptions = { en: description }
  record.releaseDate = fuzzyDate(media.startDate)
  const trailer = asRecord(media.trailer)
  const trailerId = str(trailer.id)
  record.trailer =
    trailer.site === 'youtube' && trailerId && /^[\w-]{11}$/.test(trailerId)
      ? { type: 'youtube', id: trailerId }
      : null
  record.creators = records(asRecord(media.studios).nodes)
    .map((studio) => cleanName(studio.name))
    .filter((name): name is string => !!name)
  return record
}

export interface AniListPage {
  items: TitleRecord[]
  hasNextPage: boolean
}

export function normalizeAniListPage(payload: unknown): AniListPage {
  const page = asRecord(asRecord(asRecord(payload).data).Page)
  return {
    items: records(page.media)
      .map((media) => normalizeAniListMedia(media))
      .filter((item): item is TitleRecord => item !== null),
    hasNextPage: asRecord(page.pageInfo).hasNextPage === true,
  }
}

export async function fetchAniListTrending(
  http: HttpClient,
  page: number,
  perPage = 50,
): Promise<AniListPage> {
  const payload = await http.json(ENDPOINT, {
    method: 'POST',
    body: { query: PAGE_QUERY, variables: { page, perPage, sort: ['TRENDING_DESC'] } },
    ttlMs: 30 * MINUTE,
  })
  return normalizeAniListPage(payload)
}

export async function fetchAniListByMalIds(
  http: HttpClient,
  ids: readonly number[],
): Promise<TitleRecord[]> {
  if (!ids.length) return []
  const payload = await http.json(ENDPOINT, {
    method: 'POST',
    body: { query: PAGE_QUERY, variables: { page: 1, perPage: 50, idMal: ids.slice(0, 50) } },
    ttlMs: 6 * HOUR,
  })
  return normalizeAniListPage(payload).items
}

/** Full media for a MAL id, null when AniList does not know it. */
export async function fetchAniListMedia(
  http: HttpClient,
  idMal: number,
): Promise<TitleRecord | null> {
  try {
    const payload = await http.json(ENDPOINT, {
      method: 'POST',
      body: { query: MEDIA_QUERY, variables: { idMal } },
      ttlMs: 6 * HOUR,
    })
    return normalizeAniListMedia(asRecord(asRecord(payload).data).Media, true)
  } catch (error) {
    // AniList reports unknown ids as HTTP 404 with a GraphQL error body.
    if (isNotFound(error)) return null
    throw error
  }
}
