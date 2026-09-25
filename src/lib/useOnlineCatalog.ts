import { useEffect, useState } from 'react'
import type { DiscoveryOrder, MediaFilter, OnlineCatalogResponse } from './types'
import { mediaItemSchema } from './library'
import { mergeWorks } from './discovery'

const empty: OnlineCatalogResponse = { items: [], sources: [], page: 1, hasMore: false }

export function useOnlineCatalog(
  enabled: boolean,
  type: MediaFilter,
  query: string,
  country = 'US',
  order: DiscoveryOrder = 'popular',
) {
  const key = `${type}:${query.trim()}:${country}:${order}`
  const [pageRequest, setPageRequest] = useState({ key, page: 1 })
  // Reset the stored key as well as the derived page. Otherwise returning to a
  // previous query revives its old page number and skips the first page.
  if (pageRequest.key !== key) setPageRequest({ key, page: 1 })
  const page = pageRequest.key === key ? pageRequest.page : 1
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState({ key: '', data: empty, loading: false, error: '' })

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(
      async () => {
        setState((previous) => ({
          key,
          data: previous.key === key ? previous.data : empty,
          loading: true,
          error: '',
        }))
        try {
          const response = await fetch(
            `/api/catalog?${new URLSearchParams({ type, q: query.trim(), page: String(page), country, order })}`,
            { signal: controller.signal },
          )
          if (!response.ok)
            throw new Error(
              'Не удалось связаться с каталогами. Проверь подключение и попробуй ещё раз.',
            )
          const payload = (await response.json()) as OnlineCatalogResponse
          if (!Array.isArray(payload.items) || !Array.isArray(payload.sources))
            throw new Error('Сервер вернул неожиданный ответ.')
          // Bundled cards have local image aliases; remote cards are validated before rendering.
          const items = payload.items.filter((item) => mediaItemSchema.safeParse(item).success)
          if (controller.signal.aborted) return
          setState((previous) => ({
            key,
            loading: false,
            error: '',
            data: {
              ...payload,
              items: mergeWorks([
                ...new Map(
                  [...(page > 1 && previous.key === key ? previous.data.items : []), ...items].map(
                    (item) => [item.id, item],
                  ),
                ).values(),
              ]),
            },
          }))
        } catch (cause) {
          if (controller.signal.aborted) return
          setState((previous) => ({
            ...previous,
            loading: false,
            error: cause instanceof Error ? cause.message : 'Ошибка подключения.',
          }))
        }
      },
      query.trim() ? 350 : 0,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, key, type, query, page, retry, country, order])

  return {
    ...(state.key === key ? state.data : empty),
    loading: enabled && (state.loading || state.key !== key),
    error: state.key === key ? state.error : '',
    loadMore: () => setPageRequest({ key, page: page + 1 }),
    retry: () => setRetry((value) => value + 1),
  }
}
