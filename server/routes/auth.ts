import { Hono } from 'hono'
import { loginSchema, registerSchema } from '../../shared/schemas.ts'
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from '../auth/password.ts'
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  writeSessionCookie,
} from '../auth/sessions.ts'
import {
  countUsers,
  defaultPreferences,
  findUserByEmail,
  insertUser,
  normalizeEmail,
  toUser,
  updateUser,
} from '../auth/users.ts'
import { limit, type AppDeps, type AppEnv } from '../context.ts'
import { ApiError } from '../http/errors.ts'
import { clientIp } from '../http/security.ts'

export function authRoutes(deps: AppDeps) {
  const { db, config, limits } = deps
  const app = new Hono<AppEnv>()

  const registrationOpen = () => config.allowRegistration || countUsers(db) === 0

  app.get('/session', (c) => {
    const user = c.get('user')
    return c.json({ user: user ? toUser(user) : null, registrationOpen: registrationOpen() })
  })

  app.post('/register', async (c) => {
    limit(limits, 'register', clientIp(c, config))
    if (!registrationOpen())
      throw new ApiError(403, 'REGISTRATION_CLOSED', 'Registration is closed')
    const input = registerSchema.parse(await c.req.json())
    if (findUserByEmail(db, input.email))
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email already registered', {
        fields: { email: 'taken' },
      })
    const passwordHash = await hashPassword(input.password)
    // Re-check after the slow hash in case of a concurrent registration.
    if (findUserByEmail(db, input.email))
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email already registered', {
        fields: { email: 'taken' },
      })
    const user = insertUser(db, {
      email: input.email,
      name: input.name,
      passwordHash,
      preferences: defaultPreferences(input.locale, input.theme),
    })
    const { token } = createSession(db, config, user.id, c.req.header('user-agent') ?? null)
    writeSessionCookie(c, config, token)
    return c.json({ user: toUser(user) }, 201)
  })

  app.post('/login', async (c) => {
    const ip = clientIp(c, config)
    limit(limits, 'login', ip)
    const input = loginSchema.parse(await c.req.json())
    const accountKey = `${ip}:${normalizeEmail(input.email)}`
    limit(limits, 'loginAccount', accountKey)
    const user = findUserByEmail(db, input.email)
    if (!user) {
      await burnPasswordCheck(input.password)
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email or password')
    }
    if (!(await verifyPassword(input.password, user.password_hash)))
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email or password')
    if (needsRehash(user.password_hash))
      updateUser(db, user.id, { passwordHash: await hashPassword(input.password) })
    limits.loginAccount.reset(accountKey)
    const { token } = createSession(db, config, user.id, c.req.header('user-agent') ?? null)
    writeSessionCookie(c, config, token)
    return c.json({ user: toUser(user) })
  })

  app.post('/logout', (c) => {
    const session = c.get('session')
    if (session) deleteSession(db, session.id)
    clearSessionCookie(c)
    return c.json({ ok: true })
  })

  return app
}
