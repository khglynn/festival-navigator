# v91 — the phone afters line up, and search ignores accents (build log)

Started 2026-09-25 ~6:40 PM PT. Branch `live/v91`, worktree
`.claude/worktrees/v91` (off origin/main 6687289, v90 live).
Builder: an Opus teammate. Orchestrator: the Portola live-ops session.
v90's build log (`v90-BUILD.md` beside this file) is the context: read it
first, especially item 1 and "For you to decide".

## Why

Kevin is at Portola; friends use the app at night, mostly for the afters.
v90 lined the stacks up with the timetable on desktop, but on a phone the
afters still start at the shell's edge while the timetable's columns start
past the 40px hour rail — the case Kevin actually sees. His words, about
exactly this: "just adding a little bit of extra padding that obviously
scrolls away if you left scroll … if there is a timeline item in the stack."
So the answer he described is a sideways scroller: the stacks under a clock
start where the timetable's columns start, and that lead space scrolls away
when you swipe, the way the timetable itself behaves.

## The two items

1. **The phone afters line up with the timetable.** On a clock day at phone
   widths, the day's other rooms (afters, Folsom, Late nights — the stacks
   v90 tagged `data-clock`) start at the same x as the timetable's first
   column and keep their full `--col-w` card width; the block scrolls
   sideways when it is wider than the shell, with the lead gutter scrolling
   away. At rest it should look like the timetable above it (the right-hand
   column may run off the edge, as the timetable's does). Decide the unit
   that scrolls (one scroller per day's stacks is the likely answer; say why
   if not). Laws that bind this (CLAUDE.md): `--col-w` is the one card width;
   anything that mirrors or restores scroll positions must not grab this new
   scroller by accident (see `isStripScroller` and the day-to-day scroll
   code); the sticky stage strip is a follower of the timetable only; the
   zoom must still open over a card inside the new scroller at the screen's
   edge and after a sideways scroll; motion stays transform/opacity. Check
   320, 390 and 430 wide, a day with one afters room, a day with three,
   a day whose stacks fit without scrolling, and a day with no timetable
   (unchanged). If a horizontal scroller nested in the vertical page makes
   vertical swiping feel sticky on touch, say so with evidence.
2. **Search ignores accents.** Typing "mull" finds "MÜLL", "chloe" finds
   "Chloé Caillet", and the reverse. Fold diacritics on both sides of the
   match only (never change stored names — they are pick keys). Cover it with
   a unit test using real names from the Portola file.

## How to work

Same rules as v90: work only in this worktree; commit and push as you go on
`live/v91` (a branch push is a preview only); no PR, merge or stamp; no
crew-data, sync, merge, artist-name or update-machinery changes; never load
production with a crew link or write to the production database; one test
suite and one browser at a time. Real-browser checks of the new scroller with
real touch input at 390 (the builder's walk rig from v90 is in this folder),
screenshots before/after into `claude-plans/2026-09-25-portola-live/v91-shots/`
(git-ignored). Targeted tests while working, one full `npm test` at the end
(the stamp test will fail until the orchestrator stamps).

## Log

(builder writes here)

### Item 2 — search ignores accents

**What was wrong.** There were two searches. A lineup fest's
(`applyFilter`) already folded diacritics; a scheduled fest's — Portola's,
every fest with set times — matched `name.toLowerCase().includes(q)`, so
"mull" never found MÜLL and "chloe" never found Chloé Caillet.

**What changed.** `js/v3/wall.js` "search / sort / weekend": one
`searchFold` (lowercase, NFD, drop the combining marks, then the letters NFD
leaves whole — ø ł đ ð ħ ı ß æ œ þ — and a curly ’ to ', which iOS Smart
Punctuation types) and one `searchMatches(name, query)` that folds BOTH
sides. `applyFilter` and the scheduled search's `wanted` both call it. Stored
names are never touched; the card still carries the file's exact bytes.

**Checked.** `tests/search-fold.test.mjs` (7) with Portola's real names:
"mull"/"MÜLL" → Friday MÜLL (and the tab list is just Friday); "chloe" /
"Chloé" → both Chloé Caillet cards (Saturday grid + Public Works afters);
"tiesto", "adela"; "ovérmono" finds the plain Overmono (the reverse); the
file is byte-identical after searching; CØNTRA / Łaszewo / Høldën fold. The
three render tests fail against the old `wanted` line (checked by
reverting it). Neighbouring suites green (104).

**Not done, on purpose.** Stylised names (¥ØU$UK€ ¥UK1MAT$U, half•alive,
"Me n ü") still need their own punctuation typed; folding $→s or ignoring
spaces is a different kind of forgiveness and a product call.

### Item 1 — the phone afters line up with the timetable

**The shape I chose, and why.** Every clocked stack row (v90's
`data-clock`: SAT/SUN AFTERS and FOLSOM, and the clock's own leftovers like
Skepta's Crane Stage) sits in its own sideways scroller on a phone. The
hour rail's 40px is lead space inside it, the columns keep full `--col-w`,
and the room still WRAPS TWO ACROSS. So at rest SAT AFTERS' columns sit
exactly under the timetable's first two columns, the right one runs off the
edge exactly as the timetable's does, and a swipe carries the lead away —
38px at every phone width (rail 40 + clock gap 4 − shell gap 6), after which
both columns are whole, as they were before v90. That is Kevin's own
description ("a little bit of extra padding that obviously scrolls away").

The alternative — each room as ONE long row of venues, like the
timetable's stages — I rejected: Portola's Saturday afters has 6 venues and
Sunday's 7, so venues 3–7 would sit off-screen behind a swipe each, the
room would stop reading top to bottom, and "what a room is" would change
under people mid-festival. The wrap keeps browsing exactly as it was.

**The unit that scrolls:** one scroller per room on a day (each
`.venue-grid[data-clock]`), not per day. A room's head sits between two
rooms and is a door (notes); putting a day's rooms in one scroller would
either scroll the heads away or split them out. Rows do not mirror each
other: swiping SAT AFTERS leaves SAT FOLSOM where it was (see calls).

**What changed.**
- `js/v3/wall.js` `venueGroups` — a clocked grid is wrapped in
  `.stack-scroll` and stamped `data-venues`; unclocked grids are untouched.
  `stackRowKey` + `harvestEphemera`/`restoreEphemera` keep each row's own
  sideways position through a repaint (a crew-mate's pick arriving).
- `assets/v3.css` — one `@media (max-width: 719.98px)` block: the row
  scrolls x (`overflow-y: hidden`), the grid is `max-content` wide,
  `repeat(2, var(--col-w))` (one column when `data-venues="1"`), rail as
  `padding-inline-start`, clock gap. `padding-block: 8px; margin-block: -8px`
  gives a NOW card's glow room at the row's bottom edge without moving
  anything. From 720 up the wrapper is an ordinary box: v90's desktop
  lining-up is unchanged.
- `assets/v3-tokens.css` — the `--col-w` comment mentions the row.
- Laws kept: `--col-w` is the only card width; the row is NOT a
  `.times-scroll`, so the mirror (`wireTimesScrollSync`), the resize
  re-mirror in app.js, the NOW jump's grid framing and the timetable
  restore never touch it; the strip still follows only its timetable; no
  motion added (native scrolling only).

**Checked.**
- Geometry (`v91-walk.mjs before|after 320 390 430`, reports in
  `v91-shots/before-walk.txt` / `after-walk.txt`): at 320/390/430 every
  clocked row's columns land at the timetable's columns (54/201, 54/236,
  54/256; before: 14/163, 14/198, 14/218); rows with 2+ venues scroll 38px,
  the one-venue Crane Stage row scrolls 0; Thursday/Friday unchanged
  (14/…, no scroller); no page overflow.
- Real touch at 390 in Chromium (CDP touch events, `v91-walk.mjs touch`,
  `v91-shots/touch-walk.txt`): a sideways swipe on SAT AFTERS → row 38,
  page / timetables / strip / SAT FOLSOM unmoved. Vertical swipes STARTED
  ON A STACK CARD — straight, a thumb's drift (dx −14), ~17° and ~27°
  diagonals — all moved the page 250–350px and the row 0px, the same as
  the same gestures on the timetable (the baseline, same construct since
  v3). Not sticky in Chromium. A timetable swipe mirrors Sat→Sun and moves
  the strip, and leaves the swiped afters row at 38; a resize keeps it; a
  remote repaint (Nhu's pick arriving through the poll) keeps it at 38 on
  the new node.
- Zoom (touch hold): over Chloé Caillet's afters card at rest, which runs
  off the screen (x 236–414), the zoom opens on screen (166–382); after the
  swipe, same card, on screen. `touch-2-zoom-edge-at-rest.png`,
  `touch-4-zoom-after-swipe.png`.
- NOW (Sat 11:55 PM PT, `v91-walk.mjs now`): rings render in both columns;
  the Folsom card nearest a row's bottom edge ends 8px inside the row's box,
  so its glow is not clipped; the NOW tab lands on SAT AFTERS as before.
  `now-390-after-tap.png`.
- WebKit (Playwright's, geometry only — it has no touch-gesture driver):
  same columns and 38px at 390; `webkit-390-sat-afters-rest.png`.
- Tests: `tests/clock-stacks.test.mjs` +3 (the row's shape and count, never
  a `.times-scroll`; a repaint keeps each row's own position and the
  timetable's mirror never reaches it; the CSS); the restore test fails with
  the restore removed. New browser contract `tests/browser/stack-row.test.mjs`
  (6): columns under the clock at 320/390/430 and in WebKit at 390, 38px
  lead, one venue never scrolls, unclocked nights untouched, desktop inert,
  and the touch walk's swipe/zoom/vertical checks.

**Before / after shots** (`v91-shots/`): `before-390-sat-afters.png` →
`after-390-sat-afters.png` (also 320, 430; `*-sun-folsom`, `*-sat-crane`,
`*-390-fri-afters` for the unchanged night); `touch-1-rest`, `touch-3-swiped`.

**Calls for the orchestrator / Kevin.**
1. The visible cost at rest is the timetable's: the right column shows 140
   of 178px at 390 (105 of 143 at 320). Centred names longer than ~120px
   touch the edge ("Airwolf Paradise", `now-390-after-tap.png`) and the crew
   corner of a right-hand card is off-screen until the swipe.
2. Rows are independent: swipe SAT AFTERS and SAT FOLSOM below it still has
   its lead. Mirroring every row on a day (or the page) is a small follow-up
   if Kevin wants "swipe once, all padding gone".
3. Fully swiped, the first column sits at x=16, 2px right of the room head
   (the clock's 4px gap vs the shell's 6px). Invisible at arm's length; not
   worth a second number.
4. Evidence limit: gesture routing was checked in Chromium, not on an
   iPhone. The row is the same construct as the timetable (an `overflow-x`
   box with no vertical overflow inside the page), which Kevin already
   swipes on his iPhone every day; if a vertical swipe on the afters ever
   feels sticky on his phone, the timetable would too.
5. The NOW jump does not slide a stack row to frame a NOW card in the right
   column (the grid gets that); at rest such a card is ≥79% on screen.
