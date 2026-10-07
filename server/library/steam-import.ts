import { titleId } from '../../shared/ids.ts'
import type { TitleRecord } from '../../shared/types.ts'
import type { DB } from '../db/index.ts'
import { ApiError } from '../http/errors.ts'
import { createEntry, updateEntry } from './entries.ts'
import type { TitleStore } from './titles.ts'

export interface OwnedGame {
  appid: number
  name: string
  playtimeMinutes: number
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** Best effort: public game lists render right in the HTML, no key needed. Exported for tests. */
export function parseGamesPage(html: string): OwnedGame[] {
  const games = new Map<number, OwnedGame>()
  // Embedded data: {"appid":400,"name":"Portal",...,"hours_forever":"12.5",...}
  const jsonRe = /\{[^{}]*"appid"\s*:\s*"?(\d+)"?[^{}]*?\}/g
  let match: RegExpExecArray | null
  while ((match = jsonRe.exec(html)) !== null) {
    const block = match[0]
    const appid = Number(match[1])
    if (!appid || games.has(appid)) continue
    const name = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1]
    const hours = /"hours_forever"\s*:\s*"([^"]*)"/.exec(block)?.[1]
    if (name) {
      games.set(appid, {
        appid,
        name: decodeEntities(name.replace(/\\"/g, '"')),
        playtimeMinutes: Math.round(parseFloat((hours ?? '').replace(',', '.')) * 60) || 0,
      })
    }
  }
  if (!games.size) {
    // Legacy rows: a store link, a name cell and an "N hrs on record" cell per game.
    const rowRe =
      /\/app\/(\d+)[\s\S]{0,2000}?gameListRowItemName[^>]*>([^<]+)<[\s\S]{0,2000}?([\d.,]+)\s*hrs on record/gi
    while ((match = rowRe.exec(html)) !== null) {
      const appid = Number(match[1])
      if (!appid || games.has(appid)) continue
      games.set(appid, {
        appid,
        name: decodeEntities(match[2].trim()),
        playtimeMinutes: Math.round(parseFloat(match[3].replace(',', '.')) * 60) || 0,
      })
    }
  }
  return [...games.values()]
}

async function fetchOwnedGamesPublic(steamId: string): Promise<OwnedGame[]> {
  const html = await fetch(
    `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/games/?tab=all`,
    { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'english' } },
  )
    .then((response) => response.text())
    .catch(() => {
      throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
    })
  const games = parseGamesPage(html)
  if (!games.length) throw new ApiError(403, 'PROFILE_PRIVATE', 'Steam profile is private')
  return games
}

/**
 * Recent games from the open part of the profile (best effort, partial list).
 * Exported for tests.
 */
export function parseProfileGames(html: string): OwnedGame[] {
  const games = new Map<number, OwnedGame>()
  const re =
    /\/app\/(\d+)[\s\S]{0,3000}?([\d.,]+)\s*hrs on record[\s\S]{0,500}?game_name[^>]*><a[^>]*>([^<]+)</g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const appid = Number(match[1])
    if (!appid || games.has(appid)) continue
    games.set(appid, {
      appid,
      name: decodeEntities(match[3].trim()),
      playtimeMinutes: Math.round(parseFloat(match[2].replace(',', '.')) * 60) || 0,
    })
  }
  return [...games.values()]
}

async function fetchProfileGames(steamId: string): Promise<OwnedGame[]> {
  const html = await fetch(`https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/`, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'english' },
  })
    .then((response) => response.text())
    .catch(() => {
      throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
    })
  const games = parseProfileGames(html)
  if (!games.length) throw new ApiError(403, 'PROFILE_PRIVATE', 'Steam profile is private')
  return games
}

/**
 * Owned games: official API when the site key is set, otherwise the public
 * games page, otherwise recent games from the profile (partial list).
 * Either way the user does nothing.
 */
export async function fetchOwnedGames(
  apiKey: string | null,
  steamId: string,
): Promise<{ games: OwnedGame[]; partial: boolean }> {
  if (apiKey) {
    try {
      const games = await fetchOwnedGamesApi(apiKey, steamId)
      return { games, partial: false }
    } catch {
      // A bad/expired key or a private profile both fall back to keyless paths.
    }
  }
  try {
    return { games: await fetchOwnedGamesPublic(steamId), partial: false }
  } catch (error) {
    if (error instanceof ApiError && error.code !== 'PROFILE_PRIVATE') throw error
    // The full list sits behind a login wall; take the visible recent games.
    return { games: await fetchProfileGames(steamId), partial: true }
  }
}

async function fetchOwnedGamesApi(apiKey: string, steamId: string): Promise<OwnedGame[]> {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
    `?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}` +
    `&include_appinfo=1&include_played_free_games=1&format=json`
  let json: { response?: { games?: { appid: number; name?: string; playtime_forever?: number }[] } }
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Steam: ${response.status}`)
    json = (await response.json()) as typeof json
  } catch {
    throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
  }
  if (!json.response?.games) throw new ApiError(403, 'PROFILE_PRIVATE', 'Steam profile is private')
  return json.response.games.map((game) => ({
    appid: game.appid,
    name: game.name ?? `App ${game.appid}`,
    playtimeMinutes: game.playtime_forever ?? 0,
  }))
}

/** Minimal record from the app list: details load when the title is opened. */
export function steamAppRecord(appid: number, name: string): TitleRecord {
  return {
    id: titleId.steam(appid),
    kind: 'game',
    names: { original: name },
    year: null,
    poster: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    backdrop: null,
    genres: [],
    ratings: [],
    externalIds: { steam: String(appid) },
  }
}

export interface SteamImportResult {
  total: number
  imported: number
  skipped: number
}

/** Adds owned games as Steam entries: played → in progress with hours, rest → planned. */
export function importSteamLibrary(
  db: DB,
  titles: TitleStore,
  userId: string,
  games: OwnedGame[],
): SteamImportResult {
  let imported = 0
  let skipped = 0
  for (const game of games) {
    try {
      const record = steamAppRecord(game.appid, game.name)
      titles.putImported(record)
      const created = createEntry(db, userId, record, {
        status: game.playtimeMinutes > 0 ? 'in_progress' : 'planned',
      }).created
      if (!created) {
        skipped += 1
        continue
      }
      updateEntry(db, userId, record.id, {
        store: 'steam',
        platform: 'pc',
        hours: Math.round((game.playtimeMinutes / 60) * 10) / 10 || null,
      })
      imported += 1
    } catch {
      skipped += 1
    }
  }
  return { total: games.length, imported, skipped }
}
