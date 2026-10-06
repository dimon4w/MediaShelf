import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { isStatusAllowed, STATUS_ORDER } from '@shared/status.ts'
import type { LibraryEntry, Status } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { useLibraryActions } from '@/components/library-actions'
import { ProgressBar } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { entryProgressText, titleHref, titleName } from '@/lib/titles'
import { positionBetween } from './board-math'

type Columns = Record<Status, string[]>

function buildColumns(entries: LibraryEntry[]): Columns {
  const columns = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, [] as string[]]),
  ) as Columns
  for (const entry of [...entries].sort((a, b) => a.position - b.position))
    columns[entry.status].push(entry.titleId)
  return columns
}

function CardBody({ entry, dragging }: { entry: LibraryEntry; dragging?: boolean }) {
  const { t, locale } = useI18n()
  const progress = entryProgressText(entry, t)
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg bg-panel p-2 ring-1 ring-line ring-inset transition-shadow',
        dragging ? 'rotate-[1.5deg] shadow-floating ring-line-strong' : 'hover:ring-line-strong',
      )}
    >
      <Poster
        src={entry.title.poster}
        alt=""
        kind={entry.kind}
        sizes="sm"
        className="w-10 shrink-0"
        rounded="rounded-sm"
      />
      <div className="min-w-0 flex-1 pr-6">
        <p className="line-clamp-2 text-sm leading-[18px] font-medium">
          {titleName(entry.title.names, locale)}
        </p>
        <p className="mt-0.5 truncate text-xs text-fg-3">
          {t(`kind.${entry.kind}`)}
          {progress ? ` · ${progress}` : ''}
          {entry.rating ? ` · ★ ${entry.rating}` : ''}
        </p>
        {entry.status === 'in_progress' && entry.progress > 0 ? (
          <ProgressBar value={entry.progress} className="mt-1.5 h-[3px]" />
        ) : null}
      </div>
    </div>
  )
}

// A drop ends with a click on the card underneath; swallow it so the page does not navigate.
let lastDragEnd = 0

function SortableCard({ entry }: { entry: LibraryEntry }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.titleId })
  const { t, locale } = useI18n()
  // Pointer drags start anywhere on the card; the keyboard drags via the handle, so Enter on
  // the card itself still opens the title.
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group/card relative touch-manipulation', isDragging && 'opacity-30')}
      {...listeners}
    >
      <Link
        to={titleHref(entry.titleId)}
        draggable={false}
        className="block rounded-lg"
        onClick={(event) => {
          if (Date.now() - lastDragEnd < 250) event.preventDefault()
        }}
      >
        <CardBody entry={entry} />
      </Link>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        aria-label={t('library.dragHandle', { title: titleName(entry.title.names, locale) })}
        className="absolute top-1.5 right-1.5 grid size-6 cursor-grab place-items-center rounded-md text-fg-3 opacity-0 transition-opacity group-hover/card:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
    </li>
  )
}

