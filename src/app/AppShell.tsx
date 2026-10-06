import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { useI18n } from '@/i18n'
import { useHotkey } from '@/lib/hooks'
import { CommandPalette } from './CommandPalette'
import { ShellContext } from './shell-context'
import { MobileTabBar, Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'mediashelf:sidebar-collapsed'

function useScrollMemory(ref: React.RefObject<HTMLDivElement | null>) {
  const location = useLocation()
  const type = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const current = useRef(location.key)

  useEffect(() => {
    const element = ref.current
    const save = () => {
      const top =
        element && element.scrollHeight > element.clientHeight ? element.scrollTop : window.scrollY
      positions.current.set(current.current, top)
    }
    element?.addEventListener('scroll', save, { passive: true })
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      element?.removeEventListener('scroll', save)
      window.removeEventListener('scroll', save)
    }
  }, [ref])

  useLayoutEffect(() => {
    current.current = location.key
    const top = type === 'POP' ? (positions.current.get(location.key) ?? 0) : 0
    // Search-param changes on the same page (filters) keep the position.
    if (type === 'REPLACE') return
    ref.current?.scrollTo({ top })
    window.scrollTo({ top })
  }, [location.key, location.pathname, type, ref])
}

export function AppShell() {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [palette, setPalette] = useState<{ open: boolean; mode: 'search' | 'add' }>({
    open: false,
    mode: 'search',
  })
  useScrollMemory(scrollRef)

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !value
    })
  }, [])

  const openPalette = useCallback(
    (mode: 'search' | 'add' = 'search') => setPalette({ open: true, mode }),
    [],
  )
  useHotkey(
    'k',
    (event) => {
      event.preventDefault()
      setPalette((state) => ({ open: !state.open, mode: 'search' }))
    },
    { mod: true, allowInInputs: true },
  )
  useHotkey('/', (event) => {
    event.preventDefault()
    openPalette('search')
  })

  const context = useMemo(() => ({ scrollRef, openPalette }), [openPalette])

  return (
    <ShellContext.Provider value={context}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-fg px-3 py-2 text-panel focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('nav.skipToContent')}
      </a>
      <div className="flex min-h-dvh">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <main id="main" className="min-w-0 flex-1 md:py-2 md:pr-2">
          <div
            ref={scrollRef}
            className="relative min-h-dvh bg-panel md:h-[calc(100dvh-16px)] md:min-h-0 md:overflow-y-auto md:rounded-xl md:shadow-[0_0_0_1px_var(--line)] md:[scrollbar-gutter:stable]"
          >
            <Outlet />
          </div>
        </main>
      </div>
      <MobileTabBar />
      <CommandPalette
        open={palette.open}
        mode={palette.mode}
        onOpenChange={(open) => setPalette((state) => ({ ...state, open }))}
      />
    </ShellContext.Provider>
  )
}
