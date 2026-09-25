import { RotateCw } from 'lucide-react'
import { Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'

export function PageFallback() {
  return (
    <div className="px-4 pt-16 sm:px-6 lg:px-8" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-[2/3] rounded-md" />
        ))}
      </div>
    </div>
  )
}

export function RouteError() {
  const error = useRouteError()
  const { t } = useI18n()
  if (import.meta.env.DEV) console.error(error)
  // A new deployment can remove old lazy chunks; a reload fetches the fresh build.
  const chunkError =
    error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message)
  return (
    <div className="grid min-h-dvh place-items-center bg-panel px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('errors.crashTitle')}</h1>
        <p className="mt-2 text-base text-fg-2">{t('errors.crashText')}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCw />
            {t('errors.reload')}
          </Button>
          {!chunkError ? (
            <Button asChild variant="secondary">
              <Link to="/">{t('errors.goHome')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
