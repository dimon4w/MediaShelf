import { expect, it } from 'vitest'
import { normalizeEpisodes } from './episodes'

it('normalizes actual episode titles, season numbers and specials without inventing missing episodes', () => {
  const values = normalizeEpisodes(
    [
      { season: 1, number: 2, name: 'Second' },
      { season: 1, number: 1, name: 'First' },
      { season: 0, number: 1, name: 'Special' },
      { season: 1, number: null, name: 'TBA' },
    ],
    'tvmaze',
  )
  expect(values.map((e) => e.key)).toEqual(['0:1', '1:1', '1:2'])
  expect(values[1].title).toBe('First')
})
