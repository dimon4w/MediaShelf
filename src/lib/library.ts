import { z } from 'zod'
import { catalog } from './catalog.ts'
import { entryStatuses } from './platforms.ts'
import type {
  EntryPatch,
  LibraryData,
  LibraryEntry,
  LibraryStatus,
  MediaFilter,
  MediaItem,
} from './types.ts'

export const MAX_BACKUP_BYTES = 16 * 1024 * 1024

const statusSchema = z.enum(['planned', 'active', 'completed'])
const storeSchema = z.enum(['steam', 'gog', 'epic', 'xbox', 'playstation', 'nintendo'])
const statusesSchema = z
  .array(statusSchema)
  .max(3)
  .refine((v) => new Set(v).size === v.length)
export const preferencesSchema = z.strictObject({
  onboarded: z.boolean(),
  platforms: z.array(z.string().max(50)).max(10),
  stores: z.array(storeSchema).max(6),
  country: z.enum(['US', 'MD', 'DE', 'PL', 'UA', 'KZ', 'RU', 'GB']),
})
const playthroughSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,100}$/),
  platform: z.string().max(50),
  store: z.union([storeSchema, z.literal('')]),
  progress: z.number().int().min(0).max(100),
  statuses: statusesSchema,
})

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/)
const imageSchema = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!value) return true
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }, 'Укажите ссылку на изображение, начинающуюся с https://')

