// Deterministic offline catalog for e2e tests (CATALOG_MODE=fixtures). Ids, names, years,
// genres and ratings are real; episode lists and prices are synthetic but stable.
import type {
  ChartList,
  ChartPage,
  EpisodeList,
  ExternalRating,
  Kind,
  SearchResult,
  StoreOffer,
  TitleRecord,
} from '../../shared/types.ts'
import { parseTitleId } from '../../shared/ids.ts'
import { isRegion } from '../../shared/regions.ts'
import { matchTier, recordNames } from './records.ts'
import type { CatalogContext, CatalogService } from './types.ts'

interface FixtureTitle {
  id: string
  original: string
  en?: string
  ru: string
  year: number
  endYear?: number
  genres: string[]
  ratings: ExternalRating[]
  runtime: number
  creators: string[]
  descriptions: { ru: string; en: string }
  /** Games: USD cents for Steam and GOG. */
  prices?: { steam: [number, number]; gog: [number, number]; gogId: string; gogSlug: string }
}

const imdb = (value: number, votes?: number): ExternalRating => ({
  source: 'imdb',
  value,
  max: 10,
  ...(votes ? { votes } : {}),
})
const steam = (value: number, votes: number): ExternalRating => ({
  source: 'steam',
  value,
  max: 100,
  votes,
})
const metacritic = (value: number): ExternalRating => ({ source: 'metacritic', value, max: 100 })
const shikimori = (value: number): ExternalRating => ({ source: 'shikimori', value, max: 10 })
const anilist = (value: number): ExternalRating => ({ source: 'anilist', value, max: 100 })

