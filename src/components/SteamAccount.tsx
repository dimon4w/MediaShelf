import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ExternalLink, KeyRound, LogIn, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { STORES, type StoreId, type User } from '@shared/types.ts'
import { BrandIcon } from '@/components/BrandIcon'
import { useErrorMessage } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chip } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { keys } from '@/lib/queries'

const CONNECTABLE: StoreId[] = ['steam']
const KEY_PATTERN = /^[A-Fa-f0-9]{32}$/
const STEAM_STATUS = ['me', 'steam'] as const

interface SteamStatus {
  steamId: string | null
  importReady: boolean
  /** Last four characters of the user's own Steam key, null without one. */
  ownKeyHint: string | null
  /** The server has a site-wide key, so no personal key is needed. */
  siteKey: boolean
}

interface ImportResult {
  total: number
  imported: number
  existing: number
  failed: number
  partial: boolean
}

/** Steam sends the browser back with ?steam=…; turn that into one clear message. */
function useSteamRedirectResult() {
  const { t } = useI18n()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const result = params.get('steam')
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!result || handled.current === result) return
    handled.current = result
    if (result === 'connected') {
      toast(t('steamConnect.toastConnected'))
      void client.invalidateQueries({ queryKey: keys.session })
      void client.invalidateQueries({ queryKey: STEAM_STATUS })
    } else if (result === 'cancelled') toast(t('steamConnect.toastCancelled'))
    else if (result === 'unreachable') toast.error(t('steamConnect.toastUnreachable'))
    else toast.error(t('steamConnect.toastRejected'))
    const next = new URLSearchParams(params)
    next.delete('steam')
    setParams(next, { replace: true })
  }, [result, params, setParams, client, t])
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'muted' | 'bad' }) {
  return (
    <div className="rounded-lg bg-panel px-3 py-2.5 ring-1 ring-line ring-inset">
      <p
        className={cn(
          'tabular text-xl font-semibold tracking-tight',
          tone === 'bad' && 'text-danger',
          tone === 'muted' && 'text-fg-2',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-fg-3">{label}</p>
    </div>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-active text-2xs font-semibold text-fg-2">
        {n}
      </span>
      <span className="min-w-0 text-sm text-fg-2">{children}</span>
    </li>
  )
}

/** Own Steam Web API key: numbered mini-guide with the paste field right under it. */
function KeyPanel({
  status,
  open,
  onToggle,
}: {
  status: SteamStatus
  open: boolean
  onToggle(): void
}) {
  const { t } = useI18n()
  const client = useQueryClient()
  const message = useErrorMessage()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const trimmed = value.trim()
  const invalid = trimmed.length > 0 && !KEY_PATTERN.test(trimmed)

  const save = async () => {
    if (!KEY_PATTERN.test(trimmed)) return
    setBusy(true)
    try {
      await api('PUT', '/me/steam/key', { key: trimmed })
      setValue('')
      await client.invalidateQueries({ queryKey: STEAM_STATUS })
      toast(t('steamConnect.toastKeySaved'))
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api('DELETE', '/me/steam/key')
      await client.invalidateQueries({ queryKey: STEAM_STATUS })
      toast(t('steamConnect.toastKeyRemoved'))
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg bg-panel ring-1 ring-line ring-inset">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-fg hover:bg-hover"
      >
        <KeyRound className="size-4 text-fg-3" />
        <span className="flex-1">
          {open ? t('steamConnect.keyToggleClose') : t('steamConnect.keyToggleOpen')}
        </span>
        <ChevronDown
          className={cn('size-4 text-fg-3 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-line px-3 py-4">
          <p className="text-sm text-fg-3">{t('steamConnect.keyWhy')}</p>
          <ol className="grid gap-2.5">
            <Step n={1}>
              {t('steamConnect.keyStep1')}{' '}
              <a
                href="https://steamcommunity.com/dev/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-fg underline underline-offset-4"
              >
                {t('steamConnect.keyOpenPage')}
                <ExternalLink className="size-3" />
              </a>
            </Step>
            <Step n={2}>{t('steamConnect.keyStep2')}</Step>
            <Step n={3}>{t('steamConnect.keyStep3')}</Step>
          </ol>
          {status.ownKeyHint ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-raised px-3 py-2 ring-1 ring-line ring-inset">
              <p className="flex items-center gap-2 text-sm text-fg-2">
                <Check className="size-4 text-success" />
                {t('steamConnect.keySaved', { hint: status.ownKeyHint })}
              </p>
              <Button variant="ghost" size="xs" onClick={() => void remove()} disabled={busy}>
                {t('steamConnect.keyRemove')}
              </Button>
            </div>
          ) : null}
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <label htmlFor="steam-key" className="text-sm font-medium">
              {t('steamConnect.keyLabel')}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="steam-key"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={t('steamConnect.keyPlaceholder')}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid || undefined}
                className="font-mono text-sm"
              />
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={!KEY_PATTERN.test(trimmed)}
              >
                {t('steamConnect.keySave')}
              </Button>
            </div>
            {invalid ? <p className="text-sm text-danger">{t('steamConnect.keyInvalid')}</p> : null}
          </form>
        </div>
      ) : null}
    </div>
  )
}

function PartialNotice({ status, onKeyOpen }: { status: SteamStatus; onKeyOpen(): void }) {
  const { t } = useI18n()
  return (
    <div className="grid gap-3 rounded-lg bg-panel p-3.5 ring-1 ring-line ring-inset">
      <div>
        <p className="text-sm font-semibold">{t('steamConnect.partialTitle')}</p>
        <p className="mt-0.5 text-sm text-fg-3">{t('steamConnect.partialText')}</p>
      </div>
      <ol className="grid gap-3">
        <Step n={1}>
          <span className="font-medium text-fg">{t('steamConnect.wayOneTitle')}</span>
          <br />
          {t('steamConnect.wayOneText')}
        </Step>
        <Step n={2}>
          <span className="font-medium text-fg">{t('steamConnect.wayTwoTitle')}</span>
          <br />
          {t('steamConnect.wayTwoText')}{' '}
          {!status.ownKeyHint ? (
            <button
              type="button"
              onClick={onKeyOpen}
              className="font-medium text-fg underline underline-offset-4"
            >
              {t('steamConnect.keyToggleOpen')}
            </button>
          ) : null}
        </Step>
      </ol>
    </div>
  )
}

function ImportPanel({ status }: { status: SteamStatus }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const message = useErrorMessage()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [keyOpen, setKeyOpen] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const done = await api<ImportResult>('POST', '/me/steam/import')
      setResult(done)
      setKeyOpen(done.partial && !status.ownKeyHint && !status.siteKey)
      await client.invalidateQueries({ queryKey: keys.library })
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-semibold">{t('steamConnect.importTitle')}</p>
        <p className="mt-0.5 text-sm text-fg-3">{t('steamConnect.importText')}</p>
      </div>
      <div>
        <Button variant="primary" loading={busy} onClick={() => void run()}>
          {result ? t('steamConnect.importAgain') : t('steamConnect.importButton')}
        </Button>
      </div>
      {result ? (
        <div className="grid gap-3" aria-live="polite">
          <div className="rounded-lg bg-raised p-3 ring-1 ring-line ring-inset">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 text-success" />
                {t('steamConnect.resultTitle')}
              </p>
              <Button variant="ghost" size="xs" onClick={() => setResult(null)}>
                <X />
                {t('steamConnect.resultClose')}
              </Button>
            </div>
            <div className={cn('grid gap-2', result.failed ? 'grid-cols-3' : 'grid-cols-2')}>
              <Stat label={t('steamConnect.resultAdded')} value={result.imported} />
              <Stat label={t('steamConnect.resultExisting')} value={result.existing} tone="muted" />
              {result.failed ? (
                <Stat label={t('steamConnect.resultFailed')} value={result.failed} tone="bad" />
              ) : null}
            </div>
          </div>
          {result.partial ? (
            <PartialNotice status={status} onKeyOpen={() => setKeyOpen(true)} />
          ) : null}
        </div>
      ) : null}
      {!status.siteKey ? (
        <KeyPanel status={status} open={keyOpen} onToggle={() => setKeyOpen((value) => !value)} />
      ) : null}
    </div>
  )
}

