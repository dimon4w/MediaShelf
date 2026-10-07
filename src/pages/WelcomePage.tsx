import { ArrowLeft, ArrowRight, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AVATAR_COLORS } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import {
  AVATARS,
  AVATAR_COLOR_HEX,
  AvatarArt,
  CUSTOM_AVATAR_ID,
  avatarColorFor,
  avatarFor,
} from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { AccountsList } from '@/components/SteamAccount'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import {
  customAvatar,
  fileToAvatar,
  isOnboarded,
  markOnboarded,
  saveCustomAvatar,
} from '@/lib/device'
import { useUpdateProfile, useUser } from '@/lib/queries'
import { Row } from './settings/layout'

const STEPS = 2

function Shell({
  step,
  title,
  text,
  children,
}: {
  step: number
  title: string
  text?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <>
      <PageHeader title={t('welcome.title')} />
      <PageBody className="max-w-xl pb-16">
        <div className="flex gap-1.5 pt-4" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= step ? 'bg-fg' : 'bg-line',
              )}
            />
          ))}
        </div>
        <h1 className="display mt-6 text-3xl">{title}</h1>
        {text ? <p className="mt-2 text-md text-fg-2">{text}</p> : null}
        <div className="mt-8 animate-rise" key={step}>
          {children}
        </div>
      </PageBody>
    </>
  )
}

function AvatarStep({ onNext, onBack }: { onNext(): void; onBack(): void }) {
  const { t } = useI18n()
  const user = useUser()!
  const update = useUpdateProfile()
  const file = useRef<HTMLInputElement>(null)
  const current = avatarFor(user)
  const currentColor = avatarColorFor(user)
  const custom = customAvatar(user.id)

  const pick = (avatar: string) => {
    if (update.isPending) return
    update.mutate({ preferences: { avatar } }, { onError: () => toast.error(t('errors.generic')) })
  }

  const upload = async (chosen: File | undefined) => {
    if (!chosen) return
    try {
      const dataUrl = await fileToAvatar(chosen)
      saveCustomAvatar(user.id, dataUrl)
      pick(CUSTOM_AVATAR_ID)
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <Shell step={0} title={t('welcome.avatarTitle')} text={t('welcome.avatarText')}>
      <div className="flex flex-col items-center gap-3">
        <span className="grid size-28 place-items-center overflow-hidden rounded-full bg-active ring-2 ring-line ring-inset">
          <AvatarArt id={current} color={currentColor} userId={user.id} className="size-[62%]" />
        </span>
        <p className="text-sm text-fg-3">
          {(AVATAR_COLORS as readonly string[]).includes(currentColor)
            ? t(`settings.colors.${currentColor as (typeof AVATAR_COLORS)[number]}`)
            : null}
        </p>
        <Button variant="secondary" size="sm" onClick={() => file.current?.click()}>
          <Upload />
          {t('welcome.upload')}
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
      <Row title={t('settings.avatar')} description={t('welcome.avatarHint')}>
        <div role="radiogroup" aria-label={t('settings.avatar')} className="grid grid-cols-8 gap-2">
          {custom ? (
            <button
              key={CUSTOM_AVATAR_ID}
              type="button"
              role="radio"
              aria-checked={current === CUSTOM_AVATAR_ID}
              disabled={update.isPending}
              onClick={() => pick(CUSTOM_AVATAR_ID)}
              className={cn(
                'grid aspect-square place-items-center overflow-hidden rounded-lg bg-raised ring-1 transition-colors',
                current === CUSTOM_AVATAR_ID
                  ? 'ring-2 ring-fg'
                  : 'ring-line hover:bg-hover hover:ring-line-strong',
              )}
            >
              <AvatarArt
                id={CUSTOM_AVATAR_ID}
                color={currentColor}
                userId={user.id}
                className="size-[62%]"
              />
            </button>
          ) : null}
          {AVATARS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={current === id}
              disabled={update.isPending}
              onClick={() => pick(id)}
              className={cn(
                'grid aspect-square place-items-center rounded-lg bg-raised ring-1 transition-colors',
                current === id
                  ? 'ring-2 ring-fg'
                  : 'ring-line hover:bg-hover hover:ring-line-strong',
              )}
            >
              <AvatarArt id={id} color={currentColor} className="size-[62%]" />
            </button>
          ))}
        </div>
      </Row>
      <Row title={t('settings.avatarColor')}>
        <div
          role="radiogroup"
          aria-label={t('settings.avatarColor')}
          className="flex flex-wrap gap-2"
        >
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={currentColor === color}
              title={t(`settings.colors.${color}`)}
              disabled={update.isPending}
              onClick={() => {
                if (update.isPending) return
                update.mutate({ preferences: { avatarColor: color } })
              }}
              className={cn(
                'size-9 rounded-full ring-1 transition-transform hover:scale-105',
                currentColor === color
                  ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel'
                  : 'ring-line',
              )}
              style={{ backgroundColor: AVATAR_COLOR_HEX[color] }}
            />
          ))}
        </div>
      </Row>
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          {t('welcome.back')}
        </Button>
        <Button variant="primary" onClick={onNext} loading={update.isPending}>
          {t('welcome.next')}
          <ArrowRight />
        </Button>
      </div>
    </Shell>
  )
}

function StoresStep({ onBack, onDone }: { onBack(): void; onDone(): void }) {
  const { t } = useI18n()
  const user = useUser()!
  return (
    <Shell step={1} title={t('welcome.storesTitle')} text={t('welcome.storesText')}>
      <AccountsList user={user} />
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          {t('welcome.back')}
        </Button>
        <Button variant="primary" onClick={onDone}>
          {t('welcome.finish')}
        </Button>
      </div>
    </Shell>
  )
}

export default function WelcomePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const user = useUser()
  const [step, setStep] = useState(() => (params.get('step') === 'stores' ? 1 : 0))
  const toasted = useRef(false)

  // Coming back from Steam: confirm once and clean the URL.
  useEffect(() => {
    if (!user || toasted.current || params.get('steam') !== 'connected') return
    toasted.current = true
    toast(t('welcome.connected'))
    const next = new URLSearchParams(params)
    next.delete('steam')
    setParams(next, { replace: true })
  }, [user, params, setParams, t])

  if (!user) return null
  if (isOnboarded(user.id)) return <Navigate to="/" replace />

  const done = () => {
    markOnboarded(user.id)
    navigate('/', { replace: true })
  }

  return step === 0 ? (
    <AvatarStep onNext={() => setStep(1)} onBack={() => navigate('/', { replace: true })} />
  ) : (
    <StoresStep onBack={() => setStep(0)} onDone={done} />
  )
}
