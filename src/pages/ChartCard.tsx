import { Check, Heart, Plus } from 'lucide-react'
import PreviewPoster from '../components/PreviewPoster'
import { CardPrice, PublicRatings } from '../components/PublicMetadata'
import { mediaMeta } from '../lib/presentation'
import { useLibraryStore } from '../store/useLibraryStore'
import type { LibraryEntry, MediaItem } from '../lib/types'

export default function ChartCard({
  item,
  entry,
  position,
  onOpen,
  onAdd,
  notify,
  onArtworkIssue,
}: {
  item: MediaItem
  entry?: LibraryEntry
  position: number
  onOpen: (item: MediaItem) => void
  onAdd: (item: MediaItem) => void
  notify: (message: string, error?: boolean) => void
  onArtworkIssue: (id: string) => void
}) {
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)
  return (
    <article className="media-card chart-card">
      <div className="chart-card-top">
        <span className="chart-position" aria-label={`Номер ${position} в подборке`}>
          {String(position).padStart(2, '0')}
        </span>
        <span>{mediaMeta[item.type].singular}</span>
      </div>
      <div className="card-art-wrap">
        <PreviewPoster
          item={item}
          eager={position <= 6}
          onOpen={() => onOpen(item)}
          onUnavailable={() => onArtworkIssue(item.id)}
        />
      </div>
      <h3>
        <button className="card-title" onClick={() => onOpen(item)}>
          {item.title}
        </button>
      </h3>
      <p className="chart-card-meta">
        <span>{item.year ?? 'Без даты'}</span>
        {item.genres[0] && <span>{item.genres[0]}</span>}
      </p>
      <div className="chart-card-ratings">
        {item.ratings?.length ? (
          <PublicRatings item={item} compact showSource />
        ) : (
          <span className="chart-no-rating">Нет оценки источника</span>
        )}
      </div>
      {item.type === 'game' && (
        <div className="chart-card-price">
          <CardPrice item={item} />
        </div>
      )}
      <div className="chart-card-actions">
        <button
          className={`chart-save ${entry ? 'is-saved' : ''}`}
          aria-label={entry ? `На твоей полке: ${item.title}` : `На полку: ${item.title}`}
          onClick={() => (entry ? onOpen(item) : onAdd(item))}
        >
          {entry ? <Check size={16} /> : <Plus size={16} />}
          <span>{entry ? 'На полке' : 'На полку'}</span>
        </button>
        <button
          className="chart-favorite"
          aria-pressed={!!entry?.favorite}
          aria-label={`${entry?.favorite ? 'Убрать из избранного' : 'В избранное'}: ${item.title}`}
          onClick={() => {
            try {
              toggleFavorite(item)
              notify(entry?.favorite ? 'Убрано из избранного' : 'Добавлено в любимые истории')
            } catch (error) {
              notify(error instanceof Error ? error.message : 'Не удалось сохранить историю.', true)
            }
          }}
        >
          <Heart size={17} fill={entry?.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  )
}
