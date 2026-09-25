import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Heart, MoreHorizontal, Plus, Star, Trash2 } from 'lucide-react'
import {
  availableStatuses,
  mediaMeta,
  plural,
  progressLabel,
  statusLabel,
  statusMeta,
} from '../lib/presentation'
import { getProgressMax } from '../lib/library'
import type { LibraryEntry, MediaItem } from '../lib/types'
import { entryStatuses, playthroughLabel } from '../lib/platforms'
import { PublicRatings, CardPrice } from './PublicMetadata'
import { useLibraryStore } from '../store/useLibraryStore'
import PreviewPoster from './PreviewPoster'

export interface MediaCardProps {
  item: MediaItem
  entry?: LibraryEntry
  onOpen: (item: MediaItem) => void
  onRemove: (item: MediaItem) => void
  notify: (message: string, error?: boolean) => void
  index?: number
  wide?: boolean
  onArtworkIssue?: (id: string) => void
}

export function StatusMenu({
  item,
  entry,
  onRemove,
  notify,
  compact = false,
}: Pick<MediaCardProps, 'item' | 'onRemove' | 'notify'> & {
  entry: LibraryEntry
  compact?: boolean
}) {
  const update = useLibraryStore((state) => state.updateEntry)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={compact ? 'icon-button board-menu-button' : 'card-add is-added'}
          aria-label={`Статус: ${item.title}`}
          title="Изменить статус"
        >
          {compact ? <MoreHorizontal size={18} /> : <Check size={19} />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-content"
          sideOffset={8}
          align="end"
          collisionPadding={12}
        >
          <DropdownMenu.Label className="dropdown-label">На твоей полке</DropdownMenu.Label>
          {availableStatuses(item.type).map((status) => (
            <DropdownMenu.Item
              className="dropdown-item"
              key={status}
              onSelect={() => {
                if (item.type === 'game') {
                  const current = entry.playthroughs?.[0]?.statuses ?? entryStatuses(entry)
                  update(item.id, {
                    statuses: current.includes(status)
                      ? current.filter((s) => s !== status)
                      : [...current, status],
                  })
                } else update(item.id, { status })
                notify(`${item.title}: ${statusLabel(item.type, status).toLowerCase()}`)
              }}
            >
              <span className="status-dot" style={{ background: statusMeta[status].color }} />
              {statusLabel(item.type, status)}
              {entryStatuses(entry).includes(status) && <Check size={15} className="ml-auto" />}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="dropdown-separator" />
          <DropdownMenu.Item className="dropdown-item danger-text" onSelect={() => onRemove(item)}>
            <Trash2 size={15} /> Убрать с полки
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export default function MediaCard({
  item,
  entry,
  onOpen,
  onRemove,
  notify,
  index = 0,
  onArtworkIssue,
}: MediaCardProps) {
  const add = useLibraryStore((state) => state.addItem)
  const favorite = useLibraryStore((state) => state.toggleFavorite)
  const meta = mediaMeta[item.type]
  const max = getProgressMax(item)
  return (
    <article className="media-card">
      <div className="card-art-wrap">
        <PreviewPoster
          item={item}
          eager={index < 6}
          onOpen={() => onOpen(item)}
          onUnavailable={onArtworkIssue ? () => onArtworkIssue(item.id) : undefined}
        />
        <button
          className={`card-favorite ${entry?.favorite ? 'is-favorite' : ''}`}
          aria-label={`${entry?.favorite ? 'Убрать из избранного' : 'В избранное'}: ${item.title}`}
          aria-pressed={!!entry?.favorite}
          onClick={() => {
            try {
              favorite(item)
              notify(entry?.favorite ? 'Убрано из избранного' : 'Добавлено в любимые истории')
            } catch (cause) {
              notify(cause instanceof Error ? cause.message : 'Не удалось сохранить историю.', true)
            }
          }}
        >
          <Heart size={16} fill={entry?.favorite ? 'currentColor' : 'none'} />
        </button>
        {entry?.rating && (
          <span className="card-rating">
            <Star size={12} fill="currentColor" />
            {entry.rating}
            <span>/10</span>
          </span>
        )}
        {entry ? (
          <StatusMenu item={item} entry={entry} onRemove={onRemove} notify={notify} />
        ) : (
          <button
            className="card-add"
            aria-label={`На полку: ${item.title}`}
            title="Добавить на полку"
            onClick={() => {
              try {
                add(item)
                notify('История на твоей полке')
              } catch (cause) {
                notify(
                  cause instanceof Error ? cause.message : 'Не удалось сохранить историю.',
                  true,
                )
              }
            }}
          >
            <Plus size={21} />
          </button>
        )}
      </div>
      <button className="card-title" onClick={() => onOpen(item)}>
        {item.title}
      </button>
      <div className="card-meta">
        <span>{meta.singular}</span>
        <span>{item.year ?? 'Без даты'}</span>
        <span className="meta-divider" />
        <span>{item.genres[0]}</span>
      </div>
      {(item.type === 'series' || item.type === 'anime') && item.seasons && (
        <div className="card-meta">
          {item.seasons} {plural(item.seasons, ['сезон', 'сезона', 'сезонов'])}
        </div>
      )}
      <div className="card-key-info">
        {!entry?.rating && <PublicRatings item={item} compact />}
        <CardPrice item={item} />
      </div>
      {entry &&
        (item.type === 'game' ? (
          <div className="card-progress-area">
            {entry.playthroughs?.map((p) => (
              <div className="card-run" key={p.id}>
                <div className="card-progress-label">
                  <span>{playthroughLabel(p)}</span>
                  <span>{p.progress}%</span>
                </div>
                <small>
                  {p.statuses.map((s) => statusLabel('game', s)).join(' · ') || 'Без отметок'}
                </small>
                <div className="progress-track">
                  <span style={{ transform: `scaleX(${p.progress / 100})` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-progress-area">
            <div className="card-progress-label">
              <span style={{ color: statusMeta[entry.status].color }}>
                {statusLabel(item.type, entry.status)}
              </span>
              {item.type !== 'movie' && <span>{progressLabel(item, entry)}</span>}
            </div>
            <div className="progress-track">
              <span
                style={{
                  transform: `scaleX(${max ? entry.progress / max : 0})`,
                  background: statusMeta[entry.status].color,
                }}
              />
            </div>
          </div>
        ))}
    </article>
  )
}
