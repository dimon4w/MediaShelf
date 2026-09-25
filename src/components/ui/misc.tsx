import { Switch as RadixSwitch } from 'radix-ui'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Badge({
  className,
  variant = 'subtle',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: 'subtle' | 'solid' | 'outline' | 'overlay' }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
        variant === 'subtle' && 'bg-active text-fg-2',
        variant === 'solid' && 'bg-fg text-panel',
        variant === 'outline' && 'text-fg-2 ring-1 ring-line-strong ring-inset',
        variant === 'overlay' && 'bg-black/60 text-white backdrop-blur-md',
        className,
      )}
      {...props}
    />
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs px-1 font-mono text-2xs font-medium text-fg-3 ring-1 ring-line ring-inset',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-shimmer rounded-md bg-skeleton', className)}
      {...props}
    />
  )
}

export function ProgressBar({
  value,
  className,
  label,
  tone = 'fg',
}: {
  value: number
  className?: string
  label?: string
  tone?: 'fg' | 'white'
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={cn(
        'h-1 overflow-hidden rounded-full',
        tone === 'white' ? 'bg-white/25' : 'bg-active',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'white' ? 'bg-white' : 'bg-fg',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '•'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full bg-fg text-[11px] font-semibold tracking-tight text-panel',
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-raised text-fg-2 ring-1 ring-line ring-inset [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {text ? <p className="mt-1.5 text-base text-fg-2">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onCheckedChange(checked: boolean): void
  id?: string
  'aria-label'?: string
}) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className="relative h-5 w-9 shrink-0 rounded-full bg-active ring-1 ring-line ring-inset transition-colors data-[state=checked]:bg-fg"
    >
      <RadixSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-panel shadow-sm transition-transform duration-200 ease-out data-[state=checked]:translate-x-[18px] dark:bg-fg dark:data-[state=checked]:bg-panel" />
    </RadixSwitch.Root>
  )
}

export function Chip({
  active,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 [&_svg]:size-3.5',
        active
          ? 'bg-fg text-panel'
          : 'bg-raised text-fg-2 ring-1 ring-line ring-inset hover:bg-active hover:text-fg',
        'disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SectionHeader({
  title,
  action,
  className,
  id,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <h2 id={id} className="text-xl font-semibold tracking-[-0.015em]">
        {title}
      </h2>
      {action}
    </div>
  )
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px bg-line', className)} />
}
