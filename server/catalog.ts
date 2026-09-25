import type { IncomingMessage, ServerResponse } from 'node:http'
import { catalog } from '../src/lib/catalog.ts'
import { upstream } from './upstream.ts'
import { enrichItem, genres as normalizeGenres } from './metadata.ts'
import { mergeWorks, orderDiscovery } from '../src/lib/discovery.ts'
import { countries } from '../src/lib/platforms.ts'
import { mediaItemSchema } from '../src/lib/library.ts'
import { getEpisodeCatalog } from './episodes.ts'
import type {
  CatalogSource,
  MediaFilter,
  MediaItem,
  OnlineCatalogResponse,
  DiscoveryOrder,
} from '../src/lib/types.ts'

type Row = Record<string, unknown>
const row = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {})
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.map(row) : [])
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const positive = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
const labels: Record<CatalogSource, string> = {
  steam: 'Steam',
  imdb: 'IMDb',
  tvmaze: 'TVmaze',
  shikimori: 'Shikimori',
  gog: 'GOG',
  epic: 'Epic Games',
  cinemeta: 'Cinemeta',
}
const providers: Record<Exclude<MediaFilter, 'all'>, CatalogSource> = {
  game: 'steam',
  movie: 'imdb',
  series: 'tvmaze',
  anime: 'shikimori',
}
const PAGE_SIZE = 16
const movieSeeds = [
  'dune',
  'interstellar',
  'lord of the rings',
  'arrival',
  'inception',
  'harry potter',
  'batman',
  'alien',
  'spider man',
  'matrix',
  'whiplash',
  'grand budapest',
  'star wars',
  'godfather',
  'back to the future',
  'gladiator',
  'parasite',
  'the dark knight',
  'mad max',
  'pulp fiction',
]
const genreNames: Record<string, string> = {
  Drama: 'Драма',
  Comedy: 'Комедия',
  Action: 'Экшен',
  Adventure: 'Приключения',
  'Science-Fiction': 'Фантастика',
  Mystery: 'Детектив',
  Thriller: 'Триллер',
  Fantasy: 'Фэнтези',
  Horror: 'Ужасы',
  Romance: 'Романтика',
  Crime: 'Криминал',
  Family: 'Семейный',
  Animation: 'Анимация',
  History: 'История',
  'Role-playing': 'Ролевые игры',
  Strategy: 'Стратегия',
  Shooter: 'Шутер',
  Simulation: 'Симулятор',
  Puzzle: 'Головоломка',
}

export function plainText(value: unknown) {
  return text(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[\/?[^\]]+\]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
}

export function releaseYear(value: unknown): number | null {
  const valueText =
    typeof value === 'number' && value > 100000000
      ? new Date(value * 1000).getUTCFullYear().toString()
      : String(value ?? '')
  const year = valueText.match(/\b(19\d{2}|20\d{2}|2100)\b/)
  return year ? Number(year[0]) : null
}

function safeImage(value: unknown) {
  const url = text(value)
  return /^https:\/\//.test(url) ? url.slice(0, 2000) : ''
}

function canonical(item: MediaItem): MediaItem {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const match = catalog.find(
    (known) =>
      known.type === item.type &&
      (known.year === item.year || item.year === null) &&
      [normalize(known.originalTitle), normalize(known.title)].includes(
        normalize(item.originalTitle),
      ),
  )
  return match
    ? {
        ...item,
        ...match,
        source: item.source,
        sourceUrl: item.sourceUrl,
        externalIds: { ...item.externalIds, ...match.externalIds },
      }
    : item
}

export function normalizeImdb(value: unknown): MediaItem[] {
  return rows(row(value).d)
    .filter(
      (item) => /^tt\d+$/.test(text(item.id)) && ['movie', 'tvMovie'].includes(text(item.qid)),
    )
    .map((item) =>
      canonical({
        id: `imdb-${text(item.id)}`,
        type: 'movie',
        title: text(item.l),
        originalTitle: text(item.l),
        year: releaseYear(item.y),
        genres: ['Кино'],
        description: text(item.s) ? `В ролях: ${text(item.s)}.` : '',
        poster: safeImage(row(item.i).imageUrl).replace('._V1_.', '._V1_QL80_UX600_.'),
        accent: '#e9b894',
        source: 'imdb',
        sourceUrl: `https://www.imdb.com/title/${text(item.id)}/`,
        externalIds: { imdb: text(item.id) },
        artworkQuality: row(item.i).imageUrl ? 'good' : 'missing',
      }),
    )
    .filter((item) => item.title)
}

