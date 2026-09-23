# Your meter on the card — build log (2026-09-23)

Branch `feat/meter`, based on `integrate/prefest-0923`. The running log of
the build; the newest entry is at the bottom.

## The ask

A friend (via Kevin): "I want to scroll through my picks and see what I
rated them, to decide if I want to go up or down." Until now your level
lived only in the aura's brightness and in the crew corner (a tick for a
pick, a letter for a must), where a busy card could fold you into "+n" and
you vanished from your own pick.

Kevin picked the meter from the rating canvas (round 2, direction 2, the
left placement; its canvas name is never shown in the app):

1. A chip in the lower-left corner on every card you picked, drawn on the
   Spotify pill's pattern: three bars, lit one per level (1, 2, 3); at 4 the
   word MUST in the display face. Your colour, your white edge. Never
   `--brand` (it read as a second notes chip beside the violet notes pill)
   and never `--fest`.
2. The crew corner shows everyone else only, so its "+n" counts others.
3. It fits the smallest card and a crowded card at phone width, and when a
   card runs out of room, things give way in a defined order.
4. How it works teaches it (rows 3 and 4, Kevin's voice).
5. A screen reader hears your level once.

Reference (a prototype, not production code): the round-2 canvas's
`mineChip('loud')` and its `.mine-chip` / `.bars` rules.

## Log

- Read CLAUDE.md, NOW.md, aura.js, palette.js, motion.js, wall.js
  renderCard/refreshCard, card-facts.js factsFor, settings.js How it works,
  v3.css corners and the 44px floor, gallery.html, the canvas notes and
  reference. Baseline: `npm test` 693 pass / 1 skip; `npm run test:browser`
  26 pass.
- Built the chip (`5d69aa0`): aura.js `meterOf` + `aboutCorner({ you })` put
  YOUR meter first in the about corner; `whoCorner` filters you out, so its
  "+n" is other people. wall.js `meterChip` draws it (a span, aria-hidden —
  the card's label already says your level: "Robyn — must, picked by 6
  others"). Colour: your hue at .5, white edge (`strokeOf(ci, true)`).
- Measured every corner piece in Chromium (Inter 800 / Anton):

  | piece | card | cell |
  |---|---|---|
  | meter (bars) | 24.5 | 22.5 |
  | MUST (Anton 8.5 / 8, .05em, pad 5 / 4) | 31.4 | 28.2 |
  | notes / Spotify chip, empty | 14 | 12 |
  | Inter 800 digits, em | 0 .692 · 1 .441 · 2 .638 · 3 .657 · 4 .689 · 5 .634 · 6 .663 · 7 .606 · 8 .665 · 9 .663 · + .686 | |
  | followed flag | +7 (+3 beside a count) | |
  | must mark / tick | 26 / 6 (+3 margin) | same |
  | ghost | 10 + text at 7.5px | same |

  A crowded card (your MUST, a notes count, a followed Spotify pill with a
  count, two musts, two ticks, +n) needs ~210px; a 390 phone's column is 178.
- The give-way order (aura.js `GIVE_WAY`, least lost first): Spotify count ·
  ticks fold into +n · Spotify pill · musts fold · the +n · notes · (cells)
  the start time · (cells, only when the NAME runs into the band) your
  meter. A ResizeObserver fits each card after layout, before paint; ~1 ms
  for Portola's 134 cards (timed in Chromium). refreshCard fits the fresh
  node to the old one's width before it lands.
- Found in the gallery at 44px: a 30-minute cell's start time sits down in
  the corners' band, and a lane's two-line name does too. The fit now
  measures that centred text (`bandText`) and keeps each corner to its own
  side of it — which also fixes the crew corner landing on the time, a
  collision that predates the meter. Real data: Portola has one 30-minute
  set (JT, Sun), ACL 2026 four in two lanes (both-weekends view only), no
  fest has three lanes.
- Motion (`meterMoves`, from refreshCard): 0 → 1 the chip grows out of the
  corner a beat after its neighbours start making room; each tap lights the
  next bar from the baseline; 3 → 4 the chip widens and MUST rises in; 4 → 0
  the neighbours close the gap, quick and plain. Transform and opacity only;
  canAnimate gates it (Low Power, reduced motion = instant). A slowed
  filmstrip showed the pill still over the growing chip on 0 → 1, hence the
  beat (`952edaf`).
- How it works (`6726e93`), Kevin's rows adjusted as little as the change
  needs, drawn with the real meter and crew marks:
  3. **Tap an artist to add your color.** Your bars fill each tap. 4 taps = must see.
  4. **Everyone else's picks land on the card.** Ticks are picks; a letter is a must.
  ("White stroke = you." left row 4: the corner never carries you now. The
  white edge is on your meter, which is alone on the left.)
- Gallery (`fbd956c`): 17 the meter at every level; 18 a crowd of seven at
  176 / 150 / 120, a 44px cell, lanes, a two-line name. The static V3
  section draws the real meter and marks.
- Tests: `tests/v3-aura.test.mjs` (the data and the order),
  `tests/meter.test.mjs` (real clicks, the fit in the DOM, the motion and
  its kill switches), `tests/browser/meter-contract.test.mjs` (every card at
  390 / 320 / 1280 with a made-up crew of seven: corners never touch, wrap,
  leave the card or sit on a time or a name; the meter matches the Spotify
  pill; real taps animate with transform/opacity only; Reduce Motion
  doesn't). Mutation-checked: with the fit off, or the band measurement off,
  it goes red. `tests/strip-follow.test.mjs`'s observer stub learned
  `unobserve` and not to count the card observer.
- Not done here, on purpose: the service-worker stamp (the integrator
  re-stamps with `scripts/sw-stamp.mjs --keep`); the zoom riffs Kevin asked
  for alongside this (the canvas session's round 3).
