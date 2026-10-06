import { motion, useReducedMotion } from 'motion/react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { EASE_OUT } from './format'
import { StatCard } from './StatCard'

/** `distribution[0]` holds the number of 1/10 ratings. */
export function RatingsChart({ distribution, rated }: { distribution: number[]; rated: number }) {
  const { t, fmt } = useI18n()
  const reduce = useReducedMotion()
  const max = Math.max(0, ...distribution)
  const mode = max ? distribution.lastIndexOf(max) + 1 : null

  return (
    <StatCard
      title={t('stats.ratings')}
      meta={rated && mode ? t('stats.mostCommon', { rating: mode }) : undefined}
    >
      {rated ? (
        <div>
          <ol className="flex h-36 gap-1 border-b border-line-strong pt-5 sm:gap-1.5">
            {distribution.map((count, index) => {
              const pct = max ? (count / max) * 100 : 0
              return (
                <li key={index} className="relative min-w-0 flex-1">
                  <span className="sr-only">
                    {t('stats.ratingValue', { rating: index + 1, count })}
                  </span>
                  {count ? (
                    <span aria-hidden="true">
                      <motion.span
                        className={cn(
                          'absolute inset-x-0 bottom-0 mx-auto block min-h-1 max-w-7 rounded-t-[4px] rounded-b-[1px] bg-fg',
                          index + 1 === mode ? 'opacity-100' : 'opacity-60',
                        )}
                        initial={reduce ? false : { height: '0%' }}
                        animate={{ height: `${pct}%` }}
                        transition={
                          reduce
                            ? { duration: 0 }
                            : { duration: 0.7, delay: 0.1 + index * 0.03, ease: EASE_OUT }
                        }
                      />
                      <span
                        className="tabular absolute inset-x-0 text-center text-2xs text-fg-3"
                        style={{ bottom: `calc(${pct}% + 4px)` }}
                      >
                        {fmt.number(count)}
                      </span>
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
          <div aria-hidden="true" className="mt-2 flex gap-1 sm:gap-1.5">
            {distribution.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'tabular min-w-0 flex-1 text-center text-xs',
                  index + 1 === mode ? 'font-medium text-fg' : 'text-fg-3',
                )}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="grid h-[168px] place-items-center px-4 text-center text-sm text-fg-3">
          {t('stats.noRatings')}
        </p>
      )}
    </StatCard>
  )
}
