import { z } from 'zod'
import { TITLE_ID_PATTERN } from './ids.ts'
import { isRegion } from './regions.ts'
import { CHART_LISTS, KINDS, LOCALES, PLATFORMS, STATUSES, STORES, THEMES } from './types.ts'

// Field error messages are codes; the client translates them.
export const emailSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, 'required')
  .max(254, 'too_long')
  .pipe(z.email({ error: 'email' }))

export const passwordSchema = z
  .string({ error: 'required' })
  .min(8, 'password_short')
  .max(200, 'too_long')

export const nameSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, 'required')
  .max(60, 'too_long')

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  locale: z.enum(LOCALES).optional(),
  theme: z.enum(THEMES).optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'required' }).min(1, 'required').max(200, 'too_long'),
})

export const preferencesPatchSchema = z
  .object({
    locale: z.enum(LOCALES),
    theme: z.enum(THEMES),
    region: z.string().refine(isRegion, 'invalid'),
    platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length),
    stores: z.array(z.enum(STORES)).max(STORES.length),
  })
  .partial()

export const profilePatchSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  /** Required when the email changes. */
  currentPassword: z.string().max(200, 'too_long').optional(),
  preferences: preferencesPatchSchema.optional(),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'required').max(200, 'too_long'),
  newPassword: passwordSchema,
})

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'required').max(200, 'too_long'),
})

export const titleIdSchema = z.string().regex(TITLE_ID_PATTERN, 'invalid')

const isoDate = z.iso.datetime({ offset: true }).nullable()
const hours = z.number().min(0).max(100000).nullable()

export const entryCreateSchema = z.object({
  titleId: titleIdSchema,
  status: z.enum(STATUSES).optional(),
  favorite: z.boolean().optional(),
  rating: z.number().int().min(1).max(10).nullable().optional(),
})

export const entryPatchSchema = z
  .object({
    status: z.enum(STATUSES),
    rating: z.number().int().min(1).max(10).nullable(),
    favorite: z.boolean(),
    notes: z.string().max(5000, 'too_long'),
    progress: z.number().int().min(0).max(100),
    platform: z.enum(PLATFORMS).nullable(),
    store: z.enum(STORES).nullable(),
    hours,
    startedAt: isoDate,
    finishedAt: isoDate,
    position: z.number().finite(),
  })
  .partial()

export const playthroughSchema = z.object({
  label: z.string().trim().max(80, 'too_long').default(''),
  platform: z.enum(PLATFORMS).nullable().default(null),
  store: z.enum(STORES).nullable().default(null),
  status: z.enum(STATUSES).default('in_progress'),
  progress: z.number().int().min(0).max(100).default(0),
  hours: hours.default(null),
  startedAt: isoDate.default(null),
  finishedAt: isoDate.default(null),
  note: z.string().max(2000, 'too_long').default(''),
})

export const playthroughPatchSchema = z
  .object({
    label: z.string().trim().max(80, 'too_long'),
    platform: z.enum(PLATFORMS).nullable(),
    store: z.enum(STORES).nullable(),
    status: z.enum(STATUSES),
    progress: z.number().int().min(0).max(100),
    hours,
    startedAt: isoDate,
    finishedAt: isoDate,
    note: z.string().max(2000, 'too_long'),
  })
  .partial()

const episodeRef = z.object({
  season: z.number().int().min(0).max(500),
  number: z.number().int().min(0).max(100000),
})

export const episodesMarkSchema = z.object({
  episodes: z.array(episodeRef).min(1).max(5000),
  watched: z.boolean(),
})

export const episodeNoteSchema = z.object({
  season: episodeRef.shape.season,
  number: episodeRef.shape.number,
  note: z.string().max(2000, 'too_long').optional(),
  rating: z.number().int().min(1).max(10).nullable().optional(),
})

export const chartsQuerySchema = z.object({
  kind: z.enum(KINDS),
  list: z.enum(CHART_LISTS).default('trending'),
  page: z.coerce.number().int().min(1).max(20).default(1),
  lang: z.enum(LOCALES).optional(),
  region: z.string().refine(isRegion).optional(),
})

export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  kind: z.enum(['all', ...KINDS]).default('all'),
  lang: z.enum(LOCALES).optional(),
  region: z.string().refine(isRegion).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ProfilePatch = z.infer<typeof profilePatchSchema>
export type EntryPatch = z.infer<typeof entryPatchSchema>
export type PlaythroughInput = z.input<typeof playthroughSchema>
export type PlaythroughPatch = z.infer<typeof playthroughPatchSchema>
