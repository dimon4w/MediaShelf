import { Tooltip as T } from 'radix-ui'
import type { ReactNode } from 'react'

export const TooltipProvider = T.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
  disabled,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  disabled?: boolean
}) {
  if (disabled) return <>{children}</>
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="anim-fade z-[60] rounded-md bg-fg px-2 py-1 text-xs font-medium text-panel shadow-floating"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
