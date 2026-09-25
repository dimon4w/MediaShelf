import { Popover as P } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverClose = P.Close
export const PopoverAnchor = P.Anchor

export function PopoverContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          'anim-menu z-50 rounded-xl bg-floating p-3 shadow-floating outline-none',
          className,
        )}
        {...props}
      />
    </P.Portal>
  )
}
