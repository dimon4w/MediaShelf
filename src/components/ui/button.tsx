import { Slot } from 'radix-ui'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const variants = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-raised text-fg ring-1 ring-inset ring-line hover:bg-active',
  outline: 'text-fg ring-1 ring-inset ring-line-strong hover:bg-hover',
  ghost: 'text-fg-2 hover:bg-hover hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90',
  'danger-ghost': 'text-danger hover:bg-danger/10',
} as const

const sizes = {
  xs: 'h-7 gap-1.5 rounded-md px-2 text-xs',
  sm: 'h-8 gap-1.5 rounded-md px-3 text-sm',
  md: 'h-9 gap-2 rounded-lg px-3.5 text-base',
  lg: 'h-11 gap-2 rounded-lg px-5 text-md',
  'icon-xs': 'size-7 rounded-md',
  'icon-sm': 'size-8 rounded-md',
  icon: 'size-9 rounded-lg',
  'icon-lg': 'size-11 rounded-lg',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  asChild?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    asChild,
    loading,
    className,
    disabled,
    children,
    type,
    ...props
  },
  ref,
) {
  const Component = asChild ? Slot.Root : 'button'
  return (
    <Component
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap',
        'transition-[background-color,color,box-shadow,opacity,transform] duration-150 ease-out',
        'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <span className="invisible contents">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </Component>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4 animate-spin', className)} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
