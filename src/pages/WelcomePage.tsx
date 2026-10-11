import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { AvatarPicker } from '@/components/AvatarPicker'
import { Button } from '@/components/ui/button'
import { AccountsList } from '@/components/SteamAccount'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { isOnboarded, markOnboarded } from '@/lib/device'
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

  return (
    <Shell step={0} title={t('welcome.avatarTitle')} text={t('welcome.avatarText')}>
      <Row title={t('settings.avatar')} description={t('profileLook.pickerHint')}>
        <AvatarPicker user={user} />
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
