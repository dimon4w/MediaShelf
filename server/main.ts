import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import type { CatalogService } from './catalog/types.ts'
import { loadConfig } from './config.ts'
import { createLimits } from './context.ts'
import { pruneCache, sqliteCache } from './db/cache.ts'
import { openDatabase } from './db/index.ts'
import { pruneSessions } from './auth/sessions.ts'
import { TitleStore } from './library/titles.ts'

const config = loadConfig()
const db = openDatabase(config.dbFile)
const cache = sqliteCache(db)

let catalog: CatalogService
if (config.catalogMode === 'fixtures') {
  const { createFixtureCatalog } = await import('./catalog/fixtures.ts')
  catalog = createFixtureCatalog()
} else {
  const { createCatalogService } = await import('./catalog/index.ts')
  catalog = createCatalogService({ cache })
}

const app = createApp({
  db,
  config,
  catalog,
  cache,
  titles: new TitleStore(db),
  limits: createLimits(process.env.DISABLE_RATE_LIMITS !== '1'),
})

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  const host = info.address.includes(':') ? `[${info.address}]` : info.address
  const shown = host === '0.0.0.0' || host === '[::]' ? 'localhost' : host
  console.log(`\n  MediaShelf ${config.dev ? 'API (dev)' : ''} → http://${shown}:${info.port}`)
  console.log(
    `  Data: ${config.dbFile}${config.catalogMode === 'fixtures' ? '  (offline fixtures)' : ''}\n`,
  )
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE')
    console.error(
      `\n  Port ${config.port} is already in use. Is MediaShelf already running?\n  Close it or set another PORT in .env.\n`,
    )
  else console.error(error)
  db.close()
  process.exit(1)
})

const housekeeping = setInterval(() => {
  pruneSessions(db)
  pruneCache(db)
}, 60 * 60_000)
housekeeping.unref()
pruneSessions(db)

let closing = false
function shutdown() {
  if (closing) return
  closing = true
  clearInterval(housekeeping)
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
