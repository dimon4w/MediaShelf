import type { Context } from 'hono'
import type { Locale } from '../shared/types.ts'
import type { UserRow } from './auth/users.ts'
import type { SessionRow } from './auth/sessions.ts'
import type { CatalogService, PersistentCache } from './catalog/types.ts'
import type { Config } from './config.ts'
import type { DB } from './db/index.ts'
import { unauthorized } from './http/errors.ts'
import { RateLimiter } from './http/rate-limit.ts'
import type { TitleStore } from './library/titles.ts'
import { parseJson } from './db/index.ts'

export interface AppDeps {
  db: DB
  config: Config
  catalog: CatalogService
  titles: TitleStore
  limits: Limits
  cache: PersistentCache
}

export type AppEnv = {
  Variables: {
    user: UserRow | null
    session: SessionRow | null
  }
}

export type AppContext = Context<AppEnv>

export interface Limits {
  login: RateLimiter
  loginAccount: RateLimiter
  register: RateLimiter
  sensitive: RateLimiter
  catalog: RateLimiter
  library: RateLimiter
  enabled: boolean
}

export function createLimits(enabled: boolean): Limits {
  return {
    login: new RateLimiter(30, 15 * 60_000),
    loginAccount: new RateLimiter(10, 15 * 60_000),
    register: new RateLimiter(10, 60 * 60_000),
    sensitive: new RateLimiter(10, 15 * 60_000),
    catalog: new RateLimiter(300, 60_000),
    library: new RateLimiter(600, 60_000),
    enabled,
  }
}

export function limit(limits: Limits, limiter: keyof Omit<Limits, 'enabled'>, key: string) {
  if (limits.enabled) limits[limiter].hit(key)
}

export function requireUser(c: AppContext): UserRow {
  const user = c.get('user')
  if (!user) throw unauthorized()
  return user
}

/** Locale for catalog content: explicit query → user preference → Accept-Language. */
export function requestLocale(c: AppContext, explicit?: Locale): Locale {
  if (explicit) return explicit
  const user = c.get('user')
  const preferred = user ? parseJson<{ locale?: Locale }>(user.preferences, {}).locale : undefined
  if (preferred) return preferred
  return /^ru\b/i.test(c.req.header('accept-language') ?? '') ? 'ru' : 'en'
}

export function requestRegion(c: AppContext, explicit?: string): string {
  if (explicit) return explicit
  const user = c.get('user')
  return (user && parseJson<{ region?: string }>(user.preferences, {}).region) || 'US'
}
