import { PageBody, PageHeader } from '@/app/PageHeader'
import { useI18n } from '@/i18n'
import { useParams } from 'react-router'

export default function UserPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  return (
    <>
      <PageHeader title={t('profile.title')} back />
      <PageBody>
        <p className="text-fg-2">profile {id}</p>
      </PageBody>
    </>
  )
}