import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import {
  loginSchema,
  registerResendSchema,
  registerStartSchema,
  registerVerifySchema,
} from '../../shared/schemas.ts'
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from '../auth/password.ts'
import {
  checkPending,
  consumePending,
  resendPending,
  sendVerificationCode,
  startPending,
  sweepPending,
} from '../auth/verification.ts'
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  writeSessionCookie,
} from '../auth/sessions.ts'
import {
  steamAuthUrl,
  steamLoginCancelled,
  steamOrigin,
  verifySteamCallback,
} from '../auth/steam.ts'
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
import { ApiError, unauthorized } from '../http/errors.ts'
import { clientIp } from '../http/security.ts'

export function authRoutes(deps: AppDeps) {
  const { db, config, limits } = deps
  const app = new Hono<AppEnv>()

  const registrationOpen = () => config.allowRegistration || countUsers(db) === 0

  app.get('/session', (c) => {
    const user = c.get('user')
    return c.json({ user: user ? toUser(user) : null, registrationOpen: registrationOpen() })
  })

  // Two-step registration: /register/start sends a 6-digit code to the email,
  // /register/verify checks it and creates the account.
  app.post('/register/start', async (c) => {
    limit(limits, 'register', clientIp(c, config))
    if (!registrationOpen())
      throw new ApiError(403, 'REGISTRATION_CLOSED', 'Registration is closed')
    const input = registerStartSchema.parse(await c.req.json())
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
    sweepPending(db)
    const code = startPending(db, {
      email: input.email,
      name: input.name,
      passwordHash,
    })
    const sent = await sendVerificationCode(
      config,
      input.email.trim(),
      code,
      input.locale ?? 'ru',
    ).catch((error) => {
      console.error('[auth] failed to send verification code', error)
      return { delivered: false as const, devCode: config.smtp ? undefined : code }
    })
    return c.json(
      {
        sent: true,
        delivered: sent.delivered,
        devCode: config.smtp ? undefined : (sent.devCode ?? code),
      },
      202,
    )
  })

  app.post('/register/resend', async (c) => {
    limit(limits, 'register', clientIp(c, config))
    const input = registerResendSchema.parse(await c.req.json())
    const code = resendPending(db, input.email)
    const sent = await sendVerificationCode(config, input.email.trim(), code, 'ru').catch(
      (error) => {
        console.error('[auth] failed to resend verification code', error)
        return { delivered: false as const, devCode: config.smtp ? undefined : code }
      },
    )
    return c.json(
      {
        sent: true,
        delivered: sent.delivered,
        devCode: config.smtp ? undefined : (sent.devCode ?? code),
      },
      202,
    )
  })

  app.post('/register/verify', async (c) => {
    limit(limits, 'register', clientIp(c, config))
    if (!registrationOpen())
      throw new ApiError(403, 'REGISTRATION_CLOSED', 'Registration is closed')
    const input = registerVerifySchema.parse(await c.req.json())
    const pending = checkPending(db, input.email, input.code)
    if (findUserByEmail(db, input.email)) {
      consumePending(db, input.email)
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email already registered', {
        fields: { email: 'taken' },
      })
    }
    const user = insertUser(db, {
      email: pending.email,
      name: pending.name,
      passwordHash: pending.password_hash,
      preferences: defaultPreferences(input.locale, input.theme),
    })
    consumePending(db, input.email)
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

  // Steam linking via OpenID: the user approves on steamcommunity.com,
  // Steam calls back, we verify and remember the SteamID64.
  // Where the browser lands afterwards is kept in a short-lived cookie, so the same flow serves
  // the welcome wizard and the settings page.
  const STEAM_RETURN_COOKIE = 'steam_return'
  const steamReturn = { welcome: '/welcome?step=stores', settings: '/settings/games' } as const

  app.get('/steam/start', (c) => {
    if (!c.get('user')) throw unauthorized()
    const origin = steamOrigin(c, config)
    const target = c.req.query('return') === 'settings' ? 'settings' : 'welcome'
    setCookie(c, STEAM_RETURN_COOKIE, target, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https://'),
      path: '/api/auth/steam',
      maxAge: 600,
    })
    return c.redirect(steamAuthUrl(origin))
  })

  app.get('/steam/callback', async (c) => {
    const user = c.get('user')
    if (!user) return c.redirect('/login?next=/welcome?step=stores', 302)
    const back =
      steamReturn[getCookie(c, STEAM_RETURN_COOKIE) === 'settings' ? 'settings' : 'welcome']
    deleteCookie(c, STEAM_RETURN_COOKIE, { path: '/api/auth/steam' })
    const landing = (status: string) =>
      c.redirect(`${back}${back.includes('?') ? '&' : '?'}steam=${status}`, 302)
    const query = c.req.query()
    if (steamLoginCancelled(query)) return landing('cancelled')
    try {
      const steamId = await verifySteamCallback(query, steamOrigin(c, config))
      const preferences = {
        ...defaultPreferences(),
        ...JSON.parse(user.preferences),
        steamId,
      }
      updateUser(db, user.id, { preferences })
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      // A readable message on the settings page beats a raw JSON error in the browser.
      return landing(error.code === 'CATALOG_UNAVAILABLE' ? 'unreachable' : 'rejected')
    }
    return landing('connected')
  })

  return app
}
