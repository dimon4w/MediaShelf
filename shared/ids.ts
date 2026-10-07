import type { Kind } from './types.ts'

/**
 * Canonical title ids:
 *   steam-<appid>   game from Steam
 *   gog-<id>        game only available on GOG
 *   movie-<tt…>     movie (IMDb id)
 *   series-<tt…>    series (IMDb id)
 *   tvmaze-<id>     series without an IMDb id
 *   anime-<malId>   anime (MyAnimeList / Shikimori id)
 */
export const TITLE_ID_PATTERN =
  /^(?:(?:steam|gog|tvmaze|anime)-\d{1,12}|(?:movie|series)-tt\d{5,12})$/

export type TitlePrefix = 'steam' | 'gog' | 'movie' | 'series' | 'tvmaze' | 'anime'

export interface ParsedTitleId {
  prefix: TitlePrefix
  /** Numeric id, or `tt…` for IMDb. */
  value: string
  kind: Kind
}

const KIND_BY_PREFIX: Record<TitlePrefix, Kind> = {
  steam: 'game',
  gog: 'game',
  movie: 'movie',
  series: 'series',
  tvmaze: 'series',
  anime: 'anime',
}

export function isTitleId(value: unknown): value is string {
  return typeof value === 'string' && TITLE_ID_PATTERN.test(value)
}

export function parseTitleId(id: string): ParsedTitleId | null {
  if (!isTitleId(id)) return null
  const dash = id.indexOf('-')
  const prefix = id.slice(0, dash) as TitlePrefix
  return { prefix, value: id.slice(dash + 1), kind: KIND_BY_PREFIX[prefix] }
}

export function kindOfTitleId(id: string): Kind | null {
  return parseTitleId(id)?.kind ?? null
}

export const titleId = {
  steam: (appid: string | number) => `steam-${appid}`,
  gog: (id: string | number) => `gog-${id}`,
  movie: (imdb: string) => `movie-${imdb}`,
  series: (imdb: string) => `series-${imdb}`,
  tvmaze: (id: string | number) => `tvmaze-${id}`,
  anime: (mal: string | number) => `anime-${mal}`,
}
