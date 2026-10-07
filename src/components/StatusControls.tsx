import { Check, ChevronDown, Heart, Plus, Star, Trash2 } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { STATUSES_BY_KIND } from '@shared/status.ts'
import type { Kind, LibraryEntry, Status, TitleRecord } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useEntry } from '@/lib/queries'
import { statusLabelKey } from '@/lib/titles'
import { Button } from './ui/button'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from './ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tooltip } from './ui/tooltip'
import { StatusIcon } from './StatusIcon'
import { useLibraryActions } from './library-actions'

export function StatusMenuItems({
  kind,
  value,
  onSelect,
}: {
  kind: Kind
  value: Status | null
  onSelect(status: Status): void
}) {
  const { t } = useI18n()
  return (
    <MenuRadioGroup value={value ?? ''} onValueChange={(next) => onSelect(next as Status)}>
      {STATUSES_BY_KIND[kind].map((status) => (
        <MenuRadioItem key={status} value={status}>
          <StatusIcon status={status} />
          {t(statusLabelKey(kind, status))}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  )
}

/** Primary library control: "Add" for new titles, the current status for saved ones. */
export function LibraryButton({
  title,
  size = 'md',
  className,
  onRemove,
}: {
  title: TitleRecord
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onRemove?: () => void
}) {
  const { t } = useI18n()
  const entry = useEntry(title.id)
  const actions = useLibraryActions()

  if (!entry) {
    return (
      <div className={cn('inline-flex', className)}>
        <Button
          variant="primary"
          size={size}
          className="rounded-r-none"
          onClick={() => actions.add(title, 'planned')}
          data-testid="add-to-library"
        >
          <Plus />
          {t('title.addToLibrary')}
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="primary"
              size={size === 'lg' ? 'icon-lg' : size === 'sm' ? 'icon-sm' : 'icon'}
              className="rounded-l-none border-l border-primary-fg/15"
              aria-label={t('title.addAs')}
            >
              <ChevronDown />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>{t('title.addAs')}</MenuLabel>
            <StatusMenuItems
              kind={title.kind}
              value={null}
              onSelect={(status) => actions.add(title, status)}
            />
          </MenuContent>
        </Menu>
      </div>
    )
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size={size} className={className} data-testid="status-button">
          <StatusIcon status={entry.status} />
          {t(statusLabelKey(entry.kind, entry.status))}
          <ChevronDown className="!size-3.5 text-fg-3" />
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        <StatusMenuItems
          kind={entry.kind}
          value={entry.status}
          onSelect={(status) => actions.setStatus(entry, status)}
        />
        {onRemove ? (
          <>
            <MenuSeparator />
            <MenuItem destructive onSelect={onRemove}>
              <Trash2 />
              {t('title.removeFromLibrary')}
            </MenuItem>
          </>
        ) : null}
      </MenuContent>
    </Menu>
  )
}

export function FavoriteButton({
  entry,
  size = 'icon',
}: {
  entry: LibraryEntry
  size?: 'icon' | 'icon-sm' | 'icon-lg'
}) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  const label = entry.favorite ? t('title.unfavorite') : t('title.favorite')
  return (
    <Tooltip content={label}>
      <Button
        variant="secondary"
        size={size}
        aria-label={label}
        aria-pressed={entry.favorite}
        onClick={() => actions.toggleFavorite(entry)}
      >
        <Heart
          className={cn(
            'transition-transform duration-200',
            entry.favorite && 'scale-110 fill-current',
          )}
        />
      </Button>
    </Tooltip>
  )
}

export function RatingScale({
  value,
  onChange,
  label,
}: {
  value: number | null
  onChange(value: number | null): void
  label: string
}) {
  const { t } = useI18n()
  const [hover, setHover] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const shown = hover ?? value ?? 0
  // Roving tab stop: one Tab reaches the scale, arrows move between scores.
  const tabStop = value ?? 1
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, score: number) => {
    const target =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? score + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? score - 1
          : event.key === 'Home'
            ? 1
            : event.key === 'End'
              ? 10
              : null
    if (target === null) return
    event.preventDefault()
    buttons.current[Math.min(10, Math.max(1, target)) - 1]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
        <button
          key={score}
          ref={(node) => {
            buttons.current[score - 1] = node
          }}
          type="button"
          role="radio"
          aria-checked={value === score}
          aria-label={t('title.ratingOption', { rating: score })}
          tabIndex={score === tabStop ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, score)}
          onMouseEnter={() => setHover(score)}
          onFocus={() => setHover(score)}
          onBlur={() => setHover(null)}
          onClick={() => onChange(value === score ? null : score)}
          className={cn(
            'tabular grid size-7 place-items-center rounded-md text-sm font-semibold transition-colors duration-100',
            score <= shown
              ? 'bg-fg text-panel'
              : 'bg-raised text-fg-3 ring-1 ring-line ring-inset hover:text-fg',
          )}
        >
          {score}
        </button>
      ))}
    </div>
  )
}

export function RatingButton({ entry, trigger }: { entry: LibraryEntry; trigger?: ReactNode }) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="secondary"
            aria-label={
              entry.rating ? t('title.yourRatingValue', { rating: entry.rating }) : undefined
            }
            data-testid="rating-button"
          >
            <Star className={cn(entry.rating && 'fill-current')} />
            {entry.rating ? <span className="tabular">{entry.rating}/10</span> : t('title.rate')}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <p className="mb-2.5 text-sm font-medium">{t('title.yourRating')}</p>
        <RatingScale
          label={t('title.yourRating')}
          value={entry.rating}
          onChange={(rating) => {
            actions.rate(entry, rating)
            setOpen(false)
          }}
        />
        {entry.rating ? (
          <button
            type="button"
            onClick={() => {
              actions.rate(entry, null)
              setOpen(false)
            }}
            className="mt-2.5 text-xs text-fg-3 hover:text-fg"
          >
            {t('title.clearRating')}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** Compact status picker used on cards and list rows. */
export function StatusPicker({ entry, className }: { entry: LibraryEntry; className?: string }) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg data-[state=open]:bg-hover',
            className,
          )}
        >
          <StatusIcon status={entry.status} />
          <span className="truncate">{t(statusLabelKey(entry.kind, entry.status))}</span>
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <StatusMenuItems
          kind={entry.kind}
          value={entry.status}
          onSelect={(status) => actions.setStatus(entry, status)}
        />
      </MenuContent>
    </Menu>
  )
}

export function InLibraryMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid size-6 place-items-center rounded-full bg-white text-black shadow-md',
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  )
}
