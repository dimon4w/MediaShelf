import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Monitor, Smartphone, Tablet } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { passwordChangeSchema } from '@shared/schemas.ts'
import type { SessionInfo, User } from '@shared/types.ts'
import { useErrorMessage } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { Field, PasswordInput } from '@/components/ui/input'
import { Badge, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { keys, useSessions } from '@/lib/queries'
import { useFormErrors, type FormErrors } from './forms'
import { Group, GroupFooter, SectionHeading } from './layout'
import { describeUserAgent } from './user-agent'

const FIELDS = ['currentPassword', 'newPassword'] as const
const EMPTY = { currentPassword: '', newPassword: '' }

function PasswordForm({ email }: { email: string }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const errorsOf = useFormErrors(FIELDS)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<FormErrors<(typeof FIELDS)[number]>>({})
  const change = useMutation({
    mutationFn: (input: typeof EMPTY) => api<{ ok: true }>('POST', '/me/password', input),
  })

  const set = (key: (typeof FIELDS)[number], value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = passwordChangeSchema.safeParse(values)
    if (!parsed.success) return setErrors(errorsOf.fromIssues(parsed.error.issues))
    setErrors({})
    change.mutate(parsed.data, {
      onSuccess: () => {
        toast(t('settings.passwordChanged'))
        setValues(EMPTY)
        void client.invalidateQueries({ queryKey: keys.sessions })
      },
      onError: (error) => setErrors(errorsOf.fromError(error)),
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* Lets password managers attach the change to the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Group title={t('settings.password')}>
        <div className="grid items-start gap-4 px-4 py-5 sm:px-5 @lg:grid-cols-2">
          <Field label={t('settings.currentPassword')} error={errors.currentPassword}>
            {(props) => (
              <PasswordInput
                {...props}
                name="current-password"
                autoComplete="current-password"
                value={values.currentPassword}
                onChange={(event) => set('currentPassword', event.target.value)}
              />
            )}
          </Field>
          <Field
            label={t('settings.newPassword')}
            error={errors.newPassword}
            hint={t('auth.passwordHint')}
          >
            {(props) => (
              <PasswordInput
                {...props}
                name="new-password"
                autoComplete="new-password"
                value={values.newPassword}
                onChange={(event) => set('newPassword', event.target.value)}
              />
            )}
          </Field>
        </div>
        <GroupFooter
          note={
            errors.form ? (
              <span role="alert" className="text-danger">
                {errors.form}
              </span>
            ) : (
              t('settings.passwordHint')
            )
          }
        >
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={change.isPending}
            disabled={!values.currentPassword || !values.newPassword}
          >
            {t('settings.changePassword')}
          </Button>
        </GroupFooter>
      </Group>
    </form>
  )
}

function SessionRow({
  session,
  pending,
  onRevoke,
}: {
  session: SessionInfo
  pending: boolean
  onRevoke(): void
}) {
  const { t, fmt } = useI18n()
  const device = describeUserAgent(session.userAgent)
  const label = device.label ?? t('settings.unknownDevice')
  const Icon = device.type === 'mobile' ? Smartphone : device.type === 'tablet' ? Tablet : Monitor
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-raised text-fg-2 ring-1 ring-line ring-inset">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-medium">{label}</span>
          {session.current ? <Badge className="shrink-0">{t('settings.thisDevice')}</Badge> : null}
        </p>
        <p className="flex flex-wrap gap-x-1.5 text-sm text-fg-3">
          <span>{t('settings.lastSeen', { time: fmt.relative(session.lastSeenAt) })}</span>
          <span aria-hidden="true">·</span>
          <span>{t('settings.signedIn', { date: fmt.date(session.createdAt, 'short') })}</span>
        </p>
      </div>
      {!session.current ? (
        <Button
          variant="ghost"
          size="sm"
          loading={pending}
          onClick={onRevoke}
          aria-label={`${t('settings.revoke')}: ${label}`}
        >
          {t('settings.revoke')}
        </Button>
      ) : null}
    </div>
  )
}

function Sessions() {
  const { t } = useI18n()
  const client = useQueryClient()
  const message = useErrorMessage()
  const sessions = useSessions()
  // Returning the refetch keeps the button busy until the list reflects the change.
  const refresh = () => client.invalidateQueries({ queryKey: keys.sessions })
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>('DELETE', `/me/sessions/${encodeURIComponent(id)}`),
    onSuccess: () => toast(t('settings.revoked')),
    onError: (error) => toast.error(message(error)),
    onSettled: refresh,
  })
  const revokeOthers = useMutation({
    mutationFn: () => api<{ ok: true }>('POST', '/me/sessions/revoke-others'),
    onSuccess: () => toast(t('settings.revokedOthers')),
    onError: (error) => toast.error(message(error)),
    onSettled: refresh,
  })

  const list = useMemo(
    () =>
      [...(sessions.data?.sessions ?? [])].sort(
        (a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt.localeCompare(a.lastSeenAt),
      ),
    [sessions.data],
  )
  const others = list.filter((session) => !session.current).length

  return (
    <Group title={t('settings.sessions')} description={t('settings.sessionsHint')}>
      {sessions.isPending ? (
        Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
            aria-hidden="true"
          >
            <Skeleton className="size-9 rounded-lg" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-56 max-w-full" />
            </div>
          </div>
        ))
      ) : sessions.isError ? (
        <GroupFooter
          note={<span className="text-sm text-fg-2">{t('settings.sessionsError')}</span>}
        >
          <Button
            variant="secondary"
            size="sm"
            loading={sessions.isRefetching}
            onClick={() => void sessions.refetch()}
          >
            {t('common.retry')}
          </Button>
        </GroupFooter>
      ) : (
        <>
          {list.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              pending={revoke.isPending && revoke.variables === session.id}
              onRevoke={() => revoke.mutate(session.id)}
            />
          ))}
          <GroupFooter note={others ? null : t('settings.noOtherSessions')}>
            {others ? (
              <Button
                variant="secondary"
                size="sm"
                loading={revokeOthers.isPending}
                onClick={() => revokeOthers.mutate()}
              >
                <LogOut />
                {t('settings.revokeOthers')}
              </Button>
            ) : null}
          </GroupFooter>
        </>
      )}
    </Group>
  )
}

export function SecuritySection({ user }: { user: User }) {
  const { t } = useI18n()
  return (
    <>
      <SectionHeading title={t('settings.security')} text={t('settings.securityText')} />
      <div className="grid gap-10">
        <PasswordForm email={user.email} />
        <Sessions />
      </div>
    </>
  )
}
