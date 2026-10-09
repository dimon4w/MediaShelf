import { Check, ChevronRight } from 'lucide-react'
import { DropdownMenu as M } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Menu = M.Root
export const MenuTrigger = M.Trigger
export const MenuGroup = M.Group
export const MenuRadioGroup = M.RadioGroup
export const MenuSub = M.Sub

const surface = 'anim-menu z-50 min-w-44 overflow-hidden rounded-lg liquid-float p-1 outline-none'
const item = cn(
  'relative flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-base text-fg outline-none select-none',
  'data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-2',
)

export function MenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(surface, className)}
        {...props}
      />
    </M.Portal>
  )
}

export function MenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof M.Item> & { destructive?: boolean }) {
  return (
    <M.Item
      className={cn(item, destructive && 'text-danger [&_svg]:text-danger', className)}
      {...props}
    />
  )
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn(item, 'pr-8', className)} {...props}>
      {children}
      <M.ItemIndicator className="absolute right-2">
        <Check className="!text-fg" />
      </M.ItemIndicator>
    </M.RadioItem>
  )
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem className={cn(item, 'pr-8', className)} {...props}>
      {children}
      <M.ItemIndicator className="absolute right-2">
        <Check className="!text-fg" />
      </M.ItemIndicator>
    </M.CheckboxItem>
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return (
    <M.Label
      className={cn('px-2 pt-1.5 pb-1 text-xs font-medium text-fg-3', className)}
      {...props}
    />
  )
}

export function MenuSeparator({ className }: { className?: string }) {
  return <M.Separator className={cn('mx-1 my-1 h-px bg-line', className)} />
}

export function MenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof M.SubTrigger>) {
  return (
    <M.SubTrigger className={cn(item, 'data-[state=open]:bg-hover', className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </M.SubTrigger>
  )
}

export function MenuSubContent({ className, ...props }: ComponentProps<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent
        sideOffset={6}
        collisionPadding={8}
        className={cn(surface, className)}
        {...props}
      />
    </M.Portal>
  )
}

export function MenuShortcut({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-4 font-mono text-2xs text-fg-3">{children}</span>
}
