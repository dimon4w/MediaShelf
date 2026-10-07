import { describe, expect, it } from 'vitest'
import { normalizeJikanEpisodes } from './jikan.ts'
import { fixture } from './testing.ts'

describe('normalizeJikanEpisodes', () => {
  it('reads episode numbers, titles and air dates', () => {
    expect(normalizeJikanEpisodes(fixture('jikan-episodes.json'))).toEqual({
      episodes: [
        { number: 1, name: 'Fullmetal Alchemist', airdate: '2009-04-05' },
        { number: 2, name: 'The First Day', airdate: '2009-04-12' },
        { number: 3, name: 'City of Heresy', airdate: '2009-04-19' },
      ],
      hasNextPage: false,
      lastPage: 1,
    })
  })

  it('tolerates error payloads', () => {
    expect(normalizeJikanEpisodes({ status: 504, message: 'Gateway timeout' })).toEqual({
      episodes: [],
      hasNextPage: false,
      lastPage: 1,
    })
  })
})
