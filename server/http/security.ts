import type { Context, MiddlewareHandler } from 'hono'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Config } from '../config.ts'
import { ApiError } from './errors.ts'

export function requestProtocol(c: Context, config: Config): 'http' | 'https' {
  if (config.trustProxy) {
    const forwarded = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
    if (forwarded === 'https' || forwarded === 'http') return forwarded
  }
  return new URL(c.req.url).protocol === 'https:' ? 'https' : 'http'
}

export function clientIp(c: Context, config: Config): string {
  if (config.trustProxy) {
    // The rightmost entry is appended by our own proxy; everything before it is client-controlled.
    const forwarded = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim()
    if (forwarded) return forwarded
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(config: Config): MiddlewareHandler {
  return async (c, next) => {
    await next()
    const headers = c.res.headers
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    if (!config.dev) headers.set('Content-Security-Policy', CSP)
    if (requestProtocol(c, config) === 'https')
      headers.set('Strict-Transport-Security', 'max-age=31536000')
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for the JSON API: state-changing requests must come from this origin
 * (or an explicitly allowed one) and must be JSON, which cross-site forms cannot send.
 */
export function sameOriginOnly(config: Config): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next()
    const origin = c.req.header('origin')
    const isCodespaces =
      (origin && (origin.endsWith('.github.dev') || origin.endsWith('.app.github.dev'))) ||
      c.req.header('x-forwarded-host')?.endsWith('.github.dev') ||
      c.req.header('x-forwarded-host')?.endsWith('.app.github.dev')
    if (isCodespaces) {
      // Codespaces proxy injects sec-fetch-site: cross-site from the iframe/proxy layer.
      return next()
    }
    if (origin) {
      // The node adapter builds the request URL from the Host header.
      const host =
        (config.trustProxy && c.req.header('x-forwarded-host')) || new URL(c.req.url).host
      const expected = `${requestProtocol(c, config)}://${host}`
      if (origin !== expected && !config.allowedOrigins.includes(origin))
        throw new ApiError(403, 'FORBIDDEN', 'Cross-origin request rejected')
    } else {
      const site = c.req.header('sec-fetch-site')
      if (site && site !== 'same-origin' && site !== 'none')
        throw new ApiError(403, 'FORBIDDEN', 'Cross-site request rejected')
    }
    if (c.req.method !== 'DELETE') {
      const type = c.req.header('content-type') ?? ''
      if (!type.toLowerCase().startsWith('application/json'))
        throw new ApiError(415, 'BAD_REQUEST', 'Expected application/json')
    }
    return next()
  }
}
