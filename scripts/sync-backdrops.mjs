import { mkdir, access, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const folder = new URL('../public/backdrops/', import.meta.url)
const sources = {
  'movie-dune': 'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
  'game-cyberpunk':
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_2f649b68d579bf87011487d29bc4ccbfdd97d34f.1920x1080.jpg',
}
await mkdir(folder, { recursive: true })
for (const [id, url] of Object.entries(sources)) {
  const output = new URL(`${id}.webp`, folder)
  try {
    if (!process.argv.includes('--force')) {
      await access(output)
      console.log(`Already available: ${id}`)
      continue
    }
  } catch {
    /* Fetch only missing artwork. */
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`${id}: ${response.status}`)
  const input = Buffer.from(await response.arrayBuffer())
  await sharp(input)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 86 })
    .toFile(fileURLToPath(output))
  console.log(`Prepared: ${id}`)
}
await writeFile(new URL('sources.json', folder), JSON.stringify(sources, null, 2) + '\n')
