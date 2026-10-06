import { cn } from '@/lib/cn'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-7 shrink-0', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" className="fill-fg" />
      <rect x="15" y="16" width="8" height="32" rx="2.5" className="fill-panel" />
      <rect x="27" y="16" width="8" height="32" rx="2.5" className="fill-panel" fillOpacity=".72" />
      <rect
        x="38.2"
        y="17.4"
        width="8"
        height="31"
        rx="2.5"
        transform="rotate(-14 42.2 32.9)"
        className="fill-panel"
        fillOpacity=".44"
      />
    </svg>
  )
}
