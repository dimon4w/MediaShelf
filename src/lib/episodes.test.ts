import { describe, expect, it } from 'vitest'
import { catalog } from './catalog'
import { attachEpisodeCatalog, assignLegacyEpisodes, changeEpisode } from './episodes'
import { createEntry, parseBackup, serializeBackup, updateLibraryEntry } from './library'
import type { EpisodeCatalog } from './types'

const show = catalog.find((i) => i.id === 'anime-frieren')!
const episodes: EpisodeCatalog = {
  source: 'tvmaze',
  complete: true,
  episodes: [
    { key: '1:1', season: 1, number: 1, title: 'The Journey’s End' },
    { key: '1:2', season: 1, number: 2, title: 'It Didn’t Have to Be Magic…' },
    { key: '2:1', season: 2, number: 1, title: 'A new journey' },
  ],
}
describe('episode records', () => {
  it('preserves old unassigned progress until an explicit migration', () => {
    const old = updateLibraryEntry(show, createEntry(show, 0), {
      progress: 2,
      notes: 'Не потерять',
    })
    const attached = attachEpisodeCatalog(old, episodes)
    expect(attached.progress).toBe(2)
    expect(attached.episodeStates).toEqual({})
    expect(attached.legacyEpisodeProgress).toBe(2)
    const migrated = assignLegacyEpisodes(attached)
    expect(migrated.legacyEpisodeProgress).toBe(0)
    expect(migrated.episodeStates?.['1:1'].watched).toBe(true)
    expect(migrated.episodeStates?.['2:1']).toBeUndefined()
    expect(migrated.notes).toBe('Не потерять')
  })
  it('keeps seasons and reviews independent across exports and status changes', () => {
    let entry = attachEpisodeCatalog(createEntry(show, 0), episodes)
    entry = changeEpisode(entry, '1:1', { watched: true, review: 'Сильное начало' })
    entry = changeEpisode(entry, '2:1', { review: 'Посмотреть позже' })
    expect(entry.progress).toBe(1)
    expect(entry.episodeStates?.['2:1'].watched).toBe(false)
    const restored = parseBackup(
      serializeBackup({ entries: { [show.id]: entry }, customItems: [] }),
    ).entries[show.id]
    expect(restored).toEqual(entry)
    const planned = updateLibraryEntry(show, restored, { status: 'planned' })
    expect(planned.progress).toBe(1)
    expect(planned.episodeStates?.['1:1'].review).toBe('Сильное начало')
    expect(() => changeEpisode(restored, '10:99', { watched: true })).toThrow()
  })
  it('rejects damaged episode progress without altering existing entries', () => {
    const entry = attachEpisodeCatalog(createEntry(show, 0), episodes)
    expect(() =>
      parseBackup(
        serializeBackup({ entries: { [show.id]: { ...entry, progress: 99 } }, customItems: [] }),
      ),
    ).toThrow()
    expect(entry.progress).toBe(0)
  })
  it('refreshes metadata without losing manual episodes, missing remote rows or reviews', () => {
    let entry = attachEpisodeCatalog(createEntry(show, 0), {
      ...episodes,
      episodes: [
        ...episodes.episodes,
        { key: '3:1', season: 3, number: 1, title: 'Моя запись', manual: true },
      ],
    })
    entry = changeEpisode(entry, '3:1', { watched: true, review: '大切な記録 🎬' })
    const refreshed = attachEpisodeCatalog(entry, {
      ...episodes,
      episodes: [
        { ...episodes.episodes[0], title: 'Updated title' },
        { key: '3:1', season: 3, number: 1, title: 'Remote title' },
      ],
    })
    expect(refreshed.episodeCatalog?.episodes).toHaveLength(4)
    expect(refreshed.episodeCatalog?.episodes.find((e) => e.key === '3:1')?.title).toBe(
      'Моя запись',
    )
    expect(refreshed.episodeStates).toEqual(entry.episodeStates)
    expect(
      parseBackup(serializeBackup({ entries: { [show.id]: refreshed }, customItems: [] })).entries[
        show.id
      ],
    ).toEqual(refreshed)
  })
  it('does not complete an ongoing show, and does not require specials for an ended show', () => {
    let entry = attachEpisodeCatalog(createEntry(show, 0), { ...episodes, ended: false })
    for (const episode of episodes.episodes)
      entry = changeEpisode(entry, episode.key, { watched: true })
    expect(entry.status).toBe('active')
    entry = attachEpisodeCatalog(entry, {
      ...episodes,
      ended: true,
      episodes: [...episodes.episodes, { key: '0:1', season: 0, number: 1, title: 'Special' }],
    })
    entry = changeEpisode(entry, '2:1', { watched: true })
    expect(entry.status).toBe('completed')
    expect(entry.episodeStates?.['0:1']).toBeUndefined()
    entry = changeEpisode(entry, '1:1', { watched: false })
    expect(entry.status).toBe('active')
  })
})
