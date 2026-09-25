import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { STATUSES_BY_KIND } from '@shared/status.ts'
import type { LibraryEntry, TitleRecord } from '@shared/types.ts'
import { StatusIcon } from '@/components/StatusIcon'
import { FavoriteButton, RatingScale, StatusPicker } from '@/components/StatusControls'
import { useLibraryActions } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { fieldBase, Textarea } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { statusLabelKey } from '@/lib/titles'

const toDateInput = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
const fromDateInput = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toISOString() : null

/** Date input that saves on blur/Enter, so partially typed years are never sent. */
function DateField({
  value,
  onCommit,
}: {
  value: string | null
  onCommit(value: string | null): void
}) {
  const [draft, setDraft] = useState(toDateInput(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(toDateInput(value))
  }
  const commit = () => {
    const current = toDateInput(value)
    if (draft === current) return
    if (!draft) return onCommit(null)
    const year = Number(draft.slice(0, 4))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft) || year < 1900 || year > new Date().getFullYear() + 1)
      return setDraft(current)
    onCommit(fromDateInput(draft))
  }
  return (
    <input
      type="date"
      value={draft}
      min="1900-01-01"
      max={toDateInput(new Date().toISOString())}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && commit()}
      className={cn(fieldBase, 'h-8 bg-panel px-2 text-sm')}
    />
  )
}

function Row({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-2 border-t border-line-subtle px-4 py-3.5', className)}>
      <p className="text-xs font-medium text-fg-3">{label}</p>
      {children}
    </div>
  )
}

function NotesEditor({ entry }: { entry: LibraryEntry }) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  const [value, setValue] = useState(entry.notes)
  // 'dirty' covers unsaved and failed edits: the draft is never replaced while it is dirty.
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
  const latest = useRef(entry)
  useEffect(() => {
    latest.current = entry
  })
  // Follow external changes (import, other tab) unless the user is typing.
  const [prevNotes, setPrevNotes] = useState(entry.notes)
  if (entry.notes !== prevNotes) {
    setPrevNotes(entry.notes)
    if (state === 'idle' || state === 'saved') setValue(entry.notes)
  }
  const save = (text: string) => {
    if (text === latest.current.notes) {
      if (state === 'dirty') setState('idle')
      return
    }
    setState('saving')
    actions.patch(
      latest.current,
      { notes: text },
      { silent: true, onSuccess: () => setState('saved'), onError: () => setState('dirty') },
    )
  }
  useEffect(() => {
    if (state !== 'dirty') return
    const timer = setTimeout(() => save(value), 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, state])
  return (
    <div className="grid gap-1.5">
      <Textarea
        value={value}
        maxLength={5000}
        placeholder={t('title.notesPlaceholder')}
        aria-label={t('title.notes')}
        onChange={(event) => {
          setValue(event.target.value)
          setState('dirty')
        }}
        onBlur={() => state === 'dirty' && save(value)}
        className="min-h-28 bg-panel"
      />
      <p
        className={cn(
          'h-4 text-xs text-fg-3 transition-opacity',
          state === 'saved' ? 'opacity-100' : 'opacity-0',
        )}
      >
        {t('title.notesSaved')}
      </p>
    </div>
  )
}

export function EntryPanel({ entry, onRemove }: { entry: LibraryEntry; onRemove(): void }) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  const episodic = entry.kind === 'series' || entry.kind === 'anime'
  return (
    <section
      aria-labelledby="entry-heading"
      className="rounded-xl bg-raised ring-1 ring-line ring-inset"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <h2 id="entry-heading" className="text-md font-semibold">
          {t('title.inLibrary')}
        </h2>
        <FavoriteButton entry={entry} size="icon-sm" />
      </div>
      <Row label={t('playthroughs.status')}>
        <StatusPicker entry={entry} className="-ml-2 w-fit" />
      </Row>
      <Row label={t('title.yourRating')}>
        <div className="overflow-x-auto no-scrollbar">
          <RatingScale
            label={t('title.yourRating')}
            value={entry.rating}
            onChange={(rating) => actions.rate(entry, rating)}
          />
        </div>
      </Row>
      {episodic || entry.kind === 'game' ? (
        <Row label={t('title.progress')}>
          <div className="flex items-center gap-3">
            <ProgressBar value={entry.progress} className="flex-1" label={t('title.progress')} />
            <span className="tabular text-sm text-fg-2">
              {episodic && entry.totalEpisodes
                ? `${entry.watchedEpisodes}/${entry.totalEpisodes}`
                : t('home.percent', { value: entry.progress })}
            </span>
          </div>
        </Row>
      ) : null}
      {entry.status !== 'planned' ? (
        <Row label={t('title.dates')}>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-fg-3">
              {t('title.started')}
              <DateField
                value={entry.startedAt}
                onCommit={(startedAt) => actions.patch(entry, { startedAt }, { silent: true })}
              />
            </label>
            {entry.status === 'completed' ? (
              <label className="grid gap-1 text-xs text-fg-3">
                {t('title.finished')}
                <DateField
                  value={entry.finishedAt}
                  onCommit={(finishedAt) => actions.patch(entry, { finishedAt }, { silent: true })}
                />
              </label>
            ) : null}
          </div>
        </Row>
      ) : null}
      <Row label={t('title.notes')}>
        <NotesEditor entry={entry} />
      </Row>
      <div className="border-t border-line-subtle px-2 py-2">
        <Button variant="danger-ghost" size="sm" onClick={onRemove}>
          <Trash2 />
          {t('title.removeFromLibrary')}
        </Button>
      </div>
    </section>
  )
}

/** Shown when the title is not saved yet: one tap per status. */
export function AddPanel({ title }: { title: TitleRecord }) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  return (
    <section className="rounded-xl bg-raised p-4 ring-1 ring-line ring-inset">
      <h2 className="text-md font-semibold">{t('title.addToLibrary')}</h2>
      <div className="mt-3 grid gap-1">
        {STATUSES_BY_KIND[title.kind].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => actions.add(title, status)}
            className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-base text-fg-2 transition-colors hover:bg-hover hover:text-fg"
          >
            <StatusIcon status={status} />
            {t(statusLabelKey(title.kind, status))}
          </button>
        ))}
      </div>
    </section>
  )
}
