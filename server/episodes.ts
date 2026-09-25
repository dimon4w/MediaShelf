import type { Episode, EpisodeCatalog, MediaItem } from '../src/lib/types.ts'
import { upstream, row, rows, text } from './upstream.ts'
import { enrichItem } from './metadata.ts'

export function normalizeEpisodes(values: unknown, source: 'tvmaze' | 'cinemeta'): Episode[] {
  const result = rows(values).flatMap((v) => {
    const season = Number(v.season),
      number = Number(source === 'tvmaze' ? v.number : v.episode)
    if (
      !Number.isInteger(season) ||
      season < 0 ||
      season > 200 ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > 50000
    )
      return []
    const date = text(source === 'tvmaze' ? v.airdate : v.released).slice(0, 10)
    return [
      {
        key: `${season}:${number}`,
        season,
        number,
        title: text(source === 'tvmaze' ? v.name : v.title).slice(0, 300),
        ...(date ? { airdate: date } : {}),
      },
    ]
  })
  return [...new Map(result.map((e) => [e.key, e])).values()]
    .sort((a, b) => a.season - b.season || a.number - b.number)
    .slice(0, 5000)
}

export async function getEpisodeCatalog(item: MediaItem, preferred = ''): Promise<EpisodeCatalog> {
  if (!['series', 'anime'].includes(item.type))
    return { episodes: [], source: 'manual', complete: false }
  const enriched =
    item.externalIds?.tvmaze || item.externalIds?.imdb
      ? item
      : await enrichItem({ ...item, seasons: undefined }, 'US')
  let id = enriched.externalIds?.tvmaze
  const imdb = enriched.externalIds?.imdb
  if (!id && imdb && preferred !== 'cinemeta') {
    const show = row(
      await upstream(`https://api.tvmaze.com/lookup/shows?imdb=${imdb}`, 3600_000).catch(
        () => null,
      ),
    )
    if (show.id) id = String(show.id)
  }
  if (id && preferred !== 'cinemeta') {
    try {
      const [values, show] = await Promise.all([
        upstream(`https://api.tvmaze.com/shows/${id}/episodes?specials=1`, 3600_000),
        upstream(`https://api.tvmaze.com/shows/${id}`, 3600_000).catch(() => null),
      ])
      const episodes = normalizeEpisodes(values, 'tvmaze')
      return { episodes, source: 'tvmaze', complete: true, ended: row(show).status === 'Ended' }
    } catch (error) {
      if (preferred === 'tvmaze' || !imdb) throw error
    }
  }
  if (imdb && preferred !== 'tvmaze') {
    const meta = row(
      row(await upstream(`https://v3-cinemeta.strem.io/meta/series/${imdb}.json`, 3600_000)).meta,
    )
    return {
      episodes: normalizeEpisodes(meta.videos, 'cinemeta'),
      source: 'cinemeta',
      complete: true,
    }
  }
  return { episodes: [], source: 'manual', complete: false }
}
