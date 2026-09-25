import CatalogBrowser from '../components/CatalogBrowser'
import type { CatalogActions } from '../lib/navigation'

export default function SearchPage(props: CatalogActions) {
  return (
    <div className="search-page">
      <div className="workspace-heading">
        <h1>Поиск</h1>
      </div>
      <CatalogBrowser view="search" {...props} />
    </div>
  )
}
