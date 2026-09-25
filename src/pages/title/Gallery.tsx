import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SectionHeader } from '@/components/ui/misc'
import { useI18n } from '@/i18n'

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const { t } = useI18n()
  const [index, setIndex] = useState<number | null>(null)
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const shown = images.filter((src) => !failed.has(src)).slice(0, 12)
  if (!shown.length) return null
  const move = (step: number) =>
    setIndex((value) => (value === null ? null : (value + step + shown.length) % shown.length))
  return (
    <section aria-labelledby="gallery-heading">
      <SectionHeader id="gallery-heading" title={t('title.screenshots')} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setIndex(i)}
            className="group relative aspect-video overflow-hidden rounded-lg bg-raised ring-1 ring-line-subtle ring-inset"
            aria-label={`${t('title.screenshots')} ${i + 1}`}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailed((set) => new Set(set).add(src))}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      <Dialog open={index !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent title={title} size="xl" className="bg-black p-0 sm:p-0" hideTitle>
          {index !== null ? (
            <div
              className="relative"
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') move(1)
                if (event.key === 'ArrowLeft') move(-1)
              }}
            >
              <img
                src={shown[index]}
                alt=""
                referrerPolicy="no-referrer"
                className="aspect-video w-full rounded-xl object-contain"
              />
              {shown.length > 1 ? (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full"
                    onClick={() => move(-1)}
                    aria-label={t('common.back')}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full"
                    onClick={() => move(1)}
                    aria-label={t('common.more')}
                  >
                    <ChevronRight />
                  </Button>
                  <span className="tabular absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                    {index + 1} / {shown.length}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function TrailerDialog({
  trailer,
  open,
  onOpenChange,
  title,
}: {
  trailer: { type: 'youtube'; id: string } | { type: 'video'; url: string; poster?: string }
  open: boolean
  onOpenChange(open: boolean): void
  title: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} size="xl" className="bg-black p-0 sm:p-0" hideTitle>
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {open ? (
            trailer.type === 'youtube' ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.id)}?autoplay=1&rel=0&modestbranding=1`}
                title={title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="size-full"
              />
            ) : (
              <video
                src={trailer.url}
                poster={trailer.poster}
                controls
                autoPlay
                playsInline
                className="size-full"
              />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
