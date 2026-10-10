import type { ActivityItem } from '@shared/types.ts'

const WINDOW_MS = 10 * 60_000

/**
 * Folds lines about the same title made within a few minutes into one, so adding a game as
 * "Dropped" and rating it 6 reads as one line ("Added: Dropped · Rating 6/10") instead of two.
 * Expects newest first, as the API returns it.
 */
export function mergeActivity(items: ActivityItem[]): ActivityItem[] {
  const out: ActivityItem[] = []
  for (const item of items) {
    const previous = out.at(-1)
    if (
      previous &&
      previous.titleId === item.titleId &&
      Math.abs(Date.parse(previous.createdAt) - Date.parse(item.createdAt)) <= WINDOW_MS
    ) {
      const merged = fold(previous, item)
      if (merged) {
        out[out.length - 1] = merged
        continue
      }
    }
    out.push(item)
  }
  return out
}

function fold(newer: ActivityItem, older: ActivityItem): ActivityItem | null {
  const pair = [newer, older]
  const statusLine = pair.find((item) => item.type === 'added' || item.type === 'status')
  const rated = pair.find((item) => item.type === 'rated')
  if (statusLine && rated && statusLine !== rated) {
    return {
      ...statusLine,
      id: newer.id,
      createdAt: newer.createdAt,
      data: { ...statusLine.data, rating: rated.data.rating ?? null },
    }
  }
  if (newer.type === 'episodes' && older.type === 'episodes') {
    return {
      ...newer,
      data: { ...newer.data, count: (newer.data.count ?? 0) + (older.data.count ?? 0) },
    }
  }
  return null
}
