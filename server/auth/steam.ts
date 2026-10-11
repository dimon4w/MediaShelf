import type { Context } from 'hono'
import type { Config } from '../config.ts'
import { ApiError } from '../http/errors.ts'

const OPENID_URL = 'https://steamcommunity.com/openid/login'
const SELECT = 'http://specs.openid.net/auth/2.0/identifier_select'
const CALLBACK_PATH = '/api/auth/steam/callback'
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/i

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host)
  )
}

function firstValue(header: string | undefined): string | undefined {
  return header?.split(',')[0]?.trim() || undefined
}

/**
 * The address Steam should send the browser back to.
 *
 * It is the address the browser used to reach us: that one is reachable by definition. A local
 * install (http://localhost:4175) therefore works even when PUBLIC_URL is empty or still points
 * at an old tunnel. PUBLIC_URL only wins for requests that did not come in on a loopback name,
 * i.e. behind a reverse proxy that rewrites the Host header.
 */
export function steamOrigin(c: Context, config: Config): string {
  const url = new URL(c.req.url)
  const forwardedHost = config.trustProxy ? firstValue(c.req.header('x-forwarded-host')) : undefined
  const forwardedProto = config.trustProxy
    ? firstValue(c.req.header('x-forwarded-proto'))
    : undefined
  const rawHost = forwardedHost ?? c.req.header('host') ?? url.host
  const host = HOST_PATTERN.test(rawHost) ? rawHost : url.host
  const protocol =
    forwardedProto === 'https' || forwardedProto === 'http'
      ? forwardedProto
      : url.protocol.slice(0, -1)
  const origin = `${protocol}://${host}`
  if (config.publicUrl && !isLoopbackHost(new URL(origin).hostname)) return config.publicUrl
  return origin
}

/** Steam OpenID 2.0 login. No API key needed: Steam only proves the SteamID64. */
export function steamAuthUrl(origin: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${origin}${CALLBACK_PATH}`,
    'openid.realm': origin,
    'openid.identity': SELECT,
    'openid.claimed_id': SELECT,
  })
  return `${OPENID_URL}?${params}`
}

/** The user pressed "Cancel" on the Steam page. */
export function steamLoginCancelled(query: Record<string, string>): boolean {
  return query['openid.mode'] === 'cancel'
}

/**
 * Verifies Steam's callback and returns the SteamID64.
 * Checks that the assertion was issued for this very address and by Steam's own endpoint,
 * then lets Steam confirm the signature.
 */
export async function verifySteamCallback(
  query: Record<string, string>,
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (query['openid.mode'] !== 'id_res')
    throw new ApiError(400, 'BAD_REQUEST', 'Not a Steam login response')
  if (query['openid.return_to'] !== `${origin}${CALLBACK_PATH}`)
    throw new ApiError(403, 'FORBIDDEN', 'Steam login was issued for another address')
  if (query['openid.op_endpoint'] !== OPENID_URL)
    throw new ApiError(403, 'FORBIDDEN', 'Login did not come from Steam')
  const match = CLAIMED_ID.exec(query['openid.claimed_id'] ?? '')
  if (!match) throw new ApiError(400, 'BAD_REQUEST', 'No Steam id in the callback')

  const params = new URLSearchParams({ 'openid.ns': 'http://specs.openid.net/auth/2.0' })
  for (const [key, value] of Object.entries(query))
    if (key.startsWith('openid.')) params.set(key, value)
  params.set('openid.mode', 'check_authentication')
  const valid = await fetchImpl(OPENID_URL, {
    method: 'POST',
    body: params,
    signal: AbortSignal.timeout(10_000),
  })
    .then((response) => response.text())
    .then((text) => /^is_valid:true$/m.test(text.trim()))
    .catch(() => {
      throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
    })
  if (!valid) throw new ApiError(403, 'FORBIDDEN', 'Steam rejected the login')
  return match[1]
}
