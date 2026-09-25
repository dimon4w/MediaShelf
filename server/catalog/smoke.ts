// Live check against the real upstream APIs: `node server/catalog/smoke.ts`.
// Prints a compact summary and exits non-zero when a step throws or returns nothing.
import { CHART_LISTS, KINDS, type Locale, type TitleRecord } from '../../shared/types.ts'
import { createCatalogService } from './service.ts'
import { memoryCache, type CatalogContext } from './types.ts'

const catalog = createCatalogService({ cache: memoryCache() })
const ctx = (locale: Locale, region = 'US'): CatalogContext => ({ locale, region })
let failures = 0

function label(record: TitleRecord, locale: Locale = 'en') {
  const name = record.names[locale] ?? record.names.original
  const alt =
    locale === 'ru' && record.names.ru ? '' : record.names.ru ? ` / ${record.names.ru}` : ''
  const rating = record.ratings[0] ? ` ${record.ratings[0].source}:${record.ratings[0].value}` : ''
  return `${name}${alt} (${record.year ?? '—'})${rating}`
}

async function step(title: string, run: () => Promise<string[] | string>) {
  const started = performance.now()
  try {
    const output = await run()
    const lines = Array.isArray(output) ? output : [output]
    console.log(`✓ ${title} [${Math.round(performance.now() - started)} ms]`)
    for (const line of lines) console.log(`    ${line}`)
  } catch (error) {
    failures++
    console.log(
      `✗ ${title} [${Math.round(performance.now() - started)} ms]: ${(error as Error).message}`,
    )
  }
}

function expectItems<T>(items: T[], what: string): T[] {
  if (!items.length) throw new Error(`no ${what}`)
  return items
}

for (const kind of KINDS) {
  for (const list of CHART_LISTS) {
    await step(`charts ${kind}/${list}`, async () => {
      const page = await catalog.charts(kind, list, 1, ctx('ru'))
      expectItems(page.items, 'items')
      const art = page.items.filter((item) => item.poster).length
      return [
        `${page.items.length} items, hasMore=${page.hasMore}, posters ${art}/${page.items.length}, ru names ${page.items.filter((i) => i.names.ru).length}`,
        ...page.items
          .slice(0, 5)
          .map((item) => `${item.id.padEnd(22)} ${label(item)} [${item.genres.join(', ')}]`),
      ]
    })
  }
}

for (const query of ['witcher', 'интерстеллар']) {
  await step(`search "${query}"`, async () => {
    const result = await catalog.search(query, 'all', ctx('ru'))
    expectItems(result.items, 'results')
    return [
      `${result.items.length} results, failed=[${result.failed.join(', ')}]`,
      ...result.items.map((item) => `${item.id.padEnd(22)} ${item.kind.padEnd(6)} ${label(item)}`),
    ]
  })
}

for (const id of ['steam-1145360', 'movie-tt0816692', 'series-tt0903747', 'anime-52991']) {
  for (const locale of ['ru', 'en'] as const) {
    await step(`details ${id} (${locale})`, async () => {
      const record = await catalog.details(id, ctx(locale, locale === 'ru' ? 'PL' : 'US'))
      if (!record) throw new Error('not found')
      const descriptions = Object.entries(record.descriptions ?? {}).map(
        ([key, text]) => `${key}:${text.length}`,
      )
      return [
        `${label(record, locale)} names=${JSON.stringify(record.names)}`,
        `genres=[${record.genres.join(', ')}] ratings=${record.ratings.map((r) => `${r.source}:${r.value}/${r.max}${r.votes ? `(${r.votes})` : ''}`).join(' ')}`,
        `runtime=${record.runtime ?? '—'} seasons=${record.seasons ?? '—'} episodes=${record.episodes ?? '—'} airing=${record.airing ?? '—'} release=${record.releaseDate ?? '—'}`,
        `poster=${record.poster ?? '—'}`,
        `backdrop=${record.backdrop ?? '—'}`,
        `descriptions=[${descriptions.join(' ')}] creators=[${(record.creators ?? []).join(', ')}] companies=[${(record.companies ?? []).join(', ')}]`,
        `platforms=[${(record.platforms ?? []).join(', ')}] screenshots=${record.screenshots?.length ?? 0} trailer=${record.trailer ? JSON.stringify(record.trailer).slice(0, 120) : '—'}`,
        `links=${(record.links ?? []).map((l) => l.source).join(',')} ids=${JSON.stringify(record.externalIds)}`,
        ...(locale === 'ru' && record.descriptions?.ru
          ? [`ru: ${record.descriptions.ru.slice(0, 140).replace(/\n/g, ' ')}…`]
          : []),
      ]
    })
  }
}

for (const id of ['series-tt0903747', 'anime-52991']) {
  await step(`episodes ${id}`, async () => {
    const list = await catalog.episodes(id, ctx('ru'))
    if (!list) throw new Error('no episode list')
    const first = list.seasons.find((season) => season.number > 0)?.episodes[0]
    return [
      `source=${list.source} ended=${list.ended} seasons=${list.seasons.map((s) => `${s.number}:${s.episodes.length}`).join(' ')}`,
      `first: ${first ? `S${first.season}E${first.number} "${first.name}" ${first.airdate} ${first.runtime}min` : '—'}`,
    ]
  })
}

for (const region of ['US', 'PL']) {
  await step(`offers steam-1145360 ${region}`, async () => {
    const offers = expectItems(await catalog.offers('steam-1145360', region), 'offers')
    return offers.map(
      (offer) =>
        `${offer.store} ${offer.currency ?? ''} ${offer.price ?? '—'} (was ${offer.originalPrice ?? '—'}, -${offer.discountPercent ?? 0}%) free=${offer.isFree} ${offer.url}`,
    )
  })
}

console.log(failures ? `\n${failures} step(s) failed` : '\nAll steps passed')
process.exitCode = failures ? 1 : 0