export function normalizeTvmaze(value: unknown): MediaItem[] {
  return rows(value)
    .map((item) => row(item.show ?? item))
    .filter((item) => positive(item.id) && text(item.name))
    .map((item) =>
      canonical({
        id: `tvmaze-${item.id}`,
        type: 'series',
        title: text(item.name),
        originalTitle: text(item.name),
        year: releaseYear(item.premiered),
        genres: (Array.isArray(item.genres) && item.genres.length ? item.genres : ['Сериал'])
          .map((genre) => genreNames[text(genre)] ?? text(genre))
          .slice(0, 5),
        description: plainText(item.summary),
        poster: safeImage(row(item.image).original ?? row(item.image).medium),
        accent: '#94b9ec',
        source: 'tvmaze',
        sourceUrl: `https://www.tvmaze.com/shows/${item.id}`,
        externalIds: {
          tvmaze: String(item.id),
          ...(text(row(item.externals).imdb) ? { imdb: text(row(item.externals).imdb) } : {}),
        },
        popularity: Number(item.weight ?? 0),
      }),
    )
}

export function normalizeShikimori(value: unknown): MediaItem[] {
  return rows(value)
    .filter((item) => positive(item.id) && text(item.name))
    .map((item) => {
      const image = text(row(item.image).original)
      return canonical({
        id: `shikimori-${item.id}`,
        type: 'anime',
        title: text(item.russian) || text(item.name),
        originalTitle: text(item.name),
        year: releaseYear(item.aired_on),
        genres: ['Аниме'],
        description: plainText(item.description),
        poster: image.startsWith('/system/') ? `https://shikimori.one${image}` : safeImage(image),
        ...(positive(item.episodes) ? { episodes: positive(item.episodes) } : {}),
        accent: '#adccb1',
        source: 'shikimori',
        sourceUrl: `https://shikimori.one/animes/${item.id}`,
        externalIds: { shikimori: String(item.id) },
      })
    })
}

export function normalizeSteam(value: unknown): MediaItem[] {
  return rows(value)
    .filter(
      (item) =>
        positive(item.id) &&
        text(item.name) &&
        !/soundtrack|redkit|artbook|demo|саундтрек/i.test(text(item.name)) &&
        (!item.type || item.type === 'app' || item.type === 'game'),
    )
    .map((item) => {
      const thumbnail = safeImage(item.large_capsule_image ?? item.header_image ?? item.tiny_image)
      // Keep Steam's asset hash when present; newly published artwork uses hashed directories.
      const poster = thumbnail.replace(
        /\/(?:capsule_[^/]+|header(?:_[^/]+)?)\.(?:jpg|png)(?:\?.*)?$/,
        '/library_600x900.jpg',
      )
      return canonical({
        id: `steam-${item.id}`,
        type: 'game',
        title: text(item.name),
        originalTitle: text(item.name),
        year: releaseYear(item.release_date),
        genres: ['Игра'],
        description: plainText(item.short_description),
        poster,
        backdrop: thumbnail,
        accent: '#b9a7dc',
        platforms: ['PC'],
        source: 'steam',
        sourceUrl: `https://store.steampowered.com/app/${item.id}/`,
        externalIds: { steam: String(item.id) },
        offers: [{ store: 'steam', url: `https://store.steampowered.com/app/${item.id}/` }],
      })
    })
}

export async function verifySteamSearch(items: MediaItem[], country: string): Promise<MediaItem[]> {
  // storesearch labels DLC as "app" too. Only appdetails confirms the product kind.
  const verified = await Promise.all(
    items.map(async (item) => {
      const id = item.externalIds?.steam
      if (!id) return item
      try {
        const response = row(
          await upstream(
            `https://store.steampowered.com/api/appdetails?appids=${id}&l=russian&cc=${country.toLowerCase()}`,
          ),
        )
        const kind = text(row(row(response[id]).data).type)
        return kind && kind !== 'game' ? null : item
      } catch {
        // A provider outage is not evidence that the game should disappear.
        return item
      }
    }),
  )
  return verified.filter((item): item is MediaItem => item !== null)
}

const registry = new Map<string, MediaItem>()
export const extraGames: MediaItem[] = [
  {
    id: 'epic-genshin-impact',
    type: 'game',
    title: 'Genshin Impact',
    originalTitle: 'Genshin Impact',
    year: 2020,
    genres: ['Приключения', 'Ролевые игры', 'Открытый мир'],
    description:
      'Путешествие по Тейвату: исследуй открытый мир, собирай команду и раскрывай тайны семи стихий.',
    poster:
      'https://cdn1.epicgames.com/spt-assets/99dc46c68ea14324964a856d18dcac5b/genshin-impact-hqdph.jpg',
    backdrop:
      'https://cdn2.unrealengine.com/egs-genshinimpact-cognospherepteltd-g1a-02-1920x1080-7accd2161abb.jpg',
    accent: '#7dcabc',
    platforms: ['PC', 'Xbox', 'PlayStation 5'],
    source: 'epic',
    sourceUrl: 'https://store.epicgames.com/p/genshin-impact',
    offers: [{ store: 'epic', url: 'https://store.epicgames.com/p/genshin-impact' }],
    artworkQuality: 'good',
    popularity: 95,
  },
]

