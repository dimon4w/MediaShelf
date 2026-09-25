import type { ChartList, Episode, EpisodeList, TitleRecord, Trailer } from '../../shared/types.ts'
import { canonicalGenres } from '../../shared/genres.ts'
import { titleId } from '../../shared/ids.ts'
import { HOUR, MINUTE, type HttpClient } from './http.ts'
import {
  asRecord,
  cleanName,
  cleanText,
  httpsUrl,
  int,
  isoDate,
  num,
  parseMinutes,
  records,
  str,
  strings,
  truncate,
  yearFrom,
} from './util.ts'

export type ScreenKind = 'movie' | 'series'

const CATALOG_BASE = 'https://cinemeta-catalogs.strem.io'
// Catalogs moved to cinemeta-catalogs (the old v3 catalog URLs always 307 there). Metas stay on
// v3, which usually answers itself with the richer shape (released, writer) and sometimes
// 307s to cinemeta-live.strem.io (credits_crew/credits_cast instead); fetch follows redirects.
const META_BASE = 'https://v3-cinemeta.strem.io'

/** Cinemeta catalogs return 50 slots per page (a few may be filtered out). */
export const CINEMETA_PAGE_SIZE = 50

export function cinemetaCatalogUrl(
  kind: ScreenKind,
  list: Exclude<ChartList, 'top'>,
  skip: number,
  year: number,
) {
  if (list === 'trending') return `${CATALOG_BASE}/top/catalog/${kind}/top/skip=${skip}.json`
  return `${CATALOG_BASE}/year/catalog/${kind}/year/genre=${year}${skip ? `&skip=${skip}` : ''}.json`
}

export function cinemetaMetaUrl(kind: ScreenKind, imdb: string) {
  return `${META_BASE}/meta/${kind}/${imdb}.json`
}

export function imdbUrl(imdb: string) {
  return `https://www.imdb.com/title/${imdb}/`
}

/** metahub posters come in small/medium/large; medium (500×750) suits cards and detail pages. */
export function metahubPoster(value: unknown): string | undefined {
  return httpsUrl(value)?.replace('/poster/small/', '/poster/medium/')
}

function youtubeId(value: unknown): string | undefined {
  const id = str(value)
  return id && /^[\w-]{11}$/.test(id) ? id : undefined
}

const CREATOR_JOBS = new Set(['Director', 'Creator', 'Writer', 'Screenplay'])

function creatorsOf(meta: Record<string, unknown>): string[] {
  const directors = strings(meta.director)
  if (directors.length) return directors
  const writers = strings(meta.writer)
  if (writers.length) return writers
  return records(meta.credits_crew)
    .filter((person) => CREATOR_JOBS.has(str(person.job) ?? ''))
    .map((person) => cleanName(person.name))
    .filter((name): name is string => !!name)
}

function airing(status: unknown): TitleRecord['airing'] {
  const value = str(status)?.toLowerCase()
  if (!value) return undefined
  if (value === 'ended' || value === 'canceled' || value === 'cancelled') return 'ended'
  if (value.includes('upcoming') || value.includes('planned') || value.includes('production'))
    return 'upcoming'
  return 'airing'
}

