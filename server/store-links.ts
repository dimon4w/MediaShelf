import type { MediaItem, StoreOffer } from '../src/lib/types.ts'

// Verified product pages. These links are not evidence of a current price or an owned copy.
const verified: Record<string, { platforms: string[]; offers: StoreOffer[] }> = {
  '292030': {
    platforms: ['PC', 'Xbox', 'PlayStation 4', 'PlayStation 5', 'Nintendo Switch'],
    offers: [
      { store: 'epic', url: 'https://store.epicgames.com/p/the-witcher-3-wild-hunt' },
      {
        store: 'xbox',
        url: 'https://www.xbox.com/games/store/the-witcher-3-wild-hunt-complete-edition/C261457LCNMJ',
      },
      {
        store: 'playstation',
        url: 'https://www.playstation.com/en-us/games/the-witcher-3-wild-hunt/',
      },
      {
        store: 'nintendo',
        url: 'https://www.nintendo.com/us/store/products/the-witcher-3-wild-hunt-complete-edition-switch/',
      },
    ],
  },
}

export function withVerifiedStores(item: MediaItem): MediaItem {
  const data = verified[item.externalIds?.steam ?? '']
  if (!data) return item
  return {
    ...item,
    platforms: data.platforms,
    offers: [
      ...(item.offers ?? []),
      ...data.offers.filter((o) => !item.offers?.some((existing) => existing.store === o.store)),
    ],
  }
}
