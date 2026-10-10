// Types shared by the server and the browser. Keep this file free of runtime dependencies.

export const KINDS = ['game', 'movie', 'series', 'anime'] as const
export type Kind = (typeof KINDS)[number]

export const STATUSES = ['planned', 'in_progress', 'paused', 'completed', 'dropped'] as const
export type Status = (typeof STATUSES)[number]

export const LOCALES = ['ru', 'en', 'uk', 'de', 'es', 'fr', 'ro'] as const
export type Locale = (typeof LOCALES)[number]

export const THEMES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEMES)[number]

export const CHART_LISTS = ['trending', 'top', 'new'] as const
export type ChartList = (typeof CHART_LISTS)[number]

export const STORES = ['steam', 'gog', 'epic', 'xbox', 'playstation', 'nintendo'] as const
export type StoreId = (typeof STORES)[number]

export const PLATFORMS = [
  'pc',
  'playstation5',
  'playstation4',
  'xbox-series',
  'xbox-one',
  'switch',
  'switch2',
  'steam-deck',
  'mac',
  'mobile',
] as const
export type PlatformId = (typeof PLATFORMS)[number]

/** External data sources. `shikimori` ids are MyAnimeList ids. */
export type SourceId =
  | 'steam'
  | 'gog'
  | 'imdb'
  | 'cinemeta'
  | 'tvmaze'
  | 'shikimori'
  | 'anilist'
  | 'wikidata'
  | 'wikipedia'

export interface TitleNames {
  /** Name in the original language/romanisation as supplied by the source. */
  original: string
  en?: string
  ru?: string
}

export interface ExternalRating {
  source: 'imdb' | 'steam' | 'shikimori' | 'metacritic' | 'tvmaze' | 'anilist'
  /** Raw value on the source scale (IMDb 0–10, Steam % positive 0–100, Metacritic 0–100). */
  value: number
  max: 10 | 100
  votes?: number
}

export type Trailer =
  { type: 'youtube'; id: string } | { type: 'video'; url: string; poster?: string }

export interface SourceLink {
  source: SourceId
  url: string
}

export interface ExternalIds {
  steam?: string
  gog?: string
  imdb?: string
  tvmaze?: string
  /** MyAnimeList id, identical to the Shikimori id. */
  mal?: string
  anilist?: string
  wikidata?: string
}

/**
 * Language-neutral description of a title. Summary fields are always present; detail
 * fields are filled by the details endpoint. Genres are canonical English names
 * (see shared/genres.ts); the client localises them.
 */
export interface TitleRecord {
  id: string
  kind: Kind
  names: TitleNames
  year: number | null
  endYear?: number | null
  poster: string | null
  backdrop: string | null
  genres: string[]
  /** Primary rating first. */
  ratings: ExternalRating[]
  /** Minutes: movie length or typical episode length. */
  runtime?: number | null
  seasons?: number | null
  /** Total known episodes (series/anime). */
  episodes?: number | null
  airing?: 'upcoming' | 'airing' | 'ended' | null
  releaseDate?: string | null
  descriptions?: Partial<Record<Locale, string>>
  /** Directors, creators, developers or studios. */
  creators?: string[]
  cast?: string[]
  /** Publishers, networks. */
  companies?: string[]
  country?: string | null
  platforms?: PlatformId[]
  screenshots?: string[]
  trailer?: Trailer | null
  links?: SourceLink[]
  externalIds: ExternalIds
  /** Set by the details endpoint. */
  detailed?: boolean
}

export interface StoreOffer {
  store: StoreId
  url: string
  region: string
  currency?: string
  /** Minor units (cents). */
  price?: number
  originalPrice?: number
  discountPercent?: number
  isFree?: boolean
}

export interface Episode {
  season: number
  number: number
  name: string | null
  /** YYYY-MM-DD */
  airdate: string | null
  runtime: number | null
}

export interface EpisodeSeason {
  /** 0 holds specials. */
  number: number
  episodes: Episode[]
}

export interface EpisodeList {
  source: 'tvmaze' | 'cinemeta' | 'shikimori' | 'jikan'
  seasons: EpisodeSeason[]
  ended: boolean | null
}

export interface ChartPage {
  items: TitleRecord[]
  hasMore: boolean
}

export interface SearchResult {
  items: TitleRecord[]
  /** Sources that failed; the UI mentions partial results. */
  failed: SourceId[]
}

// ---------------------------------------------------------------------------
// Accounts

export interface UserPreferences {
  locale: Locale
  theme: ThemePreference
  region: string
  platforms: PlatformId[]
  stores: StoreId[]
  /** OpenMoji avatar id; unset = derived from the user id. */
  avatar?: string
  /** Avatar outline colour id; unset = theme foreground. */
  avatarColor?: string
  /** Linked SteamID64; set only by the server after Steam OpenID login. */
  steamId?: string
  /** Profile banner preset or 'favorite' for the first favourite title's backdrop. */
  banner?: BannerId
}

