import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { STORES, type StoreId, type User } from '@shared/types.ts'
import { BrandIcon } from '@/components/BrandIcon'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/misc'
import { useI18n, type MessageKey } from '@/i18n'
import { ApiError, api } from '@/lib/api'
import { keys } from '@/lib/queries'

const CONNECTABLE: StoreId[] = ['steam']

/** Keyless import is partial; the full list needs a site-wide Steam Web API key. */
function SteamKeyHelp() {
  const { t } = useI18n()
  return (
    <details className="group mt-3 rounded-lg bg-panel px-3 py-2 ring-1 ring-line ring-inset">
      <summary className="cursor-pointer list-none text-sm text-fg-2 marker:content-none">
        {t('welcome.steamKeyHelp')}
      </summary>
      <p className="mt-2 text-sm text-fg-3">{t('welcome.steamKeyWhy')}</p>
      <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm text-fg-3">
        <li>{t('welcome.steamKeyStep1')}</li>
        <li>{t('welcome.steamKeyStep2')}</li>
        <li>{t('welcome.steamKeyStep3')}</li>
        <li>{t('welcome.steamKeyStep4')}</li>
      </ol>
      <p className="mt-2 text-sm text-fg-3">{t('welcome.steamKeyProfile')}</p>
      <a
        href="https://steamcommunity.com/dev/apikey"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex text-sm font-medium text-fg underline-offset-4 hover:underline"
      >
        {t('welcome.steamKeyOpen')}
      </a>
    </details>
  )
}

function SteamCard({ user }: { user: User }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const [busy, setBusy] = useState<'unlink' | 'import' | null>(null)
  const steamId = user.preferences.steamId

  const unlink = async () => {
    setBusy('unlink')
    try {
      await api('DELETE', '/me/steam')
      await client.invalidateQueries({ queryKey: keys.session })
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  const importLibrary = async () => {
    setBusy('import')
    try {
      const result = await api<{
        total: number
        imported: number
        skipped: number
        partial: boolean
      }>('POST', '/me/steam/import')
      await client.invalidateQueries({ queryKey: keys.library })
      toast(
        result.partial
          ? t('welcome.importPartial', { imported: result.imported })
          : t('welcome.importDone', { imported: result.imported, total: result.total }),
      )
    } catch (error) {
      toast.error(
        error instanceof ApiError ? t(`errors.${error.code}` as MessageKey) : t('errors.generic'),
      )
    } finally {
      setBusy(null)
    }
  }

  if (!steamId)
    return (
      <div className="mt-3">
        <p className="text-sm text-fg-2">{t('welcome.steamHint')}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => {
            window.location.href = '/api/auth/steam/start'
          }}
        >
          {t('welcome.steamConnect')}
        </Button>
        <SteamKeyHelp />
      </div>
    )

  return (
    <div className="mt-2">
      <p className="truncate text-sm text-fg-3">ID {steamId}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={busy === 'import'}
          disabled={busy !== null}
          onClick={() => void importLibrary()}
        >
          {t('welcome.steamImport')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={busy === 'unlink'}
          disabled={busy !== null}
          onClick={() => void unlink()}
        >
          {t('welcome.steamUnlink')}
        </Button>
      </div>
      <SteamKeyHelp />
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
          <div key={store} className="rounded-xl bg-raised px-4 py-3.5 ring-1 ring-line ring-inset">
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
