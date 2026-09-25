import { describe, expect, it, vi } from 'vitest'
import {
  normalizeImdb,
  normalizeShikimori,
  normalizeSteam,
  normalizeTvmaze,
  plainText,
  releaseYear,
  verifySteamSearch,
} from './catalog'
import * as upstreamModule from './upstream'
import { mediaItemSchema } from '../src/lib/library'

describe('catalog adapters', () => {
  it('excludes confirmed DLC from Steam search while preserving unknown products on provider failure', async () => {
    const request = vi.spyOn(upstreamModule, 'upstream').mockImplementation(async (url) => {
      if (url.includes('appids=1&')) return { 1: { success: true, data: { type: 'dlc' } } }
      if (url.includes('appids=2&')) return { 2: { success: true, data: { type: 'game' } } }
      throw new Error('Temporary outage')
    })
    try {
      const items = normalizeSteam([
        { id: 1, name: 'Songs of the Past', type: 'app' },
        { id: 2, name: 'The Witcher 3', type: 'app' },
        { id: 3, name: 'Unknown product', type: 'app' },
      ])
      const filtered = await verifySteamSearch(items, 'US')
      expect(filtered.map((item) => item.id)).toEqual(['steam-2', 'steam-3'])
    } finally {
      request.mockRestore()
    }
  })
  it('filters IMDb people and series out of movie results and reuses bundled IDs', () => {
    const result = normalizeImdb({
      d: [
        { id: 'tt15239678', l: 'Dune: Part Two', qid: 'movie', y: 2024, s: 'Timothée Chalamet' },
        { id: 'nm123', l: 'A person', qid: 'name' },
        { id: 'tt123', l: 'A series', qid: 'tvSeries' },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('movie-dune')
    expect(result[0].sourceUrl).toBe('https://www.imdb.com/title/tt15239678/')
    expect(mediaItemSchema.safeParse(result[0]).success).toBe(true)
  })

  it('keeps unknown TV totals unknown and turns provider markup into plain text', () => {
    const [item] = normalizeTvmaze([
      {
        show: {
          id: 12345,
          name: 'A new show',
          premiered: null,
          genres: ['Drama'],
          summary: '<p>A &amp; B</p>',
        },
      },
    ])
    expect(item.year).toBeNull()
    expect(item.episodes).toBeUndefined()
    expect(item.description).toBe('A & B')
    expect(item.genres).toEqual(['Драма'])
    expect(mediaItemSchema.safeParse(item).success).toBe(true)
  })

  it('preserves Russian anime names and does not invent totals for ongoing titles', () => {
    const [item] = normalizeShikimori([
      {
        id: 101,
        name: 'Example',
        russian: 'Пример',
        episodes: 0,
        aired_on: '2024-04-01',
        image: { original: '/system/animes/original/101.jpg' },
      },
    ])
    expect(item.title).toBe('Пример')
    expect(item.originalTitle).toBe('Example')
    expect(item.episodes).toBeUndefined()
    expect(item.poster).toBe('https://shikimori.one/system/animes/original/101.jpg')
    expect(mediaItemSchema.safeParse(item).success).toBe(true)
  })

  it('keeps Steam asset hashes and supplies a horizontal image as a fallback', () => {
    const [item] = normalizeSteam([
      {
        id: 620,
        name: 'Portal 2',
        type: 'app',
        tiny_image:
          'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/hash/capsule_231x87.jpg?t=123',
      },
    ])
    expect(item.poster).toContain('/620/hash/library_600x900.jpg')
    expect(item.backdrop).toContain('capsule_231x87.jpg')
    expect(item.year).toBeNull()
    expect(mediaItemSchema.safeParse(item).success).toBe(true)
  })

  it('handles missing upstream fields without executable image URLs', () => {
    expect(normalizeImdb(null)).toEqual([])
    expect(normalizeTvmaze({})).toEqual([])
    expect(releaseYear('Coming soon')).toBeNull()
    expect(releaseYear('18 Apr, 2011')).toBe(2011)
    expect(plainText('<p>Text</p>')).toBe('Text')
    expect(
      normalizeSteam([{ id: 3, name: 'Example', tiny_image: 'javascript:alert(1)' }])[0].poster,
    ).toBe('')
  })
})