export function normalizeGog(value: unknown, country = 'US'): MediaItem[] {
  return rows(row(value).products)
    .filter(
      (p) =>
        p.productType === 'game' ||
        (p.productType === 'pack' && /complete|game of the year|definitive/i.test(text(p.title))),
    )
    .filter((p) => !/redkit|soundtrack|artbook|demo|upgrade/i.test(text(p.title)))
    .map((p) => {
      const money = row(row(p.price).finalMoney),
        base = row(row(p.price).baseMoney)
      const price = Number(money.amount)
      return canonical({
        id: `gog-${p.id}`,
        type: 'game',
        title: text(p.title),
        originalTitle: text(p.title),
        year: releaseYear(p.releaseDate),
        genres: rows(p.genres)
          .map((g) => text(g.name))
          .filter(Boolean)
          .slice(0, 5)
          .map((g) => genreNames[g] ?? g),
        description: '',
        poster: safeImage(p.coverVertical) || safeImage(p.coverHorizontal),
        backdrop: safeImage(p.galaxyBackgroundImage) || safeImage(p.coverHorizontal),
        accent: '#b1a1df',
        platforms: ['PC'],
        source: 'gog',
        sourceUrl: text(p.storeLink),
        externalIds: { gog: String(p.id) },
        offers: [
          {
            store: 'gog',
            url: text(p.storeLink),
            edition: text(p.title),
            country,
            checkedAt: new Date().toISOString(),
            ...(money.amount !== undefined && Number.isFinite(price) && text(money.currency)
              ? {
                  price: Math.round(price * 100),
                  originalPrice: Math.round(Number(base.amount ?? money.amount) * 100),
                  currency: text(money.currency),
                }
              : {}),
          },
        ],
        artworkQuality: p.coverVertical || p.coverHorizontal ? 'good' : 'missing',
      })
    })
    .map((p) => ({ ...p, genres: p.genres.length ? p.genres : ['Игра'] }))
}

export function normalizeCinemeta(value: unknown, type: 'movie' | 'series'): MediaItem[] {
  return rows(row(value).metas)
    .filter((v) => /^tt\d+$/.test(text(v.id)))
    .map((v) =>
      canonical({
        id: `imdb-${text(v.id)}`,
        type,
        title: text(v.name),
        originalTitle: text(v.name),
        year: releaseYear(v.releaseInfo ?? v.year),
        genres: normalizeGenres(v.genres ?? v.genre).length
          ? normalizeGenres(v.genres ?? v.genre)
          : [type === 'movie' ? 'Кино' : 'Сериал'],
        description: plainText(v.description),
        poster: safeImage(v.poster),
        backdrop: safeImage(v.background),
        accent: '#82c9bc',
        source: 'cinemeta',
        sourceUrl: `https://www.imdb.com/title/${text(v.id)}/`,
        externalIds: { imdb: text(v.id) },
        artworkQuality: v.poster ? 'good' : 'missing',
      }),
    )
}

function searchTerm(query: string, type: MediaFilter) {
  const normalized = query.toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const known = catalog.find(
    (item) =>
      (type === 'all' || type === item.type) &&
      item.title.toLocaleLowerCase('ru').replaceAll('ё', 'е') === normalized,
  )
  return known?.originalTitle ?? query
}

