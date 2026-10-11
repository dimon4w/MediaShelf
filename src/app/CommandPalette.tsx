import { Command } from 'cmdk'
import { CornerDownLeft, Languages, LogOut, Monitor, Moon, Plus, Search, Sun } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { TitleRecord } from '@shared/types.ts'
import { useLibraryActions } from '@/components/library-actions'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { Spinner } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useDebounced } from '@/lib/hooks'
import { readRecent } from '@/lib/recent'
import { useLibrary, useLibraryMap, useLogout, useSearch, useUser } from '@/lib/queries'
import { titleHref, titleName, yearRange } from '@/lib/titles'
import { NAV_ITEMS } from './Sidebar'
import { usePreferenceSetters } from './UserMenu'

const itemClass = cn(
  'flex h-11 cursor-default items-center gap-3 rounded-lg px-2.5 text-base text-fg outline-none select-none',
  'data-[selected=true]:bg-hover [&_svg]:size-4 [&_svg]:shrink-0',
)

function normalise(value: string) {
  return value.toLocaleLowerCase().replaceAll('ё', 'е')
}

export function CommandPalette({
  open,
  mode,
  onOpenChange,
}: {
  open: boolean
  mode: 'search' | 'add'
  onOpenChange(open: boolean): void
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const user = useUser()
  const [value, setValue] = useState('')
  const debounced = useDebounced(value, 220)
  const search = useSearch(open ? debounced : '', 'all')
  const { data: entries } = useLibrary()
  const library = useLibraryMap()
  const actions = useLibraryActions()
  const setters = usePreferenceSetters()
  const logout = useLogout()

  const close = () => {
    onOpenChange(false)
    setValue('')
  }

  const query = normalise(value.trim())
  // Opened lately: offered first when the palette is empty, so the way back is one keystroke.
  const recent = useMemo(
    () => (open && mode === 'search' && !query ? readRecent() : []),
    [open, mode, query],
  )
  const libraryMatches = useMemo(() => {
    if (!entries) return []
    if (!query)
      return mode === 'search'
        ? entries.filter((entry) => !recent.some((item) => item.id === entry.titleId)).slice(0, 5)
        : []
    return entries
      .filter((entry) =>
        Object.values(entry.title.names).some((name) => name && normalise(name).includes(query)),
      )
      .slice(0, 6)
  }, [entries, query, mode, recent])

  const catalogItems = (query.length >= 2 ? (search.data?.items ?? []) : []).filter(
    (item) => !libraryMatches.some((entry) => entry.titleId === item.id),
  )

  const pick = (title: TitleRecord) => {
    const saved = library.get(title.id)
    if (mode === 'add' && !saved) {
      actions.add(title, 'planned')
      close()
      return
    }
    close()
    navigate(titleHref(title.id))
  }

  const run = (fn: () => void) => () => {
    close()
    fn()
  }

  const commands = [
    ...NAV_ITEMS.map((item) => ({
      id: item.to,
      label: t(item.label),
      icon: <item.icon />,
      run: run(() => navigate(item.to)),
    })),
  ]
  const actionItems = [
    {
      id: 'theme-light',
      label: t('palette.themeLight'),
      icon: <Sun />,
      run: run(() => setters.setTheme('light')),
    },
    {
      id: 'theme-dark',
      label: t('palette.themeDark'),
      icon: <Moon />,
      run: run(() => setters.setTheme('dark')),
    },
    {
      id: 'theme-system',
      label: t('palette.themeSystem'),
      icon: <Monitor />,
      run: run(() => setters.setTheme('system')),
    },
    {
      id: 'language',
      label: t('palette.switchLanguage'),
      icon: <Languages />,
      run: run(() => setters.setLocale(locale === 'ru' ? 'en' : 'ru')),
    },
    ...(user
      ? [
          {
            id: 'logout',
            label: t('nav.signOut'),
            icon: <LogOut />,
            run: run(() => {
              navigate('/')
              logout.mutate(undefined, { onSettled: () => toast(t('auth.signedOut')) })
            }),
          },
        ]
      : []),
  ]
  const matches = (label: string) => !query || normalise(label).includes(query)

  const row = (title: TitleRecord) => {
    const saved = library.get(title.id)
    const year = yearRange(title)
    return (
      <Command.Item
        key={title.id}
        value={title.id}
        onSelect={() => pick(title)}
        className={itemClass}
      >
        <Poster
          src={title.poster}
          alt=""
          kind={title.kind}
          sizes="sm"
          className="w-7"
          rounded="rounded-xs"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{titleName(title.names, locale)}</span>
          <span className="block truncate text-xs text-fg-3">
            {t(`kind.${title.kind}`)}
            {year ? ` · ${year}` : ''}
          </span>
        </span>
        {saved ? (
          <StatusIcon status={saved.status} className="text-fg-2" />
        ) : mode === 'add' ? (
          <Plus className="text-fg-3" />
        ) : null}
      </Command.Item>
    )
  }

  return (
    <D.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <D.Portal>
        <D.Overlay className="anim-fade fixed inset-0 z-50 bg-scrim" />
        <D.Content
          className="anim-pop fixed top-[10vh] left-1/2 z-50 w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-xl liquid-float outline-none max-sm:top-3"
          aria-describedby={undefined}
        >
          <D.Title className="sr-only">{t('nav.search')}</D.Title>
          <Command shouldFilter={false} loop label={t('nav.search')}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-fg-3" />
              <Command.Input
                autoFocus
                value={value}
                onValueChange={setValue}
                placeholder={
                  mode === 'add' ? t('palette.addPlaceholder') : t('palette.placeholder')
                }
                className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-fg-3"
              />
              {search.isFetching && query.length >= 2 ? (
                <Spinner className="text-fg-3" />
              ) : (
                <Kbd>Esc</Kbd>
              )}
            </div>
            <Command.List className="max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain p-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3">
              {recent.length ? (
                <Command.Group heading={t('palette.recent')}>{recent.map(row)}</Command.Group>
              ) : null}
              {libraryMatches.length ? (
                <Command.Group heading={t('palette.library')}>
                  {libraryMatches.map((entry) => row(entry.title))}
                </Command.Group>
              ) : null}
              {catalogItems.length ? (
                <Command.Group heading={t('palette.catalog')}>
                  {catalogItems.slice(0, 10).map(row)}
                </Command.Group>
              ) : null}
              {query.length >= 2 && search.isFetching && !catalogItems.length ? (
                <div className="flex h-11 items-center gap-3 px-2.5 text-sm text-fg-3">
                  <Spinner />
                  {t('palette.searching')}
                </div>
              ) : null}
              {mode === 'add' && query.length < 2 ? (
                <p className="px-2.5 py-6 text-center text-sm text-fg-3">
                  {t('palette.typeToSearch')}
                </p>
              ) : null}
              {mode === 'search' ? (
                <>
                  {commands.some((item) => matches(item.label)) ? (
                    <Command.Group heading={t('palette.navigation')}>
                      {commands
                        .filter((item) => matches(item.label))
                        .map((item) => (
                          <Command.Item
                            key={item.id}
                            value={`nav-${item.id}`}
                            onSelect={item.run}
                            className={cn(itemClass, 'h-9')}
                          >
                            <span className="text-fg-2">{item.icon}</span>
                            {item.label}
                          </Command.Item>
                        ))}
                    </Command.Group>
                  ) : null}
                  {actionItems.some((item) => matches(item.label)) ? (
                    <Command.Group heading={t('palette.actions')}>
                      {actionItems
                        .filter((item) => matches(item.label))
                        .map((item) => (
                          <Command.Item
                            key={item.id}
                            value={`action-${item.id}`}
                            onSelect={item.run}
                            className={cn(itemClass, 'h-9')}
                          >
                            <span className="text-fg-2">{item.icon}</span>
                            {item.label}
                          </Command.Item>
                        ))}
                    </Command.Group>
                  ) : null}
                </>
              ) : null}
              {query.length >= 2 &&
              !search.isFetching &&
              !catalogItems.length &&
              !libraryMatches.length &&
              !commands.some((item) => matches(item.label)) ? (
                <p className="px-2.5 py-6 text-center text-sm text-fg-3">{t('palette.empty')}</p>
              ) : null}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-xs text-fg-3 max-sm:hidden">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                {t('palette.hintNavigate')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
                {mode === 'add' ? t('common.add') : t('palette.hintOpen')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Esc</Kbd>
                {t('palette.hintClose')}
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
