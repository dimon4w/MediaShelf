import { Clapperboard, Gamepad2, Sparkles, Tv } from 'lucide-react'
import type { LibraryEntry, LibraryStatus, MediaItem, MediaType } from './types'

/* Colours are design tokens, not literals: these values are only ever fed to
   inline `color` / `background`, so the palette stays owned by styles.css. */
export const mediaMeta = {
  game: { label: 'Игры', singular: 'Игра', icon: Gamepad2, color: 'var(--muted)' },
  movie: { label: 'Фильмы', singular: 'Фильм', icon: Clapperboard, color: 'var(--muted)' },
  series: { label: 'Сериалы', singular: 'Сериал', icon: Tv, color: 'var(--muted)' },
  anime: { label: 'Аниме', singular: 'Аниме', icon: Sparkles, color: 'var(--muted)' },
} as const

export const statusMeta = {
  planned: { label: 'В планах', color: 'var(--quiet)', description: 'К чему хочется вернуться' },
  active: {
    label: 'В процессе',
    color: 'var(--muted)',
    description: 'Сейчас играешь или смотришь',
  },
  completed: {
    label: 'Завершено',
    color: 'var(--text)',
    description: 'Истории, которые уже прожиты',
  },
} as const

export const sourceLabels = {
  steam: 'Steam',
  imdb: 'IMDb',
  tvmaze: 'TVmaze',
  shikimori: 'Shikimori',
  gog: 'GOG',
  epic: 'Epic Games',
  cinemeta: 'Cinemeta',
} as const

export function statusLabel(type: MediaType, status: LibraryStatus) {
  if (status === 'planned') return 'В планах'
  if (status === 'active') return type === 'game' ? 'Играю' : 'Смотрю'
  return type === 'game' ? 'Пройдено' : 'Просмотрено'
}

export function availableStatuses(type: MediaType): LibraryStatus[] {
  return type === 'movie' ? ['planned', 'completed'] : ['planned', 'active', 'completed']
}

export function plural(count: number, words: [string, string, string]) {
  const last = count % 100
  return last >= 11 && last <= 14
    ? words[2]
    : count % 10 === 1
      ? words[0]
      : count % 10 >= 2 && count % 10 <= 4
        ? words[1]
        : words[2]
}

export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours} ч` : '', rest ? `${rest} мин` : ''].filter(Boolean).join(' ')
}

export function progressLabel(item: MediaItem, entry: LibraryEntry) {
  if (item.type === 'game') return `${entry.progress}% пройдено`
  if (item.type === 'movie') return statusLabel(item.type, entry.status)
  return item.episodes
    ? `${entry.progress} / ${item.episodes} эп.`
    : `${entry.progress} ${plural(entry.progress, ['эпизод', 'эпизода', 'эпизодов'])}`
}
