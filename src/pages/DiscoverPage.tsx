import { ArrowRight, Search, SearchX, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CHART_LISTS, KINDS, type ChartList, type Kind, type TitleRecord } from '@shared/types.ts'
import { genreLabel } from '@shared/genres.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { Shelf, TitleCard, TitleCardSkeleton, TitleGrid } from '@/components/TitleCard'
import { Button, Spinner } from '@/components/ui/button'
import { EmptyState, Switch } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { useDebounced, useDocumentTitle } from '@/lib/hooks'
import { useCharts, useLibraryMap, useSearch } from '@/lib/queries'
import { compareNames } from '@/lib/titles'

type Sort = 'popular' | 'rating' | 'newest' | 'title'

const ratingScore = (title: TitleRecord) => {
  const rating = title.ratings[0]
  return rating ? rating.value / rating.max : -1
}

function useFiltered(items: TitleRecord[], genre: string, sort: Sort, hideAdded: boolean) {
  const { locale } = useI18n()
  const library = useLibraryMap()
  return useMemo(() => {
    let result = items
    if (genre) result = result.filter((item) => item.genres.includes(genre))
    if (hideAdded) result = result.filter((item) => !library.has(item.id))
    if (sort === 'rating') result = [...result].sort((a, b) => ratingScore(b) - ratingScore(a))
    if (sort === 'newest') result = [...result].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    if (sort === 'title') result = [...result].sort((a, b) => compareNames(a, b, locale))
    return result
  }, [items, genre, sort, hideAdded, library, locale])
}

function Filters({
  items,
  genre,
  setGenre,
  sort,
  setSort,
  hideAdded,
  setHideAdded,
}: {
  items: TitleRecord[]
  genre: string
  setGenre(value: string): void
  sort: Sort
  setSort(value: Sort): void
  hideAdded: boolean
  setHideAdded(value: boolean): void
}) {
  const { t, locale } = useI18n()
  const genres = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) for (const g of item.genres) counts.set(g, (counts.get(g) ?? 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([g]) => g)
  }, [items])
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        size="sm"
        aria-label={t('discover.genre')}
        value={genre || 'any'}
        onValueChange={(value) => setGenre(value === 'any' ? '' : value)}
        options={[
          { value: 'any', label: t('discover.anyGenre') },
          ...genres.map((g) => ({ value: g, label: genreLabel(g, locale) })),
        ]}
        className="min-w-36"
      />
      <Select
        size="sm"
        aria-label={t('discover.sort')}
        value={sort}
        onValueChange={setSort}
        options={[
          { value: 'popular', label: t('discover.sortPopular') },
          { value: 'rating', label: t('discover.sortRating') },
          { value: 'newest', label: t('discover.sortNewest') },
          { value: 'title', label: t('discover.sortTitle') },
        ]}
      />
      <label className="ml-1 flex items-center gap-2 text-sm text-fg-2">
        <Switch
          checked={hideAdded}
          onCheckedChange={setHideAdded}
          aria-label={t('discover.hideAdded')}
        />
        {t('discover.hideAdded')}
      </label>
    </div>
  )
}

function KindShelf({ kind }: { kind: Kind }) {
  const { t } = useI18n()
  const charts = useCharts(kind, 'trending')
  const items = charts.data?.pages[0]?.items.slice(0, 10) ?? []
  const [, setParams] = useSearchParams()
  return (
    <section className="mt-10 first:mt-6" aria-label={t(`kinds.${kind}`)}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-[-0.015em]">
          {t('discover.popularIn', { kind: t(`kinds.${kind}`) })}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setParams({ kind })}>
          {t('common.seeAll')}
          <ArrowRight />
        </Button>
      </div>
      {charts.isError ? (
        <p className="py-6 text-sm text-fg-3">{t('discover.unavailable')}</p>
      ) : (
        <Shelf label={t(`kinds.${kind}`)} itemClassName="w-[184px] sm:w-[224px]">
          {charts.isLoading
            ? Array.from({ length: 6 }, (_, index) => (
                <TitleCardSkeleton key={index} className="pl-[80px] sm:pl-[100px]" />
              ))
            : items.map((title, index) => (
                <TitleCard key={title.id} title={title} rank={index + 1} eager={index < 4} />
              ))}
        </Shelf>
      )}
    </section>
  )
}

