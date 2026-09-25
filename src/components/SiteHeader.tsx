import type { RefObject } from 'react'
import { Link, NavLink } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Check,
  Download,
  Info,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  Upload,
} from 'lucide-react'
import { navigation, type CollectionActions } from '../lib/navigation'

export default function SiteHeader({
  headerRef,
  hidden,
  libraryCount,
  onAdd,
  onExport,
  onImport,
  onPreferences,
  onAbout,
  calmMode,
  onCalmMode,
}: CollectionActions & {
  headerRef: RefObject<HTMLElement | null>
  hidden: boolean
  libraryCount: number
  onAdd: () => void
}) {
  return (
    <header className="site-header" ref={headerRef} inert={hidden}>
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="MediaShelf, главная" data-focus-fallback>
          <span className="brand-symbol" aria-hidden="true" />
          <span>
            media<span className="brand-slash">/</span>shelf
          </span>
        </Link>
        <nav className="primary-nav" aria-label="Основная навигация">
          {navigation.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
            >
              {label}
              {path === '/library' && libraryCount > 0 && (
                <span className="nav-count">{libraryCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="button header-add"
            onClick={onAdd}
            aria-label="Добавить своё произведение"
          >
            <Plus size={16} />
            <span>Добавить</span>
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="icon-button" aria-label="Управление коллекцией">
                <MoreHorizontal size={21} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="dropdown-content settings-menu"
                align="end"
                sideOffset={12}
                collisionPadding={12}
              >
                <DropdownMenu.Label className="dropdown-label">Твоя коллекция</DropdownMenu.Label>
                <DropdownMenu.Item className="dropdown-item" onSelect={onExport}>
                  <Download size={15} />
                  Скачать резервную копию
                </DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onSelect={onImport}>
                  <Upload size={15} />
                  Восстановить из файла
                </DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onSelect={onPreferences}>
                  <Settings2 size={15} />
                  Платформы и регион цен
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="dropdown-separator" />
                <DropdownMenu.CheckboxItem
                  className="dropdown-item"
                  checked={calmMode}
                  onCheckedChange={onCalmMode}
                >
                  <Sparkles size={15} />
                  Меньше анимаций
                  <DropdownMenu.ItemIndicator>
                    <Check size={14} />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.Item className="dropdown-item" onSelect={onAbout}>
                  <Info size={15} />О MediaShelf
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  )
}
