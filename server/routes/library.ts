import { Hono } from 'hono'
import { z } from 'zod'
import {
  entryCreateSchema,
  entryPatchSchema,
  episodeNoteSchema,
  episodesMarkSchema,
  playthroughPatchSchema,
  playthroughSchema,
  titleIdSchema,
} from '../../shared/schemas.ts'
import { parseJson } from '../db/index.ts'
import {
  limit,
  requireUser,
  requestLocale,
  requestRegion,
  type AppDeps,
  type AppEnv,
} from '../context.ts'
import { notFound } from '../http/errors.ts'
import { listActivity } from '../library/activity.ts'
import {
  addPlaythrough,
  createEntry,
  deleteEntry,
  deletePlaythrough,
  getEntry,
  listEntries,
  listEpisodeMarks,
  markEpisodes,
  markNextEpisode,
  setEpisodeNote,
  updateEntry,
  updatePlaythrough,
} from '../library/entries.ts'
import { ensureEpisodeList, resolveTitle } from '../library/resolve.ts'
import { computeStats } from '../library/stats.ts'
import type { PlatformId } from '../../shared/types.ts'

export function libraryRoutes(deps: AppDeps) {
  const { db, limits } = deps
  const app = new Hono<AppEnv>()

  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET') limit(limits, 'library', c.get('user')?.id ?? 'anonymous')
    await next()
  })

  const titleParam = (value: string) => titleIdSchema.parse(value)
  const hasEpisodes = (id: string) => /^(series|tvmaze|anime)-/.test(id)

  app.get('/', (c) => {
    const user = requireUser(c)
    return c.json({ entries: listEntries(db, user.id) })
  })

  app.get('/stats', (c) => {
    const user = requireUser(c)
    const offset = Number(c.req.query('tz') ?? 0)
    const timeZone = c.req.query('zone')
    return c.json(
      computeStats(db, user.id, {
        timeZone: timeZone && timeZone.length <= 64 ? timeZone : undefined,
        offsetMinutes: Number.isFinite(offset) ? offset : 0,
      }),
    )
  })

  app.get('/activity', (c) => {
    const user = requireUser(c)
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        before: z.coerce.number().int().min(1).optional(),
      })
      .parse(c.req.query())
    return c.json({ items: listActivity(db, user.id, query.limit, query.before) })
  })

  app.post('/', async (c) => {
    const user = requireUser(c)
    const input = entryCreateSchema.parse(await c.req.json())
    const locale = requestLocale(c)
    const region = requestRegion(c)
    const title = await resolveTitle(deps, input.titleId, locale, region)
    if (hasEpisodes(title.id) && input.status === 'completed')
      await ensureEpisodeList(deps, title.id, locale, region)
    const preferences = parseJson<{ platforms?: PlatformId[] }>(user.preferences, {})
    const platform = preferences.platforms?.length === 1 ? preferences.platforms[0] : null
    const result = createEntry(db, user.id, title, { ...input, platform })
    // Warm the episode list so progress and "next episode" are ready on the next view.
    if (hasEpisodes(title.id)) void ensureEpisodeList(deps, title.id, locale, region)
    return c.json(result, result.created ? 201 : 200)
  })

  app.get('/:titleId', (c) => {
    const user = requireUser(c)
    const entry = getEntry(db, user.id, titleParam(c.req.param('titleId')))
    if (!entry) throw notFound('Entry not found')
    return c.json({ entry })
  })

  app.patch('/:titleId', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const patch = entryPatchSchema.parse(await c.req.json())
    if (patch.status === 'completed' && hasEpisodes(titleId)) {
      // Check ownership before touching upstream catalogs.
      if (!getEntry(db, user.id, titleId)) throw notFound('Entry not found')
      await ensureEpisodeList(deps, titleId, requestLocale(c), requestRegion(c))
    }
    return c.json(updateEntry(db, user.id, titleId, patch))
  })

  app.delete('/:titleId', (c) => {
    const user = requireUser(c)
    deleteEntry(db, user.id, titleParam(c.req.param('titleId')))
    return c.json({ ok: true })
  })

  app.get('/:titleId/episodes', (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    return c.json({ marks: listEpisodeMarks(db, user.id, titleId) })
  })

  app.post('/:titleId/episodes', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const input = episodesMarkSchema.parse(await c.req.json())
    if (!getEntry(db, user.id, titleId)) throw notFound('Entry not found')
    await ensureEpisodeList(deps, titleId, requestLocale(c), requestRegion(c))
    const result = markEpisodes(db, user.id, titleId, input.episodes, input.watched)
    return c.json({ ...result, marks: listEpisodeMarks(db, user.id, titleId) })
  })

  app.post('/:titleId/episodes/next', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    if (!getEntry(db, user.id, titleId)) throw notFound('Entry not found')
    await ensureEpisodeList(deps, titleId, requestLocale(c), requestRegion(c))
    const result = markNextEpisode(db, user.id, titleId)
    return c.json({ ...result, marks: listEpisodeMarks(db, user.id, titleId) })
  })

  app.put('/:titleId/episodes/note', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const input = episodeNoteSchema.parse(await c.req.json())
    return c.json({ marks: setEpisodeNote(db, user.id, titleId, input) })
  })

  app.post('/:titleId/playthroughs', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const input = playthroughSchema.parse(await c.req.json())
    return c.json({ entry: addPlaythrough(db, user.id, titleId, input) }, 201)
  })

  app.patch('/:titleId/playthroughs/:id', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const id = z.uuid().parse(c.req.param('id'))
    const patch = playthroughPatchSchema.parse(await c.req.json())
    return c.json({ entry: updatePlaythrough(db, user.id, titleId, id, patch) })
  })

  app.delete('/:titleId/playthroughs/:id', (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const id = z.uuid().parse(c.req.param('id'))
    return c.json({ entry: deletePlaythrough(db, user.id, titleId, id) })
  })

  return app
}
