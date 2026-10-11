import type { CatalogService } from './catalog/types.ts'
import { memoryCache } from './catalog/types.ts'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createLimits } from './context.ts'
import { openDatabase } from './db/index.ts'
import { TitleStore } from './library/titles.ts'
import type { EpisodeList, TitleRecord } from '../shared/types.ts'

export const sampleTitles: TitleRecord[] = [
  {
    id: 'movie-tt0816692',
    kind: 'movie',
    names: { original: 'Interstellar', en: 'Interstellar', ru: 'Интерстеллар' },
    year: 2014,
    poster: null,
    backdrop: null,
    genres: ['Sci-Fi', 'Drama'],
    ratings: [{ source: 'imdb', value: 8.7, max: 10 }],
    runtime: 169,
    externalIds: { imdb: 'tt0816692' },
  },
  {
    id: 'series-tt0903747',
    kind: 'series',
    names: { original: 'Breaking Bad', en: 'Breaking Bad', ru: 'Во все тяжкие' },
    year: 2008,
    poster: null,
    backdrop: null,
    genres: ['Crime', 'Drama'],
    ratings: [{ source: 'imdb', value: 9.5, max: 10 }],
    runtime: 47,
    episodes: 4,
    externalIds: { imdb: 'tt0903747' },
  },
  {
    id: 'steam-1145360',
    kind: 'game',
    names: { original: 'Hades' },
    year: 2020,
    poster: null,
    backdrop: null,
    genres: ['Roguelike', 'Action'],
    ratings: [{ source: 'steam', value: 98, max: 100, votes: 250000 }],
    externalIds: { steam: '1145360' },
  },
]

export const sampleEpisodes: EpisodeList = {
  source: 'tvmaze',
  ended: true,
  seasons: [
    {
      number: 1,
      episodes: [1, 2].map((number) => ({
        season: 1,
        number,
        name: `S1E${number}`,
        airdate: '2008-01-20',
        runtime: 47,
      })),
    },
    {
      number: 2,
      episodes: [1, 2].map((number) => ({
        season: 2,
        number,
        name: `S2E${number}`,
        airdate: '2009-03-08',
        runtime: 47,
      })),
    },
  ],
}

export function fakeCatalog(): CatalogService {
  const find = (id: string) => sampleTitles.find((title) => title.id === id) ?? null
  return {
    async charts(kind) {
      return { items: sampleTitles.filter((title) => title.kind === kind), hasMore: false }
    },
    async search(query) {
      const q = query.toLowerCase()
      return {
        items: sampleTitles.filter((title) =>
          Object.values(title.names).some((name) => name?.toLowerCase().includes(q)),
        ),
        failed: [],
      }
    },
    async details(id, ctx) {
      const title = find(id)
      return title
        ? { ...title, detailed: true, descriptions: { [ctx.locale]: `About ${id}` } }
        : null
    },
    async episodes(id) {
      return id === 'series-tt0903747' ? sampleEpisodes : null
    },
    async offers(id) {
      return id.startsWith('steam-')
        ? [
            {
              store: 'steam',
              url: 'https://store.steampowered.com/app/1145360/',
              region: 'US',
              currency: 'USD',
              price: 2499,
            },
          ]
        : []
    },
  }
}

export function testApp(catalog: CatalogService = fakeCatalog(), { limits = false } = {}) {
  const config = { ...loadConfig([], { DB_FILE: ':memory:' }), dev: true }
  const db = openDatabase(':memory:')
  const app = createApp({
    db,
    config,
    catalog,
    cache: memoryCache(),
    titles: new TitleStore(db),
    limits: createLimits(limits),
  })
  let cookie = ''
  const request = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await app.request(`http://localhost${path}`, {
      method,
      headers: {
        Origin: 'http://localhost',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      const value = setCookie.split(';')[0]
      cookie = /=$/.test(value) || /Max-Age=0/i.test(setCookie) ? '' : value
    }
    const text = await response.text()
    let parsed: any = null // eslint-disable-line @typescript-eslint/no-explicit-any
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = text // not JSON: an image or plain text
      }
    }
    return { status: response.status, headers: response.headers, body: parsed }
  }
  return { app, db, request, clearCookie: () => (cookie = '') }
}

export interface TestAccount {
  name: string
  email: string
  password: string
}

/** Two-step registration; the test config has no SMTP so the code comes back inline. */
export async function registerAccount(
  t: ReturnType<typeof testApp>,
  account: TestAccount,
  extra: Record<string, unknown> = {},
) {
  const start = await t.request('POST', '/api/auth/register/start', account)
  if (start.status !== 202 || !start.body.devCode)
    throw new Error(`register/start failed: ${start.status} ${JSON.stringify(start.body)}`)
  return t.request('POST', '/api/auth/register/verify', {
    email: account.email,
    code: start.body.devCode,
    ...extra,
  })
}
