import { Hono } from 'hono'
import { z } from 'zod'
import { isRegion } from '../../shared/regions.ts'
import { chartsQuerySchema, searchQuerySchema, titleIdSchema } from '../../shared/schemas.ts'
import { LOCALES } from '../../shared/types.ts'
import { limit, requestLocale, requestRegion, type AppDeps, type AppEnv } from '../context.ts'
import { clientIp } from '../http/security.ts'
import { episodeList, titleDetails, withTimeout } from '../library/resolve.ts'
import { ApiError } from '../http/errors.ts'

const localeQuery = z.object({
  lang: z.enum(LOCALES).optional(),
  region: z.string().refine(isRegion).optional(),
})

export function catalogRoutes(deps: AppDeps) {
  const { catalog, titles, config, limits } = deps
  const app = new Hono<AppEnv>()

  app.use('*', async (c, next) => {
    limit(limits, 'catalog', clientIp(c, config))
    await next()
  })

  app.get('/catalog/charts', async (c) => {
    const query = chartsQuerySchema.parse(c.req.query())
    const ctx = { locale: requestLocale(c, query.lang), region: requestRegion(c, query.region) }
    const page = await withTimeout(catalog.charts(query.kind, query.list, query.page, ctx), 25_000)
    titles.remember(page.items)
    c.header('Cache-Control', 'private, max-age=300')
    return c.json(page)
  })

  app.get('/catalog/search', async (c) => {
    const query = searchQuerySchema.parse(c.req.query())
    const ctx = { locale: requestLocale(c, query.lang), region: requestRegion(c, query.region) }
    if (query.q.length < 2) return c.json({ items: [], failed: [] })
    const result = await withTimeout(catalog.search(query.q, query.kind, ctx), 20_000)
    titles.remember(result.items)
    return c.json(result)
  })

  app.get('/titles/:id', async (c) => {
    const id = titleIdSchema.parse(c.req.param('id'))
    const query = localeQuery.parse(c.req.query())
    const record = await titleDetails(
      deps,
      id,
      requestLocale(c, query.lang),
      requestRegion(c, query.region),
    )
    return c.json({ title: record })
  })

  app.get('/titles/:id/episodes', async (c) => {
    const id = titleIdSchema.parse(c.req.param('id'))
    if (!/^(series|tvmaze|anime)-/.test(id)) throw new ApiError(400, 'BAD_REQUEST', 'No episodes')
    const query = localeQuery.parse(c.req.query())
    const list = await episodeList(
      deps,
      id,
      requestLocale(c, query.lang),
      requestRegion(c, query.region),
    )
    return c.json({ list })
  })

  app.get('/titles/:id/offers', async (c) => {
    const id = titleIdSchema.parse(c.req.param('id'))
    const query = localeQuery.parse(c.req.query())
    if (!/^(steam|gog)-/.test(id)) return c.json({ offers: [] })
    const offers = await withTimeout(
      catalog.offers(id, requestRegion(c, query.region)),
      15_000,
    ).catch(() => [])
    return c.json({ offers })
  })

  return app
}
