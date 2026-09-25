import type { MediaItem, PublicRating, StoreOffer } from '../src/lib/types.ts'
import { upstream, row, rows, text, clean } from './upstream.ts'
import { imdbRating } from './ratings.ts'
import { withVerifiedStores } from './store-links.ts'
import { countries } from '../src/lib/platforms.ts'

const genreNames: Record<string, string> = {
  Action: 'Экшен',
  Adventure: 'Приключения',
  Animation: 'Анимация',
  Comedy: 'Комедия',
  Crime: 'Криминал',
  Drama: 'Драма',
  Fantasy: 'Фэнтези',
  Horror: 'Ужасы',
  Mystery: 'Детектив',
  Romance: 'Романтика',
  'Sci-Fi': 'Фантастика',
  Thriller: 'Триллер',
  Documentary: 'Документальный',
  Family: 'Семейный',
}
export function genres(values: unknown) {
  return (
    Array.isArray(values) ? values.map((v) => genreNames[text(v)] ?? text(v)).filter(Boolean) : []
  ).slice(0, 5)
}
export function steamOffer(value: unknown, id: string, country: string): StoreOffer {
  const item = row(value),
    price = row(item.price_overview)
  return {
    store: 'steam',
    url: `https://store.steampowered.com/app/${id}/?cc=${country.toLowerCase()}`,
    country,
    checkedAt: new Date().toISOString(),
    ...(typeof price.final === 'number' && text(price.currency)
      ? { price: price.final, originalPrice: Number(price.initial), currency: text(price.currency) }
      : item.is_free === true
        ? { price: 0, currency: countries[country]?.currency ?? 'USD' }
        : {}),
  }
}
export function steamRating(value: unknown): PublicRating | undefined {
  const summary = row(row(value).query_summary)
  const votes = Number(summary.total_reviews),
    positive = Number(summary.total_positive)
  return votes > 0 && positive >= 0 && positive <= votes
    ? {
        source: 'steam',
        value: Math.round((positive / votes) * 100),
        votes,
        checkedAt: new Date().toISOString(),
      }
    : undefined
}

