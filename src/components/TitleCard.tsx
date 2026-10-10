import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { LibraryEntry, TitleRecord } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useLibraryMap } from '@/lib/queries'
import {
  formatRating,
  ratingSourceLabel,
  statusLabelKey,
  titleHref,
  titleName,
  yearRange,
} from '@/lib/titles'
import { Poster } from './Poster'
import { StatusIcon } from './StatusIcon'
import { Button } from './ui/button'
import { Skeleton } from './ui/misc'
import { Tooltip } from './ui/tooltip'
import { useLibraryActions } from './library-actions'

interface TitleCardProps {
  title: TitleRecord
  entry?: LibraryEntry | null
  showKind?: boolean
  rank?: number
  className?: string
  eager?: boolean
  meta?: ReactNode
}

export function TitleCard({
  title,
  entry,
  showKind,
  rank,
  className,
  eager,
  meta,
}: TitleCardProps) {
  const { t, locale, fmt } = useI18n()
  const library = useLibraryMap()
  const saved = entry ?? library.get(title.id) ?? null
  const actions = useLibraryActions()
  const name = titleName(title.names, locale)
  const rating = title.ratings[0]
  const year = yearRange(title)
  const progress =
    saved && saved.status === 'in_progress' && saved.progress > 0 && saved.progress < 100
      ? saved.progress
      : null

  const card = (
    <div className={cn('group/card relative min-w-0', className)}>
      <Link
        to={titleHref(title.id)}
        className="block rounded-md outline-offset-4"
        aria-label={[name, year, t(`kind.${title.kind}`)].filter(Boolean).join(', ')}
      >
        <div className="relative transition-transform duration-300 ease-out group-hover/card:-translate-y-0.5">
          <Poster
            src={title.poster}
            alt={name}
            kind={title.kind}
            eager={eager}
            className="shadow-poster transition-[box-shadow] duration-300 group-hover/card:ring-line-strong"
          />
          {saved ? (
            <Tooltip content={t(statusLabelKey(saved.kind, saved.status))}>
              <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
                <StatusIcon status={saved.status} className="size-3.5 [--panel:#000]" />
              </span>
            </Tooltip>
          ) : null}
          {progress !== null ? (
            <div className="absolute inset-x-0 bottom-0 rounded-b-md bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-2">
              <div className="h-[3px] overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-2 px-0.5">
          <p className="truncate text-sm leading-[18px] font-medium text-fg" title={name}>
            {name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-fg-3">
            {meta ?? (
              <>
                {showKind ? <span>{t(`kind.${title.kind}`)}</span> : null}
                {showKind && year ? <span aria-hidden="true">·</span> : null}
                {year ? <span className="tabular">{year}</span> : null}
                {rating ? (
                  <>
                    {year || showKind ? <span aria-hidden="true">·</span> : null}
                    <span className="tabular">
                      {ratingSourceLabel(rating.source)} {formatRating(rating, fmt)}
                    </span>
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
      </Link>
      {!saved ? (
        <Tooltip content={t('title.addToLibrary')}>
          <Button
            variant="primary"
            size="icon-sm"
            aria-label={`${t('title.addToLibrary')}: ${name}`}
            onClick={() => actions.add(title, 'planned')}
            className="absolute top-1.5 right-1.5 size-7 rounded-full opacity-0 shadow-md transition-opacity duration-200 group-focus-within/card:opacity-100 group-hover/card:opacity-100 max-md:hidden"
          >
            <Plus />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  )

  if (rank === undefined) return card
  return (
    <div className="flex items-end gap-1">
      <span
        aria-label={t('discover.rank', { rank })}
        className="tabular -mr-2 w-[84px] shrink-0 pb-12 text-right text-[64px] leading-none font-bold tracking-[-0.04em] text-transparent select-none [-webkit-text-stroke:1.5px_var(--line-strong)] sm:w-[104px] sm:text-[80px]"
      >
        {rank}
      </span>
      {/* flex-1: without it the card shrinks to its title's width, so every poster in a chart
          row came out a different size ("Cyberpunk 2077" narrower than "Ведьмак 3: Дикая Охота"). */}
      <div className="min-w-0 flex-1">{card}</div>
    </div>
  )
}

export function TitleCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-md" />
      <Skeleton className="mt-2.5 h-3.5 w-4/5" />
      <Skeleton className="mt-1.5 h-3 w-1/2" />
    </div>
  )
}

export const GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] sm:gap-x-4 sm:gap-y-7'

export function TitleGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(GRID_CLASS, className)}>{children}</div>
}

/** Horizontal shelf with snap scrolling and edge arrows on pointer devices. */
export function Shelf({
  children,
  className,
  itemClassName = 'w-[124px] sm:w-[152px]',
  label,
}: {
  children: ReactNode[]
  className?: string
  itemClassName?: string
  label: string
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () =>
      setEdges((prev) => {
        const start = element.scrollLeft <= 4
        const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 4
        // Same values: return the old object so React skips the re-render.
        return prev.start === start && prev.end === end ? prev : { start, end }
      })
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [children.length])

  const scroll = (direction: 1 | -1) => {
    const element = ref.current
    if (element)
      element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className={cn('group/shelf relative -mx-4 sm:-mx-6 lg:-mx-8', className)}>
      <div
        ref={ref}
        role="list"
        aria-label={label}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:scroll-px-8 lg:px-8"
      >
        {children.map((child, index) => (
          <div role="listitem" key={index} className={cn('shrink-0 snap-start', itemClassName)}>
            {child}
          </div>
        ))}
      </div>
      {!edges.start ? (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t('common.back')}
          onClick={() => scroll(-1)}
          className="absolute top-[38%] left-2 rounded-full bg-floating opacity-0 shadow-floating transition-opacity group-hover/shelf:opacity-100 max-md:hidden"
        >
          <ChevronLeft />
        </Button>
      ) : null}
      {!edges.end ? (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t('common.more')}
          onClick={() => scroll(1)}
          className="absolute top-[38%] right-2 rounded-full bg-floating opacity-0 shadow-floating transition-opacity group-hover/shelf:opacity-100 max-md:hidden"
        >
          <ChevronRight />
        </Button>
      ) : null}
    </div>
  )
}

export function AddedCheck() {
  return <Check className="size-3.5" />
}
