import { catalog } from '../src/lib/catalog.ts'

const results = await Promise.all(
  catalog.map(async (item) => {
    try {
      const response = await fetch(item.poster, {
        method: 'HEAD',
        signal: AbortSignal.timeout(15000),
      })
      return {
        id: item.id,
        status: response.status,
        ok: response.ok,
        type: response.headers.get('content-type'),
      }
    } catch (error) {
      return { id: item.id, status: error.message, ok: false, type: null }
    }
  }),
)

for (const result of results)
  console.log(`${result.ok ? 'OK' : 'FAIL'} ${result.status} ${result.id} ${result.type ?? ''}`)
if (results.some((result) => !result.ok)) process.exitCode = 1
