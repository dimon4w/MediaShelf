import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from './types'
import { mediaItemSchema } from './library'

const cache = new Map<string, { item: MediaItem; until: number }>()
const requests = new Map<string, Promise<MediaItem[]>>()
export function useCatalogDetails(items: MediaItem[], country: string) {
  const itemsRef = useRef(items)
  itemsRef.current = items
  const ids = [...new Set(items.map((i) => i.id))].sort().join(',')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let alive = true
    const missing = ids
      .split(',')
      .filter((id) => id && (cache.get(`${country}:${id}`)?.until ?? 0) < Date.now())
    for (let index = 0; index < missing.length; index += 8) {
      const batch = missing.slice(index, index + 8)
      const key = `${country}:${batch.join(',')}`
      let request = requests.get(key)
      if (!request) {
        request = fetch(`/api/details?${new URLSearchParams({ ids: batch.join(','), country })}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            batch.flatMap((id) => itemsRef.current.find((i) => i.id === id) ?? []),
          ),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error('Metadata unavailable')
            const data = await response.json()
            return Array.isArray(data.items)
              ? (data.items.filter(
                  (v: unknown) => mediaItemSchema.safeParse(v).success,
                ) as MediaItem[])
              : []
          })
          .then((values) => {
            values.forEach((item) =>
              cache.set(`${country}:${item.id}`, { item, until: Date.now() + 15 * 60000 }),
            )
            return values
          })
          .finally(() => requests.delete(key))
        requests.set(key, request)
      }
      void request
        .then(() => {
          if (alive) setRevision((v) => v + 1)
        })
        .catch(() => undefined)
    }
    return () => {
      alive = false
    }
  }, [ids, country])
  void revision
  return (item: MediaItem) => {
    const data = cache.get(`${country}:${item.id}`)?.item
    return data ? { ...item, ...data } : item
  }
}
