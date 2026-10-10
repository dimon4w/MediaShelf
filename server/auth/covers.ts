import { sql, type DB } from '../db/index.ts'

export const COVER_MAX_BYTES = 1_500_000

const MIME_BY_MAGIC: [string, (bytes: Uint8Array) => boolean][] = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  [
    'image/webp',
    (b) =>
      String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' &&
      String.fromCharCode(...b.subarray(8, 12)) === 'WEBP',
  ],
]

/** The real type of an image from its first bytes, or null: never trust the declared one. */
export function sniffImage(bytes: Uint8Array): string | null {
  return MIME_BY_MAGIC.find(([, matches]) => matches(bytes))?.[0] ?? null
}

/** Decodes `data:image/…;base64,…`; null when it is not an image we accept. */
export function decodeImageDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match) return null
  const bytes = new Uint8Array(Buffer.from(match[1], 'base64'))
  const mime = sniffImage(bytes)
  return mime ? { mime, bytes } : null
}

export function setCover(db: DB, userId: string, mime: string, bytes: Uint8Array) {
  sql(
    db,
    `INSERT INTO user_covers (user_id, mime, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`,
  ).run(userId, mime, bytes, Date.now())
}

export function getCover(db: DB, userId: string): { mime: string; data: Uint8Array; version: number } | null {
  const row = sql(db, 'SELECT mime, data, updated_at FROM user_covers WHERE user_id = ?').get(
    userId,
  ) as { mime: string; data: Uint8Array; updated_at: number } | undefined
  return row ? { mime: row.mime, data: row.data, version: row.updated_at } : null
}

/** Cheap check for the profile: the version (upload time) without reading the image. */
export function coverVersion(db: DB, userId: string): number | null {
  const row = sql(db, 'SELECT updated_at FROM user_covers WHERE user_id = ?').get(userId) as
    | { updated_at: number }
    | undefined
  return row?.updated_at ?? null
}

export function deleteCover(db: DB, userId: string) {
  sql(db, 'DELETE FROM user_covers WHERE user_id = ?').run(userId)
}
