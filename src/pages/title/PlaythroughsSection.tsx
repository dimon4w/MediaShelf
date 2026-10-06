import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MAX_PLAYTHROUGHS } from '@shared/limits.ts'
import { STATUSES_BY_KIND } from '@shared/status.ts'
import {
  PLATFORMS,
  STORES,
  type LibraryEntry,
  type PlatformId,
  type Playthrough,
  type Status,
  type StoreId,
} from '@shared/types.ts'
import { useErrorMessage, useLibraryActions } from '@/components/library-actions'
import { StatusIcon } from '@/components/StatusIcon'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useI18n } from '@/i18n'
import { usePlaythroughs } from '@/lib/queries'
import { statusLabelKey } from '@/lib/titles'

const NONE = 'none'

function usePlatformOptions() {
  const { t } = useI18n()
  return {
    platforms: [
      { value: NONE, label: t('title.notSet') },
      ...PLATFORMS.map((id) => ({ value: id, label: t(`platforms.${id}`) })),
    ],
    stores: [
      { value: NONE, label: t('title.notSet') },
      ...STORES.map((id) => ({ value: id, label: t(`stores.${id}`) })),
    ],
  }
}

function ProgressField({
  value,
  onCommit,
  label,
}: {
  value: number
  onCommit(value: number): void
  label: string
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value)
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(value)
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-fg-3">
        <span className="font-medium">{label}</span>
        <span className="tabular text-sm text-fg">{t('home.percent', { value: draft })}</span>
      </div>
      <Slider value={draft} onValueChange={setDraft} onValueCommit={onCommit} aria-label={label} />
    </div>
  )
}

function HoursField({
  value,
  onCommit,
  label,
}: {
  value: number | null
  onCommit(value: number | null): void
  label: string
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(value === null ? '' : String(value))
  }
  const commit = () => {
    const parsed =
      draft.trim() === ''
        ? null
        : Math.round(Math.max(0, Math.min(100000, Number(draft.replace(',', '.')))) * 10) / 10
    if (parsed !== null && Number.isNaN(parsed))
      return setDraft(value === null ? '' : String(value))
    if (parsed !== value) onCommit(parsed)
  }
  return (
    <label className="grid gap-1.5 text-xs font-medium text-fg-3">
      {label}
      <Input
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
        placeholder="0"
        className="h-8 bg-panel text-sm"
      />
    </label>
  )
}

function MainPlaythrough({ entry }: { entry: LibraryEntry }) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  const options = usePlatformOptions()
  return (
    <div className="rounded-xl bg-raised p-4 ring-1 ring-line ring-inset">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-md font-semibold">{t('playthroughs.main')}</h3>
        <span className="flex items-center gap-1.5 text-sm text-fg-2">
          <StatusIcon status={entry.status} />
          {t(statusLabelKey(entry.kind, entry.status))}
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium text-fg-3">
          {t('playthroughs.platform')}
          <Select
            size="sm"
            aria-label={t('playthroughs.platform')}
            value={entry.platform ?? NONE}
            onValueChange={(value) =>
              actions.patch(
                entry,
                { platform: value === NONE ? null : (value as PlatformId) },
                { silent: true },
              )
            }
            options={options.platforms}
            className="bg-panel"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-fg-3">
          {t('playthroughs.store')}
          <Select
            size="sm"
            aria-label={t('playthroughs.store')}
            value={entry.store ?? NONE}
            onValueChange={(value) =>
              actions.patch(
                entry,
                { store: value === NONE ? null : (value as StoreId) },
                { silent: true },
              )
            }
            options={options.stores}
            className="bg-panel"
          />
        </label>
        <ProgressField
          value={entry.progress}
          label={t('playthroughs.progress')}
          onCommit={(progress) => actions.patch(entry, { progress })}
        />
        <HoursField
          value={entry.hours}
          label={t('title.hoursPlayed')}
          onCommit={(hours) => actions.patch(entry, { hours }, { silent: true })}
        />
      </div>
    </div>
  )
}

