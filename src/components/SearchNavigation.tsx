import { useEffect, useRef, useState, type RefObject } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { mediaMeta } from '../lib/presentation'
import type { MediaFilter, MediaItem } from '../lib/types'
import Poster from './Poster'
import { CardPrice } from './PublicMetadata'
import ChoiceMenu from './ChoiceMenu'

export default function SearchNavigation({
  type,
  onType,
  query,
  onQuery,
  items,
  recent,
  onOpen,
  onSearch,
  onGenre,
  loading,
  inputRef,
}: {
  type: MediaFilter
  onType: (type: MediaFilter) => void
  query: string
  onQuery: (query: string) => void
  items: MediaItem[]
  recent: MediaItem[]
  onOpen: (item: MediaItem) => void
  onSearch: () => void
  onGenre: (genre: string) => void
  loading: boolean
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const suggestions = items.slice(0, 5)
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  return (
    <div
      className="store-navigation"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false)
        }
      }}
    >
      <div className="store-navigation-inner">
        <div className="category-dropdown">
          <ChoiceMenu
            label="Категории"
            value={type}
            options={(['all', ...Object.keys(mediaMeta)] as MediaFilter[]).map((value) => ({
              value,
              label: value === 'all' ? 'Все категории' : mediaMeta[value].label,
            }))}
            onChange={onType}
          />
        </div>
        <div className="quick-genres">
          {(type === 'game'
            ? ['Ролевые игры', 'Экшен', 'Приключения']
            : ['Драма', 'Фантастика', 'Ужасы']
          ).map((genre) => (
            <button key={genre} onClick={() => onGenre(genre)}>
              {genre}
            </button>
          ))}
        </div>
        <div
          className="global-search"
          role="search"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
          }}
        >
          <div className="search-input-wrap">
            <input
              ref={inputRef}
              aria-label="Поиск по названию или жанру"
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? 'search-suggestions' : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                open && active >= 0 && active < suggestions.length
                  ? `suggestion-${active}`
                  : undefined
              }
              value={query}
              maxLength={120}
              placeholder="Найти игру, фильм, историю…"
              autoComplete="off"
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                onQuery(e.target.value)
                setOpen(true)
                setActive(-1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setOpen(true)
                  setActive((v) => Math.min(suggestions.length - 1, v + 1))
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((v) => Math.max(-1, v - 1))
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (active >= 0 && suggestions[active]) onOpen(suggestions[active])
                  else onSearch()
                  setOpen(false)
                }
              }}
            />
            {query && (
              <button
                aria-label="Очистить поиск"
                className="search-clear"
                onClick={() => {
                  onQuery('')
                  inputRef.current?.focus()
                }}
              >
                <X size={15} />
              </button>
            )}
            <button
              className="search-submit"
              aria-label="Найти"
              onClick={() => {
                setOpen(false)
                onSearch()
              }}
            >
              <Search size={19} />
            </button>
          </div>
          {open && (
            <div className="search-popover">
              <div className="search-popover-heading">
                {query ? 'Найденные истории' : 'Популярное для тебя'}
                {loading && <small>Ищем…</small>}
              </div>
              <div id="search-suggestions" role="listbox" aria-label="Подсказки поиска">
                {suggestions.map((item, index) => (
                  <button
                    key={item.id}
                    id={`suggestion-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className="search-result"
                    onPointerMove={() => setActive(index)}
                    onClick={() => {
                      onOpen(item)
                      setOpen(false)
                    }}
                  >
                    <Poster item={item} wide eager />
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {mediaMeta[item.type].singular} · {item.year ?? 'Без даты'}
                      </small>
                      {item.type === 'game' && <CardPrice item={item} interactive={false} />}
                    </span>
                  </button>
                ))}
              </div>
              {!suggestions.length && !loading && (
                <p className="search-empty">Пока ничего не найдено</p>
              )}
              {!query && recent.length > 0 && (
                <div className="recent-search">
                  <span>Недавно просмотренное</span>
                  <div>
                    {recent.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onOpen(item)
                          setOpen(false)
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!query && (
                <div className="search-genre-chips">
                  {['Драма', 'Приключения', 'Ужасы'].map((genre) => (
                    <button
                      key={genre}
                      onClick={() => {
                        onGenre(genre)
                        setOpen(false)
                      }}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="advanced-search"
                onClick={() => {
                  onSearch()
                  setOpen(false)
                }}
              >
                <SlidersHorizontal size={15} />
                Расширенный поиск
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
