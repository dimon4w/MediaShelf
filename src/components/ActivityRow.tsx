import { Link } from 'react-router'
import type { ActivityItem } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { useI18n } from '@/i18n'
import { statusLabelKey, titleHref, titleName } from '@/lib/titles'

/** One line of the activity feed: poster, title, what happened, when. */
export function ActivityRow({ item }: { item: ActivityItem }) {
  const { t, locale, fmt } = useI18n()
  const status = item.data.status ? t(statusLabelKey(item.kind, item.data.status)) : ''
  const text =
    item.type === 'added'
      ? t('activity.added', { status })
      : item.type === 'status'
        ? t('activity.status', { status })
        : item.type === 'rated'
          ? t('activity.rated', { rating: item.data.rating ?? '' })
          : item.type === 'favorite'
            ? t('activity.favorite')
            : item.type === 'episodes'
              ? t('activity.episodes', { count: item.data.count ?? 1 })
              : item.type === 'playthrough'
                ? t('activity.playthrough')
                : t('activity.removed')
  return (
    <li>
      <Link
        to={titleHref(item.titleId)}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover"
      >
        <Poster
          src={item.title?.poster}
          alt=""
          kind={item.kind}
          sizes="sm"
          className="w-8 shrink-0"
          rounded="rounded-xs"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base">
            {item.title ? titleName(item.title.names, locale) : item.titleId}
          </span>
          <span className="flex items-center gap-1.5 truncate text-sm text-fg-3">
            {item.data.status ? (
              <StatusIcon status={item.data.status} className="size-3.5" />
            ) : null}
            {text}
          </span>
        </span>
        <span className="shrink-0 text-xs text-fg-3">{fmt.relative(item.createdAt)}</span>
      </Link>
    </li>
  )
}
