import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function StatCard({
  title,
  meta,
  children,
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col rounded-xl bg-raised p-4 ring-1 ring-line ring-inset sm:p-5',
        className,
      )}
    >
      <header className="mb-5 flex min-h-[22px] items-baseline justify-between gap-3">
        <h2 id={id} className="text-md font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        {meta ? <p className="tabular shrink-0 text-sm text-fg-3">{meta}</p> : null}
      </header>
      {children}
    </section>
  )
}
