import { beforeEach, describe, expect, it } from 'vitest'
import { catalog, featuredIds } from './catalog'
import {
  createEntry,
  MAX_BACKUP_BYTES,
  filterMedia,
  getProgressMax,
  mediaItemSchema,
  parseBackup,
  serializeBackup,
  updateLibraryEntry,
} from './library'
import { useLibraryStore } from '../store/useLibraryStore'
import type { LibraryData } from './types'

const game = catalog.find((item) => item.id === 'game-cyberpunk')!
const show = catalog.find((item) => item.id === 'anime-frieren')!
const empty: LibraryData = { entries: {}, customItems: [] }

describe('catalog', () => {
  it('has 32 valid unique works, eight per category', () => {
    expect(catalog).toHaveLength(32)
    expect(new Set(catalog.map((item) => item.id)).size).toBe(32)
    for (const type of ['game', 'movie', 'series', 'anime'])
      expect(catalog.filter((item) => item.type === type)).toHaveLength(8)
    for (const item of catalog) expect(mediaItemSchema.safeParse(item).success, item.id).toBe(true)
    for (const id of featuredIds) expect(catalog.some((item) => item.id === id)).toBe(true)
  })
  it('rejects executable image URLs and missing episode totals', () => {
    expect(mediaItemSchema.safeParse({ ...game, poster: 'javascript:alert(1)' }).success).toBe(
      false,
    )
    expect(mediaItemSchema.safeParse({ ...show, episodes: undefined }).success).toBe(false)
  })
})

describe('progress', () => {
  it('clamps game progress without changing status or mutating its input', () => {
    const entry = createEntry(game, 0)
    const complete = updateLibraryEntry(game, entry, { progress: 300 })
    expect(complete.progress).toBe(100)
    expect(complete.status).toBe('planned')
    expect(entry.progress).toBe(0)
    expect(updateLibraryEntry(game, complete, { status: 'active' }).progress).toBe(100)
    expect(updateLibraryEntry(game, complete, { status: 'planned' }).progress).toBe(100)
    expect(updateLibraryEntry(game, entry, { rating: 12 }).rating).toBe(10)
  })
  it('uses episodes rather than percentages for series and anime', () => {
    const entry = updateLibraryEntry(show, createEntry(show, 0), { status: 'completed' })
    expect(entry.progress).toBe(28)
    expect(getProgressMax(show)).toBe(28)
    expect(updateLibraryEntry(show, entry, { progress: -4 }).progress).toBe(0)
  })
})

describe('backups', () => {
  it('roundtrips notes, ratings and custom works', () => {
    const custom = { ...game, id: 'custom-test', title: 'Моя игра', poster: '' }
    const data = {
      customItems: [custom],
      entries: {
        [custom.id]: { ...createEntry(custom, 0), notes: 'Вернуться вечером', rating: 9 },
      },
    }
    expect(parseBackup(serializeBackup(data))).toEqual(data)
  })
  it('rejects broken JSON, unknown versions, duplicate IDs and missing works', () => {
    expect(() => parseBackup('broken')).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...empty, version: 99 }))).toThrow()
    expect(() => parseBackup(serializeBackup({ entries: {}, customItems: [game] }))).toThrow()
    expect(() =>
      parseBackup(serializeBackup({ ...empty, entries: { unknown: createEntry(game, 0) } })),
    ).toThrow()
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow()
  })
  it('roundtrips a large collection with non-ASCII notes', () => {
    const customItems = Array.from({ length: 300 }, (_, index) => ({
      ...game,
      id: `custom-large-${index}`,
      description: 'О'.repeat(4000),
    }))
    const entries = Object.fromEntries(
      customItems.map((item, index) => [
        item.id,
        { ...createEntry(item, index), notes: 'П'.repeat(4000) },
      ]),
    )
    const json = serializeBackup({ customItems, entries })
    expect(new TextEncoder().encode(json).byteLength).toBeGreaterThan(2 * 1024 * 1024)
    expect(Object.keys(parseBackup(json).entries)).toHaveLength(300)
  })
  it('rejects out of range saved progress', () => {
    expect(() =>
      parseBackup(
        serializeBackup({
          ...empty,
          entries: { [game.id]: { ...createEntry(game, 0), progress: 105 } },
        }),
      ),
    ).toThrow()
  })
})

