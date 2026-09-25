import { useState } from 'react'
import type { Kind } from '@shared/types.ts'
import { cn } from '@/lib/cn'
import { KindIcon } from './StatusIcon'

interface PosterProps {
  src: string | null | undefined
  alt: string
  kind: Kind
  className?: string
  sizes?: 'sm' | 'md' | 'lg'
  eager?: boolean
  rounded?: string
}

/** 2:3 poster with a quiet fade-in and a typographic fallback. */
export function Poster({
  src,
  alt,
  kind,
  className,
  sizes = 'md',
  eager,
  rounded = 'rounded-md',
}: PosterProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error')
  const [prevSrc, setPrevSrc] = useState(src)
  if (src !== prevSrc) {
    setPrevSrc(src)
    setState(src ? 'loading' : 'error')
  }
  return (
    <div
      className={cn(
        'relative aspect-[2/3] w-full overflow-hidden bg-raised ring-1 ring-line-subtle ring-inset',
        rounded,
        className,
      )}
    >
      {state !== 'error' && src ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      {state === 'loading' ? (
        <div className="absolute inset-0 animate-shimmer bg-skeleton" />
      ) : null}
      {state === 'error' ? (
        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-raised to-active p-2.5 text-fg-3">
          <KindIcon kind={kind} className={sizes === 'sm' ? 'size-3.5' : 'size-4'} />
          {sizes !== 'sm' ? (
            <span
              className={cn(
                'line-clamp-4 font-semibold tracking-tight text-fg-2',
                sizes === 'lg' ? 'text-xl leading-tight' : 'text-sm leading-snug',
              )}
            >
              {alt}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function Backdrop({
  src,
  className,
}: {
  src: string | null | undefined
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn(
        'object-cover transition-opacity duration-700 ease-out',
        loaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  )
}
