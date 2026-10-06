import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  count?: number
  title?: string
}

interface Props<T extends string> {
  value: T
  onChange(value: T): void
  options: SegmentOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label': string
  iconOnlyOnMobile?: boolean
}

/** Segmented control with a sliding highlight (ARIA radiogroup). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  iconOnlyOnMobile,
  ...rest
}: Props<T>) {
  const id = useId()
  const move = (direction: 1 | -1) => {
    const index = options.findIndex((option) => option.value === value)
    const next = options[(index + direction + options.length) % options.length]
    onChange(next.value)
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-segment="${id}-${next.value}"]`)?.focus(),
    )
  }
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-raised p-0.5 ring-1 ring-line ring-inset no-scrollbar',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') move(1)
        else if (event.key === 'ArrowLeft') move(-1)
        else return
        event.preventDefault()
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={option.title}
            data-segment={`${id}-${option.value}`}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150',
              '[&_svg]:size-4',
              size === 'sm' ? 'h-7 px-2.5 text-sm' : 'h-8 px-3 text-base',
              active ? 'text-fg' : 'text-fg-3 hover:text-fg',
            )}
          >
            {active ? (
              <motion.span
                layoutId={`segment-${id}`}
                className="absolute inset-0 rounded-md bg-panel shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.12)] dark:bg-active dark:shadow-none"
                transition={{ type: 'spring', visualDuration: 0.25, bounce: 0 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              <span className={cn(iconOnlyOnMobile && option.icon && 'max-sm:sr-only')}>
                {option.label}
              </span>
              {option.count !== undefined ? (
                <span className="tabular text-xs text-fg-3">{option.count}</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
