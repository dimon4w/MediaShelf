import { CheckCheck, Clock3, Heart, LibraryBig, Pencil, Star, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { LibraryEntry, PublicUser, User, UserProfile } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { ActivityRow } from '@/components/ActivityRow'
import { UserAvatar } from '@/components/avatar'
import { Backdrop } from '@/components/Poster'
import { Shelf, TitleCard } from '@/components/TitleCard'
import { Button } from '@/components/ui/button'
import { EmptyState, SectionHeader, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { bannerBackground } from '@/lib/banners'
import { useDocumentTitle } from '@/lib/hooks'
import { useSession, useUserProfile } from '@/lib/queries'

/** UserAvatar reads only id + avatar prefs; a public profile carries exactly those. */
function avatarUser(user: PublicUser): Pick<User, 'id' | 'preferences'> {
  return {
    id: user.id,
    preferences: { avatar: user.avatar, avatarColor: user.avatarColor } as User['preferences'],
  }
}

function Hero({ profile, own }: { profile: UserProfile; own: boolean }) {
  const { t, fmt } = useI18n()
  const { user, bannerImage } = profile
  return (
    // Always dark: white text and glass must read on any banner, in both themes.
    <section
      className="dark relative isolate overflow-hidden rounded-2xl text-fg ring-1 ring-line ring-inset"
      style={{ background: bannerBackground(user.banner) }}
    >
      {bannerImage ? (
        <Backdrop src={bannerImage} className="absolute inset-0 -z-10 size-full" />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
      />
      <div className="h-24 sm:h-40" />
      <div className="liquid liquid-clear m-2.5 flex items-center gap-3 rounded-2xl p-3 sm:m-4 sm:gap-4 sm:p-4">
        <UserAvatar user={avatarUser(user)} className="size-14 shrink-0 sm:size-20" />
        <div className="min-w-0 flex-1">
          <h1 className="display truncate text-2xl sm:text-4xl">{user.name}</h1>
          <p className="mt-0.5 truncate text-sm text-fg-2 sm:text-base">
            {t('profile.joined', { date: fmt.date(user.createdAt, 'long') })}
          </p>
        </div>
        {own ? (
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="shrink-0 rounded-full max-sm:size-9 max-sm:px-0"
          >
            <Link to="/settings/profile" aria-label={t('profile.edit')}>
              <Pencil />
              <span className="max-sm:hidden">{t('profile.edit')}</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="liquid min-w-0 rounded-2xl p-3 sm:p-4">
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-fg-3 [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="display mt-1 truncate text-2xl tabular-nums sm:text-3xl">{value}</p>
    </div>
  )
}

function Stats({ profile }: { profile: UserProfile }) {
  const { t, fmt } = useI18n()
  const { stats } = profile
  const hours = Math.round(
    (stats.minutes.movies + stats.minutes.episodes + stats.minutes.games) / 60,
  )
  return (
    <section
      aria-label={t('profile.stats')}
      className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3"
    >
      <StatTile icon={<LibraryBig />} label={t('profile.total')} value={fmt.number(stats.total)} />
      <StatTile
        icon={<CheckCheck />}
        label={t('profile.completedCount')}
        value={fmt.number(stats.byStatus.completed)}
      />
      <StatTile icon={<Star />} label={t('profile.ratedCount')} value={fmt.number(stats.rated)} />
      <StatTile icon={<Clock3 />} label={t('profile.hours')} value={fmt.number(hours)} />
    </section>
  )
}

function EntryShelf({
  title,
  empty,
  entries,
  own,
}: {
  title: string
  empty: string
  entries: LibraryEntry[]
  own: boolean
}) {
  return (
    <section className="mt-8 sm:mt-10">
      <SectionHeader title={title} />
      {entries.length ? (
        <Shelf label={title}>
          {entries.map((entry, index) => (
            // On someone else's profile the cards show the viewer's own library state.
            <TitleCard
              key={entry.titleId}
              title={entry.title}
              entry={own ? entry : undefined}
              eager={index < 6}
            />
          ))}
        </Shelf>
      ) : (
        <p className="liquid truncate rounded-2xl px-4 py-5 text-base text-fg-3">{empty}</p>
      )}
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-[184px] rounded-2xl sm:h-[264px]" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[76px] rounded-2xl sm:h-[92px]" />
        ))}
      </div>
    </div>
  )
}

export default function UserPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const { user: viewer } = useSession()
  const profile = useUserProfile(id)
  const data = profile.data
  const own = Boolean(viewer && data && viewer.id === data.user.id)
  useDocumentTitle(data?.user.name ?? t('profile.title'))

  const notFound = (profile.error as { status?: number } | null)?.status === 404

  return (
    <>
      <PageHeader title={data?.user.name ?? t('profile.title')} back revealTitle={Boolean(data)} />
      <PageBody>
        {profile.isLoading ? (
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
          <div className="animate-fade-in">
            <Hero profile={data} own={own} />
            <Stats profile={data} />
            <EntryShelf
              title={t('profile.favorites')}
              empty={t('profile.emptyFavorites')}
              entries={data.favorites}
              own={own}
            />
            <EntryShelf
              title={t('profile.watched')}
              empty={t('profile.emptyWatched')}
              entries={data.completed}
              own={own}
            />
            <section className="mt-8 pb-8 sm:mt-10">
              <SectionHeader title={t('profile.activity')} />
              {data.activity.length ? (
                <ul className="liquid rounded-2xl p-1.5">
                  {data.activity.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="liquid flex items-center gap-2 truncate rounded-2xl px-4 py-5 text-base text-fg-3">
                  <Heart className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t('profile.emptyActivity')}</span>
                </p>
              )}
            </section>
          </div>
        )}
      </PageBody>
    </>
  )
}
