import type {
  LibraryEntry,
  LibraryStatus,
  Playthrough,
  StoreId,
  StoreOffer,
  UserPreferences,
} from './types.ts'

export const platforms = ['PC', 'Xbox', 'PlayStation 4', 'PlayStation 5', 'Nintendo Switch']
export const stores: Record<StoreId, string> = {
  steam: 'Steam',
  gog: 'GOG',
  epic: 'Epic Games',
  xbox: 'Xbox',
  playstation: 'PlayStation',
  nintendo: 'Nintendo',
}
export const countries: Record<string, { label: string; currency: string }> = {
  US: { label: 'США', currency: 'USD' },
  MD: { label: 'Молдова', currency: 'USD' },
  DE: { label: 'Германия', currency: 'EUR' },
  PL: { label: 'Польша', currency: 'PLN' },
  UA: { label: 'Украина', currency: 'UAH' },
  KZ: { label: 'Казахстан', currency: 'KZT' },
  RU: { label: 'Россия', currency: 'RUB' },
  GB: { label: 'Великобритания', currency: 'GBP' },
}
export const defaultPreferences: UserPreferences = {
  onboarded: false,
  platforms: [],
  stores: [],
  country: 'US',
}
export function entryStatuses(entry?: LibraryEntry): LibraryStatus[] {
  if (!entry) return []
  return entry.playthroughs
    ? [...new Set(entry.playthroughs.flatMap((p) => p.statuses))]
    : (entry.statuses ?? [entry.status])
}
export function playthroughLabel(p: Playthrough) {
  return (
    [p.platform, p.store && stores[p.store] !== p.platform ? stores[p.store] : '']
      .filter(Boolean)
      .join(' / ') || 'Основное прохождение'
  )
}
export function priceLabel(offer?: StoreOffer) {
  if (offer?.price === undefined || !offer.currency) return 'Смотреть в магазине'
  if (offer.price === 0) return 'Бесплатно'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: offer.currency,
    maximumFractionDigits: 2,
  }).format(offer.price / 100)
}
export function preferredOffer(offers: StoreOffer[] = [], country = 'US', store = '') {
  const matching = sortOffers(
    offers.filter((o) => (!store || o.store === store) && (!o.country || o.country === country)),
  )
  // Currency conversion is deliberately not implied by comparing unrelated currencies.
  return matching[0]
}
export function sortOffers(offers: StoreOffer[]) {
  const order: StoreId[] = ['steam', 'gog', 'epic', 'xbox', 'playstation', 'nintendo']
  return [...offers].sort((a, b) => order.indexOf(a.store) - order.indexOf(b.store))
}
export function normalizePlatform(platform: string) {
  if (platform === 'PS4') return 'PlayStation 4'
  if (platform === 'PS5') return 'PlayStation 5'
  if (platform.startsWith('Xbox')) return 'Xbox'
  if (platform === 'Switch') return 'Nintendo Switch'
  return platform
}
