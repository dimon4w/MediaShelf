/** Global achievement stats: both endpoints are keyless. */

export interface GameAchievement {
  name: string
  displayName: string
  icon: string | null
  /** Share of players who unlocked it, 0–100. */
  percent: number
}

const TTL = 3_600_000
const cache = new Map<string, { at: number; data: GameAchievement[] }>()

interface SchemaJson {
  game?: {
    availableGameStats?: {
      achievements?: { name: string; displayName?: string; icon?: string }[]
    }
  }
}

interface PercentJson {
  achievementpercentages?: { achievements?: { name: string; percent: number }[] }
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

/** Humanises PORTAL_GET_PORTALGUNS when the schema (key-only) is unavailable. */
export function prettifyAchievement(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Top achievements by global unlock share, most earned first. */
export async function gameAchievements(
  appid: string,
  locale: string,
  apiKey: string | null,
): Promise<GameAchievement[]> {
  const key = `${appid}:${locale.startsWith('ru') ? 'ru' : 'en'}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data
  const lang = locale.startsWith('ru') ? 'russian' : 'english'
  const schemaUrl = apiKey
    ? `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?key=${encodeURIComponent(apiKey)}&appid=${encodeURIComponent(appid)}&l=${lang}&format=json`
    : null
  const [schema, percents] = await Promise.all([
    schemaUrl ? getJson<SchemaJson>(schemaUrl) : null,
    getJson<PercentJson>(
      `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${encodeURIComponent(appid)}&format=json`,
    ),
  ])
  const list = schema?.game?.availableGameStats?.achievements ?? []
  const shares = new Map(
    (percents?.achievementpercentages?.achievements ?? []).map((a) => [a.name, a.percent]),
  )
  const data =
    list.length > 0
      ? list.map((a) => ({
          name: a.name,
          displayName: a.displayName || prettifyAchievement(a.name),
          icon: a.icon ?? null,
          percent: Math.round((Number(shares.get(a.name)) || 0) * 10) / 10,
        }))
      : [...shares.entries()].map(([name, percent]) => ({
          name,
          displayName: prettifyAchievement(name),
          icon: null,
          percent: Math.round(Number(percent) * 10) / 10,
        }))
  data.sort((a, b) => b.percent - a.percent)
  cache.set(key, { at: Date.now(), data })
  if (cache.size > 200) cache.delete(cache.keys().next().value!)
  return data
}