function ChartGrid({ kind, list }: { kind: Kind; list: ChartList }) {
  const { t } = useI18n()
  const charts = useCharts(kind, list)
  const [genre, setGenre] = useState('')
  const [sort, setSort] = useState<Sort>('popular')
  const [hideAdded, setHideAdded] = useState(false)
  const all = useMemo(() => {
    const seen = new Set<string>()
    return (charts.data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((item) => !seen.has(item.id) && seen.add(item.id))
  }, [charts.data])
  const items = useFiltered(all, genre, sort, hideAdded)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = sentinel.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && charts.hasNextPage && !charts.isFetchingNextPage)
          void charts.fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [charts])

  if (charts.isError)
    return (
      <EmptyState
        icon={<WifiOff />}
        title={t('discover.unavailable')}
        text={t('discover.unavailableHint')}
        action={<Button onClick={() => void charts.refetch()}>{t('common.retry')}</Button>}
      />
    )

  return (
    <>
      <div className="mt-5 mb-6">
        <Filters {...{ items: all, genre, setGenre, sort, setSort, hideAdded, setHideAdded }} />
      </div>
      <TitleGrid>
        {charts.isLoading
          ? Array.from({ length: 18 }, (_, index) => <TitleCardSkeleton key={index} />)
          : items.map((title, index) => (
              <TitleCard key={title.id} title={title} eager={index < 12} />
            ))}
      </TitleGrid>
      <div ref={sentinel} className="flex h-20 items-center justify-center text-sm text-fg-3">
        {charts.isFetchingNextPage ? (
          <Spinner />
        ) : !charts.hasNextPage && all.length ? (
          t('discover.end')
        ) : null}
      </div>
    </>
  )
}

const SEARCH_SORTS: Sort[] = ['popular', 'rating', 'newest', 'title']

function SearchResults({
  query,
  kind,
  genre,
  setGenre,
  sort,
  setSort,
  hideAdded,
  setHideAdded,
}: {
  query: string
  kind: Kind | 'all'
  genre: string
  setGenre(value: string): void
  sort: Sort
  setSort(value: Sort): void
  hideAdded: boolean
  setHideAdded(value: boolean): void
}) {
  const { t } = useI18n()
  const search = useSearch(query, kind)
  const all = search.data?.items ?? []
  const items = useFiltered(all, genre, sort, hideAdded)

  if (query.trim().length < 2)
    return <p className="mt-10 text-center text-base text-fg-3">{t('discover.typeMore')}</p>
  if (search.isError)
    return (
      <EmptyState
        icon={<WifiOff />}
        title={t('discover.unavailable')}
        text={t('discover.unavailableHint')}
        action={<Button onClick={() => void search.refetch()}>{t('common.retry')}</Button>}
      />
    )
  if (search.isLoading)
    return (
      <TitleGrid className="mt-8">
        {Array.from({ length: 12 }, (_, index) => (
          <TitleCardSkeleton key={index} />
        ))}
      </TitleGrid>
    )
  if (!all.length)
    return (
      <EmptyState
        icon={<SearchX />}
        title={t('discover.noResults', { query })}
        text={t('discover.noResultsHint')}
      />
    )
  return (
    <>
      {search.data?.failed.length ? (
        <p className="mt-5 rounded-lg bg-raised px-3.5 py-2.5 text-sm text-fg-2 ring-1 ring-line ring-inset">
          {t('discover.partial', {
            sources: search.data.failed.map((source) => t(`sources.${source}`)).join(', '),
          })}
        </p>
      ) : null}
      <div className="mt-5 mb-6">
        <Filters {...{ items: all, genre, setGenre, sort, setSort, hideAdded, setHideAdded }} />
      </div>
      <TitleGrid
        className={
          search.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'
        }
      >
        {items.map((title, index) => (
          <TitleCard key={title.id} title={title} showKind={kind === 'all'} eager={index < 12} />
        ))}
      </TitleGrid>
    </>
  )
}

