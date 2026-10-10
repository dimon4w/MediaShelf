import { Dices, Upload } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { AVATAR_BG_IDS, type AvatarBgId, type User } from '@shared/types.ts'
import { AVATARS, AvatarArt, CUSTOM_AVATAR_ID, avatarLookFor } from '@/components/avatar'
import {
  AVATAR_BACKGROUNDS,
  AvatarFigure,
  characterPalette,
  defaultBackground,
  isAvatarId,
  variantCount,
} from '@/components/avatar-art'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { customAvatar, fileToAvatar, saveCustomAvatar } from '@/lib/device'
import { useUpdateProfile } from '@/lib/queries'

const pickRandom = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

const selected = 'ring-2 ring-fg ring-offset-2 ring-offset-panel'

/**
 * Avatar studio: big preview, a grid of characters, a background colour and the character's
 * own colour variants (the way Google's illustrated avatars work).
 */
export function AvatarPicker({ user }: { user: User }) {
  const { t } = useI18n()
  const update = useUpdateProfile()
  const file = useRef<HTMLInputElement>(null)
  const look = avatarLookFor(user)
  const custom = look.id === CUSTOM_AVATAR_ID
  const hasUpload = Boolean(customAvatar(user.id))
  const character = isAvatarId(look.id) ? look.id : null

  const apply = (preferences: {
    avatar?: string
    avatarBg?: AvatarBgId | 'auto'
    avatarVariant?: number
  }) => update.mutate({ preferences }, { onError: () => toast.error(t('errors.generic')) })

  const randomize = () => {
    const avatar = pickRandom(AVATARS)
    apply({
      avatar,
      avatarBg: pickRandom(AVATAR_BG_IDS),
      avatarVariant: Math.floor(Math.random() * variantCount(avatar)),
    })
  }

  const upload = async (chosen: File | undefined) => {
    if (!chosen) return
    try {
      saveCustomAvatar(user.id, await fileToAvatar(chosen))
      apply({ avatar: CUSTOM_AVATAR_ID })
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="size-24 shrink-0 overflow-hidden rounded-full ring-1 ring-line sm:size-28">
          <AvatarArt {...look} userId={user.id} />
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={randomize}>
            <Dices />
            {t('profileLook.random')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => file.current?.click()}>
            <Upload />
            {t('profileLook.upload')}
          </Button>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              void upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </div>

      <section aria-label={t('profileLook.characters')}>
        <div
          role="radiogroup"
          aria-label={t('profileLook.characters')}
          className="grid grid-cols-5 gap-3 sm:grid-cols-7"
        >
          {hasUpload ? (
            <button
              type="button"
              role="radio"
              aria-checked={custom}
              aria-label={t('profileLook.upload')}
              onClick={() => apply({ avatar: CUSTOM_AVATAR_ID })}
              className={cn(
                'aspect-square overflow-hidden rounded-full ring-1 ring-line transition-transform hover:scale-105',
                custom && selected,
              )}
            >
              <AvatarArt id={CUSTOM_AVATAR_ID} userId={user.id} />
            </button>
          ) : null}
          {AVATARS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={look.id === id}
              aria-label={id}
              onClick={() => apply({ avatar: id, avatarVariant: 0 })}
              className={cn(
                'aspect-square overflow-hidden rounded-full ring-1 ring-line transition-transform hover:scale-105',
                look.id === id && selected,
              )}
            >
              <AvatarFigure id={id} bg={look.bg} className="block size-full" />
            </button>
          ))}
        </div>
      </section>

      {character ? (
        <>
          <section className="grid gap-2.5">
            <h4 className="text-sm font-medium">{t('profileLook.background')}</h4>
            <div
              role="radiogroup"
              aria-label={t('profileLook.background')}
              className="flex flex-wrap items-center gap-2.5"
            >
              <Chip active={!look.bg} onClick={() => apply({ avatarBg: 'auto' })}>
                {t('profileLook.backgroundAuto')}
              </Chip>
              {AVATAR_BG_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={look.bg === id}
                  aria-label={t(`profileLook.bgNames.${id}`)}
                  title={t(`profileLook.bgNames.${id}`)}
                  onClick={() => apply({ avatarBg: id })}
                  className={cn(
                    'size-8 rounded-full ring-1 ring-line transition-transform hover:scale-110',
                    look.bg === id && selected,
                  )}
                  style={{ backgroundColor: AVATAR_BACKGROUNDS[id] }}
                />
              ))}
            </div>
          </section>
          <section className="grid gap-2.5">
            <h4 className="text-sm font-medium">{t('profileLook.tint')}</h4>
            <div
              role="radiogroup"
              aria-label={t('profileLook.tint')}
              className="flex flex-wrap items-center gap-2.5"
            >
              {Array.from({ length: variantCount(character) }, (_, index) => {
                const palette = characterPalette(character, index)
                return (
                  <button
                    key={index}
                    type="button"
                    role="radio"
                    aria-checked={look.variant === index}
                    aria-label={`${t('profileLook.tint')} ${index + 1}`}
                    onClick={() => apply({ avatarVariant: index })}
                    className={cn(
                      'size-8 rounded-full ring-1 ring-line transition-transform hover:scale-110',
                      look.variant === index && selected,
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${palette.main} 55%, ${palette.light} 55%)`,
                    }}
                  />
                )
              })}
            </div>
            <p className="sr-only">{defaultBackground(character)}</p>
          </section>
        </>
      ) : null}
    </div>
  )
}
