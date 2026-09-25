import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { handleCatalogRequest } from './catalog.ts'

const root = resolve(import.meta.dirname, '../dist')
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '127.0.0.1'
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')

const server = createServer(async (request, response) => {
  try {
    if (await handleCatalogRequest(request, response)) return
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(405).end()
      return
    }
    const url = new URL(request.url ?? '/', 'http://localhost')
    let file = resolve(root, `.${decodeURIComponent(url.pathname)}`)
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end()
      return
    }
    if (!extname(file)) file = resolve(root, 'index.html')
    const info = await stat(file)
    if (!info.isFile()) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': url.pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    })
    if (request.method === 'HEAD') response.end()
    else
      createReadStream(file)
        .on('error', () => response.destroy())
        .pipe(response)
  } catch {
    if (!response.headersSent)
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Страница не найдена. Сначала выполните npm run build.')
  }
})
server.listen(port, host, () => console.log(`MediaShelf: http://${host}:${port}`))
process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
