import { describe, expect, it } from 'vitest'
import { buildStrip } from './shuffle-reel.ts'

const items = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `t${index}` }))

describe('buildStrip', () => {
  it('places the winner and never repeats a neighbour', () => {
    for (const size of [2, 3, 6, 40]) {
      const pool = items(size)
      for (let run = 0; run < 50; run++) {
        const winner = pool[run % size]
        const strip = buildStrip(pool, winner, 38, 32)
        expect(strip).toHaveLength(38)
        expect(strip[32]).toBe(winner)
        for (let index = 1; index < strip.length; index++)
          expect(strip[index].id).not.toBe(strip[index - 1].id)
      }
    }
  })

  it('repeats the only title of a single-item pool', () => {
    const [only] = items(1)
    expect(buildStrip([only], only, 5, 2).every((item) => item === only)).toBe(true)
  })
})
