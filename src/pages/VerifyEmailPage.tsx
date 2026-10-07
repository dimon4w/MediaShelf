import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BrandMark } from '@/app/Brand'
import { Button, Spinner } from '@/components/ui/button'
import { useI18n, type MessageKey } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { useRegisterVerify } from '@/lib/queries'

/** Landing for the one-click email button: verifies the code from the URL. */
export default function VerifyEmailPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const verify = useRegisterVerify()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  useDocumentTitle(t('verify.title'))

  const email = params.get('email') ?? ''
  const code = params.get('code') ?? ''

  useEffect(() => {
    if (started.current || !email || !/^\d{6}$/.test(code)) {
      if (!started.current && (!email || !/^\d{6}$/.test(code))) setError(t('verify.badLink'))
      return
    }
    started.current = true
    verify.mutate(
      { email, code, locale, theme: 'system' },
      {
        onSuccess: () => setTimeout(() => navigate('/welcome', { replace: true }), 600),
        onError: (error) => {
          if (error instanceof ApiError)
            setError(
              t(
                error.code === 'NETWORK'
                  ? 'errors.network'
                  : (`errors.${error.code}` as MessageKey),
              ),
            )
          else setError(t('errors.generic'))
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-panel">
      <main className="flex flex-1 items-start justify-center px-5 pt-[12vh] pb-16">
        <div className="w-full max-w-[320px] animate-rise text-center">
          <BrandMark className="mx-auto size-10" />
          <h1 className="display mt-6 text-3xl">{t('verify.title')}</h1>
          {error ? (
            <>
              <p role="alert" className="mt-3 text-base text-danger">
                {error}
              </p>
              <Button asChild variant="primary" className="mt-6">
                <Link to="/register">{t('verify.backToRegister')}</Link>
              </Button>
            </>
          ) : (
            <div className="mt-8 grid place-items-center gap-4">
              <Spinner />
              <p className="text-md text-fg-2">{t('verify.checking')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
