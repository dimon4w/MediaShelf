import { useEffect, useRef, useState } from 'react'

export function useScrollHeader() {
  const [hidden, setHidden] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    let last = window.scrollY,
      distance = 0,
      direction = 0,
      frame = 0
    const update = () => {
      frame = 0
      const y = Math.max(0, window.scrollY),
        delta = y - last
      last = y
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      if (y < 60) {
        setHidden(false)
        distance = 0
        return
      }
      const next = Math.sign(delta)
      distance = next === direction ? distance + Math.abs(delta) : Math.abs(delta)
      direction = next
      if (distance > 16) {
        setHidden(next > 0)
        distance = 0
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Home') setHidden(false)
    }
    const measure = () =>
      document.documentElement.style.setProperty(
        '--measured-header',
        `${headerRef.current?.offsetHeight ?? 72}px`,
      )
    const observer = new ResizeObserver(measure)
    if (headerRef.current) observer.observe(headerRef.current)
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', keyboard)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', keyboard)
      document.documentElement.style.removeProperty('--measured-header')
    }
  }, [])
  return { hidden, headerRef }
}
