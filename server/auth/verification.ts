import { createHash, randomInt } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Config } from '../config.ts'
import { sql, type DB } from '../db/index.ts'
import { ApiError } from '../http/errors.ts'
import { normalizeEmail } from './users.ts'

export const CODE_TTL_MS = 10 * 60_000
export const CODE_RESEND_MS = 60_000
export const CODE_MAX_ATTEMPTS = 5

export interface PendingRegistration {
  email: string
  email_normalized: string
  name: string
  password_hash: string
  code_hash: string
  attempts: number
  sent_at: number
  expires_at: number
}

export function makeCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashCode(code: string): string {
  return createHash('sha256').update(`code:${code}`).digest('hex')
}

export function getPending(db: DB, email: string): PendingRegistration | undefined {
  return sql(db, 'SELECT * FROM pending_registrations WHERE email_normalized = ?').get(
    normalizeEmail(email),
  ) as PendingRegistration | undefined
}

/** Creates or replaces the pending registration and returns the plain code to send. */
export function startPending(
  db: DB,
  input: { email: string; name: string; passwordHash: string },
): string {
  const now = Date.now()
  const code = makeCode()
  sql(
    db,
    `INSERT INTO pending_registrations
       (email, email_normalized, name, password_hash, code_hash, attempts, sent_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(email_normalized) DO UPDATE SET
       email = excluded.email, name = excluded.name, password_hash = excluded.password_hash,
       code_hash = excluded.code_hash, attempts = 0,
       sent_at = excluded.sent_at, expires_at = excluded.expires_at`,
  ).run(
    input.email.trim(),
    normalizeEmail(input.email),
    input.name.trim(),
    input.passwordHash,
    hashCode(code),
    now,
    now + CODE_TTL_MS,
  )
  return code
}

/** Issues a fresh code for an existing pending registration. Throws when cooling down. */
export function resendPending(db: DB, email: string): string {
  const pending = getPending(db, email)
  if (!pending) throw new ApiError(404, 'NO_PENDING', 'No pending registration for this email')
  if (Date.now() - pending.sent_at < CODE_RESEND_MS)
    throw new ApiError(429, 'RESEND_TOO_SOON', 'Wait a minute before requesting a new code')
  const now = Date.now()
  const code = makeCode()
  sql(
    db,
    'UPDATE pending_registrations SET code_hash = ?, attempts = 0, sent_at = ?, expires_at = ? WHERE email_normalized = ?',
  ).run(hashCode(code), now, now + CODE_TTL_MS, pending.email_normalized)
  return code
}

/** Checks the code and returns the pending row; consumes an attempt. */
export function checkPending(db: DB, email: string, code: string): PendingRegistration {
  const pending = getPending(db, email)
  if (!pending) throw new ApiError(404, 'NO_PENDING', 'No pending registration for this email')
  if (Date.now() > pending.expires_at) {
    sql(db, 'DELETE FROM pending_registrations WHERE email_normalized = ?').run(
      pending.email_normalized,
    )
    throw new ApiError(410, 'CODE_EXPIRED', 'The code expired, request a new one')
  }
  if (pending.attempts >= CODE_MAX_ATTEMPTS) {
    sql(db, 'DELETE FROM pending_registrations WHERE email_normalized = ?').run(
      pending.email_normalized,
    )
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong attempts, start over')
  }
  if (hashCode(code.trim()) !== pending.code_hash) {
    sql(
      db,
      'UPDATE pending_registrations SET attempts = attempts + 1 WHERE email_normalized = ?',
    ).run(pending.email_normalized)
    throw new ApiError(400, 'CODE_WRONG', 'Wrong code')
  }
  return pending
}

export function consumePending(db: DB, email: string) {
  sql(db, 'DELETE FROM pending_registrations WHERE email_normalized = ?').run(normalizeEmail(email))
}

// Expired rows are tiny, but keep the table tidy on every code send.
export function sweepPending(db: DB) {
  try {
    sql(db, 'DELETE FROM pending_registrations WHERE expires_at < ?').run(Date.now())
  } catch {
    /* ignore */
  }
}

