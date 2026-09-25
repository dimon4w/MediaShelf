import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../lib/types'
import { getPosterUrl } from '../lib/artwork'
import { ImageOff } from 'lucide-react'

export default function Poster({
  item,
  className = '',
  eager = false,
  onUnavailable,
}: {
  item: MediaItem
  className?: string
  eager?: boolean
  wide?: boolean
  onUnavailable?: () => void
}) {
  const [failed, setFailed] = useState<string[]>([])
  const reported = useRef(false)
  const url = [getPosterUrl(item), item.poster].find((src) => src && !failed.includes(src))
  useEffect(() => {
    if (!url && !reported.current && onUnavailable) {
      reported.current = true
      onUnavailable()
    }
  }, [url, onUnavailable])
  return (
    <div className={`poster-art ${className}`}>
      {!url && (
        <div className="poster-fallback" aria-hidden="true">
          <ImageOff className="poster-fallback-icon" size={24} />
          <strong>{item.title}</strong>
          <span>Обложка недоступна</span>
        </div>
      )}
      {url && (
        <img
          className="poster-image"
          src={url}
          alt=""
          width={600}
          height={900}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={(event) => {
            const image = event.currentTarget
            if (
              Math.min(image.naturalWidth, image.naturalHeight) < 160 &&
              !reported.current &&
              onUnavailable
            ) {
              reported.current = true
              onUnavailable()
            }
          }}
          onError={() => setFailed((previous) => [...previous, url])}
        />
      )}
    </div>
  )
}
