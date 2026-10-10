import { describe, expect, it } from 'vitest'
import { TitleStore } from './titles.ts'
import {
  importSteamLibrary,
  parseGamesPage,
  parseProfileGames,
  steamAppRecord,
} from './steam-import.ts'
import { registerAccount, testApp } from '../test-utils.ts'

const account = { name: 'Дима', email: 'steam@example.com', password: 'correct horse battery' }

describe('steam import', () => {
  it('builds steam title ids with header art', () => {
    expect(steamAppRecord(400, 'Portal')).toMatchObject({
      id: 'steam-400',
      kind: 'game',
      externalIds: { steam: '400' },
    })
  })

  it('parses embedded game data from a public games page', () => {
    const html =
      '<script>var rgGames = [{"appid":400,"name":"Portal","hours_forever":"12.5"},{"appid":620,"name":"Portal 2","hours_forever":""}];</script>'
    expect(parseGamesPage(html)).toEqual([
      { appid: 400, name: 'Portal', playtimeMinutes: 750 },
      { appid: 620, name: 'Portal 2', playtimeMinutes: 0 },
    ])
  })

  it('parses legacy game rows', () => {
    const html =
      '<a href="https://steamcommunity.com/app/400"><div class="gameListRowItemName">Portal</div><div>10.5 hrs on record</div></a>'
    expect(parseGamesPage(html)).toEqual([{ appid: 400, name: 'Portal', playtimeMinutes: 630 }])
  })

  it('finds nothing on a login wall', () => {
    expect(parseGamesPage('<html><body>Sign In</body></html>')).toEqual([])
  })

  it('parses recent games from a profile page', () => {
    const html =
      '<div class="recent_game"><a href="https://steamcommunity.com/app/292030"><img></a>' +
      '<div>165 hrs on record<br></div><div class="game_name"><a class="whiteLink" href="https://steamcommunity.com/app/292030">The Witcher 3</a></div></div>'
    expect(parseProfileGames(html)).toEqual([
      { appid: 292030, name: 'The Witcher 3', playtimeMinutes: 9900 },
    ])
  })

  it('imports owned games as Steam entries', async () => {
    const t = testApp()
    const registered = await registerAccount(t, account)
    const userId = registered.body.user.id as string
    const result = importSteamLibrary(t.db, new TitleStore(t.db), userId, [
      { appid: 400, name: 'Portal', playtimeMinutes: 750 },
      { appid: 620, name: 'Portal 2', playtimeMinutes: 0 },
    ])
    expect(result).toEqual({ total: 2, imported: 2, existing: 0, failed: 0, skipped: 0 })
    const library = await t.request('GET', '/api/library')
    const byId = Object.fromEntries(
      (
        library.body.entries as { titleId: string; status: string; store: string; hours: number }[]
      ).map((e) => [e.titleId, e]),
    )
    expect(byId['steam-400']).toMatchObject({ status: 'in_progress', store: 'steam', hours: 12.5 })
    expect(byId['steam-620']).toMatchObject({ status: 'planned', store: 'steam' })
    // Re-import skips what is already there.
    expect(
      importSteamLibrary(t.db, new TitleStore(t.db), userId, [
        { appid: 400, name: 'Portal', playtimeMinutes: 750 },
      ]),
    ).toEqual({ total: 1, imported: 0, existing: 1, failed: 0, skipped: 1 })
  })
})
