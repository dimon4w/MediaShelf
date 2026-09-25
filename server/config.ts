import { resolve } from 'node:path'

export interface Config {
  host: string
  port: number
  dev: boolean
  dataDir: string
  /** SQLite file, or ':memory:' in tests. */
  dbFile: string
  distDir: string
  allowRegistration: boolean
  sessionDays: number
  /** Honour X-Forwarded-* headers (only behind a reverse proxy you control). */
  trustProxy: boolean
  cookieSecure: 'auto' | 'always' | 'never'
  catalogMode: 'live' | 'fixtures'
  /** Extra origins allowed to send mutating requests, e.g. https://media.example.com */
  allowedOrigins: string[]
}

function flag(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function argValue(argv: string[], name: string) {
  const index = argv.indexOf(name)
  if (index >= 0) return argv[index + 1]
  return argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1)
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): Config {
  const dev = argv.includes('--dev') || env.NODE_ENV === 'development'
  const port = Number(argValue(argv, '--port') ?? env.PORT ?? (dev ? 4174 : 4173))
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid PORT: ${port}`)
  const root = resolve(import.meta.dirname, '..')
  const dataDir = resolve(root, env.DATA_DIR || 'data')
  const sessionDays = Number(env.SESSION_DAYS ?? 30)
  const cookieSecure = (env.COOKIE_SECURE ?? 'auto').toLowerCase()
  return {
    host: argValue(argv, '--host') ?? env.HOST ?? '127.0.0.1',
    port,
    dev,
    dataDir,
    dbFile:
      env.DB_FILE === ':memory:' ? ':memory:' : resolve(dataDir, env.DB_FILE || 'mediashelf.db'),
    distDir: resolve(root, 'dist'),
    allowRegistration: flag(env.ALLOW_REGISTRATION, true),
    sessionDays: Number.isFinite(sessionDays) && sessionDays >= 1 ? Math.min(sessionDays, 365) : 30,
    trustProxy: flag(env.TRUST_PROXY, false),
    cookieSecure:
      cookieSecure === 'true' || cookieSecure === 'always'
        ? 'always'
        : cookieSecure === 'false' || cookieSecure === 'never'
          ? 'never'
          : 'auto',
    catalogMode: env.CATALOG_MODE === 'fixtures' ? 'fixtures' : 'live',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  }
}
