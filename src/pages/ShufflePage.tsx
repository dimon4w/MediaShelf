import { Dices, ExternalLink, Play, Plus, RotateCw } from 'lucide-react'
import { useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { KINDS, type Kind, type Status, type TitleRecord } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { useLibraryActions } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { Chip, Kbd } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useDocumentTitle, useHotkey } from '@/lib/hooks'
import { useCharts, useLibrary, useLibraryMap, useUser } from '@/lib/queries'
import {
  formatRating,
  genreList,
  ratingSourceLabel,
  statusLabelKey,
  titleHref,
  titleName,
  yearRange,
} from '@/lib/titles'
import { buildStrip } from './shuffle-reel'

type Source = 'library' | 'catalog'
const LIBRARY_STATUSES: Status[] = ['planned', 'paused', 'in_progress']
const HISTORY_KEY = 'mediashelf:shuffle-history'
const WINNER_INDEX = 32

interface HistoryItem {
  id: string
  kind: Kind
  names: TitleRecord['names']
  poster: string | null
}

function readHistory(): HistoryItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.slice(0, 8) : []
  } catch {
    return []
  }
}

function useCatalogPool(kinds: Kind[], enabled: boolean) {
  const game = useCharts('game', 'trending', enabled && kinds.includes('game'))
  const movie = useCharts('movie', 'trending', enabled && kinds.includes('movie'))
  const series = useCharts('series', 'trending', enabled && kinds.includes('series'))
  const anime = useCharts('anime', 'trending', enabled && kinds.includes('anime'))
  const queries = { game, movie, series, anime }
  const loading = kinds.some((kind) => queries[kind].isLoading)
  const items = kinds.flatMap((kind) => queries[kind].data?.pages[0]?.items ?? [])
  return { items, loading }
}

const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

