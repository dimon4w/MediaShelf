/** Device-local onboarding data: PIN lock, custom avatar, connected stores. No server needed. */

const onboardedKey = (userId: string) => `mediashelf:onboarded:${userId}`
const avatarKey = (userId: string) => `mediashelf:custom-avatar:${userId}`
const storesKey = (userId: string) => `mediashelf:connected-stores:${userId}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function isOnboarded(userId: string): boolean {
  return read(onboardedKey(userId)) === '1'
}

export function markOnboarded(userId: string) {
  write(onboardedKey(userId), '1')
}

/** Custom uploaded avatar as a data URL, or null. */
export function customAvatar(userId: string): string | null {
  return read(avatarKey(userId))
}

export function saveCustomAvatar(userId: string, dataUrl: string) {
  write(avatarKey(userId), dataUrl)
}

/** Downscale an image file to a small square data URL for the avatar. */
export function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = 160
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      const side = Math.min(img.width, img.height)
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      )
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

export interface ConnectedStores {
  steam?: string
}

export function connectedStores(userId: string): ConnectedStores {
  try {
    const raw = read(storesKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const steam = (parsed as Record<string, unknown>).steam
    return typeof steam === 'string' && steam ? { steam } : {}
  } catch {
    return {}
  }
}

export function saveConnectedStores(userId: string, stores: ConnectedStores) {
  write(storesKey(userId), JSON.stringify(stores))
}

/** Accepts a Steam profile URL, vanity name, or 64-bit id. Returns the id/vanity or null. */
export function parseSteamInput(value: string): string | null {
  const input = value.trim()
  if (!input) return null
  const url = input.match(/steamcommunity\.com\/(id|profiles)\/([^/?#]+)/i)
  const id = (url?.[2] ?? input).replace(/\/+$/, '')
  if (/^\d{17}$/.test(id)) return id
  if (/^[A-Za-z0-9_-]{2,32}$/.test(id)) return id
  return null
}
