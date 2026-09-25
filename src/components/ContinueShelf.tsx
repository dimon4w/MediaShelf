import { ArrowRight, Play } from 'lucide-react'
import { getProgressMax } from '../lib/library'
import { mediaMeta, progressLabel } from '../lib/presentation'
import type { LibraryEntry, MediaItem } from '../lib/types'
import Poster from './Poster'
import { entryStatuses, playthroughLabel } from '../lib/platforms'

export default function ContinueShelf({
  items,
  entries,
  onOpen,
  onLibrary,
}: {
  items: MediaItem[]
  entries: Record<string, LibraryEntry>
  onOpen: (item: MediaItem) => void
  onLibrary: () => void
}) {
  const active = items
    .filter((item) => entryStatuses(entries[item.id]).includes('active'))
    .sort((a, b) => entries[b.id].updatedAt.localeCompare(entries[a.id].updatedAt))
    .slice(0, 3)
  if (!active.length) return null
  return (
    <section className="continue-shelf" aria-label="Продолжить начатое">
      <div className="section-heading">
        <h2>Продолжить с того же места</h2>
        <button onClick={onLibrary}>
          Вся полка <ArrowRight size={15} />
        </button>
      </div>
      <div className="continue-items">
        {active.map((item) => {
          const entry = entries[item.id]
          const max = getProgressMax(item)
          const run = entry.playthroughs?.find((p) => p.statuses.includes('active'))
          const progress = run?.progress ?? entry.progress
          return (
            <button key={item.id} onClick={() => onOpen(item)} className="continue-item">
              <Poster item={item} />
              <div>
                <span>{mediaMeta[item.type].singular}</span>
                <strong>{item.title}</strong>
                <small>
                  {run ? `${playthroughLabel(run)} · ${run.progress}%` : progressLabel(item, entry)}
                </small>
                {max !== null && (
                  <div className="progress-track">
                    <span style={{ transform: `scaleX(${progress / max})` }} />
                  </div>
                )}
              </div>
              <span className="continue-open">
                <Play size={14} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
