export type MediaType = 'game' | 'movie' | 'series' | 'anime'
export type MediaFilter = 'all' | MediaType
export type LibraryStatus = 'planned' | 'active' | 'completed'
export type CatalogSource = 'steam' | 'gog' | 'epic' | 'imdb' | 'tvmaze' | 'shikimori' | 'cinemeta'
export type StoreId = 'steam' | 'gog' | 'epic' | 'xbox' | 'playstation' | 'nintendo'
export type DiscoveryOrder = 'popular' | 'classics'

export interface StoreOffer {
  store: StoreId
  url: string
  edition?: string
  price?: number
  originalPrice?: number
  currency?: string
  country?: string
  checkedAt?: string
}

export interface PublicRating {
  source: 'imdb' | 'steam'
  value: number
  votes: number
  checkedAt: string
}

export interface Playthrough {
  id: string
  platform: string
  store: StoreId | ''
  progress: number
  statuses: LibraryStatus[]
}

export interface UserPreferences {
  onboarded: boolean
  platforms: string[]
  stores: StoreId[]
  country: string
}

export interface MediaItem {
  id: string
  type: MediaType
  title: string
  originalTitle: string
  year: number | null
  genres: string[]
  description: string
  poster: string
  backdrop?: string
  accent: string
  duration?: number
  episodes?: number
  seasons?: number
  platforms?: string[]
  source?: CatalogSource
  sourceUrl?: string
  externalIds?: { steam?: string; gog?: string; imdb?: string; tvmaze?: string; shikimori?: string }
  offers?: StoreOffer[]
  ratings?: PublicRating[]
  languages?: string[]
  popularity?: number
  franchise?: string
  artworkQuality?: 'good' | 'unknown' | 'missing'
  screenshots?: string[]
  previewVideo?: string
}

export interface Episode {
  key: string
  season: number
  number: number
  title: string
  airdate?: string
  manual?: boolean
}

export interface EpisodeCatalog {
  episodes: Episode[]
  source: 'tvmaze' | 'cinemeta' | 'manual'
  complete: boolean
  ended?: boolean
}

export interface EpisodeRecord {
  watched: boolean
  review: string
  updatedAt: string
}

export interface CatalogSourceState {
  id: CatalogSource
  label: string
  status: 'available' | 'unavailable'
  count: number
}

export interface OnlineCatalogResponse {
  items: MediaItem[]
  sources: CatalogSourceState[]
  page: number
  hasMore: boolean
}

export interface LibraryEntry {
  itemId: string
  status: LibraryStatus
  rating: number | null
  progress: number
  favorite: boolean
  notes: string
  addedAt: string
  updatedAt: string
  order: number
  statuses?: LibraryStatus[]
  playthroughs?: Playthrough[]
  episodeStates?: Record<string, EpisodeRecord>
  episodeCatalog?: EpisodeCatalog
  legacyEpisodeProgress?: number
}

export type EntryPatch = Partial<
  Pick<
    LibraryEntry,
    | 'status'
    | 'statuses'
    | 'playthroughs'
    | 'rating'
    | 'progress'
    | 'favorite'
    | 'notes'
    | 'episodeStates'
    | 'episodeCatalog'
    | 'legacyEpisodeProgress'
  >
>

export interface LibraryData {
  entries: Record<string, LibraryEntry>
  customItems: MediaItem[]
  preferences?: UserPreferences
}
