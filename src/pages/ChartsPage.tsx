import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, Layers3, RefreshCw } from 'lucide-react'
import ChartCard from './ChartCard'
import { orderDiscovery } from '../lib/discovery'
import { useCatalogDetails } from '../lib/useCatalogDetails'
import { useOnlineCatalog } from '../lib/useOnlineCatalog'
import { useLibraryStore } from '../store/useLibraryStore'
import { defaultPreferences } from '../lib/platforms'
import { mediaMeta } from '../lib/presentation'
import type { CatalogActions } from '../lib/navigation'
import type { DiscoveryOrder, MediaFilter, MediaItem } from '../lib/types'
import './charts.css'

const categories = ['all', 'game', 'movie', 'series', 'anime'] as const

export default function ChartsPage({
  onOpen,
  onAdd,
  notify,
}: CatalogActions & { onAdd: (item: MediaItem) => void; reducedMotion: boolean }) {
  const entries = useLibraryStore((s) => s.entries)
  const country = useLibraryStore((s) => s.preferences?.country ?? defaultPreferences.country)
  const [params, setParams] = useSearchParams()
  const requestedType = params.get('type')
  const type: MediaFilter = categories.find((value) => value === requestedType) ?? 'all'
  const order: DiscoveryOrder = params.get('order') === 'classics' ? 'classics' : 'popular'
  const [visibleCount, setVisibleCount] = useState(12)
  const [brokenArtwork, setBrokenArtwork] = useState<string[]>([])
  const onArtworkIssue = useCallback((id: string) => {
    setBrokenArtwork((previous) => (previous.includes(id) ? previous : [...previous, id]))
  }, [])
  const online = useOnlineCatalog(true, type, '', country, order)
  const ordered = orderDiscovery(
    online.items.map((item) =>
      brokenArtwork.includes(item.id) ? { ...item, artworkQuality: 'missing' as const } : item,
    ),
    order,
  )
  const withDetails = useCatalogDetails(ordered.slice(0, visibleCount + 8), country)
  const items = ordered.slice(0, visibleCount).map(withDetails)
  const canLoadMore = visibleCount < ordered.length || online.hasMore
  const title = order === 'classics' ? 'Хиты всех времён' : 'Популярно сейчас'

  function changeSelection(nextType: MediaFilter, nextOrder: DiscoveryOrder) {
    const next = new URLSearchParams()
    if (nextType !== 'all') next.set('type', nextType)
    if (nextOrder !== 'popular') next.set('order', nextOrder)
    setParams(next, { replace: true })
    setVisibleCount(12)
  }

  return (
    <div className="charts-page">
      <header className="charts-intro">
        <div>
          <h1>
            Чарты<span aria-hidden="true">.</span>
          </h1>
          <p className="charts-description">Что смотреть. Во что играть.</p>
        </div>
        <Link className="charts-search-link" to="/search" aria-label="Искать по названию">
          <span className="charts-search-desktop">Искать по названию</span>
          <span className="charts-search-mobile">Поиск</span>
          <ArrowUpRight size={18} />
        </Link>
      </header>

      <section
        className="charts-catalog"
        id="catalog"
        aria-label="Чарты MediaShelf"
        aria-busy={online.loading}
      >
        <div className="charts-categories" role="group" aria-label="Категории чартов">
          {categories.map((value) => {
            const Icon = value === 'all' ? Layers3 : mediaMeta[value].icon
            const label = value === 'all' ? 'Все категории' : mediaMeta[value].label
            return (
              <button
                key={value}
                aria-label={label}
                aria-pressed={type === value}
                onClick={() => changeSelection(value, order)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{value === 'all' ? 'Всё' : label}</span>
              </button>
            )
          })}
        </div>

        <div className="charts-list-heading">
          <div>
            <h2>{type === 'all' ? 'Все истории' : mediaMeta[type].label}</h2>
          </div>
          <div className="charts-order" role="group" aria-label="Порядок каталога">
            <button
              aria-pressed={order === 'popular'}
              onClick={() => changeSelection(type, 'popular')}
            >
              Популярно сейчас
            </button>
            <button
              aria-pressed={order === 'classics'}
              onClick={() => changeSelection(type, 'classics')}
            >
              Хиты всех времён
            </button>
          </div>
        </div>

        <p className="sr-only" role="status">
          {online.loading
            ? 'Загружаем чарты…'
            : `${title}. Загружено произведений: ${ordered.length}`}
        </p>
        {online.loading && !items.length ? (
          <div className="charts-grid charts-skeleton" role="status" aria-label="Загрузка чартов">
            {Array.from({ length: 12 }, (_, index) => (
              <div className="chart-skeleton" key={index} aria-hidden="true">
                <span />
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : items.length ? (
          <div className="charts-grid">
            {items.map((item, index) => (
              <ChartCard
                key={item.id}
                item={item}
                entry={entries[item.id]}
                position={index + 1}
                onOpen={onOpen}
                onAdd={onAdd}
                notify={notify}
                onArtworkIssue={onArtworkIssue}
              />
            ))}
          </div>
        ) : (
          <div className="charts-empty">
            <Layers3 size={28} aria-hidden="true" />
            <h3>{online.error ? 'Не удалось загрузить чарты' : 'В этой подборке пока пусто'}</h3>
            <p>{online.error || 'Попробуй другую категорию или найди произведение по названию.'}</p>
            {online.error ? (
              <button className="button button-outline" onClick={online.retry}>
                <RefreshCw size={16} />
                Повторить
              </button>
            ) : (
              <Link className="button button-outline" to="/search">
                Перейти к поиску <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        )}

        {items.length > 0 && (
          <div className="charts-list-footer">
            <span>
              Показано {items.length} из {ordered.length} загруженных
            </span>
            {canLoadMore && (
              <button
                className="button button-outline"
                disabled={online.loading}
                onClick={() => {
                  if (visibleCount >= ordered.length) online.loadMore()
                  setVisibleCount((count) => count + 16)
                }}
              >
                {online.loading ? 'Загружаем…' : 'Ещё истории'}
                <ArrowDown size={16} />
              </button>
            )}
          </div>
        )}

        {items.length > 0 &&
          (online.error || online.sources.some((source) => source.status === 'unavailable')) && (
            <div className="catalog-retry" role="status">
              <span>Часть источников временно недоступна.</span>
              <button onClick={online.retry}>Повторить подключение</button>
            </div>
          )}
        <details className="charts-method">
          <summary>Как составлены чарты?</summary>
          <p>
            Это подборка MediaShelf из подключённых каталогов. Номер обозначает место в текущей
            подборке, а не единый мировой рейтинг. Порядок учитывает данные источников и
            разнообразие произведений; «Хиты всех времён» также использует редакционную подборку.
          </p>
          <p>
            IMDb — оценка из 10. Steam — доля положительных отзывов. Личные оценки и прогресс
            доступны на твоей полке.
          </p>
        </details>
      </section>

      <section className="charts-directions" aria-labelledby="charts-directions-title">
        <div className="charts-directions-heading">
          <p className="charts-eyebrow">За пределами чартов</p>
          <h2 id="charts-directions-title">Под настроение</h2>
        </div>
        <div className="charts-direction-links">
          {[
            {
              title: 'Большие миры',
              text: 'Ролевые игры и приключения',
              to: '/search?type=game&genre=Ролевые+игры',
            },
            { title: 'После титров', text: 'Кино на сегодняшний вечер', to: '/search?type=movie' },
            {
              title: 'Ещё одну серию',
              text: 'Сериалы, в которые хочется погрузиться',
              to: '/search?type=series&genre=Драма',
            },
          ].map((direction) => (
            <Link to={direction.to} key={direction.title}>
              <span>
                <strong>{direction.title}</strong>
                <small>{direction.text}</small>
              </span>
              <ArrowUpRight size={22} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
