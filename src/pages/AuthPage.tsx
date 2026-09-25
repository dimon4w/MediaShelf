import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { loginSchema, registerSchema } from '@shared/schemas.ts'
import { BrandMark } from '@/app/Brand'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/input'
import { useI18n, type MessageKey } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { useLogin, useRegister, useSession } from '@/lib/queries'
import { useTheme } from '@/lib/theme'

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t, locale } = useI18n()
  const { preference } = useTheme()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { registrationOpen } = useSession()
  const login = useLogin()
  const register = useRegister()
  const [errors, setErrors] = useState<Errors>({})
  const isLogin = mode === 'login'
  useDocumentTitle(isLogin ? t('nav.signIn') : t('nav.signUp'))

  const next = params.get('next')
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const suffix = next ? `?next=${encodeURIComponent(next)}` : ''

  const fieldError = (code: string | undefined) =>
    code ? t(`errors.fields.${code}` as MessageKey) : undefined

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }
    const parsed = (isLogin ? loginSchema : registerSchema).safeParse(values)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof Errors
        next[key] ??= fieldError(/^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid')
      }
      setErrors(next)
      return
    }
    setErrors({})
    const onError = (error: unknown) => {
      if (error instanceof ApiError) {
        const fields: Errors = {}
        for (const [key, code] of Object.entries(error.fields))
          fields[key as keyof Errors] = fieldError(code)
        setErrors({
          ...fields,
          form: Object.keys(fields).length
            ? undefined
            : t(
                error.code === 'NETWORK'
                  ? 'errors.network'
                  : (`errors.${error.code}` as MessageKey),
              ),
        })
      } else setErrors({ form: t('errors.generic') })
    }
    if (isLogin)
      login.mutate(
        { email: values.email, password: values.password },
        { onSuccess: () => navigate(target, { replace: true }), onError },
      )
    else
      register.mutate(
        { ...values, locale, theme: preference },
        {
          onSuccess: ({ user }) => {
            toast(t('auth.welcome', { name: user.name }))
            navigate(target, { replace: true })
          },
          onError,
        },
      )
  }

  const pending = login.isPending || register.isPending
  const closed = !isLogin && !registrationOpen

  return (
    <div className="flex min-h-dvh flex-col bg-panel">
      <div className="flex h-14 items-center px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft />
            MediaShelf
          </Link>
        </Button>
      </div>
      <main className="flex flex-1 items-start justify-center px-5 pt-[8vh] pb-16">
        <div className="w-full max-w-[380px] animate-rise">
          <BrandMark className="size-10" />
          <h1 className="display mt-6 text-3xl">
            {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
          </h1>
          <p className="mt-2 text-md text-fg-2">
            {isLogin ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
          </p>

          {closed ? (
            <p className="mt-8 rounded-lg bg-raised p-4 text-base text-fg-2 ring-1 ring-line ring-inset">
              {t('auth.closed')}
            </p>
          ) : (
            <form className="mt-8 grid gap-4" onSubmit={onSubmit} noValidate>
              {!isLogin ? (
                <Field label={t('auth.name')} error={errors.name}>
                  {(props) => (
                    <Input
                      {...props}
                      name="name"
                      size="lg"
                      autoComplete="name"
                      placeholder={t('auth.namePlaceholder')}
                      maxLength={60}
                      autoFocus
                    />
                  )}
                </Field>
              ) : null}
              <Field label={t('auth.email')} error={errors.email}>
                {(props) => (
                  <Input
                    {...props}
                    name="email"
                    type="email"
                    size="lg"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    autoFocus={isLogin}
                  />
                )}
              </Field>
              <Field
                label={t('auth.password')}
                error={errors.password}
                hint={!isLogin ? t('auth.passwordHint') : undefined}
              >
                {(props) => (
                  <PasswordInput
                    {...props}
                    name="password"
                    size="lg"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                )}
              </Field>
              {errors.form ? (
                <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                  {errors.form}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-2 w-full"
                loading={pending}
              >
                {isLogin ? t('auth.login') : t('auth.register')}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-fg-2">
            {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <Link
              to={(isLogin ? '/register' : '/login') + suffix}
              className="font-medium text-fg underline-offset-4 hover:underline"
            >
              {isLogin ? t('auth.register') : t('auth.login')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
