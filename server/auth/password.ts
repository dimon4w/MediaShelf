import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// OWASP minimum for scrypt: N=2^17, r=8, p=1 (≈128 MiB per hash).
const PARAMS = { N: 2 ** 17, r: 8, p: 1 }
const KEY_LENGTH = 32

function derive(password: string, salt: Buffer, options: ScryptOptions, length: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password.normalize('NFKC'),
      salt,
      length,
      { ...options, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, PARAMS, KEY_LENGTH)
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltText, keyText] = stored.split('$')
  if (scheme !== 'scrypt' || !saltText || !keyText) return false
  const expected = Buffer.from(keyText, 'base64url')
  const options = { N: Number(n), r: Number(r), p: Number(p) }
  if (![options.N, options.r, options.p].every(Number.isInteger)) return false
  const actual = await derive(
    password,
    Buffer.from(saltText, 'base64url'),
    options,
    expected.length,
  )
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function needsRehash(stored: string) {
  const [, n, r, p] = stored.split('$')
  return Number(n) !== PARAMS.N || Number(r) !== PARAMS.r || Number(p) !== PARAMS.p
}

let dummyHash: Promise<string> | undefined
/** Spends the same time as a real check so unknown emails are not distinguishable. */
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword('mediashelf-timing-equaliser')
  await verifyPassword(password, await dummyHash)
}
