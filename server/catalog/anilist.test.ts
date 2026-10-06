import { describe, expect, it } from 'vitest'
import { normalizeAniListMedia, normalizeAniListPage } from './anilist.ts'
import { fixture } from './testing.ts'

describe('normalizeAniListPage', () => {
  it('keys records by MAL id and skips media without one', () => {
    const page = normalizeAniListPage(fixture('anilist-page.json'))
    expect(page.hasNextPage).toBe(true)
    expect(page.items.map((item) => item.id)).toEqual(['anime-59970', 'anime-63129'])
    expect(page.items[0]).toMatchObject({
      names: {
        original: 'Tensei Shitara Slime Datta Ken 4th Season Part 1 & 2',
        en: 'That Time I Got Reincarnated as a Slime Season 4',
      },
      year: 2026,
      genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
      ratings: [{ source: 'anilist', value: 83, max: 100 }],
      episodes: 24,
      airing: 'ended',
      externalIds: { mal: '59970', anilist: '182205' },
    })
    expect(page.items[0].backdrop).toMatch(
      /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/anime\/banner\//,
    )
    expect(page.items[1]).toMatchObject({ airing: 'upcoming', ratings: [], backdrop: null })
  })
})

describe('normalizeAniListMedia', () => {
  it('reads English description, trailer and studios', () => {
    const record = normalizeAniListMedia(
      fixture<{ data: { Media: unknown } }>('anilist-media.json').data.Media,
      true,
    )
    expect(record).toMatchObject({
      id: 'anime-52991',
      names: { original: 'Sousou no Frieren', en: 'Frieren: Beyond Journey’s End' },
      year: 2023,
      endYear: 2024,
      runtime: 24,
      episodes: 28,
      releaseDate: '2023-09-29',
      creators: ['MADHOUSE'],
      trailer: { type: 'youtube' },
      links: [{ source: 'anilist', url: 'https://anilist.co/anime/154587' }],
    })
    expect(record?.poster).toMatch(/^https:\/\/s4\.anilist\.co\/.+\/cover\/large\//)
    expect(record?.descriptions?.en).toMatch(/^The adventure is over but life goes on/)
    expect(record?.descriptions?.en).not.toMatch(/<br>|\(Source/)
  })

  it('rejects adult or unmatched media', () => {
    expect(
      normalizeAniListMedia({ id: 1, idMal: 1, title: { romaji: 'X' }, isAdult: true }),
    ).toBeNull()
    expect(normalizeAniListMedia({ id: 1, title: { romaji: 'X' } })).toBeNull()
  })
})