function ExtraPlaythrough({
  entry,
  playthrough,
  index,
}: {
  entry: LibraryEntry
  playthrough: Playthrough
  index: number
}) {
  const { t } = useI18n()
  const { update, remove } = usePlaythroughs()
  const message = useErrorMessage()
  const options = usePlatformOptions()
  const [confirm, setConfirm] = useState(false)
  const [label, setLabel] = useState(playthrough.label)
  const patch = (value: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate(
      { titleId: entry.titleId, id: playthrough.id, patch: value },
      { onError: (error) => toast.error(message(error)) },
    )
  return (
    <div className="rounded-xl bg-raised p-4 ring-1 ring-line ring-inset">
      <div className="flex items-center gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => label.trim() !== playthrough.label && patch({ label: label.trim() })}
          placeholder={`${t('playthroughs.extra')} ${index + 2}`}
          aria-label={t('playthroughs.label')}
          maxLength={80}
          className="h-8 flex-1 bg-transparent px-2 text-md font-semibold ring-transparent hover:ring-line focus:bg-panel"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('playthroughs.delete')}
          onClick={() => setConfirm(true)}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5 text-xs font-medium text-fg-3">
          {t('playthroughs.status')}
          <Select<Status>
            size="sm"
            aria-label={t('playthroughs.status')}
            value={playthrough.status}
            onValueChange={(status) => patch({ status })}
            options={STATUSES_BY_KIND.game.map((status) => ({
              value: status,
              label: t(statusLabelKey('game', status)),
              icon: <StatusIcon status={status} />,
            }))}
            className="bg-panel"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-fg-3">
          {t('playthroughs.platform')}
          <Select
            size="sm"
            aria-label={t('playthroughs.platform')}
            value={playthrough.platform ?? NONE}
            onValueChange={(value) =>
              patch({ platform: value === NONE ? null : (value as PlatformId) })
            }
            options={options.platforms}
            className="bg-panel"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-fg-3">
          {t('playthroughs.store')}
          <Select
            size="sm"
            aria-label={t('playthroughs.store')}
            value={playthrough.store ?? NONE}
            onValueChange={(value) => patch({ store: value === NONE ? null : (value as StoreId) })}
            options={options.stores}
            className="bg-panel"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_160px]">
        <ProgressField
          value={playthrough.progress}
          label={t('playthroughs.progress')}
          onCommit={(progress) => patch({ progress })}
        />
        <HoursField
          value={playthrough.hours}
          label={t('playthroughs.hours')}
          onCommit={(hours) => patch({ hours })}
        />
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('playthroughs.deleteConfirm')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() =>
          remove.mutateAsync({ titleId: entry.titleId, id: playthrough.id }).then(
            () => setConfirm(false),
            (error) => toast.error(message(error)),
          )
        }
      />
    </div>
  )
}

export function PlaythroughsSection({ entry }: { entry: LibraryEntry }) {
  const { t } = useI18n()
  const { add } = usePlaythroughs()
  const message = useErrorMessage()
  const full = entry.playthroughs.length >= MAX_PLAYTHROUGHS
  return (
    <section aria-labelledby="playthroughs-heading">
      <SectionHeader
        id="playthroughs-heading"
        title={t('title.playthroughs')}
        action={
          <Button
            size="sm"
            variant="secondary"
            disabled={full}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                { titleId: entry.titleId, input: { status: 'in_progress', label: '' } },
                { onError: (error) => toast.error(message(error)) },
              )
            }
          >
            <Plus />
            {t('playthroughs.add')}
          </Button>
        }
      />
      <div className="grid gap-3">
        <MainPlaythrough entry={entry} />
        {entry.playthroughs.map((playthrough, index) => (
          <ExtraPlaythrough
            key={playthrough.id}
            entry={entry}
            playthrough={playthrough}
            index={index}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-fg-3">
        {full ? t('playthroughs.limit') : t('playthroughs.hint')}
      </p>
    </section>
  )
}
