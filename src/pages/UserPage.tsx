import {
  Compass,
  Heart,
  ListChecks,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Star,
  UserRound,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { genreLabel } from '@shared/genres.ts'
import {
  KINDS,
  type ActivityItem,
  type PublicEntry,
  type PublicUser,
  type User,
  type UserProfile,
} from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { ActivityRow } from '@/components/ActivityRow'
import { UserAvatar } from '@/components/avatar'
import { Backdrop, Poster } from '@/components/Poster'
import { KindIcon, StatusIcon } from '@/components/StatusIcon'
import { Shelf, TitleCard } from '@/components/TitleCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EmptyState, SectionHeader, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { mergeActivity } from '@/lib/activity'
import { bannerBackground } from '@/lib/banners'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/lib/hooks'
import { useSession, useUserProfile } from '@/lib/queries'
import { shareLink } from '@/lib/share'
import { statusLabelKey, titleHref, titleName } from '@/lib/titles'

/** UserAvatar reads only id + avatar prefs; a public profile carries exactly those. */
function avatarUser(user: PublicUser): Pick<User, 'id' | 'preferences'> {
  return {
    id: user.id,
    preferences: { avatar: user.avatar, avatarColor: user.avatarColor } as User['preferences'],
  }
}

// ---------------------------------------------------------------------------
// Header

/**
 * Full-bleed banner that fades into the page. Layers, bottom up: the chosen gradient preset
 * or a quiet surface in the theme's own colour, then a blurred collage of the user's posters
 * or the favourite's backdrop. Colour comes only from posters and the user's own choice
 * (DESIGN.md): no avatar-coloured glow, and no black slab on top of a light page.
 */
function Banner({ profile }: { profile: UserProfile }) {
  const { user, bannerImage, heroPosters } = profile
  const preset = user.banner !== 'none' && user.banner !== 'favorite'
  // The collage stands in for "no background" and for a favourite without a backdrop. A chosen
  // gradient preset is the background itself, so posters must not cover it.
  const collage = !bannerImage && !preset ? heroPosters : []
  const imagery = Boolean(bannerImage) || collage.length > 0 || preset
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative -mx-4 h-44 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)] sm:-mx-6 sm:h-56 lg:mx-0 lg:h-64 lg:rounded-t-3xl',
        !imagery && 'bg-raised',
      )}
      style={preset ? { background: bannerBackground(user.banner) } : undefined}
    >
      {bannerImage ? (
        <Backdrop src={bannerImage} className="absolute inset-0 size-full" />
      ) : collage.length ? (
        <div className="absolute -inset-10 grid grid-cols-6 gap-0 blur-2xl saturate-200">
          {Array.from({ length: 6 }, (_, index) => {
            const src = collage[index % collage.length]
            return (
              <img
                key={index}
                src={src}
                alt=""
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            )
          })}
        </div>
      ) : null}
      {imagery ? (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />
      ) : null}
    </div>
  )
}

function KindChips({ profile }: { profile: UserProfile }) {
  const { t, fmt } = useI18n()
  const kinds = KINDS.filter((kind) => profile.stats.byKind[kind] > 0)
  if (!kinds.length && !profile.user.steamLinked) return null
  return (
    <ul className="no-scrollbar mt-3 flex max-w-full gap-1.5 overflow-x-auto px-1 py-0.5 lg:justify-start">
      {kinds.map((kind) => (
        <li
          key={kind}
          title={t(`kind.${kind}`)}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm text-fg-2 bg-raised ring-1 ring-line ring-inset"
        >
          <KindIcon kind={kind} className="size-3.5" />
          <span className="tabular-nums">{fmt.number(profile.stats.byKind[kind])}</span>
        </li>
      ))}
      {profile.user.steamLinked ? (
        <li className="flex h-7 shrink-0 items-center rounded-full px-2.5 text-sm text-fg-2 bg-raised ring-1 ring-line ring-inset">
          Steam
        </li>
      ) : null}
    </ul>
  )
}

