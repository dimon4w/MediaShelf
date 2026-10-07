import type { Config } from '../config.ts'
import { ApiError } from '../http/errors.ts'

const OPENID_URL = 'https://steamcommunity.com/openid/login'
const SELECT = 'http://specs.openid.net/auth/2.0/identifier_select'

/** Steam OpenID 2.0 login. No API key needed: Steam only proves the SteamID64. */
export function steamAuthUrl(config: Config): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${config.publicUrl}/api/auth/steam/callback`,
    'openid.realm': config.publicUrl,
    'openid.identity': SELECT,
    'openid.claimed_id': SELECT,
  })
  return `${OPENID_URL}?${params}`
}

/** Verifies Steam's callback and returns the SteamID64. */
export async function verifySteamCallback(query: Record<string, string>): Promise<string> {
  const params = new URLSearchParams({ 'openid.ns': 'http://specs.openid.net/auth/2.0' })
  for (const [key, value] of Object.entries(query))
    if (key.startsWith('openid.')) params.set(key, value)
  params.set('openid.mode', 'check_authentication')
  const valid = await fetch(OPENID_URL, { method: 'POST', body: params })
    .then((response) => response.text())
    .then((text) => /^is_valid:true$/m.test(text.trim()))
    .catch(() => {
      throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
    })
  if (!valid) throw new ApiError(403, 'FORBIDDEN', 'Steam rejected the login')
  const claimed = query['openid.claimed_id'] ?? ''
  const match = claimed.match(/(\d{17,25})$/)
  if (!match) throw new ApiError(400, 'BAD_REQUEST', 'No Steam id in the callback')
  return match[1]
}
