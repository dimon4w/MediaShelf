# MediaDeck — design

Strict black and white, in the spirit of Apple and ChatGPT. The layout follows Hoplite: a sidebar with the content in an inset rounded panel. Colour comes only from posters and backdrops, never from UI chrome. Error red is the single semantic exception.

## References

- Vercel Geist — [colors](https://vercel.com/geist/colors), [materials](https://vercel.com/geist/materials), [guidelines](https://vercel.com/design/guidelines): grey scale, radii, focus rings.
- ChatGPT on [Refero](https://styles.refero.design/style/52a007ed-ad1b-46a6-bd44-b76f91df6d0c) and [Mobbin](https://mobbin.com/explore/screens/676c84f0-d096-4f29-8d7f-e5f0184baa10): no colour, hairlines instead of shadows, centred prompt box on Home.
- Apple TV ([redesign notes](https://www.apple.com/newsroom/2025/06/apple-tv-brings-a-beautiful-redesign-and-enhanced-home-entertainment-experience/), [Mobbin](https://mobbin.com/explore/screens/ccb3a50b-bc51-4196-afd0-1fd7f8779754)): tall posters, backdrop hero, glass only on controls.
- Linear: [Refero](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1) (stacked near-blacks, tight display tracking) and its [status board](https://mobbin.com/explore/screens/423b83f6-5340-41cd-a537-dd39a0d56ced).
- Letterboxd [year in review](https://letterboxd.com/year-in-review/) for stats; the [60fps slot reel](https://60fps.design/shots/stompers-pack-tear-and-pick-interaction) for Shuffle.

## Tokens (`src/styles/index.css`)

| Role                    | Dark                   | Light                 |
| ----------------------- | ---------------------- | --------------------- |
| Page + sidebar          | `#0a0a0a`              | `#f5f5f5`             |
| Content panel           | `#141414`              | `#ffffff`             |
| Raised (cards, inputs)  | `#1c1c1c`              | `#f4f4f4`             |
| Floating (menus)        | `#1f1f1f`              | `#ffffff`             |
| Text primary            | `#ededed`              | `#171717`             |
| Text secondary/tertiary | `#a1a1a1` / `#8f8f8f`  | `#4d4d4d` / `#737373` |
| Hairline                | white 9%               | black 9%              |
| Primary button          | `#ededed` on `#0a0a0a` | `#171717` on white    |

- **Type:** Inter Variable with optical sizes, plus Geist Mono for keyboard hints. Base size 14/20. Display sizes use −0.022em tracking at weight 650. Numbers use `tabular-nums`.
- **Radii:** 6 (chips), 8 (buttons, inputs, posters), 12 (cards, menus, dialogs), 16 (panel, hero).
- **Motion:**
  - Ease-out `cubic-bezier(.23,1,.32,1)`.
  - 150–250 ms for UI, springs with no bounce.
  - The Shuffle reel decelerates over 2.6 s.
  - Everything respects reduced motion.
- **Blur:** only on the sticky title bar after scrolling and on the mobile tab bar.
- **Status glyphs**, distinguished by shape rather than colour:
  - dashed ring — planned
  - half-filled — in progress
  - pause bars — paused
  - filled check — completed
  - dash — dropped

## Layout

- **Desktop:**
  - Sidebar, 248 px (collapsible to 64): brand, search (Ctrl K), a primary "Add" button, navigation, "Continue" mini-cards, account menu.
  - Content sits in a rounded panel inset 8 px, with a sticky title bar.
- **Mobile:**
  - Compact title bar with search and avatar.
  - Bottom tab bar: Home, Discover, Library, Shuffle, Stats.
- **Title hero:** always rendered in the dark palette (`.dark` scope) over the backdrop, so white text and buttons stay legible in both themes.
