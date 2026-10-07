import { BarChart3, Compass, Dices, House, LibraryBig, PanelLeft, Plus, Search } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { useI18n, type MessageKey } from '@/i18n'
import { cn } from '@/lib/cn'
import { isMac } from '@/lib/hooks'
import { useLibrary, useUser } from '@/lib/queries'
import { entryProgressText, statusLabelKey, titleHref, titleName } from '@/lib/titles'
import { BrandMark } from './Brand'
import { useShell } from './shell-context'
import { UserMenu } from './UserMenu'

export const NAV_ITEMS: {
  to: string
  label: MessageKey
  icon: ComponentType<{ className?: string }>
  end?: boolean
}[] = [
  { to: '/', label: 'nav.home', icon: House, end: true },
  { to: '/discover', label: 'nav.discover', icon: Compass },
  { to: '/library', label: 'nav.library', icon: LibraryBig },
  { to: '/shuffle', label: 'nav.shuffle', icon: Dices },
  { to: '/stats', label: 'nav.stats', icon: BarChart3 },
]

function RecentEntries() {
  const { t, locale } = useI18n()
  const { data } = useLibrary()
  const location = useLocation()
  if (!data?.length) return null
  const active = data.filter((entry) => entry.status === 'in_progress')
  const items = (active.length ? active : data).slice(0, 6)
  return (
    <div className="mt-6">
      <p className="mb-1.5 px-2.5 text-xs font-medium text-fg-3">{t('nav.continue')}</p>
      {/* minmax(0, 1fr): long titles must truncate instead of widening the column. */}
      <ul className="grid grid-cols-1 gap-0.5">
        {items.map((entry) => {
          const href = titleHref(entry.titleId)
          const current = location.pathname === href
          const progress = entryProgressText(entry, t)
          return (
            <li key={entry.titleId}>
              <Link
                to={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-hover',
                  current && 'bg-active',
                )}
              >
                <Poster
                  src={entry.title.poster}
                  alt=""
                  kind={entry.kind}
                  sizes="sm"
                  className="w-7 shrink-0"
                  rounded="rounded-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">
                    {titleName(entry.title.names, locale)}
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-fg-3">
                    <StatusIcon status={entry.status} className="size-3" />
                    <span className="truncate">
                      {progress ?? t(statusLabelKey(entry.kind, entry.status))}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle(): void }) {
  const { t } = useI18n()
  const { openPalette } = useShell()
  const user = useUser()
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col py-3 transition-[width] duration-300 ease-out md:flex',
        collapsed ? 'w-16 items-center px-2' : 'w-[248px] px-3',
      )}
      aria-label={t('nav.menu')}
    >
      <div
        className={cn(
          'flex h-9 items-center',
          collapsed ? 'justify-center' : 'justify-between pl-1.5',
        )}
      >
        {!collapsed ? (
          <Link to="/" className="flex items-center gap-2.5 rounded-md">
            <BrandMark />
            <span className="text-md font-semibold tracking-[-0.01em]">MediaShell</span>
          </Link>
        ) : null}
        <Tooltip content={collapsed ? t('nav.expand') : t('nav.collapse')} side="right">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          >
            <PanelLeft />
          </Button>
        </Tooltip>
      </div>

      <div className={cn('mt-4 grid gap-2', collapsed && 'justify-items-center')}>
        {collapsed ? (
          <>
            <Tooltip content={t('nav.search')} side="right">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openPalette('search')}
                aria-label={t('nav.search')}
              >
                <Search />
              </Button>
            </Tooltip>
            <Tooltip content={t('nav.add')} side="right">
              <Button
                variant="primary"
                size="icon"
                onClick={() => openPalette('add')}
                aria-label={t('nav.add')}
              >
                <Plus />
              </Button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openPalette('search')}
              className="flex h-9 w-full items-center gap-2 rounded-lg bg-raised px-2.5 text-base text-fg-3 ring-1 ring-line ring-inset transition-colors hover:text-fg-2 hover:ring-line-strong"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">{t('nav.search')}</span>
              <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
            </button>
            <Button
              variant="primary"
              className="w-full justify-start"
              onClick={() => openPalette('add')}
            >
              <Plus />
              {t('nav.add')}
            </Button>
          </>
        )}
      </div>

      <nav className={cn('mt-5 grid gap-0.5', collapsed && 'justify-items-center')}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={collapsed ? t(item.label) : undefined}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-2.5 rounded-lg text-base transition-colors',
                  collapsed ? 'size-10 justify-center' : 'px-2.5',
                  isActive
                    ? 'bg-active font-medium text-fg'
                    : 'text-fg-2 hover:bg-hover hover:text-fg',
                )
              }
            >
              <Icon className="size-[18px]" />
              {!collapsed ? t(item.label) : null}
            </NavLink>
          )
          return collapsed ? (
            <Tooltip key={item.to} content={t(item.label)} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          )
        })}
      </nav>

      <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed && 'hidden')}>
        {user ? <RecentEntries /> : null}
      </div>

      <div
        className={cn(
          'mt-3 border-t border-line pt-3',
          collapsed ? 'w-full flex justify-center' : 'w-full',
        )}
      >
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  )
}

export function MobileTabBar() {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('nav.menu')}
      className="glass glass-dense fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                    isActive ? 'text-fg' : 'text-fg-3',
                  )
                }
              >
                <Icon className="size-[22px]" />
                <span className="max-w-full truncate px-1">{t(item.label)}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
