import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  Heart,
  LayoutGrid,
  LibraryBig,
  SlidersHorizontal,
  X,
  Columns3,
} from 'lucide-react'
import { catalog } from '../lib/catalog'
import { filterMedia, mediaItemSchema, type CatalogFilters } from '../lib/library'
import { mediaMeta, plural, statusMeta } from '../lib/presentation'
import {
  countries,
  defaultPreferences,
  entryStatuses,
  normalizePlatform,
  platforms,
  preferredOffer,
  stores,
} from '../lib/platforms'
import { orderDiscovery } from '../lib/discovery'
import type { DiscoveryOrder, LibraryStatus, MediaFilter, MediaItem } from '../lib/types'
import { useLibraryStore } from '../store/useLibraryStore'
import { useOnlineCatalog } from '../lib/useOnlineCatalog'
import { useCatalogDetails } from '../lib/useCatalogDetails'
import MediaCard from './MediaCard'
import SearchNavigation from './SearchNavigation'
import ChoiceMenu from './ChoiceMenu'
import { sourceLabels } from '../lib/presentation'
import type { CatalogSource } from '../lib/types'
import type { CatalogActions } from '../lib/navigation'

const LibraryBoard = lazy(() => import('./LibraryBoard'))

export default function CatalogBrowser({
  view,
  onOpen: open,
  onRemove,
  notify,
}: CatalogActions & { view: 'charts' | 'search' | 'library' }) {
  const entries = useLibraryStore((s) => s.entries)
  const customItems = useLibraryStore((s) => s.customItems)
  const preferences = useLibraryStore((s) => s.preferences ?? defaultPreferences)
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const rawType = params.get('type') ?? 'all'
  const type: MediaFilter = ['game', 'movie', 'series', 'anime'].includes(rawType)
    ? (rawType as MediaFilter)
    : 'all'
  const query = view === 'charts' ? '' : (params.get('q') ?? '').slice(0, 120)
  const order: DiscoveryOrder = params.get('order') === 'classics' ? 'classics' : 'popular'
  const onlineView = view !== 'library'
  function updateParams(values: Record<string, string>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }
  const setQuery = (value: string) => updateParams({ q: value })
  const setOrder = (value: DiscoveryOrder) =>
    updateParams({ order: value === 'popular' ? '' : value })
  const deferredQuery = useDeferredValue(query)
  const genre = params.get('genre') ?? ''
  const setGenre = (value: string) => updateParams({ genre: value })
  const sourceFilter = params.get('source') ?? ''
  const setSourceFilter = (value: string) => updateParams({ source: value })
  const yearValue = Number(params.get('year'))
  const year = Number.isInteger(yearValue) && yearValue > 0 ? yearValue : null
  const setYear = (value: number | null) =>
    updateParams({ year: value === null ? '' : String(value) })
  const rawStatus = params.get('status') ?? 'all'
  const status: 'all' | LibraryStatus = Object.hasOwn(statusMeta, rawStatus)
    ? (rawStatus as LibraryStatus)
    : 'all'
  const setStatus = (value: 'all' | LibraryStatus) =>
    updateParams({ status: value === 'all' ? '' : value })
  const favoritesOnly = params.get('favorites') === '1'
  const setFavoritesOnly = (value: boolean) => updateParams({ favorites: value ? '1' : '' })
  const rawSort = params.get('sort') ?? 'curated'
  const sort: CatalogFilters['sort'] = ['title', 'rating', 'year'].includes(rawSort)
    ? (rawSort as CatalogFilters['sort'])
    : 'curated'
  const setSort = (value: CatalogFilters['sort']) =>
    updateParams({ sort: value === 'curated' ? '' : value })
  const platform = params.get('platform') ?? ''
  const setPlatform = (value: string) => updateParams({ platform: value })
  const store = params.get('store') ?? ''
  const setStore = (value: string) => updateParams({ store: value })
  const language = params.get('language') ?? ''
  const setLanguage = (value: string) => updateParams({ language: value })
  const priceValue = Number(params.get('price') ?? 200)
  const maxPrice = Number.isFinite(priceValue) ? Math.max(0, Math.min(200, priceValue)) : 200
  const setMaxPrice = (value: number) => updateParams({ price: value === 200 ? '' : String(value) })
  const discountOnly = params.get('discount') === '1'
  const setDiscountOnly = (value: boolean) => updateParams({ discount: value ? '1' : '' })
  const hideFree = params.get('hideFree') === '1'
  const setHideFree = (value: boolean) => updateParams({ hideFree: value ? '1' : '' })
  const mySystems = params.get('mySystems') === '1'
  const setMySystems = (value: boolean) => updateParams({ mySystems: value ? '1' : '' })
  const ratingValue = Number(params.get('minRating'))
  const minRating = [7, 8, 9].includes(ratingValue) ? ratingValue : 0
  const setMinRating = (value: number) => updateParams({ minRating: value ? String(value) : '' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [layout, setLayout] = useState<'grid' | 'board'>('grid')
  const [visibleCount, setVisibleCount] = useState(12)
  const [recent] = useState<MediaItem[]>(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem('mediashelf-recent') ?? '[]')
      return Array.isArray(data)
        ? data.filter((i) => mediaItemSchema.safeParse(i).success).slice(0, 8)
        : []
    } catch {
      return []
    }
  })
  const searchInput = useRef<HTMLInputElement>(null)
  const [brokenArtwork, setBrokenArtwork] = useState<string[]>([])
  const markBrokenArtwork = useCallback(
    (id: string) =>
      setBrokenArtwork((previous) => (previous.includes(id) ? previous : [...previous, id])),
    [],
  )
  const online = useOnlineCatalog(onlineView, type, deferredQuery, preferences.country, order)
  const allItems = [...new Map([...catalog, ...customItems].map((i) => [i.id, i])).values()]
  const baseItems = view === 'library' ? allItems : online.items
  const detailsNeeded = [
    ...baseItems.slice(0, visibleCount + 8),
    ...(filtersOpen ? baseItems.filter((i) => i.type === 'game').slice(0, 60) : []),
  ]
  const withDetails = useCatalogDetails(detailsNeeded, preferences.country)
  const ordered = onlineView
    ? orderDiscovery(
        baseItems.map((i) =>
          brokenArtwork.includes(i.id) ? { ...i, artworkQuality: 'missing' as const } : i,
        ),
        order,
        deferredQuery,
      )
    : baseItems
  const catalogItems = ordered.map(withDetails)
  const filtered = filterMedia(catalogItems, entries, {
    query: view === 'library' ? deferredQuery : '',
    type,
    genre,
    year,
    status,
    favoritesOnly,
    sort,
    libraryOnly: view === 'library',
  }).filter((item) => {
    if (
      sourceFilter &&
      item.source !== sourceFilter &&
      !Object.hasOwn(item.externalIds ?? {}, sourceFilter) &&
      !item.offers?.some((o) => o.store === sourceFilter)
    )
      return false
    const offer = preferredOffer(item.offers, preferences.country, store)
    const runs = entries[item.id]?.playthroughs ?? []
    if (
      platform &&
      !(view === 'library'
        ? runs.some((p) => p.platform === platform)
        : item.platforms?.some((p) => normalizePlatform(p) === platform))
    )
      return false
    if (
      store &&
      !(view === 'library'
        ? runs.some((p) => p.store === store)
        : item.offers?.some((o) => o.store === store))
    )
      return false
    if (
      mySystems &&
      item.type === 'game' &&
      !item.platforms?.some((p) => preferences.platforms.includes(normalizePlatform(p)))
    )
      return false
    if (language && !item.languages?.includes(language)) return false
    if (
      maxPrice < 200 &&
      (item.type !== 'game' ||
        offer?.price === undefined ||
        offer.currency !== countries[preferences.country].currency ||
        offer.price > maxPrice * 100)
    )
      return false
    if (
      discountOnly &&
      !(offer?.price !== undefined && offer.originalPrice && offer.price < offer.originalPrice)
    )
      return false
    if (hideFree && offer?.price === 0) return false
    if (
      minRating &&
      !item.ratings?.some((r) => (r.source === 'steam' ? r.value / 10 : r.value) >= minRating)
    )
      return false
    return true
  })
  const genres = [
    ...new Set(
      catalogItems
        .flatMap((i) => i.genres)
        .filter((g) => !['Игра', 'Кино', 'Аниме', 'Сериал'].includes(g)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'ru'))
  const languages = [...new Set(catalogItems.flatMap((i) => i.languages ?? []))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  )
  const libraryCount = Object.keys(entries).length
  const filtersCount = [
    genre,
    year,
    status !== 'all',
    favoritesOnly,
    platform,
    store,
    language,
    maxPrice < 200,
    discountOnly,
    hideFree,
    mySystems,
    minRating,
    sourceFilter,
  ].filter(Boolean).length
  const popular = online.items.length ? catalogItems : deferredQuery ? [] : catalog.slice(0, 5)
  function resetFilters(clearQuery = true, nextType?: MediaFilter) {
    updateParams({
      genre: '',
      source: '',
      year: '',
      status: '',
      favorites: '',
      sort: '',
      platform: '',
      store: '',
      language: '',
      price: '',
      discount: '',
      hideFree: '',
      mySystems: '',
      minRating: '',
      ...(clearQuery ? { q: '' } : {}),
      ...(nextType ? { type: nextType === 'all' ? '' : nextType } : {}),
    })
    setVisibleCount(12)
  }
  function scrollCatalog() {
    requestAnimationFrame(() =>
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'instant', block: 'start' }),
    )
  }
  function changeType(next: MediaFilter) {
    resetFilters(false, next)
    scrollCatalog()
  }
  useEffect(() => {
    if (view !== 'search' || !location.state?.focusSearch) return
    const frame = requestAnimationFrame(() => searchInput.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [location.state, view])

  return (
    <>
      {view !== 'charts' && (
        <SearchNavigation
          type={type}
          onType={changeType}
          query={query}
          onQuery={(value) => {
            setQuery(value)
            setVisibleCount(12)
          }}
          items={query && view === 'library' ? filtered : popular}
          recent={recent}
          onOpen={open}
          onSearch={() => {
            setFiltersOpen(true)
            scrollCatalog()
          }}
          onGenre={(value) => {
            setGenre(value)
            setFiltersOpen(true)
            scrollCatalog()
          }}
          loading={onlineView && online.loading}
          inputRef={searchInput}
        />
      )}
      {view === 'library' && (
        <section className="library-intro">
          <div>
            <h1>
              Место для <span>любимого.</span>
            </h1>
            <p>Все впечатления. Каждое прохождение.</p>
          </div>
          <div className="library-summary">
            {(Object.keys(statusMeta) as LibraryStatus[]).map((key) => (
              <button
                key={key}
                aria-pressed={status === key}
                onClick={() => {
                  setStatus(status === key ? 'all' : key)
                  setFiltersOpen(true)
                }}
              >
                <strong>
                  {Object.values(entries).filter((e) => entryStatuses(e).includes(key)).length}
                </strong>
                <span>{statusMeta[key].label}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section
        className="catalog-section"
        id="catalog"
        aria-busy={onlineView && (online.loading || query !== deferredQuery)}
        aria-label={view === 'library' ? 'Моя коллекция' : 'Онлайн-каталог'}
      >
        <div className="catalog-heading-row">
          <div>
            <h2>
              {query
                ? `Поиск: ${query}`
                : type !== 'all'
                  ? mediaMeta[type].label
                  : view === 'library'
                    ? 'На твоей полке'
                    : view === 'charts'
                      ? 'Популярные произведения'
                      : 'Каталог и результаты поиска'}
            </h2>
          </div>
          {view === 'charts' && (
            <div className="segmented discovery-modes" role="group" aria-label="Порядок каталога">
              <button
                aria-pressed={order === 'popular'}
                onClick={() => {
                  setOrder('popular')
                  setVisibleCount(12)
                }}
              >
                Популярно сейчас
              </button>
              <button
                aria-pressed={order === 'classics'}
                onClick={() => {
                  setOrder('classics')
                  setVisibleCount(12)
                }}
              >
                Хиты всех времён
              </button>
            </div>
          )}
        </div>
        <div className="catalog-toolbar">
          <div className="toolbar-start">
            {view === 'charts' ? (
              <ChoiceMenu
                label="Категории"
                value={type}
                options={(['all', ...Object.keys(mediaMeta)] as MediaFilter[]).map((value) => ({
                  value,
                  label: value === 'all' ? 'Все категории' : mediaMeta[value].label,
                }))}
                onChange={changeType}
              />
            ) : (
              <button
                className={`filter-toggle ${filtersOpen ? 'is-active' : ''}`}
                aria-expanded={filtersOpen}
                aria-controls="catalog-filters"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={15} />
                Фильтры
                {filtersCount > 0 && <span className="filter-count">{filtersCount}</span>}
              </button>
            )}
            <span className="sr-only" aria-live="polite">
              {online.loading && onlineView
                ? 'Ищем истории…'
                : `${filtered.length} ${plural(filtered.length, ['история', 'истории', 'историй'])}`}
            </span>
            {filtersCount > 0 && (
              <button className="reset-filters" onClick={() => resetFilters(false)}>
                Сбросить
                <X size={13} />
              </button>
            )}
          </div>
          {view !== 'charts' && (
            <div className="toolbar-end">
              <ChoiceMenu
                label="Сортировка"
                value={sort}
                options={[
                  { value: 'curated', label: 'По популярности' },
                  { value: 'title', label: 'По названию' },
                  { value: 'rating', label: 'По моей оценке' },
                  { value: 'year', label: 'Сначала новые' },
                ]}
                onChange={setSort}
              />
              {view === 'library' && (
                <div className="layout-switch" role="group" aria-label="Вид коллекции">
                  <button
                    aria-label="Сетка"
                    aria-pressed={layout === 'grid'}
                    onClick={() => setLayout('grid')}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    aria-label="Доска по статусам"
                    aria-pressed={layout === 'board'}
                    onClick={() => setLayout('board')}
                  >
                    <Columns3 size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {filtersOpen && (
          <div className="filter-panel storefront-filters" id="catalog-filters">
            <div className="filter-panel-heading">
              <h3>Уточнить выбор</h3>
              <button
                className="icon-button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Закрыть фильтры"
              >
                <X size={18} />
              </button>
            </div>
            <label>
              Источник
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">Все источники</option>
                {(Object.keys(sourceLabels) as CatalogSource[]).map((id) => (
                  <option key={id} value={id}>
                    {sourceLabels[id]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Категория
              <select value={type} onChange={(e) => changeType(e.target.value as MediaFilter)}>
                <option value="all">Все категории</option>
                {Object.entries(mediaMeta).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Жанр
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Любой жанр</option>
                {[...new Set([...genres, ...(genre ? [genre] : [])])].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Год
              <select
                value={year ?? ''}
                onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Любой год</option>
                {[
                  ...new Set(
                    catalogItems.map((i) => i.year).filter((v): v is number => v !== null),
                  ),
                ]
                  .sort((a, b) => b - a)
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
            </label>
            <label>
              Статус
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="all">Любой статус</option>
                {Object.entries(statusMeta)
                  .filter(([key]) => type !== 'movie' || key !== 'active')
                  .map(([key, meta]) => (
                    <option value={key} key={key}>
                      {meta.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Оценки зрителей и игроков
              <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                <option value={0}>Любая оценка</option>
                <option value={7}>IMDb 7+ / Steam 70%+</option>
                <option value={8}>IMDb 8+ / Steam 80%+</option>
                <option value={9}>IMDb 9+ / Steam 90%+</option>
              </select>
            </label>
            <button
              className={`favorite-filter ${favoritesOnly ? 'is-active' : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
            >
              <Heart size={15} />
              Только любимые
            </button>
            {(type === 'all' || type === 'game') && (
              <details className="game-filter-disclosure" open={type === 'game' ? true : undefined}>
                <summary>Платформы, магазины и цена</summary>
                <div className="game-filter-fields">
                  <label>
                    Платформа
                    <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                      <option value="">Все платформы</option>
                      {platforms.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Магазин
                    <select value={store} onChange={(e) => setStore(e.target.value)}>
                      <option value="">Все магазины</option>
                      {Object.entries(stores).map(([id, label]) => (
                        <option value={id} key={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Язык игры
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="">Любой язык</option>
                      {languages.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="price-filter">
                    Цена · {countries[preferences.country].currency}
                    <input
                      type="range"
                      aria-label="Максимальная цена"
                      min={0}
                      max={200}
                      step={5}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                    />
                    <span>
                      {maxPrice === 200
                        ? 'Любая цена'
                        : `До ${maxPrice} ${countries[preferences.country].currency}`}
                    </span>
                  </label>
                  <div className="filter-checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={discountOnly}
                        onChange={(e) => setDiscountOnly(e.target.checked)}
                      />
                      Со скидкой
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={hideFree}
                        onChange={(e) => setHideFree(e.target.checked)}
                      />
                      Скрыть бесплатные
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={mySystems}
                        disabled={!preferences.platforms.length}
                        onChange={(e) => setMySystems(e.target.checked)}
                      />
                      Для моих платформ
                    </label>
                  </div>
                </div>
              </details>
            )}
            <p className="filter-hint">
              Фильтры применяются к загруженным произведениям. Подробности и цены дополняются из
              источников.
            </p>
          </div>
        )}
        {onlineView && filtersOpen && (
          <div className="online-sources" aria-label="Подключение к каталогам">
            <div>
              {online.sources.map((source) => (
                <span
                  key={source.id}
                  className={source.status === 'available' ? 'is-connected' : 'is-unavailable'}
                >
                  <i />
                  {source.id === 'imdb' && order === 'popular' && !query
                    ? 'IMDb / Cinemeta'
                    : source.label}
                </span>
              ))}
            </div>
            <span>{countries[preferences.country].label} · цены магазинов</span>
          </div>
        )}
        {onlineView && online.loading && !online.items.length ? (
          <div
            className="media-grid online-grid skeleton-grid"
            role="status"
            aria-label="Загрузка онлайн-каталога"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div className="skeleton-card" key={i}>
                <div />
                <span />
                <small />
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <div className="catalog-results">
            {view === 'library' && layout === 'board' ? (
              <Suspense fallback={<p role="status">Загружаем доску…</p>}>
                <LibraryBoard
                  items={filtered}
                  entries={entries}
                  onOpen={open}
                  onRemove={onRemove}
                  notify={notify}
                />
              </Suspense>
            ) : (
              <div className={`media-grid ${onlineView ? 'online-grid' : ''}`}>
                {filtered.slice(0, visibleCount).map((item, index) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    entry={entries[item.id]}
                    onOpen={open}
                    onRemove={onRemove}
                    notify={notify}
                    index={index}
                    wide={onlineView}
                    onArtworkIssue={markBrokenArtwork}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <LibraryBig size={32} />
            <h3>
              {online.error && onlineView
                ? 'Источники временно недоступны'
                : view === 'library' && !libraryCount
                  ? 'Первая история ждёт тебя'
                  : 'Пока ничего не нашлось'}
            </h3>
            <p>
              {online.error && onlineView
                ? online.error
                : 'Попробуй изменить фильтры или найти другое название.'}
            </p>
            <button
              className="button button-primary"
              onClick={() => {
                if (view === 'library' && !libraryCount) navigate('/search')
                else if (online.error) online.retry()
                else resetFilters()
              }}
            >
              {online.error
                ? 'Повторить'
                : view === 'library' && !libraryCount
                  ? 'Открыть каталог'
                  : 'Сбросить фильтры'}
            </button>
          </div>
        )}
        <div className="catalog-bottom">
          <span>
            {Math.min(visibleCount, filtered.length)} из {filtered.length} загруженных
          </span>
          {visibleCount < filtered.length || (onlineView && online.hasMore) ? (
            <button
              className="button button-outline"
              disabled={onlineView && online.loading}
              onClick={() => {
                if (visibleCount >= filtered.length && onlineView) online.loadMore()
                setVisibleCount((v) => v + 16)
              }}
            >
              {online.loading ? 'Загружаем…' : 'Ещё истории'}
              <ArrowDown size={15} />
            </button>
          ) : filtered.length > 0 && !online.loading && !online.error ? (
            <span className="catalog-endnote">Все загруженные произведения</span>
          ) : null}
        </div>
        {onlineView &&
          online.items.length > 0 &&
          (online.error || online.sources.some((s) => s.status === 'unavailable')) && (
            <div className="catalog-retry" role="status">
              <span>Часть источников временно недоступна.</span>
              <button onClick={online.retry}>Повторить подключение</button>
            </div>
          )}
      </section>
    </>
  )
}