async function loadSource(
  source: CatalogSource,
  query: string,
  page: number,
  country = 'US',
  order: DiscoveryOrder = 'popular',
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  if (source === 'epic')
    return {
      items:
        page === 1
          ? extraGames.filter(
              (i) => !query || `${i.title} геншин`.toLowerCase().includes(query.toLowerCase()),
            )
          : [],
      hasMore: false,
    }
  if (source === 'gog') {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page),
      countryCode: country,
      locale: 'en-US',
      currencyCode: countries[country]?.currency ?? 'USD',
      order: order === 'classics' ? 'desc:bestselling' : 'desc:trending',
      ...(query ? { query } : {}),
    })
    const data = row(await upstream(`https://catalog.gog.com/v1/catalog?${params}`))
    return { items: normalizeGog(data, country), hasMore: page < Number(data.pages ?? 0) }
  }
  if (source === 'imdb') {
    if (!query && order === 'popular') {
      const data = await upstream(
        `https://v3-cinemeta.strem.io/catalog/movie/top/skip=${(page - 1) * 50}.json`,
      )
      const items = normalizeCinemeta(data, 'movie')
      return { items, hasMore: items.length >= 50 }
    }
    if (query && page > 1) return { items: [], hasMore: false }
    const terms = query ? [query] : movieSeeds.slice((page - 1) * 6, page * 6)
    const responses = await Promise.all(
      terms.map((term) =>
        upstream(
          `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(term.toLowerCase())}.json`,
        ),
      ),
    )
    return {
      items: responses.flatMap((data) =>
        query ? normalizeImdb(data) : normalizeImdb(data).slice(0, 2),
      ),
      hasMore: !query && page * 6 < movieSeeds.length,
    }
  }
  if (source === 'tvmaze') {
    if (!query && order === 'popular') {
      const data = await upstream(
        `https://v3-cinemeta.strem.io/catalog/series/top/skip=${(page - 1) * 50}.json`,
      )
      const items = normalizeCinemeta(data, 'series')
      return { items, hasMore: items.length >= 50 }
    }
    if (query) {
      if (page > 1) return { items: [], hasMore: false }
      return {
        items: normalizeTvmaze(
          await upstream(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`),
        ),
        hasMore: false,
      }
    }
    const result = rows(
      await upstream(`https://api.tvmaze.com/shows?page=${Math.floor((page - 1) / 15)}`),
    ).sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))
    const offset = ((page - 1) % 15) * PAGE_SIZE
    return {
      items: normalizeTvmaze(result.slice(offset, offset + PAGE_SIZE)),
      hasMore: result.length > 0,
    }
  }
  if (source === 'shikimori') {
    const url = new URL('https://shikimori.one/api/animes')
    url.search = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page),
      order: 'popularity',
      censored: 'true',
      ...(query ? { search: query } : {}),
    }).toString()
    const items = normalizeShikimori(await upstream(url.href))
    return { items, hasMore: items.length === PAGE_SIZE }
  }
  if (query) {
    if (page > 1) return { items: [], hasMore: false }
    const result = row(
      await upstream(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=${country.toLowerCase()}`,
      ),
    )
    return { items: await verifySteamSearch(normalizeSteam(result.items), country), hasMore: false }
  }
  if (order === 'classics' && page === 1)
    return {
      items: catalog
        .filter((i) => i.type === 'game')
        .map((i) => ({
          ...i,
          source: 'steam' as const,
          externalIds: { steam: i.poster.match(/\/apps\/(\d+)\//)?.[1] },
        })),
      hasMore: true,
    }
  const result = row(
    await upstream(
      `https://store.steampowered.com/api/featuredcategories/?cc=${country.toLowerCase()}&l=english`,
    ),
  )
  const items = normalizeSteam([
    ...rows(row(result.top_sellers).items),
    ...rows(row(result.new_releases).items),
    ...rows(row(result.specials).items),
    ...rows(row(result.coming_soon).items),
  ])
  const unique = [...new Map(items.map((item) => [item.id, item])).values()]
  return {
    items: unique.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    hasMore: unique.length > page * PAGE_SIZE,
  }
}

export async function getOnlineCatalog(
  type: MediaFilter,
  query: string,
  page: number,
  country = 'US',
  order: DiscoveryOrder = 'popular',
): Promise<OnlineCatalogResponse> {
  const sources =
    type === 'all'
      ? [...Object.values(providers), 'gog' as const, 'epic' as const]
      : type === 'game'
        ? (['steam', 'gog', 'epic'] as CatalogSource[])
        : [providers[type]]
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await loadSource(source, searchTerm(query, type), page, country, order)
        result.items = result.items.map((item, index) => ({
          ...item,
          popularity: Math.max(1, 100 - (page - 1) * 15 - index),
          artworkQuality: item.artworkQuality ?? (item.poster ? 'unknown' : 'missing'),
        }))
        return {
          ...result,
          source: {
            id: source,
            label: labels[source],
            status: 'available' as const,
            count: result.items.length,
          },
        }
      } catch {
        return {
          items: [],
          hasMore: false,
          source: { id: source, label: labels[source], status: 'unavailable' as const, count: 0 },
        }
      }
    }),
  )
  // Interleave formats so the first screen of 'all' is genuinely mixed.
  const mixed: MediaItem[] = []
  for (
    let index = 0;
    index < Math.max(0, ...results.map((result) => result.items.length));
    index++
  ) {
    for (const result of results) if (result.items[index]) mixed.push(result.items[index])
  }
  const unique = mergeWorks(mixed)
  const selected = orderDiscovery(unique, order, query)
  // Basic cards arrive promptly. Detailed prices/ratings are batched separately by the client.
  for (const item of selected) {
    if (registry.size > 4000) registry.delete(registry.keys().next().value!)
    registry.set(item.id, item)
  }
  return {
    items: selected,
    sources: results.map((result) => result.source),
    page,
    hasMore: results.some((result) => result.hasMore),
  }
}

