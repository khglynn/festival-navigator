# MODEL v3 — day-first, the layout rule, buckets, back-to-back runs (2026-08-31, §4–§5 rewritten 2026-09-01)

*canvas-v3.html is the picture that started it. BUILT on PR #16 — this doc is
now the spec of record, not a proposal. Supersedes the section-tab structure
of `2026-08-31-events-model.md`; keeps its structured data change.*

*Changed 2026-09-01: §4's deck is removed from the live app (it survives in
commit `c740388` and as a static picture in `gallery.html`), and §5 is
generalised from one re-read room to the ONE RULE for every venue-night.
Kevin's verdict on the preview that caused it is quoted in §4.*

## 1 · Day-first

The day tabs are THE days (THU FRI SAT SUN — the union of grid days and
event nights), never section names. One day renders its rooms in order:

1. **The main grid**, if this day is a grid day (`days[day]`), exactly as
   today.
2. **One section per events section active that day** (AFTERS, FOLSOM …),
   as a quiet sub-rule under the day, each laid out by the rule below.

General landings: a grid-only fest (EDC, Seismic) is unchanged — tabs are
its grid days, no sections render. A pre-party day (Lost Lands WED) is a
tab with no grid and one section. Two-weekend fests (ACL) keep the W1/W2
control orthogonally — day-first changes nothing there.

