import type { Kind, Status } from './types.ts'

/** Statuses a title of each kind may take. Movies are either planned or watched. */
export const STATUSES_BY_KIND: Record<Kind, readonly Status[]> = {
  game: ['planned', 'in_progress', 'paused', 'completed', 'dropped'],
  movie: ['planned', 'completed'],
  series: ['planned', 'in_progress', 'paused', 'completed', 'dropped'],
  anime: ['planned', 'in_progress', 'paused', 'completed', 'dropped'],
}

export function isStatusAllowed(kind: Kind, status: Status) {
  return STATUSES_BY_KIND[kind].includes(status)
}

/** Board and filter order. */
export const STATUS_ORDER: readonly Status[] = [
  'in_progress',
  'planned',
  'paused',
  'completed',
  'dropped',
]
