import { describe, expect, it } from 'vitest'
import {
  findGogMatch,
  gameTitleKey,
  gogImage,
  gogOffer,
  gogRegion,
  normalizeGogCatalog,
  normalizeGogProduct,
  parseGogPrice,
} from './gog.ts'
import { fixture } from './testing.ts'

const products = normalizeGogCatalog(fixture('gog-catalog.json'))
const HASH = '0123456789abcdef0123456789abcdef'

describe('normalizeGogCatalog', () => {
  it('drops DLC, soundtracks, demos, tools and unpriced packs', () => {
    expect(products.map((product) => product.title)).toEqual([
      'GWENT: The Witcher Card Game',
      'The Witcher 3: Wild Hunt - Complete Edition',
      'The Witcher 2: Assassins of Kings Enhanced Edition',
      'Creature Kitchen',
    ])
  })

  it('maps products to gog-<id> records with portrait covers', () => {
    const witcher2 = products.find((product) => product.id === '1207658930')
    expect(witcher2?.record).toMatchObject({
      id: 'gog-1207658930',
      kind: 'game',
      names: { original: 'The Witcher 2: Assassins of Kings Enhanced Edition' },
      year: 2012,
      releaseDate: '2012-04-17',
      genres: ['RPG', 'Action', 'Fantasy'],
      creators: ['CD PROJEKT RED'],
      links: [{ source: 'gog', url: 'https://www.gog.com/en/game/the_witcher_2' }],
      externalIds: { gog: '1207658930' },
    })
    expect(witcher2?.record.poster).toMatch(
      /^https:\/\/images\.gog-statics\.com\/[0-9a-f]+_glx_vertical_cover\.jpg$/,
    )
    expect(witcher2?.record.backdrop).toMatch(
      /^https:\/\/images\.gog-statics\.com\/[0-9a-f]+\.jpg$/,
    )
  })

  it('parses prices as amount × 100 with discounts', () => {
    expect(products.find((product) => product.id === '1640424747')?.price).toEqual({
      currency: 'USD',
      price: 2499,
      originalPrice: 4999,
      discountPercent: 50,
    })
    expect(
      parseGogPrice({
        finalMoney: { amount: '2400', currency: 'KZT' },
        baseMoney: { amount: '3000', currency: 'KZT' },
      }),
    ).toEqual({
      currency: 'KZT',
      price: 240000,
      originalPrice: 300000,
      discountPercent: 20,
    })
    expect(parseGogPrice(null)).toBeUndefined()
  })

  it('ignores malformed products', () => {
    expect(
      normalizeGogCatalog({ products: [{ id: 'x', title: 'Bad', productType: 'game' }, null, 5] }),
    ).toEqual([])
    expect(normalizeGogCatalog('nope')).toEqual([])
  })
})

describe('matching and offers', () => {
  it('normalises edition suffixes and marks for Steam ↔ GOG matching', () => {
    expect(gameTitleKey('The Witcher 3: Wild Hunt - Complete Edition')).toBe(
      gameTitleKey('The Witcher® 3: Wild Hunt'),
    )
    expect(gameTitleKey('Disco Elysium - The Final Cut')).toBe('disco elysium')
    expect(gameTitleKey('Sekiro™: Shadows Die Twice - GOTY Edition')).toBe(
      'sekiro shadows die twice',
    )
    expect(gameTitleKey("Baldur's Gate 3")).toBe(gameTitleKey('Baldur’s Gate 3'))
    expect(gameTitleKey('The Witcher: Enhanced Edition Director’s Cut')).toBe('the witcher')
    expect(gameTitleKey('Persona 5 Royal')).not.toBe(gameTitleKey('Persona 5'))
  })

  it('prefers the base game over packs with the same title', () => {
    const pack = { ...products[1], productType: 'pack' as const }
    const game = { ...products[1], id: '1', productType: 'game' as const }
    expect(findGogMatch([pack, game], 'The Witcher 3: Wild Hunt')?.id).toBe('1')
    expect(findGogMatch(products, 'Hades')).toBeUndefined()
  })

  it('builds GOG offers, including free games', () => {
    expect(gogOffer(products[1], 'US')).toEqual({
      store: 'gog',
      url: 'https://www.gog.com/en/game/the_witcher_3_wild_hunt_game_of_the_year_edition',
      region: 'US',
      currency: 'USD',
      price: 2499,
      originalPrice: 4999,
      discountPercent: 50,
      isFree: false,
    })
    expect(gogOffer(products[0], 'US')).toMatchObject({ store: 'gog', price: 0, isFree: true })
  })

  it('maps regions to GOG country and currency', () => {
    expect(gogRegion('PL')).toEqual({ country: 'PL', currency: 'PLN' })
    expect(gogRegion('XX')).toEqual({ country: 'US', currency: 'USD' })
  })

  it('adds size formatters only to bare GOG image URLs', () => {
    expect(gogImage(`https://images.gog-statics.com/${HASH}.jpg`, '_glx_vertical_cover')).toBe(
      `https://images.gog-statics.com/${HASH}_glx_vertical_cover.jpg`,
    )
    expect(gogImage('https://example.com/cover.jpg', '_glx_vertical_cover')).toBe(
      'https://example.com/cover.jpg',
    )
    expect(gogImage('http://images.gog-statics.com/x.jpg')).toBeUndefined()
  })
})

describe('normalizeGogProduct', () => {
  it('reads product details and upgrades protocol-relative images', () => {
    const product = normalizeGogProduct(fixture('gog-product.json'))
    expect(product).toMatchObject({
      id: '1207664663',
      title: 'The Witcher 3: Wild Hunt - Complete Edition',
      releaseDate: '2015-05-19',
      year: 2015,
      platforms: ['pc'],
      link: 'https://www.gog.com/en/game/the_witcher_3_wild_hunt',
    })
    expect(product?.backdrop).toMatch(/^https:\/\/images-1\.gog-statics\.com\//)
    expect(product?.description).toMatch(/^Rewards for owning/)
    expect(normalizeGogProduct({})).toBeNull()
  })
})