const TITLES: readonly FixtureTitle[] = [
  // Games
  {
    id: 'steam-292030',
    original: 'The Witcher 3: Wild Hunt',
    ru: 'Ведьмак 3: Дикая Охота',
    year: 2015,
    genres: ['RPG', 'Open World', 'Story Rich', 'Fantasy'],
    ratings: [steam(96, 824153), metacritic(93)],
    runtime: 0,
    creators: ['CD PROJEKT RED'],
    descriptions: {
      en: 'Geralt of Rivia, a monster slayer for hire, searches a war-torn open world for the child of prophecy.',
      ru: 'Геральт из Ривии, наёмный охотник на чудовищ, ищет дитя предназначения в охваченном войной открытом мире.',
    },
    prices: {
      steam: [3999, 999],
      gog: [3999, 3999],
      gogId: '1640424747',
      gogSlug: 'the_witcher_3_wild_hunt_game_of_the_year_edition',
    },
  },
  {
    id: 'steam-1091500',
    original: 'Cyberpunk 2077',
    ru: 'Cyberpunk 2077',
    year: 2020,
    genres: ['RPG', 'Open World', 'Cyberpunk', 'FPS', 'Sci-Fi'],
    ratings: [steam(87, 884672), metacritic(86)],
    runtime: 0,
    creators: ['CD PROJEKT RED'],
    descriptions: {
      en: 'An open-world action RPG set in Night City, a megalopolis obsessed with power, glamour and body modification.',
      ru: 'Ролевой экшен в открытом мире Найт-Сити — мегаполиса, одержимого властью, гламуром и модификациями тела.',
    },
    prices: {
      steam: [5999, 5999],
      gog: [5999, 1799],
      gogId: '2093619782',
      gogSlug: 'cyberpunk_2077',
    },
  },
  {
    id: 'steam-1086940',
    original: "Baldur's Gate 3",
    ru: "Baldur's Gate 3",
    year: 2023,
    genres: ['RPG', 'Turn-Based Tactics', 'Fantasy', 'Co-op', 'Story Rich'],
    ratings: [steam(96, 756029), metacritic(96)],
    runtime: 0,
    creators: ['Larian Studios'],
    descriptions: {
      en: 'Gather your party and return to the Forgotten Realms in a tale of fellowship, betrayal and survival.',
      ru: 'Соберите отряд и вернитесь в Забытые Королевства: история о дружбе, предательстве и выживании.',
    },
    prices: {
      steam: [5999, 4799],
      gog: [5999, 5999],
      gogId: '1456460669',
      gogSlug: 'baldurs_gate_iii',
    },
  },
  {
    id: 'steam-632470',
    original: 'Disco Elysium - The Final Cut',
    ru: 'Disco Elysium — The Final Cut',
    year: 2019,
    genres: ['RPG', 'Detective', 'Story Rich', 'Indie'],
    ratings: [steam(92, 118270), metacritic(91)],
    runtime: 0,
    creators: ['ZA/UM'],
    descriptions: {
      en: 'A detective with a unique skill system wakes up with amnesia and a murder case in the city of Revachol.',
      ru: 'Детектив с уникальной системой навыков просыпается с амнезией и делом об убийстве в городе Ревашоль.',
    },
    prices: {
      steam: [3999, 3999],
      gog: [3999, 999],
      gogId: '1771589310',
      gogSlug: 'disco_elysium',
    },
  },
  {
    id: 'steam-367520',
    original: 'Hollow Knight',
    ru: 'Hollow Knight',
    year: 2017,
    genres: ['Metroidvania', 'Souls-like', 'Platformer', 'Indie'],
    ratings: [steam(96, 503620), metacritic(87)],
    runtime: 0,
    creators: ['Team Cherry'],
    descriptions: {
      en: 'Descend into Hallownest, a vast ruined kingdom of insects and heroes, in a classically styled 2D action adventure.',
      ru: 'Спуститесь в Халлоунест — огромное павшее королевство насекомых и героев — в классическом двухмерном приключении.',
    },
    prices: {
      steam: [1499, 749],
      gog: [1499, 1499],
      gogId: '1308320804',
      gogSlug: 'hollow_knight',
    },
  },
  {
    id: 'steam-413150',
    original: 'Stardew Valley',
    ru: 'Stardew Valley',
    year: 2016,
    genres: ['Farming Sim', 'Life Sim', 'RPG', 'Indie', 'Co-op'],
    ratings: [steam(98, 895314), metacritic(89)],
    runtime: 0,
    creators: ['ConcernedApe'],
    descriptions: {
      en: "You've inherited your grandfather's old farm plot. Armed with hand-me-down tools, you begin your new life.",
      ru: 'Вам досталась старая ферма деда. С поношенными инструментами и парой монет вы начинаете новую жизнь.',
    },
    prices: {
      steam: [1499, 1499],
      gog: [1499, 1049],
      gogId: '1453375253',
      gogSlug: 'stardew_valley',
    },
  },
  // Movies
  {
    id: 'movie-tt0816692',
    original: 'Interstellar',
    ru: 'Интерстеллар',
    year: 2014,
    genres: ['Adventure', 'Drama', 'Sci-Fi'],
    ratings: [imdb(8.7, 2400000)],
    runtime: 169,
    creators: ['Christopher Nolan'],
    descriptions: {
      en: 'When Earth becomes uninhabitable, a former NASA pilot leads a mission through a wormhole to find a new home for humanity.',
      ru: 'Когда Земля становится непригодной для жизни, бывший пилот NASA отправляется через червоточину искать человечеству новый дом.',
    },
  },
  {
    id: 'movie-tt0111161',
    original: 'The Shawshank Redemption',
    ru: 'Побег из Шоушенка',
    year: 1994,
    genres: ['Drama'],
    ratings: [imdb(9.3, 3000000)],
    runtime: 142,
    creators: ['Frank Darabont'],
    descriptions: {
      en: 'A banker sentenced to life in Shawshank prison finds hope and friendship over two decades behind bars.',
      ru: 'Банкир, приговорённый к пожизненному заключению в тюрьме Шоушенк, за двадцать лет находит надежду и дружбу.',
    },
  },
  {
    id: 'movie-tt0068646',
    original: 'The Godfather',
    ru: 'Крёстный отец',
    year: 1972,
    genres: ['Crime', 'Drama'],
    ratings: [imdb(9.2, 2100000)],
    runtime: 175,
    creators: ['Francis Ford Coppola'],
    descriptions: {
      en: 'The aging patriarch of a crime dynasty transfers control of his empire to his reluctant youngest son.',
      ru: 'Стареющий глава мафиозного клана передаёт управление своей империей младшему сыну, не желавшему этой судьбы.',
    },
  },
  {
    id: 'movie-tt1375666',
    original: 'Inception',
    ru: 'Начало',
    year: 2010,
    genres: ['Action', 'Adventure', 'Sci-Fi'],
    ratings: [imdb(8.8, 2700000)],
    runtime: 148,
    creators: ['Christopher Nolan'],
    descriptions: {
      en: 'A thief who steals secrets through dream-sharing technology is offered a chance to plant an idea instead.',
      ru: 'Вору, крадущему секреты из снов, предлагают обратную задачу — внедрить идею в сознание человека.',
    },
  },
  {
    id: 'movie-tt0468569',
    original: 'The Dark Knight',
    ru: 'Тёмный рыцарь',
    year: 2008,
    genres: ['Action', 'Crime', 'Drama'],
    ratings: [imdb(9.1, 3000000)],
    runtime: 152,
    creators: ['Christopher Nolan'],
    descriptions: {
      en: 'Batman faces the Joker, a criminal mastermind who wants to plunge Gotham City into anarchy.',
      ru: 'Бэтмен противостоит Джокеру — преступному гению, который хочет погрузить Готэм в хаос.',
    },
  },
  {
    id: 'movie-tt6751668',
    original: 'Parasite',
    ru: 'Паразиты',
    year: 2019,
    genres: ['Drama', 'Thriller'],
    ratings: [imdb(8.5, 1000000)],
    runtime: 132,
    creators: ['Bong Joon Ho'],
    descriptions: {
      en: 'A poor family schemes its way into employment with a wealthy household, with unexpected consequences.',
      ru: 'Бедная семья хитростью устраивается на работу к богачам, и это приводит к неожиданным последствиям.',
    },
  },
  // Series
  {
    id: 'series-tt0903747',
    original: 'Breaking Bad',
    ru: 'Во все тяжкие',
    year: 2008,
    endYear: 2013,
    genres: ['Crime', 'Drama', 'Thriller'],
    ratings: [imdb(9.5, 2400000)],
    runtime: 49,
    creators: ['Vince Gilligan'],
    descriptions: {
      en: 'A chemistry teacher diagnosed with cancer turns to manufacturing methamphetamine to secure his family’s future.',
      ru: 'Учитель химии, узнав о раке, начинает варить метамфетамин, чтобы обеспечить будущее семьи.',
    },
  },
  {
    id: 'series-tt0944947',
    original: 'Game of Thrones',
    ru: 'Игра престолов',
    year: 2011,
    endYear: 2019,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    ratings: [imdb(9.2, 2400000)],
    runtime: 57,
    creators: ['David Benioff', 'D.B. Weiss'],
    descriptions: {
      en: 'Noble families fight for the Iron Throne while an ancient threat awakens beyond the Wall.',
      ru: 'Знатные семьи борются за Железный трон, пока за Стеной пробуждается древняя угроза.',
    },
  },
  {
    id: 'series-tt1475582',
    original: 'Sherlock',
    ru: 'Шерлок',
    year: 2010,
    endYear: 2017,
    genres: ['Crime', 'Drama', 'Mystery'],
    ratings: [imdb(9.0, 1000000)],
    runtime: 88,
    creators: ['Mark Gatiss', 'Steven Moffat'],
    descriptions: {
      en: 'A modern update of the Sherlock Holmes stories, with the detective and Dr. Watson solving cases in London.',
      ru: 'Современная версия историй о Шерлоке Холмсе: детектив и доктор Ватсон раскрывают дела в Лондоне.',
    },
  },
  {
    id: 'series-tt4574334',
    original: 'Stranger Things',
    ru: 'Очень странные дела',
    year: 2016,
    endYear: 2025,
    genres: ['Drama', 'Fantasy', 'Horror'],
    ratings: [imdb(8.6, 1400000)],
    runtime: 51,
    creators: ['Matt Duffer', 'Ross Duffer'],
    descriptions: {
      en: 'When a boy vanishes, a small town uncovers secret experiments, supernatural forces and one strange girl.',
      ru: 'Когда пропадает мальчик, жители городка сталкиваются с секретными экспериментами и сверхъестественными силами.',
    },
  },
  {
    id: 'series-tt0386676',
    original: 'The Office',
    ru: 'Офис',
    year: 2005,
    endYear: 2013,
    genres: ['Comedy'],
    ratings: [imdb(9.0, 750000)],
    runtime: 22,
    creators: ['Greg Daniels'],
    descriptions: {
      en: 'A mockumentary on a group of typical office workers at a paper company in Scranton, Pennsylvania.',
      ru: 'Псевдодокументальная комедия о буднях сотрудников бумажной компании в Скрэнтоне, Пенсильвания.',
    },
  },
  {
    id: 'series-tt3032476',
    original: 'Better Call Saul',
    ru: 'Лучше звоните Солу',
    year: 2015,
    endYear: 2022,
    genres: ['Crime', 'Drama'],
    ratings: [imdb(9.0, 700000)],
    runtime: 46,
    creators: ['Vince Gilligan', 'Peter Gould'],
    descriptions: {
      en: 'The trials and tribulations of lawyer Jimmy McGill in the years before he became Saul Goodman.',
      ru: 'Злоключения адвоката Джимми Макгилла в годы, когда он ещё не стал Солом Гудманом.',
    },
  },
  // Anime
  {
    id: 'anime-52991',
    original: 'Sousou no Frieren',
    en: "Frieren: Beyond Journey's End",
    ru: 'Провожающая в последний путь Фрирен',
    year: 2023,
    endYear: 2024,
    genres: ['Adventure', 'Drama', 'Fantasy', 'Shounen'],
    ratings: [shikimori(9.25), anilist(91)],
    runtime: 24,
    creators: ['Madhouse'],
    descriptions: {
      en: 'After the demon king falls, the elf mage Frieren sets out to understand the humans she once travelled with.',
      ru: 'После победы над королём демонов эльфийка-волшебница Фрирен отправляется в путь, чтобы понять людей.',
    },
  },
  {
    id: 'anime-5114',
    original: 'Fullmetal Alchemist: Brotherhood',
    en: 'Fullmetal Alchemist: Brotherhood',
    ru: 'Стальной алхимик: Братство',
    year: 2009,
    endYear: 2010,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    ratings: [shikimori(9.11), anilist(90)],
    runtime: 24,
    creators: ['Bones'],
    descriptions: {
      en: 'Two brothers search for the Philosopher’s Stone after a failed alchemical ritual costs them dearly.',
      ru: 'Два брата ищут философский камень после неудачного алхимического ритуала, стоившего им слишком дорого.',
    },
  },
  {
    id: 'anime-9253',
    original: 'Steins;Gate',
    en: 'Steins;Gate',
    ru: 'Врата Штейна',
    year: 2011,
    endYear: 2011,
    genres: ['Drama', 'Sci-Fi', 'Suspense'],
    ratings: [shikimori(9.08), anilist(89)],
    runtime: 24,
    creators: ['White Fox'],
    descriptions: {
      en: 'A self-proclaimed mad scientist discovers a way to send messages to the past, and the world starts to change.',
      ru: 'Самопровозглашённый безумный учёный находит способ отправлять сообщения в прошлое, и мир начинает меняться.',
    },
  },
  {
    id: 'anime-1',
    original: 'Cowboy Bebop',
    en: 'Cowboy Bebop',
    ru: 'Ковбой Бибоп',
    year: 1998,
    endYear: 1999,
    genres: ['Action', 'Sci-Fi', 'Space', 'Adult Cast'],
    ratings: [shikimori(8.75), anilist(86)],
    runtime: 24,
    creators: ['Sunrise'],
    descriptions: {
      en: 'A crew of bounty hunters drifts through the solar system in 2071, chasing criminals and their own pasts.',
      ru: 'Команда охотников за головами в 2071 году странствует по Солнечной системе, преследуя преступников и своё прошлое.',
    },
  },
  {
    id: 'anime-1535',
    original: 'Death Note',
    en: 'Death Note',
    ru: 'Тетрадь смерти',
    year: 2006,
    endYear: 2007,
    genres: ['Supernatural', 'Suspense', 'Psychological'],
    ratings: [shikimori(8.62), anilist(84)],
    runtime: 23,
    creators: ['Madhouse'],
    descriptions: {
      en: 'A student finds a notebook that kills anyone whose name is written in it and decides to cleanse the world.',
      ru: 'Школьник находит тетрадь, убивающую любого, чьё имя в неё вписано, и решает очистить мир от зла.',
    },
  },
  {
    id: 'anime-16498',
    original: 'Shingeki no Kyojin',
    en: 'Attack on Titan',
    ru: 'Атака титанов',
    year: 2013,
    endYear: 2013,
    genres: ['Action', 'Drama', 'Suspense', 'Military'],
    ratings: [shikimori(8.54), anilist(85)],
    runtime: 24,
    creators: ['Wit Studio'],
    descriptions: {
      en: 'Humanity lives behind enormous walls to escape giant man-eating Titans, until the day the wall is breached.',
      ru: 'Человечество живёт за огромными стенами, спасаясь от титанов-людоедов, пока однажды стена не рушится.',
    },
  },
]

