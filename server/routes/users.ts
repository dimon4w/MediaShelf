import { Hono } from 'hono'
import type { ActivityItem, BannerId, PublicUser, UserProfile } from '../../shared/types.ts'
import type { AppDeps, AppEnv } from '../context.ts'
import { requireUser } from '../context.ts'
import { notFound } from '../http/errors.ts'
import { listActivity } from '../library/activity.ts'
import { listEntries } from '../library/entries.ts'
import { computeStats } from '../library/stats.ts'
import { findUserById, toUser } from '../auth/users.ts'

export function usersRoutes(deps: AppDeps) {
  const { db } = deps
  const app = new Hono<AppEnv>()

  app.get('/:id/profile', (c) => {
    requireUser(c)
    const id = c.req.param('id')
    const row = findUserById(db, id)
    if (!row) throw notFound('User not found')

    const user = toUser(row)
    const prefs = user.preferences
    const publicUser: PublicUser = {
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      avatar: prefs.avatar,
      avatarColor: prefs.avatarColor,
      banner: (prefs.banner ?? 'none') as BannerId,
    }

    const all = listEntries(db, id)
    const favourites = all.filter((e) => e.favorite).slice(0, 12)
    const completed = all.filter((e) => e.status === 'completed').slice(0, 12)

    const activity = listActivity(db, id, 10) as ActivityItem[]
    const stats = computeStats(db, id)

    const bannerImage =
      prefs.banner === 'favorite' ? (favourites[0]?.title?.backdrop ?? null) : null

    const profile: UserProfile = {
      user: publicUser,
      stats,
      activity,
      favorites: favourites,
      completed: completed,
      bannerImage,
    }
    return c.json(profile)
  })

  return app
}
