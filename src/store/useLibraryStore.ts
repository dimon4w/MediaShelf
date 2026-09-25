import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { catalog } from '../lib/catalog'
import {
  createEntry,
  mediaItemSchema,
  parseBackup,
  serializeBackup,
  updateLibraryEntry,
  preferencesSchema,
} from '../lib/library'
import type {
  EntryPatch,
  LibraryData,
  LibraryStatus,
  MediaItem,
  UserPreferences,
  EpisodeCatalog,
  EpisodeRecord,
} from '../lib/types'
import { defaultPreferences, entryStatuses } from '../lib/platforms'
import { attachEpisodeCatalog, assignLegacyEpisodes, changeEpisode } from '../lib/episodes'

interface LibraryStore extends LibraryData {
  storageError: string | null
  recoveryRequired: boolean
  addItem: (item: MediaItem, status?: LibraryStatus) => void
  updateEntry: (itemId: string, patch: EntryPatch) => void
  removeItem: (itemId: string) => void
  toggleFavorite: (item: MediaItem) => void
  addCustomItem: (item: MediaItem) => void
  moveItem: (
    itemId: string,
    status: LibraryStatus,
    index?: number,
    fromStatus?: LibraryStatus,
  ) => void
  importCollection: (json: string) => void
  exportCollection: () => string
  clearStorageError: () => void
  setPreferences: (preferences: UserPreferences) => void
  setEpisodeCatalog: (id: string, catalog: EpisodeCatalog) => void
  updateEpisode: (
    id: string,
    key: string,
    patch: Partial<Pick<EpisodeRecord, 'watched' | 'review'>>,
  ) => void
  assignLegacyEpisodes: (id: string) => void
}

let preserveStoredCollection = false

function reportStorageError(message: string, recoveryRequired = false) {
  // Defer until the store exists; the equality check prevents a persistence error loop.
  queueMicrotask(() => {
    if (useLibraryStore.getState().storageError !== message)
      useLibraryStore.setState({ storageError: message, recoveryRequired })
  })
}

