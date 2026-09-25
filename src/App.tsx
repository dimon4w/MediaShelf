import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Check, Download, ShieldCheck, X } from 'lucide-react'
import SiteHeader from './components/SiteHeader'
import { AboutDialog, AddDialog, ConfirmDialog, DetailDialog } from './components/Dialogs'
import { PreferencesDialog } from './components/StorefrontDialogs'
import ChartsPage from './pages/ChartsPage'
import { MAX_BACKUP_BYTES, mediaItemSchema, parseBackup } from './lib/library'
import { defaultPreferences } from './lib/platforms'
import { navigation } from './lib/navigation'
import { useScrollHeader } from './lib/useScrollHeader'
import { useCatalogDetails } from './lib/useCatalogDetails'
import { useLibraryStore } from './store/useLibraryStore'
import type { MediaItem, MediaType } from './lib/types'

const SearchPage = lazy(() => import('./pages/SearchPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const TodayPage = lazy(() => import('./pages/TodayPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

export default function App() {
  const entries = useLibraryStore((s) => s.entries)
  const preferences = useLibraryStore((s) => s.preferences ?? defaultPreferences)
  const storageError = useLibraryStore((s) => s.storageError)
  const recoveryRequired = useLibraryStore((s) => s.recoveryRequired)
  const location = useLocation()
  const navigate = useNavigate()
  const { hidden: headerHidden, headerRef } = useScrollHeader()
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [removeItem, setRemoveItem] = useState<MediaItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<{ json: string; count: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; error: boolean; id: number } | null>(null)
  const [calmMode, setCalmMode] = useState(() => {
    try {
      return localStorage.getItem('mediashelf-calm-mode') === '1'
    } catch {
      return false
    }
  })
  const systemReducedMotion = useReducedMotion()
  const reducedMotion = calmMode || !!systemReducedMotion
  const fileInput = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const hasSearchBar = location.pathname === '/search' || location.pathname === '/library'
  const withDetails = useCatalogDetails(selected ? [selected] : [], preferences.country)
  const selectedItem = selected ? withDetails(selected) : null
  const rawType = new URLSearchParams(location.search).get('type')
  const defaultType: MediaType =
    rawType && ['game', 'movie', 'series', 'anime'].includes(rawType)
      ? (rawType as MediaType)
      : 'movie'

  function notify(message: string, error = false) {
    setToast({ message, error, id: performance.now() })
  }
  function open(item: MediaItem) {
    setSelected(item)
    try {
      const data: unknown = JSON.parse(localStorage.getItem('mediashelf-recent') ?? '[]')
      const recent: MediaItem[] = Array.isArray(data)
        ? data.filter((i) => mediaItemSchema.safeParse(i).success)
        : []
      localStorage.setItem(
        'mediashelf-recent',
        JSON.stringify([item, ...recent.filter((i) => i.id !== item.id)].slice(0, 8)),
      )
    } catch {
      /* Recent views are optional. */
    }
  }
  function add(item: MediaItem) {
    try {
      useLibraryStore.getState().addItem(item)
      notify('История на твоей полке')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Ошибка сохранения', true)
    }
  }
  function downloadBackup() {
    const url = URL.createObjectURL(
      new Blob([useLibraryStore.getState().exportCollection()], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `mediashelf-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('Резервная копия готова')
  }
  async function readBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Максимальный размер: 16 МБ.')
      const json = await file.text()
      const data = parseBackup(json)
      setPendingBackup({ json, count: Object.keys(data.entries).length })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось прочитать файл', true)
    }
  }
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    document.documentElement.classList.toggle('calm-mode', reducedMotion)
    try {
      localStorage.setItem('mediashelf-calm-mode', calmMode ? '1' : '0')
    } catch {
      /* Collection handles storage errors. */
    }
    return () => document.documentElement.classList.remove('calm-mode')
  }, [calmMode, reducedMotion])
  useEffect(() => {
    const page = navigation.find((item) => item.path === location.pathname)
    document.title = `${page?.label ?? 'Страница не найдена'} — MediaShelf`
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      mainRef.current?.focus({ preventScroll: true })
      previousPath.current = location.pathname
    }
  }, [location.pathname])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        document.querySelector('[role="dialog"]') ||
        (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')
      )
        return
      if (
        event.key === '/' ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.global-search input')
        if (input) input.focus()
        else navigate('/search', { state: { focusSearch: true } })
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [navigate])

  const catalogActions = { onOpen: open, onRemove: setRemoveItem, notify }
  const collectionActions = {
    onExport: downloadBackup,
    onImport: () => fileInput.current?.click(),
    onPreferences: () => setPreferencesOpen(true),
    onAbout: () => setAboutOpen(true),
    calmMode,
    onCalmMode: setCalmMode,
  }
  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div
        className={`app-shell ${hasSearchBar ? 'has-search-bar' : 'page-shell'} ${reducedMotion ? 'calm-mode' : ''} ${headerHidden ? 'header-hidden' : ''}`}
      >
        <a className="skip-link" href="#main-content">
          Перейти к содержимому
        </a>
        <SiteHeader
          {...collectionActions}
          headerRef={headerRef}
          hidden={headerHidden}
          libraryCount={Object.keys(entries).length}
          onAdd={() => setAddOpen(true)}
        />
        <input
          type="file"
          ref={fileInput}
          accept=".json,application/json"
          onChange={readBackup}
          className="hidden"
          aria-label="Резервная копия MediaShelf"
        />
        <div className="header-space" aria-hidden="true" />
        <main className="main-container" id="main-content" ref={mainRef} tabIndex={-1}>
          {storageError && (
            <div className="storage-warning" role="alert">
              <ShieldCheck size={20} />
              <p>{storageError}</p>
              <button onClick={downloadBackup}>Скачать копию</button>
              <button
                onClick={() =>
                  recoveryRequired
                    ? fileInput.current?.click()
                    : useLibraryStore.getState().clearStorageError()
                }
              >
                {recoveryRequired ? 'Восстановить из файла' : 'Повторить'}
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <p className="page-loading" role="status">
                Загружаем страницу…
              </p>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <ChartsPage {...catalogActions} onAdd={add} reducedMotion={reducedMotion} />
                }
              />
              <Route path="/search" element={<SearchPage {...catalogActions} />} />
              <Route path="/library" element={<LibraryPage {...catalogActions} />} />
              <Route
                path="/today"
                element={<TodayPage onOpen={open} onAdd={add} reducedMotion={reducedMotion} />}
              />
              <Route
                path="/profile"
                element={<ProfilePage {...collectionActions} onOpen={open} />}
              />
              <Route path="/charts" element={<Navigate to="/" replace />} />
              <Route path="/stats" element={<Navigate to="/profile" replace />} />
              <Route
                path="*"
                element={
                  <section className="empty-state">
                    <h1>Страница не найдена</h1>
                    <Link to="/" className="button button-primary">
                      Открыть чарты
                    </Link>
                  </section>
                }
              />
            </Routes>
          </Suspense>
        </main>
        <footer className="site-footer">
          <div className="footer-inner">
            <span className="footer-wordmark">
              media/shelf<span>Собирай впечатления.</span>
            </span>
            <div>
              <button onClick={() => setAboutOpen(true)}>О проекте</button>
              <button onClick={downloadBackup}>
                <Download size={13} />
                Скачать коллекцию
              </button>
              <span>Твоя коллекция хранится в этом браузере</span>
            </div>
          </div>
        </footer>
        {selectedItem && (
          <DetailDialog
            key={selectedItem.id}
            item={selectedItem}
            entry={entries[selectedItem.id]}
            onClose={() => setSelected(null)}
            onRemove={setRemoveItem}
            notify={notify}
          />
        )}
        {addOpen && (
          <AddDialog
            defaultType={defaultType}
            onClose={() => setAddOpen(false)}
            onCreated={(item) => {
              setAddOpen(false)
              open(item)
              notify('Твоя история добавлена на полку')
            }}
          />
        )}
        {removeItem && (
          <ConfirmDialog
            danger
            title="Убрать с полки?"
            description={`«${removeItem.title}»: прохождения, оценка и заметки будут удалены.`}
            confirmLabel="Убрать с полки"
            onClose={() => setRemoveItem(null)}
            onConfirm={() => {
              useLibraryStore.getState().removeItem(removeItem.id)
              setRemoveItem(null)
              notify('Убрано с полки')
            }}
          />
        )}
        {pendingBackup && (
          <ConfirmDialog
            title="Восстановить коллекцию?"
            description={`В файле ${pendingBackup.count} историй. Текущая коллекция будет заменена данными из файла.`}
            confirmLabel="Восстановить"
            onClose={() => setPendingBackup(null)}
            onConfirm={() => {
              try {
                useLibraryStore.getState().importCollection(pendingBackup.json)
                setPendingBackup(null)
                setSelected(null)
                navigate('/library')
                notify('Коллекция восстановлена')
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Ошибка восстановления', true)
              }
            }}
          />
        )}
        {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
        {preferencesOpen && <PreferencesDialog onClose={() => setPreferencesOpen(false)} />}
        <AnimatePresence>
          {toast && (
            <motion.div
              className={`toast ${toast.error ? 'is-error' : ''}`}
              role={toast.error ? 'alert' : 'status'}
              key={toast.id}
              initial={{ opacity: 0, y: 18, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0 }}
            >
              <Check size={18} />
              <span>{toast.message}</span>
              <button aria-label="Закрыть уведомление" onClick={() => setToast(null)}>
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
