import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, Check, RotateCw, Shuffle } from 'lucide-react'
import { motion } from 'motion/react'
import { ModalFrame } from './Dialogs'
import { countries, defaultPreferences, platforms, stores } from '../lib/platforms'
import { mediaMeta } from '../lib/presentation'
import { useLibraryStore } from '../store/useLibraryStore'
import type { MediaItem, MediaType, StoreId } from '../lib/types'
import Poster from './Poster'
import StoreIcon, { PlatformIcon } from './StoreIcon'
import PreviewPoster from './PreviewPoster'

export function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const preferences = useLibraryStore((s) => s.preferences ?? defaultPreferences)
  const save = useLibraryStore((s) => s.setPreferences)
  const [draft, setDraft] = useState(preferences)
  const close = () => {
    if (!preferences.onboarded) save({ ...preferences, onboarded: true })
    onClose()
  }
  return (
    <ModalFrame className="form-modal preferences-modal" title="Платформы и регион" onClose={close}>
      <Dialog.Title className="modal-title">На чём играешь?</Dialog.Title>
      <Dialog.Description className="modal-description">
        Выбери свои системы и магазины. Можно несколько — и всегда можно изменить позже.
      </Dialog.Description>
      <fieldset className="preference-options">
        <legend>Мои платформы</legend>
        {platforms.map((platform) => (
          <label key={platform}>
            <input
              type="checkbox"
              checked={draft.platforms.includes(platform)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  platforms: e.target.checked
                    ? [...draft.platforms, platform]
                    : draft.platforms.filter((v) => v !== platform),
                })
              }
            />
            <PlatformIcon platform={platform} />
            {platform}
          </label>
        ))}
      </fieldset>
      <fieldset className="preference-options">
        <legend>Мои магазины</legend>
        {Object.entries(stores).map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={draft.stores.includes(id as StoreId)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  stores: e.target.checked
                    ? [...draft.stores, id as StoreId]
                    : draft.stores.filter((v) => v !== id),
                })
              }
            />
            <StoreIcon store={id as StoreId} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="region-select">
        Регион магазина
        <select
          value={draft.country}
          onChange={(e) => setDraft({ ...draft, country: e.target.value })}
        >
          {Object.entries(countries).map(([id, value]) => (
            <option key={id} value={id}>
              {value.label} · {value.currency}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">
        Цены приходят для выбранного региона. Наличие платформы в профиле не означает, что игра уже
        куплена.
      </p>
      <div className="modal-actions">
        <button className="button button-ghost" onClick={close}>
          {preferences.onboarded ? 'Отмена' : 'Позже'}
        </button>
        <button
          className="button button-primary"
          onClick={() => {
            save({ ...draft, onboarded: true })
            onClose()
          }}
        >
          <Check size={16} />
          Сохранить
        </button>
      </div>
    </ModalFrame>
  )
}

export function RoulettePanel({
  items,
  libraryIds,
  onOpen,
  onAdd,
  reducedMotion,
}: {
  items: MediaItem[]
  libraryIds: string[]
  onOpen: (item: MediaItem) => void
  onAdd: (item: MediaItem) => void
  reducedMotion: boolean
}) {
  const [source, setSource] = useState<'library' | 'catalog'>(
    libraryIds.length ? 'library' : 'catalog',
  )
  const [types, setTypes] = useState<MediaType[]>(['game', 'movie', 'series', 'anime'])
  const [spin, setSpin] = useState<{ id: number; sequence: MediaItem[]; winner: MediaItem } | null>(
    null,
  )
  const [rolling, setRolling] = useState(false)
  const pool = items.filter(
    (i) => types.includes(i.type) && (source === 'catalog' || libraryIds.includes(i.id)),
  )
  function roll() {
    if (rolling || !pool.length) return
    const winner = pool[Math.floor(Math.random() * pool.length)]
    const sequence = reducedMotion
      ? [winner]
      : Array.from({ length: 23 }, (_, i) =>
          i === 20 ? winner : pool[Math.floor(Math.random() * pool.length)],
        )
    setSpin({ id: (spin?.id ?? 0) + 1, sequence, winner })
    setRolling(!reducedMotion)
  }
  return (
    <section className="roulette-modal roulette-page" aria-label="Что сегодня?">
      <h1 className="modal-title">Что сегодня?</h1>
      <p className="modal-description">Один поворот — и у вечера появляется история.</p>
      <fieldset disabled={rolling} className="roulette-controls">
        <legend className="sr-only">Настройки рекомендации</legend>
        <div className="segmented">
          <button
            aria-pressed={source === 'library'}
            onClick={() => {
              setSource('library')
              setSpin(null)
            }}
          >
            Моя библиотека
          </button>
          <button
            aria-pressed={source === 'catalog'}
            onClick={() => {
              setSource('catalog')
              setSpin(null)
            }}
          >
            Каталог
          </button>
        </div>
        <div className="roulette-types">
          {(Object.keys(mediaMeta) as MediaType[]).map((type) => (
            <label key={type}>
              <input
                type="checkbox"
                checked={types.includes(type)}
                onChange={(e) => {
                  setTypes(e.target.checked ? [...types, type] : types.filter((v) => v !== type))
                  setSpin(null)
                }}
              />
              {mediaMeta[type].label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="roulette-window" aria-label="Выбор произведения">
        <span className="roulette-marker" />
        {spin ? (
          <motion.div
            className="roulette-track"
            key={spin.id}
            initial={{ x: 0 }}
            animate={{ x: reducedMotion ? 0 : -20 * 164 }}
            transition={{ duration: reducedMotion ? 0 : 3.8, ease: [0.12, 0.76, 0.14, 1] }}
            onAnimationComplete={() => setRolling(false)}
          >
            {spin.sequence.map((item, index) => (
              <div
                className={`roulette-ticket ${!rolling && index === (reducedMotion ? 0 : 20) ? 'is-result' : ''}`}
                key={index}
                aria-hidden={rolling || index !== (reducedMotion ? 0 : 20)}
              >
                {!rolling && index === (reducedMotion ? 0 : 20) ? (
                  <div className="roulette-winning-poster">
                    <PreviewPoster item={item} eager onOpen={() => onOpen(item)} />
                  </div>
                ) : (
                  <Poster item={item} eager={rolling} />
                )}
                <strong>{item.title}</strong>
              </div>
            ))}
          </motion.div>
        ) : (
          <div className="roulette-idle">
            <Shuffle size={36} />
            <span>Твоя следующая любимая история?</span>
          </div>
        )}
      </div>
      <div className="roulette-result" aria-live="polite">
        {rolling ? (
          <p>Пусть случай решит…</p>
        ) : spin ? (
          <>
            <small>
              {mediaMeta[spin.winner.type].singular} · {spin.winner.year ?? 'Без даты'}
            </small>
            <h3>{spin.winner.title}</h3>
            <div className="modal-actions">
              <button className="button button-primary" onClick={() => onOpen(spin.winner)}>
                Открыть
                <ArrowRight size={16} />
              </button>
              {!libraryIds.includes(spin.winner.id) && (
                <button className="button button-subtle" onClick={() => onAdd(spin.winner)}>
                  На полку
                </button>
              )}
            </div>
          </>
        ) : (
          <p>
            {pool.length
              ? 'Выбери категории. Мы предложим одну историю.'
              : 'Нет подходящих произведений. Измени источник или категории.'}
          </p>
        )}
      </div>
      <button
        className={`button ${spin ? 'button-subtle' : 'button-primary'} roulette-spin`}
        disabled={rolling || !pool.length}
        onClick={roll}
      >
        <RotateCw size={17} className={rolling ? 'spin' : ''} />
        {rolling ? 'Выбираем…' : spin ? 'Крутить ещё' : 'Крутить'}
      </button>
      <p className="roulette-footnote">
        В каталоге участвуют загруженные произведения и редакционная подборка.
      </p>
    </section>
  )
}
