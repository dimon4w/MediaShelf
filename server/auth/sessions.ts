import { createHash, randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { SessionInfo } from '../../shared/types.ts'
import type { Config } from '../config.ts'
import { isoOrNull, sql, type DB } from '../db/index.ts'
import { requestProtocol } from '../http/security.ts'

export const SESSION_COOKIE = 'ms_session'
const DAY = 86_400_000
const MAX_SESSIONS_PER_USER = 20

export interface SessionRow {
  id: string
  public_id: string
  user_id: string
  user_agent: string | null
  created_at: number
  last_seen_at: number
  expires_at: number
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url')

export function createSession(db: DB, config: Config, userId: string, userAgent: string | null) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  const row: SessionRow = {
    id: hashToken(token),
    public_id: randomBytes(9).toString('base64url'),
    user_id: userId,
    user_agent: userAgent?.slice(0, 300) ?? null,
    created_at: now,
    last_seen_at: now,
    expires_at: now + config.sessionDays * DAY,
  }
  sql(
    db,
    `INSERT INTO sessions (id, public_id, user_id, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.public_id, row.user_id, row.user_agent, now, now, row.expires_at)
  // Keep the newest sessions only.
  sql(
    db,
    `DELETE FROM sessions WHERE user_id = ? AND id NOT IN (
       SELECT id FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT ?)`,
  ).run(userId, userId, MAX_SESSIONS_PER_USER)
  return { token, session: row }
}

/** Resolves a token to a live session, sliding the expiry at most once per hour. */
export function readSession(db: DB, config: Config, token: string): SessionRow | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const row = sql(db, 'SELECT * FROM sessions WHERE id = ?').get(hashToken(token)) as
    SessionRow | undefined
  const now = Date.now()
  if (!row) return null
  if (row.expires_at <= now) {
    sql(db, 'DELETE FROM sessions WHERE id = ?').run(row.id)
    return null
  }
  if (now - row.last_seen_at > 3_600_000) {
    row.last_seen_at = now
    row.expires_at = now + config.sessionDays * DAY
    sql(db, 'UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(
      now,
      row.expires_at,
      row.id,
    )
  }
  return row
}

export function deleteSession(db: DB, id: string) {
  sql(db, 'DELETE FROM sessions WHERE id = ?').run(id)
}

export function deleteOtherSessions(db: DB, userId: string, keepId: string | null) {
  sql(db, 'DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?').run(userId, keepId)
}

export function deleteSessionByPublicId(db: DB, userId: string, publicId: string) {
  return sql(db, 'DELETE FROM sessions WHERE user_id = ? AND public_id = ?').run(userId, publicId)
    .changes
}

export function listSessions(db: DB, userId: string, currentId: string | null): SessionInfo[] {
  const rows = sql(
    db,
    'SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC',
  ).all(userId, Date.now()) as unknown as SessionRow[]
  return rows.map((row) => ({
    id: row.public_id,
    current: row.id === currentId,
    userAgent: row.user_agent,
    createdAt: isoOrNull(row.created_at)!,
    lastSeenAt: isoOrNull(row.last_seen_at)!,
  }))
}

export function pruneSessions(db: DB) {
  sql(db, 'DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}

export function sessionToken(c: Context) {
  return getCookie(c, SESSION_COOKIE) ?? null
}

export function writeSessionCookie(c: Context, config: Config, token: string) {
  const secure =
    config.cookieSecure === 'always' ||
    (config.cookieSecure === 'auto' && requestProtocol(c, config) === 'https')
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: config.sessionDays * 86_400,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}
