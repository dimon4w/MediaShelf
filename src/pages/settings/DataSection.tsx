import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { ApiErrorBody, User } from '@shared/types.ts'
import { useErrorMessage } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, PasswordInput } from '@/components/ui/input'
import { useI18n, type MessageKey } from '@/i18n'
import { api, ApiError } from '@/lib/api'
import { keys } from '@/lib/queries'
import { Group, Row, SectionHeading } from './layout'

/** Mirrors the server's body limit for /me/import. */
const MAX_IMPORT_BYTES = 25 * 1024 * 1024

function localDate() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

async function downloadExport() {
  let response: Response
  try {
    response = await fetch('/api/me/export', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(
      response.status,
      body?.error.code ?? 'INTERNAL',
      body?.error.message ?? response.statusText,
    )
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition)
  const filename = match
    ? decodeURIComponent(match[1] ?? match[2])
    : `mediashelf-${localDate()}.json`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ExportButton() {
  const { t } = useI18n()
  const message = useErrorMessage()
  const exporter = useMutation({
    mutationFn: downloadExport,
    onError: (error) => toast.error(message(error)),
  })
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={exporter.isPending}
      onClick={() => exporter.mutate()}
    >
      <Download />
      {t('settings.exportAction')}
    </Button>
  )
}

const isExportFile = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  ((value as { format?: unknown }).format === 'mediashelf' ||
    (value as { format?: unknown }).format === 'mediadeck')

function ImportButton() {
  const { t } = useI18n()
  const client = useQueryClient()
  const message = useErrorMessage()
  const input = useRef<HTMLInputElement>(null)
  const importer = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ imported: number; skipped: number }>('POST', '/me/import', payload),
    onSuccess: ({ imported, skipped }) => {
      toast(t('settings.importDone', { imported, skipped }))
      for (const queryKey of [keys.library, keys.stats, keys.activity, ['marks']])
        void client.invalidateQueries({ queryKey })
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && (error.code === 'VALIDATION' || error.code === 'BAD_REQUEST')
          ? t('settings.importInvalid')
          : message(error),
      ),
  })

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again still fires `change`.
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) return void toast.error(t('errors.PAYLOAD_TOO_LARGE'))
    let payload: unknown = null
    try {
      payload = JSON.parse(await file.text())
    } catch {
      /* handled below */
    }
    if (!isExportFile(payload)) return void toast.error(t('settings.importInvalid'))
    importer.mutate(payload)
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onFile(event)}
      />
      <Button
        variant="secondary"
        size="sm"
        loading={importer.isPending}
        onClick={() => input.current?.click()}
      >
        <Upload />
        {t('settings.importAction')}
      </Button>
    </>
  )
}

function DeleteAccount({ email }: { email: string }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const navigate = useNavigate()
  const message = useErrorMessage()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)

  // The session is cleared only once this page has unmounted: clearing it while the settings
  // route is still mounted makes its auth guard redirect to /login instead of home.
  useEffect(() => {
    if (!deleted) return
    navigate('/', { replace: true })
    return () => {
      for (const queryKey of [keys.library, keys.stats, keys.activity, keys.sessions, ['marks']])
        client.removeQueries({ queryKey })
      client.setQueryData<{ user: User | null; registrationOpen: boolean }>(keys.session, {
        user: null,
        registrationOpen: true,
      })
    }
  }, [deleted, client, navigate])

  const onOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) {
      setPassword('')
      setError(null)
    }
  }

  const confirm = async () => {
    try {
      await api<{ ok: true }>('POST', '/me/delete', { password })
    } catch (err) {
      const code = err instanceof ApiError ? err.fields.password : undefined
      setError(code ? t(`errors.fields.${code}` as MessageKey) : message(err))
      return
    }
    toast(t('settings.deleted'))
    setOpen(false)
    setDeleted(true)
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-danger" onClick={() => setOpen(true)}>
        <Trash2 />
        {t('settings.deleteAccount')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('settings.deleteConfirmTitle')}
        description={t('settings.deleteConfirmText')}
        confirmLabel={t('settings.deleteAccount')}
        destructive
        disabled={!password}
        onConfirm={confirm}
      >
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field label={t('settings.password')} error={error}>
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(null)
              }}
              autoFocus
            />
          )}
        </Field>
      </ConfirmDialog>
    </>
  )
}

export function DataSection({ user }: { user: User }) {
  const { t } = useI18n()
  return (
    <>
      <SectionHeading title={t('settings.data')} text={t('settings.dataText')} />
      <div className="grid gap-10">
        <Group>
          <Row
            title={t('settings.export')}
            description={t('settings.exportText')}
            action={<ExportButton />}
          />
          <Row
            title={t('settings.import')}
            description={t('settings.importText')}
            action={<ImportButton />}
          />
        </Group>
        <Group>
          <Row
            title={t('settings.danger')}
            description={t('settings.dangerText')}
            action={<DeleteAccount email={user.email} />}
          />
        </Group>
      </div>
    </>
  )
}
