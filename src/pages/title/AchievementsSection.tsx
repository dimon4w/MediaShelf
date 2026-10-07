import { Trophy } from 'lucide-react'
import type { TitleRecord } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { useAchievements } from '@/lib/queries'

/** Global achievement unlock rates for Steam games (keyless Steam stats). */
export function AchievementsSection({ title }: { title: TitleRecord }) {
  const { t } = useI18n()
  const appid = title.externalIds?.steam ?? null
  const stats = useAchievements(title.kind === 'game' ? appid : null)
  if (title.kind !== 'game' || !appid) return null
  if (stats.isPending || stats.isError || !stats.data?.length) return null
  const top = stats.data.slice(0, 12)
  return (
    <section aria-label={t('achievements.title')} className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold tracking-[-0.015em]">
        <Trophy className="size-5 text-fg-3" aria-hidden="true" />
        {t('achievements.title')}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {top.map((item) => (
          <li
            key={item.name}
            className="flex items-center gap-3 rounded-xl bg-raised px-3.5 py-2.5 ring-1 ring-line ring-inset"
          >
            {item.icon ? (
              <img
                src={item.icon}
                alt=""
                loading="lazy"
                className="size-9 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-active">
                <Trophy className="size-4 text-fg-3" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.displayName}</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-active">
                <span
                  className="block h-full rounded-full bg-fg"
                  style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
                />
              </span>
            </span>
            <span className="tabular shrink-0 text-sm text-fg-2">
              {t('achievements.percent', { percent: item.percent })}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fg-3">{t('achievements.hint')}</p>
    </section>
  )
}
