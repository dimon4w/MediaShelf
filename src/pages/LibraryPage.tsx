import { Columns3, Heart, LayoutGrid, LibraryBig, List, Search, SearchX, X } from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { STATUS_ORDER } from '@shared/status.ts'
import { KINDS, type Kind, type LibraryEntry, type Status } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { StatusIcon } from '@/components/StatusIcon'
import { TitleCard, TitleCardSkeleton, TitleGrid } from '@/components/TitleCard'
import { Button } from '@/components/ui/button'
import { Chip, EmptyState, Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { useDocumentTitle } from '@/lib/hooks'
import { useLibrary } from '@/lib/queries'
import { compareNames, entryProgressText, statusLabelKey } from '@/lib/titles'
import { ListView } from './library/ListView'

const Board = lazy(() => import('./library/Board').then((module) => ({ default: module.Board })))

type View = 'grid' | 'list' | 'board'
type Sort = 'updated' | 'added' | 'title' | 'rating' | 'year' | 'progress'
type StatusFilter = Status | 'all' | 'favorites'

const VIEWS: View[] = ['grid', 'list', 'board']
const SORTS: Sort[] = ['updated', 'added', 'title', 'rating', 'year', 'progress']

function normalise(value: string) {
  return value.toLocaleLowerCase().replaceAll('ё', 'е')
}

export default function LibraryPage() {
  const { t, locale } = useI18n()
  const [params, setParams] = useSearchParams()
  const library = useLibrary()
  useDocumentTitle(t('library.title'))

  const view: View = VIEWS.includes(params.get('view') as View)
    ? (params.get('view') as View)
    : 'grid'
  const kind: Kind | 'all' = KINDS.includes(params.get('kind') as Kind)
    ? (params.get('kind') as Kind)
    : 'all'
  const statusParam = params.get('status')
  const status: StatusFilter =
    statusParam === 'favorites' || STATUS_ORDER.includes(statusParam as Status)
      ? (statusParam as StatusFilter)
      : 'all'
  const sort: Sort = SORTS.includes(params.get('sort') as Sort)
    ? (params.get('sort') as Sort)
    : 'updated'
  const q = params.get('q') ?? ''

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  const entries = useMemo(() => library.data ?? [], [library.data])
  const query = normalise(q.trim())
  const searched = useMemo(
    () =>
      query
        ? entries.filter((entry) =>
            Object.values(entry.title.names).some(
              (name) => name && normalise(name).includes(query),
            ),
          )
        : entries,
    [entries, query],
  )
  const byKind = useMemo(
    () => (kind === 'all' ? searched : searched.filter((entry) => entry.kind === kind)),
    [searched, kind],
  )
  const kindCounts = useMemo(() => {
    const counts = { all: searched.length } as Record<Kind | 'all', number>
    for (const value of KINDS)
      counts[value] = searched.filter((entry) => entry.kind === value).length
    return counts
  }, [searched])
  const statusCounts = useMemo(() => {
    const counts = {
      all: byKind.length,
      favorites: byKind.filter((entry) => entry.favorite).length,
    } as Record<StatusFilter, number>
    for (const value of STATUS_ORDER)
      counts[value] = byKind.filter((entry) => entry.status === value).length
    return counts
  }, [byKind])

  const visible = useMemo(() => {
    let result: LibraryEntry[] =
      status === 'all'
        ? byKind
        : status === 'favorites'
          ? byKind.filter((e) => e.favorite)
          : byKind.filter((e) => e.status === status)
    const by: Record<Sort, (a: LibraryEntry, b: LibraryEntry) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      added: (a, b) => b.addedAt.localeCompare(a.addedAt),
      title: (a, b) => compareNames(a.title, b.title, locale),
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.updatedAt.localeCompare(a.updatedAt),
      year: (a, b) => (b.title.year ?? 0) - (a.title.year ?? 0),
      progress: (a, b) => b.progress - a.progress,
    }
    result = [...result].sort(by[sort])
    return result
  }, [byKind, status, sort, locale])

  const filtersActive = Boolean(query) || kind !== 'all' || status !== 'all'

  const header = (
    <PageHeader
      title={t('library.title')}
      actions={
        entries.length ? (
          <Segmented<View>
            size="sm"
            aria-label={t('library.title')}
            value={view}
            onChange={(value) => update({ view: value === 'grid' ? null : value })}
            iconOnlyOnMobile
            options={[
              { value: 'grid', label: t('library.viewGrid'), icon: <LayoutGrid /> },
              { value: 'list', label: t('library.viewList'), icon: <List /> },
              { value: 'board', label: t('library.viewBoard'), icon: <Columns3 /> },
            ]}
          />
        ) : null
      }
    />
  )

  if (library.isLoading)
    return (
      <>
        {header}
        <PageBody className="pt-4">
          <Skeleton className="h-9 w-72" />
          <TitleGrid className="mt-8">
            {Array.from({ length: 12 }, (_, index) => (
              <TitleCardSkeleton key={index} />
            ))}
          </TitleGrid>
        </PageBody>
      </>
    )

  // A failed background refetch keeps showing the cached library.
  if (library.isError && !library.data)
    return (
      <>
        {header}
        <EmptyState
          className="py-28"
          icon={<LibraryBig />}
          title={t('errors.generic')}
          action={<Button onClick={() => void library.refetch()}>{t('common.retry')}</Button>}
        />
      </>
    )

  if (!entries.length)
    return (
      <>
        {header}
        <EmptyState
          className="py-28"
          icon={<LibraryBig />}
          title={t('library.empty')}
          text={t('library.emptyText')}
          action={
            <Button asChild variant="primary">
              <Link to="/discover">{t('library.emptyAction')}</Link>
            </Button>
          }
        />
      </>
    )

  return (
    <>
      {header}
      <PageBody className="pt-2 md:pt-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" />
              <input
                type="search"
                value={q}
                onChange={(event) => update({ q: event.target.value || null })}
                placeholder={t('library.searchPlaceholder')}
                aria-label={t('library.searchPlaceholder')}
                className="h-9 w-full rounded-lg bg-raised pr-8 pl-9 text-base ring-1 ring-line outline-none ring-inset placeholder:text-fg-3 focus:shadow-[0_0_0_4px_var(--active)] focus:ring-line-strong [&::-webkit-search-cancel-button]:hidden"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => update({ q: null })}
                  aria-label={t('common.clear')}
                  className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {(['all', ...KINDS] as const).map((value) => (
                <Chip
                  key={value}
                  active={kind === value}
                  onClick={() => update({ kind: value === 'all' ? null : value })}
                >
                  {t(`kinds.${value}`)}
                  <span className="tabular opacity-60">{kindCounts[value]}</span>
                </Chip>
              ))}
            </div>
            {view !== 'board' ? (
              <Select<Sort>
                size="sm"
                aria-label={t('library.sort')}
                value={sort}
                onValueChange={(value) => update({ sort: value === 'updated' ? null : value })}
                className="ml-auto max-sm:ml-0"
                options={SORTS.map((value) => ({
                  value,
                  label: t(`library.sort${value[0].toUpperCase()}${value.slice(1)}` as never),
                }))}
              />
            ) : null}
          </div>
          {view !== 'board' ? (
            <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
              {(['all', ...STATUS_ORDER, 'favorites'] as StatusFilter[]).map((value) => {
                const active = status === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ status: value === 'all' ? null : value })}
                    aria-pressed={active}
                    className={`relative -mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors ${
                      active ? 'border-fg text-fg' : 'border-transparent text-fg-3 hover:text-fg'
                    }`}
                  >
                    {value === 'favorites' ? (
                      <Heart className="size-3.5" />
                    ) : value !== 'all' ? (
                      <StatusIcon status={value} className="size-3.5" />
                    ) : null}
                    {value === 'all'
                      ? t('common.all')
                      : value === 'favorites'
                        ? t('library.favorites')
                        : t(`status.${value}`)}
                    <span className="tabular text-xs text-fg-3">{statusCounts[value]}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          {view === 'board' ? (
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
              <Board entries={byKind} />
            </Suspense>
          ) : !visible.length ? (
            <EmptyState
              icon={<SearchX />}
              title={t('library.noMatches')}
              action={
                filtersActive ? (
                  <Button
                    variant="secondary"
                    onClick={() => update({ q: null, kind: null, status: null })}
                  >
                    {t('library.clearFilters')}
                  </Button>
                ) : null
              }
            />
          ) : view === 'list' ? (
            <ListView entries={visible} />
          ) : (
            <TitleGrid>
              {visible.map((entry, index) => {
                const progress = entryProgressText(entry, t)
                return (
                  <TitleCard
                    key={entry.titleId}
                    title={entry.title}
                    entry={entry}
                    eager={index < 12}
                    meta={
                      <>
                        <span className="truncate">
                          {t(statusLabelKey(entry.kind, entry.status))}
                        </span>
                        {progress ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular">{progress}</span>
                          </>
                        ) : null}
                        {entry.rating ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular">★ {entry.rating}</span>
                          </>
                        ) : null}
                      </>
                    }
                  />
                )
              })}
            </TitleGrid>
          )}
        </div>
      </PageBody>
    </>
  )
}
