import type { PlatformId, StoreOffer, TitleRecord } from '../../shared/types.ts'
import { titleId } from '../../shared/ids.ts'
import { REGIONS, isRegion } from '../../shared/regions.ts'
import { knownGenres } from './genres.ts'
import { HOUR, MINUTE, isNotFound, type HttpClient } from './http.ts'
import {
  asRecord,
  cleanName,
  cleanText,
  foldForMatch,
  httpsUrl,
  isoDate,
  num,
  records,
  str,
  strings,
  yearFrom,
} from './util.ts'

const JUNK =
  /\b(?:soundtracks?|ost|artbooks?|art ?books?|demo|upgrade|redkit|toolkit|goodies|wallpapers?|season pass)\b/i
const EDITION =
  /\b(?:the )?(?:complete|goty|game of the year|enhanced|definitive|ultimate|deluxe|digital deluxe|gold|premium|standard|anniversary|remastered|directors cut|final cut|legendary)(?: edition| cut| version| bundle)?\b/g

/** Title key shared by Steam and GOG listings: no marks, punctuation or edition suffixes. */
export function gameTitleKey(title: string): string {
  return foldForMatch(title)
    .replace(EDITION, ' ')
    .replace(/\b(?:edition|bundle)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** GOG image URL with a size formatter (`_glx_vertical_cover` is 342×482). */
export function gogImage(value: unknown, formatter?: string): string | undefined {
  const url = httpsUrl(value)
  if (!url || !formatter) return url
  return url.replace(
    /^(https:\/\/images(?:-\d)?\.gog-statics\.com\/[0-9a-f]{20,})\.(jpg|png|webp)$/,
    `$1${formatter}.$2`,
  )
}

export interface GogPrice {
  currency: string
  /** Amount × 100, like Steam, even for currencies without minor units. */
  price: number
  originalPrice: number
  discountPercent: number
}

export interface GogProduct {
  id: string
  title: string
  key: string
  productType: 'game' | 'pack'
  storeLink?: string
  price?: GogPrice
  record: TitleRecord
}

function money(value: unknown): { amount: number; currency: string } | undefined {
  const entry = asRecord(value)
  const amount = num(entry.amount)
  const currency = str(entry.currency)
  return amount !== undefined && amount >= 0 && currency ? { amount, currency } : undefined
}

export function parseGogPrice(value: unknown): GogPrice | undefined {
  const price = asRecord(value)
  const final = money(price.finalMoney)
  if (!final) return undefined
  const base = money(price.baseMoney) ?? final
  const label = str(price.discount)?.match(/(\d+)\s*%/)
  const computed = base.amount > 0 ? Math.round((1 - final.amount / base.amount) * 100) : 0
  return {
    currency: final.currency,
    price: Math.round(final.amount * 100),
    originalPrice: Math.round(base.amount * 100),
    discountPercent: label ? Number(label[1]) : Math.max(0, computed),
  }
}

/** catalog.gog.com/v1/catalog products without DLC, soundtracks, demos and tools. */
export function normalizeGogCatalog(payload: unknown): GogProduct[] {
  const result: GogProduct[] = []
  for (const product of records(asRecord(payload).products)) {
    const id = str(product.id)
    const title = cleanName(product.title)
    const type = product.productType
    if (
      !id ||
      !/^\d{1,12}$/.test(id) ||
      !title ||
      (type !== 'game' && type !== 'pack') ||
      JUNK.test(title)
    )
      continue
    const price = parseGogPrice(product.price)
    // Unpriced packs are unreleased add-ons ("Songs of the Past"), not games.
    if (type === 'pack' && !price) continue
    const storeLink = httpsUrl(product.storeLink)
    const record: TitleRecord = {
      id: titleId.gog(id),
      kind: 'game',
      names: { original: title, en: title },
      year: yearFrom(product.releaseDate),
      releaseDate: isoDate(product.releaseDate),
      poster:
        gogImage(product.coverVertical, '_glx_vertical_cover') ??
        gogImage(product.coverHorizontal) ??
        null,
      backdrop:
        gogImage(product.galaxyBackgroundImage) ?? gogImage(product.coverHorizontal) ?? null,
      genres: knownGenres(records(product.genres).map((genre) => str(genre.name) ?? '')),
      ratings: [],
      creators: strings(product.developers).slice(0, 5),
      companies: strings(product.publishers).slice(0, 5),
      links: storeLink ? [{ source: 'gog', url: storeLink }] : [],
      externalIds: { gog: id },
    }
    result.push({
      id,
      title,
      key: gameTitleKey(title),
      productType: type,
      storeLink,
      price,
      record,
    })
  }
  return result
}

/** Product with the same normalised title, preferring the base game over packs. */
export function findGogMatch(
  products: readonly GogProduct[],
  title: string,
): GogProduct | undefined {
  const key = gameTitleKey(title)
  if (!key) return undefined
  const matches = products.filter((product) => product.key === key)
  return matches.find((product) => product.productType === 'game') ?? matches[0]
}

export function gogOffer(product: GogProduct, region: string): StoreOffer | null {
  if (!product.price || !product.storeLink) return null
  const { currency, price, originalPrice, discountPercent } = product.price
  if (originalPrice === 0 && price === 0)
    return { store: 'gog', url: product.storeLink, region, currency, price: 0, isFree: true }
  return {
    store: 'gog',
    url: product.storeLink,
    region,
    currency,
    price,
    originalPrice,
    ...(discountPercent > 0 ? { discountPercent } : {}),
    isFree: false,
  }
}

export interface GogProductDetails {
  id: string
  title: string
  description?: string
  releaseDate: string | null
  year: number | null
  backdrop?: string
  platforms: PlatformId[]
  link?: string
}

/** api.gog.com/products/<id>?expand=description */
export function normalizeGogProduct(payload: unknown): GogProductDetails | null {
  const product = asRecord(payload)
  const id = num(product.id)
  const title = cleanName(product.title)
  if (!id || !title) return null
  const description = asRecord(product.description)
  const systems = asRecord(product.content_system_compatibility)
  const platforms: PlatformId[] = []
  if (systems.windows === true || systems.linux === true) platforms.push('pc')
  if (systems.osx === true) platforms.push('mac')
  const link = httpsUrl(asRecord(product.links).product_card)
  return {
    id: String(id),
    title,
    description: cleanText(description.lead) ?? cleanText(description.full),
    releaseDate: isoDate(product.release_date),
    year: yearFrom(product.release_date),
    backdrop: httpsUrl(asRecord(product.images).background),
    platforms,
    link: link?.replace('https://www.gog.com/game/', 'https://www.gog.com/en/game/'),
  }
}

export function gogRegion(region: string): { country: string; currency: string } {
  return isRegion(region)
    ? { country: region, currency: REGIONS[region].currency }
    : { country: 'US', currency: 'USD' }
}

export async function searchGog(
  http: HttpClient,
  query: string,
  region = 'US',
): Promise<GogProduct[]> {
  const { country, currency } = gogRegion(region)
  const params = new URLSearchParams({
    limit: '20',
    countryCode: country,
    currencyCode: currency,
    locale: 'en-US',
    order: 'desc:score',
    productType: 'in:game,pack',
  })
  const url = `https://catalog.gog.com/v1/catalog?query=like:${encodeURIComponent(query)}&${params}`
  return normalizeGogCatalog(await http.json(url, { ttlMs: region === 'US' ? 10 * MINUTE : HOUR }))
}

export async function fetchGogProduct(
  http: HttpClient,
  id: string,
): Promise<GogProductDetails | null> {
  try {
    return normalizeGogProduct(
      await http.json(`https://api.gog.com/products/${id}?expand=description`, { ttlMs: 6 * HOUR }),
    )
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}
