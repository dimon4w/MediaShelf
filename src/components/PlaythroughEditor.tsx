import { Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { LibraryEntry, LibraryStatus, MediaItem, Playthrough, StoreId } from '../lib/types'
import { platforms, playthroughLabel, stores } from '../lib/platforms'
import { statusLabel } from '../lib/presentation'
import { useLibraryStore } from '../store/useLibraryStore'

export default function PlaythroughEditor({
  item,
  entry,
}: {
  item: MediaItem
  entry: LibraryEntry
}) {
  const update = useLibraryStore((s) => s.updateEntry)
  const preferences = useLibraryStore((s) => s.preferences)
  const runs = entry.playthroughs ?? []
  const [removing, setRemoving] = useState<string | null>(null)
  const removeTrigger = useRef<HTMLButtonElement | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const change = (id: string, patch: Partial<Playthrough>) =>
    update(item.id, { playthroughs: runs.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  return (
    <section className="playthroughs" aria-label="Твои прохождения">
      <div className="field-row">
        <strong>Твои прохождения</strong>
        <span>{runs.length} / 10</span>
      </div>
      <p className="field-help">Каждая платформа — свой прогресс. Отметки не меняют проценты.</p>
      {runs.map((p) => (
        <div className="playthrough" key={p.id} role="group" aria-label={playthroughLabel(p)}>
          <div className="playthrough-selects">
            <label>
              Платформа
              <select
                aria-label={`Платформа: ${playthroughLabel(p)}`}
                value={p.platform}
                onChange={(e) => {
                  const platform = e.target.value
                  const store: StoreId | '' =
                    platform === 'PC'
                      ? ['steam', 'gog', 'epic'].includes(p.store)
                        ? p.store
                        : ''
                      : platform === 'Xbox'
                        ? 'xbox'
                        : platform.startsWith('PlayStation')
                          ? 'playstation'
                          : platform.startsWith('Nintendo')
                            ? 'nintendo'
                            : ''
                  change(p.id, { platform, store })
                }}
              >
                <option value="">Не выбрана</option>
                {platforms.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Магазин
              <select
                aria-label={`Магазин: ${playthroughLabel(p)}`}
                value={p.store}
                onChange={(e) => {
                  const store = e.target.value as StoreId | ''
                  const platform = ['steam', 'gog', 'epic'].includes(store)
                    ? 'PC'
                    : store === 'xbox'
                      ? 'Xbox'
                      : store === 'playstation'
                        ? p.platform.startsWith('PlayStation')
                          ? p.platform
                          : 'PlayStation 5'
                        : store === 'nintendo'
                          ? 'Nintendo Switch'
                          : p.platform
                  change(p.id, { store, platform })
                }}
              >
                <option value="">Не выбран</option>
                {Object.entries(stores).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              aria-label={`Удалить прохождение: ${playthroughLabel(p)}`}
              aria-expanded={removing === p.id}
              onClick={(event) => {
                removeTrigger.current = event.currentTarget
                setRemoving(p.id)
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
          {removing === p.id && (
            <div
              className="run-remove-confirm"
              role="group"
              aria-label="Подтверждение удаления прохождения"
            >
              <p>
                Удалить прохождение {playthroughLabel(p)} — {p.progress}%? Его прогресс и отметки
                будут удалены.
              </p>
              <div className="modal-actions">
                <button
                  className="button button-subtle"
                  autoFocus
                  onClick={() => {
                    setRemoving(null)
                    requestAnimationFrame(() => removeTrigger.current?.focus())
                  }}
                >
                  Отмена
                </button>
                <button
                  className="button button-danger"
                  onClick={() => {
                    update(item.id, { playthroughs: runs.filter((v) => v.id !== p.id) })
                    setRemoving(null)
                    requestAnimationFrame(() => addButton.current?.focus())
                  }}
                >
                  Удалить прохождение
                </button>
              </div>
            </div>
          )}
          <div
            className="status-segment"
            role="group"
            aria-label={`Статусы: ${playthroughLabel(p)}`}
          >
            {(['planned', 'active', 'completed'] as LibraryStatus[]).map((status) => (
              <button
                key={status}
                aria-pressed={p.statuses.includes(status)}
                className={p.statuses.includes(status) ? 'is-selected' : ''}
                onClick={() =>
                  change(p.id, {
                    statuses: p.statuses.includes(status)
                      ? p.statuses.filter((v) => v !== status)
                      : [...p.statuses, status],
                  })
                }
              >
                {statusLabel('game', status)}
              </button>
            ))}
          </div>
          <div className="run-progress">
            <label htmlFor={`progress-${p.id}`}>Прогресс прохождения</label>
            <output htmlFor={`progress-${p.id}`}>{p.progress}%</output>
            <input
              id={`progress-${p.id}`}
              type="range"
              min={0}
              max={100}
              value={p.progress}
              onChange={(e) => change(p.id, { progress: Number(e.target.value) })}
            />
          </div>
        </div>
      ))}
      <button
        className="button button-subtle add-playthrough"
        ref={addButton}
        disabled={runs.length >= 10}
        onClick={() =>
          update(item.id, {
            playthroughs: [
              ...runs,
              {
                id: crypto.randomUUID(),
                platform: preferences?.platforms[0] ?? '',
                store: '',
                progress: 0,
                statuses: ['planned'],
              },
            ],
          })
        }
      >
        <Plus size={15} />
        Добавить прохождение
      </button>
    </section>
  )
}
