import { genreLabel } from '@shared/genres.ts'
import type {
  ExternalRating,
  Kind,
  LibraryEntry,
  Locale,
  Status,
  TitleNames,
  TitleRecord,
} from '@shared/types.ts'
import type { Formatters, MessageKey } from '@/i18n'

export function titleName(names: TitleNames, locale: Locale) {
  return (locale === 'ru' ? names.ru || names.en : names.en) || names.original
}

/** Secondary name shown under the main one when it adds information. */
export function secondaryName(names: TitleNames, locale: Locale) {
  const main = titleName(names, locale)
  const candidates = locale === 'ru' ? [names.original, names.en] : [names.original]
  const other = candidates.find((name) => name && name.toLowerCase() !== main.toLowerCase())
  return other ?? null
}

export function yearRange(title: Pick<TitleRecord, 'year' | 'endYear' | 'kind' | 'airing'>) {
  if (!title.year) return null
  if (title.kind !== 'series' && title.kind !== 'anime') return String(title.year)
  if (title.endYear && title.endYear !== title.year) return `${title.year}–${title.endYear}`
  if (title.airing === 'airing') return `${title.year}–`
  return String(title.year)
}

export function ratingSourceLabel(source: ExternalRating['source']) {
  return {
    imdb: 'IMDb',
    steam: 'Steam',
    shikimori: 'Shikimori',
    metacritic: 'Metacritic',
    tvmaze: 'TVmaze',
    anilist: 'AniList',
  }[source]
}

export function formatRating(rating: ExternalRating, fmt: Formatters) {
  return fmt.rating(rating.value, rating.max)
}

export function genreList(genres: string[], locale: Locale, limit = 3) {
  return genres.slice(0, limit).map((genre) => genreLabel(genre, locale))
}

export function statusLabelKey(kind: Kind, status: Status): MessageKey {
  return `statusByKind.${kind}.${status}` as MessageKey
}

export function episodeCode(season: number, number: number) {
  return { season: String(season), number: String(number) }
}

/** Short progress description for cards: "S2 · E5", "45 %", or nothing. */
export function entryProgressText(
  entry: LibraryEntry,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) {
  if (entry.kind === 'series' || entry.kind === 'anime') {
    if (entry.nextEpisode && entry.status === 'in_progress')
      return t('episodes.code', episodeCode(entry.nextEpisode.season, entry.nextEpisode.number))
    if (!entry.watchedEpisodes && entry.status === 'planned') return null
    if (entry.totalEpisodes) return `${entry.watchedEpisodes}/${entry.totalEpisodes}`
    return entry.watchedEpisodes ? String(entry.watchedEpisodes) : null
  }
  if (entry.kind === 'game' && entry.progress > 0)
    return t('home.percent', { value: entry.progress })
  return null
}

/** Sort helper that respects the reader's language. */
export function compareNames(a: TitleRecord, b: TitleRecord, locale: Locale) {
  return titleName(a.names, locale).localeCompare(titleName(b.names, locale), locale)
}

export const titleHref = (id: string) => `/title/${id}`

/** Today's date in the reader's time zone (YYYY-MM-DD), for comparing air dates. */
export function localToday() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