function SteamCard({ user }: { user: User }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const steamId = user.preferences.steamId
  useSteamRedirectResult()
  const status = useQuery({
    queryKey: STEAM_STATUS,
    queryFn: () => api<SteamStatus>('GET', '/me/steam'),
    enabled: Boolean(steamId),
    staleTime: 30_000,
  })

  const returnTo = location.pathname.startsWith('/settings') ? 'settings' : 'welcome'
  const unlink = async () => {
    setBusy(true)
    try {
      await api('DELETE', '/me/steam')
      await client.invalidateQueries({ queryKey: keys.session })
      toast(t('steamConnect.toastDisconnected'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  if (!steamId)
    return (
      <div className="mt-4 grid gap-3">
        <p className="text-sm text-fg-2">{t('steamConnect.connectHint')}</p>
        <div>
          <Button
            variant="primary"
            onClick={() => {
              window.location.href = `/api/auth/steam/start?return=${returnTo}`
            }}
          >
            <LogIn />
            {t('steamConnect.signIn')}
          </Button>
        </div>
        <p className="text-xs text-fg-3">{t('steamConnect.signInNote')}</p>
      </div>
    )

  return (
    <div className="mt-4 grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('steamConnect.connectedAs')}</p>
          <p className="tabular truncate text-sm text-fg-3">ID {steamId}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <a
              href={`https://steamcommunity.com/profiles/${steamId}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('steamConnect.openProfile')}
              <ExternalLink />
            </a>
          </Button>
          <Button variant="ghost" size="sm" loading={busy} onClick={() => void unlink()}>
            {t('steamConnect.disconnect')}
          </Button>
        </div>
      </div>
      <div className="border-t border-line pt-5">
        {status.data ? (
          <ImportPanel status={status.data} />
        ) : (
          <div className="h-24 animate-shimmer rounded-lg bg-skeleton" />
        )}
      </div>
    </div>
  )
}

/** Connected accounts: Steam works, the rest are placeholders for later. */
export function AccountsList({ user }: { user: User }) {
  const { t } = useI18n()
  return (
    <div className="grid gap-3">
      {STORES.map((store) => {
        const ready = CONNECTABLE.includes(store)
        const connected = store === 'steam' && user.preferences.steamId
        return (
          <div key={store} className="rounded-xl bg-raised px-4 py-4 ring-1 ring-line ring-inset">
            <div className="flex items-center gap-3">
              <BrandIcon id={store} className="size-6" />
              <p className="flex-1 text-base font-medium">{t(`stores.${store}`)}</p>
              {connected ? (
                <Chip>
                  <Check className="size-3.5" />
                  {t('welcome.connected')}
                </Chip>
              ) : ready ? null : (
                <Chip>{t('welcome.soon')}</Chip>
              )}
            </div>
            {ready ? <SteamCard user={user} /> : null}
          </div>
        )
      })}
    </div>
  )
}
