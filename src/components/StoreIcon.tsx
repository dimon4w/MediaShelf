import steam from 'simple-icons/icons/steam.svg?raw'
import gog from 'simple-icons/icons/gogdotcom.svg?raw'
import epic from 'simple-icons/icons/epicgames.svg?raw'
import playstation from 'simple-icons/icons/playstation.svg?raw'
import { Monitor, Gamepad2 } from 'lucide-react'
import type { StoreId } from '../lib/types'

const paths = {
  steam: steam.match(/<path d="([^"]+)"/)?.[1],
  gog: gog.match(/<path d="([^"]+)"/)?.[1],
  epic: epic.match(/<path d="([^"]+)"/)?.[1],
  playstation: playstation.match(/<path d="([^"]+)"/)?.[1],
  nintendo:
    'M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0H14.1c-.074 0-.15.074-.15.15v23.7c-.001.076.075.15.226.15zm4.574-13.199c1.351 0 2.399 1.125 2.399 2.398 0 1.352-1.125 2.4-2.399 2.4-1.35 0-2.4-1.049-2.4-2.4-.075-1.349 1.05-2.398 2.4-2.398zM11.4 0H6.15C2.775 0 0 2.775 0 6.15v11.7C0 21.226 2.775 24 6.15 24h5.25c.074 0 .15-.074.15-.149V.15c.001-.076-.075-.15-.15-.15zM9.676 22.051H6.15c-2.326 0-4.201-1.875-4.201-4.201V6.15c0-2.326 1.875-4.201 4.201-4.201H9.6l.076 20.102zM3.75 7.199c0 1.275.975 2.25 2.25 2.25s2.25-.975 2.25-2.25c0-1.273-.975-2.25-2.25-2.25s-2.25.977-2.25 2.25z',
}
export default function StoreIcon({ store, size = 16 }: { store: StoreId; size?: number }) {
  if (store === 'xbox')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="currentColor" />
        {/* The disc is filled with currentColor, so the slashes need ink, not a surface. */}
        <path
          d="M5 4c5 1 11 7 14 15M19 4C14 5 8 11 5 19"
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="2.5"
        />
      </svg>
    )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={paths[store]} />
    </svg>
  )
}
export function PlatformIcon({ platform, size = 15 }: { platform: string; size?: number }) {
  if (platform === 'PC') return <Monitor size={size} aria-hidden="true" />
  if (platform === 'Xbox') return <StoreIcon store="xbox" size={size} />
  if (platform.startsWith('PS') || platform.startsWith('PlayStation'))
    return <StoreIcon store="playstation" size={size} />
  if (platform.startsWith('Nintendo') || platform === 'Switch')
    return <StoreIcon store="nintendo" size={size} />
  return <Gamepad2 size={size} aria-hidden="true" />
}
