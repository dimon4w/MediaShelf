import { mkdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { catalog } from '../src/lib/catalog.ts'

const publicDirectory = new URL('../public/', import.meta.url)
if (!(await stat(publicDirectory)).isDirectory())
  throw new Error('Missing project public directory')
const directory = new URL('covers/', publicDirectory)
await mkdir(directory, { recursive: true })
const force = process.argv.includes('--force')
let index = 0
let failed = false

await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (index < catalog.length) {
      const item = catalog[index++]
      const destination = new URL(`${item.id}.jpg`, directory)
      try {
        if (
          !force &&
          (await stat(destination).then(
            (file) => file.size > 0,
            () => false,
          ))
        ) {
          console.log(`CACHED ${item.id}`)
          continue
        }
        const response = await fetch(item.poster, { signal: AbortSignal.timeout(25000) })
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
          throw new Error(`Invalid image response: ${response.status}`)
        }
        const image = Buffer.from(await response.arrayBuffer())
        if (!image.length || image.length > 10 * 1024 * 1024) throw new Error('Invalid image size')
        const optimized = await sharp(image)
          .rotate()
          .resize({ width: 600, height: 900, fit: 'cover', withoutEnlargement: true })
          .jpeg({ quality: 84, mozjpeg: true })
          .toBuffer()
        await writeFile(destination, optimized)
        console.log(`SAVED ${item.id} (${Math.round(optimized.length / 1024)} KB)`)
      } catch (error) {
        failed = true
        console.error(`FAILED ${item.id}: ${error.message}`)
      }
    }
  }),
)

console.log(`Artwork directory: ${fileURLToPath(directory)}`)
if (failed) process.exitCode = 1
