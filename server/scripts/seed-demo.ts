import crypto from 'node:crypto'
import { loadConfig } from '../config.ts'
import { openDatabase } from '../db/index.ts'
import { TitleStore } from '../library/titles.ts'
import { hashPassword } from '../auth/password.ts'
import type { Kind, TitleNames } from '../../shared/types.ts'

interface SeedTitle {
  id: string
  kind: Kind
  names: TitleNames
  year: number
  genres: string[]
  runtime?: number
  totalEpisodes?: number
  poster: string | null
}

interface FinishedItem {
  id: string
  rating: number
  favorite: number
  notes: string
  finished: number
  hours?: number
  platform?: string
  store?: string
}

interface InProgressItem {
  id: string
  progress: number
  notes: string
  hours?: number
  platform?: string
  store?: string
  watched?: number
  total?: number
}

const config = loadConfig()
const db = openDatabase(config.dbFile)
const titles = new TitleStore(db)

const EMAIL = 'demo@mediashell.local'
const PASSWORD = 'password123'
const NAME = 'Влад'

console.log('Seeding 2-year veteran user:', EMAIL)

// Check if user exists
const existing = db
  .prepare('SELECT id FROM users WHERE email_normalized = ?')
  .get(EMAIL.toLowerCase()) as { id: string } | undefined
let userId = existing?.id

