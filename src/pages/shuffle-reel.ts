/**
 * Builds the slot-reel strip with the winner at `at`. Filled outwards from the winner so every
 * card differs from its neighbours whenever the pool has two or more titles.
 */
export function buildStrip<T extends { id: string }>(
  pool: readonly T[],
  winner: T,
  length: number,
  at: number,
  random: () => number = Math.random,
): T[] {
  const pick = (neighbour: T) => {
    const options = pool.filter((item) => item.id !== neighbour.id)
    const from = options.length ? options : pool
    return from[Math.floor(random() * from.length)]
  }
  const strip = new Array<T>(length)
  strip[at] = winner
  for (let index = at - 1; index >= 0; index--) strip[index] = pick(strip[index + 1])
  for (let index = at + 1; index < length; index++) strip[index] = pick(strip[index - 1])
  return strip
}
