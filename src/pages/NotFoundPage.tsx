import { Link } from 'react-router'
import { PageHeader } from '@/app/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useDocumentTitle } from '@/lib/hooks'

export default function NotFoundPage() {
  const { t } = useI18n()
  useDocumentTitle(t('errors.notFoundTitle'))
  return (
    <>
      <PageHeader title={t('errors.notFoundTitle')} />
      <EmptyState
        className="py-32"
        title={<span className="display text-3xl">404</span>}
        text={t('errors.notFoundText')}
        action={
          <Button asChild variant="primary">
            <Link to="/">{t('errors.goHome')}</Link>
          </Button>
        }
      />
    </>
  )
}
