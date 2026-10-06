import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Locale } from '@shared/types.ts'
import { en } from './en.ts'
import { ru, type Messages } from './ru.ts'

type Plural = { one: string; few: string; many: string; other: string }
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends Plural
      ? `${P}${K}`
      : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Messages>
export type Vars = Record<string, string | number>

const dictionaries: Record<Locale, Messages> = { ru, en }
const STORAGE_KEY = 'mediashelf:locale'

function lookup(messages: Messages, key: string): string | Plural | undefined {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node as string | Plural | undefined
}

export function translate(locale: Locale, key: MessageKey | string, vars?: Vars): string {
  let value = lookup(dictionaries[locale], key) ?? lookup(dictionaries.ru, key)
  if (value === undefined) return key
  if (typeof value === 'object') {
    const count = Number(vars?.count ?? 0)
    const form = new Intl.PluralRules(locale).select(count) as keyof Plural
    value = value[form] ?? value.other
  }
  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] === undefined ? match : String(vars[name]),
  )
}

export function initialLocale(): Locale {
  if (typeof document !== 'undefined' && document.documentElement.lang === 'en') return 'en'
  return 'ru'
}

export interface Formatters {
  number(value: number, options?: Intl.NumberFormatOptions): string
  compact(value: number): string
  percent(value: number): string
  rating(value: number, max: 10 | 100): string
  date(value: string | number | Date, style?: 'short' | 'medium' | 'long'): string
  monthShort(value: string | Date): string
  relative(value: string | number | Date): string
  currency(minor: number, currency: string): string
  duration(minutes: number): string
  hours(hours: number): string
  list(values: string[]): string
}

export function createFormatters(locale: Locale): Formatters {
  const tag = locale === 'ru' ? 'ru-RU' : 'en-US'
  const numbers = new Intl.NumberFormat(tag)
  const compact = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 })
  const relative = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' })
  const lists = new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' })
  const dateFormats = {
    short: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }),
    medium: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }),
    long: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric' }),
  }
  const month = new Intl.DateTimeFormat(tag, { month: 'short' })
  const toDate = (value: string | number | Date) =>
    value instanceof Date
      ? value
      : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00`)
        : new Date(value)
  return {
    number: (value, options) =>
      options ? new Intl.NumberFormat(tag, options).format(value) : numbers.format(value),
    compact: (value) => compact.format(value),
    percent: (value) =>
      new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(
        value / 100,
      ),
    rating: (value, max) =>
      max === 100
        ? new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(
            value / 100,
          )
        : new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(
            value,
          ),
    date: (value, style = 'medium') => {
      const date = toDate(value)
      return Number.isNaN(date.getTime()) ? '' : dateFormats[style].format(date)
    },
    monthShort: (value) => month.format(toDate(value)).replace('.', ''),
    relative: (value) => {
      const diff = (toDate(value).getTime() - Date.now()) / 1000
      const abs = Math.abs(diff)
      if (abs < 45) return relative.format(0, 'second')
      if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute')
      if (abs < 86_400) return relative.format(Math.round(diff / 3600), 'hour')
      if (abs < 86_400 * 7) return relative.format(Math.round(diff / 86_400), 'day')
      if (abs < 86_400 * 30) return relative.format(Math.round(diff / (86_400 * 7)), 'week')
      if (abs < 86_400 * 365) return relative.format(Math.round(diff / (86_400 * 30)), 'month')
      return relative.format(Math.round(diff / (86_400 * 365)), 'year')
    },
    currency: (minor, currency) => {
      try {
        return new Intl.NumberFormat(tag, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2,
        }).format(minor / 100)
      } catch {
        return `${(minor / 100).toFixed(2)} ${currency}`
      }
    },
    duration: (minutes) => {
      const h = Math.floor(minutes / 60)
      const m = Math.round(minutes % 60)
      const unit = (value: number, name: 'hour' | 'minute') =>
        new Intl.NumberFormat(tag, { style: 'unit', unit: name, unitDisplay: 'short' }).format(
          value,
        )
      if (!h) return unit(m, 'minute')
      return m ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(h, 'hour')
    },
    hours: (hours) =>
      new Intl.NumberFormat(tag, {
        style: 'unit',
        unit: 'hour',
        unitDisplay: 'short',
        maximumFractionDigits: 1,
      }).format(hours),
    list: (values) => lists.format(values),
  }
}

interface I18nContextValue {
  locale: Locale
  setLocale(locale: Locale): void
  t(key: MessageKey, vars?: Vars): string
  fmt: Formatters
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      fmt: createFormatters(locale),
    }),
    [locale, setLocale],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
