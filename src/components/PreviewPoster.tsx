import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye } from 'lucide-react'
import type { MediaItem } from '../lib/types'
import Poster from './Poster'
import MediaPreview from './MediaPreview'

export default function PreviewPoster({
  item,
  onOpen,
  eager = false,
  onUnavailable,
}: {
  item: MediaItem
  onOpen: () => void
  eager?: boolean
  onUnavailable?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const trigger = useRef<HTMLButtonElement>(null)
  const hasPreview = !!item.previewVideo || !!item.screenshots?.length
  const close = useCallback(() => {
    setOpen(false)
    setPinned(false)
    clearTimeout(timer.current)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <div
      className="poster-stage"
      onPointerEnter={(event) => {
        if (hasPreview && event.pointerType === 'mouse' && matchMedia('(hover: hover)').matches)
          timer.current = setTimeout(() => setOpen(true), 420)
      }}
      onPointerLeave={() => {
        clearTimeout(timer.current)
        if (!pinned) setOpen(false)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <button
        className="card-poster-button"
        onClick={onOpen}
        aria-label={`Подробнее: ${item.title}`}
      >
        <Poster item={item} eager={eager} onUnavailable={onUnavailable} />
      </button>
      {hasPreview && (
        <button
          ref={trigger}
          className="preview-trigger"
          aria-label={`Предпросмотр: ${item.title}`}
          aria-expanded={open}
          onClick={() => {
            clearTimeout(timer.current)
            if (open && pinned) close()
            else {
              setPinned(true)
              setOpen(true)
            }
          }}
        >
          <Eye size={17} />
          <span>Просмотр</span>
        </button>
      )}
      {open && (
        <MediaPreview
          item={item}
          onClose={() => {
            const restore = pinned
            close()
            if (restore) requestAnimationFrame(() => trigger.current?.focus())
          }}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}