export default function ShufflePage() {
  const { t, locale, fmt } = useI18n()
  const user = useUser()
  const library = useLibrary()
  const libraryMap = useLibraryMap()
  const actions = useLibraryActions()
  const reduceMotion = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const viewport = useRef<HTMLDivElement>(null)
  useDocumentTitle(t('shuffle.title'))

  const hasLibrary = Boolean(user && library.data?.length)
  const [sourceChoice, setSource] = useState<Source | null>(null)
  const source: Source = sourceChoice ?? (hasLibrary ? 'library' : 'catalog')
  const [kinds, setKinds] = useState<Kind[]>([...KINDS])
  const [statuses, setStatuses] = useState<Status[]>(['planned'])
  const [reel, setReel] = useState<TitleRecord[]>([])
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<TitleRecord | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(readHistory)

  const catalog = useCatalogPool(kinds, source === 'catalog')
  const pool = useMemo(() => {
    if (source === 'catalog') {
      const seen = new Set<string>()
      return catalog.items.filter((item) => !seen.has(item.id) && seen.add(item.id))
    }
    return (library.data ?? [])
      .filter((entry) => kinds.includes(entry.kind) && statuses.includes(entry.status))
      .map((entry) => entry.title)
  }, [source, catalog.items, library.data, kinds, statuses])

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const step = () => {
    const first = scope.current?.firstElementChild as HTMLElement | null
    if (!first) return 172
    const gap = parseFloat(getComputedStyle(scope.current!).columnGap || '16') || 16
    return first.offsetWidth + gap
  }

  const roll = async () => {
    if (rolling || !pool.length) return
    const candidates =
      pool.length > 1 && result ? pool.filter((item) => item.id !== result.id) : pool
    const winner = pickRandom(candidates)
    const strip = buildStrip(pool, winner, WINNER_INDEX + 6, WINNER_INDEX)
    setResult(null)
    setReel(strip)
    setRolling(true)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const width = viewport.current?.clientWidth ?? 0
    const itemWidth = (scope.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 156
    const target = -(WINNER_INDEX * step()) + width / 2 - itemWidth / 2
    if (reduceMotion) {
      await animate(scope.current, { x: target }, { duration: 0 })
    } else {
      await animate(
        scope.current,
        { x: [width / 2 - itemWidth / 2, target] },
        { duration: 2.6, ease: [0.12, 0.72, 0.12, 1] },
      )
    }
    setRolling(false)
    setResult(winner)
    const item: HistoryItem = {
      id: winner.id,
      kind: winner.kind,
      names: winner.names,
      poster: winner.poster,
    }
    setHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== winner.id)].slice(0, 8)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useHotkey(' ', (event) => {
    // Space keeps its native meaning on focused controls.
    if (event.target instanceof Element && event.target.closest('button, a, [role], summary'))
      return
    event.preventDefault()
    void roll()
  })

  // Re-centre the landed reel when the viewport changes size.
  useEffect(() => {
    const element = viewport.current
    if (!element || !reel.length) return
    const observer = new ResizeObserver(() => {
      if (rolling || !scope.current) return
      const itemWidth = (scope.current.firstElementChild as HTMLElement | null)?.offsetWidth ?? 156
      scope.current.style.transform = `translateX(${-(WINNER_INDEX * step()) + element.clientWidth / 2 - itemWidth / 2}px)`
    })
    observer.observe(element)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel, rolling])

  const entry = result ? libraryMap.get(result.id) : undefined
  const idle = !reel.length
  const preview = idle ? pool.slice(0, 7) : reel

  // The result card sits below the reel; bring it into view once the reel stops.
  const resultCard = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!result || rolling) return
    resultCard.current?.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [result, rolling, reduceMotion])
  const emptyLibrary = source === 'library' && !hasLibrary

  return (
    <>
      <PageHeader title={t('shuffle.title')} revealTitle />
      <PageBody className="max-w-5xl">
        <div className="pt-6 text-center md:pt-12">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-raised ring-1 ring-line ring-inset">
            <Dices className="size-6" />
          </div>
          <h1 className="display mt-5 text-3xl sm:text-4xl">{t('shuffle.title')}</h1>
          <p className="mt-2 text-md text-fg-2">{t('shuffle.subtitle')}</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 rounded-xl bg-raised p-4 ring-1 ring-line ring-inset sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg-2">{t('shuffle.source')}</span>
            <Segmented<Source>
              size="sm"
              aria-label={t('shuffle.source')}
              value={source}
              onChange={(value) => {
                setSource(value)
                setReel([])
                setResult(null)
              }}
              options={[
                { value: 'library', label: t('shuffle.fromLibrary') },
                { value: 'catalog', label: t('shuffle.fromCatalog') },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg-2">{t('shuffle.kinds')}</span>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((kind) => (
                <Chip
                  key={kind}
                  active={kinds.includes(kind)}
                  onClick={() => setKinds((list) => toggle(list, kind))}
                >
                  {t(`kinds.${kind}`)}
                </Chip>
              ))}
            </div>
          </div>
          {source === 'library' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-fg-2">{t('shuffle.statuses')}</span>
              <div className="flex flex-wrap gap-1.5">
                {LIBRARY_STATUSES.map((status) => (
                  <Chip
                    key={status}
                    active={statuses.includes(status)}
                    onClick={() => setStatuses((list) => toggle(list, status))}
                  >
                    <StatusIcon status={status} />
                    {t(`status.${status}`)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div
          ref={viewport}
          className="fade-edges-x relative mt-10 h-[250px] overflow-hidden sm:h-[300px]"
          aria-live="polite"
          aria-busy={rolling}
        >
          <div
            ref={scope}
            className={cn(
              'absolute top-0 left-0 flex gap-4 will-change-transform',
              idle && 'left-1/2 -translate-x-1/2 opacity-40',
            )}
          >
            {preview.map((title, index) => (
              <div key={`${title.id}-${index}`} className="w-[140px] shrink-0 sm:w-[172px]">
                <Poster
                  src={title.poster}
                  alt={idle ? '' : titleName(title.names, locale)}
                  kind={title.kind}
                  eager
                  className="shadow-poster"
                />
              </div>
            ))}
          </div>
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute top-[-6px] left-1/2 aspect-[2/3] w-[152px] -translate-x-1/2 rounded-lg ring-2 ring-fg transition-opacity duration-300 sm:w-[184px]',
              idle || rolling ? 'opacity-30' : 'opacity-100',
            )}
          />
          {idle && !pool.length ? (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <p className="text-lg font-semibold">
                  {emptyLibrary ? t('shuffle.emptyLibrary') : t('shuffle.emptyPool')}
                </p>
                <p className="mt-1 text-base text-fg-2">
                  {emptyLibrary
                    ? user
                      ? t('shuffle.emptyLibraryText')
                      : t('shuffle.loginForLibrary')
                    : t('shuffle.emptyPoolText')}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            className="min-w-56"
            onClick={() => void roll()}
            disabled={!pool.length || rolling || (source === 'catalog' && catalog.loading)}
            data-testid="shuffle-roll"
          >
            {rolling ? <RotateCw className="animate-spin" /> : <Dices />}
            {rolling ? t('shuffle.rolling') : result ? t('shuffle.again') : t('shuffle.roll')}
          </Button>
          <p className="text-xs text-fg-3">
            {t('shuffle.pool', { count: pool.length })}
            <span className="max-md:hidden">
              {' · '}
              <Kbd>{t('shuffle.spaceKey')}</Kbd> {t('shuffle.hint')}
            </span>
          </p>
        </div>

        {result && !rolling ? (
          <section
            ref={resultCard}
            aria-label={titleName(result.names, locale)}
            className="mx-auto mt-8 flex max-w-2xl scroll-mb-6 animate-rise flex-col gap-5 rounded-xl bg-raised p-5 ring-1 ring-line ring-inset sm:flex-row sm:items-center"
          >
            <Poster
              src={result.poster}
              alt=""
              kind={result.kind}
              className="w-24 shrink-0 shadow-poster"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg-3">
                {[
                  t(`kind.${result.kind}`),
                  yearRange(result),
                  ...genreList(result.genres, locale, 2),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {titleName(result.names, locale)}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-fg-2">
                {result.ratings[0] ? (
                  <span className="tabular">
                    {ratingSourceLabel(result.ratings[0].source)}{' '}
                    {formatRating(result.ratings[0], fmt)}
                  </span>
                ) : null}
                {entry ? (
                  <span className="inline-flex items-center gap-1">
                    <StatusIcon status={entry.status} className="size-3.5" />
                    {t(statusLabelKey(entry.kind, entry.status))}
                  </span>
                ) : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {entry && entry.kind !== 'movie' && entry.status !== 'in_progress' ? (
                  <Button variant="primary" onClick={() => actions.setStatus(entry, 'in_progress')}>
                    <Play className="fill-current" />
                    {t('shuffle.start')}
                  </Button>
                ) : null}
                {!entry ? (
                  <Button variant="primary" onClick={() => actions.add(result, 'planned')}>
                    <Plus />
                    {t('shuffle.addPlanned')}
                  </Button>
                ) : null}
                <Button
                  asChild
                  variant={
                    !entry || (entry.kind !== 'movie' && entry.status !== 'in_progress')
                      ? 'secondary'
                      : 'primary'
                  }
                >
                  <Link to={titleHref(result.id)}>
                    <ExternalLink />
                    {t('common.open')}
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {history.length ? (
          <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-3 text-sm font-medium text-fg-3">
              {t('shuffle.history')}
            </h2>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {history.map((item) => (
                <Link
                  key={item.id}
                  to={titleHref(item.id)}
                  className="rounded-md"
                  aria-label={titleName(item.names, locale)}
                >
                  <Poster
                    src={item.poster}
                    alt={titleName(item.names, locale)}
                    kind={item.kind}
                    className="transition-transform duration-200 hover:-translate-y-0.5"
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </PageBody>
    </>
  )
}
