import { Hono } from 'hono'
import type {
  ActivityItem,
  BannerId,
  LibraryEntry,
  PublicEntry,
  PublicUser,
  UserProfile,
} from '../../shared/types.ts'
import type { AppDeps, AppEnv } from '../context.ts'
import { requireUser } from '../context.ts'
import { coverVersion, getCover } from '../auth/covers.ts'
import { BANNERS } from '../../shared/types.ts'
import { notFound } from '../http/errors.ts'
import { listActivity } from '../library/activity.ts'
import { listEntries } from '../library/entries.ts'
import { computeStats } from '../library/stats.ts'
import { findUserById, toUser } from '../auth/users.ts'

/** Whitelist, not blacklist: a new private field on LibraryEntry stays private by default. */
function toPublicEntry(entry: LibraryEntry): PublicEntry {
  return {
    titleId: entry.titleId,
    kind: entry.kind,
    status: entry.status,
    rating: entry.rating,
    favorite: entry.favorite,
    progress: entry.progress,
    hours: entry.hours,
    watchedEpisodes: entry.watchedEpisodes,
    totalEpisodes: entry.totalEpisodes,
    title: entry.title,
  }
}

export function usersRoutes(deps: AppDeps) {
  const { db } = deps
  const app = new Hono<AppEnv>()

  app.get('/:id/cover', (c) => {
    requireUser(c)
    const cover = getCover(db, c.req.param('id'))
    if (!cover) throw notFound('No cover')
    // Revalidated on every use: a replaced cover shows up at once, an unchanged one costs a 304.
    const etag = `"${cover.version}"`
    const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' }
    if (c.req.header('if-none-match') === etag) return c.body(null, 304, headers)
    return c.body(cover.data as Uint8Array<ArrayBuffer>, 200, { ...headers, 'Content-Type': cover.mime })
  })

  app.get('/:id/profile', (c) => {
    requireUser(c)
    const id = c.req.param('id')
    const row = findUserById(db, id)
    if (!row) throw notFound('User not found')

    const user = toUser(row)
    const prefs = user.preferences
    // Covers from the earlier preset list fall back to the poster collage.
    const banner: BannerId = (BANNERS as readonly string[]).includes(prefs.banner ?? 'none')
      ? (prefs.banner ?? 'none')
      : 'none'
    const publicUser: PublicUser = {
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      avatar: prefs.avatar,
      avatarBg: prefs.avatarBg,
      avatarVariant: prefs.avatarVariant,
      banner,
      steamLinked: Boolean(prefs.steamId),
    }

    const all = listEntries(db, id)
    const favourites = all.filter((e) => e.favorite).slice(0, 12)
    const completed = all.filter((e) => e.status === 'completed').slice(0, 12)
    const inProgress = all.filter((e) => e.status === 'in_progress').slice(0, 8)
    // listEntries is newest first, so every list below is "most recent first".
    const heroPosters = [
      ...new Set(
        [...favourites, ...completed, ...inProgress]
          .map((e) => e.title?.poster)
          .filter((src): src is string => Boolean(src)),
      ),
    ].slice(0, 6)

    const activity = listActivity(db, id, 10) as ActivityItem[]
    // Count days and "this year" in the viewer's zone, exactly like /api/library/stats.
    const offset = Number(c.req.query('tz') ?? 0)
    const zone = c.req.query('zone')
    const stats = computeStats(db, id, {
      timeZone: zone && zone.length <= 64 ? zone : undefined,
      offsetMinutes: Number.isFinite(offset) ? offset : 0,
    })

    let bannerImage: string | null = null
    if (banner === 'favorite') bannerImage = favourites[0]?.title?.backdrop ?? null
    else if (banner === 'title') {
      const picked = all.find((entry) => entry.titleId === prefs.bannerTitleId)
      bannerImage = picked?.title?.backdrop ?? picked?.title?.poster ?? null
    } else if (banner === 'image') {
      const version = coverVersion(db, id)
      bannerImage = version ? `/api/users/${id}/cover?v=${version}` : null
    }

    const profile: UserProfile = {
      user: publicUser,
      stats,
      activity,
      favorites: favourites.map(toPublicEntry),
      completed: completed.map(toPublicEntry),
      inProgress: inProgress.map(toPublicEntry),
      heroPosters,
      bannerImage,
    }
    return c.json(profile)
  })

  return app
}
