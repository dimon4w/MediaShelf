import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowUpRight,
  Check,
  Clock3,
  Heart,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import {
  durationLabel,
  mediaMeta,
  plural,
  statusLabel,
  statusMeta,
  sourceLabels,
  availableStatuses,
} from '../lib/presentation'
import type { LibraryEntry, MediaItem, MediaType } from '../lib/types'
import { useLibraryStore } from '../store/useLibraryStore'
import Poster from './Poster'
import PlaythroughEditor from './PlaythroughEditor'
import { PublicRatings, StoreOffers } from './PublicMetadata'
import EpisodePanel from './EpisodePanel'

export function ModalFrame({
  children,
  onClose,
  className = '',
  title = 'MediaShelf',
}: {
  children: ReactNode
  onClose: () => void
  className?: string
  title?: string
}) {
  const returnFocus = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          asChild
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const target = returnFocus.current
            if (target?.isConnected) target.focus()
            else document.querySelector<HTMLButtonElement>('[data-focus-fallback]')?.focus()
          }}
        >
          <motion.section
            className="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
          >
            <div className="modal-bar">
              <span title={title}>{title}</span>
              <Dialog.Close asChild>
                <button className="icon-button modal-close" aria-label="Закрыть">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            <div className={`modal-scroll ${className}`}>{children}</div>
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function DetailDialog({
  item,
  entry,
  onClose,
  onRemove,
  notify,
}: {
  item: MediaItem
  entry?: LibraryEntry
  onClose: () => void
  onRemove: (item: MediaItem) => void
  notify: (message: string, error?: boolean) => void
}) {
  const add = useLibraryStore((state) => state.addItem)
  const update = useLibraryStore((state) => state.updateEntry)
  const favorite = useLibraryStore((state) => state.toggleFavorite)
  const storageError = useLibraryStore((state) => state.storageError)
  const meta = mediaMeta[item.type]
  const Icon = meta.icon
  const information = (
    <>
      <PublicRatings item={item} />
      <Dialog.Description className="detail-description">
        {item.description ||
          'У этой истории пока нет описания. Но у неё уже есть место на твоей полке.'}
      </Dialog.Description>
      <StoreOffers item={item} />
      {item.source && item.sourceUrl && (
        <details className="source-disclosure">
          <summary>Источник данных</summary>
          <a className="detail-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
            Данные из {sourceLabels[item.source]}
            <ArrowUpRight size={13} />
          </a>
        </details>
      )}
    </>
  )
  return (
    <ModalFrame className="detail-modal" title={item.title} onClose={onClose}>
      <div className="detail-poster-side">
        <Poster item={item} eager />
      </div>
      <div className="detail-body">
        <span className="detail-type" style={{ color: meta.color }}>
          <Icon size={15} />
          {meta.singular}
          <span> / </span>
          {item.year ?? 'Год не указан'}
        </span>
        <Dialog.Title className="detail-title">{item.title}</Dialog.Title>
        {item.originalTitle !== item.title && (
          <p className="detail-original">{item.originalTitle}</p>
        )}
        <div className="detail-tags">
          {item.genres.map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
          {item.duration && (
            <span>
              <Clock3 size={12} />
              {durationLabel(item.duration)}
            </span>
          )}
          {item.episodes && (
            <span>
              {item.episodes} {plural(item.episodes, ['эпизод', 'эпизода', 'эпизодов'])}
            </span>
          )}
          {(item.type === 'series' || item.type === 'anime') && (
            <span>
              {item.seasons
                ? `${item.seasons} ${plural(item.seasons, ['сезон', 'сезона', 'сезонов'])}`
                : 'Сезоны: нет данных'}
            </span>
          )}
        </div>
        {!entry && information}
        <div className="detail-main-actions">
          {!entry ? (
            <button
              className="button button-primary"
              onClick={() => {
                try {
                  add(item)
                  notify('Добавлено на твою полку')
                } catch (cause) {
                  notify(
                    cause instanceof Error ? cause.message : 'Не удалось сохранить историю.',
                    true,
                  )
                }
              }}
            >
              <Plus size={17} />
              Добавить на полку
            </button>
          ) : (
            <span className="on-shelf-label">
              <Check size={16} />
              На твоей полке
            </span>
          )}
          <button
            className={`button button-subtle favorite-detail ${entry?.favorite ? 'is-favorite' : ''}`}
            onClick={() => {
              try {
                favorite(item)
                notify(entry?.favorite ? 'Убрано из избранного' : 'Добавлено в любимые истории')
              } catch (cause) {
                notify(
                  cause instanceof Error ? cause.message : 'Не удалось сохранить историю.',
                  true,
                )
              }
            }}
            aria-pressed={!!entry?.favorite}
          >
            <Heart size={16} fill={entry?.favorite ? 'currentColor' : 'none'} />
            {entry?.favorite ? 'В любимых' : 'В любимые'}
          </button>
          {entry && (
            <button
              className="icon-button delete-detail"
              aria-label="Убрать произведение с полки"
              title="Убрать с полки"
              onClick={() => onRemove(item)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
        {(item.type === 'series' || item.type === 'anime') && (
          <EpisodePanel item={item} entry={entry} />
        )}
        <fieldset className="detail-edit-section" disabled={!entry}>
          <legend className={item.type === 'game' ? 'sr-only' : 'field-heading'}>
            Твоя история с этим произведением
          </legend>
          {!entry && (
            <p className="field-help">
              Добавь на полку, чтобы отмечать прогресс и оставлять заметки.
            </p>
          )}
          {item.type === 'game' ? (
            entry && <PlaythroughEditor item={item} entry={entry} />
          ) : (
            <>
              <div className="status-segment" role="group" aria-label="Статус произведения">
                {availableStatuses(item.type).map((status) => (
                  <button
                    key={status}
                    aria-pressed={entry?.status === status}
                    className={entry?.status === status ? 'is-selected' : ''}
                    onClick={() => update(item.id, { status })}
                  >
                    <span className="status-dot" style={{ background: statusMeta[status].color }} />
                    {statusLabel(item.type, status)}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="field-row rating-heading">
            <span>Твоя оценка</span>
            <span>{entry?.rating ? `${entry.rating} / 10` : 'Пока без оценки'}</span>
          </div>
          <div className="rating-scale" role="group" aria-label="Твоя оценка">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
              <button
                key={score}
                aria-label={`Оценка ${score} из 10`}
                aria-pressed={entry?.rating === score}
                className={entry?.rating === score ? 'is-selected' : ''}
                onClick={() => update(item.id, { rating: entry?.rating === score ? null : score })}
              >
                {score === 10 ? (
                  <span>
                    10
                    <Star size={9} />
                  </span>
                ) : (
                  score
                )}
              </button>
            ))}
          </div>
          <label className="notes-label" htmlFor="detail-notes">
            Заметка для себя
            <span>
              {storageError ? 'Пока только на этой странице' : 'Сохраняется автоматически'}
            </span>
          </label>
          <textarea
            id="detail-notes"
            maxLength={4000}
            rows={3}
            placeholder="Что зацепило? На каком моменте остановился?"
            value={entry?.notes ?? ''}
            onChange={(event) => update(item.id, { notes: event.target.value })}
          />
        </fieldset>
        {entry && (
          <details className="detail-information">
            <summary>Описание, оценки и магазины</summary>
            {information}
          </details>
        )}
        <button className="button button-subtle detail-done" onClick={onClose}>
          Готово
        </button>
      </div>
    </ModalFrame>
  )
}

export function AddDialog({
  defaultType,
  onClose,
  onCreated,
}: {
  defaultType: MediaType
  onClose: () => void
  onCreated: (item: MediaItem) => void
}) {
  const [type, setType] = useState<MediaType>(defaultType)
  const [error, setError] = useState('')
  const addCustom = useLibraryStore((state) => state.addCustomItem)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (key: string) => String(data.get(key) ?? '').trim()
    const item: MediaItem = {
      id: `custom-${crypto.randomUUID()}`,
      type,
      title: text('title'),
      originalTitle: text('originalTitle') || text('title'),
      year: Number(data.get('year')),
      genres: text('genres')
        ? text('genres')
            .split(',')
            .map((genre) => genre.trim())
            .filter(Boolean)
        : ['Моя подборка'],
      description: text('description'),
      poster: text('poster'),
      accent: mediaMeta[type].color,
      ...(type === 'series' || type === 'anime' ? { episodes: Number(data.get('episodes')) } : {}),
      ...(type === 'movie' && text('duration') ? { duration: Number(data.get('duration')) } : {}),
    }
    try {
      addCustom(item)
      onCreated(item)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось добавить произведение.')
    }
  }
  return (
    <ModalFrame className="form-modal" title="Добавить своё" onClose={onClose}>
      <Dialog.Title className="modal-title">Добавить своё</Dialog.Title>
      <Dialog.Description className="modal-description">
        Не всё любимое есть в подборке. Здесь можно добавить что угодно.
      </Dialog.Description>
      <form onSubmit={submit} className="add-form">
        <div className="form-grid">
          <label>
            Категория
            <select
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as MediaType)}
            >
              {(Object.keys(mediaMeta) as MediaType[]).map((key) => (
                <option key={key} value={key}>
                  {mediaMeta[key].singular}
                </option>
              ))}
            </select>
          </label>
          <label>
            Год выхода
            <input
              name="year"
              type="number"
              min="1900"
              max="2100"
              defaultValue={new Date().getFullYear()}
              required
            />
          </label>
        </div>
        <label>
          Название
          <input
            name="title"
            placeholder="Название твоей следующей истории"
            maxLength={160}
            required
          />
        </label>
        <label>
          Оригинальное название <span className="optional-label">необязательно</span>
          <input
            name="originalTitle"
            maxLength={160}
            placeholder="Если отличается от названия выше"
          />
        </label>
        <div className="form-grid">
          <label>
            Жанры
            <input name="genres" placeholder="Драма, приключения" maxLength={250} />
          </label>
          {type === 'series' || type === 'anime' ? (
            <label>
              Количество эпизодов
              <input name="episodes" type="number" min="1" max="50000" defaultValue={12} required />
            </label>
          ) : type === 'movie' ? (
            <label>
              Длительность, мин
              <input name="duration" type="number" min="1" max="2000" placeholder="120" />
            </label>
          ) : (
            <div className="form-aside">Прогресс игры можно отмечать в процентах.</div>
          )}
        </div>
        <label>
          Ссылка на обложку <span className="optional-label">необязательно</span>
          <input name="poster" type="url" maxLength={2000} placeholder="https://…" />
          <span className="field-help">Без ссылки создадим типографическую обложку.</span>
        </label>
        <label>
          Пара слов об истории
          <textarea
            name="description"
            rows={3}
            maxLength={4000}
            placeholder="О чём она и почему стоит внимания?"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button button-subtle" onClick={onClose}>
            Отмена
          </button>
          <button className="button button-primary" type="submit">
            <Plus size={17} />
            Добавить на полку
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  danger = false,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
}) {
  return (
    <ModalFrame className="confirm-modal" onClose={onClose}>
      <span className={`confirm-icon ${danger ? 'is-danger' : ''}`}>
        {danger ? <Trash2 size={23} /> : <ShieldCheck size={25} />}
      </span>
      <Dialog.Title className="modal-title">{title}</Dialog.Title>
      <Dialog.Description className="modal-description">{description}</Dialog.Description>
      <div className="modal-actions">
        <button className="button button-subtle" onClick={onClose}>
          Отмена
        </button>
        <button
          className={`button ${danger ? 'button-danger' : 'button-primary'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalFrame>
  )
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <ModalFrame className="about-modal" onClose={onClose}>
      <div className="about-brand">
        <span className="brand-symbol" />
        media<span>/</span>shelf
      </div>
      <Dialog.Title className="modal-title">
        Маленькое место
        <br />
        для больших историй.
      </Dialog.Title>
      <Dialog.Description className="modal-description">
        Личная коллекция игр, фильмов, сериалов и аниме. Твои прохождения, оценки и впечатления в
        одном месте.
      </Dialog.Description>
      <div className="about-note">
        <ShieldCheck size={23} />
        <div>
          <strong>Твоя коллекция остаётся у тебя</strong>
          <p>
            Оценки и заметки хранятся в этом браузере. Для переноса на другое устройство скачай
            резервную копию. Очистка данных сайта удалит локальную коллекцию.
          </p>
        </div>
      </div>
      <div className="about-copy">
        <h3>Обложки и подборка</h3>
        <p>
          Онлайн-каталог объединяет Steam, GOG, IMDb, Cinemeta, TVmaze и Shikimori. Найденную
          историю можно сохранить на полку вместе с её данными. Оценки и заметки в эти сервисы не
          отправляются.
        </p>
        <p>
          Стартовые обложки хранятся вместе с приложением и принадлежат их правообладателям.
          Собственные обложки по ссылке могут требовать интернет. Если изображение недоступно,
          появится авторская типографическая обложка.
        </p>
        <div className="source-links">
          <a href="https://store.steampowered.com/" target="_blank" rel="noreferrer">
            Steam
            <ArrowUpRight size={13} />
          </a>
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            TMDB
            <ArrowUpRight size={13} />
          </a>
          <a href="https://www.tvmaze.com/" target="_blank" rel="noreferrer">
            TVmaze
            <ArrowUpRight size={13} />
          </a>
          <a href="https://myanimelist.net/" target="_blank" rel="noreferrer">
            MyAnimeList
            <ArrowUpRight size={13} />
          </a>
          <a href="https://www.imdb.com/" target="_blank" rel="noreferrer">
            IMDb
            <ArrowUpRight size={13} />
          </a>
          <a href="https://shikimori.one/" target="_blank" rel="noreferrer">
            Shikimori
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </ModalFrame>
  )
}