**Frozen-key law:** artist names and existing day keys are pick/notes data.
Section notes keep their key (notes written on day "Afters" stay keyed
"Afters" — the section's notes chip points there). New day tabs (THU/FRI)
introduce NEW note keys, which is additive and safe. Nothing renames.

## 2 · The layout rule (per section — the data decides, ONCE per fest)

```
timed = events with a time
E = timed.length          V = distinct venues among timed
R = E / V                 T = timed / all events

a day EARNS columns       iff  E >= 5  AND  R >= 1.5  AND  T >= 0.6
SECTION MODE = COLUMNS    iff  ANY day of the section earns them
             = TILES      otherwise
```

**The consistency law (Kevin, 2026-08-31):** the mode is decided per
SECTION per FEST, not per day — "if any days warrant columns, then all
days warrant columns. Otherwise it's confusing to go from Friday and see
stage columns and then to Saturday and see no stage columns." The COLUMN
SET stays each day's own venues — which is also the answer when stages
differ day to day: the mode holds steady across days, the venue heads
change with the day. A columns-mode day whose data is thin just renders a
short timetable (timeless events still land in the TIME TBA row).

Justified against every real file: Portola FRI afters (12 shows · 8
venues, all timed) earns columns → the AFTERS section is columns ALL
week (SAT's thinner night included); Folsom never earns them (R≈1) →
tiles all week; Lost Lands WED (1 venue, no times) → tiles;
single-venue fests never have sections at all. Festival files carry only
`night` + `venue` per event (the round-1 data change); they never
declare a layout.

## 3 · The bucket filter (persists)

*(Round-3 correction — venue-level filtering was overreach. Kevin: "hide
or focus on big buckets when we have them like 'afters' 'folsom' or
'portola'.")*

- One **chip per room the fest has** (PORTOLA · AFTERS · FOLSOM), drawn
  in the people-chip vocabulary on the day view. Toggling a bucket off
  hides that section from EVERY day; a foot-whisper ("Folsom is hidden —
  tap its chip to bring it back") keeps the way back visible.
- Persistence: `fn_buckets_v1_<festId>`, device-local like the weekend
  view — never written to the crew doc.
- Coexistence: stage-solo taps govern the main grid only; the people
  filter dims/hides by picks as today; the bucket filter governs whole
  sections. No interaction terms.

## 4 · The deck — REMOVED 2026-09-01 (kept in the back pocket)

*(Was: in columns mode, 2 simultaneous sets lane-split and 3+ became one
deck — a face card, two ghost edges, a `4 · 10 PM` count pill, growing in
place into a panel of full cards. Built and shipped to the PR #16 preview.)*

**Kevin, on that preview:** *"our implementation of concurrent shows isn't
our clean stacking idea. it's a mix of all 3 ideas scattered around. wtf :("*
One screen — Sunday's afters — showed Public Works as a DECK, The Midway as a
vertical RUN, and The Great Northern and Monarch as side-by-side LANES. Three
treatments for one situation, chosen by thresholds nobody looking at the
screen could see.

He was right, and the cause was upstream of the layout: the deck and the lanes
both said *these sets are simultaneous*, and **that was false about every room
in the file**. §5 below is now the one rule, and it has no thresholds.

**The deck is not erased — it is in the back pocket** (Kevin, 2026-09-01): he
likes the grown PANEL and wants it available *"with a better styled ✕"* in case
vertical runs get tight (four sets in a two-hour window make short cards).

- **The full deck lives in commit `c740388` on `origin/events-ui`**: `js/v3/deck.js`
  (face, ghosts, count pill, the fixed-layer panel, snapshot/restore), its
  `.deck*` block in `assets/v3.css`, its wiring in `wall.js`/`app.js`, its
  states in `gallery.html`, and its tests. That is the commit to revive it from.
- **The picture stays visible** in `gallery.html`'s "THE BACK POCKET" section:
  a STATIC panel — real `renderCard` cards, no deck code — with the title row
  and a ✕ built from the app's own `.sheet-close`. It renders from a fixture,
  so it cannot rot into a second live path.
- If it ever comes back it is a **presentation of a run**, not a competing
  model: the room is still one sequence, the panel is just how a cramped
  sequence is read.

Lanes are gone from event sections too, for the same reason. **The main
festival grid keeps its lanes** — real stages with real, sourced set times do
genuinely overlap, and nothing here touches `computeLanes` or the Pier 80
timetable.

## 5 · The one rule: a venue-night is one room (2026-09-01)

**In an events section (Afters, Folsom — anything rendered as venue columns),
a venue-night is ONE ROOM, and artists at one room play IN SEQUENCE.** So
every cluster of sets that share a venue on a night renders as a plain
vertical run in the time bands — stacked, each its own tappable card, top to
bottom in play order. Never side-by-side lanes, never a deck, never a combined
card. Artist separation is law: a combined card would eat the crew's picks.

**Why the data says so.** Kevin's read of the portola-week source (2026-08-31)
found the Midway's "four 10 PM shows" were one night played back to back — the
page prints DOORS, not set times. On 2026-09-01 we checked the other eleven:
**every one of the twelve multi-artist venue-nights in
`data/festivals/portola-2026.json` listed all of its artists at the same
time**, and in five of them that "time" was the room's whole window
(`"10 PM - 2 AM"`). There was never a simultaneous pair in the file. A rule
that branches on concurrency was branching on a transcription artefact.

**Data per room** (the migration writes it; nothing is inferred at render
time):

- `doors`, and `close` where a page prints one (`closeApprox: true` when the
  close is ours). Where no page prints an end, the room has **no** `close` —
  the zoom then says `Doors 10 PM` rather than inventing a window. We do not
  manufacture closing times to make columns tidy.
- Per set: a guessed `time` with `approx: true`, and
  `order: { seq, of, source (url), confirmed }`.
- **Guessed times** lie across the window: evenly from doors to close where
  the close is known, an hour apart from doors where it is not, rounded to the
  half hour. (`runTimes()` in `scripts/migrate-portola-events.mjs` — the rule
  is code, and it reproduces the Midway's settled 10/11/12/1 exactly.)
- **Running order** follows the billing: the billed headliner closes and the
  rest run in descending print, so a bill read top to bottom is the run read
  bottom to top. Where a room's page could not be re-read, the first-listed
  name in `artists[]` closes and the rest reverse ahead of it — entered at low
  confidence, `confirmed: false`, pointed at the programme page.
- A venue-night with **no time at all** is not a run. It stays timeless and
  the wall tiles it under TIME TBA (Portola: Sat Public Works, Sat Audio).

**Layout.** Sets sort by `order.seq` when every set in the room carries one,
else by start time then file order. A set ends where the next in the room
begins; the last ends at the room's `close` when known, else an hour after it
starts. Placement then walks down the column — each card starts at its own
time or where the one above it ended, whichever is later, and is at least 30
minutes tall. That last clause is what carries a room nobody has re-read yet:
four sets all stamped with the doors time stack four-high instead of landing
on top of each other, so the rule degrades to something readable instead of
something broken.

**The validator tells the next data drop.** An events venue-night with two or
more timed sets and no `order` is a WARNING in
`api/_lib/festival-rules.mjs` — naming the shared start when they share one,
because that is a doors time somebody transcribed into the set-time field.
The renderer never has to invent lanes again; the data is asked to say who is
on when.

**The mark (LOCKED, Kevin 2026-09-01):** the resting card renders the guessed
time with a tilde (`~12 AM`) plus ONE section-level whisper
(`~ marks a guessed set time — the order is the plan`, no terminal period).
Never per-card explanations. The zoom tells the whole truth in one `.f-sub`
holding two lines — `Sun · Runs 10 PM – ~2 AM` (the venue's real window, so no
invented clock in the zoom) then `Guessing they’re 3rd of 4` as a DOOR to the
poster or ticket page, the way a venue is a door to its map. Once the venue
posts the order the word goes and the door stays: `3rd of 4`.

**Build notes:**

- When the CLOSE is our guess too (`closeApprox: true`), the window line wears
  the tilde on the close: `Sun · Runs 10 PM – ~2 AM`. A sourced close reads
  `Runs 10 PM – 2 AM`. A room with no close at all reads `Doors 10 PM`.
- The apostrophe in `Guessing they’re 3rd of 4` is typographic (’), like
  the app's other copy.
- The tilde travels with `approx` on every surface a time prints on — the
  tile, the cell, a search result, a flat sort — and the whisper follows it.

## 6 · Build sizing (honest)

M+, one PR after data migration: restructure Portola's 45 events to
`night`/`venue` (script) + validator rule; `extraSectionsOf` → day-first
composition in wall.js; the tiles renderer is renderLineupGroup minus day
grouping; columns reuses the timetable renderer with venues as stages; the
deck is new (cell + grown panel, sharing the zoom's motion constants);
filter chip + popover + persistence + whisper; day-tab derivation.
Riskiest edge: one sticky stage strip per day when multiple column
sections coexist on a grid day — the strip must scope to its own scroller
(the Sat frame shows it working statically).