const SERIES_SEASONS = 2
const EPISODES_PER_SEASON = 6
const ANIME_EPISODES = 12

function summary(title: FixtureTitle): TitleRecord {
  const parsed = parseTitleId(title.id)
  if (!parsed) throw new Error(`Invalid fixture id ${title.id}`)
  const kind = parsed.kind
  const record: TitleRecord = {
    id: title.id,
    kind,
    names: { original: title.original, en: title.en ?? title.original, ru: title.ru },
    year: title.year,
    poster: null,
    backdrop: null,
    genres: title.genres,
    ratings: title.ratings,
    externalIds: {},
  }
  if (kind !== 'game') record.runtime = title.runtime
  if (kind === 'series' || kind === 'anime') {
    record.endYear = title.endYear ?? null
    record.airing = 'ended'
    record.episodes = kind === 'series' ? SERIES_SEASONS * EPISODES_PER_SEASON : ANIME_EPISODES
    if (kind === 'series') record.seasons = SERIES_SEASONS
  }
  switch (parsed.prefix) {
    case 'steam':
      record.externalIds = {
        steam: parsed.value,
        ...(title.prices ? { gog: title.prices.gogId } : {}),
      }
      record.links = [
        { source: 'steam', url: `https://store.steampowered.com/app/${parsed.value}/` },
      ]
      break
    case 'movie':
    case 'series':
      record.externalIds = { imdb: parsed.value }
      record.links = [{ source: 'imdb', url: `https://www.imdb.com/title/${parsed.value}/` }]
      break
    case 'anime':
      record.externalIds = { mal: parsed.value }
      record.links = [{ source: 'shikimori', url: `https://shikimori.io/animes/${parsed.value}` }]
      break
    default:
      break
  }
  return record
}