export async function enrichItem(item: MediaItem, country: string): Promise<MediaItem> {
  let result = { ...item }
  const ids = { ...item.externalIds }
  let animeLookup = item.originalTitle
  if (item.type === 'game' && ids.gog && !ids.steam) {
    const core = (v: string) =>
      v
        .toLowerCase()
        .replace(/[®™]/g, '')
        .replace(/[-:—]?\s*(complete edition|game of the year edition|enhanced edition)$/i, '')
        .replace(/[^\p{L}\p{N}]/gu, '')
    const term = item.originalTitle
      .replace(/\s*[-:—]?\s*(complete edition|game of the year edition|enhanced edition)$/i, '')
      .trim()
    const data = row(
      await upstream(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=${country.toLowerCase()}`,
      ).catch(() => null),
    )
    const match = rows(data.items).find((v) => core(text(v.name)) === core(item.originalTitle))
    if (match?.id) ids.steam = String(match.id)
  }
  if (!Object.keys(ids).length && item.type === 'movie') {
    const data = row(
      await upstream(
        `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(item.originalTitle.toLowerCase())}.json`,
      ).catch(() => null),
    )
    const match = rows(data.d).find(
      (v) =>
        text(v.l).toLowerCase() === item.originalTitle.toLowerCase() && Number(v.y) === item.year,
    )
    if (match && /^tt\d+$/.test(text(match.id))) ids.imdb = text(match.id)
  }
  if (!ids.tvmaze && item.type === 'series' && !ids.imdb) {
    const values = rows(
      await upstream(
        `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(item.originalTitle)}`,
      ).catch(() => null),
    )
    const match = values
      .map((v) => row(v.show))
      .find(
        (v) =>
          text(v.name).toLowerCase() === item.originalTitle.toLowerCase() &&
          Number(text(v.premiered).slice(0, 4)) === item.year,
      )
    if (match) {
      ids.tvmaze = String(match.id)
      if (text(row(match.externals).imdb)) ids.imdb = text(row(match.externals).imdb)
    }
  }
  if (ids.steam) {
    const [details, reviews] = await Promise.all([
      upstream(
        `https://store.steampowered.com/api/appdetails?appids=${ids.steam}&l=russian&cc=${country.toLowerCase()}`,
      ).catch(() => null),
      upstream(
        `https://store.steampowered.com/appreviews/${ids.steam}?json=1&language=all&purchase_type=all&review_type=all&num_per_page=1`,
      ).catch(() => null),
    ])
    const data = row(row(row(details)[ids.steam]).data)
    if (data.name) {
      const supported = row(data.platforms)
      result = {
        ...result,
        source: 'steam',
        sourceUrl: `https://store.steampowered.com/app/${ids.steam}/`,
        description: clean(data.short_description) || item.description,
        year:
          item.year ??
          (Number(text(row(data.release_date).date).match(/\b(19\d{2}|20\d{2})\b/)?.[1]) || null),
        genres: rows(data.genres)
          .map((g) => text(g.description).replace(/^Экшены$/, 'Экшен'))
          .filter(Boolean)
          .slice(0, 5),
        languages: clean(data.supported_languages)
          .split(',')
          .map((v) => v.replace(/\*.*/, '').trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 80),
        platforms: [
          ...new Set([
            ...(item.platforms ?? []),
            ...(supported.windows || supported.mac || supported.linux ? ['PC'] : []),
          ]),
        ],
        offers: [
          ...(item.offers ?? []).filter((o) => o.store !== 'steam'),
          steamOffer(data, ids.steam, country),
        ],
        backdrop:
          text(row(rows(data.screenshots)[0]).path_full) ||
          text(data.background_raw) ||
          item.backdrop,
        screenshots: rows(data.screenshots)
          .map((s) => text(s.path_full))
          .filter((url) => /^https:\/\//.test(url))
          .slice(0, 8),
        previewVideo: rows(data.movies)
          .map((movie) => text(row(movie.webm)['480']) || text(row(movie.mp4)['480']))
          .find((url) => /^https:\/\//.test(url)),
      }
    }
    const rating = steamRating(reviews)
    if (rating) result.ratings = [rating]
  }
  if (ids.shikimori) {
    const data = row(
      await upstream(`https://shikimori.one/api/animes/${ids.shikimori}`, 3600_000).catch(
        () => null,
      ),
    )
    const values = rows(data.genres)
      .map((g) => text(g.russian) || text(g.name))
      .filter(Boolean)
    if (values.length) result.genres = values.slice(0, 5)
    if (data.description) result.description = clean(data.description).replace(/\[\/?[^\]]+\]/g, '')
    if (data.franchise) result.franchise = text(data.franchise)
    if (Array.isArray(data.english))
      animeLookup = data.english.find((v) => typeof v === 'string' && v) ?? animeLookup
  }
  if (ids.imdb && item.type !== 'game') {
    const meta = row(
      row(
        await (
          item.type === 'movie' &&
          item.backdrop &&
          item.description &&
          !item.description.startsWith('В ролях:')
            ? Promise.resolve(null)
            : upstream(
                `https://v3-cinemeta.strem.io/meta/${item.type === 'movie' ? 'movie' : 'series'}/${ids.imdb}.json`,
                3600_000,
              )
        ).catch(() => null),
      ).meta,
    )
    if (meta.name) {
      if (!item.description || item.description.startsWith('В ролях:'))
        result.description = clean(meta.description)
      const names = genres(meta.genres ?? meta.genre)
      if (names.length) result.genres = names
      result.backdrop = text(meta.background) || item.backdrop
      if (text(meta.background)) result.screenshots = [text(meta.background)]
      if (!item.poster) result.poster = text(meta.poster)
      const seasons = [
        ...new Set(
          rows(meta.videos)
            .map((v) => Number(v.season))
            .filter((n) => Number.isInteger(n) && n > 0),
        ),
      ]
      if (seasons.length) result.seasons = seasons.length
      if (item.type !== 'movie' && !item.episodes) {
        const episodes = rows(meta.videos).filter(
          (v) => Number(v.season) > 0 && Number(v.episode) > 0,
        ).length
        if (episodes) result.episodes = episodes
      }
    }
    const rating = await imdbRating(ids.imdb).catch(() => undefined)
    if (rating) result.ratings = [rating]
  }
  if (ids.tvmaze) {
    const seasons = await upstream(
      `https://api.tvmaze.com/shows/${ids.tvmaze}/seasons`,
      3600_000,
    ).catch(() => null)
    if (Array.isArray(seasons)) {
      result.seasons = rows(seasons).filter((s) => Number(s.number) > 0).length || undefined
      const regular = rows(seasons).filter((s) => Number(s.number) > 0)
      if (
        !item.episodes &&
        regular.length &&
        regular.every((s) => Number.isInteger(s.episodeOrder) && Number(s.episodeOrder) > 0)
      )
        result.episodes = regular.reduce((sum, s) => sum + Number(s.episodeOrder), 0)
    }
  }
  const savedGog = result.offers?.find((o) => o.store === 'gog')
  if (
    item.type === 'game' &&
    (!savedGog ||
      savedGog.country !== country ||
      !savedGog.checkedAt ||
      Date.now() - Date.parse(savedGog.checkedAt) > 15 * 60000)
  ) {
    const data = row(
      await upstream(
        `https://catalog.gog.com/v1/catalog?query=${encodeURIComponent(item.originalTitle)}&limit=10&countryCode=${country}&currencyCode=${countries[country]?.currency ?? 'USD'}&locale=en-US`,
      ).catch(() => null),
    )
    const key = (v: string) =>
      v
        .toLowerCase()
        .replace(/[®™]/g, '')
        .replace(
          /[-:—]?\s*(complete edition|game of the year edition|enhanced edition|the final cut)$/i,
          '',
        )
        .replace(/[^\p{L}\p{N}]/gu, '')
    const match = rows(data.products).find(
      (v) =>
        key(text(v.title)) === key(item.originalTitle) &&
        !/redkit|soundtrack|artbook/i.test(text(v.title)),
    )
    if (match) {
      ids.gog = String(match.id)
      if (text(match.coverVertical)) result.poster = text(match.coverVertical)
      // A regional price is only accepted when the response explicitly supplies a currency.
      const price = row(row(match.price).finalMoney),
        base = row(row(match.price).baseMoney)
      const offer: StoreOffer = {
        store: 'gog',
        url: text(match.storeLink),
        edition: text(match.title),
        country,
        checkedAt: new Date().toISOString(),
        ...(price.amount !== undefined && text(price.currency)
          ? {
              price: Math.round(Number(price.amount) * 100),
              originalPrice: Math.round(Number(base.amount ?? price.amount) * 100),
              currency: text(price.currency),
            }
          : {}),
      }
      result.offers = [...(result.offers ?? []).filter((o) => o.store !== 'gog'), offer]
    }
  }
  if (item.type === 'anime' && !result.seasons) {
    const found = rows(
      await upstream(
        `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(animeLookup)}`,
        3600_000,
      ).catch(() => null),
    )
      .map((v) => row(v.show))
      .find(
        (v) =>
          text(v.name)
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]/gu, '') ===
            animeLookup.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') && v.type === 'Animation',
      )
    if (found?.id) {
      ids.tvmaze = String(found.id)
      const seasons = rows(
        await upstream(`https://api.tvmaze.com/shows/${found.id}/seasons`, 3600_000).catch(
          () => null,
        ),
      )
      if (seasons.length)
        result.seasons = seasons.filter((s) => Number(s.number) > 0).length || undefined
      if (text(row(found.externals).imdb)) {
        ids.imdb = text(row(found.externals).imdb)
        const rating = await imdbRating(ids.imdb).catch(() => undefined)
        if (rating) result.ratings = [rating]
      }
    }
  }
  result.externalIds = ids
  return withVerifiedStores(result)
}
