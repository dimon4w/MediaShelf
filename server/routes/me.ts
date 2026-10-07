import { Hono } from 'hono'
import {
  deleteAccountSchema,
  passwordChangeSchema,
  profilePatchSchema,
} from '../../shared/schemas.ts'
import { hashPassword, verifyPassword } from '../auth/password.ts'
import {
  clearSessionCookie,
  deleteOtherSessions,
  deleteSessionByPublicId,
  listSessions,
} from '../auth/sessions.ts'
import { deleteUser, findUserByEmail, findUserById, toUser, updateUser } from '../auth/users.ts'
import { limit, requireUser, type AppDeps, type AppEnv } from '../context.ts'
import { ApiError, notFound } from '../http/errors.ts'
import { exportLibrary, importLibrary } from '../library/transfer.ts'
import { fetchOwnedGames, importSteamLibrary } from '../library/steam-import.ts'
import { refreshEpisodeCounters } from '../library/entries.ts'
import { sql } from '../db/index.ts'

export function meRoutes(deps: AppDeps) {
  const { db, config, limits, titles } = deps
  const app = new Hono<AppEnv>()

  app.patch('/', async (c) => {
    const user = requireUser(c)
    const patch = profilePatchSchema.parse(await c.req.json())
    if (patch.email && patch.email.trim().toLowerCase() !== user.email_normalized) {
      limit(limits, 'sensitive', user.id)
      if (
        !patch.currentPassword ||
        !(await verifyPassword(patch.currentPassword, user.password_hash))
      )
        throw new ApiError(400, 'WRONG_PASSWORD', 'Password required to change email', {
          fields: { currentPassword: patch.currentPassword ? 'wrong_password' : 'required' },
        })
      const other = findUserByEmail(db, patch.email)
      if (other && other.id !== user.id)
        throw new ApiError(409, 'EMAIL_TAKEN', 'Email already registered', {
          fields: { email: 'taken' },
        })
    }
    const current = toUser(user).preferences
    updateUser(db, user.id, {
      name: patch.name,
      email: patch.email,
      preferences: patch.preferences ? { ...current, ...patch.preferences } : undefined,
    })
    return c.json({ user: toUser(findUserById(db, user.id)!) })
  })

  app.post('/password', async (c) => {
    const user = requireUser(c)
    limit(limits, 'sensitive', user.id)
    const input = passwordChangeSchema.parse(await c.req.json())
    if (!(await verifyPassword(input.currentPassword, user.password_hash)))
      throw new ApiError(400, 'WRONG_PASSWORD', 'Current password is wrong', {
        fields: { currentPassword: 'wrong_password' },
      })
    updateUser(db, user.id, { passwordHash: await hashPassword(input.newPassword) })
    deleteOtherSessions(db, user.id, c.get('session')?.id ?? null)
    return c.json({ ok: true })
  })

  app.get('/sessions', (c) => {
    const user = requireUser(c)
    return c.json({ sessions: listSessions(db, user.id, c.get('session')?.id ?? null) })
  })

  app.post('/sessions/revoke-others', (c) => {
    const user = requireUser(c)
    deleteOtherSessions(db, user.id, c.get('session')?.id ?? null)
    return c.json({ ok: true })
  })

  app.delete('/sessions/:id', (c) => {
    const user = requireUser(c)
    const id = c.req.param('id')
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !deleteSessionByPublicId(db, user.id, id))
      throw notFound('Session not found')
    if (c.get('session')?.public_id === id) clearSessionCookie(c)
    return c.json({ ok: true })
  })

  app.post('/delete', async (c) => {
    const user = requireUser(c)
    limit(limits, 'sensitive', user.id)
    const input = deleteAccountSchema.parse(await c.req.json())
    if (!(await verifyPassword(input.password, user.password_hash)))
      throw new ApiError(400, 'WRONG_PASSWORD', 'Password is wrong', {
        fields: { password: 'wrong_password' },
      })
    deleteUser(db, user.id)
    clearSessionCookie(c)
    return c.json({ ok: true })
  })

  app.get('/export', (c) => {
    const user = requireUser(c)
    const data = exportLibrary(db, toUser(user))
    const date = new Date().toISOString().slice(0, 10)
    c.header('Content-Disposition', `attachment; filename="mediashelf-${date}.json"`)
    return c.json(data)
  })

  app.post('/import', async (c) => {
    const user = requireUser(c)
    limit(limits, 'sensitive', user.id)
    const result = importLibrary(db, titles, user.id, await c.req.json())
    const ids = sql(
      db,
      "SELECT title_id FROM entries WHERE user_id = ? AND kind IN ('series', 'anime')",
    ).all(user.id) as { title_id: string }[]
    for (const { title_id } of ids) refreshEpisodeCounters(db, user.id, title_id)
    return c.json(result)
  })

  app.delete('/steam', (c) => {
    const user = requireUser(c)
    const preferences = { ...JSON.parse(user.preferences) }
    delete preferences.steamId
    updateUser(db, user.id, { preferences })
    return c.json({ user: toUser({ ...user, preferences: JSON.stringify(preferences) }) })
  })

  app.get('/steam', (c) => {
    const user = requireUser(c)
    const { steamId } = JSON.parse(user.preferences) as { steamId?: string }
    return c.json({ steamId: steamId ?? null, importReady: true })
  })

  app.post('/steam/import', async (c) => {
    const user = requireUser(c)
    limit(limits, 'sensitive', user.id)
    const { steamId } = JSON.parse(user.preferences) as { steamId?: string }
    if (!steamId) throw new ApiError(400, 'STEAM_NOT_LINKED', 'Steam is not linked')
    const { games, partial } = await fetchOwnedGames(config.steamApiKey, steamId)
    return c.json({ ...importSteamLibrary(db, titles, user.id, games), partial })
  })

  return app
}
