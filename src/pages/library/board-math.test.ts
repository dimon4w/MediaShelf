import { describe, expect, it } from 'vitest'
import { positionBetween } from './board-math.ts'

describe('positionBetween', () => {
  it('lands strictly between neighbours', () => {
    expect(positionBetween(1, 2)).toBe(1.5)
    expect(positionBetween(-10, -9)).toBe(-9.5)
  })

  it('extends past the ends of a column', () => {
    expect(positionBetween(5, undefined)).toBe(6)
    expect(positionBetween(undefined, 5)).toBe(4)
    expect(positionBetween(undefined, undefined)).toBe(0)
  })

  it('keeps order through repeated inserts at the same spot', () => {
    let after = 1
    const before = 0
    for (let i = 0; i < 40; i++) {
      const next = positionBetween(before, after)
      expect(next).toBeGreaterThan(before)
      expect(next).toBeLessThan(after)
      after = next
    }
  })
})
