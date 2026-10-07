import { ExternalLink, MoreHorizontal, Play, SearchX, Trash2, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { parseTitleId } from '@shared/ids.ts'
import type { TitleRecord } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { BrandIcon } from '@/components/BrandIcon'
import { Backdrop, Poster } from '@/components/Poster'
import { FavoriteButton, LibraryButton, RatingButton } from '@/components/StatusControls'
import { KindIcon } from '@/components/StatusIcon'
import { useLibraryActions } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { useEntry, useTitle } from '@/lib/queries'
import {
  formatRating,
  genreList,
  ratingSourceLabel,
  secondaryName,
  titleName,
  yearRange,
} from '@/lib/titles'
import { DetailsSection } from './title/DetailsSection'
import { AddPanel, EntryPanel } from './title/EntryPanel'
import { AchievementsSection } from './title/AchievementsSection'
import { EpisodesSection } from './title/EpisodesSection'
import { Gallery, TrailerDialog } from './title/Gallery'
import { OffersSection } from './title/OffersSection'
import { PlaythroughsSection } from './title/PlaythroughsSection'

function Description({ title }: { title: TitleRecord }) {
  const { t, locale } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const own = title.descriptions?.[locale]
  const text = own ?? title.descriptions?.en ?? title.descriptions?.ru
  if (!text)
    return <p className="text-base text-fg-3">{title.detailed ? t('title.noDescription') : null}</p>
  const long = text.length > 480
  return (
    <section aria-labelledby="description-heading">
      <h2 id="description-heading" className="sr-only">
        {t('title.description')}
      </h2>
      <p
        className={`max-w-[72ch] text-md leading-7 whitespace-pre-line text-fg ${!expanded && long ? 'line-clamp-6' : ''}`}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-sm font-medium text-fg-2 hover:text-fg"
        >
          {expanded ? t('common.close') : t('common.more')}
        </button>
      ) : null}
      {!own ? <p className="mt-2 text-xs text-fg-3">{t('title.fallbackDescription')}</p> : null}
    </section>
  )
}

