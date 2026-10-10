export type ShareResult = 'shared' | 'copied' | 'manual' | 'cancelled'

/**
 * Shares a link the best way the browser allows. On a phone over plain http (the LAN setup
 * from the README) there is neither navigator.share nor navigator.clipboard: the copy then
 * falls back to a hidden textarea, and if even that fails the caller shows the link to copy.
 */
export async function shareLink(url: string, title: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Any other failure (not allowed, no secure context): try copying instead.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url)
      return 'copied'
    } catch {
      /* fall through to the textarea copy */
    }
  }
  return copyWithSelection(url) ? 'copied' : 'manual'
}

function copyWithSelection(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let copied: boolean
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  area.remove()
  return copied
}