function Header({ profile, own }: { profile: UserProfile; own: boolean }) {
  const { t, fmt } = useI18n()
  const { user } = profile
  const [manualUrl, setManualUrl] = useState<string | null>(null)
  const share = async () => {
    const url = `${window.location.origin}/users/${user.id}`
    const result = await shareLink(url, user.name)
    if (result === 'copied') toast(t('profile.linkCopied'))
    else if (result === 'manual') setManualUrl(url)
  }
  // A gap in the page colour and a hairline, like every other surface. The coloured glow was
  // the one place where UI chrome carried colour, against DESIGN.md.
  const ring: CSSProperties = {
    boxShadow: '0 0 0 4px var(--panel), 0 0 0 5px var(--line-strong)',
  }
  return (
    <section>
      <Banner profile={profile} />
      <div className="relative -mt-16 flex flex-col items-center text-center sm:-mt-20 lg:-mt-24 lg:flex-row lg:items-end lg:gap-6 lg:px-8 lg:text-left">
        <div className="shrink-0 rounded-full" style={ring}>
          <UserAvatar user={avatarUser(user)} className="size-28 bg-panel sm:size-32" />
        </div>
        <div className="mt-3 flex w-full min-w-0 flex-col items-center lg:mt-0 lg:flex-1 lg:items-start lg:pb-1">
          <h1 className="display w-full truncate text-3xl sm:text-4xl">{user.name}</h1>
          <p className="mt-1 w-full truncate text-sm text-fg-3">
            {t('profile.joined', { date: fmt.date(user.createdAt, 'long') })}
          </p>
          <KindChips profile={profile} />
        </div>
        <div className="mt-4 flex shrink-0 gap-2 lg:mt-0 lg:pb-1">
          {own ? (
            <Button asChild size="sm" variant="secondary" className="rounded-full px-4">
              <Link to="/settings/profile">
                <Pencil />
                {t('profile.edit')}
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" className="rounded-full px-4" onClick={share}>
            <Share2 />
            {t('profile.share')}
          </Button>
        </div>
      </div>
      <Dialog open={manualUrl !== null} onOpenChange={(open) => !open && setManualUrl(null)}>
        <DialogContent
          title={t('profile.shareTitle')}
          description={t('profile.shareManual')}
          size="sm"
        >
          <input
            readOnly
            autoFocus
            value={manualUrl ?? ''}
            aria-label={t('profile.shareTitle')}
            onFocus={(event) => event.currentTarget.select()}
            className="h-10 w-full rounded-lg bg-raised px-3 text-base text-fg ring-1 ring-line outline-none ring-inset focus-visible:ring-2 focus-visible:ring-fg/40"
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Stats strip

function StatsStrip({ profile }: { profile: UserProfile }) {
  const { t, fmt } = useI18n()
  const { stats } = profile
  const hours = Math.round(
    (stats.minutes.movies + stats.minutes.episodes + stats.minutes.games) / 60,
  )
  const cells: { label: string; value: string; hint?: string }[] = [
    { label: t('profile.total'), value: fmt.number(stats.total) },
    { label: t('profile.completedCount'), value: fmt.number(stats.byStatus.completed) },
    // Partly an estimate (default runtimes for films and episodes), so say so.
    { label: t('profile.hours'), value: `≈${fmt.number(hours)}`, hint: t('stats.hoursHint') },
    {
      label: t('profile.avgRating'),
      value: stats.averageRating
        ? fmt.number(stats.averageRating, { maximumFractionDigits: 1 })
        : '–',
    },
  ]
  const shades = ['bg-fg', 'bg-fg/60', 'bg-fg/35', 'bg-fg/15']
  return (
    <section
      aria-label={t('profile.stats')}
      className="mt-6 overflow-hidden rounded-xl bg-raised ring-1 ring-line ring-inset"
    >
      <dl className="grid grid-cols-4 divide-x divide-line">
        {cells.map((cell) => (
          // dt comes first for screen readers ("Total: 16"); flex-col-reverse keeps the number on top.
          <div
            key={cell.label}
            title={cell.hint}
            className="flex min-w-0 flex-col-reverse px-1 py-3 text-center sm:py-4"
          >
            <dt className="mt-0.5 truncate text-xs text-fg-3 sm:text-sm">{cell.label}</dt>
            <dd className="display truncate text-xl tabular-nums sm:text-3xl">{cell.value}</dd>
          </div>
        ))}
      </dl>
      {stats.total ? (
        <div className="flex h-1 w-full gap-px" aria-hidden="true">
          {KINDS.map((kind, index) =>
            stats.byKind[kind] ? (
              <div
                key={kind}
                title={t(`kind.${kind}`)}
                className={shades[index]}
                style={{ flexGrow: stats.byKind[kind] }}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Top 4

function TopFour({ entries, own }: { entries: PublicEntry[]; own: boolean }) {
  const { t, locale } = useI18n()
  const top = entries.slice(0, 4)
  if (!top.length && !own) return null
  return (
    <section className="mt-8">
      <SectionHeader title={t('profile.top4')} />
      <ol className="grid grid-cols-4 gap-2 sm:gap-3">
        {Array.from({ length: 4 }, (_, index) => {
          const entry = top[index]
          if (!entry)
            return own ? (
              <li key={`empty-${index}`}>
                <Link
                  to="/library"
                  aria-label={t('profile.addToTop')}
                  className="grid aspect-[2/3] place-items-center rounded-lg border border-dashed border-line-strong text-fg-3 transition-colors hover:bg-hover hover:text-fg"
                >
                  <Plus className="size-5" />
                </Link>
              </li>
            ) : null
          const name = titleName(entry.title.names, locale)
          return (
            <li key={entry.titleId}>
              <Link
                to={titleHref(entry.titleId)}
                aria-label={name}
                title={name}
                className="group/top relative block rounded-lg outline-offset-4"
              >
                <Poster
                  src={entry.title.poster}
                  alt=""
                  kind={entry.kind}
                  eager
                  rounded="rounded-lg"
                  className="shadow-poster transition-transform duration-300 ease-out group-hover/top:-translate-y-1"
                />
                {entry.rating ? (
                  <span className="absolute right-1 bottom-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-2xs font-semibold text-white tabular-nums backdrop-blur-md">
                    <Star className="size-2.5 fill-current" aria-hidden="true" />
                    {entry.rating}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Now playing / watching

function progressOf(entry: PublicEntry): number | null {
  if (entry.kind === 'game') return entry.progress > 0 ? entry.progress : null
  if (entry.totalEpisodes && entry.totalEpisodes > 0 && entry.watchedEpisodes > 0)
    return Math.min(100, Math.round((entry.watchedEpisodes / entry.totalEpisodes) * 100))
  return null
}

function NowRow({ entry }: { entry: PublicEntry }) {
  const { t, locale, fmt } = useI18n()
  const progress = progressOf(entry)
  const detail =
    entry.kind === 'game'
      ? entry.hours
        ? fmt.hours(entry.hours)
        : null
      : entry.totalEpisodes
        ? `${entry.watchedEpisodes}/${entry.totalEpisodes}`
        : null
  return (
    <li>
      <Link
        to={titleHref(entry.titleId)}
        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover"
      >
        <Poster
          src={entry.title.poster}
          alt=""
          kind={entry.kind}
          sizes="sm"
          rounded="rounded-md"
          className="w-10 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">
            {titleName(entry.title.names, locale)}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-fg-3">
            <StatusIcon status={entry.status} className="size-3.5 shrink-0" />
            <span className="truncate">
              {t(statusLabelKey(entry.kind, entry.status))}
              {detail ? ` · ${detail}` : ''}
            </span>
          </span>
          {progress !== null ? (
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-fg" style={{ width: `${progress}%` }} />
            </span>
          ) : null}
        </span>
        {progress !== null ? (
          <span className="shrink-0 text-sm text-fg-3 tabular-nums">{progress}%</span>
        ) : null}
      </Link>
    </li>
  )
}

function NowSection({ entries }: { entries: PublicEntry[] }) {
  const { t } = useI18n()
  if (!entries.length) return null
  return (
    <section className="mt-8">
      <SectionHeader title={t('profile.now')} />
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-raised ring-1 ring-line ring-inset">
        {entries.map((entry) => (
          <NowRow key={entry.titleId} entry={entry} />
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Genres, recently completed, activity

function Genres({ profile }: { profile: UserProfile }) {
  const { t, locale } = useI18n()
  const genres = profile.stats.topGenres.slice(0, 8)
  if (!genres.length) return null
  return (
    <section className="mt-8 lg:mt-0">
      <SectionHeader title={t('profile.genres')} />
      <ul className="flex flex-wrap gap-1.5">
        {genres.map((item, index) => (
          <li
            key={item.genre}
            className={cn(
              'flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-sm',
              index < 3 ? 'bg-fg text-panel' : 'bg-raised ring-1 ring-line ring-inset text-fg-2',
            )}
          >
            <span className="truncate">{genreLabel(item.genre, locale)}</span>
            <span className={cn('tabular-nums', index < 3 ? 'text-panel/60' : 'text-fg-3')}>
              {item.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecentlyCompleted({ entries }: { entries: PublicEntry[] }) {
  const { t } = useI18n()
  if (!entries.length) return null
  return (
    <section className="mt-8">
      <SectionHeader title={t('profile.recentlyCompleted')} />
      <Shelf label={t('profile.recentlyCompleted')}>
        {entries.map((entry, index) => (
          // Cards read the viewer's own library: the same data on one's own profile,
          // and the profile only carries public fields anyway.
          <TitleCard key={entry.titleId} title={entry.title} eager={index < 6} />
        ))}
      </Shelf>
    </section>
  )
}

/** Groups by calendar day and keeps one line per title per day (the most recent). */
function groupActivity(items: ActivityItem[]) {
  const groups: { day: string; date: Date; items: ActivityItem[] }[] = []
  for (const item of items) {
    const date = new Date(item.createdAt)
    const day = date.toDateString()
    let group = groups.at(-1)
    if (!group || group.day !== day) groups.push((group = { day, date, items: [] }))
    if (!group.items.some((existing) => existing.titleId === item.titleId)) group.items.push(item)
  }
  return groups
}

function Activity({ items }: { items: ActivityItem[] }) {
  const { t, fmt } = useI18n()
  const groups = useMemo(() => groupActivity(mergeActivity(items)), [items])
  if (!items.length) return null
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  return (
    <section className="mt-8">
      <SectionHeader title={t('profile.activity')} />
      <div className="rounded-xl p-1.5 bg-raised ring-1 ring-line ring-inset">
        {groups.map((group) => (
          <div key={group.day}>
            <p className="truncate px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">
              {group.day === today
                ? t('profile.today')
                : group.day === yesterday
                  ? t('profile.yesterday')
                  : fmt.date(group.date.toISOString(), 'medium')}
            </p>
            <ul>
              {group.items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Empty states

function Step({ n, icon, text }: { n: number; icon: ReactNode; text: string }) {
  return (
    <li className="flex min-w-0 items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-sm font-semibold ring-1 ring-line ring-inset tabular-nums">
        {n}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-base text-fg-2 [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{text}</span>
      </span>
    </li>
  )
}

function StartShelf() {
  const { t } = useI18n()
  return (
    <section className="mt-6 rounded-xl p-5 sm:p-6 bg-raised ring-1 ring-line ring-inset">
      <p className="flex items-center gap-2 text-sm font-medium text-fg-3">
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{t('profile.emptyOwnKicker')}</span>
      </p>
      <h2 className="display mt-1 truncate text-2xl">{t('profile.emptyOwnTitle')}</h2>
      <ol className="mt-4 space-y-3">
        <Step n={1} icon={<Compass />} text={t('profile.emptyStep1')} />
        <Step n={2} icon={<ListChecks />} text={t('profile.emptyStep2')} />
        <Step n={3} icon={<Heart />} text={t('profile.emptyStep3')} />
      </ol>
      <Button asChild variant="primary" className="mt-5 w-full rounded-full sm:w-auto sm:px-6">
        <Link to="/discover">
          <Compass />
          {t('profile.openDiscover')}
        </Link>
      </Button>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page

function ProfileSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="-mx-4 h-44 rounded-none sm:-mx-6 sm:h-56 lg:mx-0 lg:h-64 lg:rounded-t-3xl" />
      <div className="-mt-16 flex flex-col items-center sm:-mt-20">
        <Skeleton className="size-28 rounded-full sm:size-32" />
        <Skeleton className="mt-4 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-36" />
      </div>
      <Skeleton className="mt-6 h-[68px] rounded-2xl sm:h-[84px]" />
      <div className="mt-8 grid grid-cols-4 gap-2 sm:gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-[2/3] rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function ProfileContent({ profile, own }: { profile: UserProfile; own: boolean }) {
  const { t } = useI18n()
  const empty = profile.stats.total === 0
  return (
    <div className="animate-fade-in pb-10">
      <Header profile={profile} own={own} />
      {empty ? (
        own ? (
          <>
            <StartShelf />
            <TopFour entries={[]} own />
          </>
        ) : (
          <p className="mt-10 truncate text-center text-base text-fg-3">
            {t('profile.emptyOther')}
          </p>
        )
      ) : (
        <>
          <StatsStrip profile={profile} />
          <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
            <div className="min-w-0">
              <TopFour entries={profile.favorites} own={own} />
              <NowSection entries={profile.inProgress} />
              <RecentlyCompleted entries={profile.completed} />
            </div>
            <aside className="min-w-0 lg:pt-8">
              <Genres profile={profile} />
              <Activity items={profile.activity} />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

/** A shared profile link opened by someone who is not signed in. */
function GuestProfile({ id }: { id: string }) {
  const { t } = useI18n()
  const next = encodeURIComponent(`/users/${id}`)
  return (
    <EmptyState
      icon={<UserRound />}
      title={t('profile.guestTitle')}
      text={t('profile.guestText')}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="primary" size="sm">
            <Link to={`/login?next=${next}`}>{t('nav.signIn')}</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to={`/register?next=${next}`}>{t('nav.signUp')}</Link>
          </Button>
        </div>
      }
    />
  )
}

export default function UserPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const { user: viewer, isLoading: sessionLoading } = useSession()
  const profile = useUserProfile(id)
  const data = profile.data
  const own = Boolean(viewer && data && viewer.id === data.user.id)
  useDocumentTitle(data?.user.name ?? t('profile.title'))
  const notFound = (profile.error as { status?: number } | null)?.status === 404

  return (
    <>
      <PageHeader title={data?.user.name ?? t('profile.title')} back revealTitle={Boolean(data)} />
      <PageBody>
        {!viewer && !sessionLoading && id ? (
          <GuestProfile id={id} />
        ) : sessionLoading || profile.isLoading ? (
          <ProfileSkeleton />
        ) : !data ? (
          <EmptyState
            icon={<UserRound />}
            title={notFound ? t('profile.notFound') : t('errors.generic')}
            action={
              notFound ? null : (
                <Button size="sm" onClick={() => profile.refetch()}>
                  {t('common.retry')}
                </Button>
              )
            }
          />
        ) : (
          <ProfileContent profile={data} own={own} />
        )}
      </PageBody>
    </>
  )
}
