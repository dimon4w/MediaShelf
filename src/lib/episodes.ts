import type { EpisodeCatalog, EpisodeRecord, LibraryEntry } from './types.ts'
import { episodeCatalogSchema, episodeStatesSchema } from './library.ts'

export function attachEpisodeCatalog(entry: LibraryEntry, catalog: EpisodeCatalog): LibraryEntry {
  const parsed = episodeCatalogSchema.parse(catalog)
  const previous = entry.episodeCatalog?.episodes ?? []
  const merged = new Map(previous.map((episode) => [episode.key, episode]))
  for (const episode of parsed.episodes) {
    const saved = merged.get(episode.key)
    // A refresh can be incomplete. Preserve local additions and their titles.
    merged.set(episode.key, saved?.manual ? { ...episode, ...saved } : episode)
  }
  return {
    ...entry,
    episodeCatalog: episodeCatalogSchema.parse({
      ...parsed,
      episodes: [...merged.values()].sort((a, b) => a.season - b.season || a.number - b.number),
    }),
    episodeStates: entry.episodeStates ?? {},
    legacyEpisodeProgress: entry.episodeStates
      ? (entry.legacyEpisodeProgress ?? 0)
      : entry.progress,
  }
}

export function changeEpisode(
  entry: LibraryEntry,
  key: string,
  patch: Partial<Pick<EpisodeRecord, 'watched' | 'review'>>,
): LibraryEntry {
  if (!entry.episodeCatalog?.episodes.some((e) => e.key === key))
    throw new Error('Эпизод не найден в сохранённом сезоне.')
  const now = new Date().toISOString()
  const state = entry.episodeStates?.[key] ?? { watched: false, review: '', updatedAt: now }
  const episodeStates = episodeStatesSchema.parse({
    ...entry.episodeStates,
    [key]: { ...state, ...patch, updatedAt: now },
  })
  const watched = Object.values(episodeStates).filter((e) => e.watched).length
  const progress = watched + (entry.legacyEpisodeProgress ?? 0)
  const regularEpisodes = entry.episodeCatalog.episodes.filter((e) => e.season > 0)
  const allWatched =
    entry.episodeCatalog.complete &&
    entry.episodeCatalog.ended === true &&
    regularEpisodes.length > 0 &&
    regularEpisodes.every((e) => episodeStates[e.key]?.watched)
  const status =
    patch.watched === undefined
      ? entry.status
      : allWatched
        ? 'completed'
        : progress > 0
          ? 'active'
          : 'planned'
  return { ...entry, episodeStates, progress, status, updatedAt: now }
}

export function assignLegacyEpisodes(entry: LibraryEntry): LibraryEntry {
  const count = entry.legacyEpisodeProgress ?? 0
  const candidates = [...(entry.episodeCatalog?.episodes ?? [])]
    .filter((e) => e.season > 0 && !entry.episodeStates?.[e.key]?.watched)
    .sort((a, b) => a.season - b.season || a.number - b.number)
    .slice(0, count)
  const now = new Date().toISOString()
  const episodeStates = { ...entry.episodeStates }
  for (const episode of candidates)
    episodeStates[episode.key] = {
      watched: true,
      review: episodeStates[episode.key]?.review ?? '',
      updatedAt: now,
    }
  return {
    ...entry,
    episodeStates,
    legacyEpisodeProgress: count - candidates.length,
    updatedAt: now,
  }
}