export async function handleCatalogRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> {
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith('/api/')) return false
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Cache-Control', 'no-store')
  const send = (status: number, data: unknown) => {
    response.writeHead(status)
    response.end(JSON.stringify(data))
  }
  if (
    request.method !== 'GET' &&
    !(request.method === 'POST' && ['/api/details', '/api/episodes'].includes(url.pathname))
  ) {
    send(405, { error: 'Поддерживаются только GET-запросы.' })
    return true
  }
  if (url.pathname === '/api/health') {
    send(200, { ok: true, providers: labels })
    return true
  }
  if (url.pathname === '/api/details' || url.pathname === '/api/episodes') {
    const country = url.searchParams.get('country') ?? 'US'
    let supplied: MediaItem[] = []
    if (request.method === 'POST') {
      try {
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of request) {
          const bytes = Buffer.from(chunk)
          size += bytes.length
          if (size > 256 * 1024) {
            send(413, { error: 'Слишком большой запрос.' })
            return true
          }
          chunks.push(bytes)
        }
        const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (!Array.isArray(data) || data.length > 12) throw new Error('Invalid batch')
        supplied = data.map((i) => mediaItemSchema.parse(i))
      } catch {
        send(400, { error: 'Некорректные произведения.' })
        return true
      }
    }
    const ids =
      request.method === 'POST'
        ? supplied.map((i) => i.id)
        : (url.searchParams.get('ids') ?? '').split(',').filter(Boolean)
    if (
      !Object.hasOwn(countries, country) ||
      ids.length > 12 ||
      ids.some((id) => !/^[a-z0-9-]{1,100}$/.test(id))
    ) {
      send(400, { error: 'Некорректный запрос подробностей.' })
      return true
    }
    if (url.pathname === '/api/episodes') {
      const item = supplied[0] ?? registry.get(ids[0]) ?? catalog.find((i) => i.id === ids[0])
      if (!item || ids.length !== 1 || !['series', 'anime'].includes(item.type)) {
        send(400, { error: 'Нужен один сериал или аниме.' })
        return true
      }
      try {
        send(200, await getEpisodeCatalog(item, url.searchParams.get('source') ?? ''))
      } catch {
        send(502, {
          error: 'Список эпизодов временно недоступен. Сохранённые отметки остаются в библиотеке.',
        })
      }
      return true
    }
    const items = await Promise.all(
      ids.map(async (id) => {
        let item =
          registry.get(id) ??
          supplied.find((i) => i.id === id) ??
          catalog.find((i) => i.id === id) ??
          extraGames.find((i) => i.id === id)
        if (!item) return null
        const steamId = item.poster.match(/\/apps\/(\d+)\//)?.[1]
        if (steamId) item = { ...item, externalIds: { ...item.externalIds, steam: steamId } }
        try {
          return await enrichItem(item, country)
        } catch {
          return item
        }
      }),
    )
    send(200, { items: items.filter(Boolean) })
    return true
  }
  if (url.pathname !== '/api/catalog') {
    send(404, { error: 'Такого API нет.' })
    return true
  }
  const type = url.searchParams.get('type') ?? 'all'
  const query = (url.searchParams.get('q') ?? '').trim()
  const page = Number(url.searchParams.get('page') ?? '1')
  const country = url.searchParams.get('country') ?? 'US'
  const order = url.searchParams.get('order') ?? 'popular'
  if (
    !['all', 'game', 'movie', 'series', 'anime'].includes(type) ||
    query.length > 120 ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100 ||
    !Object.hasOwn(countries, country) ||
    !['popular', 'classics'].includes(order)
  ) {
    send(400, { error: 'Проверьте категорию, запрос и номер страницы.' })
    return true
  }
  try {
    const result = await getOnlineCatalog(
      type as MediaFilter,
      query,
      page,
      country,
      order as DiscoveryOrder,
    )
    send(result.sources.every((source) => source.status === 'unavailable') ? 503 : 200, result)
  } catch {
    send(502, { error: 'Каталог временно недоступен. Попробуйте ещё раз.' })
  }
  return true
}
