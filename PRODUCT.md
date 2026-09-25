# MediaShelf — product

<!-- impeccable:product-schema 1 -->

## Platform

web (desktop, mobile, installable PWA shell)

## Users

People who track what they watch and play: movies, series, anime and games. The main flows are finding a title, saving it with a status, tracking progress (episodes or playthroughs), rating it and, when undecided, letting Shuffle pick. The owner self-hosts it on a laptop and may publish it later.

## Product principles

- Personal records come first. External catalogs only supply metadata and never block the library.
- Every action is instant (optimistic) and reversible where it matters (status undo toast).
- One status per title. Movies are planned or watched. Series move automatically on episode marks.
- Russian first, English complete. Titles and descriptions are localised when the source allows.
- Keyboard, touch, reduced motion and both themes are first-class.

## Capabilities

- Accounts: registration, sign-in, sessions, password change, export/import, deletion.
- Catalog: charts (trending, all-time, new), search (including Cyrillic), title details, episodes, prices.
- Library: statuses, ratings, favourites, notes, dates, episode marks and notes, game playthroughs.
- Views: grid, list, drag-and-drop board. Shuffle. Stats. Command palette.

## Constraints

- No API keys. Sources: Steam, GOG, IMDb suggestions, Cinemeta, TVmaze, Shikimori, AniList, Jikan, Wikidata, Wikipedia.
- Runs with Node.js 24 on Windows without native modules (node:sqlite, scrypt from node:crypto).
