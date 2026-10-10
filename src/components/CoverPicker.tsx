import { useQueryClient } from '@tanstack/react-query'
import { Check, Heart, ImagePlus, Library, Search, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { User } from '@shared/types.ts'
import { useErrorMessage } from '@/components/library-actions'
import { Poster } from '@/components/Poster'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { ApiError, api } from '@/lib/api'
import { BANNER_GRADIENTS, GRADIENT_BANNERS } from '@/lib/banners'
import { cn } from '@/lib/cn'
import { keys, useLibrary, useUpdateProfile, useUserProfile } from '@/lib/queries'
import { titleName } from '@/lib/titles'

/** Scales a picked file down to a JPEG data URL that fits the server limit comfortably. */
function fileToCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const render = (maxSide: number, quality: number) => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas')
        ctx.fillStyle = '#111'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', quality)
      }
      try {
        let dataUrl = render(1600, 0.82)
        if (dataUrl.length > 1_900_000) dataUrl = render(1280, 0.62)
        resolve(dataUrl)
      } catch (error) {
        reject(error as Error)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

function Tile({
  active,
  label,
  hint,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  label: string
  hint?: string
  onClick(): void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className="group block min-w-0 text-left disabled:opacity-60"
    >
      <span
        className={cn(
          'relative block aspect-[16/9] overflow-hidden rounded-lg bg-raised ring-1 ring-line ring-inset transition-shadow group-hover:ring-line-strong',
          active && 'ring-2 ring-fg group-hover:ring-fg',
        )}
      >
        {children}
        {active ? (
          <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-fg text-panel">
            <Check className="size-3" />
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block truncate text-sm font-medium">{label}</span>
      {hint ? <span className="block truncate text-xs text-fg-3">{hint}</span> : null}
    </button>
  )
}

const Placeholder = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <span className="absolute inset-0 grid place-content-center justify-items-center gap-1 px-2 text-center text-xs text-fg-3 [&_svg]:size-5">
    {icon}
    {text}
  </span>
)

/**
 * Profile cover editor. Every option shows what it will look like: the poster collage, the
 * first favourite's backdrop, a title picked from the library, an uploaded picture, or a colour.
 */
export function CoverPicker({ user }: { user: User }) {
  const { t, locale } = useI18n()
  const client = useQueryClient()
  const update = useUpdateProfile()
  const message = useErrorMessage()
  const profile = useUserProfile(user.id)
  const library = useLibrary()
  const file = useRef<HTMLInputElement>(null)
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [stamp, setStamp] = useState(() => Date.now())
  const [hasCover, setHasCover] = useState<boolean | null>(null)

  const current = user.preferences.banner ?? 'none'
  const posters = profile.data?.heroPosters ?? []
  const favourite = profile.data?.favorites[0]?.title
  const picked = library.data?.find((entry) => entry.titleId === user.preferences.bannerTitleId)
  const coverUrl = `/api/users/${user.id}/cover?v=${stamp}`

  const refresh = () => client.invalidateQueries({ queryKey: keys.profile(user.id) })
  const choose = (preferences: { banner: (typeof user.preferences)['banner']; bannerTitleId?: string }) =>
    update.mutate(
      { preferences },
      { onSuccess: () => void refresh(), onError: (error) => toast.error(message(error)) },
    )

  const upload = async (chosen: File | undefined) => {
    if (!chosen) return
    setBusy(true)
    try {
      await api('PUT', '/me/cover', { dataUrl: await fileToCover(chosen) })
      setStamp(Date.now())
      setHasCover(true)
      choose({ banner: 'image' })
      toast(t('profileLook.toastCoverSaved'))
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === 'PAYLOAD_TOO_LARGE'
          ? t('profileLook.coverTooBig')
          : message(error),
      )
    } finally {
      setBusy(false)
    }
  }

  const removeCover = async () => {
    setBusy(true)
    try {
      await api('DELETE', '/me/cover')
      setHasCover(false)
      if (current === 'image') choose({ banner: 'none' })
      toast(t('profileLook.toastCoverRemoved'))
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  const query = search.trim().toLocaleLowerCase().replaceAll('ё', 'е')
  const matches = (library.data ?? []).filter(
    (entry) =>
      !query ||
      Object.values(entry.title.names).some((name) =>
        name?.toLocaleLowerCase().replaceAll('ё', 'е').includes(query),
      ),
  )

  return (
    <div className="grid gap-5">
      <div role="radiogroup" aria-label={t('profileLook.coverTitle')} className="grid grid-cols-2 items-start gap-x-3 gap-y-4 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
        <Tile
          active={current === 'none'}
          label={t('profileLook.coverCollage')}
          hint={t('profileLook.coverCollageHint')}
          onClick={() => choose({ banner: 'none' })}
        >
          {posters.length ? (
            <span className="absolute -inset-3 grid grid-cols-3 blur-lg saturate-150">
              {posters.slice(0, 3).map((src) => (
                <img key={src} src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
              ))}
            </span>
          ) : null}
          <span className="absolute inset-0 bg-black/20" />
        </Tile>

        <Tile
          active={current === 'favorite'}
          label={t('profileLook.coverFavorite')}
          hint={favourite ? titleName(favourite.names, locale) : undefined}
          onClick={() => choose({ banner: 'favorite' })}
        >
          {favourite?.backdrop ? (
            <img src={favourite.backdrop} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
          ) : (
            <Placeholder icon={<Heart />} text={t('profileLook.coverFavoriteEmpty')} />
          )}
        </Tile>

        <Tile
          active={current === 'title'}
          label={t('profileLook.coverLibrary')}
          hint={picked ? titleName(picked.title.names, locale) : undefined}
          onClick={() => setPicking(true)}
        >
          {picked && (picked.title.backdrop ?? picked.title.poster) ? (
            <img
              src={(picked.title.backdrop ?? picked.title.poster) as string}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <Placeholder icon={<Library />} text={t('profileLook.coverLibraryEmpty')} />
          )}
        </Tile>

        <div className="min-w-0">
          <Tile
            active={current === 'image'}
            label={t('profileLook.coverImage')}
            hint={hasCover ? undefined : t('profileLook.coverImageEmpty')}
            disabled={busy}
            onClick={() => (hasCover ? choose({ banner: 'image' }) : file.current?.click())}
          >
            {hasCover !== false ? (
              <img
                src={coverUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
                onLoad={() => setHasCover(true)}
                onError={() => setHasCover(false)}
              />
            ) : null}
            {!hasCover ? <Placeholder icon={<ImagePlus />} text={t('profileLook.coverImageEmpty')} /> : null}
          </Tile>
          {hasCover ? (
            <div className="mt-1 flex flex-wrap gap-x-1">
              <Button variant="ghost" size="xs" disabled={busy} onClick={() => file.current?.click()}>
                {t('profileLook.coverReplace')}
              </Button>
              <Button variant="ghost" size="xs" disabled={busy} onClick={() => void removeCover()}>
                <Trash2 />
                {t('profileLook.coverRemove')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          void upload(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <div className="grid gap-2">
        <p className="text-sm font-medium">{t('profileLook.coverColors')}</p>
        <div role="radiogroup" aria-label={t('profileLook.coverColors')} className="flex flex-wrap gap-2.5">
          {GRADIENT_BANNERS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={current === id}
              aria-label={t(`profileLook.colorNames.${id}`)}
              title={t(`profileLook.colorNames.${id}`)}
              onClick={() => choose({ banner: id })}
              className={cn(
                'h-9 w-16 rounded-lg ring-1 ring-line transition-transform hover:scale-105',
                current === id && 'ring-2 ring-fg ring-offset-2 ring-offset-panel',
              )}
              style={{ background: BANNER_GRADIENTS[id] }}
            />
          ))}
        </div>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent
          size="lg"
          title={t('profileLook.coverPickTitle')}
          description={t('profileLook.coverPickText')}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('profileLook.coverSearch')}
              className="pl-9"
              autoFocus
            />
          </div>
          {matches.length ? (
            <div className="mt-4 grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5">
              {matches.map((entry) => (
                <button
                  key={entry.titleId}
                  type="button"
                  onClick={() => {
                    choose({ banner: 'title', bannerTitleId: entry.titleId })
                    setPicking(false)
                  }}
                  className="min-w-0 text-left"
                >
                  <Poster
                    src={entry.title.poster}
                    alt={titleName(entry.title.names, locale)}
                    kind={entry.kind}
                    sizes="sm"
                    className={cn(
                      'transition-transform hover:-translate-y-0.5',
                      user.preferences.bannerTitleId === entry.titleId && 'ring-2 ring-fg',
                    )}
                  />
                  <span className="mt-1 line-clamp-2 block text-xs text-fg-2">
                    {titleName(entry.title.names, locale)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-fg-3">
              {library.data?.length ? t('profileLook.coverNoMatch') : t('profileLook.coverNoTitles')}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
