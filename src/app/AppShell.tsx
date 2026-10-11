import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
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

/**
 * Flags the scroller while it moves. Content under a resting pointer then ignores hover
 * (see `[data-scrolling]` in index.css), so cards stop flickering through hover states
 * as they slide beneath the cursor during a fast scroll.
 */
function useScrollingFlag(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let timer = 0
    const onScroll = () => {
      element.dataset.scrolling = ''
      window.clearTimeout(timer)
      timer = window.setTimeout(() => delete element.dataset.scrolling, 140)
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [ref])
}

/** Appears after a long scroll and takes the page back to the top. */
function BackToTop({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = scrollRef.current
    const update = () => {
      const top =
        element && element.scrollHeight > element.clientHeight ? element.scrollTop : window.scrollY
      setVisible(top > 900)
    }
    element?.addEventListener('scroll', update, { passive: true })
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      element?.removeEventListener('scroll', update)
      window.removeEventListener('scroll', update)
    }
  }, [scrollRef])
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior = reduce ? 'auto' : 'smooth'
  return (
    <button
      type="button"
      aria-label={t('common.toTop')}
      title={t('common.toTop')}
      tabIndex={visible ? 0 : -1}
      onClick={() => {
        scrollRef.current?.scrollTo({ top: 0, behavior })
        window.scrollTo({ top: 0, behavior })
      }}
      className={`liquid-float fixed right-4 bottom-20 z-40 grid size-10 place-items-center rounded-full text-fg transition-[opacity,transform] duration-200 md:right-8 md:bottom-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp className="size-4" />
    </button>
  )
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
  useScrollingFlag(scrollRef)

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
      <BackToTop scrollRef={scrollRef} />
      <MobileTabBar />
      <CommandPalette
        open={palette.open}
        mode={palette.mode}
        onOpenChange={(open) => setPalette((state) => ({ ...state, open }))}
      />
    </ShellContext.Provider>
  )
}
