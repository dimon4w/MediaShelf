import { describe, expect, it } from 'vitest'
import { normalizeGog } from './catalog'
import { steamOffer, steamRating } from './metadata'
import { mergeWorks, orderDiscovery } from '../src/lib/discovery'
import { preferredOffer } from '../src/lib/platforms'
import { catalog } from '../src/lib/catalog'

describe('stores and public ratings', () => {
  it('keeps complete game editions but excludes tools and soundtracks', () => {
    const works = normalizeGog({
      products: [
        {
          id: '1',
          title: 'The Witcher 3: Wild Hunt - Complete Edition',
          productType: 'pack',
          storeLink: 'https://www.gog.com/en/game/witcher',
          coverVertical: 'https://images.gog.com/cover.jpg',
          price: {
            finalMoney: { amount: '24.99', currency: 'USD' },
            baseMoney: { amount: '49.99' },
          },
        },
        { id: '2', title: 'The Witcher 3 REDkit', productType: 'game' },
        { id: '3', title: 'A Soundtrack', productType: 'game' },
      ],
    })
    expect(works).toHaveLength(1)
    expect(works[0].offers?.[0]).toMatchObject({
      price: 2499,
      originalPrice: 4999,
      currency: 'USD',
    })
  })
  it('distinguishes unknown prices from free games and gives Steam priority', () => {
    expect(steamOffer({}, '1', 'US').price).toBeUndefined()
    expect(steamOffer({ is_free: true }, '1', 'US').price).toBe(0)
    expect(
      preferredOffer([
        { store: 'gog', url: 'https://gog.com', price: 1000, currency: 'USD' },
        { store: 'steam', url: 'https://store.steampowered.com' },
      ])?.store,
    ).toBe('steam')
  })
  it('uses total positive reviews divided by all reviews and handles an empty score', () => {
    expect(
      steamRating({ query_summary: { total_positive: 80, total_reviews: 100 } }),
    ).toMatchObject({ value: 80, votes: 100, source: 'steam' })
    expect(steamRating({ query_summary: { total_positive: 0, total_reviews: 0 } })).toBeUndefined()
  })
})

describe('discovery ordering', () => {
  it('merges store editions without losing offers or source identifiers', () => {
    const base = {
      ...catalog.find((i) => i.type === 'game')!,
      id: 'steam-1',
      title: 'Example',
      originalTitle: 'Example',
      externalIds: { steam: '1' },
      offers: [{ store: 'steam' as const, url: 'https://store.steampowered.com/app/1/' }],
    }
    const gog = {
      ...base,
      id: 'gog-2',
      originalTitle: 'Example - Complete Edition',
      externalIds: { gog: '2' },
      offers: [{ store: 'gog' as const, url: 'https://gog.com/en/game/example' }],
    }
    const items = mergeWorks([base, gog])
    expect(items).toHaveLength(1)
    expect(items[0].externalIds).toEqual({ steam: '1', gog: '2' })
    expect(items[0].offers).toHaveLength(2)
  })
  it('ranks missing artwork last even for an exact title search', () => {
    const missing = {
      ...catalog[0],
      id: 'missing',
      title: 'Example',
      originalTitle: 'Example',
      poster: '',
      artworkQuality: 'missing' as const,
    }
    const good = {
      ...catalog[0],
      id: 'good',
      title: 'Example Extended',
      originalTitle: 'Example Extended',
      popularity: 10,
    }
    expect(orderDiscovery([missing, good], 'popular', 'Example').map((i) => i.id)).toEqual([
      'good',
      'missing',
    ])
  })
  it('prefers the main game over a longer expansion title in a search', () => {
    const base = {
      ...catalog[0],
      id: 'base',
      title: 'The Witcher 3: Wild Hunt',
      originalTitle: 'The Witcher 3: Wild Hunt',
    }
    const extra = {
      ...base,
      id: 'expansion',
      title: 'The Witcher 3: Wild Hunt — Extra Stories',
      originalTitle: 'The Witcher 3: Wild Hunt — Extra Stories',
    }
    expect(orderDiscovery([extra, base], 'popular', 'the witcher 3')[0].id).toBe('base')
  })
})
