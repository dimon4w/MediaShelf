import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LibraryStats } from '@shared/types.ts'
import { Tooltip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { bigNumber, hoursText } from './format'

interface Tile {
  key: string
  label: ReactNode
  value: string
  unit?: string
  caption?: string | null
}

function HoursLabel() {
  const { t } = useI18n()
  return (
    <>
      <span className="truncate">{t('stats.hours')}</span>
      <Tooltip content={<span className="block max-w-60 text-pretty">{t('stats.hoursHint')}</span>}>
        <button
          type="button"
          aria-label={t('stats.hoursInfo')}
          className="grid size-5 shrink-0 place-items-center rounded-full text-fg-3 transition-colors duration-150 hover:text-fg"
        >
          <Info className="size-3.5" />
        </button>
      </Tooltip>
    </>
  )
}

export function KpiGrid({ stats }: { stats: LibraryStats }) {
  const { t, fmt } = useI18n()
  const year = new Date().getFullYear()
  const hours = Math.round(
    (stats.minutes.movies + stats.minutes.episodes + stats.minutes.games) / 60,
  )
  const days = Math.round(hours / 24)
  const rating = stats.averageRating

  const tiles: Tile[] = [
    {
      key: 'total',
      label: t('stats.total'),
      value: bigNumber(fmt, stats.total),
      caption: stats.addedThisYear ? t('stats.addedYear', { count: stats.addedThisYear }) : null,
    },
    {
      key: 'year',
      label: t('stats.completedYear', { year }),
      value: bigNumber(fmt, stats.completedThisYear),
      caption: t('stats.completedAll', { count: stats.byStatus.completed }),
    },
    {
      key: 'hours',
      label: <HoursLabel />,
      value: bigNumber(fmt, hours),
      caption: days >= 1 ? t('stats.hoursDays', { count: days }) : null,
    },
    {
      key: 'rating',
      label: t('stats.average'),
      value:
        rating === null
          ? t('common.dash')
          : fmt.number(rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      unit: rating === null ? undefined : '/10',
      caption: stats.rated
        ? t('stats.ratingBasis', { count: stats.rated })
        : t('stats.noRatingsShort'),
    },
    {
      key: 'episodes',
      label: t('stats.episodes'),
      value: bigNumber(fmt, stats.episodesWatched),
      caption: stats.minutes.episodes
        ? t('stats.approx', { value: hoursText(fmt, stats.minutes.episodes) })
        : null,
    },
    {
      key: 'streak',
      label: t('stats.streak'),
      value: bigNumber(fmt, stats.longestStreakDays),
      unit: t('stats.streakUnit', { count: stats.longestStreakDays }),
      caption: t('stats.streakCaption'),
    },
  ]

  return (
    <div className="@container">
      {/* 1px gaps over a hairline-coloured grid draw the dividers at any column count. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line @2xl:grid-cols-3 @5xl:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex min-w-0 flex-col bg-raised p-4 sm:p-5">
            <dt className="flex min-h-5 items-center gap-1 text-sm text-fg-2">{tile.label}</dt>
            <dd className="display tabular mt-2 flex items-baseline gap-1 text-3xl sm:text-4xl">
              {tile.value}
              {tile.unit ? (
                <span className="text-lg font-medium tracking-normal text-fg-3">{tile.unit}</span>
              ) : null}
            </dd>
            <dd className="mt-1 truncate text-xs text-fg-3">{tile.caption ?? '\u00a0'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