/** Record from a Cinemeta meta object (catalog item or /meta response). */
export function normalizeCinemetaMeta(
  value: unknown,
  kind: ScreenKind,
  detailed = false,
): TitleRecord | null {
  const meta = asRecord(value)
  const imdb = [str(meta.imdb_id), str(meta.id)].find((id) => id && /^tt\d{5,12}$/.test(id))
  const name = cleanName(meta.name)
  if (!imdb || !name) return null

  const rating = num(meta.imdbRating)
  const releaseInfo = str(meta.releaseInfo) ?? ''
  const years = releaseInfo.match(/(\d{4})\s*[–-]\s*(\d{4})?/)
  const record: TitleRecord = {
    id: kind === 'movie' ? titleId.movie(imdb) : titleId.series(imdb),
    kind,
    names: { original: name, en: name },
    year: yearFrom(releaseInfo) ?? yearFrom(meta.year) ?? yearFrom(meta.released),
    poster: metahubPoster(meta.poster) ?? null,
    backdrop: httpsUrl(meta.background) ?? null,
    genres: canonicalGenres(
      strings(meta.genres).length ? strings(meta.genres) : strings(meta.genre),
    ),
    ratings:
      rating !== undefined && rating > 0 && rating <= 10
        ? [{ source: 'imdb', value: rating, max: 10 }]
        : [],
    runtime: parseMinutes(meta.runtime),
    links: [{ source: 'imdb', url: imdbUrl(imdb) }],
    externalIds: { imdb },
  }
  if (kind === 'series') {
    record.endYear = years ? (years[2] ? Number(years[2]) : null) : undefined
    const status = airing(meta.status)
    if (status) record.airing = status
  }
  if (!detailed) return record

  const description = cleanText(meta.description)
  if (description) record.descriptions = { en: description }
  record.creators = [...new Set(creatorsOf(meta))].slice(0, 5)
  const cast = strings(meta.cast)
  record.cast = (
    cast.length ? cast : records(meta.credits_cast).map((person) => str(person.name) ?? '')
  )
    .filter(Boolean)
    .slice(0, 12)
  const country = str(meta.country)
  record.country = country ? truncate(country, 120) : null
  record.releaseDate = isoDate(meta.released)
  const trailer =
    records(meta.trailers)
      .filter((t) => !t.type || t.type === 'Trailer')
      .map((t) => youtubeId(t.source))
      .find(Boolean) ??
    records(meta.trailerStreams)
      .map((t) => youtubeId(t.ytId))
      .find(Boolean)
  record.trailer = trailer ? ({ type: 'youtube', id: trailer } satisfies Trailer) : null
  if (kind === 'series') {
    const regular = records(meta.videos).filter((video) => (int(video.season) ?? 0) > 0)
    if (regular.length) {
      record.seasons = new Set(regular.map((video) => int(video.season))).size
      record.episodes = regular.length
    }
  }
  return record
}

export function normalizeCinemetaCatalog(
  payload: unknown,
  kind: ScreenKind,
): { items: TitleRecord[]; hasMore: boolean } {
  const data = asRecord(payload)
  const metas = records(data.metas)
  const items = metas
    .map((meta) => normalizeCinemetaMeta(meta, kind))
    .filter((item): item is TitleRecord => item !== null)
  return {
    items,
    hasMore:
      typeof data.hasMore === 'boolean' ? data.hasMore : metas.length >= CINEMETA_PAGE_SIZE - 5,
  }
}

/** Episodes from a series meta's `videos` (season 0 holds specials). */
export function cinemetaEpisodes(payload: unknown): EpisodeList | null {
  const meta = asRecord(asRecord(payload).meta)
  const videos = records(meta.videos)
  if (!str(meta.name)) return null
  const runtime = parseMinutes(meta.runtime)
  const seasons = new Map<number, Episode[]>()
  for (const video of videos) {
    const season = int(video.season)
    const number = int(video.episode) ?? int(video.number)
    if (season === undefined || season < 0 || number === undefined || number < 0) continue
    const list = seasons.get(season) ?? []
    if (list.some((episode) => episode.number === number)) continue
    list.push({
      season,
      number,
      name: cleanName(video.name) ?? cleanName(video.title) ?? null,
      airdate: isoDate(video.released) ?? isoDate(video.firstAired),
      runtime,
    })
    seasons.set(season, list)
  }
  const status = airing(meta.status)
  return {
    source: 'cinemeta',
    seasons: [...seasons.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, episodes]) => ({
        number,
        episodes: episodes.sort((a, b) => a.number - b.number),
      })),
    ended: status ? status === 'ended' : null,
  }
}

export async function fetchCinemetaCatalog(
  http: HttpClient,
  kind: ScreenKind,
  list: Exclude<ChartList, 'top'>,
  skip: number,
  year: number,
) {
  return normalizeCinemetaCatalog(
    await http.json(cinemetaCatalogUrl(kind, list, skip, year), { ttlMs: 30 * MINUTE }),
    kind,
  )
}

/** Raw `/meta` payload; `{}` or a meta without a name means Cinemeta does not know the title. */
export async function fetchCinemetaMeta(
  http: HttpClient,
  kind: ScreenKind,
  imdb: string,
): Promise<unknown> {
  return http.json(cinemetaMetaUrl(kind, imdb), { ttlMs: 6 * HOUR })
}