export const mediaItemSchema = z
  .strictObject({
    id: idSchema,
    type: z.enum(['game', 'movie', 'series', 'anime']),
    title: z.string().trim().min(1, 'Введите название').max(160),
    originalTitle: z.string().trim().max(160),
    year: z.number().int().min(1900).max(2100).nullable(),
    genres: z.array(z.string().trim().min(1).max(50)).min(1).max(5),
    description: z.string().max(4000),
    poster: imageSchema,
    backdrop: imageSchema.optional(),
    accent: z.string().regex(/^#[\da-f]{6}$/i),
    duration: z.number().int().min(1).max(2000).optional(),
    episodes: z.number().int().min(1).max(50000).optional(),
    seasons: z.number().int().min(1).max(200).optional(),
    platforms: z.array(z.string().max(50)).max(10).optional(),
    source: z.enum(['steam', 'gog', 'epic', 'imdb', 'tvmaze', 'shikimori', 'cinemeta']).optional(),
    sourceUrl: imageSchema.optional(),
    externalIds: z
      .strictObject({
        steam: z.string().regex(/^\d+$/).optional(),
        gog: z.string().regex(/^\d+$/).optional(),
        imdb: z
          .string()
          .regex(/^tt\d+$/)
          .optional(),
        tvmaze: z.string().regex(/^\d+$/).optional(),
        shikimori: z.string().regex(/^\d+$/).optional(),
      })
      .optional(),
    offers: z
      .array(
        z.strictObject({
          store: storeSchema,
          url: imageSchema,
          edition: z.string().max(160).optional(),
          price: z.number().int().min(0).optional(),
          originalPrice: z.number().int().min(0).optional(),
          currency: z
            .string()
            .regex(/^[A-Z]{3}$/)
            .optional(),
          country: z
            .string()
            .regex(/^[A-Z]{2}$/)
            .optional(),
          checkedAt: z.iso.datetime().optional(),
        }),
      )
      .max(20)
      .optional(),
    ratings: z
      .array(
        z.strictObject({
          source: z.enum(['imdb', 'steam']),
          value: z.number().min(0).max(100),
          votes: z.number().int().min(0),
          checkedAt: z.iso.datetime(),
        }),
      )
      .max(2)
      .optional(),
    languages: z.array(z.string().max(60)).max(80).optional(),
    popularity: z.number().min(0).optional(),
    franchise: z.string().max(160).optional(),
    artworkQuality: z.enum(['good', 'unknown', 'missing']).optional(),
    screenshots: z.array(imageSchema).max(12).optional(),
    previewVideo: imageSchema.optional(),
  })
  .refine((item) => !['series', 'anime'].includes(item.type) || !!item.episodes || !!item.source, {
    message: 'Для сериала или аниме укажите количество эпизодов',
    path: ['episodes'],
  })

export const episodeCatalogSchema = z.strictObject({
  episodes: z
    .array(
      z.strictObject({
        key: z.string().regex(/^\d{1,3}:\d{1,5}$/),
        season: z.number().int().min(0).max(200),
        number: z.number().int().min(1).max(50000),
        title: z.string().max(300),
        airdate: z.string().max(20).optional(),
        manual: z.boolean().optional(),
      }),
    )
    .max(5000)
    .refine(
      (items) =>
        new Set(items.map((e) => e.key)).size === items.length &&
        items.every((e) => e.key === `${e.season}:${e.number}`),
    ),
  source: z.enum(['tvmaze', 'cinemeta', 'manual']),
  complete: z.boolean(),
  ended: z.boolean().optional(),
})
export const episodeStatesSchema = z
  .record(
    z.string().regex(/^\d{1,3}:\d{1,5}$/),
    z.strictObject({
      watched: z.boolean(),
      review: z.string().max(2000),
      updatedAt: z.iso.datetime(),
    }),
  )
  .refine((v) => Object.keys(v).length <= 5000)
const entrySchema = z.strictObject({
  itemId: idSchema,
  status: z.enum(['planned', 'active', 'completed']),
  rating: z.number().int().min(1).max(10).nullable(),
  progress: z.number().int().min(0).max(100000),
  favorite: z.boolean(),
  notes: z.string().max(4000),
  addedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  order: z.number().int().min(0).max(1000000),
  statuses: statusesSchema.optional(),
  episodeStates: episodeStatesSchema.optional(),
  episodeCatalog: episodeCatalogSchema.optional(),
  legacyEpisodeProgress: z.number().int().min(0).max(100000).optional(),
  playthroughs: z
    .array(playthroughSchema)
    .max(10)
    .refine((p) => new Set(p.map((v) => v.id)).size === p.length)
    .optional(),
})

const backupSchema = z.strictObject({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  entries: z.record(idSchema, entrySchema),
  customItems: z.array(mediaItemSchema).max(500),
  preferences: preferencesSchema.optional(),
})

export function getProgressMax(item: MediaItem): number | null {
  if (item.type === 'game') return 100
  if (item.type === 'movie') return 1
  return item.episodes ?? null
}

export function createEntry(
  item: MediaItem,
  order: number,
  status: LibraryStatus = 'planned',
): LibraryEntry {
  if (item.type === 'movie' && status === 'active') status = 'planned'
  const now = new Date().toISOString()
  return {
    itemId: item.id,
    status,
    rating: null,
    progress: item.type !== 'game' && status === 'completed' ? (getProgressMax(item) ?? 0) : 0,
    ...(item.type === 'game'
      ? {
          statuses: [status],
          playthroughs: [
            { id: 'primary', platform: '', store: '' as const, progress: 0, statuses: [status] },
          ],
        }
      : {}),
    favorite: false,
    notes: '',
    addedAt: now,
    updatedAt: now,
    order,
  }
}

export function updateLibraryEntry(
  item: MediaItem,
  entry: LibraryEntry,
  patch: EntryPatch,
): LibraryEntry {
  const max = getProgressMax(item)
  const next = { ...entry, ...patch, updatedAt: new Date().toISOString() }
  if (item.type === 'game') {
    const previous = entry.playthroughs ?? [
      {
        id: 'primary',
        platform: '',
        store: '' as const,
        progress: entry.progress,
        statuses: entry.statuses ?? [entry.status],
      },
    ]
    const playthroughs =
      patch.playthroughs ??
      previous.map((p, index) =>
        index
          ? p
          : {
              ...p,
              ...(patch.progress !== undefined
                ? {
                    progress: Number.isFinite(patch.progress)
                      ? Math.max(0, Math.min(100, Math.round(patch.progress)))
                      : p.progress,
                  }
                : {}),
              ...(patch.statuses
                ? { statuses: patch.statuses }
                : patch.status
                  ? { statuses: [patch.status] }
                  : {}),
            },
      )
    next.playthroughs = z.array(playthroughSchema).max(10).parse(playthroughs)
    if (new Set(playthroughs.map((p) => p.id)).size !== playthroughs.length)
      throw new Error('Повторяется прохождение.')
    next.statuses = [...new Set(playthroughs.flatMap((p) => p.statuses))]
    next.status = next.statuses.includes('active')
      ? 'active'
      : next.statuses.includes('completed')
        ? 'completed'
        : 'planned'
    next.progress = playthroughs[0]?.progress ?? 0
    next.rating =
      patch.rating === undefined
        ? entry.rating
        : patch.rating === null
          ? null
          : Number.isFinite(patch.rating)
            ? Math.max(1, Math.min(10, Math.round(patch.rating)))
            : null
    next.notes = next.notes.slice(0, 4000)
    return next
  }
  if ((item.type === 'series' || item.type === 'anime') && entry.episodeStates) {
    // Per-episode records are authoritative. A whole-work status never erases them.
    if (patch.episodeStates) next.episodeStates = episodeStatesSchema.parse(patch.episodeStates)
    if (patch.episodeCatalog) next.episodeCatalog = episodeCatalogSchema.parse(patch.episodeCatalog)
    next.progress =
      Object.values(next.episodeStates ?? {}).filter((e) => e.watched).length +
      (next.legacyEpisodeProgress ?? 0)
    if (next.rating !== null)
      next.rating = Number.isFinite(next.rating)
        ? Math.max(1, Math.min(10, Math.round(next.rating)))
        : null
    next.notes = next.notes.slice(0, 4000)
    return next
  }
  if (patch.status === 'completed' && max !== null) next.progress = max
  if (patch.status === 'planned') next.progress = 0
  if (patch.status === 'active' && max !== null && next.progress >= max)
    next.progress = Math.max(0, max - 1)
  if (patch.progress !== undefined) {
    next.progress = Number.isFinite(patch.progress)
      ? Math.max(0, Math.min(max ?? 100000, Math.round(patch.progress)))
      : entry.progress
    next.status =
      max !== null && next.progress === max
        ? 'completed'
        : next.progress > 0 || entry.status !== 'planned'
          ? 'active'
          : 'planned'
  }
  if (item.type === 'movie' && next.status === 'active') {
    next.status = 'planned'
    next.progress = 0
  }
  if (next.rating !== null)
    next.rating = Number.isFinite(next.rating)
      ? Math.max(1, Math.min(10, Math.round(next.rating)))
      : null
  next.notes = next.notes.slice(0, 4000)
  return next
}

export function parseBackup(json: string): LibraryData {
  if (
    json.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES
  )
    throw new Error('Файл слишком большой. Максимальный размер: 16 МБ.')
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Не удалось прочитать JSON. Выберите резервную копию MediaShelf.')
  }
  const result = backupSchema.safeParse(raw)
  if (!result.success) throw new Error('Файл не соответствует формату резервной копии MediaShelf.')
  const { entries, customItems, preferences } = result.data
  const known = new Map(catalog.map((item) => [item.id, item]))
  for (const item of customItems) {
    if (known.has(item.id)) throw new Error('В файле повторяются идентификаторы произведений.')
    known.set(item.id, item)
  }
  for (const [id, entry] of Object.entries(entries)) {
    const item = known.get(id)
    if (!item || id !== entry.itemId)
      throw new Error('В коллекции есть ссылка на неизвестное произведение.')
    const max = getProgressMax(item)
    if (
      entry.episodeStates &&
      (!['series', 'anime'].includes(item.type) ||
        entry.progress !==
          Object.values(entry.episodeStates).filter((e) => e.watched).length +
            (entry.legacyEpisodeProgress ?? 0))
    )
      throw new Error('В файле расходятся отметки эпизодов и сохранённый прогресс.')
    if (
      (!entry.episodeStates && max !== null && entry.progress > max) ||
      (!entry.episodeStates &&
        item.type !== 'game' &&
        ((entry.status === 'planned' && entry.progress !== 0) ||
          (max !== null && entry.status === 'completed' && entry.progress !== max) ||
          (max !== null && entry.status === 'active' && entry.progress >= max)))
    ) {
      throw new Error('В файле указан некорректный прогресс произведения.')
    }
    if (item.type === 'game') {
      const migrated = updateLibraryEntry(item, entry, {})
      entries[id] = { ...migrated, updatedAt: entry.updatedAt }
    }
    if (item.type === 'movie' && entry.status === 'active')
      entries[id] = { ...entry, status: 'planned', progress: 0 }
  }
  return { entries, customItems, ...(preferences ? { preferences } : {}) }
}