export const AVATAR_COLORS = [
  'auto',
  'blue',
  'violet',
  'pink',
  'orange',
  'red',
  'sky',
  'yellow',
  'green',
] as const
export type AvatarColor = (typeof AVATAR_COLORS)[number]

/** Preset profile banners: colour gradients or the favourite title's backdrop. */
export const BANNERS = [
  'none',
  'favorite',
  'sunset',
  'ocean',
  'forest',
  'lavender',
  'candy',
  'steel',
  'sunrise',
  'midnight',
] as const
export type BannerId = (typeof BANNERS)[number]

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  preferences: UserPreferences
}

/** Public-facing account info shown on a profile page; no email or private fields. */
export interface PublicUser {
  id: string
  name: string
  createdAt: string
  avatar?: string
  avatarColor?: string
  banner: BannerId
  /** A Steam account is linked; the SteamID itself stays private. */
  steamLinked: boolean
}

/**
 * The part of a library entry that other signed-in users see on a profile. Notes,
 * playthroughs (with their notes), dates, platform and store stay private.
 */
export type PublicEntry = Pick<
  LibraryEntry,
  | 'titleId'
  | 'kind'
  | 'status'
  | 'rating'
  | 'favorite'
  | 'progress'
  | 'hours'
  | 'watchedEpisodes'
  | 'totalEpisodes'
  | 'title'
>

export interface UserProfile {
  user: PublicUser
  stats: LibraryStats
  activity: ActivityItem[]
  favorites: PublicEntry[]
  completed: PublicEntry[]
  /** In progress right now, most recently touched first. */
  inProgress: PublicEntry[]
  /** Up to 6 posters for the header collage: favourites, then completed, then in progress. */
  heroPosters: string[]
  /** Backdrop of the first favourite title, for the 'favorite' banner. */
  bannerImage: string | null
}

export interface SessionInfo {
  id: string
  current: boolean
  userAgent: string | null
  createdAt: string
  lastSeenAt: string
}

// ---------------------------------------------------------------------------
// Library

export interface Playthrough {
  id: string
  label: string
  platform: PlatformId | null
  store: StoreId | null
  status: Status
  progress: number
  hours: number | null
  startedAt: string | null
  finishedAt: string | null
  note: string
  updatedAt: string
}

export interface NextEpisode {
  season: number
  number: number
  name: string | null
  airdate: string | null
}

export interface LibraryEntry {
  titleId: string
  kind: Kind
  status: Status
  /** 1–10 */
  rating: number | null
  favorite: boolean
  notes: string
  /** 0–100 */
  progress: number
  /** Main playthrough (games). */
  platform: PlatformId | null
  store: StoreId | null
  hours: number | null
  watchedEpisodes: number
  totalEpisodes: number | null
  nextEpisode: NextEpisode | null
  addedAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
  position: number
  /** Additional runs (games). */
  playthroughs: Playthrough[]
  title: TitleRecord
}

export interface EpisodeMark {
  season: number
  number: number
  watchedAt: string | null
  rating: number | null
  note: string
}

export type ActivityType =
  'added' | 'status' | 'rated' | 'favorite' | 'episodes' | 'playthrough' | 'removed'

export interface ActivityItem {
  id: number
  titleId: string
  kind: Kind
  type: ActivityType
  data: {
    status?: Status
    from?: Status | null
    rating?: number | null
    favorite?: boolean
    count?: number
    season?: number
    number?: number
    label?: string
  }
  createdAt: string
  title: Pick<TitleRecord, 'id' | 'kind' | 'names' | 'poster' | 'year'> | null
}

export interface LibraryStats {
  total: number
  byKind: Record<Kind, number>
  byStatus: Record<Status, number>
  favorites: number
  rated: number
  averageRating: number | null
  ratingDistribution: number[]
  completedByMonth: { month: string; count: number; byKind: Record<Kind, number> }[]
  topGenres: { genre: string; count: number }[]
  minutes: { movies: number; episodes: number; games: number }
  episodesWatched: number
  completedThisYear: number
  addedThisYear: number
  longestStreakDays: number
}

// ---------------------------------------------------------------------------
// API errors

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'REGISTRATION_CLOSED',
  'CODE_WRONG',
  'CODE_EXPIRED',
  'NO_PENDING',
  'RESEND_TOO_SOON',
  'TOO_MANY_ATTEMPTS',
  'STEAM_NOT_LINKED',
  'STEAM_NOT_CONFIGURED',
  'PROFILE_PRIVATE',
  'WRONG_PASSWORD',
  'STATUS_NOT_ALLOWED',
  'TITLE_NOT_FOUND',
  'CATALOG_UNAVAILABLE',
  'LIMIT_REACHED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, string> }
}
