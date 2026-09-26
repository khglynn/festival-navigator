# A — Rooms by time (list view, direction a)

*2026-09-26, ~3–5 AM PT, rendered on v95 (`design-app`, 75ccf2f). Frames are
the production app with this folder's hooks layered on the served bytes; the
app worktree was never edited, no crew link was loaded, every write was
refused (the app's own `POST /api/person` bootstrap, 503'd — see
`rig-report.txt`).*

## The idea in one line

"List" turns every room into the Folsom treatment: each room keeps its own
head and becomes its own list of the same cards in start order under quiet
time bands, and a Portola card says its stage the way a Folsom card says its
venue.

## What it looks like (sheets, phone-readable)

1. `sheet-1-list-phone.png` — today's board vs SAT PORTOLA as a list, and the
   NOW hour with the rings on (clock pinned Sat 4:15 PM).
2. `sheet-2-choices.png` — three readings of a stage on a card, and the
   one-row-per-set density I argue against.
3. `sheet-3-sunday-at-2-phone.png` — the answer to "Sunday at 2": tap the
   2 PM head, a mid-motion frame, pinned, and the jump into SUN FOLSOM.
4. `sheet-4-desktop.png` — 1280: today's board vs the rooms side by side on
   one clock, 2 PM pinned.
5. `sheet-5-whole-rooms.png` — whole rooms top to bottom (SAT PORTOLA, SAT
   AFTERS, SUN FOLSOM, and all of Sunday with 2 PM pinned).
6. `sheet-6-320.png` — the same at 320.

## The choices, argued

### 1. Band granularity: hours, for the festival room only

Measured, not guessed: Portola has ~4 set STARTS an hour, not 12 (Sat 31 sets
over 1:30–11 PM: 4,4,4,4,2,3,4,2,4 per hour; Sun 32 the same shape). So:

- **Hour bands** give 2–4 cards a band, which is one or two rows of two-up
  cards — an hour reads as one block. The official app lands in the same place
  ("2:00PM ·····" over 2:40, 2:45, 2:45, 2:50).
- **Half-hours** would double the heads (~19 a day) over 1–2 cards each: more
  rules than cards, the "rows of dividers" look.
- **Now / next / later** moves under you. It cannot answer a question asked
  on Saturday about Sunday at 2, and NOW already has its jump and ring.

Which ladder a room uses is decided by its SHAPE, not a count (the MODEL-V4
law): the festival room, which publishes a stage grid, reads on **hours**;
every section keeps the **night ladder** v94 shipped (Daytime · Evening · 9 PM
· 10 PM · Late · After-hours), so what friends liked in Folsom is untouched.
The two ladders say the same words where they meet ("9 PM" is 9 PM in both).
Both are fixed boundaries; an empty hour is not drawn.

### 2. Density: two-up, the Folsom card

- It is **the card**: aura, meter, crew corner, zoom, notes, NOW ring, all
  free and all consistent with every other room. One row per set needs a second
  card design (the official app's rows exist to carry photos we don't have).
- It is **half the scroll**: SAT PORTOLA whole day, 390: two-up 4,704px for
  the whole Saturday vs one-up 8,016px (`oneup-sat-now-390.png`). The one-up
  card is a wide box with a short centred name in it — mostly air.
- It **reads across**: two cards side by side in an hour are two things at
  the same time, which is the question a festival list is for.

### 3. How a stage reads on a card (no accent)

