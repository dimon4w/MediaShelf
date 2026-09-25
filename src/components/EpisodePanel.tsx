import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, MessageSquare, Plus, RotateCw } from 'lucide-react'
import type { EpisodeCatalog, LibraryEntry, MediaItem } from '../lib/types'
import { episodeCatalogSchema } from '../lib/library'
import { useLibraryStore } from '../store/useLibraryStore'
import ChoiceMenu from './ChoiceMenu'

export default function EpisodePanel({ item, entry }: { item: MediaItem; entry?: LibraryEntry }) {
  const [data, setData] = useState<EpisodeCatalog | undefined>(entry?.episodeCatalog)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [season, setSeason] = useState(() => {
    try {
      return sessionStorage.getItem(`mediashelf-season-${item.id}`) ?? ''
    } catch {
      return ''
    }
  })
  const [review, setReview] = useState<string | null>(null)
  const [visible, setVisible] = useState(50)
  const [manual, setManual] = useState(false)
  const itemRef = useRef(item)
  itemRef.current = item
  const source = useRef(entry?.episodeCatalog?.source)
  const saveCatalog = useLibraryStore((s) => s.setEpisodeCatalog)
  const update = useLibraryStore((s) => s.updateEpisode)
  const migrate = useLibraryStore((s) => s.assignLegacyEpisodes)
  const storageError = useLibraryStore((s) => s.storageError)
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    Promise.resolve().then(async () => {
      if (!current) return
      setLoading(true)
      setError('')
      try {
        const response = await fetch(
          `/api/episodes?${new URLSearchParams({ source: source.current ?? '' })}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([itemRef.current]),
            signal: controller.signal,
          },
        )
        if (!response.ok) throw new Error('Не удалось загрузить эпизоды. Попробуй ещё раз.')
        const result = episodeCatalogSchema.parse(await response.json())
        if (current && result.episodes.length) {
          setData(result)
          source.current = result.source
        }
      } catch (cause) {
        if (current)
          setError(
            cause instanceof Error && cause.message.startsWith('Не удалось')
              ? cause.message
              : 'Не удалось получить список эпизодов. Сохранённые записи доступны ниже.',
          )
      } finally {
        if (current) setLoading(false)
      }
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [item.id, retry])
  const hasEntry = !!entry
  useEffect(() => {
    if (data && hasEntry && data.episodes.length) {
      try {
        saveCatalog(item.id, data)
      } catch {
        queueMicrotask(() =>
          setError('Не удалось обновить список. Сохранённые записи оставлены без изменений.'),
        )
      }
    }
  }, [data, hasEntry, item.id, saveCatalog])
  const catalog = entry?.episodeCatalog ?? data
  const seasons = [...new Set(catalog?.episodes.map((e) => e.season) ?? [])].sort(
    (a, b) => (a === 0 ? Infinity : a) - (b === 0 ? Infinity : b),
  )
  const nextEpisode = catalog?.episodes.find(
    (e) => e.season > 0 && !entry?.episodeStates?.[e.key]?.watched,
  )
  const activeSeason =
    seasons.includes(Number(season)) && season
      ? Number(season)
      : (nextEpisode?.season ?? seasons[0])
  function selectSeason(value: string) {
    setSeason(value)
    setReview(null)
    setVisible(50)
    try {
      sessionStorage.setItem(`mediashelf-season-${item.id}`, value)
    } catch {
      /* Optional navigation memory. */
    }
  }
  const episodes = catalog?.episodes.filter((e) => e.season === activeSeason) ?? []
  function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!entry) return
    const fields = new FormData(event.currentTarget),
      s = Number(fields.get('season')),
      number = Number(fields.get('number')),
      title = String(fields.get('title') ?? '').trim()
    const key = `${s}:${number}`
    if (!title) {
      setError('Укажи название эпизода.')
      return
    }
    if (catalog?.episodes.some((e) => e.key === key)) {
      setError('Эпизод с таким номером уже есть в этом сезоне.')
      return
    }
    const next: EpisodeCatalog = {
      source: catalog?.source ?? 'manual',
      complete: false,
      episodes: [
        ...(catalog?.episodes ?? []),
        { key, season: s, number, title, manual: true },
      ].sort((a, b) => a.season - b.season || a.number - b.number),
    }
    try {
      saveCatalog(item.id, next)
      setData(next)
      selectSeason(String(s))
      setManual(false)
      setError('')
    } catch {
      setError('Проверь сезон, номер и название эпизода.')
    }
  }
  return (
    <section className="episode-panel" aria-label="Сезоны и эпизоды" aria-busy={loading}>
      <div className="episode-heading">
        <h3>Сезоны и эпизоды</h3>
        {seasons.length > 0 && (
          <ChoiceMenu
            label="Сезон"
            value={String(activeSeason)}
            options={seasons.map((s) => ({
              value: String(s),
              label: s === 0 ? 'Спецвыпуски' : `Сезон ${s}`,
            }))}
            onChange={selectSeason}
          />
        )}
      </div>
      {!entry && (
        <p className="field-help">
          Добавь произведение на полку, чтобы сохранять просмотр и отзывы.
        </p>
      )}
      {!!entry?.legacyEpisodeProgress && (
        <div className="legacy-progress">
          <p>
            В прежней записи: {entry.legacyEpisodeProgress} эпизодов без привязки к сезону. Этот
            прогресс сохранён.
          </p>
          <button
            className="text-button"
            disabled={!episodes.length}
            onClick={() => migrate(item.id)}
          >
            Распределить по первым эпизодам
          </button>
        </div>
      )}
      {loading && (
        <div className="inline-status" role="status">
          <RotateCw size={16} className="spin" />
          Загружаем список эпизодов…
        </div>
      )}
      {error && (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button className="text-button" onClick={() => setRetry((v) => v + 1)}>
            Повторить
          </button>
        </div>
      )}
      {!loading && !error && !episodes.length && (
        <div className="episode-empty">
          <p>У источника пока нет списка эпизодов.</p>
          <span>Сохранённый прогресс и заметки остаются на полке.</span>
        </div>
      )}
      {episodes.length > 0 && (
        <ol className="episode-list">
          {episodes.slice(0, visible).map((episode) => {
            const record = entry?.episodeStates?.[episode.key]
            return (
              <li key={episode.key} className={record?.watched ? 'is-watched' : ''}>
                <div className="episode-row">
                  <span className="episode-number">{String(episode.number).padStart(2, '0')}</span>
                  <span className="episode-name" title={episode.title}>
                    {episode.title || 'Название не указано'}
                    {episode.airdate && Number.isFinite(Date.parse(episode.airdate)) && (
                      <small>
                        {new Intl.DateTimeFormat('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        }).format(new Date(episode.airdate))}
                      </small>
                    )}
                  </span>
                  <button
                    className="episode-watched"
                    disabled={!entry}
                    aria-pressed={!!record?.watched}
                    aria-label={`Просмотрено: сезон ${episode.season}, эпизод ${episode.number}`}
                    onClick={() => update(item.id, episode.key, { watched: !record?.watched })}
                  >
                    <span className="check-box">{record?.watched && <Check size={14} />}</span>
                    <span>{record?.watched ? 'Просмотрено' : 'Не смотрел'}</span>
                  </button>
                  <button
                    className="episode-review-button"
                    disabled={!entry}
                    aria-expanded={review === episode.key}
                    aria-controls={`review-${episode.key}`}
                    aria-label={`Отзыв: сезон ${episode.season}, эпизод ${episode.number}`}
                    onClick={() => setReview(review === episode.key ? null : episode.key)}
                  >
                    <MessageSquare size={16} />
                    <span>{record?.review ? 'Мой отзыв' : 'Отзыв'}</span>
                  </button>
                </div>
                {review === episode.key && (
                  <div className="episode-review" id={`review-${episode.key}`}>
                    <label htmlFor={`review-input-${episode.key}`}>
                      Отзыв об эпизоде {episode.number}
                    </label>
                    <textarea
                      id={`review-input-${episode.key}`}
                      value={record?.review ?? ''}
                      maxLength={2000}
                      rows={3}
                      placeholder="Что запомнилось в этой серии?"
                      onChange={(e) => update(item.id, episode.key, { review: e.target.value })}
                    />
                    <div>
                      <span>
                        {storageError ? 'Не сохранено в браузере' : 'Сохраняется автоматически'}
                      </span>
                      <span>{record?.review.length ?? 0} / 2000</span>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {episodes.length > visible && (
        <button className="text-button" onClick={() => setVisible((v) => v + 50)}>
          Ещё эпизоды
        </button>
      )}
      {entry && (
        <button
          className="text-button episode-add"
          onClick={() => setManual(!manual)}
          aria-expanded={manual}
        >
          <Plus size={15} />
          Добавить эпизод вручную
        </button>
      )}
      {manual && (
        <form className="episode-manual-form" onSubmit={addManual}>
          <label>
            Сезон
            <input
              name="season"
              type="number"
              min={0}
              max={200}
              defaultValue={activeSeason ?? 1}
              required
            />
          </label>
          <label>
            Номер
            <input
              name="number"
              type="number"
              min={1}
              max={50000}
              defaultValue={Math.max(0, ...episodes.map((e) => e.number)) + 1}
              required
            />
          </label>
          <label>
            Название
            <input name="title" maxLength={300} required />
          </label>
          <button className="button button-subtle" type="submit">
            Добавить эпизод
          </button>
        </form>
      )}
    </section>
  )
}
