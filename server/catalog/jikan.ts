import { HOUR, type HttpClient } from './http.ts'
import { asRecord, cleanName, isoDate, positiveInt, records } from './util.ts'

export interface JikanEpisode {
  number: number
  name: string | null
  airdate: string | null
}

export interface JikanEpisodePage {
  episodes: JikanEpisode[]
  hasNextPage: boolean
  lastPage: number
}

/** api.jikan.moe/v4/anime/<id>/episodes page (100 episodes per page). */
export function normalizeJikanEpisodes(payload: unknown): JikanEpisodePage {
  const data = asRecord(payload)
  const pagination = asRecord(data.pagination)
  return {
    episodes: records(data.data)
      .map((item) => ({
        number: positiveInt(item.mal_id) ?? 0,
        name: cleanName(item.title) ?? cleanName(item.title_romanji) ?? null,
        airdate: isoDate(item.aired),
      }))
      .filter((episode) => episode.number > 0),
    hasNextPage: pagination.has_next_page === true,
    lastPage: positiveInt(pagination.last_visible_page) ?? 1,
  }
}

export async function fetchJikanEpisodes(
  http: HttpClient,
  malId: number,
  page = 1,
): Promise<JikanEpisodePage> {
  const payload = await http.json(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`, {
    ttlMs: 6 * HOUR,
    timeoutMs: 8_000,
  })
  return normalizeJikanEpisodes(payload)
}