export function serializeBackup(data: LibraryData): string {
  return JSON.stringify(
    {
      version: 3,
      entries: data.entries,
      customItems: data.customItems,
      preferences: data.preferences,
    },
    null,
    2,
  )
}

export interface CatalogFilters {
  query: string
  type: MediaFilter
  genre: string
  year: number | null
  status: 'all' | LibraryStatus
  favoritesOnly: boolean
  libraryOnly: boolean
  sort: 'curated' | 'title' | 'year' | 'rating'
}

export function filterMedia(
  items: MediaItem[],
  entries: Record<string, LibraryEntry>,
  filters: CatalogFilters,
): MediaItem[] {
  const normalize = (value: string) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const words = normalize(filters.query.trim()).split(/\s+/).filter(Boolean)
  const result = items.filter((item) => {
    const entry = entries[item.id]
    return (
      (!filters.libraryOnly || !!entry) &&
      (filters.type === 'all' || item.type === filters.type) &&
      (!filters.genre || item.genres.includes(filters.genre)) &&
      (filters.year === null || item.year === filters.year) &&
      (filters.status === 'all' || entryStatuses(entry).includes(filters.status)) &&
      (!filters.favoritesOnly || !!entry?.favorite) &&
      words.every((word) =>
        normalize(`${item.title} ${item.originalTitle} ${item.genres.join(' ')}`).includes(word),
      )
    )
  })
  if (filters.sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  if (filters.sort === 'year') result.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  if (filters.sort === 'rating')
    result.sort((a, b) => (entries[b.id]?.rating ?? 0) - (entries[a.id]?.rating ?? 0))
  return result
}
