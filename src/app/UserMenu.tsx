import {
  ChevronsUpDown,
  Languages,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { Locale, ThemePreference } from '@shared/types.ts'
import { Button } from '@/components/ui/button'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu'
import { Avatar } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useLogout, useUpdateProfile, useUser } from '@/lib/queries'
import { useTheme } from '@/lib/theme'

/** Applies locale/theme locally and persists them to the account when signed in. */
export function usePreferenceSetters() {
  const { setLocale } = useI18n()
  const { setPreference } = useTheme()
  const user = useUser()
  const update = useUpdateProfile()
  return {
    setLocale(locale: Locale) {
      setLocale(locale)
      if (user && user.preferences.locale !== locale) update.mutate({ preferences: { locale } })
    },
    setTheme(theme: ThemePreference) {
      setPreference(theme)
      if (user && user.preferences.theme !== theme) update.mutate({ preferences: { theme } })
    },
  }
}

function MenuBody() {
  const { t, locale } = useI18n()
  const { preference } = useTheme()
  const setters = usePreferenceSetters()
  const user = useUser()
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <>
      {user ? (
        <div className="px-2 pt-1.5 pb-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-fg-3">{user.email}</p>
        </div>
      ) : null}
      {user ? <MenuSeparator /> : null}
      {user ? (
        <MenuItem onSelect={() => navigate('/settings')}>
          <Settings />
          {t('nav.settings')}
        </MenuItem>
      ) : null}
      <MenuSub>
        <MenuSubTrigger>
          {preference === 'light' ? <Sun /> : preference === 'dark' ? <Moon /> : <Monitor />}
          {t('nav.theme')}
        </MenuSubTrigger>
        <MenuSubContent>
          <MenuRadioGroup
            value={preference}
            onValueChange={(value) => setters.setTheme(value as ThemePreference)}
          >
            <MenuRadioItem value="system">
              <Monitor />
              {t('settings.themeSystem')}
            </MenuRadioItem>
            <MenuRadioItem value="light">
              <Sun />
              {t('settings.themeLight')}
            </MenuRadioItem>
            <MenuRadioItem value="dark">
              <Moon />
              {t('settings.themeDark')}
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuSubContent>
      </MenuSub>
      <MenuSub>
        <MenuSubTrigger>
          <Languages />
          {t('nav.language')}
        </MenuSubTrigger>
        <MenuSubContent>
          <MenuRadioGroup
            value={locale}
            onValueChange={(value) => setters.setLocale(value as Locale)}
          >
            <MenuRadioItem value="ru">Русский</MenuRadioItem>
            <MenuRadioItem value="en">English</MenuRadioItem>
          </MenuRadioGroup>
        </MenuSubContent>
      </MenuSub>
      <MenuSeparator />
      {user ? (
        <MenuItem
          onSelect={() => {
            // Leave protected pages first so their guards do not redirect to the sign-in form.
            navigate('/')
            logout.mutate(undefined, { onSettled: () => toast(t('auth.signedOut')) })
          }}
        >
          <LogOut />
          {t('nav.signOut')}
        </MenuItem>
      ) : (
        <MenuItem onSelect={() => navigate('/login')}>
          <LogIn />
          {t('nav.signIn')}
        </MenuItem>
      )}
    </>
  )
}

export function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const { t } = useI18n()
  const user = useUser()
  if (!user) {
    return collapsed ? (
      <Button asChild variant="ghost" size="icon" aria-label={t('nav.signIn')}>
        <Link to="/login">
          <LogIn />
        </Link>
      </Button>
    ) : (
      <div className="grid gap-2">
        <Button asChild variant="primary" className="w-full">
          <Link to="/register">{t('nav.signUp')}</Link>
        </Button>
        <Button asChild variant="secondary" className="w-full">
          <Link to="/login">{t('nav.signIn')}</Link>
        </Button>
      </div>
    )
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.account')}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-hover data-[state=open]:bg-hover',
            collapsed && 'justify-center',
          )}
        >
          <Avatar name={user.name} />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-fg-3">{user.email}</span>
              </span>
              <ChevronsUpDown className="size-4 text-fg-3" />
            </>
          ) : null}
        </button>
      </MenuTrigger>
      <MenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'end' : 'start'}
        className="w-60"
      >
        <MenuBody />
      </MenuContent>
    </Menu>
  )
}

/** Avatar-only trigger for the mobile title bar. */
export function AccountButton({ className }: { className?: string }) {
  const { t } = useI18n()
  const user = useUser()
  if (!user)
    return (
      <Button asChild variant="secondary" size="sm" className={className}>
        <Link to="/login">{t('nav.signIn')}</Link>
      </Button>
    )
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.account')}
          className={cn('rounded-full p-0.5', className)}
        >
          <Avatar name={user.name} />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="w-60">
        <MenuBody />
      </MenuContent>
    </Menu>
  )
}