export default function DiscoverPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const kindParam = params.get('kind')
  const kind: Kind | 'all' = KINDS.includes(kindParam as Kind) ? (kindParam as Kind) : 'all'
  const listParam = params.get('list')
  const list: ChartList = CHART_LISTS.includes(listParam as ChartList)
    ? (listParam as ChartList)
    : 'trending'
  const [input, setInput] = useState(params.get('q') ?? '')
  const query = useDebounced(input.trim(), 300)
  useDocumentTitle(t('discover.title'))

  // Keep the URL in sync with the debounced query without adding history entries.
  useEffect(() => {
    const current = params.get('q') ?? ''
    if (current === query) return
    const next = new URLSearchParams(params)
    if (query) next.set('q', query)
    else next.delete('q')
    setParams(next, { replace: true })
  }, [query, params, setParams])

  // Follow external navigation (e.g. the home search box).
  const urlQuery = params.get('q') ?? ''
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    if (urlQuery !== query) setInput(urlQuery)
  }

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  // Search filters live in the URL so Back keeps them and links share them.
  const genre = params.get('genre') ?? ''
  const sortParam = params.get('sort')
  const sort: Sort = SEARCH_SORTS.includes(sortParam as Sort) ? (sortParam as Sort) : 'popular'
  const hideAdded = params.get('hide') === '1'

  return (
    <>
      <PageHeader title={t('discover.title')} />
      <PageBody>
        <div className="pt-2 md:pt-6">
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-3" />
            <input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t('discover.searchPlaceholder')}
              aria-label={t('nav.search')}
              enterKeyHint="search"
              className="h-11 w-full rounded-xl bg-raised pr-10 pl-10 text-lg ring-1 ring-line outline-none ring-inset transition-shadow placeholder:text-fg-3 focus:shadow-[0_0_0_4px_var(--active)] focus:ring-line-strong [&::-webkit-search-cancel-button]:hidden"
            />
            {input ? (
              <button
                type="button"
                onClick={() => setInput('')}
                aria-label={t('common.clear')}
                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Segmented
              aria-label={t('discover.title')}
              value={kind}
              onChange={(value) => update({ kind: value === 'all' ? null : value })}
              options={(['all', ...KINDS] as const).map((value) => ({
                value,
                label: t(`kinds.${value}`),
              }))}
            />
            {!query && kind !== 'all' ? (
              <Segmented
                aria-label={t('discover.sort')}
                value={list}
                onChange={(value) => update({ list: value === 'trending' ? null : value })}
                options={CHART_LISTS.map((value) => ({ value, label: t(`listsShort.${value}`) }))}
              />
            ) : null}
          </div>
        </div>

        {query ? (
          <SearchResults
            query={query}
            kind={kind}
            genre={genre}
            setGenre={(value) => update({ genre: value || null })}
            sort={sort}
            setSort={(value) => update({ sort: value === 'popular' ? null : value })}
            hideAdded={hideAdded}
            setHideAdded={(value) => update({ hide: value ? '1' : null })}
          />
        ) : kind === 'all' ? (
          KINDS.map((value) => <KindShelf key={value} kind={value} />)
        ) : (
          <ChartGrid key={`${kind}-${list}`} kind={kind} list={list} />
        )}
        {!query && kind === 'all' ? (
          <p className="mt-12 text-center text-sm text-fg-3">
            <Link to="/shuffle" className="underline-offset-4 hover:text-fg hover:underline">
              {t('home.shuffleTitle')} {t('home.shuffleAction')} →
            </Link>
          </p>
        ) : null}
      </PageBody>
    </>
  )
}
