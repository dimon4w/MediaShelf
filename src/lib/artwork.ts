import { catalog } from './catalog'
import type { MediaItem } from './types'

const bundledIds = new Set(catalog.map((item) => item.id))

export function getPosterUrl(item: MediaItem) {
  return bundledIds.has(item.id) ? `${import.meta.env.BASE_URL}covers/${item.id}.jpg` : item.poster
}

const backdrops = new Set(['movie-dune', 'game-cyberpunk'])

export function getBackdropUrl(item: MediaItem) {
  return backdrops.has(item.id)
    ? `${import.meta.env.BASE_URL}backdrops/${item.id}.webp`
    : item.backdrop
}
