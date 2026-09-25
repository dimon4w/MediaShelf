import { RoulettePanel } from '../components/StorefrontDialogs'
import { catalog } from '../lib/catalog'
import { mergeWorks } from '../lib/discovery'
import { defaultPreferences } from '../lib/platforms'
import { useCatalogDetails } from '../lib/useCatalogDetails'
import { useOnlineCatalog } from '../lib/useOnlineCatalog'
import { useLibraryStore } from '../store/useLibraryStore'
import type { MediaItem } from '../lib/types'

export default function TodayPage(props: {
  onOpen: (item: MediaItem) => void
  onAdd: (item: MediaItem) => void
  reducedMotion: boolean
}) {
  const entries = useLibraryStore((s) => s.entries)
  const customItems = useLibraryStore((s) => s.customItems)
  const country = useLibraryStore((s) => s.preferences?.country ?? defaultPreferences.country)
  const online = useOnlineCatalog(true, 'all', '', country)
  const items = mergeWorks([...catalog, ...customItems, ...online.items])
  const withDetails = useCatalogDetails(items.slice(0, 20), country)
  return (
    <div className="today-page">
      <RoulettePanel {...props} items={items.map(withDetails)} libraryIds={Object.keys(entries)} />
    </div>
  )
}
