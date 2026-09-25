import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import type { ApiErrorBody, ErrorCode } from '../../shared/types.ts'
import { CatalogUnavailableError } from '../catalog/types.ts'

export class ApiError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: ErrorCode
  readonly fields?: Record<string, string>
  readonly headers?: Record<string, string>

  constructor(
    status: ContentfulStatusCode,
    code: ErrorCode,
    message?: string,
    extra: { fields?: Record<string, string>; headers?: Record<string, string> } = {},
  ) {
    super(message ?? code)
    this.status = status
    this.code = code
    this.fields = extra.fields
    this.headers = extra.headers
  }
}

export const notFound = (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message)
export const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'Sign in required')

export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (fields[key]) continue
    fields[key] = /^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid'
  }
  return fields
}

export function errorResponse(error: unknown, c: Context) {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, fields: error.fields },
    }
    for (const [name, value] of Object.entries(error.headers ?? {})) c.header(name, value)
    return c.json(body, error.status)
  }
  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: { code: 'VALIDATION', message: 'Invalid input', fields: zodFields(error) },
    }
    return c.json(body, 400)
  }
  if (error instanceof CatalogUnavailableError) {
    const body: ApiErrorBody = {
      error: { code: 'CATALOG_UNAVAILABLE', message: 'External catalog unavailable' },
    }
    return c.json(body, 503)
  }
  if (error instanceof SyntaxError && /JSON/i.test(error.message)) {
    const body: ApiErrorBody = { error: { code: 'BAD_REQUEST', message: 'Malformed JSON' } }
    return c.json(body, 400)
  }
  console.error('[api] unexpected error', error)
  const body: ApiErrorBody = { error: { code: 'INTERNAL', message: 'Internal server error' } }
  return c.json(body, 500)
}
