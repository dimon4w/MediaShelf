import { Check, MessageSquareText, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Episode, EpisodeMark, LibraryEntry, TitleRecord } from '@shared/types.ts'
import { useErrorMessage, useLibraryActions } from '@/components/library-actions'
import { RatingScale } from '@/components/StatusControls'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { ProgressBar, SectionHeader, Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useEpisodeList, useEpisodeMarks, useEpisodeNote, useMarkEpisodes } from '@/lib/queries'
import { episodeCode, localToday, statusLabelKey, titleName } from '@/lib/titles'

const key = (e: { season: number; number: number }) => `${e.season}:${e.number}`
const PAGE = 100

function NoteDialog({
  titleId,
  episode,
  mark,
  onClose,
}: {
  titleId: string
  episode: Episode
  mark: EpisodeMark | undefined
  onClose(): void
}) {
  const { t } = useI18n()
  const save = useEpisodeNote()
  const message = useErrorMessage()
  const [note, setNote] = useState(mark?.note ?? '')
  const [rating, setRating] = useState<number | null>(mark?.rating ?? null)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={t('episodes.note')}
        description={[t('episodes.code', episodeCode(episode.season, episode.number)), episode.name]
          .filter(Boolean)
          .join(' · ')}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { titleId, season: episode.season, number: episode.number, note, rating },
              { onSuccess: onClose, onError: (error) => toast.error(message(error)) },
            )
          }}
        >
          <div className="grid gap-2">
            <p className="text-sm font-medium">{t('episodes.ratingLabel')}</p>
            <div className="overflow-x-auto no-scrollbar">
              <RatingScale label={t('episodes.ratingLabel')} value={rating} onChange={setRating} />
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('episodes.notePlaceholder')}
            maxLength={2000}
            aria-label={t('episodes.note')}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EpisodesSection({
  title,
  entry,
}: {
  title: TitleRecord
  entry: LibraryEntry | null
}) {
  const { t, fmt, locale } = useI18n()
  const list = useEpisodeList(title.id, true)
  const marksQuery = useEpisodeMarks(title.id, Boolean(entry))
  const mark = useMarkEpisodes()
  const actions = useLibraryActions()
  const message = useErrorMessage()
  const [chosenSeason, setChosenSeason] = useState<number | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [noteFor, setNoteFor] = useState<Episode | null>(null)
  const today = localToday()

  const seasons = useMemo(() => {
    const all = (list.data?.seasons ?? []).filter((season) => season.episodes.length)
    return [...all.filter((s) => s.number > 0), ...all.filter((s) => s.number === 0)]
  }, [list.data])
  const marks = useMemo(
    () => new Map((marksQuery.data ?? []).map((m) => [key(m), m])),
    [marksQuery.data],
  )
  const watched = (e: { season: number; number: number }) => Boolean(marks.get(key(e))?.watchedAt)
  const regular = useMemo(
    () => seasons.filter((s) => s.number > 0).flatMap((s) => s.episodes),
    [seasons],
  )

  const defaultSeason = entry?.nextEpisode?.season ?? seasons[0]?.number ?? 1
  const seasonNumber =
    chosenSeason ??
    (seasons.some((s) => s.number === defaultSeason) ? defaultSeason : seasons[0]?.number)
  const season = seasons.find((s) => s.number === seasonNumber)

  const run = (episodes: { season: number; number: number }[], value: boolean) => {
    if (!entry) {
      actions.add(title, 'in_progress')
      return
    }
    mark.mutate(
      { titleId: title.id, episodes, watched: value },
      {
        onSuccess: ({ statusChanged }) => {
          if (statusChanged)
            toast(
              t('toast.autoStatus', { status: t(statusLabelKey(title.kind, statusChanged.to)) }),
              {
                description: titleName(title.names, locale),
              },
            )
        },
        onError: (error) => toast.error(message(error)),
      },
    )
  }

  const aired = (e: Episode) => !e.airdate || e.airdate <= today

  if (list.isLoading)
    return (
      <section aria-busy="true">
        <SectionHeader title={t('title.episodes')} />
        <div className="grid gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-lg" />
          ))}
        </div>
      </section>
    )

  if (!seasons.length)
    return (
      <section>
        <SectionHeader title={t('title.episodes')} />
        <div className="rounded-xl bg-raised px-4 py-6 text-center ring-1 ring-line ring-inset">
          <p className="text-base font-medium">
            {list.isError ? t('episodes.loadError') : t('episodes.noList')}
          </p>
          <p className="mt-1 text-sm text-fg-3">{t('episodes.noListText')}</p>
          {list.isError ? (
            <Button className="mt-3" size="sm" onClick={() => void list.refetch()}>
              {t('common.retry')}
            </Button>
          ) : null}
        </div>
      </section>
    )

  const seasonEpisodes = season?.episodes ?? []
  const seasonAired = seasonEpisodes.filter(aired)
  const seasonDone = seasonAired.length > 0 && seasonAired.every(watched)
  const next = entry?.nextEpisode

  return (
    <section aria-labelledby="episodes-heading">
      <SectionHeader
        id="episodes-heading"
        title={t('title.episodes')}
        action={
          entry && entry.totalEpisodes ? (
            <span className="tabular text-sm text-fg-2">
              {t('episodes.watchedOf', {
                watched: entry.watchedEpisodes,
                total: entry.totalEpisodes,
              })}
            </span>
          ) : (
            <span className="text-sm text-fg-3">
              {t('count.episodes', { count: regular.length })}
            </span>
          )
        }
      />

      {entry ? (
        <div className="mb-4 rounded-xl bg-raised p-4 ring-1 ring-line ring-inset">
          <ProgressBar value={entry.progress} label={t('title.progress')} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {next ? (
              <div className="min-w-0">
                <p className="text-xs font-medium text-fg-3">{t('episodes.next')}</p>
                <p className="truncate text-base">
                  <span className="tabular font-medium">
                    {t('episodes.code', episodeCode(next.season, next.number))}
                  </span>
                  {next.name ? <span className="text-fg-2"> · {next.name}</span> : null}
                </p>
                {next.airdate && next.airdate > today ? (
                  <p className="text-xs text-fg-3">
                    {t('episodes.airsOn', { date: fmt.date(next.airdate, 'long') })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-base text-fg-2">
                {list.data?.ended === false ? t('episodes.waiting') : t('episodes.allWatched')}
              </p>
            )}
            {next && (!next.airdate || next.airdate <= today) ? (
              <Button
                variant="primary"
                size="sm"
                loading={mark.isPending}
                onClick={() => run([next], true)}
              >
                <Check />
                {t('episodes.markWatched')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised px-4 py-3 text-sm text-fg-2 ring-1 ring-line ring-inset">
          {t('episodes.addToTrack')}
          <Button size="sm" variant="primary" onClick={() => actions.add(title, 'planned')}>
            <Plus />
            {t('title.addToLibrary')}
          </Button>
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {seasons.length > 1 && seasons.length <= 6 ? (
          <Segmented
            size="sm"
            aria-label={t('title.seasons')}
            value={String(seasonNumber)}
            onChange={(value) => {
              setChosenSeason(Number(value))
              setLimit(PAGE)
            }}
            options={seasons.map((s) => ({
              value: String(s.number),
              label:
                s.number === 0
                  ? t('episodes.specials')
                  : t('episodes.season', { number: s.number }),
            }))}
          />
        ) : seasons.length > 6 ? (
          <Select
            size="sm"
            aria-label={t('title.seasons')}
            value={String(seasonNumber)}
            onValueChange={(value) => {
              setChosenSeason(Number(value))
              setLimit(PAGE)
            }}
            options={seasons.map((s) => ({
              value: String(s.number),
              label:
                s.number === 0
                  ? t('episodes.specials')
                  : t('episodes.season', { number: s.number }),
            }))}
            className="min-w-40"
          />
        ) : (
          <p className="text-sm font-medium text-fg-2">
            {seasonNumber === 0
              ? t('episodes.specials')
              : t('episodes.season', { number: seasonNumber ?? 1 })}
          </p>
        )}
        {entry && seasonAired.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run(seasonAired, !seasonDone)}
            disabled={mark.isPending}
          >
            {seasonDone ? t('episodes.unmarkSeason') : t('episodes.markSeason')}
          </Button>
        ) : null}
      </div>

      <ol className="grid gap-px overflow-hidden rounded-xl ring-1 ring-line ring-inset">
        {seasonEpisodes.slice(0, limit).map((episode) => {
          const done = watched(episode)
          const future = !aired(episode)
          const note = marks.get(key(episode))
          const code = t('episodes.code', episodeCode(episode.season, episode.number))
          return (
            <li
              key={key(episode)}
              className={cn(
                'group flex items-center gap-3 bg-raised/60 px-3 py-2.5',
                future && 'opacity-60',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`${code}${episode.name ? `, ${episode.name}` : ''}`}
                disabled={future}
                onClick={() => run([episode], !done)}
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-150',
                  done
                    ? 'bg-fg text-panel'
                    : 'text-transparent ring-1 ring-line-strong ring-inset hover:text-fg-3',
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </button>
              <span className="tabular w-8 shrink-0 text-sm text-fg-3">{episode.number}</span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-base', done && 'text-fg-2')}>
                  {episode.name || t('episodes.episode', { number: episode.number })}
                </p>
                {episode.airdate ? (
                  <p className="text-xs text-fg-3">
                    {future
                      ? t('episodes.airsOn', { date: fmt.date(episode.airdate) })
                      : fmt.date(episode.airdate)}
                  </p>
                ) : null}
              </div>
              {note?.rating ? (
                <span className="tabular text-xs font-medium text-fg-2">{note.rating}/10</span>
              ) : null}
              {note?.note ? (
                <MessageSquareText className="size-4 text-fg-3" aria-label={t('episodes.note')} />
              ) : null}
              {entry ? (
                <Menu>
                  <MenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('common.more')}
                      className="opacity-60 group-hover:opacity-100"
                    >
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuItem onSelect={() => run([episode], !done)} disabled={future}>
                      <Check />
                      {done ? t('episodes.markUnwatched') : t('episodes.markWatched')}
                    </MenuItem>
                    {episode.season > 0 ? (
                      <MenuItem
                        disabled={future}
                        onSelect={() =>
                          run(
                            regular.filter(
                              (e) =>
                                aired(e) &&
                                (e.season < episode.season ||
                                  (e.season === episode.season && e.number <= episode.number)),
                            ),
                            true,
                          )
                        }
                      >
                        <Check />
                        {t('episodes.markUpTo')}
                      </MenuItem>
                    ) : null}
                    <MenuItem onSelect={() => setNoteFor(episode)}>
                      <MessageSquareText />
                      {t('episodes.note')}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              ) : null}
            </li>
          )
        })}
      </ol>
      {seasonEpisodes.length > limit ? (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setLimit((value) => value + PAGE)}>
            {t('common.showMore')}
          </Button>
        </div>
      ) : null}
      {list.data ? (
        <p className="mt-3 text-xs text-fg-3">
          {t('episodes.source', { source: t(`sources.${list.data.source}`) })}
        </p>
      ) : null}
      {noteFor ? (
        <NoteDialog
          titleId={title.id}
          episode={noteFor}
          mark={marks.get(key(noteFor))}
          onClose={() => setNoteFor(null)}
        />
      ) : null}
    </section>
  )
}
