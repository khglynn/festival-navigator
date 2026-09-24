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
  set (JT, Sun), ACL 2026 none reachable (correction 2026-09-24: v86 renders each ACL
  weekend as its own dated day, so no lane-split cells exist in any
  shipped fest — the both-weekends grid is not reachable), no fest has
  three lanes.
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

## Review round (same day): an adversarial review and a real-browser walk

Seven findings came back. Each was checked in the code and a real browser
before anything changed; one was the walker's own note about its rig.

1. **How it works drew Kat in two colours** (confirmed, fixed `a87f416`).
   Row 4's K used BOARD[2], magenta, one row under row 1's teal Kat chip.
   Now BOARD[6], which is the chip's own `hsla(172,90%,62%)`. A test reads
   both values out of settings.js. The copy is unchanged (below).
2. **Your chip on a cancelled card was decided nowhere** (confirmed; the
   behaviour stays, now on record, `17ddcd4`). Your MUST sits above the gray
   scrim beside the crew's marks, because `.corner-about` is z-index 1 like
   `.corner-who`. The card still reads cancelled, and its label says
   "(cancelled) — must". Gallery 12b now carries your MUST. The jsdom suite
   renders a cancelled card with your pick, and the browser contract picks
   Skepta on Portola's real Saturday. (The events-wall section of the
   gallery already had one such card, "No Show" at your level 3, so the
   finding's "lives nowhere" was half right.)
3. **The motion's two missing frames** (confirmed, fixed `f440c29`).
   3 → 4: the word waited 2 × STAGGER_MS behind the widening, so the chip
   showed as an empty coloured pill for four or five frames. The word now
   rises with the widening; one frame at t = 0 is the start of any fade-in.
   4 → 0: the chip just vanished. It now leaves as a copy drawn where it
   stood (outside `.corner-about` and without a `data-kind`, so no corner
   query sees it). The copy collapses into the corner's edge in lockstep
   with the neighbours closing the gap: the same OUT_MS and the same
   EASE_SURFACE, all the way to `scale(0)`. My first attempt, an ease-in
   to `.4`, failed its own filmstrip: at 40ms the incoming notes pill sat
   over a nearly whole MUST. Low Power and Reduce Motion still land at once.
   The filmstrip is in the scratchpad (`meter-shots/final-phone-meter-motion-filmstrip.png`).
4. **WebKit zoomed the wrong card** (confirmed, and worse than reported;
   fixed `9444d23`). Logged live in Playwright's WebKit, a touch tap on a
   card is followed by a click with pointerType "mouse". When the pick's
   refreshCard swaps a fresh card in under the lift point, trusted
   mouse-type pointerover and pointerenter events fire at that spot. Hover
   intent believed them. So one plain tap picked the card and then grew it,
   200ms later, as a mouse zoom that a phone can never hover out of. If a
   different card scrolled under the spot, that card grew instead: the
   walker's "wrong card". (The walker's own repro also pressed an
   off-screen card synthetically, at x = −310, which no finger can do. The
   bug does not need that.) WebKit's tracker records the same family on
   iOS 26 (bug 214609, comment 6, 2026-01-26); Chromium sends none of it.
   card-facts.js `touchAt` now remembers where fingers recently landed and
   lifted. Mouse events at those spots arm nothing, and the born-under check
   stands down. A mouse that moves off those spots, or presses, is treated as
   a hand again at once. If the ghost entered a card, the first real move
   over it counts as the hand's entry. A desktop never meets the rule.
   Tests: `tests/zoom-touch-ghost.test.mjs` (10) and
   `tests/browser/touch-ghost-contract.test.mjs`. That contract has Chromium
   drive the ghost through the real input layer, and WebKit (when
   installed; CI has only Chromium) reproduce it from a bare tap. Both
   browser tests go red with the guard removed. The walker's repro now
   zooms the card it held 5 times out of 5; before the fix it was wrong
   3 times out of 3 on this machine. Screens:
   `meter-shots/fix-webkit-one-tap-before-after.png`. Not proven on a real
   iPhone. The guard does nothing where no ghost exists, so it is safe
   either way.
5. **The zoom shows no level for 1–3** (confirmed; not built here, on
   purpose). How the zoom shows everyone's level is the canvas session's
   round 3 ("0 today · 1 meters on the pills · 2 tiers · 3 the room ·
   4 the desk"), which Kevin asked to see and has not picked from. Putting
   `meterChip` into `whoPills` would ship riff 1 by default. It is ready
   the moment he says so. This is not a regression: the zoom never showed
   levels 1–3.
6. **A 30-minute set in half a column loses its start time once you pick
   it** (confirmed; Kevin's call; unchanged). The geometry makes any pick
   trigger it: 2 × (5 + 22.5) + ~36 + 8 = 99 > 84. With the time forced
   visible, MUST covers the bottom of the "7". Portola has no such cell,
   because JT is a full column wide, and ACL renders no lane cells at all
   (correction 2026-09-24; the both-weekends view is not reachable in v86).
7. **The walker's first Groove Armada check measured the grid card, not
   the SAT AFTERS one** (the walker's own note; no product change). Its
   re-run on the real afters card passed in both engines.

Found along the way: `tests/browser/heads-contract.test.mjs`, "the day-of
open on an ACL night between the weekends", failed when the machine was
under load (load average 18–36 this afternoon). It failed the same way on
this branch's untouched base, `6783b78`, and passed there with a 3s settle
instead of 800ms. That makes it timing, not code. `83fb92e` waits for the
lit tab instead of sleeping: one line, in a hunk the integration branch does
not touch.

How it works, rows 3 and 4 (copy unchanged this round):
3. **Tap an artist to add your color.** Your bars fill each tap. 4 taps = must see.
4. **Everyone else's picks land on the card.** Ticks are picks; a letter is a must.

After this round: `npm test` has 720 tests: 718 pass, 1 is skipped, and 1
fails, the service-worker stamp (red by design; the integrator re-stamps).
`npm run test:browser` passes all 34.

## The Linux fit (2026-09-23, evening; branch `fix/linux-fit`)

CI's browser job (ubuntu Chromium, run 35925624533) failed three tests that
pass on a Mac:

1. **The meter contract at 1280: "Robyn: corners 1.4px apart at 176px (fit
   2)".** The fit picked its give-way step from the width table measured on
   macOS Chromium; Linux draws the corners' Inter and type about 5px wider on
   Robyn, so the step the table chose left them crowding. Real phones will
   differ the same way. Fixed in the app: the table is now the first guess,
   and the ResizeObserver reads back each card's two corners as drawn
   (against the card and a cell's band text) and gives way one more step
   wherever they sit closer than CLEAR — reads batched, then writes, a pass
   per step at most, no observer loop (the corners are absolute). A late
   font refits every card (fonts.ready + `loadingdone`). 0.8 ms per fit on
   Portola's 134 cards including the read-back. New: `tests/fit-measured.test.mjs`
   (jsdom plays the engine) and the contract's "any engine" run with every
   corner glyph 1.3px wider — red on the old fit, green on this one.
2. **The hover contract's two list[4] / list[5] tests: "reading 'x' of
   undefined".** `cards()` dropped the ladder's first line (the ladder sat at
   the very top, inside the 60px margin) and kept six cards on a Mac; the
   meter's gallery rows and Linux's taller text pushed the names row off the
   bottom, leaving four. Now the rows are brought to 80px from the top before
   reading (eleven cards on screen) and each test takes the first unused card
   that fits what it needs — not at MUST where a click must land a pick; for
   Tab, a card whose next tabbable element is the next card.
