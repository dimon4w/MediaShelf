import { describe, expect, it } from 'vitest'
import {
  cleanName,
  cleanText,
  dateFromUnix,
  foldForMatch,
  httpsUrl,
  isCyrillic,
  isoDate,
  mapLimit,
  parseMinutes,
  truncate,
  withTimeout,
  yearFrom,
} from './util.ts'

describe('cleanText', () => {
  it('strips HTML, keeps paragraphs and decodes entities', () => {
    const html =
      '<p><b>Breaking Bad</b> follows&nbsp;Walter&#39;s story &amp; more.</p><p>Second<br>line &#x2014; end</p>'
    expect(cleanText(html)).toBe(
      "Breaking Bad follows Walter's story & more.\n\nSecond\nline — end",
    )
  })

  it('removes Shikimori BBCode but keeps the linked text and unrelated brackets', () => {
    const bb =
      'Отряд [character=186854]Химмеля[/character] и [[Фрирен]] [i]вернулся[/i] [Remastered].'
    expect(cleanText(bb)).toBe('Отряд Химмеля и Фрирен вернулся [Remastered].')
  })

  it('drops stress marks and source credits', () => {
    expect(cleanText('«Интерсте́ллар» — фильм.')).toBe('«Интерстеллар» — фильм.')
    expect(cleanText('An elf mage.<br><br>(Source: Crunchyroll)')).toBe('An elf mage.')
  })

  it('caps length at a word boundary', () => {
    const text = cleanText('word '.repeat(1000), 50) ?? ''
    expect(text.length).toBeLessThanOrEqual(50)
    expect(text.endsWith('…')).toBe(true)
    expect(truncate('short', 10)).toBe('short')
  })

  it('returns undefined for empty or non-string input', () => {
    expect(cleanText('<p> </p>')).toBeUndefined()
    expect(cleanText(42)).toBeUndefined()
    expect(cleanName('Line one\nline two')).toBe('Line one line two')
  })
})

describe('httpsUrl', () => {
  it('accepts https and protocol-relative URLs only', () => {
    expect(httpsUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(httpsUrl('//images-1.gog-statics.com/x.jpg')).toBe(
      'https://images-1.gog-statics.com/x.jpg',
    )
    expect(httpsUrl('http://example.com/a.jpg')).toBeUndefined()
    expect(httpsUrl('/system/animes/1.jpg')).toBeUndefined()
    expect(httpsUrl('javascript:alert(1)')).toBeUndefined()
    expect(httpsUrl(null)).toBeUndefined()
  })
})

describe('dates and numbers', () => {
  it('extracts years from mixed formats', () => {
    expect(yearFrom('2008–2013')).toBe(2008)
    expect(yearFrom('2016.08.30')).toBe(2016)
    expect(yearFrom('Sep 17, 2020')).toBe(2020)
    expect(yearFrom(1999)).toBe(1999)
    expect(yearFrom('12345')).toBeNull()
    expect(yearFrom(undefined)).toBeNull()
  })

  it('normalises ISO-like dates', () => {
    expect(isoDate('2014-11-07T00:00:00.000Z')).toBe('2014-11-07')
    expect(isoDate('2016.08.30')).toBe('2016-08-30')
    expect(isoDate('2023-02-30')).toBeNull()
    expect(isoDate('soon')).toBeNull()
    expect(dateFromUnix(1600353507)).toBe('2020-09-17')
    expect(dateFromUnix(0)).toBeNull()
  })

  it('parses runtimes', () => {
    expect(parseMinutes('169 min')).toBe(169)
    expect(parseMinutes('1h 30min')).toBe(90)
    expect(parseMinutes('49')).toBe(49)
    expect(parseMinutes(24)).toBe(24)
    expect(parseMinutes('N/A')).toBeNull()
  })
})

describe('matching helpers', () => {
  it('folds case, marks, punctuation and ё', () => {
    expect(foldForMatch('The Witcher® 3: Wild Hunt™')).toBe('the witcher 3 wild hunt')
    expect(foldForMatch("Baldur's Gate 3")).toBe('baldurs gate 3')
    expect(foldForMatch('Крёстный отец')).toBe(foldForMatch('крестный ОТЕЦ'))
    expect(foldForMatch('Pokémon')).toBe('pokemon')
    expect(isCyrillic('интерстеллар')).toBe(true)
    expect(isCyrillic('interstellar')).toBe(false)
  })
})

describe('async helpers', () => {
  it('mapLimit preserves order and respects the limit', async () => {
    let active = 0
    let peak = 0
    const result = await mapLimit([30, 10, 20, 5], 2, async (ms, index) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, ms))
      active--
      return index
    })
    expect(result).toEqual([0, 1, 2, 3])
    expect(peak).toBe(2)
  })

  it('withTimeout falls back without rejecting', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200))
    expect(await withTimeout(slow, 10, 'fallback')).toBe('fallback')
    expect(await withTimeout(Promise.resolve('fast'), 50, 'fallback')).toBe('fast')
    expect(await withTimeout(Promise.reject(new Error('x')), 50, 'fallback')).toBe('fallback')
  })
})
