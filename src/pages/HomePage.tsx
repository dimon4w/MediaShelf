import {
  ArrowRight,
  ArrowUp,
  Compass,
  Dices,
  Layers,
  LibraryBig,
  ListChecks,
  Plus,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { KINDS, type Kind, type LibraryEntry } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { useShell } from '@/app/shell-context'
import { Backdrop, Poster } from '@/components/Poster'
import { Shelf, TitleCard, TitleCardSkeleton } from '@/components/TitleCard'
import { Button } from '@/components/ui/button'
import { Chip, ProgressBar, SectionHeader, Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { ActivityRow } from '@/components/ActivityRow'
import { useErrorMessage } from '@/components/library-actions'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/lib/hooks'
import { useActivity, useCharts, useLibrary, useMarkNext, useSession } from '@/lib/queries'
import { episodeCode, localToday, statusLabelKey, titleHref, titleName } from '@/lib/titles'
import { toast } from 'sonner'

function greetingKey(hour: number) {
  if (hour < 5) return 'home.night' as const
  if (hour < 12) return 'home.morning' as const
  if (hour < 18) return 'home.day' as const
  return 'home.evening' as const
}

function HomeSearch() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (kind !== 'all') params.set('kind', kind)
    navigate(`/discover${params.size ? `?${params}` : ''}`)
  }
  return (
    <form onSubmit={submit} className="mt-7 max-w-2xl">
      <div className="flex items-center gap-2 rounded-xl bg-raised p-1.5 pl-4 ring-1 ring-line ring-inset transition-shadow focus-within:shadow-[0_0_0_4px_var(--active)] focus-within:ring-line-strong">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('home.searchPlaceholder')}
          aria-label={t('nav.search')}
          className="h-10 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-fg-3"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          className="rounded-lg"
          aria-label={t('nav.search')}
        >
          <ArrowUp />
        </Button>
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {(['all', ...KINDS] as const).map((value) => (
          <Chip key={value} active={kind === value} onClick={() => setKind(value)}>
            {t(`kinds.${value}`)}
          </Chip>
        ))}
      </div>
    </form>
  )
}

