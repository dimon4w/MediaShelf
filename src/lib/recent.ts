import type { TitleRecord } from '@shared/types.ts'

const KEY = 'mediashelf:recent-titles'
const LIMIT = 6

/** Titles the user opened lately, newest first. Device-local, nothing leaves the browser. */
export function readRecent(): TitleRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? (value as TitleRecord[]).slice(0, LIMIT) : []
  } catch {
    return []
  }
}

export function rememberTitle(title: TitleRecord) {
  // Only what a list row needs, so a long description never fills the storage.
  const slim: TitleRecord = {
    id: title.id,
    kind: title.kind,
    names: title.names,
    year: title.year,
    endYear: title.endYear,
    airing: title.airing,
    poster: title.poster,
    backdrop: null,
    genres: [],
    ratings: [],
    externalIds: {},
  }
  try {
    const next = [slim, ...readRecent().filter((item) => item.id !== slim.id)].slice(0, LIMIT)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode or full storage: recents are a nicety */
  }
}