function HeroSkeleton() {
  return (
    <div className="dark relative overflow-hidden rounded-2xl bg-black p-5 sm:p-8 md:p-10">
      <div className="flex flex-col gap-6 md:min-h-[360px] md:flex-row md:items-end">
        <Skeleton className="aspect-[2/3] w-32 rounded-md sm:w-44 md:w-52" />
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-56" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-11 w-52 rounded-lg" />
            <Skeleton className="size-11 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero({ title, onRemove }: { title: TitleRecord; onRemove(): void }) {
  const { t, locale, fmt } = useI18n()
  const entry = useEntry(title.id)
  const [trailer, setTrailer] = useState(false)
  const name = titleName(title.names, locale)
  const secondary = secondaryName(title.names, locale)
  const meta = [
    t(`kind.${title.kind}`),
    yearRange(title),
    title.kind === 'movie' && title.runtime ? fmt.duration(title.runtime) : null,
    title.kind !== 'movie' && title.kind !== 'game' && title.seasons
      ? t('count.seasons', { count: title.seasons })
      : null,
    title.kind === 'anime' && !title.seasons && title.episodes
      ? t('count.episodes', { count: title.episodes })
      : null,
  ].filter(Boolean)
  const links = title.links ?? []
  return (
    <div className="dark relative isolate overflow-hidden rounded-2xl bg-black text-fg">
      {title.backdrop ? (
        <Backdrop src={title.backdrop} className="absolute inset-0 -z-10 size-full opacity-60" />
      ) : title.poster ? (
        <img
          src={title.poster}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-35 blur-3xl"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/55 to-black/10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/20 to-transparent" />
      <div className="flex flex-col gap-6 p-5 sm:p-8 md:min-h-[440px] md:flex-row md:items-end md:p-10">
        <Poster
          src={title.poster}
          alt={name}
          kind={title.kind}
          eager
          sizes="lg"
          className="w-32 shrink-0 shadow-poster sm:w-44 md:w-52"
        />
        <div className="min-w-0 flex-1 animate-rise">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2">
            <KindIcon kind={title.kind} className="size-3.5" />
            {meta.map((item, index) => (
              <span key={index} className="tabular">
                {index ? (
                  <span aria-hidden="true" className="mr-2">
                    ·
                  </span>
                ) : null}
                {item}
              </span>
            ))}
          </p>
          <h1 className="display mt-2 text-3xl text-white sm:text-4xl lg:text-[52px] lg:leading-[56px]">
            {name}
          </h1>
          {secondary ? <p className="mt-1.5 text-md text-fg-2">{secondary}</p> : null}
          {title.genres.length ? (
            <p className="mt-2 text-sm text-fg-2">
              {genreList(title.genres, locale, 4).join(' · ')}
            </p>
          ) : null}
          {title.ratings.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {title.ratings.slice(0, 3).map((rating) => (
                <span
                  key={rating.source}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-sm ring-1 ring-white/10 ring-inset backdrop-blur-md"
                >
                  <BrandIcon
                    id={rating.source === 'tvmaze' ? 'tvmaze' : rating.source}
                    className="size-3.5 text-white/80"
                  />
                  <span className="text-white/70">{ratingSourceLabel(rating.source)}</span>
                  <span className="tabular font-semibold text-white">
                    {formatRating(rating, fmt)}
                  </span>
                  {rating.votes ? (
                    <span className="tabular text-xs text-white/55">
                      · {fmt.compact(rating.votes)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <LibraryButton title={title} size="lg" onRemove={onRemove} />
            {entry ? <FavoriteButton entry={entry} size="icon-lg" /> : null}
            {entry ? <RatingButton entry={entry} /> : null}
            {title.trailer ? (
              <Button variant="secondary" size="lg" onClick={() => setTrailer(true)}>
                <Play className="fill-current" />
                {t('title.trailer')}
              </Button>
            ) : null}
            {links.length || entry ? (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="secondary" size="icon-lg" aria-label={t('common.more')}>
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent align="end">
                  {links.map((link) => (
                    <MenuItem key={link.url} asChild>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <BrandIcon id={link.source} />
                        {t('title.openOn', { source: t(`sources.${link.source}`) })}
                        <ExternalLink className="ml-auto !size-3.5" />
                      </a>
                    </MenuItem>
                  ))}
                  {entry ? (
                    <>
                      {links.length ? <MenuSeparator /> : null}
                      <MenuItem destructive onSelect={onRemove}>
                        <Trash2 />
                        {t('title.removeFromLibrary')}
                      </MenuItem>
                    </>
                  ) : null}
                </MenuContent>
              </Menu>
            ) : null}
          </div>
        </div>
      </div>
      {title.trailer ? (
        <TrailerDialog
          trailer={title.trailer}
          open={trailer}
          onOpenChange={setTrailer}
          title={name}
        />
      ) : null}
    </div>
  )
}

export default function TitlePage() {
  const { id = '' } = useParams()
  const { t, locale } = useI18n()
  const valid = Boolean(parseTitleId(id))
  const query = useTitle(id, valid)
  const entry = useEntry(id)
  const actions = useLibraryActions()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const title = query.data ?? (entry ? entry.title : undefined)
  const name = title ? titleName(title.names, locale) : null
  useDocumentTitle(name)

  const notFound =
    !valid ||
    (query.error instanceof ApiError &&
      (query.error.code === 'TITLE_NOT_FOUND' ||
        query.error.code === 'NOT_FOUND' ||
        query.error.code === 'VALIDATION'))

  return (
    <>
      <PageHeader
        back
        parent={{ label: t('nav.discover'), to: '/discover' }}
        title={name}
        revealTitle
      />
      <PageBody className="pt-1">
        {notFound && !entry ? (
          <EmptyState
            className="py-28"
            icon={<SearchX />}
            title={t('title.notFound')}
            text={t('title.notFoundText')}
            action={
              <Button asChild variant="primary">
                <Link to="/discover">{t('nav.discover')}</Link>
              </Button>
            }
          />
        ) : !title ? (
          query.isError ? (
            <EmptyState
              className="py-28"
              icon={<WifiOff />}
              title={t('title.loadError')}
              text={t('discover.unavailableHint')}
              action={<Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>}
            />
          ) : (
            <HeroSkeleton />
          )
        ) : (
          <>
            <Hero title={title} onRemove={() => setConfirmRemove(true)} />
            {query.isError ? (
              <p className="mt-3 text-sm text-fg-3">{t('title.offlineCopy')}</p>
            ) : null}
            <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
              <div className="grid min-w-0 content-start gap-10">
                {query.isLoading ? (
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ) : (
                  <Description title={title} />
                )}
                {title.kind === 'series' || title.kind === 'anime' ? (
                  <EpisodesSection title={title} entry={entry} />
                ) : null}
                {title.kind === 'game' && entry ? <PlaythroughsSection entry={entry} /> : null}
                {title.externalIds?.steam ? <AchievementsSection title={title} /> : null}
                {title.screenshots?.length ? (
                  <Gallery images={title.screenshots} title={name ?? ''} />
                ) : null}
              </div>
              <aside className="grid content-start gap-4">
                {entry ? (
                  <EntryPanel entry={entry} onRemove={() => setConfirmRemove(true)} />
                ) : (
                  <AddPanel title={title} />
                )}
                {title.kind === 'game' ? <OffersSection title={title} /> : null}
                <DetailsSection title={title} />
              </aside>
            </div>
          </>
        )}
      </PageBody>
      {entry ? (
        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title={t('title.removeConfirmTitle', { title: name ?? '' })}
          description={t('title.removeConfirmText')}
          confirmLabel={t('common.delete')}
          destructive
          onConfirm={() => {
            actions.remove(entry, () => setConfirmRemove(false))
            setConfirmRemove(false)
          }}
        />
      ) : null}
    </>
  )
}
