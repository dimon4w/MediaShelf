import { sql, type DB } from '../db/index.ts'

/**
 * A user's own Steam Web API key (steamcommunity.com/dev/apikey).
 * It unlocks the full library import; it is only ever read by the server and never sent back
 * to the browser (the UI sees the last four characters).
 */
export function getSteamKey(db: DB, userId: string): string | null {
  const row = sql(db, 'SELECT api_key FROM steam_keys WHERE user_id = ?').get(userId) as
    { api_key: string } | undefined
  return row?.api_key ?? null
}

export function setSteamKey(db: DB, userId: string, key: string) {
  sql(
    db,
    `INSERT INTO steam_keys (user_id, api_key, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET api_key = excluded.api_key, updated_at = excluded.updated_at`,
  ).run(userId, key, Date.now())
}

export function deleteSteamKey(db: DB, userId: string) {
  sql(db, 'DELETE FROM steam_keys WHERE user_id = ?').run(userId)
}

export const keyHint = (key: string) => key.slice(-4)
