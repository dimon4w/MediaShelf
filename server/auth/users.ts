import { randomUUID } from 'node:crypto'
import type { Locale, ThemePreference, User, UserPreferences } from '../../shared/types.ts'
import { isoOrNull, parseJson, sql, type DB } from '../db/index.ts'

export interface UserRow {
  id: string
  email: string
  email_normalized: string
  name: string
  password_hash: string
  preferences: string
  created_at: number
  updated_at: number
  password_changed_at: number
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function defaultPreferences(
  locale: Locale = 'ru',
  theme: ThemePreference = 'system',
): UserPreferences {
  return { locale, theme, region: 'US', platforms: ['pc'], stores: ['steam'] }
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: isoOrNull(row.created_at)!,
    preferences: {
      ...defaultPreferences(),
      ...parseJson<Partial<UserPreferences>>(row.preferences, {}),
    },
  }
}

export function findUserByEmail(db: DB, email: string) {
  return sql(db, 'SELECT * FROM users WHERE email_normalized = ?').get(normalizeEmail(email)) as
    UserRow | undefined
}

export function findUserById(db: DB, id: string) {
  return sql(db, 'SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export function insertUser(
  db: DB,
  input: { email: string; name: string; passwordHash: string; preferences: UserPreferences },
): UserRow {
  const now = Date.now()
  const row: UserRow = {
    id: randomUUID(),
    email: input.email.trim(),
    email_normalized: normalizeEmail(input.email),
    name: input.name.trim(),
    password_hash: input.passwordHash,
    preferences: JSON.stringify(input.preferences),
    created_at: now,
    updated_at: now,
    password_changed_at: now,
  }
  sql(
    db,
    `INSERT INTO users (id, email, email_normalized, name, password_hash, preferences, created_at, updated_at, password_changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.email,
    row.email_normalized,
    row.name,
    row.password_hash,
    row.preferences,
    now,
    now,
    now,
  )
  return row
}

export function updateUser(
  db: DB,
  id: string,
  patch: { name?: string; email?: string; preferences?: UserPreferences; passwordHash?: string },
) {
  const now = Date.now()
  if (patch.name !== undefined)
    sql(db, 'UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(
      patch.name.trim(),
      now,
      id,
    )
  if (patch.email !== undefined)
    sql(db, 'UPDATE users SET email = ?, email_normalized = ?, updated_at = ? WHERE id = ?').run(
      patch.email.trim(),
      normalizeEmail(patch.email),
      now,
      id,
    )
  if (patch.preferences !== undefined)
    sql(db, 'UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(patch.preferences),
      now,
      id,
    )
  if (patch.passwordHash !== undefined)
    sql(
      db,
      'UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?',
    ).run(patch.passwordHash, now, now, id)
}

export function deleteUser(db: DB, id: string) {
  sql(db, 'DELETE FROM users WHERE id = ?').run(id)
}

export function countUsers(db: DB) {
  return (sql(db, 'SELECT COUNT(*) AS count FROM users').get() as { count: number }).count
}
