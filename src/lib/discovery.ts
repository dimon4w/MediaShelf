import type { DiscoveryOrder, MediaItem } from './types.ts'

export function mergeWorks(items: MediaItem[]) {
  const groups = new Map<string, MediaItem>()
  for (const item of items) {
    const name = item.originalTitle
      .toLowerCase()
      .replace(/[®™]/g, '')
      .replace(/[-:—]?\s*(complete edition|game of the year edition|enhanced edition)$/i, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
    const key =
      item.type === 'game'
        ? `game:${name}`
        : item.externalIds?.imdb
          ? `imdb:${item.externalIds.imdb}`
          : item.id
    const previous = groups.get(key)
    groups.set(
      key,
      previous
        ? {
            ...item,
            ...previous,
            externalIds: { ...item.externalIds, ...previous.externalIds },
            offers: [
              ...new Map(
                [...(previous.offers ?? []), ...(item.offers ?? [])].map((o) => [
                  `${o.store}:${o.edition ?? ''}`,
                  o,
                ]),
              ).values(),
            ],
            platforms: [...new Set([...(previous.platforms ?? []), ...(item.platforms ?? [])])],
          }
        : item,
    )
  }
  return [...groups.values()]
}

export function franchiseKey(item: MediaItem) {
  if (item.franchise) return item.franchise.toLowerCase()
  const title = item.originalTitle.toLowerCase()
  const known = [
    'harry potter',
    'the lord of the rings',
    'star wars',
    'the witcher',
    'dune',
    'batman',
    'spider-man',
    'naruto',
    'attack on titan',
    'final fantasy',
    'resident evil',
  ]
  return (
    known.find((k) => title.includes(k)) ??
    title.replace(/\s*[:：].*$/, '').replace(/\s+\d+.*$/, '')
  )
}
export function artworkRank(item: MediaItem) {
  return item.artworkQuality === 'missing' ||
    !item.poster ||
    /missing|placeholder/i.test(item.poster)
    ? 1
    : 0
}
export function orderDiscovery(items: MediaItem[], order: DiscoveryOrder, query = '') {
  const quality = [...items].sort((a, b) => artworkRank(a) - artworkRank(b))
  if (query.trim()) {
    const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
    const q = key(query)
    const relevance = (i: MediaItem) => {
      const names = [key(i.title), key(i.originalTitle)]
      if (names.includes(q)) return 0
      const matching = names.filter((n) => n.includes(q))
      return matching.length ? 1 + Math.min(...matching.map((n) => n.length - q.length)) : 1000
    }
    return quality.sort((a, b) => artworkRank(a) - artworkRank(b) || relevance(a) - relevance(b))
  }
  const ranked = quality.sort(
    (a, b) =>
      artworkRank(a) - artworkRank(b) ||
      (order === 'classics'
        ? Math.log10((b.ratings?.find((r) => r.source === 'imdb')?.votes ?? 0) + 1) -
          Math.log10((a.ratings?.find((r) => r.source === 'imdb')?.votes ?? 0) + 1)
        : 0) ||
      (b.popularity ?? 0) - (a.popularity ?? 0),
  )
  const result: MediaItem[] = []
  while (ranked.length) {
    const recent = result.slice(-3).map(franchiseKey)
    const qualityTier = artworkRank(ranked[0])
    let index = ranked.findIndex(
      (i) =>
        artworkRank(i) === qualityTier &&
        !recent.includes(franchiseKey(i)) &&
        i.type !== result.at(-1)?.type,
    )
    if (index < 0)
      index = ranked.findIndex(
        (i) => artworkRank(i) === qualityTier && !recent.includes(franchiseKey(i)),
      )
    result.push(ranked.splice(Math.max(0, index), 1)[0])
  }
  return result
}

export function randomFeatured(items: MediaItem[], count = 5) {
  const candidates = orderDiscovery(
    items.filter((i) => !artworkRank(i)),
    'popular',
  ).slice(0, 40)
  const selected: MediaItem[] = []
  while (candidates.length && selected.length < count) {
    const index = Math.floor(Math.random() * candidates.length)
    const [item] = candidates.splice(index, 1)
    if (!selected.some((i) => franchiseKey(i) === franchiseKey(item))) selected.push(item)
  }
  return selected
}