function ContinueCard({ entry }: { entry: LibraryEntry }) {
  const { t, locale, fmt } = useI18n()
  const markNext = useMarkNext()
  const message = useErrorMessage()
  const name = titleName(entry.title.names, locale)
  const next = entry.nextEpisode
  const today = localToday()
  const canMark =
    (entry.kind === 'series' || entry.kind === 'anime') &&
    next &&
    (!next.airdate || next.airdate <= today)
  const subtitle =
    entry.kind === 'series' || entry.kind === 'anime'
      ? next
        ? [t('episodes.code', episodeCode(next.season, next.number)), next.name]
            .filter(Boolean)
            .join(' · ')
        : t('home.caughtUp')
      : entry.kind === 'game'
        ? t('home.percent', { value: entry.progress })
        : t(statusLabelKey(entry.kind, entry.status))
  return (
    <div className="group/continue relative overflow-hidden rounded-xl bg-raised ring-1 ring-line ring-inset">
      <Link to={titleHref(entry.titleId)} className="block rounded-xl">
        <div className="relative aspect-[16/9] overflow-hidden">
          {entry.title.backdrop ? (
            <Backdrop
              src={entry.title.backdrop}
              className="absolute inset-0 size-full transition-transform duration-500 group-hover/continue:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-active">
              <Poster
                src={entry.title.poster}
                alt=""
                kind={entry.kind}
                className="w-20 shadow-poster"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
            <p className="truncate text-md font-semibold">{name}</p>
            <p className="mt-0.5 truncate text-sm text-white/75">{subtitle}</p>
            <ProgressBar
              value={entry.progress}
              tone="white"
              className="mt-2.5"
              label={fmt.percent(entry.progress)}
            />
          </div>
        </div>
      </Link>
      {canMark ? (
        <Button
          size="xs"
          variant="primary"
          className="absolute top-2.5 right-2.5 bg-white text-black shadow-md hover:bg-white/90"
          loading={markNext.isPending}
          onClick={() =>
            markNext.mutate(entry.titleId, {
              onSuccess: ({ statusChanged }) =>
                toast(
                  statusChanged
                    ? t('toast.autoStatus', {
                        status: t(statusLabelKey(entry.kind, statusChanged.to)),
                      })
                    : t('toast.episodeMarked'),
                  {
                    description: `${name} · ${t('episodes.code', episodeCode(next!.season, next!.number))}`,
                  },
                ),
              onError: (error) => toast.error(message(error)),
            })
          }
        >
          <Plus />
          {t('home.plusEpisode')}
        </Button>
      ) : null}
    </div>
  )
}

function Trending() {
  const { t } = useI18n()
  const [kind, setKind] = useState<Kind>('movie')
  const charts = useCharts(kind, 'trending')
  const items = charts.data?.pages[0]?.items.slice(0, 20) ?? []
  return (
    <section className="mt-12" aria-labelledby="trending-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="trending-heading" className="text-xl font-semibold tracking-[-0.015em]">
          {t('home.trending')}
        </h2>
        <div className="flex items-center gap-2">
          <Segmented<Kind>
            size="sm"
            aria-label={t('home.trending')}
            value={kind}
            onChange={setKind}
            options={KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
          />
          <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
            <Link to={`/discover?kind=${kind}`}>
              {t('common.seeAll')}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      {charts.isError ? (
        <p className="rounded-lg bg-raised px-4 py-6 text-center text-sm text-fg-2 ring-1 ring-line ring-inset">
          {t('discover.unavailable')}
        </p>
      ) : (
        <Shelf label={t('home.trending')}>
          {charts.isLoading
            ? Array.from({ length: 8 }, (_, index) => <TitleCardSkeleton key={index} />)
            : items.map((title, index) => (
                <TitleCard key={title.id} title={title} eager={index < 6} />
              ))}
        </Shelf>
      )}
    </section>
  )
}

function Dashboard({ name }: { name: string }) {
  const { t } = useI18n()
  const library = useLibrary()
  const activity = useActivity(8)
  const entries = useMemo(() => library.data ?? [], [library.data])
  const active = entries.filter((entry) => entry.status === 'in_progress')
  const planned = entries.filter((entry) => entry.status === 'planned').slice(0, 20)
  const completed = entries.filter((entry) => entry.status === 'completed').length
  const hour = new Date().getHours()
  const failed = library.isError && !library.data

  return (
    <>
      <section className="pt-6 md:pt-12">
        <h1 className="display text-3xl sm:text-4xl">
          {t(greetingKey(hour), { name: name.split(' ')[0] })}
        </h1>
        <p className="mt-2 text-md text-fg-2">
          {library.isLoading ? (
            <Skeleton className="h-5 w-72" />
          ) : failed ? (
            <>
              {t('home.libraryError')}{' '}
              <button
                type="button"
                onClick={() => void library.refetch()}
                className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
              >
                {t('common.retry')}
              </button>
            </>
          ) : entries.length ? (
            t('home.summary', {
              active: active.length,
              planned: entries.filter((e) => e.status === 'planned').length,
              completed,
            })
          ) : (
            t('home.emptySummary')
          )}
        </p>
        <HomeSearch />
      </section>

      {/* Popular first: the shelf is interesting even with an empty library. */}
      {failed ? null : <Trending />}

      {failed ? null : (
        <section className="mt-12" aria-labelledby="continue-heading">
          <SectionHeader id="continue-heading" title={t('home.continue')} />
          {library.isLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="aspect-[16/9] w-[300px] shrink-0 rounded-xl" />
              ))}
            </div>
          ) : active.length ? (
            <Shelf label={t('home.continue')} itemClassName="w-[280px] sm:w-[340px]">
              {active.map((entry) => (
                <ContinueCard key={entry.titleId} entry={entry} />
              ))}
            </Shelf>
          ) : (
            <p className="rounded-xl bg-raised px-5 py-8 text-center text-base text-fg-2 ring-1 ring-line ring-inset">
              {t('home.continueEmpty')}
            </p>
          )}
        </section>
      )}

      {failed ? null : planned.length ? (
        <section className="mt-12" aria-labelledby="planned-heading">
          <SectionHeader
            id="planned-heading"
            title={t('home.planned')}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/library?status=planned">
                  {t('common.seeAll')}
                  <ArrowRight />
                </Link>
              </Button>
            }
          />
          <Shelf label={t('home.planned')}>
            {planned.map((entry) => (
              <TitleCard key={entry.titleId} title={entry.title} entry={entry} showKind />
            ))}
          </Shelf>
        </section>
      ) : null}

      {failed || library.isLoading || entries.length ? null : (
        <section className="mt-12 rounded-xl bg-raised p-8 text-center ring-1 ring-line ring-inset sm:p-10">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-panel text-fg-2 ring-1 ring-line ring-inset">
            <LibraryBig className="size-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            {t('home.emptyLibraryTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-base text-fg-2">{t('home.emptyLibraryText')}</p>
          <Button asChild variant="primary" className="mt-5">
            <Link to="/discover">
              <Compass />
              {t('home.emptyLibraryAction')}
            </Link>
          </Button>
        </section>
      )}

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_360px]">
        {activity.data?.length ? (
          <section aria-labelledby="activity-heading">
            <SectionHeader
              id="activity-heading"
              title={t('home.activity')}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/stats">
                    {t('nav.stats')}
                    <ArrowRight />
                  </Link>
                </Button>
              }
            />
            <ul className="-mx-2 grid">
              {activity.data.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ) : null}
        <aside className="relative self-start overflow-hidden rounded-xl bg-raised p-6 ring-1 ring-line ring-inset">
          <Dices className="size-6 text-fg-2" />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">{t('home.shuffleTitle')}</h2>
          <p className="mt-1.5 text-base text-fg-2">{t('home.shuffleText')}</p>
          <Button asChild variant="primary" className="mt-5">
            <Link to="/shuffle">
              <Dices />
              {t('home.shuffleAction')}
            </Link>
          </Button>
        </aside>
      </div>
    </>
  )
}

