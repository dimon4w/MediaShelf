import type { MediaItem } from './types'

export const navigation = [
  { path: '/', label: 'Чарты' },
  { path: '/search', label: 'Поиск' },
  { path: '/library', label: 'Моя полка' },
  { path: '/today', label: 'Что сегодня?' },
  { path: '/profile', label: 'Мой профиль' },
] as const

export interface CatalogActions {
  onOpen: (item: MediaItem) => void
  onRemove: (item: MediaItem) => void
  notify: (message: string, error?: boolean) => void
}

export interface CollectionActions {
  onExport: () => void
  onImport: () => void
  onPreferences: () => void
  onAbout: () => void
  calmMode: boolean
  onCalmMode: (value: boolean) => void
}
