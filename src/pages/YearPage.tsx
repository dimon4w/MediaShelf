import { ChevronLeft, ChevronRight, RotateCcw, Star, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { genreLabel } from '@shared/genres.ts'
import { KINDS } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { KindIcon } from '@/components/StatusIcon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useDocumentTitle } from '@/lib/hooks'
import { useLibrary, useSession, useStats } from '@/lib/queries'
import { titleHref, titleName } from '@/lib/titles'
import { buildYearStory, type YearStory } from './year/story'

function Label({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold tracking-wide text-white/60 uppercase">{children}</p>
}

function Big({ children }: { children: ReactNode }) {
  return (
    <p className="display mt-3 text-[88px] leading-none tabular-nums sm:text-[136px]">{children}</p>
  )
}

/** Builds only the slides that have something true to say about this year. */
function useSlides(story: YearStory | null, name: string, again: () => void) {
  const { t, locale, fmt } = useI18n()
  return useMemo(() => {
    if (!story) return []
    const monthName = (month: string) => {
      const [y, m] = month.split('-').map(Number)
      const text = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(y, m - 1, 1))
      return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
    }
    const slides: { key: string; node: ReactNode }[] = [
      {
        key: 'intro',
        node: (
          <>
            <Label>{t('year.introKicker')}</Label>
            <Big>{story.year}</Big>
            <p className="mt-6 max-w-md text-lg text-white/75">
              {t('year.introText', { name, year: story.year })}
            </p>
          </>
        ),
      },
    ]

    if (!story.completed) {
      slides.push({
        key: 'empty',
        node: (
          <>
            <h2 className="display text-4xl">{t('year.emptyTitle', { year: story.year })}</h2>
            <p className="mt-3 max-w-md text-lg text-white/75">{t('year.emptyText')}</p>
            <Button
              asChild
              variant="primary"
              className="mt-6 bg-white text-black hover:bg-white/90"
            >
              <Link to="/library">{t('year.emptyAction')}</Link>
            </Button>
          </>
        ),
      })
      return slides
    }

    slides.push({
      key: 'completed',
      node: (
        <>
          <Label>{t('year.completedLabel')}</Label>
          <Big>{fmt.number(story.completed)}</Big>
          <p className="mt-2 text-2xl text-white/75">
            {t('year.completedUnit', { count: story.completed })}
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {KINDS.filter((kind) => story.completedByKind[kind]).map((kind) => (
              <li
                key={kind}
                className="flex h-9 items-center gap-2 rounded-full bg-white/10 px-3.5 text-base ring-1 ring-white/15 ring-inset"
              >
                <KindIcon kind={kind} className="size-4" />
                {t(`kinds.${kind}`)}
                <span className="tabular-nums text-white/60">{story.completedByKind[kind]}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    })

    if (story.bestMonth) {
      const best = story.bestMonth
      const max = Math.max(...story.months.map((m) => m.count), 1)
      slides.push({
        key: 'month',
        node: (
          <>
            <Label>{t('year.bestMonthLabel')}</Label>
            <p className="display mt-3 text-6xl sm:text-8xl">{monthName(best.month)}</p>
            <p className="mt-3 text-2xl text-white/75">
              {t('count.titles', { count: best.count })}
            </p>
            <div className="mt-10 flex h-28 items-end gap-1.5" aria-hidden="true">
              {story.months.map((m) => (
                <div key={m.month} className="flex w-6 flex-col items-center gap-1.5 sm:w-8">
                  <div
                    className={
                      m.month === best.month
                        ? 'w-full rounded-sm bg-white'
                        : 'w-full rounded-sm bg-white/25'
                    }
                    style={{ height: `${Math.max(4, (m.count / max) * 96)}px` }}
                  />
                  <span className="text-[10px] text-white/50">
                    {fmt.monthShort(`${m.month}-01`).slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ),
      })
    }

    if (story.top.length) {
      const [first, ...rest] = story.top
      slides.push({
        key: 'top',
        node: (
          <>
            <Label>{t('year.topLabel')}</Label>
            <div className="mt-6 flex items-end gap-5">
              <Link to={titleHref(first.titleId)} className="w-36 shrink-0 sm:w-48">
                <Poster
                  src={first.title.poster}
                  alt=""
                  kind={first.kind}
                  eager
                  sizes="lg"
                  className="shadow-poster"
                />
              </Link>
              <div className="min-w-0 pb-1">
                <p className="text-sm text-white/60">{t('year.topFirst')}</p>
                <p className="display mt-1 text-3xl sm:text-4xl">
                  {titleName(first.title.names, locale)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xl tabular-nums">
                  <Star className="size-5 fill-current" aria-hidden="true" />
                  {first.rating}/10
                </p>
              </div>
            </div>
            {rest.length ? (
              <ol className="mt-6 grid grid-cols-4 gap-3">
                {rest.map((entry) => (
                  <li key={entry.titleId}>
                    <Link
                      to={titleHref(entry.titleId)}
                      aria-label={titleName(entry.title.names, locale)}
                    >
                      <Poster
                        src={entry.title.poster}
                        alt=""
                        kind={entry.kind}
                        sizes="sm"
                        className="shadow-poster"
                      />
                    </Link>
                    <p className="mt-1.5 truncate text-xs text-white/70">
                      {titleName(entry.title.names, locale)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ),
      })
    }

    if (story.genres.length) {
      slides.push({
        key: 'genres',
        node: (
          <>
            <Label>{t('year.genresLabel')}</Label>
            <ol className="mt-6 space-y-3">
              {story.genres.map((item, index) => (
                <li key={item.genre} className="flex items-baseline gap-4">
                  <span className="w-8 text-2xl text-white/40 tabular-nums">{index + 1}</span>
                  <span className={index ? 'display text-4xl text-white/80' : 'display text-6xl'}>
                    {genreLabel(item.genre, locale)}
                  </span>
                  <span className="text-lg text-white/50 tabular-nums">{item.count}</span>
                </li>
              ))}
            </ol>
          </>
        ),
      })
    }

    slides.push({
      key: 'numbers',
      node: (
        <>
          <Label>{t('year.numbersLabel')}</Label>
          <dl className="mt-8 grid gap-8 sm:grid-cols-2">
            {story.averageRating !== null ? (
              <div className="flex flex-col-reverse">
                <dt className="mt-2 text-lg text-white/70">{t('year.averageLabel')}</dt>
                <dd className="display text-7xl tabular-nums">
                  {fmt.number(story.averageRating, { maximumFractionDigits: 1 })}
                  <span className="text-3xl text-white/50">/10</span>
                </dd>
              </div>
            ) : null}
            <div className="flex flex-col-reverse">
              <dt className="mt-2 text-lg text-white/70">{t('year.addedLabel')}</dt>
              <dd className="display text-7xl tabular-nums">{fmt.number(story.added)}</dd>
            </div>
          </dl>
        </>
      ),
    })

    const first = story.top[0]
    slides.push({
      key: 'outro',
      node: (
        <>
          <h2 className="display text-5xl sm:text-7xl">
            {t('year.outroTitle', { year: story.year })}
          </h2>
          <div className="mt-8 flex items-center gap-4 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 ring-inset">
            {first ? (
              <Poster
                src={first.title.poster}
                alt=""
                kind={first.kind}
                sizes="sm"
                className="w-14 shrink-0"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums">
                {t('count.titles', { count: story.completed })}
              </p>
              <p className="truncate text-base text-white/70">
                {[
                  story.genres[0] ? genreLabel(story.genres[0].genre, locale) : null,
                  first ? titleName(first.title.names, locale) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-md text-base text-white/60">{t('year.outroText')}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                again()
              }}
              className="bg-white/10 text-white ring-white/20 hover:bg-white/15"
            >
              <RotateCcw />
              {t('year.again')}
            </Button>
            <Button asChild variant="primary" className="bg-white text-black hover:bg-white/90">
              <Link to="/stats" onClick={(event) => event.stopPropagation()}>
                {t('year.toStats')}
              </Link>
            </Button>
          </div>
        </>
      ),
    })
    return slides
  }, [story, name, again, t, locale, fmt])
}

export default function YearPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user } = useSession()
  const stats = useStats()
  const library = useLibrary()
  const year = new Date().getFullYear()
  useDocumentTitle(t('year.title', { year }))
  const story = useMemo(
    () => (stats.data && library.data ? buildYearStory(year, stats.data, library.data) : null),
    [stats.data, library.data, year],
  )
  const [index, setIndex] = useState(0)
  const again = useCallback(() => setIndex(0), [])
  const slides = useSlides(story, user?.name.split(' ')[0] ?? '', again)
  const total = slides.length
  const close = useCallback(() => navigate('/stats'), [navigate])
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(total - 1, 0))), [total])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, next, prev])

  // Stories pattern: the left third goes back, the rest goes forward. Links and buttons
  // inside a slide stop the click themselves.
  const onTap = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX - rect.left < rect.width / 3) prev()
    else next()
  }

  const slide = slides[Math.min(index, Math.max(total - 1, 0))]
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('year.title', { year })}
      className="dark fixed inset-0 z-[60] flex flex-col bg-black text-white"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {slides.map((s, i) => (
            <div key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-300"
                style={{ width: i <= index ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('year.close')}
          onClick={close}
          className="text-white hover:bg-white/10"
        >
          <X />
        </Button>
      </div>

      <div
        className="relative mx-auto flex w-full max-w-3xl flex-1 cursor-pointer select-none"
        onClick={onTap}
      >
        {!story ? (
          <div className="flex flex-1 flex-col justify-center px-6 sm:px-10">
            <Skeleton className="h-4 w-32 bg-white/10" />
            <Skeleton className="mt-4 h-28 w-72 bg-white/10" />
          </div>
        ) : (
          <section
            key={slide?.key}
            aria-live="polite"
            aria-label={t('year.slide', { n: index + 1, total })}
            className="flex flex-1 animate-rise flex-col justify-center overflow-y-auto px-6 py-8 sm:px-10"
          >
            {slide?.node}
          </section>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pb-6 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={prev}
          disabled={index === 0}
          className="text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft />
          {t('year.prev')}
        </Button>
        <span className="text-sm text-white/50 tabular-nums">
          {total ? `${index + 1} / ${total}` : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={next}
          disabled={index >= total - 1}
          className="text-white hover:bg-white/10 disabled:opacity-30"
        >
          {t('year.next')}
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
