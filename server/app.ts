import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { findUserById } from './auth/users.ts'
import {
  clearSessionCookie,
  readSession,
  sessionToken,
  writeSessionCookie,
} from './auth/sessions.ts'
import type { AppDeps, AppEnv } from './context.ts'
import { ApiError, errorResponse } from './http/errors.ts'
import { sameOriginOnly, securityHeaders } from './http/security.ts'
import { authRoutes } from './routes/auth.ts'
import { catalogRoutes } from './routes/catalog.ts'
import { libraryRoutes } from './routes/library.ts'
import { meRoutes } from './routes/me.ts'
import { usersRoutes } from './routes/users.ts'
import { staticFiles } from './static.ts'

const MB = 1024 * 1024

export function createApp(deps: AppDeps) {
  const { db, config } = deps
  const app = new Hono<AppEnv>()
  app.onError(errorResponse)
  app.use('*', securityHeaders(config))
  app.use('*', compress())

  const api = new Hono<AppEnv>()
  api.onError(errorResponse)
  api.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  const smallBody = bodyLimit({
    maxSize: 1 * MB,
    onError: () => {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large')
    },
  })
  const largeBody = bodyLimit({
    maxSize: 25 * MB,
    onError: () => {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large')
    },
  })
  api.use('*', (c, next) =>
    c.req.path === '/api/me/import' ? largeBody(c, next) : smallBody(c, next),
  )
  api.use('*', sameOriginOnly(config))
  api.use('*', async (c, next) => {
    c.set('user', null)
    c.set('session', null)
    const token = sessionToken(c)
    if (token) {
      const before = Date.now()
      const session = readSession(db, config, token)
      const user = session ? findUserById(db, session.user_id) : undefined
      if (session && user) {
        c.set('session', session)
        c.set('user', user)
        // readSession slid the expiry: extend the cookie too.
        if (session.last_seen_at >= before) writeSessionCookie(c, config, token)
      } else {
        clearSessionCookie(c)
      }
    }
    await next()
  })

  api.get('/health', (c) => c.json({ ok: true, version: '4.0.0', catalog: config.catalogMode }))
  api.route('/auth', authRoutes(deps))
  api.route('/me', meRoutes(deps))
  api.route('/library', libraryRoutes(deps))
  api.route('/users', usersRoutes(deps))
  api.route('/', catalogRoutes(deps))
  api.all('*', () => {
    throw new ApiError(404, 'NOT_FOUND', 'Unknown API route')
  })

  app.route('/api', api)
  if (!config.dev) app.use('*', staticFiles(config.distDir))
  return app
}
