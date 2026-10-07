import { createContext, useContext, useEffect, useState, type RefObject } from 'react'

interface ShellContextValue {
  scrollRef: RefObject<HTMLDivElement | null>
  openPalette(mode?: 'search' | 'add'): void
}

export const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell() {
  const value = useContext(ShellContext)
  if (!value) throw new Error('useShell must be used inside the app shell')
  return value
}

/** True once the content panel (desktop) or the window (mobile) has scrolled. */
export function useScrolled(threshold = 4) {
  const { scrollRef } = useShell()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const element = scrollRef.current
    const read = () => {
      const panelScroll =
        element && element.scrollHeight > element.clientHeight ? element.scrollTop : 0
      setScrolled(Math.max(panelScroll, window.scrollY) > threshold)
    }
    read()
    element?.addEventListener('scroll', read, { passive: true })
    window.addEventListener('scroll', read, { passive: true })
    return () => {
      element?.removeEventListener('scroll', read)
      window.removeEventListener('scroll', read)
    }
  }, [scrollRef, threshold])
  return scrolled
}
