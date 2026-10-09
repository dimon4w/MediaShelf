import { Check, ChevronDown } from 'lucide-react'
import { Select as S } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

interface SelectProps<T extends string> {
  value: T
  onValueChange(value: T): void
  options: SelectOption<T>[]
  label?: string
  id?: string
  className?: string
  size?: 'sm' | 'md'
  placeholder?: string
  'aria-label'?: string
}

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  id,
  className,
  size = 'md',
  placeholder,
  ...rest
}: SelectProps<T>) {
  return (
    <S.Root value={value} onValueChange={(next) => onValueChange(next as T)}>
      <S.Trigger
        id={id}
        aria-label={rest['aria-label']}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-lg bg-raised text-fg ring-1 ring-line ring-inset',
          'transition-colors outline-none hover:ring-line-strong focus-visible:ring-line-strong focus-visible:shadow-[0_0_0_4px_var(--active)]',
          'data-[placeholder]:text-fg-3 [&_svg]:size-4',
          size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-9 px-3 text-base',
          className,
        )}
      >
        <span className="truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon>
          <ChevronDown className="text-fg-3" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="anim-menu z-50 max-h-[min(var(--radix-select-content-available-height),360px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg liquid-float"
        >
          <S.Viewport className="p-1">
            {options.map((option) => (
              <S.Item
                key={option.value}
                value={option.value}
                className="relative flex h-8 cursor-default items-center gap-2 rounded-md pr-8 pl-2 text-base outline-none select-none data-[highlighted]:bg-hover [&_svg]:size-4"
              >
                {option.icon}
                <S.ItemText>{option.label}</S.ItemText>
                <S.ItemIndicator className="absolute right-2">
                  <Check />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
