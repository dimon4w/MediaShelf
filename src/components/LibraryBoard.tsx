import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { GripVertical, Heart } from 'lucide-react'
import { mediaMeta, progressLabel, statusMeta } from '../lib/presentation'
import type { LibraryEntry, LibraryStatus, MediaItem } from '../lib/types'
import { useLibraryStore } from '../store/useLibraryStore'
import { StatusMenu } from './MediaCard'
import Poster from './Poster'
import { entryStatuses } from '../lib/platforms'

interface BoardProps {
  items: MediaItem[]
  entries: Record<string, LibraryEntry>
  onOpen: (item: MediaItem) => void
  onRemove: (item: MediaItem) => void
  notify: (message: string) => void
}

function BoardCard({
  item,
  entry,
  onOpen,
  onRemove,
  notify,
  status,
}: Omit<BoardProps, 'items' | 'entries'> & {
  item: MediaItem
  entry: LibraryEntry
  status: LibraryStatus | 'unassigned'
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${status}:${item.id}`,
    data: { itemId: item.id, status },
  })
  return (
    <article ref={setNodeRef} className={`board-card ${isDragging ? 'is-dragging' : ''}`}>
      <button
        className="board-drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Переместить: ${item.title}`}
      >
        <GripVertical size={17} />
      </button>
      <button
        className="board-poster-button"
        aria-label={`Подробнее: ${item.title}`}
        onClick={() => onOpen(item)}
      >
        <Poster item={item} />
      </button>
      <div className="board-card-body">
        <span className="board-card-type" style={{ color: mediaMeta[item.type].color }}>
          {mediaMeta[item.type].singular} · {item.year}
        </span>
        <button className="board-card-title" onClick={() => onOpen(item)}>
          {item.title}
        </button>
        <span className="board-card-progress">
          {progressLabel(item, entry)}
          {entry.favorite && <Heart size={11} fill="currentColor" />}
        </span>
      </div>
      <StatusMenu item={item} entry={entry} onRemove={onRemove} notify={notify} compact />
    </article>
  )
}

function BoardColumn({
  status,
  children,
  count,
}: {
  status: LibraryStatus
  children: React.ReactNode
  count: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? 'is-over' : ''}`}
      aria-label={statusMeta[status].label}
    >
      <div className="board-column-heading">
        <span className="status-dot" style={{ background: statusMeta[status].color }} />
        <h3>{statusMeta[status].label}</h3>
        <span className="board-count">{count}</span>
      </div>
      <p className="board-column-description">{statusMeta[status].description}</p>
      <div className="board-column-content">
        {children}
        {count === 0 && (
          <div className="board-empty">
            Перенеси историю сюда
            <br />
            <span>или измени её статус в меню</span>
          </div>
        )}
      </div>
    </section>
  )
}

export default function LibraryBoard({ items, entries, onOpen, onRemove, notify }: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const move = useLibraryStore((state) => state.moveItem)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor),
  )
  const active = items.find((item) => item.id === activeId)
  const boardStatuses: LibraryStatus[] = items.every((i) => i.type === 'movie')
    ? ['planned', 'completed']
    : ['planned', 'active', 'completed']
  function endDrag({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (over && Object.hasOwn(statusMeta, String(over.id))) {
      const status = over.id as LibraryStatus
      const itemId = String(active.data.current?.itemId)
      if (items.find((i) => i.id === itemId)?.type === 'movie' && status === 'active') return
      const previous = active.data.current?.status
      move(itemId, status, undefined, previous === 'unassigned' ? undefined : previous)
      notify(`Перемещено: ${statusMeta[status].label.toLowerCase()}`)
    }
  }
  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.data.current?.itemId))}
      onDragEnd={endDrag}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Нажмите пробел, чтобы взять карточку. Используйте стрелки для перемещения и пробел для отпускания. Escape отменяет перенос. Статус также можно изменить через меню карточки.',
        },
      }}
    >
      {items.some((item) => !entryStatuses(entries[item.id]).length) && (
        <section className="board-unassigned" aria-label="Без отметок">
          <h3>Без отметок</h3>
          <p className="field-help">Выбери статус в меню или перенеси историю в колонку.</p>
          {items
            .filter((item) => !entryStatuses(entries[item.id]).length)
            .map((item) => (
              <BoardCard
                key={item.id}
                item={item}
                entry={entries[item.id]}
                status="unassigned"
                onOpen={onOpen}
                onRemove={onRemove}
                notify={notify}
              />
            ))}
        </section>
      )}
      <div className="library-board">
        {boardStatuses.map((status) => {
          const column = items
            .filter((item) => entryStatuses(entries[item.id]).includes(status))
            .sort((a, b) => entries[a.id].order - entries[b.id].order)
          return (
            <BoardColumn key={status} status={status} count={column.length}>
              {column.map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  entry={entries[item.id]}
                  status={status}
                  onOpen={onOpen}
                  onRemove={onRemove}
                  notify={notify}
                />
              ))}
            </BoardColumn>
          )
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
        {active && (
          <div className="board-drag-overlay">
            <Poster item={active} />
            <strong>{active.title}</strong>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
