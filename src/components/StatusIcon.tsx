import { Film, Gamepad2, Sparkles, Tv } from 'lucide-react'
import type { Kind, Status } from '@shared/types.ts'
import { cn } from '@/lib/cn'

/** Monochrome status glyphs, distinguishable by shape rather than colour. */
export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const common = {
    className: cn('size-4 shrink-0', className),
    viewBox: '0 0 16 16',
    'aria-hidden': true as const,
  }
  switch (status) {
    case 'planned':
      return (
        <svg {...common}>
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2.4 2.2"
          />
        </svg>
      )
    case 'in_progress':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" />
        </svg>
      )
    case 'paused':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6.5 5.5v5M9.5 5.5v5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'completed':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="m5.3 8.2 1.8 1.8 3.6-3.8"
            fill="none"
            stroke="var(--panel)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'dropped':
      return (
        <svg {...common}>
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />
          <path d="M5.5 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
  }
}

const KIND_ICONS = { game: Gamepad2, movie: Film, series: Tv, anime: Sparkles }

export function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const Icon = KIND_ICONS[kind]
  return <Icon className={cn('size-4 shrink-0', className)} aria-hidden="true" />
}