Rendered three ways (`stage-full / stage-short / stage-caps`): "Pier Stage",
"Pier", "PIER". **Pick: short, in capitals, tracked** (8.5px/700/.1em, the
card's own sub colour). A Folsom card's place is somewhere in the city
("SVN West"); a Portola card's is a room inside Pier 80, and capitals in the
room-head register say so without a colour. Dropping "Stage" removes the one
word every stage shares. Never `--fest` — a card is not one of its four homes.
Edge case handled: a place that only repeats the name is dropped (Despacio on
the Despacio stage says only its time).

## "Sunday at 2 — Folsom or Portola?" — the time pin

Inside the direction, without breaking its shape.

**Phone.** Every HOUR head becomes a door (a button; the 44px floor comes with
it). Tap **2 PM** in SUN PORTOLA and the whole day answers for that hour in
every room at once:

- what is **on between 2:00 and 3:00 stays lit** — including a set that
  started at 1:30 and runs to 3:10, the one you'd walk into; everything else
  takes the **people filter's own dim** (.28), so no new visual language;
- in each room, the band where 2 PM falls wears the pin: its label in
  `--brand`, a brand line drawn along its rule, and — Folsom's band is a word,
  not an hour — the label says so: **DAYTIME · 2 PM**;
- at the line's end a bare word jumps to the next room's answer: **FOLSOM ↓**
  in Portola, **PORTOLA ↑** in Folsom. No chip, no shape (Kevin's "just − +").
  When the answer is a room's first band, the landing keeps the room head in
  view, so you arrive at "SUN FOLSOM", not an anonymous band.
- tap the head again to let go.

On the real Sunday data the answer is legible at a glance: at 2 PM Portola has
8 sets on (Kaytree picked), Folsom has 6 parties on (the Street Fair, Party On
The Plaza, AIRTIGHT, BOOF — each carrying crew colour). Afters: nothing, so
it is all dim and gets no jump — which is itself the answer.

Word bands (Daytime, Late…) are **not** doors: a word names no hour, so it
can't pin one. You pin from an hour; every room answers.

**Desktop (from 1100).** The rooms stand side by side and share the hours, so
every hour is ONE row across the day: one head line over all the rooms, each
room's cards for that hour in its own column, room heads sticky under the
rail. "Sunday at 2" is read across a row; pinning 2 PM lights that row's
answer in every column. Columns go in the order rooms BEGIN, the festival's
own first (Portola · Folsom · Afters on Sunday), so the daytime rooms sit
together and Afters joins at the right, empty above 10 PM — honest. Width
rule: the festival room 2 columns, each section up to 2, narrowing the one
that asks least until the day fits the 1080 shell (Sunday: 359 · 176 · 359).
Side by side, Folsom reads on hours too (it has to, for rows to line up); on
a phone it keeps its night ladder. The DOM never moves — rooms/lists/bands
become `display: contents` and their pieces are placed on the day's grid —
so a card is still inside its room for the zoom, notes and NOW.

## Motion

- **Board ⇄ List** (the Show menu row): each card travels from its grid cell
  to its list slot (FLIP, transform only, `GROW_MS` 240 / `EASE_ARRIVE`),
  bands staggered by `STAGGER_MS`; band heads fade in and their rules draw
  from the label outward. Going back is `OUT_MS` 130, plain. Not rendered;
  described. Reduce Motion / Low Power: instant.
- **Pin**: the label turns brand (170ms), the brand line draws left to right
  (`GROW_MS`, `EASE_ARRIVE`, scaleX from the label), the jump word slides in
  10px from the right just as the line lands (`CASCADE_MS`, staggered per
  room), the unlit cards step back to .28 (`OUT_MS`, `EASE_LEAVE`). Frame:
  `at2-mid-390.png` at 110ms — line mostly drawn, 3 PM cards half-dimmed, the
  jump word not yet in.
- **Jump**: a smooth scroll to the next room's answer, and the arrival redraws
  that head's line once (so the eye lands on it). Reduced: jump, no draw.
- **Unpin**: dims lift in `OUT_MS`; the line and word leave with them.
- All transforms and opacity; nothing lays the wall out again.

## Found on the way (real edge cases, not nits)

1. **A run's card must not borrow the room's close.** v94's by-time time line
   is start – close, right for Folsom (one party per room, its close IS its
   end) and wrong for Afters: Milli Meng read "~10:30 PM – 3 AM". In list mode
   a run member (`order`) says only its start (patch 4b). Its now window is
   still the stack's (until the next act), so NOW is unchanged.
2. **`[hidden]` loses to `.band-head { display: flex }`** — the desktop's
   one-head-per-hour needed an explicit rule.
3. Despacio on the Despacio stage: the place is dropped when it equals the name.
4. A cancelled grid act (Skepta, Sat) lands in **Time TBA** at the room's end,
   struck and "CANCELLED". Acceptable; a builder could send cancelled acts to
   the band they would have played in, dimmed.
5. The first band pulls 8px up under the room head (two 44px boxes in a row
   read as a gap).

## What the build is (size: L)

The served-byte patches in `patch.mjs` are the build's shape: events.js gets a
per-room ladder (`bandOf` option) and sorts bands by start; wall.js gets five
small hooks (ladder choice, band head as button, grid occurrence, place ≠ name,
run time line, sections → timeGroups, festival room → timeGroups, after-render).
Then: the Show-menu row "Board · List" (persisted per device; share/reload
keeps it, per Kevin's note), the pin module (~150 lines of proto.mjs), the
desktop alignment (~70 lines), CSS (~60 lines), and tests — the ladder and
ordering in node, the pin's lit/dim and the jump in the browser contract with
real touch.

## Risks

- **Pin discoverability.** A band head that is a button looks like a divider;
  nothing says "tap me". Mitigations: the first time List opens, a one-line
  whisper under the first hour ("Tap an hour to see every room then"), or
  pulse the rule once.
- **Pin vs people filter**: both dim with the same value. If both are on,
  a card dimmed for two reasons looks the same as for one. Probably fine
  (both mean "not your answer"); worth one walk.
- **Desktop width**: three rooms need 5 columns; a fourth room (a Thursday
  with more sections) would squeeze to one column each.
- **Afters by time** interleaves rooms of back-to-back runs; a reader who
  follows one room's night loses its order (the stacks show it). The zoom
  still says "Guessing they're 1st of 3".
- The 44px head adds ~10px per band vs v94's Folsom on a phone (SAT day
  4,704px vs board 3,834px at 390).

## Questions for Kevin

1. Pin from the hour heads only (word bands aren't doors) — OK, or should
   tapping "DAYTIME" pin something?
2. "At 2" means **on at any point 2:00–2:59** (catches 1:30–3:10). Or strictly
   "on at 2:00"?
3. Side by side on desktop orders rooms by when they begin (Portola · Folsom ·
   Afters) instead of the file's (Portola · Afters · Folsom). OK?
4. Stage on the card as capitals ("PIER") — or plain "Pier" like a venue?

## How to re-render

`APP=/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/design-app node rig.mjs [only]`
then the `python3 sheet.py …` lines (see the sheets' captions). Files:
`rig.mjs` (server + frames), `patch.mjs` (served-byte hooks, each must match
once), `proto.mjs` / `proto.css` (the prototype), `sheet.py`, `rig-report.txt`
(measurements: bands per room, doors, head heights, now rings, overflow).

## Status

- [x] read the app (wall.js by-time renderer, v3.css, tokens, data)
- [x] proto overlay + rig
- [x] frames (28), each looked at
- [x] sheets (6)
- [x] the argument (bands, density, stage label, Sunday at 2)
