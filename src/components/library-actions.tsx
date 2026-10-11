import { useNavigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import type { EntryPatch } from '@shared/schemas.ts'
import type { LibraryEntry, Status, TitleRecord } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useAddEntry, useRemoveEntry, useUpdateEntry, useUser } from '@/lib/queries'
import { statusLabelKey, titleName } from '@/lib/titles'

/** Failures that usually pass on their own: worth offering "Try again". */
function isTemporary(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === 'NETWORK' || error.code === 'CATALOG_UNAVAILABLE' || error.code === 'INTERNAL')
  )
}

export function useErrorMessage() {
  const { t } = useI18n()
  return (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.code === 'NETWORK') return t('errors.network')
      return t(`errors.${error.code}` as never)
    }
    return t('errors.generic')
  }
}

export function useRequireAuth() {
  const user = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  return () => {
    if (user) return true
    toast(t('common.signInToContinue'))
    navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
    return false
  }
}

/** Library mutations with consistent toasts, undo and auth gating. */
export function useLibraryActions() {
  const { t, locale } = useI18n()
  const requireAuth = useRequireAuth()
  const add = useAddEntry()
  const update = useUpdateEntry()
  const remove = useRemoveEntry()
  const message = useErrorMessage()

  const statusText = (entry: Pick<LibraryEntry, 'kind'>, status: Status) =>
    t(statusLabelKey(entry.kind, status))

  const announce = (change: {
    statusChanged: { from: Status; to: Status } | null
    entry: LibraryEntry
  }) => {
    if (change.statusChanged)
      toast(t('toast.autoStatus', { status: statusText(change.entry, change.statusChanged.to) }))
  }

  return {
    pending: add.isPending || update.isPending || remove.isPending,
    add(title: TitleRecord, status: Status = 'planned') {
      if (!requireAuth()) return
      const attempt = () =>
        add.mutate(
          { title, status },
          {
            onSuccess: ({ entry, created }) =>
              toast(
                created
                  ? t('toast.added')
                  : t('toast.statusChanged', {
                      title: titleName(title.names, locale),
                      status: statusText(entry, status),
                    }),
                {
                  description: created
                    ? `${titleName(title.names, locale)} · ${statusText(entry, status)}`
                    : undefined,
                },
              ),
            onError: (error) =>
              toast.error(
                message(error),
                isTemporary(error)
                  ? { action: { label: t('common.retry'), onClick: attempt } }
                  : undefined,
              ),
          },
        )
      attempt()
    },
    setStatus(entry: LibraryEntry, status: Status, extra: EntryPatch = {}) {
      if (entry.status === status && !Object.keys(extra).length) return
      const previous = entry.status
      update.mutate(
        { titleId: entry.titleId, patch: { status, ...extra } },
        {
          onSuccess: () =>
            toast(
              t('toast.statusChanged', {
                title: titleName(entry.title.names, locale),
                status: statusText(entry, status),
              }),
              {
                action: {
                  label: t('common.undo'),
                  onClick: () =>
                    update.mutate({ titleId: entry.titleId, patch: { status: previous } }),
                },
              },
            ),
          onError: (error) => toast.error(message(error)),
        },
      )
    },
    patch(
      entry: LibraryEntry,
      patch: EntryPatch,
      options: {
        silent?: boolean
        success?: string
        onSuccess?: () => void
        onError?: () => void
      } = {},
    ) {
      update.mutate(
        { titleId: entry.titleId, patch },
        {
          onSuccess: (change) => {
            if (options.success) toast(options.success)
            if (!options.silent) announce(change)
            options.onSuccess?.()
          },
          onError: (error) => {
            toast.error(message(error))
            options.onError?.()
          },
        },
      )
    },
    toggleFavorite(entry: LibraryEntry) {
      const favorite = !entry.favorite
      update.mutate(
        { titleId: entry.titleId, patch: { favorite } },
        {
          onSuccess: () => toast(favorite ? t('toast.favorited') : t('toast.unfavorited')),
          onError: (error) => toast.error(message(error)),
        },
      )
    },
    rate(entry: LibraryEntry, rating: number | null) {
      update.mutate(
        { titleId: entry.titleId, patch: { rating } },
        {
          onSuccess: () => toast(t('toast.rated')),
          onError: (error) => toast.error(message(error)),
        },
      )
    },
    remove(entry: LibraryEntry, onDone?: () => void) {
      // Snapshot everything the delete wipes so Undo can restore the entry as it was.
      const snapshot = {
        title: entry.title,
        patch: {
          status: entry.status,
          rating: entry.rating,
          favorite: entry.favorite,
          progress: entry.progress,
          platform: entry.platform,
          store: entry.store,
          hours: entry.hours,
          notes: entry.notes,
        },
      }
      remove.mutate(entry.titleId, {
        onSuccess: () => {
          toast(t('toast.removed'), {
            description: titleName(entry.title.names, locale),
            action: {
              label: t('common.undo'),
              onClick: () =>
                add.mutate(
                  { title: snapshot.title, status: snapshot.patch.status },
                  {
                    onSuccess: () =>
                      update.mutate(
                        { titleId: entry.titleId, patch: snapshot.patch },
                        { onError: (error) => toast.error(message(error)) },
                      ),
                    onError: (error) => toast.error(message(error)),
                  },
                ),
            },
          })
          onDone?.()
        },
        onError: (error) => toast.error(message(error)),
      })
    },
  }
}