describe('store', () => {
  beforeEach(() => useLibraryStore.setState({ ...empty, storageError: null }))
  it('does not reset notes when adding an existing item', () => {
    const store = useLibraryStore.getState()
    store.addItem(game)
    store.updateEntry(game.id, { notes: 'Не потерять', rating: 8 })
    store.addItem(game)
    expect(useLibraryStore.getState().entries[game.id].notes).toBe('Не потерять')
    expect(useLibraryStore.getState().entries[game.id].rating).toBe(8)
  })
  it('saves remote metadata only when an item is added and roundtrips unknown totals', () => {
    const remote = {
      id: 'tvmaze-777777',
      type: 'series' as const,
      title: 'Remote series',
      originalTitle: 'Remote series',
      year: null,
      genres: ['Драма'],
      description: '',
      poster: '',
      accent: '#94b9ec',
      source: 'tvmaze' as const,
      sourceUrl: 'https://www.tvmaze.com/shows/777777',
    }
    const store = useLibraryStore.getState()
    store.addItem(remote)
    store.updateEntry(remote.id, { progress: 18, notes: 'Вернуться сюда', rating: 9 })
    store.addItem(remote)
    expect(useLibraryStore.getState().customItems).toHaveLength(1)
    expect(useLibraryStore.getState().entries[remote.id].status).toBe('active')
    const copy = parseBackup(store.exportCollection())
    expect(copy.customItems[0]).toEqual(remote)
    expect(copy.entries[remote.id].progress).toBe(18)
    expect(copy.entries[remote.id].notes).toBe('Вернуться сюда')
  })
  it('preserves the collection on an invalid import', () => {
    useLibraryStore.getState().addItem(game)
    const before = useLibraryStore.getState().entries
    expect(() => useLibraryStore.getState().importCollection('{bad')).toThrow()
    expect(useLibraryStore.getState().entries).toBe(before)
  })
  it('adds favorites, moves entries, and retains custom works after removing from shelf', () => {
    const store = useLibraryStore.getState()
    store.toggleFavorite(game)
    expect(useLibraryStore.getState().entries[game.id].favorite).toBe(true)
    store.moveItem(game.id, 'completed')
    expect(useLibraryStore.getState().entries[game.id].progress).toBe(0)
    const custom = { ...game, id: 'custom-second' }
    store.addCustomItem(custom)
    store.removeItem(custom.id)
    expect(useLibraryStore.getState().customItems).toContainEqual(custom)
    expect(useLibraryStore.getState().entries[custom.id]).toBeUndefined()
  })
})

describe('independent playthroughs', () => {
  it('preserves two stores, overlapping statuses and partial completion across backups', () => {
    const entry = updateLibraryEntry(game, createEntry(game, 0), {
      playthroughs: [
        {
          id: 'xbox-run',
          platform: 'Xbox',
          store: 'xbox',
          progress: 80,
          statuses: ['completed', 'active'],
        },
        { id: 'epic-run', platform: 'PC', store: 'epic', progress: 25, statuses: ['active'] },
      ],
    })
    const data = { entries: { [game.id]: entry }, customItems: [] }
    expect(parseBackup(serializeBackup(data))).toEqual(data)
    const next = updateLibraryEntry(game, entry, {
      playthroughs: entry.playthroughs!.filter((p) => p.id !== 'epic-run'),
    })
    expect(next.playthroughs).toHaveLength(1)
    expect(next.progress).toBe(80)
    expect(next.statuses).toEqual(['completed', 'active'])
  })
  it('migrates a version 1 game without inventing an owned platform', () => {
    const old = {
      itemId: game.id,
      status: 'completed',
      progress: 100,
      rating: 8,
      notes: 'Сохранить',
      favorite: true,
      addedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      order: 0,
    }
    const result = parseBackup(
      JSON.stringify({ version: 1, entries: { [game.id]: old }, customItems: [] }),
    )
    expect(result.entries[game.id].playthroughs).toEqual([
      { id: 'primary', platform: '', store: '', progress: 100, statuses: ['completed'] },
    ])
    expect(result.entries[game.id].notes).toBe('Сохранить')
    expect(result.entries[game.id].updatedAt).toBe(old.updatedAt)
  })
})

describe('search', () => {
  it('searches Russian and original names and combines filters', () => {
    const filters = {
      query: 'dune',
      type: 'all' as const,
      genre: '',
      year: null,
      status: 'all' as const,
      favoritesOnly: false,
      libraryOnly: false,
      sort: 'curated' as const,
    }
    expect(filterMedia(catalog, {}, filters).map((item) => item.id)).toEqual(['movie-dune'])
    expect(
      filterMedia(catalog, {}, { ...filters, query: 'Все везде' }).map((item) => item.id),
    ).toEqual(['movie-everything'])
    expect(
      filterMedia(catalog, {}, { ...filters, query: '', type: 'game', year: 2022 }),
    ).toHaveLength(2)
    expect(filterMedia(catalog, {}, { ...filters, query: '', libraryOnly: true })).toHaveLength(0)
  })
})
