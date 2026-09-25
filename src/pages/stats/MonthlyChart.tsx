import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { KINDS, type LibraryStats } from '@shared/types.ts'
import { KindIcon } from '@/components/StatusIcon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { EASE_OUT, niceScale } from './format'
import { StatCard } from './StatCard'

type Month = LibraryStats['completedByMonth'][number]

export function MonthlyChart({ months, className }: { months: Month[]; className?: string }) {
  const { t, fmt, locale } = useI18n()
  const reduce = useReducedMotion()
  const groupRef = useRef<HTMLDivElement>(null)
  const bars = useRef<(HTMLButtonElement | null)[]>([])
  /** Active column: index plus its left edge and width inside the bar group. */
  const [active, setActive] = useState<{ index: number; left: number; width: number } | null>(null)
  const [focusIndex, setFocusIndex] = useState(months.length - 1)

  const total = months.reduce((sum, month) => sum + month.count, 0)
  const { top, ticks } = niceScale(Math.max(0, ...months.map((month) => month.count)))
  const longMonth = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
      year: 'numeric',
    })
    return (month: string) => {
      const text = format.format(new Date(`${month}-01T12:00:00`))
      return text.charAt(0).toUpperCase() + text.slice(1)
    }
  }, [locale])

  const show = (index: number) => {
    const bar = bars.current[index]
    if (bar) setActive({ index, left: bar.offsetLeft, width: bar.offsetWidth })
  }

  // Taps never produce a pointer-out, so dismiss the tooltip on a tap elsewhere.
  const open = active !== null
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!groupRef.current?.contains(event.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setActive(null)
      return
    }
    const last = months.length - 1
    const moves: Record<string, number> = {
      ArrowRight: Math.min(last, focusIndex + 1),
      ArrowLeft: Math.max(0, focusIndex - 1),
      Home: 0,
      End: last,
    }
    if (!Object.hasOwn(moves, event.key)) return
    event.preventDefault()
    const next = moves[event.key]
    setFocusIndex(next)
    bars.current[next]?.focus()
  }

  const current = active ? months[active.index] : null
  // The tooltip sits beside the column, inside the plot, flipping sides past the middle.
  const flip = active !== null && active.index >= months.length / 2
  const tipLeft = active ? (flip ? active.left - 8 : active.left + active.width + 8) : 0

  return (
    <StatCard
      title={t('stats.months')}
      meta={t('count.titles', { count: total })}
      className={className}
    >
      <div className="relative h-44 sm:h-52">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 h-0"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              <span className="tabular absolute left-0 w-5 -translate-y-1/2 text-right text-2xs text-fg-3">
                {tick}
              </span>
              <span
                className={cn(
                  'absolute right-0 left-8 top-0 border-t',
                  tick === 0 ? 'border-line-strong' : 'border-dashed border-line',
                )}
              />
            </div>
          ))}
        </div>
        {total === 0 ? (
          <p className="pointer-events-none absolute inset-x-8 top-1/3 text-center text-sm text-fg-3">
            {t('stats.monthsEmpty')}
          </p>
        ) : null}

        <div
          ref={groupRef}
          role="group"
          aria-label={t('stats.months')}
          onKeyDown={onKeyDown}
          onPointerLeave={(event) => {
            if (event.pointerType !== 'mouse') return
            if (groupRef.current?.contains(document.activeElement)) show(focusIndex)
            else setActive(null)
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(null)
          }}
          className="absolute inset-y-0 right-0 left-8 flex items-end gap-1 sm:gap-2"
        >
          {months.map((month, index) => {
            const isActive = active?.index === index
            const breakdown = KINDS.filter((kind) => month.byKind[kind])
              .map((kind) => `${t(`kinds.${kind}`)}: ${month.byKind[kind]}`)
              .join(', ')
            const label = `${longMonth(month.month)} — ${t('count.titles', { count: month.count })}${breakdown ? ` (${breakdown})` : ''}`
            return (
              <button
                key={month.month}
                ref={(node) => {
                  bars.current[index] = node
                }}
                type="button"
                tabIndex={index === focusIndex ? 0 : -1}
                aria-label={label}
                onPointerEnter={(event) => event.pointerType === 'mouse' && show(index)}
                onFocus={() => {
                  setFocusIndex(index)
                  show(index)
                }}
                onClick={() => show(index)}
                className={cn(
                  'relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md transition-colors duration-150',
                  isActive && 'bg-hover',
                )}
              >
                {month.count ? (
                  <motion.span
                    aria-hidden="true"
                    className={cn(
                      'block min-h-1 w-full max-w-10 rounded-t-[5px] rounded-b-[1px] bg-fg transition-opacity duration-200',
                      isActive ? 'opacity-100' : 'opacity-70',
                    )}
                    initial={reduce ? false : { height: '0%' }}
                    animate={{ height: `${(month.count / top) * 100}%` }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.7, delay: index * 0.035, ease: EASE_OUT }
                    }
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="block h-[3px] w-full max-w-10 rounded-full bg-fg opacity-15"
                  />
                )}
              </button>
            )
          })}

          {active && current ? (
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute top-0 z-20 w-max min-w-40 animate-fade-in rounded-lg bg-floating px-3 py-2.5 shadow-floating',
                'transition-[left] duration-150 ease-out',
                flip && '-translate-x-full',
              )}
              style={{ left: tipLeft }}
            >
              <p className="text-xs text-fg-3">{longMonth(current.month)}</p>
              <p className="tabular mt-0.5 text-base font-semibold">
                {t('count.titles', { count: current.count })}
              </p>
              {current.count ? (
                <ul className="mt-2 grid gap-1 border-t border-line pt-2">
                  {KINDS.filter((kind) => current.byKind[kind]).map((kind) => (
                    <li key={kind} className="flex items-center gap-2 text-xs">
                      <KindIcon kind={kind} className="size-3.5 text-fg-3" />
                      <span className="flex-1 text-fg-2">{t(`kinds.${kind}`)}</span>
                      <span className="tabular font-medium">
                        {fmt.number(current.byKind[kind])}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div aria-hidden="true" className="mt-2 flex gap-1 pl-8 sm:gap-2">
        {months.map((month, index) => {
          const short = fmt.monthShort(`${month.month}-01`)
          return (
            <span
              key={month.month}
              className={cn(
                'min-w-0 flex-1 truncate text-center text-2xs transition-colors duration-150',
                active?.index === index
                  ? 'font-medium text-fg'
                  : index === months.length - 1
                    ? 'text-fg-2'
                    : 'text-fg-3',
              )}
            >
              <span className="sm:hidden">{short.charAt(0).toUpperCase()}</span>
              <span className="max-sm:hidden">{short}</span>
            </span>
          )
        })}
      </div>
    </StatCard>
  )
}
