import { Download, Settings2, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Stats from '../components/Stats'
import { catalog } from '../lib/catalog'
import type { CatalogActions, CollectionActions } from '../lib/navigation'
import { useLibraryStore } from '../store/useLibraryStore'

export default function ProfilePage({
  onOpen,
  onExport,
  onImport,
  onPreferences,
  onAbout,
  calmMode,
  onCalmMode,
}: Pick<CatalogActions, 'onOpen'> & CollectionActions) {
  const entries = useLibraryStore((s) => s.entries)
  const customItems = useLibraryStore((s) => s.customItems)
  const navigate = useNavigate()
  return (
    <div className="profile-page">
      <div className="workspace-heading">
        <h1>Мой профиль</h1>
      </div>
      <p>Коллекция и настройки этого браузера.</p>
      <section className="profile-settings" aria-label="Настройки профиля">
        <button className="button button-outline" onClick={onPreferences}>
          <Settings2 size={16} />
          Платформы и регион
        </button>
        <button className="button button-outline" onClick={onExport}>
          <Download size={16} />
          Скачать резервную копию
        </button>
        <button className="button button-outline" onClick={onImport}>
          <Upload size={16} />
          Восстановить из файла
        </button>
        <label>
          <input
            type="checkbox"
            checked={calmMode}
            onChange={(e) => onCalmMode(e.target.checked)}
          />{' '}
          Меньше анимаций
        </label>
        <button className="text-button" onClick={onAbout}>
          О MediaShelf
        </button>
      </section>
      <Stats
        items={[...new Map([...catalog, ...customItems].map((i) => [i.id, i])).values()]}
        entries={entries}
        onOpen={onOpen}
        onDiscover={() => navigate('/search')}
        embedded
      />
    </div>
  )
}