function PosterWall() {
  const movies = useCharts('movie', 'trending')
  const games = useCharts('game', 'trending')
  const anime = useCharts('anime', 'trending')
  const posters = useMemo(() => {
    const lists = [movies, games, anime].map((query) =>
      (query.data?.pages[0]?.items ?? []).filter((item) => item.poster),
    )
    const mixed = []
    for (let index = 0; index < 8; index++)
      for (const list of lists) if (list[index]) mixed.push(list[index])
    return mixed.slice(0, 14)
  }, [movies, games, anime])
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative mt-14 h-[240px] overflow-hidden sm:h-[320px]"
    >
      <div className="absolute inset-x-0 top-0 flex gap-3 sm:gap-4">
        {(posters.length ? posters : Array.from({ length: 10 }, () => null)).map((title, index) => (
          <div
            key={title?.id ?? index}
            className={cn('w-[120px] shrink-0 sm:w-[170px]', index % 2 ? 'translate-y-10' : '')}
            style={{ animation: `rise 0.8s ${index * 60}ms var(--ease-out) both` }}
          >
            {title ? (
              <Poster src={title.poster} alt="" kind={title.kind} eager className="shadow-poster" />
            ) : (
              <Skeleton className="aspect-[2/3] rounded-md" />
            )}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-panel to-95%" />
    </div>
  )
}

function Welcome() {
  const { t } = useI18n()
  const { openPalette } = useShell()
  const features = [
    {
      icon: ListChecks,
      title: t('home.featureEpisodesTitle'),
      text: t('home.featureEpisodesText'),
    },
    {
      icon: Layers,
      title: t('home.featurePlaythroughsTitle'),
      text: t('home.featurePlaythroughsText'),
    },
    { icon: Dices, title: t('home.featureShuffleTitle'), text: t('home.featureShuffleText') },
  ]
  return (
    <>
      <section className="pt-10 text-center md:pt-20">
        <h1 className="display mx-auto max-w-3xl text-[34px] leading-[40px] sm:text-5xl sm:leading-[60px]">
          {t('home.guestTitle')}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-fg-2">{t('home.guestText')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button asChild variant="primary" size="lg">
            <Link to="/register">{t('nav.signUp')}</Link>
          </Button>
          <Button variant="secondary" size="lg" onClick={() => openPalette('search')}>
            {t('nav.search')}
          </Button>
        </div>
        <p className="mt-4 text-sm text-fg-3">{t('home.privateNote')}</p>
      </section>
      <PosterWall />
      <section className="relative -mt-10 grid gap-3 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="relative rounded-xl bg-raised p-5 ring-1 ring-line ring-inset"
          >
            <feature.icon className="size-5 text-fg-2" />
            <h2 className="mt-3 text-lg font-semibold tracking-tight">{feature.title}</h2>
            <p className="mt-1 text-base text-fg-2">{feature.text}</p>
          </div>
        ))}
      </section>
      <Trending />
    </>
  )
}

export default function HomePage() {
  const { t } = useI18n()
  const { user, isLoading } = useSession()
  useDocumentTitle(null)
  return (
    <>
      <PageHeader title={t('home.title')} revealTitle />
      <PageBody>{isLoading ? null : user ? <Dashboard name={user.name} /> : <Welcome />}</PageBody>
    </>
  )
}
