import { Clapperboard, Gamepad2, Store, Tv } from 'lucide-react'
import {
  siAnilist,
  siEpicgames,
  siGogdotcom,
  siImdb,
  siMetacritic,
  siPlaystation,
  siShikimori,
  siSteam,
  siStremio,
  siWikidata,
  siWikipedia,
} from 'simple-icons'
import type { SourceId, StoreId } from '@shared/types.ts'
import { cn } from '@/lib/cn'

const ICONS: Partial<Record<SourceId | StoreId | 'metacritic', { path: string }>> = {
  steam: siSteam,
  gog: siGogdotcom,
  epic: siEpicgames,
  playstation: siPlaystation,
  imdb: siImdb,
  anilist: siAnilist,
  shikimori: siShikimori,
  wikipedia: siWikipedia,
  wikidata: siWikidata,
  metacritic: siMetacritic,
  cinemeta: siStremio,
}

const FALLBACK = { xbox: Gamepad2, nintendo: Gamepad2, tvmaze: Tv, cinemeta: Clapperboard } as const

/** Monochrome brand mark for stores and data sources. */
export function BrandIcon({
  id,
  className,
}: {
  id: SourceId | StoreId | 'metacritic'
  className?: string
}) {
  const icon = ICONS[id]
  if (icon)
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn('size-4 shrink-0 fill-current', className)}
        aria-hidden="true"
      >
        <path d={icon.path} />
      </svg>
    )
  const Fallback = FALLBACK[id as keyof typeof FALLBACK] ?? Store
  return <Fallback className={cn('size-4 shrink-0', className)} aria-hidden="true" />
}
