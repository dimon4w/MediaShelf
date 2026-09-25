import { describe, expect, it } from 'vitest'
import { imdbImage, normalizeImdbSuggestions } from './imdb.ts'
import { fixture } from './testing.ts'

describe('normalizeImdbSuggestions', () => {
  const results = normalizeImdbSuggestions(fixture('imdb-suggestion.json'))

  it('keeps movies and series, dropping franchises and people', () => {
    expect(results.map((result) => [result.record.id, result.record.names.original])).toEqual([
      ['series-tt5180504', 'The Witcher'],
      ['movie-tt28283547', 'The Rats: A Witcher Tale'],
      ['series-tt12785720', 'The Witcher: Blood Origin'],
      ['movie-tt11657662', 'The Witcher: Nightmare of the Wolf'],
      ['movie-tt15495150', 'The Witcher: Sirens of the Deep'],
      ['series-tt1070742', 'The Hexer'],
    ])
  })

  it('maps years, ranks and resized posters', () => {
    const [witcher, , bloodOrigin] = results
    expect(witcher.rank).toBe(349)
    expect(witcher.record).toMatchObject({
      kind: 'series',
      year: 2019,
      backdrop: null,
      genres: [],
      ratings: [],
    })
    // No `yr` range: the end year is unknown rather than "still running".
    expect(witcher.record.endYear).toBeUndefined()
    expect(witcher.record.poster).toMatch(
      /^https:\/\/m\.media-amazon\.com\/images\/M\/.+\._V1_QL80_UX600_\.jpg$/,
    )
    expect(bloodOrigin.record.endYear).toBe(2022)
  })

  it('drops unknown title types and junk', () => {
    const payload = {
      d: [
        { id: 'tt1', l: 'Game', qid: 'videoGame' },
        { id: 'tt0000002', l: 'Ep', qid: 'tvEpisode' },
        { id: 'nm1', l: 'Person' },
        7,
      ],
    }
    expect(normalizeImdbSuggestions(payload)).toEqual([])
    expect(normalizeImdbSuggestions(null)).toEqual([])
  })

  it('resizes only IMDb-style image URLs', () => {
    expect(imdbImage('https://m.media-amazon.com/images/M/abc@._V1_.jpg')).toBe(
      'https://m.media-amazon.com/images/M/abc@._V1_QL80_UX600_.jpg',
    )
    expect(imdbImage('https://example.com/x.jpg')).toBe('https://example.com/x.jpg')
    expect(imdbImage('http://m.media-amazon.com/x._V1_.jpg')).toBeUndefined()
  })
})
