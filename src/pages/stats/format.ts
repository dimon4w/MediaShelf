import type { Formatters } from '@/i18n'

export const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Values from 10 000 collapse to compact notation so KPI tiles never overflow. */
export function bigNumber(fmt: Formatters, value: number) {
  return value >= 10_000 ? fmt.compact(value) : fmt.number(value)
}

export function hoursText(fmt: Formatters, minutes: number) {
  const hours = minutes / 60
  return fmt.hours(hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10)
}

/** Integer axis with at most `maxSteps` gridlines above zero. */
export function niceScale(max: number, maxSteps = 4) {
  if (max <= 0) return { top: 1, ticks: [0] }
  let step = 1
  for (const candidate of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2500, 5000]) {
    step = candidate
    if (Math.ceil(max / candidate) <= maxSteps) break
  }
  const top = Math.ceil(max / step) * step
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) }
}
