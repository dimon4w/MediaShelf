/** Price regions supported by Steam and GOG. */
export const REGIONS = {
  US: { currency: 'USD', ru: 'США', en: 'United States' },
  GB: { currency: 'GBP', ru: 'Великобритания', en: 'United Kingdom' },
  DE: { currency: 'EUR', ru: 'Германия', en: 'Germany' },
  FR: { currency: 'EUR', ru: 'Франция', en: 'France' },
  PL: { currency: 'PLN', ru: 'Польша', en: 'Poland' },
  UA: { currency: 'UAH', ru: 'Украина', en: 'Ukraine' },
  KZ: { currency: 'KZT', ru: 'Казахстан', en: 'Kazakhstan' },
  MD: { currency: 'USD', ru: 'Молдова', en: 'Moldova' },
  RU: { currency: 'RUB', ru: 'Россия', en: 'Russia' },
  TR: { currency: 'USD', ru: 'Турция', en: 'Türkiye' },
  BR: { currency: 'BRL', ru: 'Бразилия', en: 'Brazil' },
  CA: { currency: 'CAD', ru: 'Канада', en: 'Canada' },
  AU: { currency: 'AUD', ru: 'Австралия', en: 'Australia' },
  JP: { currency: 'JPY', ru: 'Япония', en: 'Japan' },
} as const satisfies Record<string, { currency: string; ru: string; en: string }>

export type RegionCode = keyof typeof REGIONS

/** Region display name; only ru/en exist, other locales fall back to English. */
export function regionLabel(code: RegionCode, locale: string): string {
  return locale === 'ru' ? REGIONS[code].ru : REGIONS[code].en
}

export function isRegion(value: unknown): value is RegionCode {
  return typeof value === 'string' && Object.hasOwn(REGIONS, value)
}
