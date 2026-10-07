import { canonicalGenres, genreLabel } from '../../shared/genres.ts'

// Canonical genres whose Russian label is spelled the same as the English one.
const SAME_IN_RUSSIAN = new Set(['JRPG', 'MMO', 'Point & Click', 'MOBA', '4X', 'CRPG'])

/** Canonical genres limited to names the client can localise (drops noise like "FPP"). */
export function knownGenres(values: readonly string[], limit = 5): string[] {
  return canonicalGenres(values, 50)
    .filter((genre) => genreLabel(genre, 'ru') !== genre || SAME_IN_RUSSIAN.has(genre))
    .slice(0, limit)
}