export function verificationEmail(
  code: string,
  locale: string,
  link: string | null,
): { subject: string; text: string; html: string } {
  const ru = locale.startsWith('ru')
  const heading = ru ? 'Код подтверждения' : 'Verification code'
  const intro = link
    ? ru
      ? 'Введите код вручную или подтвердите в один клик:'
      : 'Enter the code manually or confirm in one click:'
    : ru
      ? 'Введите этот код в окне регистрации, чтобы завершить создание аккаунта.'
      : 'Enter this code in the registration window to finish creating your account.'
  const autoText = ru ? 'Подтвердить в один клик' : 'Confirm in one click'
  const autoHint = ru
    ? 'Нажмите кнопку — код введётся сам, ничего копировать не нужно.'
    : 'Tap the button — the code fills itself in, nothing to copy.'
  const orManual = ru ? 'Или введите код вручную:' : 'Or enter the code manually:'
  const copyHint = ru
    ? 'Нажмите и удерживайте код, чтобы скопировать его.'
    : 'Touch and hold the code to copy it.'
  const expiry = ru ? 'Код действует 10 минут.' : 'The code expires in 10 minutes.'
  const ignore = ru
    ? 'Если это были не вы — просто проигнорируйте письмо.'
    : 'If that was not you, just ignore this email.'
  const tagline = ru
    ? 'Ваша библиотека игр, фильмов, сериалов и аниме'
    : 'Your library of games, movies, series and anime'
  const subject = ru ? `MediaShell: ваш код — ${code}` : `MediaShell: your code is ${code}`
  const text = link
    ? `MediaShell — ${heading}\n\n${autoHint}\n${link}\n\n${orManual}\n\n${code}\n\n${expiry} ${ignore}`
    : `MediaShell — ${heading}\n\n${intro}\n\n${code}\n\n${copyHint}\n\n${expiry} ${ignore}`
  const font = "font-family:-apple-system,'Segoe UI',Arial,Helvetica,sans-serif;"
  const html = `<!doctype html>
<html lang="${ru ? 'ru' : 'en'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background-color:#090909;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${heading}: ${code}. ${expiry}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#090909;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td align="center" style="padding:8px 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td valign="middle"><img src="cid:mediashelf-logo" width="44" height="44" alt="MediaShell" style="display:block;width:44px;height:44px;border:0;"></td>
            <td valign="middle" style="padding-left:12px;${font}font-size:21px;font-weight:bold;letter-spacing:-0.5px;color:#ededed;">MediaShell</td>
          </tr></table>
          <div style="${font}font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#525252;padding-top:8px;">${tagline}</div>
        </td></tr>
        <tr><td style="background-color:#141414;border:1px solid #262626;border-radius:20px;padding:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background-color:#1c1c1c;border:1px solid #2e2e2e;border-radius:14px;padding:28px 24px 26px;${font}">
              <p style="margin:0 0 6px;font-size:19px;font-weight:bold;color:#ededed;">${heading}</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#a3a3a3;">${intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="background-color:#0a0a0a;border:1px solid #2a2a2a;border-radius:12px;padding:20px 12px;font-family:'Courier New',monospace;font-size:36px;font-weight:bold;letter-spacing:12px;text-indent:12px;color:#ededed;">${code}</td></tr>
          </table>
${
  link
    ? `          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 0 4px;"><a href="${link}" style="display:inline-block;background-color:#ededed;border-radius:999px;padding:14px 32px;${font}font-size:16px;font-weight:bold;color:#090909;text-decoration:none;">${autoText}</a></td></tr></table>
`
    : ''
}              <p style="margin:16px 0 0;font-size:13px;color:#737373;">${copyHint}</p>
              <p style="margin:14px 0 0;${font}font-size:13px;line-height:1.55;color:#8a8a8a;">${expiry} ${ignore}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:22px 8px 0;${font}font-size:12px;line-height:1.6;color:#525252;">Это письмо отправлено, потому что кто-то указал вашу почту при регистрации в MediaShell.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, text, html }
}

export async function sendVerificationCode(
  config: Config,
  email: string,
  code: string,
  locale: string,
): Promise<{ delivered: boolean; devCode?: string }> {
  if (!config.smtp) {
    console.log(`[auth] no SMTP configured, verification code for ${email}: ${code}`)
    return { delivered: false, devCode: code }
  }
  const { createTransport } = await import('nodemailer')
  const transport = createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  })
  const { subject, text, html } = verificationEmail(
    code,
    locale,
    config.publicUrl
      ? `${config.publicUrl}/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}&locale=${encodeURIComponent(locale)}`
      : null,
  )
  const logoPath = resolve(config.distDir, '..', 'public', 'icon-512.png')
  const attachments = existsSync(logoPath)
    ? [{ filename: 'logo.png', path: logoPath, cid: 'mediashelf-logo' }]
    : []
  await transport.sendMail({ from: config.smtp.from, to: email, subject, text, html, attachments })
  return { delivered: true }
}
