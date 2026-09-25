/**
 * Sort position for a card dropped between two neighbours. Positions are sparse floats,
 * so a move rewrites only the moved card.
 */
export function positionBetween(before: number | undefined, after: number | undefined) {
  if (before !== undefined && after !== undefined) return (before + after) / 2
  if (before !== undefined) return before + 1
  if (after !== undefined) return after - 1
  return 0
}
