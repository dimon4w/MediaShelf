import type { ApiErrorBody, ErrorCode } from '@shared/types.ts'

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | 'NETWORK'
  readonly fields: Record<string, string>

  constructor(
    status: number,
    code: ErrorCode | 'NETWORK',
    message: string,
    fields: Record<string, string> = {},
  ) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T>(
  method: Method,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(method !== 'GET' && method !== 'DELETE' ? { 'Content-Type': 'application/json' } : {}),
      },
      body:
        body === undefined
          ? method === 'POST' || method === 'PUT' || method === 'PATCH'
            ? '{}'
            : undefined
          : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK', 'Network error')
  }
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? response.statusText,
      error?.fields,
    )
  }
  return data as T
}

export const get = <T>(path: string, signal?: AbortSignal) => api<T>('GET', path, undefined, signal)

export function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  const text = search.toString()
  return text ? `?${text}` : ''
}
