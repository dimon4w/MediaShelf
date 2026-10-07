import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <header className="mb-6">
      <h2 className="text-xl font-semibold tracking-[-0.015em]">{title}</h2>
      <p className="mt-1 text-base text-fg-2">{text}</p>
    </header>
  )
}

/** A titled box of rows separated by hairlines. */
export function Group({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section aria-labelledby={title ? id : undefined} className={className}>
      {title ? (
        <div className="mb-3">
          <h3 id={id} className="text-md font-semibold tracking-[-0.01em]">
            {title}
          </h3>
          {description ? <p className="mt-0.5 text-sm text-fg-3">{description}</p> : null}
        </div>
      ) : null}
      <div className="@container divide-y divide-line rounded-xl ring-1 ring-line ring-inset">
        {children}
      </div>
    </section>
  )
}

interface RowProps {
  title: ReactNode
  description?: ReactNode
  /** Turns the title into a `<label>` for this control id. */
  htmlFor?: string
  titleId?: string
  /** Control beside the text on wide rows and below it on narrow ones. */
  action?: ReactNode
  /** Content that always sits under the text, such as chips or radio cards. */
  children?: ReactNode
  className?: string
}

export function Row({
  title,
  description,
  htmlFor,
  titleId,
  action,
  children,
  className,
}: RowProps) {
  const titleClass = 'block text-base font-medium text-fg'
  return (
    <div className={cn('px-4 py-4 sm:px-5', className)}>
      <div className="flex flex-col gap-3 @md:flex-row @md:items-center @md:justify-between @md:gap-8">
        <div className="min-w-0">
          {htmlFor ? (
            <label id={titleId} htmlFor={htmlFor} className={titleClass}>
              {title}
            </label>
          ) : (
            <p id={titleId} className={titleClass}>
              {title}
            </p>
          )}
          {description ? <p className="mt-0.5 text-sm text-fg-3">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}

/** Action bar at the bottom of a group: a note on the left, buttons on the right. */
export function GroupFooter({ note, children }: { note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 @md:min-h-14 @md:flex-row @md:items-center @md:justify-between">
      <div className="min-w-0 text-xs text-fg-3">{note}</div>
      {children ? (
        <div className="flex shrink-0 items-center justify-end gap-2">{children}</div>
      ) : null}
    </div>
  )
}
