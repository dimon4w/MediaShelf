import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { genreLabel } from '@shared/genres.ts'
import type { LibraryStats } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { EASE_OUT, hoursText } from './format'
import { StatCard } from './StatCard'

export interface ShareRow {
  key: string
  label: string
  icon: ReactNode
  count: number
}

/** Rows with a count, their share of `total` and a thin bar. */
export function ShareList({ rows, total }: { rows: ShareRow[]; total: number }) {
  const { fmt } = useI18n()
  const reduce = useReducedMotion()
  return (
    <ul className="grid gap-4">
      {rows.map((row, index) => {
        const pct = total ? (row.count / total) * 100 : 0
        return (
          <li key={row.key}>
            <div className="flex items-center gap-2.5">
              <span className="text-fg-2">{row.icon}</span>
              <span className="min-w-0 flex-1 truncate text-base">{row.label}</span>
              <span className="tabular text-base font-medium">{fmt.number(row.count)}</span>
              <span className="tabular w-11 shrink-0 text-right text-sm text-fg-3">
                {fmt.percent(pct)}
              </span>
            </div>
            <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-active">
              <motion.div
                className="h-full rounded-full bg-fg"
                initial={reduce ? false : { width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 0.7, delay: 0.1 + index * 0.05, ease: EASE_OUT }
                }
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function GenresList({ genres }: { genres: LibraryStats['topGenres'] }) {
  const { t, fmt, locale } = useI18n()
  const reduce = useReducedMotion()
  if (!genres.length)
    return <p className="py-8 text-center text-sm text-fg-3">{t('stats.noGenres')}</p>
  const top = genres[0].count
  return (
    <div className="@container">
      <ol className="-my-2 gap-x-12 @xl:columns-2">
        {genres.map((item, index) => (
          <li key={item.genre} className="flex break-inside-avoid items-baseline gap-3 py-2">
            <span aria-hidden="true" className="tabular w-5 shrink-0 text-right text-sm text-fg-3">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-base">{genreLabel(item.genre, locale)}</span>
                <span className="tabular shrink-0 text-sm text-fg-2">{fmt.number(item.count)}</span>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-1 overflow-hidden rounded-full bg-active">
                <motion.div
                  className="h-full rounded-full bg-fg opacity-80"
                  initial={reduce ? false : { width: '0%' }}
                  animate={{ width: `${(item.count / top) * 100}%` }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { duration: 0.7, delay: 0.1 + index * 0.04, ease: EASE_OUT }
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function TimeBreakdown({ minutes }: { minutes: LibraryStats['minutes'] }) {
  const { t, fmt } = useI18n()
  const reduce = useReducedMotion()
  const total = minutes.movies + minutes.episodes + minutes.games
  // Three greys stand in for three colours; the order matches the legend.
  const parts = [
    { key: 'movies', label: t('stats.timeMovies'), value: minutes.movies, tone: 'bg-fg' },
    { key: 'episodes', label: t('stats.timeEpisodes'), value: minutes.episodes, tone: 'bg-fg/55' },
    { key: 'games', label: t('stats.timeGames'), value: minutes.games, tone: 'bg-fg/25' },
  ]
  return (
    <StatCard title={t('stats.time')} meta={hoursText(fmt, total)}>
      <motion.div
        aria-hidden="true"
        className={cn(
          'flex h-2.5 origin-left gap-0.5 overflow-hidden rounded-full',
          !total && 'bg-active',
        )}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.8, ease: EASE_OUT }}
      >
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <span
              key={part.key}
              className={cn('h-full basis-0', part.tone)}
              style={{ flexGrow: part.value }}
            />
          ))}
      </motion.div>
      <ul className="mt-3 divide-y divide-line">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-2.5 py-3">
            <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', part.tone)} />
            <span className="min-w-0 flex-1 truncate text-base">{part.label}</span>
            <span className="tabular text-base font-medium">{hoursText(fmt, part.value)}</span>
            <span className="tabular w-11 shrink-0 text-right text-sm text-fg-3">
              {fmt.percent(total ? (part.value / total) * 100 : 0)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-5 text-xs text-fg-3">{t('stats.hoursHint')}</p>
    </StatCard>
  )
}