if (!userId) {
  userId = crypto.randomUUID()
  const passwordHash = await hashPassword(PASSWORD)
  const now = Date.now()
  const twoYearsAgo = now - 730 * 86400 * 1000

  const prefs = {
    locale: 'ru',
    theme: 'dark',
    region: 'RU',
    avatar: 'cat',
    avatarColor: 'orange',
    banner: 'ocean',
    platforms: ['pc', 'playstation5', 'switch'],
    stores: ['steam', 'gog'],
  }

  db.prepare(
    `
    INSERT INTO users (id, email, email_normalized, name, password_hash, preferences, created_at, updated_at, password_changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    userId,
    EMAIL,
    EMAIL.toLowerCase(),
    NAME,
    passwordHash,
    JSON.stringify(prefs),
    twoYearsAgo,
    now,
    twoYearsAgo,
  )
  console.log('User created with ID:', userId)
} else {
  console.log('User already exists, clearing previous test library data...')
  db.prepare('DELETE FROM entries WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM playthroughs WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM episode_marks WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM activity WHERE user_id = ?').run(userId)
}

const now = Date.now()
const t2024 = new Date('2024-10-15T12:00:00Z').getTime()
const t2025 = new Date('2025-06-15T12:00:00Z').getTime()
const t2026 = new Date('2026-03-10T12:00:00Z').getTime()

const pool: SeedTitle[] = [
  {
    id: 'movie-tt0111161',
    kind: 'movie',
    names: {
      original: 'The Shawshank Redemption',
      ru: 'Побег из Шоушенка',
      en: 'The Shawshank Redemption',
    },
    year: 1994,
    genres: ['Drama'],
    runtime: 142,
    poster:
      'https://m.media-amazon.com/images/M/MV5BMDFkYTc0MGEtZmNhMC00ZDIzLWFmNTEtODM1ZmRlYWMwMWFmXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_.jpg',
  },
  {
    id: 'movie-tt0068646',
    kind: 'movie',
    names: { original: 'The Godfather', ru: 'Крёстный отец', en: 'The Godfather' },
    year: 1972,
    genres: ['Crime', 'Drama'],
    runtime: 175,
    poster: 'https://images.metahub.space/poster/medium/tt0068646/img',
  },
  {
    id: 'movie-tt0468569',
    kind: 'movie',
    names: { original: 'The Dark Knight', ru: 'Тёмный рыцарь', en: 'The Dark Knight' },
    year: 2008,
    genres: ['Action', 'Crime', 'Drama'],
    runtime: 152,
    poster:
      'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg',
  },
  {
    id: 'movie-tt1375666',
    kind: 'movie',
    names: { original: 'Inception', ru: 'Начало', en: 'Inception' },
    year: 2010,
    genres: ['Action', 'Sci-Fi'],
    runtime: 148,
    poster:
      'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg',
  },
  {
    id: 'movie-tt0816692',
    kind: 'movie',
    names: { original: 'Interstellar', ru: 'Интерстеллар', en: 'Interstellar' },
    year: 2014,
    genres: ['Sci-Fi', 'Drama'],
    runtime: 169,
    poster:
      'https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_.jpg',
  },
  {
    id: 'movie-tt6751668',
    kind: 'movie',
    names: { original: 'Parasite', ru: 'Паразиты', en: 'Parasite' },
    year: 2019,
    genres: ['Drama', 'Thriller'],
    runtime: 132,
    poster: 'https://images.metahub.space/poster/medium/tt6751668/img',
  },
  {
    id: 'movie-tt0109830',
    kind: 'movie',
    names: { original: 'Forrest Gump', ru: 'Форрест Гамп', en: 'Forrest Gump' },
    year: 1994,
    genres: ['Drama', 'Romance'],
    runtime: 142,
    poster: 'https://images.metahub.space/poster/medium/tt0109830/img',
  },
  {
    id: 'movie-tt0137523',
    kind: 'movie',
    names: { original: 'Fight Club', ru: 'Бойцовский клуб', en: 'Fight Club' },
    year: 1999,
    genres: ['Drama'],
    runtime: 139,
    poster: 'https://images.metahub.space/poster/medium/tt0137523/img',
  },
  {
    id: 'movie-tt0133093',
    kind: 'movie',
    names: { original: 'The Matrix', ru: 'Матрица', en: 'The Matrix' },
    year: 1999,
    genres: ['Sci-Fi', 'Action'],
    runtime: 136,
    poster: 'https://images.metahub.space/poster/medium/tt0133093/img',
  },
  {
    id: 'movie-tt0167260',
    kind: 'movie',
    names: {
      original: 'The Lord of the Rings: The Return of the King',
      ru: 'Властелин колец: Возвращение короля',
      en: 'The Return of the King',
    },
    year: 2003,
    genres: ['Fantasy', 'Adventure'],
    runtime: 201,
    poster: 'https://images.metahub.space/poster/medium/tt0167260/img',
  },
  {
    id: 'series-tt0903747',
    kind: 'series',
    names: { original: 'Breaking Bad', ru: 'Во все тяжкие', en: 'Breaking Bad' },
    year: 2008,
    genres: ['Crime', 'Drama'],
    runtime: 47,
    totalEpisodes: 62,
    poster: 'https://images.metahub.space/poster/medium/tt0903747/img',
  },
  {
    id: 'series-tt0944947',
    kind: 'series',
    names: { original: 'Game of Thrones', ru: 'Игра престолов', en: 'Game of Thrones' },
    year: 2011,
    genres: ['Fantasy', 'Drama'],
    runtime: 57,
    totalEpisodes: 73,
    poster: 'https://images.metahub.space/poster/medium/tt0944947/img',
  },
  {
    id: 'series-tt1475582',
    kind: 'series',
    names: { original: 'Sherlock', ru: 'Шерлок', en: 'Sherlock' },
    year: 2010,
    genres: ['Crime', 'Mystery'],
    runtime: 90,
    totalEpisodes: 13,
    poster: 'https://images.metahub.space/poster/medium/tt1475582/img',
  },
  {
    id: 'series-tt4574334',
    kind: 'series',
    names: { original: 'Stranger Things', ru: 'Очень странные дела', en: 'Stranger Things' },
    year: 2016,
    genres: ['Sci-Fi', 'Horror'],
    runtime: 51,
    totalEpisodes: 34,
    poster: 'https://images.metahub.space/poster/medium/tt4574334/img',
  },
  {
    id: 'series-tt3032476',
    kind: 'series',
    names: { original: 'Better Call Saul', ru: 'Лучше звоните Солу', en: 'Better Call Saul' },
    year: 2015,
    genres: ['Crime', 'Drama'],
    runtime: 46,
    totalEpisodes: 63,
    poster: 'https://images.metahub.space/poster/medium/tt3032476/img',
  },
  {
    id: 'series-tt0386676',
    kind: 'series',
    names: { original: 'The Office', ru: 'Офис', en: 'The Office' },
    year: 2005,
    genres: ['Comedy'],
    runtime: 22,
    totalEpisodes: 201,
    poster: 'https://images.metahub.space/poster/medium/tt0386676/img',
  },
  {
    id: 'series-tt7366338',
    kind: 'series',
    names: { original: 'Chernobyl', ru: 'Чернобыль', en: 'Chernobyl' },
    year: 2019,
    genres: ['Drama', 'History'],
    runtime: 60,
    totalEpisodes: 5,
    poster: 'https://images.metahub.space/poster/medium/tt7366338/img',
  },
  {
    id: 'series-tt0185906',
    kind: 'series',
    names: { original: 'Band of Brothers', ru: 'Братья по оружию', en: 'Band of Brothers' },
    year: 2001,
    genres: ['War', 'Drama'],
    runtime: 60,
    totalEpisodes: 10,
    poster: 'https://images.metahub.space/poster/medium/tt0185906/img',
  },
  {
    id: 'anime-52991',
    kind: 'anime',
    names: {
      original: 'Sousou no Frieren',
      ru: 'Провожающая в последний путь Фрирен',
      en: "Frieren: Beyond Journey's End",
    },
    year: 2023,
    genres: ['Fantasy', 'Adventure'],
    runtime: 24,
    totalEpisodes: 28,
    poster: 'https://shikimori.one/system/animes/original/52991.jpg',
  },
  {
    id: 'anime-5114',
    kind: 'anime',
    names: {
      original: 'Fullmetal Alchemist: Brotherhood',
      ru: 'Стальной алхимик: Братство',
      en: 'Fullmetal Alchemist: Brotherhood',
    },
    year: 2009,
    genres: ['Action', 'Fantasy'],
    runtime: 24,
    totalEpisodes: 64,
    poster: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
  },
  {
    id: 'anime-9253',
    kind: 'anime',
    names: { original: 'Steins;Gate', ru: 'Врата Штейна', en: 'Steins;Gate' },
    year: 2011,
    genres: ['Sci-Fi', 'Thriller'],
    runtime: 24,
    totalEpisodes: 24,
    poster: 'https://cdn.myanimelist.net/images/anime/1935/127974.jpg',
  },
  {
    id: 'anime-1535',
    kind: 'anime',
    names: { original: 'Death Note', ru: 'Тетрадь смерти', en: 'Death Note' },
    year: 2006,
    genres: ['Mystery', 'Supernatural'],
    runtime: 23,
    totalEpisodes: 37,
    poster: 'https://images.metahub.space/poster/medium/tt0877057/img',
  },
  {
    id: 'anime-16498',
    kind: 'anime',
    names: { original: 'Shingeki no Kyojin', ru: 'Атака титанов', en: 'Attack on Titan' },
    year: 2013,
    genres: ['Action', 'Fantasy'],
    runtime: 24,
    totalEpisodes: 87,
    poster: 'https://shikimori.one/system/animes/original/16498.jpg',
  },
  {
    id: 'anime-1',
    kind: 'anime',
    names: { original: 'Cowboy Bebop', ru: 'Ковбой Бибоп', en: 'Cowboy Bebop' },
    year: 1998,
    genres: ['Action', 'Sci-Fi'],
    runtime: 24,
    totalEpisodes: 26,
    poster: 'https://shikimori.one/system/animes/original/1.jpg',
  },
  {
    id: 'steam-292030',
    kind: 'game',
    names: {
      original: 'The Witcher 3: Wild Hunt',
      ru: 'Ведьмак 3: Дикая Охота',
      en: 'The Witcher 3: Wild Hunt',
    },
    year: 2015,
    genres: ['RPG', 'Open World'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/library_600x900.jpg',
  },
  {
    id: 'steam-1091500',
    kind: 'game',
    names: { original: 'Cyberpunk 2077', ru: 'Cyberpunk 2077', en: 'Cyberpunk 2077' },
    year: 2020,
    genres: ['RPG', 'Action'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900.jpg',
  },
  {
    id: 'steam-1086940',
    kind: 'game',
    names: { original: "Baldur's Gate 3", ru: "Baldur's Gate 3", en: "Baldur's Gate 3" },
    year: 2023,
    genres: ['RPG', 'Turn-Based'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/library_600x900.jpg',
  },
  {
    id: 'steam-367520',
    kind: 'game',
    names: { original: 'Hollow Knight', ru: 'Hollow Knight', en: 'Hollow Knight' },
    year: 2017,
    genres: ['Metroidvania', 'Action'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/library_600x900.jpg',
  },
  {
    id: 'steam-413150',
    kind: 'game',
    names: { original: 'Stardew Valley', ru: 'Stardew Valley', en: 'Stardew Valley' },
    year: 2016,
    genres: ['Simulation', 'RPG'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/library_600x900.jpg',
  },
  {
    id: 'steam-632470',
    kind: 'game',
    names: { original: 'Disco Elysium', ru: 'Disco Elysium', en: 'Disco Elysium' },
    year: 2019,
    genres: ['RPG', 'Story Rich'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/632470/library_600x900.jpg',
  },
  {
    id: 'steam-1145360',
    kind: 'game',
    names: { original: 'Hades', ru: 'Hades', en: 'Hades' },
    year: 2020,
    genres: ['Roguelike', 'Action'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/library_600x900.jpg',
  },
  {
    id: 'steam-883710',
    kind: 'game',
    names: { original: 'Resident Evil 2', ru: 'Resident Evil 2', en: 'Resident Evil 2' },
    year: 2019,
    genres: ['Horror', 'Action'],
    poster:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/883710/library_600x900.jpg',
  },
]

for (const item of pool) {
  titles.put(
    {
      id: item.id,
      kind: item.kind,
      names: item.names,
      year: item.year,
      poster: item.poster,
      backdrop: null,
      genres: item.genres,
      ratings: [{ source: 'imdb', value: 9.0, max: 10 }],
      runtime: item.runtime ?? null,
      episodes: item.totalEpisodes ?? null,
      externalIds: {},
    },
    true,
  )
}

const insertEntry = db.prepare(`
  INSERT INTO entries (
    user_id, title_id, kind, status, rating, favorite, notes, progress,
    platform, store, hours, watched_episodes, total_episodes, next_episode, position,
    added_at, updated_at, started_at, finished_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertActivity = db.prepare(`
  INSERT INTO activity (user_id, title_id, kind, type, data, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const insertPlaythrough = db.prepare(`
  INSERT INTO playthroughs (id, user_id, title_id, label, platform, store, status, progress, hours, started_at, finished_at, note, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

let count = 0

// 1. Finished across 2024, 2025, 2026
const finishedItems: FinishedItem[] = [
  {
    id: 'movie-tt0111161',
    rating: 10,
    favorite: 1,
    notes: 'Шедевр кино. Пересматривал третий раз.',
    finished: t2024 + 10 * 86400000,
  },
  {
    id: 'movie-tt0068646',
    rating: 9,
    favorite: 0,
    notes: 'Классика, Марлон Брандо великолепен.',
    finished: t2024 + 25 * 86400000,
  },
  {
    id: 'anime-1535',
    rating: 9,
    favorite: 0,
    notes: 'Первая половина 10/10.',
    finished: t2024 + 40 * 86400000,
  },
  {
    id: 'steam-1145360',
    rating: 10,
    favorite: 1,
    hours: 95,
    platform: 'pc',
    store: 'steam',
    notes: 'Выбил эпилог, лучший рогалик.',
    finished: t2024 + 60 * 86400000,
  },

  {
    id: 'series-tt0903747',
    rating: 10,
    favorite: 1,
    notes: 'Озимандия — лучший эпизод в истории ТВ.',
    finished: t2025 - 100 * 86400000,
  },
  {
    id: 'movie-tt0468569',
    rating: 10,
    favorite: 1,
    notes: 'Леджер вне конкуренции.',
    finished: t2025 - 80 * 86400000,
  },
  {
    id: 'movie-tt1375666',
    rating: 9,
    favorite: 0,
    notes: 'Нолан в лучшей форме.',
    finished: t2025 - 60 * 86400000,
  },
  {
    id: 'anime-5114',
    rating: 10,
    favorite: 1,
    notes: 'Идеальное приключение от начала до конца.',
    finished: t2025 - 40 * 86400000,
  },
  {
    id: 'steam-632470',
    rating: 10,
    favorite: 1,
    hours: 48,
    platform: 'pc',
    store: 'steam',
    notes: 'Самый умный текст в видеоиграх.',
    finished: t2025 - 20 * 86400000,
  },
  {
    id: 'series-tt7366338',
    rating: 10,
    favorite: 0,
    notes: 'Страшно и документально точно.',
    finished: t2025 + 15 * 86400000,
  },
  {
    id: 'anime-9253',
    rating: 9,
    favorite: 0,
    notes: 'Эль Псай Конгру.',
    finished: t2025 + 45 * 86400000,
  },
  {
    id: 'steam-367520',
    rating: 9,
    favorite: 0,
    hours: 65,
    platform: 'pc',
    store: 'steam',
    notes: 'Пантеон 5 почти покорился.',
    finished: t2025 + 90 * 86400000,
  },

  {
    id: 'movie-tt0816692',
    rating: 10,
    favorite: 1,
    notes: 'Циммер разрывает сердце органом.',
    finished: t2026 - 50 * 86400000,
  },
  {
    id: 'movie-tt6751668',
    rating: 9,
    favorite: 0,
    notes: 'Идеальный темп и монтаж.',
    finished: t2026 - 30 * 86400000,
  },
  {
    id: 'anime-52991',
    rating: 10,
    favorite: 1,
    notes: 'Невероятное чувство течения времени и меланхолии.',
    finished: t2026 - 15 * 86400000,
  },
  {
    id: 'steam-1091500',
    rating: 9,
    favorite: 0,
    hours: 110,
    platform: 'pc',
    store: 'gog',
    notes: 'С Phantom Liberty игра стала тем, чем должна была быть на релизе.',
    finished: t2026 - 5 * 86400000,
  },
]

for (const item of finishedItems) {
  const meta = pool.find((p) => p.id === item.id)!
  const started = item.finished - 14 * 86400000
  insertEntry.run(
    userId,
    item.id,
    meta.kind,
    'completed',
    item.rating,
    item.favorite,
    item.notes,
    100,
    item.platform ?? null,
    item.store ?? null,
    item.hours ?? null,
    meta.totalEpisodes ?? 0,
    meta.totalEpisodes ?? null,
    null,
    count,
    started - 86400000,
    item.finished,
    started,
    item.finished,
  )
  insertActivity.run(
    userId,
    item.id,
    meta.kind,
    'added',
    JSON.stringify({ status: 'completed' }),
    started,
  )
  insertActivity.run(
    userId,
    item.id,
    meta.kind,
    'rated',
    JSON.stringify({ rating: item.rating }),
    item.finished,
  )
  count++
}

const inProgressItems: InProgressItem[] = [
  {
    id: 'steam-292030',
    progress: 75,
    hours: 92,
    platform: 'pc',
    store: 'steam',
    notes: 'Новиград закончил, сейчас на Скеллиге.',
  },
  { id: 'series-tt0944947', progress: 65, watched: 48, total: 73, notes: 'Пересматриваю 4 сезон.' },
  {
    id: 'steam-1086940',
    progress: 40,
    hours: 64,
    platform: 'pc',
    store: 'steam',
    notes: 'Конец первого акта, играю за барда.',
  },
]

for (const item of inProgressItems) {
  const meta = pool.find((p) => p.id === item.id)!
  const started = now - 20 * 86400000
  insertEntry.run(
    userId,
    item.id,
    meta.kind,
    'in_progress',
    null,
    1,
    item.notes,
    item.progress,
    item.platform ?? null,
    item.store ?? null,
    item.hours ?? null,
    item.watched ?? 0,
    item.total ?? null,
    null,
    count,
    started,
    now - 3600000,
    started,
    null,
  )
  insertActivity.run(
    userId,
    item.id,
    meta.kind,
    'added',
    JSON.stringify({ status: 'in_progress' }),
    started,
  )
  if (meta.kind === 'game') {
    insertPlaythrough.run(
      crypto.randomUUID(),
      userId,
      item.id,
      'Основное',
      item.platform ?? null,
      item.store ?? null,
      'in_progress',
      item.progress,
      item.hours ?? null,
      started,
      null,
      'Первый забег на харде',
      started,
      now,
    )
  }
  count++
}

const plannedIds = [
  'movie-tt0109830',
  'movie-tt0137523',
  'series-tt4574334',
  'steam-413150',
  'anime-16498',
]
for (const id of plannedIds) {
  const meta = pool.find((p) => p.id === id)!
  insertEntry.run(
    userId,
    id,
    meta.kind,
    'planned',
    null,
    0,
    '',
    0,
    null,
    null,
    null,
    0,
    meta.totalEpisodes ?? null,
    null,
    count,
    now - 50 * 86400000,
    now - 50 * 86400000,
    null,
    null,
  )
  count++
}

console.log(`Successfully seeded ${count} library entries for ${EMAIL}!`)
