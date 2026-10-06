import type { DatabaseSync } from 'node:sqlite'

/** Append-only. Each entry upgrades PRAGMA user_version by one. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    email_normalized TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    preferences TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    password_changed_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    public_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE INDEX sessions_expiry ON sessions(expires_at);

  CREATE TABLE titles (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    data TEXT NOT NULL,
    detailed_at INTEGER,
    updated_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE entries (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id TEXT NOT NULL REFERENCES titles(id),
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    rating INTEGER,
    favorite INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    progress INTEGER NOT NULL DEFAULT 0,
    platform TEXT,
    store TEXT,
    hours REAL,
    watched_episodes INTEGER NOT NULL DEFAULT 0,
    total_episodes INTEGER,
    next_episode TEXT,
    position REAL NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    PRIMARY KEY (user_id, title_id)
  ) STRICT;
  CREATE INDEX entries_user_status ON entries(user_id, status, position);
  CREATE INDEX entries_user_updated ON entries(user_id, updated_at DESC);

  CREATE TABLE playthroughs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    platform TEXT,
    store TEXT,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    hours REAL,
    started_at INTEGER,
    finished_at INTEGER,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id, title_id) REFERENCES entries(user_id, title_id) ON DELETE CASCADE
  ) STRICT;
  CREATE INDEX playthroughs_entry ON playthroughs(user_id, title_id);

  CREATE TABLE episode_marks (
    user_id TEXT NOT NULL,
    title_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    number INTEGER NOT NULL,
    watched_at INTEGER,
    rating INTEGER,
    note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, title_id, season, number),
    FOREIGN KEY (user_id, title_id) REFERENCES entries(user_id, title_id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE episode_lists (
    title_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX activity_user_time ON activity(user_id, created_at DESC);

  CREATE TABLE cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX cache_expiry ON cache(expires_at);
  `,
  // v2: imported titles are unverified until refreshed from a catalog; completing a series
  // records which episode marks it added so undoing the status can remove them again.
  `
  ALTER TABLE titles ADD COLUMN verified INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE episode_marks ADD COLUMN auto INTEGER NOT NULL DEFAULT 0;
  `,
]

export function migrate(db: DatabaseSync) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as {
    user_version: number
  }
  if (current > MIGRATIONS.length)
    throw new Error(
      `Database schema v${current} is newer than this build (v${MIGRATIONS.length}). Update MediaShelf.`,
    )
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(MIGRATIONS[version])
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
