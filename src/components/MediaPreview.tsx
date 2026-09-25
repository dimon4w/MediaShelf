import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { MediaItem } from '../lib/types'
import { useReducedMotion } from 'motion/react'

export default function MediaPreview({
  item,
  onClose,
  onOpen,
}: {
  item: MediaItem
  onClose: () => void
  onOpen: () => void
}) {
  const [index, setIndex] = useState(0)
  const [videoFailed, setVideoFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const shots = item.screenshots ?? []
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion()
  const calm = reduced || document.documentElement.classList.contains('calm-mode')
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', close, true)
    const outside = (e: PointerEvent) => {
      if (!root.current?.closest('.poster-stage')?.contains(e.target as Node)) onClose()
    }
    const pause = () => {
      if (document.hidden) video.current?.pause()
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) video.current?.pause()
      },
      { threshold: 0.1 },
    )
    if (root.current) observer.observe(root.current)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('visibilitychange', pause)
    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', close, true)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('visibilitychange', pause)
    }
  }, [onClose])
  return (
    <div ref={root} className="media-preview" aria-label={`Предпросмотр: ${item.title}`}>
      <div className="preview-heading">
        <span>Предпросмотр</span>
        <button className="icon-button" onClick={onClose} aria-label="Закрыть предпросмотр">
          <X size={17} />
        </button>
      </div>
      <div className="preview-picture">
        {item.previewVideo && !videoFailed ? (
          <video
            ref={video}
            src={item.previewVideo}
            autoPlay={!calm}
            muted
            playsInline
            controls
            preload="metadata"
            aria-label={`Видео: ${item.title}`}
            onError={() => setVideoFailed(true)}
          />
        ) : shots.length && !imageFailed ? (
          <img
            src={shots[index]}
            alt={`Кадр из «${item.title}»`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <p>Предпросмотр недоступен</p>
        )}
      </div>
      <div className="preview-copy">
        <strong>{item.title}</strong>
      </div>
      {shots.length > 1 && (!item.previewVideo || videoFailed) && (
        <div className="preview-navigation">
          <button
            className="icon-button"
            aria-label="Предыдущий кадр"
            onClick={() => {
              setIndex((index - 1 + shots.length) % shots.length)
              setImageFailed(false)
            }}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {index + 1} / {shots.length}
          </span>
          <button
            className="icon-button"
            aria-label="Следующий кадр"
            onClick={() => {
              setIndex((index + 1) % shots.length)
              setImageFailed(false)
            }}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      )}
      <button className="text-button preview-open" onClick={onOpen}>
        Открыть произведение
      </button>
    </div>
  )
}