function detailed(title: FixtureTitle): TitleRecord {
  const record = summary(title)
  return {
    ...record,
    releaseDate: `${title.year}-01-15`,
    descriptions: title.descriptions,
    creators: title.creators,
    ...(record.kind === 'game'
      ? { platforms: ['pc', 'steam-deck'], companies: title.creators }
      : { cast: [] }),
    screenshots: [],
    trailer: null,
    detailed: true,
  }
}

function primaryRating(record: TitleRecord): number {
  const rating = record.ratings[0]
  return rating ? rating.value / rating.max : 0
}

/** Summary records of every fixture title, in chart ("trending") order. */
export const fixtureTitles: readonly TitleRecord[] = TITLES.map(summary)

function chartOrder(kind: Kind, list: ChartList): TitleRecord[] {
  const items = fixtureTitles.filter((item) => item.kind === kind)
  if (list === 'top') return [...items].sort((a, b) => primaryRating(b) - primaryRating(a))
  if (list === 'new')
    return [...items].sort(
      (a, b) => (b.year ?? 0) - (a.year ?? 0) || primaryRating(b) - primaryRating(a),
    )
  return items
}

function airdate(year: number, index: number): string {
  const date = new Date(Date.UTC(year, 0, 7 + index * 7))
  return date.toISOString().slice(0, 10)
}

