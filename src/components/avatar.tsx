import type { CSSProperties } from 'react'
import type { User } from '@shared/types.ts'
import { cn } from '@/lib/cn'

/**
 * Monochrome avatars: OpenMoji "black" set (CC BY-SA 4.0,
 * https://openmoji.org) served from /public/avatars. The SVGs are black line
 * art, so they render through a CSS mask over a solid fill — the fill colour
 * is the user-chosen outline colour.
 */
export const AVATARS = [
  'dog',
  'cat',
  'mouse',
  'hamster',
  'rabbit',
  'fox',
  'bear',
  'panda',
  'raccoon',
  'koala',
  'tiger',
  'lion',
  'cow',
  'pig',
  'frog',
  'monkey',
  'unicorn',
  'horse',
  'zebra',
  'sheep',
  'goat',
  'chicken',
  'penguin',
  'owl',
  'duck',
  'swan',
  'parrot',
  'turtle',
  'fish',
  'blowfish',
  'whale',
  'dolphin',
  'octopus',
  'crab',
  'snail',
  'butterfly',
  'bee',
  'ladybug',
  'elephant',
  'gorilla',
  'computer',
  'laptop',
  'gamepad',
  'joystick',
  'tv',
  'film',
  'popcorn',
  'rocket',
  'robot',
  'alien',
  'ghost',
  'dino',
] as const
export type AvatarId = (typeof AVATARS)[number]

/** Fill colours for the avatar line art. `auto` follows the theme foreground. */
export const AVATAR_COLOR_HEX: Record<string, string> = {
  auto: 'var(--fg)',
  white: '#ffffff',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  pink: '#ec4899',
  orange: '#f97316',
  red: '#ef4444',
  sky: '#38bdf8',
  yellow: '#eab308',
  green: '#22c55e',
}

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATARS as readonly string[]).includes(value)
}

function hashSeed(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index++)
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  return Math.abs(hash)
}

/** The chosen avatar, or a stable one derived from the user id. */
export function avatarFor(user: Pick<User, 'id' | 'preferences'>): AvatarId {
  const chosen = user.preferences.avatar
  if (isAvatarId(chosen)) return chosen
  return AVATARS[hashSeed(user.id) % AVATARS.length]
}

/** The chosen outline colour, or `auto` when unset/unknown. */
export function avatarColorFor(user: Pick<User, 'id' | 'preferences'>): string {
  const chosen = user.preferences.avatarColor
  return chosen && chosen in AVATAR_COLOR_HEX ? chosen : 'auto'
}

export function AvatarArt({
  id,
  color,
  className,
}: {
  id: AvatarId
  color: string
  className?: string
}) {
  const style = {
    '--art': `url(/avatars/${id}.svg)`,
    backgroundColor: AVATAR_COLOR_HEX[color] ?? AVATAR_COLOR_HEX.auto,
  } as CSSProperties
  return <span aria-hidden="true" style={style} className={cn('avatar-art', className)} />
}

export function UserAvatar({
  user,
  className,
}: {
  user: Pick<User, 'id' | 'preferences'>
  className?: string
}) {
  const id = avatarFor(user)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-active ring-1 ring-line ring-inset',
        className,
      )}
    >
      <AvatarArt id={id} color={avatarColorFor(user)} className="size-[62%]" />
    </span>
  )
}
