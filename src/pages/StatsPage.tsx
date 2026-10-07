import { BarChart3, Heart, RotateCw, Star } from 'lucide-react'
import { Link } from 'react-router'
import { STATUS_ORDER } from '@shared/status.ts'
import { KINDS, type LibraryStats } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { useErrorMessage } from '@/components/library-actions'
import { KindIcon, StatusIcon } from '@/components/StatusIcon'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useDocumentTitle } from '@/lib/hooks'
import { useStats } from '@/lib/queries'
import { GenresList, ShareList, TimeBreakdown } from './stats/Breakdowns'
import { KpiGrid } from './stats/KpiGrid'
import { MonthlyChart } from './stats/MonthlyChart'
import { RatingsChart } from './stats/RatingsChart'
import { StatCard } from './stats/StatCard'
import { StatsSkeleton } from './stats/StatsSkeleton'

function Facts({ stats }: { stats: LibraryStats }) {
  const { t } = useI18n()
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <Heart className="size-4 text-fg-3" aria-hidden="true" />
        {t('stats.favoritesFact', { count: stats.favorites })}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Star className="size-4 text-fg-3" aria-hidden="true" />
        {t('stats.ratedFact', { count: stats.rated })}
      </span>
    </>
  )
}

function StatsContent({ stats }: { stats: LibraryStats }) {
  const { t } = useI18n()
  return (
    <div className="animate-fade-in">
      <KpiGrid stats={stats} />
      <div className="@container mt-4">
        <div className="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
          <MonthlyChart months={stats.completedByMonth} className="@2xl:col-span-2" />
          <TimeBreakdown minutes={stats.minutes} />
          <StatCard title={t('stats.byKind')} meta={t('count.titles', { count: stats.total })}>
            <ShareList
              total={stats.total}
              rows={KINDS.map((kind) => ({
                key: kind,
                label: t(`kinds.${kind}`),
                icon: <KindIcon kind={kind} />,
                count: stats.byKind[kind],
              }))}
            />
          </StatCard>
          <StatCard title={t('stats.byStatus')}>
            <ShareList
              total={stats.total}
              rows={STATUS_ORDER.map((status) => ({
                key: status,
                label: t(`status.${status}`),
                icon: <StatusIcon status={status} />,
                count: stats.byStatus[status],
              }))}
            />
          </StatCard>
          <RatingsChart distribution={stats.ratingDistribution} rated={stats.rated} />
          <StatCard title={t('stats.genres')} className="@2xl:col-span-2 @4xl:col-span-3">
            <GenresList genres={stats.topGenres} />
          </StatCard>
        </div>
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { t } = useI18n()
  const stats = useStats()
  const message = useErrorMessage()
  useDocumentTitle(t('stats.title'))
  const data = stats.data
  const empty = data?.total === 0

  return (
    <>
      <PageHeader title={t('stats.title')} revealTitle />
      <PageBody>
        <section className="pt-6 md:pt-12" aria-busy={stats.isPending || undefined}>
          <h1 className="display text-3xl sm:text-4xl">{t('stats.title')}</h1>
          <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-x-5 gap-y-1 text-md text-fg-2">
            {data && !empty ? (
              <Facts stats={data} />
            ) : stats.isPending ? (
              <Skeleton className="h-4 w-64" />
            ) : null}
          </div>
        </section>

        <div className="mt-8">
          {stats.isPending ? (
            <StatsSkeleton />
          ) : stats.isError ? (
            <EmptyState
              icon={<BarChart3 />}
              title={t('stats.loadError')}
              text={message(stats.error)}
              action={
                <Button
                  variant="secondary"
                  onClick={() => void stats.refetch()}
                  loading={stats.isRefetching}
                >
                  <RotateCw />
                  {t('common.retry')}
                </Button>
              }
            />
          ) : empty ? (
            <EmptyState
              icon={<BarChart3 />}
              title={t('stats.empty')}
              text={t('stats.emptyText')}
              action={
                <Button asChild variant="primary">
                  <Link to="/discover">{t('library.emptyAction')}</Link>
                </Button>
              }
            />
          ) : (
            <StatsContent stats={stats.data} />
          )}
        </div>
      </PageBody>
    </>
  )
}