function fold(value: string) {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

export function createFixtureCatalog(): CatalogService {
  const byId = new Map(TITLES.map((title) => [title.id, title]))
  const pageSize = 30

  return {
    async charts(kind: Kind, list: ChartList, page: number): Promise<ChartPage> {
      const items = chartOrder(kind, list)
      const pageNo = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
      const start = (pageNo - 1) * pageSize
      return structuredClone({
        items: items.slice(start, start + pageSize),
        hasMore: items.length > start + pageSize,
      })
    },

    async search(query: string, kind: Kind | 'all', _ctx: CatalogContext): Promise<SearchResult> {
      const q = query.trim()
      if (q.length < 2) return { items: [], failed: [] }
      const needle = fold(q.slice(0, 100))
      const items = fixtureTitles
        .filter((item) => kind === 'all' || item.kind === kind)
        .filter((item) => recordNames(item).some((name) => fold(name).includes(needle)))
        .map((item, order) => ({ item, order, tier: matchTier(recordNames(item), q) }))
        .sort((a, b) => b.tier - a.tier || a.order - b.order)
        .map((entry) => entry.item)
      return structuredClone({ items, failed: [] })
    },

    async details(id: string): Promise<TitleRecord | null> {
      const title = byId.get(id)
      return title ? detailed(title) : null
    },

    async episodes(id: string): Promise<EpisodeList | null> {
      const title = byId.get(id)
      const kind = title ? parseTitleId(title.id)?.kind : undefined
      if (!title || (kind !== 'series' && kind !== 'anime')) return null
      const seasons = kind === 'series' ? SERIES_SEASONS : 1
      const perSeason = kind === 'series' ? EPISODES_PER_SEASON : ANIME_EPISODES
      return {
        source: kind === 'series' ? 'tvmaze' : 'shikimori',
        ended: true,
        seasons: Array.from({ length: seasons }, (_, s) => ({
          number: s + 1,
          episodes: Array.from({ length: perSeason }, (_, e) => ({
            season: s + 1,
            number: e + 1,
            name: kind === 'series' ? `Episode ${e + 1}` : `Эпизод ${e + 1}`,
            airdate: airdate(title.year + s, e),
            runtime: title.runtime,
          })),
        })),
      }
    },

    async offers(id: string, region: string): Promise<StoreOffer[]> {
      const prices = byId.get(id)?.prices
      if (!prices) return []
      const code = isRegion(region) ? region : 'US'
      const appid = id.slice('steam-'.length)
      const offer = (
        store: 'steam' | 'gog',
        url: string,
        [original, price]: [number, number],
      ): StoreOffer => ({
        store,
        url,
        region: code,
        currency: 'USD',
        price,
        originalPrice: original,
        ...(price < original ? { discountPercent: Math.round((1 - price / original) * 100) } : {}),
        isFree: false,
      })
      return [
        offer('steam', `https://store.steampowered.com/app/${appid}/`, prices.steam),
        offer('gog', `https://www.gog.com/en/game/${prices.gogSlug}`, prices.gog),
      ]
    },
  }
}
