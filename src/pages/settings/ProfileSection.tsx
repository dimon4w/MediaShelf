import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { profilePatchSchema } from '@shared/schemas.ts'
import type { User } from '@shared/types.ts'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/input'
import { Avatar } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useUpdateProfile } from '@/lib/queries'
import { useFormErrors, type FormErrors } from './forms'
import { Group, GroupFooter, SectionHeading } from './layout'

const FIELDS = ['name', 'email', 'currentPassword'] as const

export function ProfileSection({ user }: { user: User }) {
  const { t, fmt } = useI18n()
  const update = useUpdateProfile()
  const errorsOf = useFormErrors(FIELDS)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors<(typeof FIELDS)[number]>>({})

  const changes = {
    name: name.trim() !== user.name ? name : undefined,
    email: email.trim() !== user.email ? email : undefined,
  }
  // The server asks for the password before an email change.
  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase()
  const dirty = changes.name !== undefined || changes.email !== undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!dirty || update.isPending) return
    const parsed = profilePatchSchema.safeParse({
      ...changes,
      currentPassword: emailChanged ? currentPassword : undefined,
    })
    if (!parsed.success) return setErrors(errorsOf.fromIssues(parsed.error.issues))
    setErrors({})
    update.mutate(parsed.data, {
      onSuccess: ({ user: saved }) => {
        setName(saved.name)
        setEmail(saved.email)
        setCurrentPassword('')
        toast(t('common.saved'))
      },
      onError: (error) => setErrors(errorsOf.fromError(error)),
    })
  }

  const reset = () => {
    setName(user.name)
    setEmail(user.email)
    setCurrentPassword('')
    setErrors({})
  }

  return (
    <>
      <SectionHeading title={t('settings.profile')} text={t('settings.profileText')} />
      <form onSubmit={submit} noValidate>
        <Group>
          <div className="flex items-center gap-4 px-4 py-5 sm:px-5">
            <Avatar name={user.name} className="size-14 text-lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-[-0.01em]">{user.name}</p>
              <p className="truncate text-base text-fg-2">{user.email}</p>
              <p className="mt-0.5 text-sm text-fg-3">
                {t('settings.memberSince', { date: fmt.date(user.createdAt, 'long') })}
              </p>
            </div>
          </div>
          <div className="grid items-start gap-4 px-4 py-5 sm:px-5 @lg:grid-cols-2">
            <Field label={t('settings.name')} error={errors.name}>
              {(props) => (
                <Input
                  {...props}
                  name="name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setErrors(({ name: _name, ...rest }) => rest)
                  }}
                  autoComplete="name"
                  maxLength={60}
                />
              )}
            </Field>
            <Field label={t('settings.email')} error={errors.email} hint={t('settings.emailHint')}>
              {(props) => (
                <Input
                  {...props}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setErrors(({ email: _email, ...rest }) => rest)
                  }}
                  maxLength={254}
                />
              )}
            </Field>
            {emailChanged ? (
              <Field label={t('settings.currentPassword')} error={errors.currentPassword}>
                {(props) => (
                  <PasswordInput
                    {...props}
                    name="currentPassword"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value)
                      setErrors(({ currentPassword: _password, ...rest }) => rest)
                    }}
                  />
                )}
              </Field>
            ) : null}
          </div>
          <GroupFooter
            note={
              errors.form ? (
                <span role="alert" className="text-danger">
                  {errors.form}
                </span>
              ) : null
            }
          >
            {dirty ? (
              <Button variant="ghost" size="sm" onClick={reset} disabled={update.isPending}>
                {t('common.cancel')}
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!dirty}
              loading={update.isPending}
            >
              {t('common.save')}
            </Button>
          </GroupFooter>
        </Group>
      </form>
    </>
  )
}