const storage = createJSONStorage<LibraryData>(() => ({
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(name)
    } catch {
      reportStorageError(
        'Браузер заблокировал хранилище. Коллекция доступна до закрытия страницы. Сохраните резервную копию.',
      )
      return null
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined' || preserveStoredCollection) return
    try {
      window.localStorage.setItem(name, value)
    } catch {
      reportStorageError(
        'Не удалось сохранить коллекцию в браузере. Не закрывайте страницу и скачайте резервную копию.',
      )
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(name)
    } catch {
      reportStorageError('Браузер не разрешил изменить сохранённые данные.')
    }
  },
}))

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => {
      const find = (id: string) =>
        catalog.find((item) => item.id === id) ?? get().customItems.find((item) => item.id === id)
      const nextOrder = () =>
        Math.max(-1, ...Object.values(get().entries).map((entry) => entry.order)) + 1
      return {
        entries: {},
        customItems: [],
        preferences: defaultPreferences,
        setPreferences: (preferences) => set({ preferences: preferencesSchema.parse(preferences) }),
        storageError: null,
        recoveryRequired: false,
        setEpisodeCatalog: (id, catalog) => {
          const entry = get().entries[id]
          if (!entry || !['series', 'anime'].includes(find(id)?.type ?? '')) return
          if (
            JSON.stringify(entry.episodeCatalog) === JSON.stringify(catalog) &&
            entry.episodeStates
          )
            return
          set((state) => ({
            entries: { ...state.entries, [id]: attachEpisodeCatalog(entry, catalog) },
          }))
        },
        updateEpisode: (id, key, patch) => {
          const entry = get().entries[id]
          if (entry)
            set((state) => ({
              entries: { ...state.entries, [id]: changeEpisode(entry, key, patch) },
            }))
        },
        assignLegacyEpisodes: (id) => {
          const entry = get().entries[id]
          if (entry)
            set((state) => ({ entries: { ...state.entries, [id]: assignLegacyEpisodes(entry) } }))
        },
        addItem: (item, status = 'planned') => {
          if (get().entries[item.id]) return
          if (!find(item.id)) {
            if (!item.source) return
            const parsed = mediaItemSchema.safeParse(item)
            if (!parsed.success) throw new Error('Источник вернул неполные данные произведения.')
            if (get().customItems.length >= 500)
              throw new Error(
                'На полке уже 500 добавленных произведений. Сохраните резервную копию.',
              )
            set((state) => ({
              customItems: [...state.customItems, parsed.data],
              entries: {
                ...state.entries,
                [item.id]: createEntry(parsed.data, nextOrder(), status),
              },
            }))
            return
          }
          set((state) => ({
            entries: { ...state.entries, [item.id]: createEntry(item, nextOrder(), status) },
          }))
        },
        updateEntry: (id, patch) => {
          const item = find(id)
          const entry = get().entries[id]
          if (!item || !entry) return
          set((state) => ({
            entries: { ...state.entries, [id]: updateLibraryEntry(item, entry, patch) },
          }))
        },
        removeItem: (id) =>
          set((state) => ({
            entries: Object.fromEntries(
              Object.entries(state.entries).filter(([key]) => key !== id),
            ),
          })),
        toggleFavorite: (item) => {
          get().addItem(item)
          const entry = get().entries[item.id]
          if (entry) get().updateEntry(item.id, { favorite: !entry.favorite })
        },
        addCustomItem: (item) => {
          const parsed = mediaItemSchema.safeParse(item)
          if (!parsed.success)
            throw new Error(parsed.error.issues[0]?.message ?? 'Проверьте данные произведения.')
          if (find(item.id)) throw new Error('Произведение с таким идентификатором уже существует.')
          if (get().customItems.length >= 500)
            throw new Error('Достигнут лимит: 500 собственных произведений.')
          const entry = createEntry(parsed.data, nextOrder())
          set((state) => ({
            customItems: [...state.customItems, parsed.data],
            entries: { ...state.entries, [item.id]: entry },
          }))
        },
        moveItem: (id, status, index, fromStatus) => {
          const item = find(id)
          const entry = get().entries[id]
          if (!item || !entry) return
          const others = Object.values(get().entries)
            .filter((value) => value.itemId !== id && entryStatuses(value).includes(status))
            .sort((a, b) => a.order - b.order)
          if (item.type === 'movie' && status === 'active') return
          const target = updateLibraryEntry(
            item,
            entry,
            item.type === 'game' && fromStatus && entry.playthroughs
              ? {
                  playthroughs: entry.playthroughs.map((p) =>
                    p.statuses.includes(fromStatus)
                      ? {
                          ...p,
                          statuses: [
                            ...new Set([...p.statuses.filter((s) => s !== fromStatus), status]),
                          ],
                        }
                      : p,
                  ),
                }
              : { status },
          )
          others.splice(
            index === undefined ? others.length : Math.max(0, Math.min(others.length, index)),
            0,
            target,
          )
          set((state) => ({
            entries: {
              ...state.entries,
              ...Object.fromEntries(
                others.map((value, order) => [value.itemId, { ...value, order }]),
              ),
            },
          }))
        },
        importCollection: (json) => {
          const data = parseBackup(json)
          preserveStoredCollection = false
          set({ ...data, storageError: null, recoveryRequired: false })
        },
        exportCollection: () => serializeBackup(get()),
        clearStorageError: () => set({ storageError: null }),
      }
    },
    {
      name: 'mediashelf-library',
      storage,
      partialize: (state) => ({
        entries: state.entries,
        customItems: state.customItems,
        preferences: state.preferences,
      }),
      merge: (persisted, current) => {
        if (!persisted) return current
        try {
          const data = parseBackup(JSON.stringify({ version: 3, ...(persisted as LibraryData) }))
          return { ...current, ...data }
        } catch {
          preserveStoredCollection = true
          reportStorageError(
            'Сохранённая коллекция повреждена. Исходная запись сохранена. Восстановите данные из резервной копии; новые изменения пока доступны только на этой странице.',
            true,
          )
          return current
        }
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          preserveStoredCollection = true
          reportStorageError(
            'Не удалось прочитать сохранённую коллекцию. Исходная запись сохранена. Восстановите резервную копию; новые изменения пока доступны только на этой странице.',
            true,
          )
        }
      },
    },
  ),
)
