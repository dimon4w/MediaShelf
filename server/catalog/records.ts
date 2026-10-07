import type { ExternalRating, SourceLink, TitleRecord } from '../../shared/types.ts'
import { foldForMatch, unique } from './util.ts'

function mergeRatings(a: ExternalRating[], b: ExternalRating[]): ExternalRating[] {
  const result = [...a]
  for (const rating of b)
    if (!result.some((item) => item.source === rating.source)) result.push(rating)
  return result
}

function mergeLinks(a: SourceLink[] = [], b: SourceLink[] = []): SourceLink[] | undefined {
  const result = [...a]
  for (const link of b) if (!result.some((item) => item.url === link.url)) result.push(link)
  return result.length ? result : undefined
}

function pickDefined<T>(a: T | undefined, b: T | undefined): T | undefined {
  return a === undefined || a === null ? (b ?? a) : a
}

/**
 * Combines two records for the same title. `primary` wins for scalar fields; lists and
 * names are unioned. Genres stay capped at five.
 */
export function mergeRecords(primary: TitleRecord, secondary: TitleRecord): TitleRecord {
  const merged: TitleRecord = {
    ...secondary,
    ...Object.fromEntries(
      Object.entries(primary).filter(([, value]) => value !== undefined && value !== null),
    ),
    id: primary.id,
    kind: primary.kind,
    names: {
      original: primary.names.original || secondary.names.original,
      ...(pickDefined(primary.names.en, secondary.names.en)
        ? { en: pickDefined(primary.names.en, secondary.names.en) }
        : {}),
      ...(pickDefined(primary.names.ru, secondary.names.ru)
        ? { ru: pickDefined(primary.names.ru, secondary.names.ru) }
        : {}),
    },
    year: primary.year ?? secondary.year,
    poster: primary.poster ?? secondary.poster,
    backdrop: primary.backdrop ?? secondary.backdrop,
    genres: unique([...primary.genres, ...secondary.genres]).slice(0, 5),
    ratings: mergeRatings(primary.ratings, secondary.ratings),
    externalIds: { ...secondary.externalIds, ...primary.externalIds },
  }
  const descriptions = { ...secondary.descriptions, ...primary.descriptions }
  if (Object.keys(descriptions).length) merged.descriptions = descriptions
  const links = mergeLinks(primary.links, secondary.links)
  if (links) merged.links = links
  if (primary.detailed || secondary.detailed) merged.detailed = true
  return merged
}

/** Keeps the first occurrence of every id, merging later duplicates into it. */
export function dedupeRecords(items: readonly TitleRecord[]): TitleRecord[] {
  const byId = new Map<string, TitleRecord>()
  for (const item of items) {
    const existing = byId.get(item.id)
    byId.set(item.id, existing ? mergeRecords(existing, item) : item)
  }
  return [...byId.values()]
}

const ARTICLE = /^(?:the|a|an) /

/**
 * 4 exact name, 3 name starts with the query, 2 query starts a word inside the name,
 * 1 substring or all query words present, 0 no match. Leading English articles are ignored.
 */
export function matchTier(names: readonly (string | undefined)[], query: string): number {
  const q = foldForMatch(query).replace(ARTICLE, '')
  if (!q) return 0
  const words = q.split(' ')
  let best = 0
  for (const raw of names) {
    if (!raw) continue
    const name = foldForMatch(raw)
    const bare = name.replace(ARTICLE, '')
    if (name === q || bare === q) return 4
    if (bare.startsWith(`${q} `) || name.startsWith(`${q} `) || bare.startsWith(q))
      best = Math.max(best, 3)
    else if (` ${name}`.includes(` ${q}`)) best = Math.max(best, 2)
    else if (name.includes(q) || words.every((word) => name.includes(word)))
      best = Math.max(best, 1)
  }
  return best
}

export function recordNames(record: TitleRecord): string[] {
  return [record.names.original, record.names.en, record.names.ru].filter(
    (name): name is string => !!name,
  )
}

export interface RankedCandidate {
  record: TitleRecord
  /** Popularity in 0..1 used to order results within a match tier. */
  weight: number
  /** Drop the candidate when no name matches the query (for sources with noisy fuzzy search). */
  strict?: boolean
}

/**
 * Merges duplicates and orders by match tier, then popularity. Non-matching results from
 * lenient sources (transliterated or alternative titles) are kept at the end.
 */
export function rankByRelevance(
  candidates: readonly RankedCandidate[],
  query: string,
  limit = 40,
): TitleRecord[] {
  const merged = new Map<
    string,
    { record: TitleRecord; weight: number; order: number; strict: boolean }
  >()
  candidates.forEach((candidate, order) => {
    const existing = merged.get(candidate.record.id)
    if (existing) {
      existing.record = mergeRecords(existing.record, candidate.record)
      existing.weight = Math.max(existing.weight, candidate.weight)
      existing.strict &&= candidate.strict === true
    } else
      merged.set(candidate.record.id, { ...candidate, order, strict: candidate.strict === true })
  })
  return [...merged.values()]
    .map((entry) => ({ ...entry, tier: matchTier(recordNames(entry.record), query) }))
    .filter((entry) => entry.tier > 0 || !entry.strict)
    .sort((a, b) => b.tier - a.tier || b.weight - a.weight || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.record)
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
