import { describe, expect, it } from 'vitest'
import type { PersistentCache } from './types.ts'
import {
  buildClaimsQuery,
  buildLabelsQuery,
  createRuLabelResolver,
  fetchWikipediaExtract,
  parseClaimsResponse,
  parseEntitySearch,
  parseLabelsResponse,
  parseWikipediaSummary,
} from './wikidata.ts'
import { fakeFetch, fixture, testHttp } from './testing.ts'

const DAY = 24 * 3600 * 1000

function recordingCache() {
  const values = new Map<string, unknown>()
  const ttls = new Map<string, number>()
  const cache: PersistentCache = {
    get: <T>(key: string) => values.get(key) as T | undefined,
    set: (key, value, ttl) => {
      values.set(key, value)
      ttls.set(key, ttl)
    },
  }
  return { cache, values, ttls }
}

describe('SPARQL helpers', () => {
  it('builds queries only from valid ids', () => {
    const labels = buildLabelsQuery(['tt0816692', 'bad"id', 'tt0903747'])
    expect(labels).toContain('VALUES ?imdb { "tt0816692" "tt0903747" }')
    expect(labels).not.toContain('bad')
    expect(buildClaimsQuery(['Q1079', 'x'])).toContain('VALUES ?item { wd:Q1079 }')
  })

  it('parses labels and ruwiki articles, stripping disambiguation', () => {
    const labels = parseLabelsResponse(fixture('wikidata-labels.json'))
    expect(labels.get('tt0903747')).toEqual({
      label: 'Во все тяжкие',
      qid: 'Q1079',
      article:
        'https://ru.wikipedia.org/wiki/%D0%92%D0%BE_%D0%B2%D1%81%D0%B5_%D1%82%D1%8F%D0%B6%D0%BA%D0%B8%D0%B5',
    })
    expect(labels.get('tt0111161')?.label).toBe('Побег из Шоушенка')
    expect(labels.get('tt10794054')?.label).toBe('Груз')
    expect(labels.has('tt9999999999')).toBe(false)
  })

  it('parses entity search and claims in search order', () => {
    const qids = parseEntitySearch(fixture('wikidata-search.json'))
    expect(qids).toHaveLength(2)
    const hits = parseClaimsResponse(fixture('wikidata-claims.json'), qids)
    // The book about the film has no IMDb/Steam/MAL id and is dropped.
    expect(hits).toEqual([
      { qid: qids[0], imdb: 'tt0816692', labelRu: 'Интерстеллар', labelEn: 'Interstellar' },
    ])
  })

  it('extracts Wikipedia summaries without stress marks', () => {
    const extract = parseWikipediaSummary(fixture('wikipedia-summary.json'))
    expect(extract).toMatch(/^«Интерстеллар» — эпический научно-фантастический фильм 2014 года/)
    expect(extract).not.toContain('\u0301')
    expect(parseWikipediaSummary({ type: 'disambiguation', extract: 'x' })).toBeUndefined()
  })
})

describe('createRuLabelResolver', () => {
  it('caches labels for 30 days and misses for 3 days', async () => {
    const fake = fakeFetch([[/query\.wikidata\.org/, fixture('wikidata-labels.json')]])
    const { cache, ttls } = recordingCache()
    const resolver = createRuLabelResolver(testHttp(fake.fetch), cache)
    const labels = await resolver.resolve(['tt0816692', 'tt0000001'])
    expect(labels.get('tt0816692')?.label).toBe('Интерстеллар')
    expect(labels.has('tt0000001')).toBe(false)
    expect(ttls.get('catalog:wikidata:ru:tt0816692')).toBe(30 * DAY)
    expect(ttls.get('catalog:wikidata:ru:tt0000001')).toBe(3 * DAY)
    await resolver.resolve(['tt0816692', 'tt0000001'])
    expect(fake.calls).toHaveLength(1)
  })

  it('returns within the budget and fills the cache in the background', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const fake = fakeFetch([
      [
        /query\.wikidata\.org/,
        async () => {
          await gate
          return fixture('wikidata-labels.json')
        },
      ],
    ])
    const { cache } = recordingCache()
    const resolver = createRuLabelResolver(testHttp(fake.fetch), cache, { budgetMs: 20 })
    expect((await resolver.resolve(['tt0903747'])).size).toBe(0)
    release()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(resolver.peek(['tt0903747']).get('tt0903747')?.label).toBe('Во все тяжкие')
  })

  it('does not cache failures', async () => {
    let calls = 0
    // The client retries once, so the first lookup fails only after two 500s.
    const fake = fakeFetch([
      [/query\.wikidata\.org/, () => (++calls <= 2 ? 500 : fixture('wikidata-labels.json'))],
    ])
    const { cache } = recordingCache()
    const resolver = createRuLabelResolver(testHttp(fake.fetch), cache)
    expect((await resolver.resolve(['tt0111161'])).size).toBe(0)
    expect((await resolver.resolve(['tt0111161'])).get('tt0111161')?.label).toBe(
      'Побег из Шоушенка',
    )
  })
})

describe('fetchWikipediaExtract', () => {
  it('fetches once and serves the cached extract afterwards', async () => {
    const fake = fakeFetch([
      [/ru\.wikipedia\.org\/api\/rest_v1\/page\/summary\//, fixture('wikipedia-summary.json')],
    ])
    const { cache } = recordingCache()
    const http = testHttp(fake.fetch)
    const article =
      'https://ru.wikipedia.org/wiki/%D0%98%D0%BD%D1%82%D0%B5%D1%80%D1%81%D1%82%D0%B5%D0%BB%D0%BB%D0%B0%D1%80'
    expect(await fetchWikipediaExtract(http, cache, article)).toMatch(/^«Интерстеллар»/)
    expect(await fetchWikipediaExtract(http, cache, article)).toMatch(/^«Интерстеллар»/)
    expect(fake.calls).toHaveLength(1)
    expect(
      await fetchWikipediaExtract(http, cache, 'https://en.wikipedia.org/wiki/X'),
    ).toBeUndefined()
  })
})