function Column({
  status,
  ids,
  entries,
  blocked,
}: {
  status: Status
  ids: string[]
  entries: Map<string, LibraryEntry>
  blocked: boolean
}) {
  const { t } = useI18n()
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` })
  return (
    <section
      aria-label={t(`status.${status}`)}
      className={cn(
        'flex w-[272px] shrink-0 flex-col rounded-xl bg-raised/70 ring-1 ring-line-subtle ring-inset transition-[opacity,box-shadow] duration-150 sm:w-[288px]',
        isOver && !blocked && 'ring-line-strong',
        blocked && 'opacity-40',
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <StatusIcon status={status} className="text-fg-2" />
        <h2 className="text-sm font-semibold">{t(`status.${status}`)}</h2>
        <span className="tabular text-xs text-fg-3">{ids.length}</span>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
          {ids.map((id) => {
            const entry = entries.get(id)
            return entry ? <SortableCard key={id} entry={entry} /> : null
          })}
          {!ids.length ? (
            <li className="grid flex-1 place-items-center rounded-lg border border-dashed border-line-strong/60 py-6 text-xs text-fg-3">
              {t('library.columnEmpty')}
            </li>
          ) : null}
        </ul>
      </SortableContext>
    </section>
  )
}

export function Board({ entries }: { entries: LibraryEntry[] }) {
  const { t, locale } = useI18n()
  const actions = useLibraryActions()
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.titleId, entry])), [entries])
  const [columns, setColumns] = useState<Columns>(() => buildColumns(entries))
  const [active, setActive] = useState<string | null>(null)
  const [source, setSource] = useState(entries)
  if (source !== entries && !active) {
    setSource(entries)
    setColumns(buildColumns(entries))
  }
  const activeEntry = active ? byId.get(active) : undefined

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const columnOf = (id: string): Status | null => {
    if (id.startsWith('column:')) return id.slice(7) as Status
    return (
      (STATUS_ORDER.find((status) => columns[status].includes(id)) as Status | undefined) ?? null
    )
  }

  const nameOf = (id: UniqueIdentifier) => {
    const entry = byId.get(String(id))
    return entry ? titleName(entry.title.names, locale) : ''
  }
  const columnName = (id: UniqueIdentifier) => {
    const status = columnOf(String(id))
    return status ? t(`status.${status}`) : ''
  }
  const accessibility = {
    screenReaderInstructions: { draggable: t('library.dragInstructions') },
    announcements: {
      onDragStart: ({ active: item }: { active: { id: UniqueIdentifier } }) =>
        t('library.dragStart', { title: nameOf(item.id) }),
      onDragOver: ({
        active: item,
        over,
      }: {
        active: { id: UniqueIdentifier }
        over: { id: UniqueIdentifier } | null
      }) =>
        // Skip "over itself" right after pickup so the pickup message is not cut off.
        over && over.id !== item.id
          ? t('library.dragOver', { title: nameOf(item.id), column: columnName(over.id) })
          : undefined,
      onDragEnd: ({
        active: item,
        over,
      }: {
        active: { id: UniqueIdentifier }
        over: { id: UniqueIdentifier } | null
      }) =>
        over
          ? t('library.dragEnd', { title: nameOf(item.id), column: columnName(over.id) })
          : t('library.dragCancel', { title: nameOf(item.id) }),
      onDragCancel: ({ active: item }: { active: { id: UniqueIdentifier } }) =>
        t('library.dragCancel', { title: nameOf(item.id) }),
    },
  }

  const onDragStart = (event: DragStartEvent) => setActive(String(event.active.id))

  const onDragOver = ({ active: dragged, over }: DragOverEvent) => {
    if (!over) return
    const id = String(dragged.id)
    const from = columnOf(id)
    const to = columnOf(String(over.id))
    const entry = byId.get(id)
    if (!from || !to || from === to || !entry || !isStatusAllowed(entry.kind, to)) return
    setColumns((current) => {
      const target = current[to].filter((item) => item !== id)
      const overIndex = target.indexOf(String(over.id))
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, id)
      return { ...current, [from]: current[from].filter((item) => item !== id), [to]: target }
    })
  }

  const onDragEnd = ({ active: dragged, over, activatorEvent }: DragEndEvent) => {
    const id = String(dragged.id)
    // Only pointer drops are followed by a stray click; keyboard users may press Enter right away.
    if (!(activatorEvent instanceof KeyboardEvent)) lastDragEnd = Date.now()
    setActive(null)
    const entry = byId.get(id)
    if (!entry || !over) {
      setColumns(buildColumns(entries))
      return
    }
    const overColumn = columnOf(String(over.id))
    if (overColumn && !isStatusAllowed(entry.kind, overColumn)) {
      toast(t('library.statusNotAllowed'))
      setColumns(buildColumns(entries))
      return
    }
    const status = columnOf(id) ?? entry.status
    let list = columns[status]
    const from = list.indexOf(id)
    const to = over.id === `column:${status}` ? list.length - 1 : list.indexOf(String(over.id))
    if (from >= 0 && to >= 0 && from !== to) list = arrayMove(list, from, to)
    setColumns((current) => ({ ...current, [status]: list }))
    const index = list.indexOf(id)
    const before = index > 0 ? byId.get(list[index - 1])?.position : undefined
    const after = index < list.length - 1 ? byId.get(list[index + 1])?.position : undefined
    const position = positionBetween(before, after)
    if (status !== entry.status) actions.setStatus(entry, status, { position })
    else if (position !== entry.position) actions.patch(entry, { position }, { silent: true })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={accessibility}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null)
        setColumns(buildColumns(entries))
      }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            ids={columns[status]}
            entries={byId}
            blocked={Boolean(activeEntry && !isStatusAllowed(activeEntry.kind, status))}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}>
        {activeEntry ? (
          <div className="w-[256px] sm:w-[272px]">
            <CardBody entry={activeEntry} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
