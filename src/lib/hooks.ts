import { useEffect, useRef, useState } from 'react'

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · MediaDeck` : 'MediaDeck'
  }, [title])
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Global shortcut. `key` is compared case-insensitively; `mod` means Ctrl or ⌘. */
export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: { mod?: boolean; allowInInputs?: boolean; enabled?: boolean } = {},
) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  const { mod = false, allowInInputs = false, enabled = true } = options
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return
      if (mod !== (event.metaKey || event.ctrlKey)) return
      if (!allowInInputs && isTyping(event.target)) return
      ref.current(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, mod, allowInInputs, enabled])
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
