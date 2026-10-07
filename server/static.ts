import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { MiddlewareHandler } from 'hono'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

interface CachedFile {
  body: Uint8Array<ArrayBuffer>
  etag: string
  type: string
  mtime: number
}

/** Serves the built SPA. Unknown paths without an extension fall back to index.html. */
export function staticFiles(root: string): MiddlewareHandler {
  const cache = new Map<string, CachedFile>()

  async function load(file: string, immutable: boolean): Promise<CachedFile | null> {
    const hit = cache.get(file)
    if (hit && immutable) return hit
    try {
      const info = await stat(file)
      if (!info.isFile()) return null
      // Non-hashed files (index.html, icons) are re-checked so a rebuild is picked up without a restart.
      if (hit && hit.mtime === info.mtimeMs) return hit
      const body = new Uint8Array(await readFile(file))
      const entry = {
        body,
        etag: `"${createHash('sha1').update(body).digest('base64url').slice(0, 20)}"`,
        type: TYPES[extname(file)] ?? 'application/octet-stream',
        mtime: info.mtimeMs,
      }
      cache.set(file, entry)
      return entry
    } catch {
      cache.delete(file)
      return null
    }
  }

  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next()
    let path: string
    try {
      path = decodeURIComponent(new URL(c.req.url).pathname)
    } catch {
      return c.text('Bad request', 400)
    }
    if (path.startsWith('/api/')) return next()
    const immutable = path.startsWith('/assets/')
    let file = resolve(root, `.${path}`)
    if (file !== root && !file.startsWith(root + sep)) return c.text('Forbidden', 403)
    let found = extname(file) ? await load(file, immutable) : null
    if (!found && !extname(file)) {
      file = resolve(root, 'index.html')
      found = await load(file, false)
    }
    if (!found) {
      if (extname(path)) return c.text('Not found', 404)
      return c.text('MediaDeck is not built yet. Run "npm run build" first.', 503)
    }
    const headers: Record<string, string> = {
      'Content-Type': found.type,
      ETag: found.etag,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    }
    if (c.req.header('if-none-match') === found.etag) return c.body(null, 304, headers)
    if (c.req.method === 'HEAD') return c.body(null, 200, headers)
    return c.body(found.body, 200, headers)
  }
}
