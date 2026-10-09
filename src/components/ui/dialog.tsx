import { X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { Button } from './button'

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close

interface ContentProps {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  hideTitle?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-5xl' }

export function DialogContent({
  title,
  description,
  children,
  className,
  hideTitle,
  size = 'md',
}: ContentProps) {
  const { t } = useI18n()
  return (
    <D.Portal>
      <D.Overlay className="anim-fade fixed inset-0 z-50 bg-scrim" />
      <D.Content
        className={cn(
          'anim-pop fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
          'rounded-xl liquid-float p-5 outline-none sm:p-6',
          widths[size],
          className,
        )}
      >
        <div className={cn('mb-4 flex items-start gap-4 pr-8', hideTitle && 'sr-only')}>
          <div className="grid gap-1">
            <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
            {description ? (
              <D.Description className="text-sm text-fg-2">{description}</D.Description>
            ) : null}
          </div>
        </div>
        {!description ? (
          <D.Description className="sr-only">
            {typeof title === 'string' ? title : ''}
          </D.Description>
        ) : null}
        {children}
        <D.Close asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3.5 right-3.5"
            aria-label={t('common.close')}
          >
            <X />
          </Button>
        </D.Close>
      </D.Content>
    </D.Portal>
  )
}

interface ConfirmProps {
  open: boolean
  onOpenChange(open: boolean): void
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm(): unknown | Promise<unknown>
  children?: ReactNode
  disabled?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  children,
  disabled,
}: ConfirmProps) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent title={title} description={description} size="sm">
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
            }
          }}
        >
          {children}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              disabled={disabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
