import { Database, Gamepad2, Palette, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import type { User } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/lib/hooks'
import { useUser } from '@/lib/queries'
import { AppearanceSection } from './settings/AppearanceSection'
import { DataSection } from './settings/DataSection'
import { GamesSection } from './settings/GamesSection'
import { ProfileSection } from './settings/ProfileSection'
import { SecuritySection } from './settings/SecuritySection'

const SECTIONS = [
  { id: 'profile', icon: UserRound },
  { id: 'appearance', icon: Palette },
  { id: 'games', icon: Gamepad2 },
  { id: 'security', icon: ShieldCheck },
  { id: 'data', icon: Database },
] as const satisfies readonly { id: string; icon: LucideIcon }[]

type SectionId = (typeof SECTIONS)[number]['id']

function SectionNav({ current }: { current: SectionId }) {
  const { t } = useI18n()
  const chips = useRef<HTMLUListElement>(null)

  // Keep the active chip visible in the scrollable row (compact layout only).
  useEffect(() => {
    const list = chips.current
    const item = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !item || !list.offsetParent) return
    list.scrollTo({
      left: item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2,
      behavior: 'smooth',
    })
  }, [current])

  return (
    <nav aria-label={t('settings.sections')}>
      <ul
        ref={chips}
        className="no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 @2xl:hidden"
      >
        {SECTIONS.map(({ id }) => {
          const active = id === current
          return (
            <li key={id} className="shrink-0">
              <Link
                to={`/settings/${id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150',
                  active
                    ? 'bg-fg text-panel'
                    : 'bg-raised text-fg-2 ring-1 ring-line ring-inset hover:bg-active hover:text-fg',
                )}
              >
                {t(`settings.${id}`)}
              </Link>
            </li>
          )
        })}
      </ul>
      <ul className="hidden gap-0.5 @2xl:sticky @2xl:top-16 @2xl:grid">
        {SECTIONS.map(({ id, icon: Icon }) => {
          const active = id === current
          return (
            <li key={id}>
              <Link
                to={`/settings/${id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-base transition-colors duration-150',
                  active
                    ? 'bg-active font-medium text-fg'
                    : 'text-fg-2 hover:bg-hover hover:text-fg',
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className="truncate">{t(`settings.${id}`)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function SectionBody({ section, user }: { section: SectionId; user: User }) {
  switch (section) {
    case 'profile':
      return <ProfileSection user={user} />
    case 'appearance':
      return <AppearanceSection />
    case 'games':
      return <GamesSection user={user} />
    case 'security':
      return <SecuritySection user={user} />
    case 'data':
      return <DataSection user={user} />
  }
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { section: param } = useParams()
  const user = useUser()
  useDocumentTitle(t('settings.title'))

  const known = SECTIONS.find((item) => item.id === param)
  if (param !== undefined && !known) return <Navigate to="/settings" replace />
  if (!user) return null
  const section = known?.id ?? 'profile'

  return (
    <>
      <PageHeader title={t('settings.title')} revealTitle />
      <PageBody>
        <div className="@container max-w-[896px]">
          <h1 className="display pt-6 text-3xl sm:text-4xl md:pt-12">{t('settings.title')}</h1>
          <div className="mt-6 @2xl:mt-10 @2xl:grid @2xl:grid-cols-[176px_minmax(0,1fr)] @2xl:gap-10 @4xl:grid-cols-[200px_minmax(0,1fr)] @4xl:gap-14">
            <SectionNav current={section} />
            <div key={section} className="mt-8 min-w-0 max-w-[640px] animate-fade-in @2xl:mt-0">
              <SectionBody section={section} user={user} />
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}
