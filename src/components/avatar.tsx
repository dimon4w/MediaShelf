import type { User } from '@shared/types.ts'
import { cn } from '@/lib/cn'
import { customAvatar } from '@/lib/device'
import {
  AVATAR_IDS,
  AvatarFigure,
  isAvatarId,
  isBackgroundId,
  variantCount,
  type AvatarId,
  type BackgroundId,
} from './avatar-art'

export const AVATARS = AVATAR_IDS
export type { AvatarId, BackgroundId }

/** An uploaded picture lives on this device; 'custom' without one falls back to a character. */
export const CUSTOM_AVATAR_ID = 'custom'

/** Ids from the earlier line-art set map to the nearest illustrated character. */
const LEGACY: Record<string, AvatarId> = {
  chicken: 'chick',
  duck: 'chick',
  swan: 'chick',
  bee: 'chick',
  popcorn: 'chick',
  hamster: 'bear',
  mouse: 'rabbit',
  cow: 'pig',
  horse: 'unicorn',
  zebra: 'unicorn',
  butterfly: 'unicorn',
  sheep: 'koala',
  goat: 'koala',
  elephant: 'koala',
  parrot: 'owl',
  turtle: 'frog',
  snail: 'frog',
  ladybug: 'frog',
  dino: 'frog',
  fish: 'penguin',
  blowfish: 'penguin',
  whale: 'penguin',
  dolphin: 'penguin',
  octopus: 'alien',
  crab: 'raccoon',
  gorilla: 'monkey',
  computer: 'robot',
  laptop: 'robot',
  gamepad: 'robot',
  joystick: 'robot',
  tv: 'robot',
  rocket: 'robot',
  film: 'ghost',
}

function hashSeed(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index++)
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  return Math.abs(hash)
}

type AvatarSource = Pick<User, 'id' | 'preferences'>

/** The chosen avatar id, a legacy id mapped to a character, or a stable one from the user id. */
export function avatarFor(user: AvatarSource): string {
  const chosen = user.preferences.avatar
  if (chosen === CUSTOM_AVATAR_ID && customAvatar(user.id)) return CUSTOM_AVATAR_ID
  if (chosen && isAvatarId(chosen)) return chosen
  if (chosen && chosen in LEGACY) return LEGACY[chosen]
  return AVATAR_IDS[hashSeed(user.id) % AVATAR_IDS.length]
}

/** Background pick, or undefined to keep the character's own. */
export function avatarBgFor(user: AvatarSource): BackgroundId | undefined {
  const chosen = user.preferences.avatarBg
  return isBackgroundId(chosen) ? chosen : undefined
}

export function avatarVariantFor(user: AvatarSource): number {
  const id = avatarFor(user)
  const chosen = user.preferences.avatarVariant
  if (!isAvatarId(id)) return 0
  return Number.isInteger(chosen) && (chosen as number) >= 0 && (chosen as number) < variantCount(id)
    ? (chosen as number)
    : 0
}

/** Everything needed to draw a user's avatar. */
export function avatarLookFor(user: AvatarSource) {
  return { id: avatarFor(user), bg: avatarBgFor(user), variant: avatarVariantFor(user) }
}

/** The picture itself (character on its background, or the uploaded image), filling its box. */
export function AvatarArt({
  id,
  bg,
  variant,
  userId,
  className,
}: {
  id: string
  bg?: BackgroundId
  variant?: number
  userId?: string
  className?: string
}) {
  if (id === CUSTOM_AVATAR_ID && userId) {
    const src = customAvatar(userId)
    if (src)
      return (
        <img
          src={src}
          alt=""
          draggable={false}
          className={cn('size-full rounded-full object-cover', className)}
        />
      )
  }
  const character = isAvatarId(id) ? id : AVATAR_IDS[0]
  return (
    <AvatarFigure
      id={character}
      bg={bg}
      variant={variant}
      className={cn('block size-full', className)}
    />
  )
}

export function UserAvatar({ user, className }: { user: AvatarSource; className?: string }) {
  const look = avatarLookFor(user)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-active ring-1 ring-line ring-inset',
        className,
      )}
    >
      <AvatarArt {...look} userId={user.id} />
    </span>
  )
}
