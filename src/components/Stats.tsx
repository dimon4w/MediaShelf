import { ArrowUpRight, BookOpen, Heart, Sparkles, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { mediaMeta, plural } from '../lib/presentation'
import type { LibraryEntry, MediaItem, MediaType } from '../lib/types'
import Poster from './Poster'
import { entryStatuses } from '../lib/platforms'

export default function Stats({
  items,
  entries,
  onOpen,
  onDiscover,
  embedded = false,
}: {
  items: MediaItem[]
  entries: Record<string, LibraryEntry>
  onOpen: (item: MediaItem) => void
  onDiscover: () => void
  embedded?: boolean
}) {
  const library = items.filter((item) => entries[item.id])
  const allEntries = Object.values(entries)
  const completed = allEntries.filter((entry) => entryStatuses(entry).includes('completed')).length
  const favorites = library.filter((item) => entries[item.id].favorite)
  const rated = allEntries.filter((entry) => entry.rating !== null)
  const average = rated.length
    ? (rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length).toFixed(1)
    : null
  const genreCounts = new Map<string, number>()
  library.forEach((item) =>
    item.genres.forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)),
  )
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const recent = [...library]
    .sort((a, b) => entries[b.id].addedAt.localeCompare(entries[a.id].addedAt))
    .slice(0, 4)
  const percent = library.length ? Math.round((completed / library.length) * 100) : 0
  return (
    <section className="stats-view">
      {embedded ? (
        <h2 className="section-heading">Статистика</h2>
      ) : (
        <div className="page-intro">
          <h1>
            Ты состоишь
            <br />
            из <span>историй.</span>
          </h1>
          <p>
            Не соревнование и не список достижений.
            <br />
            Просто немного больше о том, что ты любишь.
          </p>
        </div>
      )}
      <div className="stats-numbers">
        {[
          { label: 'Историй на полке', value: library.length.toString(), icon: BookOpen },
          { label: 'Завершено', value: completed.toString(), icon: Sparkles },
          { label: 'Любимых', value: favorites.length.toString(), icon: Heart },
          { label: 'Средняя оценка', value: average ?? 'нет', icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <span className="stat-label">
              <Icon size={14} />
              {label}
            </span>
            <strong>
              {value}
              <span>{label === 'Средняя оценка' && average ? '/ 10' : ''}</span>
            </strong>
          </div>
        ))}
      </div>
      {!library.length ? (
        <div className="stats-empty">
          <span className="empty-orbit">
            <Sparkles size={27} />
          </span>
          <h2>Самое интересное впереди</h2>
          <p>
            Добавь первую историю. Здесь постепенно появится
            <br />
            твой личный портрет из любимых миров.
          </p>
          <button className="button button-primary" onClick={onDiscover}>
            Найти свою историю
            <ArrowUpRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="stats-panels">
            <section className="stats-genre-panel">
              <h2>Твои жанры</h2>
              <div className="genre-bars">
                {topGenres.map(([genre, count], index) => (
                  <div key={genre}>
                    <div className="genre-bar-label">
                      <span>{genre}</span>
                      <span>{count}</span>
                    </div>
                    <div className="genre-bar-track">
                      <motion.span
                        style={{ width: '100%', transformOrigin: 'left' }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: count / topGenres[0][1] }}
                        transition={{ duration: 0.65, delay: index * 0.06 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="stats-footnote">Одна история может принадлежать нескольким жанрам.</p>
            </section>
            <section className="stats-balance-panel">
              <h2>От планов к впечатлениям</h2>
              <div className="stats-completion">
                <strong>{percent}%</strong>
                <div
                  className="progress-track"
                  role="meter"
                  aria-label="Завершённые истории"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ transform: `scaleX(${percent / 100})` }} />
                </div>
              </div>
              <p>
                {completed} из {library.length}{' '}
                {plural(library.length, ['истории', 'историй', 'историй'])}. Всё в своём темпе.
              </p>
            </section>
          </div>
          <section className="stats-categories">
            <h2>Четыре способа прожить больше</h2>
            <div>
              {(Object.keys(mediaMeta) as MediaType[]).map((type) => {
                const Icon = mediaMeta[type].icon
                return (
                  <div key={type}>
                    <Icon size={25} style={{ color: mediaMeta[type].color }} />
                    <strong>{library.filter((item) => item.type === type).length}</strong>
                    <span>{mediaMeta[type].label}</span>
                  </div>
                )
              })}
            </div>
          </section>
          <section className="stats-recent">
            <div className="section-heading">
              <h2>Недавно на твоей полке</h2>
            </div>
            <div className="recent-items">
              {recent.map((item) => (
                <button key={item.id} onClick={() => onOpen(item)}>
                  <Poster item={item} />
                  <div>
                    <span style={{ color: mediaMeta[item.type].color }}>
                      {mediaMeta[item.type].singular}
                    </span>
                    <strong>{item.title}</strong>
                    <small>
                      {new Date(entries[item.id].addedAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </small>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  )
}
