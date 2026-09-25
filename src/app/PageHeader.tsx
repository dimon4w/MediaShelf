import { ArrowLeft, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useScrolled, useShell } from './shell-context'
import { BrandMark } from './Brand'
import { AccountButton } from './UserMenu'

interface PageHeaderProps {
  title?: ReactNode
  /** Breadcrumb parent, e.g. Library › Interstellar */
  parent?: { label: string; to: string }
  actions?: ReactNode
  back?: boolean
  className?: string
  /** Hide the title until the page scrolls (for pages with their own hero). */
  revealTitle?: boolean
}

export function PageHeader({
  title,
  parent,
  actions,
  back,
  className,
  revealTitle,
}: PageHeaderProps) {
  const { t } = useI18n()
  const scrolled = useScrolled()
  const navigate = useNavigate()
  const { openPalette } = useShell()
  const showTitle = !revealTitle || scrolled
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 px-3 transition-[background-color,box-shadow] duration-200 sm:px-4',
        scrolled ? 'glass shadow-[0_1px_0_var(--line)]' : 'bg-transparent',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {back ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('common.back')}
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(parent?.to ?? '/'))}
          >
            <ArrowLeft />
          </Button>
        ) : (
          <Link to="/" className="mr-1 rounded-md md:hidden" aria-label={t('nav.home')}>
            <BrandMark className="size-7" />
          </Link>
        )}
        <div
          className={cn(
            'flex min-w-0 items-center gap-1.5 text-base transition-opacity duration-200',
            showTitle ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {parent ? (
            <>
              <Link
                to={parent.to}
                className="shrink-0 text-fg-3 transition-colors hover:text-fg max-sm:hidden"
              >
                {parent.label}
              </Link>
              <span className="text-fg-3 max-sm:hidden" aria-hidden="true">
                /
              </span>
            </>
          ) : null}
          {/* Pages with their own hero heading keep the bar title out of the heading outline. */}
          {revealTitle ? (
            <p className="truncate font-medium text-fg" aria-hidden={!showTitle}>
              {title}
            </p>
          ) : (
            <h1 className="truncate font-medium text-fg">{title}</h1>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label={t('nav.search')}
          onClick={() => openPalette('search')}
        >
          <Search />
        </Button>
        <AccountButton className="md:hidden" />
      </div>
    </header>
  )
}

/** Standard page body width and padding. */
export function PageBody({
  children,
  className,
  width = 'wide',
}: {
  children: ReactNode
  className?: string
  width?: 'wide' | 'narrow' | 'full'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 pb-24 sm:px-6 md:pb-12 lg:px-8',
        width === 'narrow' && 'max-w-3xl',
        width === 'wide' && 'max-w-[1400px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
