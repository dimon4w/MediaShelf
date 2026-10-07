import { Star } from 'lucide-react'
import { Link } from 'react-router'
import type { LibraryEntry } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { RatingButton, StatusPicker } from '@/components/StatusControls'
import { ProgressBar } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { entryProgressText, titleHref, titleName, yearRange } from '@/lib/titles'

export function ListView({ entries }: { entries: LibraryEntry[] }) {
  const { t, locale, fmt } = useI18n()
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-line ring-inset">
      <div className="hidden grid-cols-[minmax(0,1fr)_170px_150px_100px_110px] items-center gap-4 border-b border-line bg-raised/60 px-4 py-2 text-xs font-medium text-fg-3 lg:grid">
        <span>{t('library.columns.name')}</span>
        <span>{t('library.columns.status')}</span>
        <span>{t('library.columns.progress')}</span>
        <span>{t('library.columns.rating')}</span>
        <span className="text-right">{t('library.columns.updated')}</span>
      </div>
      <ul>
        {entries.map((entry) => {
          const year = yearRange(entry.title)
          const progress = entryProgressText(entry, t)
          return (
            <li
              key={entry.titleId}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line-subtle px-3 py-2.5 last:border-b-0 hover:bg-hover/50 lg:grid-cols-[minmax(0,1fr)_170px_150px_100px_110px] lg:gap-4 lg:px-4"
            >
              <Link
                to={titleHref(entry.titleId)}
                className="flex min-w-0 items-center gap-3 rounded-md"
              >
                <Poster
                  src={entry.title.poster}
                  alt=""
                  kind={entry.kind}
                  sizes="sm"
                  className="w-9 shrink-0"
                  rounded="rounded-xs"
                />
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">
                    {titleName(entry.title.names, locale)}
                  </span>
                  <span className="block truncate text-xs text-fg-3">
                    {t(`kind.${entry.kind}`)}
                    {year ? ` · ${year}` : ''}
                    {entry.store === 'steam' ? ' · Steam' : ''}
                    <span className="lg:hidden">{progress ? ` · ${progress}` : ''}</span>
                  </span>
                </span>
              </Link>
              <div className="justify-self-end lg:justify-self-start">
                <StatusPicker entry={entry} className="max-w-[170px]" />
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                {entry.kind !== 'movie' ? (
                  <>
                    <ProgressBar
                      value={entry.progress}
                      className="flex-1"
                      label={t('title.progress')}
                    />
                    <span className="tabular w-12 text-right text-xs text-fg-2">
                      {progress ?? '—'}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-fg-3">—</span>
                )}
              </div>
              <div className="hidden lg:block">
                <RatingButton
                  entry={entry}
                  trigger={
                    <button
                      type="button"
                      aria-label={
                        entry.rating
                          ? t('title.yourRatingValue', { rating: entry.rating })
                          : t('title.rate')
                      }
                      className={cn(
                        'inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm transition-colors hover:bg-hover',
                        entry.rating ? 'text-fg' : 'text-fg-3',
                      )}
                    >
                      <Star className={cn('size-3.5', entry.rating && 'fill-current')} />
                      <span className="tabular">{entry.rating ?? '—'}</span>
                    </button>
                  }
                />
              </div>
              <span className="hidden text-right text-xs text-fg-3 lg:block">
                {fmt.relative(entry.updatedAt)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
