import { Heart } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { profilePatchSchema } from '@shared/schemas.ts'
import { AVATAR_COLORS, BANNERS } from '@shared/types.ts'
import type { User } from '@shared/types.ts'
import {
  AVATARS,
  AVATAR_COLOR_HEX,
  AvatarArt,
  UserAvatar,
  avatarColorFor,
  avatarFor,
} from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { bannerBackground } from '@/lib/banners'
import { cn } from '@/lib/cn'
import { useUpdateProfile } from '@/lib/queries'
import { useFormErrors, type FormErrors } from './forms'
import { Group, GroupFooter, Row, SectionHeading } from './layout'

const FIELDS = ['name', 'email', 'currentPassword'] as const

function AvatarPicker({ user }: { user: User }) {
  const { t } = useI18n()
  const update = useUpdateProfile()
  const current = avatarFor(user)
  const currentColor = avatarColorFor(user)
  return (
    <>
      <Row title={t('settings.avatar')} description={t('settings.avatarHint')}>
        <div
          role="radiogroup"
          aria-label={t('settings.avatar')}
          className="grid grid-cols-8 gap-2 sm:grid-cols-10"
        >
          {AVATARS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={current === id}
              disabled={update.isPending}
              onClick={() => update.mutate({ preferences: { avatar: id } })}
              className={cn(
                'grid aspect-square place-items-center rounded-lg bg-raised ring-1 transition-colors',
                current === id
                  ? 'ring-2 ring-fg'
                  : 'ring-line hover:bg-hover hover:ring-line-strong',
              )}
            >
              <AvatarArt id={id} color={currentColor} userId={user.id} className="size-[62%]" />
            </button>
          ))}
        </div>
      </Row>
      <Row title={t('settings.avatarColor')} description={t('settings.avatarColorHint')}>
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
              onClick={() => update.mutate({ preferences: { avatarColor: color } })}
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
      <BannerPicker user={user} />
    </>
  )
}

function BannerPicker({ user }: { user: User }) {
  const { t } = useI18n()
  const update = useUpdateProfile()
  const current = user.preferences.banner ?? 'none'
  return (
    <Row title={t('profile.bannerTitle')} description={t('profile.bannerHint')}>
      <div
        role="radiogroup"
        aria-label={t('profile.bannerTitle')}
        className="grid grid-cols-5 gap-2"
      >
        {BANNERS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={current === id}
            aria-label={t(`profile.banners.${id}`)}
            title={t(`profile.banners.${id}`)}
            disabled={update.isPending}
            onClick={() => update.mutate({ preferences: { banner: id } })}
            className={cn(
              'grid h-10 place-items-center rounded-lg text-white/80 ring-1 transition-[box-shadow,transform] hover:scale-[1.03] [&_svg]:size-4',
              current === id ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel' : 'ring-line',
            )}
            style={{ background: bannerBackground(id) }}
          >
            {id === 'favorite' ? <Heart aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </Row>
  )
}

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
            <UserAvatar user={user} className="size-14" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-[-0.01em]">{user.name}</p>
              <p className="truncate text-base text-fg-2">{user.email}</p>
              <p className="mt-0.5 text-sm text-fg-3">
                {t('settings.memberSince', { date: fmt.date(user.createdAt, 'long') })}
              </p>
            </div>
          </div>
          <AvatarPicker user={user} />
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
