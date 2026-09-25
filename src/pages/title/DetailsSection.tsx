import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TitleRecord } from '@shared/types.ts'
import { BrandIcon } from '@/components/BrandIcon'
import { useI18n, type MessageKey } from '@/i18n'
import { genreList, secondaryName } from '@/lib/titles'

export function DetailsSection({ title }: { title: TitleRecord }) {
  const { t, fmt, locale } = useI18n()
  const rows: { label: string; value: ReactNode }[] = []
  const add = (key: MessageKey, value: ReactNode) => {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: t(key), value })
  }
  const creatorsLabel: Record<TitleRecord['kind'], MessageKey> = {
    movie: 'title.directors',
    series: 'title.creators',
    game: 'title.developers',
    anime: 'title.studios',
  }
  const original = secondaryName(title.names, locale)
  if (original) add('title.original', original)
  if (title.creators?.length) add(creatorsLabel[title.kind], fmt.list(title.creators.slice(0, 4)))
  if (title.companies?.length)
    add(
      title.kind === 'game' ? 'title.publishers' : 'title.network',
      fmt.list(title.companies.slice(0, 3)),
    )
  if (title.releaseDate) add('title.released', fmt.date(title.releaseDate, 'long'))
  else if (title.year) add('title.released', String(title.year))
  if (title.runtime)
    add(
      title.kind === 'movie' ? 'title.runtime' : 'title.episodeRuntime',
      fmt.duration(title.runtime),
    )
  if (title.seasons) add('title.seasons', fmt.number(title.seasons))
  if (title.episodes && title.kind !== 'movie')
    add('title.episodesTotal', fmt.number(title.episodes))
  if (title.airing && (title.kind === 'series' || title.kind === 'anime'))
    add(
      'title.airing',
      t(
        title.airing === 'airing'
          ? 'title.airingAiring'
          : title.airing === 'ended'
            ? 'title.airingEnded'
            : 'title.airingUpcoming',
      ),
    )
  if (title.platforms?.length)
    add('title.platforms', title.platforms.map((p) => t(`platforms.${p}`)).join(', '))
  if (title.genres.length) add('title.genres', genreList(title.genres, locale, 6).join(', '))
  if (title.country) add('title.country', title.country)
  if (title.cast?.length) add('title.cast', fmt.list(title.cast.slice(0, 8)))

  const links = (title.links ?? []).filter(
    (link, index, all) => all.findIndex((other) => other.url === link.url) === index,
  )
  if (!rows.length && !links.length) return null
  return (
    <section
      aria-labelledby="details-heading"
      className="rounded-xl bg-raised ring-1 ring-line ring-inset"
    >
      <h2 id="details-heading" className="px-4 pt-3.5 pb-1 text-md font-semibold">
        {t('title.details')}
      </h2>
      <dl className="px-4 pb-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[112px_1fr] gap-3 border-b border-line-subtle py-2.5 text-sm last:border-b-0"
          >
            <dt className="text-fg-3">{row.label}</dt>
            <dd className="min-w-0 text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
      {links.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line-subtle px-4 py-3">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-fg-2 ring-1 ring-line ring-inset transition-colors hover:bg-hover hover:text-fg"
            >
              <BrandIcon id={link.source} className="size-3.5" />
              {t(`sources.${link.source}`)}
              <ExternalLink className="size-3 text-fg-3" />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
