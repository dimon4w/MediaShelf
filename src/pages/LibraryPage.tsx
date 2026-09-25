import { useNavigate } from 'react-router-dom'
import CatalogBrowser from '../components/CatalogBrowser'
import ContinueShelf from '../components/ContinueShelf'
import { catalog } from '../lib/catalog'
import type { CatalogActions } from '../lib/navigation'
import { useLibraryStore } from '../store/useLibraryStore'

export default function LibraryPage(props: CatalogActions) {
  const entries = useLibraryStore((s) => s.entries)
  const customItems = useLibraryStore((s) => s.customItems)
  const navigate = useNavigate()
  return (
    <div className="library-page">
      <CatalogBrowser view="library" {...props} />
      <ContinueShelf
        items={[...new Map([...catalog, ...customItems].map((i) => [i.id, i])).values()]}
        entries={entries}
        onOpen={props.onOpen}
        onLibrary={() => navigate('/library')}
      />
    </div>
  )
}
