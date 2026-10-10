import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider, useI18n } from '@/i18n'
import { ApiError } from '@/lib/api'
import { keys, resetUserData, useSession } from '@/lib/queries'
import { ThemeProvider, useTheme } from '@/lib/theme'
import { AppShell } from './AppShell'
import { PageFallback, RouteError } from './RouteStates'

const HomePage = lazy(() => import('@/pages/HomePage'))
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'))
const TitlePage = lazy(() => import('@/pages/TitlePage'))
const LibraryPage = lazy(() => import('@/pages/LibraryPage'))
const ShufflePage = lazy(() => import('@/pages/ShufflePage'))
const StatsPage = lazy(() => import('@/pages/StatsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const UserPage = lazy(() => import('@/pages/UserPage'))
const AuthPage = lazy(() => import('@/pages/AuthPage'))
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'))
const WelcomePage = lazy(() => import('@/pages/WelcomePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// An expired or revoked session surfaces as 401 on any request: forget the user so guards
// send them to the sign-in form instead of rendering an "empty library".
function onApiError(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== 'UNAUTHORIZED') return
  const session = queryClient.getQueryData<{ user: unknown; registrationOpen: boolean }>(
    keys.session,
  )
  if (!session?.user) return
  resetUserData(queryClient)
  queryClient.setQueryData(keys.session, { ...session, user: null })
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return count < 1
      },
    },
  },
})

/** Applies the account's saved language and theme once per signed-in user. */
function PreferenceSync() {
  const { user } = useSession()
  const { locale, setLocale } = useI18n()
  const { preference, setPreference } = useTheme()
  const synced = useRef<string | null>(null)
  useEffect(() => {
    if (!user || synced.current === user.id) return
    synced.current = user.id
    if (user.preferences.locale !== locale) setLocale(user.preferences.locale)
    if (user.preferences.theme !== preference) setPreference(user.preferences.theme)
  }, [user, locale, preference, setLocale, setPreference])
  return null
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession()
  const location = useLocation()
  if (isLoading) return <PageFallback />
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession()
  const location = useLocation()
  if (isLoading) return null
  if (user) {
    const next = new URLSearchParams(location.search).get('next')
    return (
      <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/'} replace />
    )
  }
  return children
}

function Root() {
  return (
    <>
      <PreferenceSync />
      <Outlet />
    </>
  )
}

const page = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/login',
        element: page(
          <GuestOnly>
            <AuthPage mode="login" />
          </GuestOnly>,
        ),
      },
      {
        path: '/register',
        element: page(
          <GuestOnly>
            <AuthPage mode="register" />
          </GuestOnly>,
        ),
      },
      {
        path: '/verify-email',
        element: page(<VerifyEmailPage />),
      },
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: page(<HomePage />) },
          {
            path: 'welcome',
            element: page(
              <RequireAuth>
                <WelcomePage />
              </RequireAuth>,
            ),
          },
          { path: 'discover', element: page(<DiscoverPage />) },
          { path: 'title/:id', element: page(<TitlePage />) },
          {
            path: 'library',
            element: page(
              <RequireAuth>
                <LibraryPage />
              </RequireAuth>,
            ),
          },
          { path: 'shuffle', element: page(<ShufflePage />) },
          {
            path: 'stats',
            element: page(
              <RequireAuth>
                <StatsPage />
              </RequireAuth>,
            ),
          },
          // Not behind RequireAuth: a guest with a shared link gets an explanation, not a bare redirect.
          { path: 'users/:id', element: page(<UserPage />) },
          {
            path: 'settings/:section?',
            element: page(
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>,
            ),
          },
          { path: '*', element: page(<NotFoundPage />) },
        ],
      },
    ],
  },
])

function Toasts() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="bottom-center"
      mobileOffset={{ bottom: 76 }}
      visibleToasts={3}
    />
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <TooltipProvider delayDuration={400} skipDelayDuration={200}>
            <RouterProvider router={router} />
            <Toasts />
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
