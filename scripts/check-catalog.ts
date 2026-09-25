import { getOnlineCatalog } from '../server/catalog.ts'
import type { MediaFilter } from '../src/lib/types.ts'

let failed = false
for (const [type, query] of [
  ['game', 'portal'],
  ['movie', 'arrival'],
  ['series', 'severance'],
  ['anime', 'Наруто'],
] as [MediaFilter, string][]) {
  const result = await getOnlineCatalog(type, query, 1)
  const ok =
    result.items.length > 0 && result.sources.every((source) => source.status === 'available')
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${result.sources[0].label}: ${result.items.length} results; first: ${result.items[0]?.title ?? 'none'}`,
  )
  if (!ok) failed = true
}
process.exitCode = failed ? 1 : 0
