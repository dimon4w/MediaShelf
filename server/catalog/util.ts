// Pure helpers shared by the provider normalisers. Every upstream payload is untrusted, so
// readers accept `unknown` and return undefined instead of throwing.

export type Dict = Record<string, unknown>

export function isRecord(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asRecord(value: unknown): Dict {
  return isRecord(value) ? value : {}
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function records(value: unknown): Dict[] {
  return asArray(value).filter(isRecord)
}

/** Trimmed non-empty string. */
export function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/** Finite number, also parsed from numeric strings ("8.7"). */
export function num(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && /^\s*-?\d+(?:\.\d+)?\s*$/.test(value)) return Number(value)
  return undefined
}

export function int(value: unknown): number | undefined {
  const parsed = num(value)
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined
}

export function positiveInt(value: unknown): number | undefined {
  const parsed = int(value)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}

export function strings(value: unknown): string[] {
  return asArray(value)
    .map((item) => str(item))
    .filter((item): item is string => item !== undefined)
}

export function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)]
}

// ---------------------------------------------------------------------------
// Text

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  bdquo: '„',
  copy: '©',
  reg: '®',
  trade: '™',
  middot: '·',
  bull: '•',
  shy: '',
}

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1] === 'x' || entity[1] === 'X'
      const code = hex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isInteger(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

// Tags used by Shikimori/MAL descriptions. Only these are stripped so "[Remastered]" survives.
const BBCODE_TAGS =
  'b|i|u|s|url|character|anime|manga|ranobe|person|people|spoiler|spoiler_block|quote|img|image|poster|center|right|left|div|span|size|color|list|hr|br|h[1-6]|youtube|video|comment|entry|club|user|replies|source|p|solid|code|\\*'
const BBCODE_PATTERN = new RegExp(`\\[\\/?(?:${BBCODE_TAGS})(?:=[^\\]]*)?\\]`, 'gi')

/**
 * Plain text from HTML/BBCode: tags removed, entities decoded, Russian stress marks and
 * source credits dropped, paragraphs kept as blank lines, capped at `max` characters.
 */
export function cleanText(value: unknown, max = 3000): string | undefined {
  if (typeof value !== 'string') return undefined
  let text = value
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(?:p|div|li|h[1-6]|ul|ol|blockquote)\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(BBCODE_PATTERN, '')
  text = decodeEntities(text)
    .replace(/\u0301/g, '')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/\((?:Source|Источник):[^)]*\)/gi, '')
    .replace(/\[(?:Written by|Написано)[^\]]*\]/gi, '')
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text) return undefined
  return truncate(text, max)
}

/** Single-line display name, max 200 characters. */
export function cleanName(value: unknown): string | undefined {
  const text = cleanText(value, 200)
  return text ? text.replace(/\s*\n+\s*/g, ' ') : undefined
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max - 40 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export function isCyrillic(value: string): boolean {
  return /[\u0400-\u04ff]/.test(value)
}

/** Lowercase ASCII-ish form used to compare titles across sources and languages. */
export function foldForMatch(value: string): string {
  // Marks go first: NFKD would expand ™ into "TM".
  return value
    .replace(/[™®©℠]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`´ʼ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// URLs and dates

/** Absolute https URL or undefined. Protocol-relative URLs are upgraded to https. */
export function httpsUrl(value: unknown): string | undefined {
  let url = str(value)
  if (!url) return undefined
  if (url.startsWith('//')) url = `https:${url}`
  if (!url.startsWith('https://') || url.length > 2000) return undefined
  try {
    return new URL(url).hostname ? url : undefined
  } catch {
    return undefined
  }
}

export function yearFrom(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isInteger(value) && value >= 1870 && value <= 2100 ? value : null
  if (typeof value !== 'string') return null
  const match = value.match(/(?:^|\D)(18[7-9]\d|19\d\d|20\d\d|2100)(?!\d)/)
  return match ? Number(match[1]) : null
}

/** YYYY-MM-DD from ISO-like strings ("2014-11-07T00:00:00Z", "2016.08.30"). */
export function isoDate(value: unknown): string | null {
  const text = str(value)
  if (!text) return null
  const match = text.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(d) ? null : `${y}-${m}-${d}`
}

export function dateFromUnix(seconds: unknown): string | null {
  const value = num(seconds)
  if (value === undefined || value <= 0) return null
  const date = new Date(value * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

/** Minutes from "169 min", "1h 30min", "49" or a number. */
export function parseMinutes(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  const text = str(value)
  if (!text) return null
  const hours = text.match(/(\d+)\s*h/i)
  const minutes = text.match(/(\d+)\s*m/i)
  if (hours || minutes) {
    const total = Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0)
    return total > 0 ? total : null
  }
  const plain = int(text)
  return plain && plain > 0 ? plain : null
}

// ---------------------------------------------------------------------------
// Async

/** Maps with at most `limit` concurrent calls, preserving order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/** Resolves with `fallback` after `ms` without cancelling the underlying promise. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}
