# MODEL-V4 — the wall, simplified (spec of record, 2026-09-16)

**Status:** proposed 2026-09-16, awaiting Kevin's pick on the canvas
(https://claude.ai/artifact/NELYG7pzVaS5dUKznoCSUD — "The Wall, Simplified";
direction A is this spec, B is today's build, C is a flat list).
**Supersedes** MODEL-V3 §2 (the layout rule), §3 (the bucket filter) and §4
(the deck); **keeps** §1 (day-first) and §5 (the one rule: a venue-night is
one room, artists play in sequence) with the changes below.
**Grounding:** the wall audit and Kevin's words are in the session's
`design/grounding.md` (scratchpad, 2026-09-16); the short version is §0.

## 0. Why

The wall runs three layout engines that share one card — the classic
scheduled wall, the day-first composition, the lineup wall — and a festival
gets whichever one a data threshold picks (`earnsColumns`, `dayFirstModelFor`,
`scheduled`). Nobody looking at the screen can see the predicate, so Portola
and ACL take different branches and one Sunday showed three treatments of one
situation. Five view controls in four places were added and none retired.
Notes gained five doors. Kevin, 2026-09-16: "we let time grid be the enemy of
sensible organisation… I'm open to real big changes."

A clock earns its complexity only where "can I do both?" is a real question:
a single site with several stages. Afters are sixteen doors across a city and
almost everything starts at 8 or 10 PM — you pick one door and stay. So:

## 1. Two presentations, one rule

**Stage columns × time only where the festival publishes a stage grid
(`fest.days[day].stages`). Everything else is a stack of artist cards under
the place it happens, in play order.** Data still decides — but by its
shape (a grid is a grid), never by a threshold.

### 1.1 The timetable (one change)
`renderScheduledDayBody` as today: hour rail, sticky stage strip, 15-minute
rows, lanes for same-stage overlaps, the now line. Only a grid day renders
it. `computeTimesLayout` loses its dead `hasEE` parameter. **Stage solo is
not in this list any more** (deleted 2026-09-17, Kevin: "Tap a stage to see
only that stage. Tap it again for all of them — this is no longer a thing,
remove it"): a stage head is a plain header, the timetable is every stage at
`--col-w`, and nothing folds to a rail.
**The grid spans the whole day** — from the festival's doors to its close
(`dayMeta[day].doors` / `close` when present, else the first set's hour to
the last set's end) — so the now line always has a home (Kevin, 2026-09-17:
"otherwise the now line is weird"). Empty rows at the day's edges are the
honest cost.

### 1.2 The list: venue groups (new; extends the stage head and the card)
`venueGroups(entries, ctx, { fest, day, occOf })` renders one `.venue-grid`
holding one `.venue-group` per venue:

```
.venue-group
  .stage-head.venue > .label          the venue name (the stage-head component:
                                       Anton, the fest accent — it IS a stage header)
  .venue-sub                           "Doors 10 PM · ~3 AM"  (omitted when nothing is known)
  .stack                               renderCard(...) per artist, top to bottom
```

- **Order inside a group:** `order.seq` when every member has one; else the
  clock (`parseEventTime`); else file order. A run reads top-to-bottom as the
  night plays.
- **Order of groups:** by doors (`doors`, else the first member's time),
  then larger groups first within the same doors time so a row of stacks
  holds less air. Groups with no known time last.
- **The sub line:** `Doors <doors>` from any member's `doors`; the close from
  any member's `close`, with `~` when `closeApprox` or any member is
  `approx`. Nothing invented: a group with neither shows no sub line.
- **The card's time label:** a run member → `~10:30 PM` (tilde iff
  `approx`); a ranged single show → `9 PM – 3 AM`; no time → no time line
  (Kevin, 2026-08-31: nulls never show on the grid; they may in the zoom).
  A show with `doors` and no `time` is simply a card without a clock inside
  its group — TIME TBA blocks go. A show with a time and no venue lands in a
  group headed `Venue TBA`.
- **Geometry:** `.venue-grid { grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 10px 6px; align-items: start }` under 720px; `repeat(auto-fill,
  minmax(150px, 1fr))` at ≥720 (the grid's own column floor). The stack is
  as tall as its content — no rows, no floors, no air.
- **No explanatory line on the wall.** The `~ marks a guessed set time —
  the order is the plan` whisper is deleted (Kevin, 2026-09-17: "weird
  inline"); the tilde is explained once in Settings → How it works.
  **The How it works rows — their order and their words — are §3a.4, and only
  §3a.4.** They were listed here too until 2026-09-17; two of the three had
  already drifted, which is what a second copy is for. No lesson for the now
  mark ("don't need to explain now").
- **The now mark.** A stack has no clock to draw a line on, so the card of
  whoever is playing right now carries `.card.now`: a 1.5px ring in `--brand`
  with the soft glow the now line uses, and a small `NOW` label (the
  `.now-label` component, top-right of the card). "Playing now" = now is in
  `[start, next member's start)` for a run, `[start, end)` for a ranged show,
  `[doors, close)` for a doors-only show; the 1-minute ticker that moves the
  now line toggles the class without a repaint. Same violet, same ticker,
  one idea in two places.
- **One renderer.** `renderEventsTimetable`, `timetableOf`, `earnsColumns`,
  `sectionModeOf`, `tbaBlock` and the deck are deleted. `runFactsOf` stays
  (the zoom's "Runs 10 PM – ~3 AM · Guessing they're 3rd of 4").

### 1.3 A day, composed
Inside a day, rooms in this order, each under a `.sec-head`:
1. the festival's own room (`PORTOLA · PIER 80`): the timetable if the day
   has a grid, then **anything of the festival's that is not on the grid as
   venue groups** — strays whose stage is not a column, billed-but-untimed
   names, and `activities` (Electric Forest's Brainery becomes a venue group
   of cards; an activity is a card like any other and may be picked — new
   keys are additive and safe). "Everything else · off the clock" is gone.
2. each weekday-keyed section that plays that night (`AFTERS`, `FOLSOM`),
   as venue groups.

Section header sub-lines: the festival room says its site (`PIER 80`); a
section says its own sub from `dayMeta[<label>].sub` if present, else nothing.

## 2. Days are the days

- **The day axis** = the grid days ∪ the nights of weekday-keyed sections
  (`eventModelOf` as today). A day exists only when something plays on it,
  so no day is ever empty and the "Everything on X is hidden" copy goes.
- **Opens on the festival.** Before the fest: the first grid day (Portola →
  Saturday). During: the current festival day (the existing day-of rule).
  After: the first grid day. Thursday and Friday keep their tabs.
- **Dated sections.** A section whose entries carry `date` (ISO) instead of
  `night` is **its own tab, after the days**, labelled by the section
  (`LATE NIGHTS`), rendered as a `.date-rule` per date (`TUE · SEP 29`) with
  venue groups under each. It never joins the day axis, is never split, and
  its cards pick like any other (Kevin, 2026-09-16). ACL Fest Nights is the
  first.
- **Two-weekend scheduled fests get six dated tabs**, from `dayMeta.isos`:
  `FRI 2 · SAT 3 · SUN 4 · FRI 9 · SAT 10 · SUN 11`. A tab renders that
  weekend's grid (`weekend` W1 for the first three, W2 for the rest; a set
  with no `weekend` tag plays both). The day rule reads `FRIDAY · Fri · Oct 2
  · Weekend 1`. The weekend strip (`updateWeekendRow`, `fn_weekend_v1`,
  `scheduledWeekendOf`) is deleted. Day notes are per date (§4), so each
  Friday has its own thread; a legacy `Friday` note shows on both.
- A lineup-only two-weekend fest (ACL 2025, archived) keeps the `W1`/`W2`
  card tags and shows both weekends; it never had a grid to split.

## 3a. Kevin's look, 2026-09-17 — four changes (supersede the lines below where they conflict)

1. **One column width everywhere.** The stage grid's columns and the venue
   stacks' columns are the same track: a token `--col-w` (under 720px: two
   columns across the shell, `calc((100% - 6px) / 2)` of the scroller or
   grid; at ≥720px: a fixed width the stacks already resolve to, ~176px),
   used by `computeTimesLayout`'s template (`repeat(n, var(--col-w))`), the
   stage strip (same template), and `.venue-grid` (`repeat(auto-fill,
   var(--col-w))`, `justify-content: start`). The grid no longer stretches to
   fill a wide window; a Portola set card and an afters card are the same
   width on every screen. Lane-split cells still divide their column.
2. **No header fold.** Section headers are not buttons and carry no chevron;
   the fold state (`fn_fold_v1_<fid>`) is driven only by the show menu on the
   fest name (§3.1), which stays. Delete the header's fold wiring, the
   `folded` sub-copy on the header, and their tests; keep the menu's.
3. **Notes: written where you are** (replaces §4's per-date doors).
   The Notes sheet holds the festival composer and *only the targets that
   have notes* — no empty date rows. A day's rule on the wall is the door to
   that date's notes (label `Friday`); a section header on a day is the door
   to that section-on-that-date's notes (label `Folsom · Friday`, key
   `<iso>|<section label>` — a new, additive key); a card's zoom is the door
   to the artist's (unchanged). Each thread appears in the sheet only once
   someone writes, labelled as above, and its whisper is pinned under the
   rule or header that opens it. Nothing rolls up: a `Folsom · Friday` note
   does not appear under `Friday`. Legacy weekday-keyed notes still render
   under their date; legacy section-keyed (`Afters`, `Folsom`) notes stay
   readable in the sheet under that label with no door. The rule and header
   taps replace the fold taps — no new control appears.
4. **How it works** is grouped the way the screen reads. Rows, in order,
   each drawn with the REAL component (never a re-drawn lookalike):
   1. people chips — `Tap a name to highlight their picks.` / `Switch who you are picking as in Settings.`
   2. `+ Add` — `Add your people with + Add,` / `or share the crew link — anyone who opens it is in, no account needed.`
   3. three cards — `Tap an artist to add your color.` / `Brighter each tap. 4 taps = must see.`
   4. the who-corner marks — `Everyone's picks land on the card.` / `Ticks are picks; a letter is a must. White stroke = you.`
   5. the about-corner chips — `Hold for details.` / `Violet = crew notes; pin one to keep it on top. Green = it's in your Spotify (connect in Settings).`
   6. a run card (`Gelli Haha · ~10:30 PM`) — `**~ a guessed start time and artist order.** Based on limited intel.`
   7. the dock's fest link (`.fest-link`: Anton, the sync dot — ONE row, the real component; its label is the fixed string `ACL '26`, never the current fest's name, and inside the drill it wears `--brand`, because the fest accent's four homes do not include How it works) — `Tap the fest name to show or hide parts of the week.` / `Green dot = synced. Gray = offline (still works); red = something's wrong.`
   8. the gear — `Switch fests and more in Settings.`
   Kevin, 2026-09-17: the fest name and its dot were drawn twice, differently, five rows apart ("PORTOLA '26 ▾" in the body face and "PORTOLA '26 ●"); once, together, as the component. Eight rows since the ship round (the stage row went with stage solo); red means something needs Kevin, not the reader — "just say something's wrong"; and every picture's cell is `min-width: 0; overflow: hidden`, so no label can escape at 390.
5. Sort options inside the show menu for every fest: banked in hg-pen, not
   built (Kevin: "unless it's easy to knock out" — it is not: the old sort
   applies to the lineup-only wall; stacks and grids need their own think).

## 3. Sections fold on a tap of their header (superseded by 3a.2 — the menu alone folds)

- `.sec-head` is a `<button aria-expanded>` with a chevron at its end. A tap
  folds the room's body; the header stays and its sub becomes `<n> shows`.
  Both the festival room and every section can fold.
- Folded state is per fest per section key in `localStorage fn_fold_v1_<fid>`,
  never written to the crew doc (the viewer-side law). A repaint reads it;
  nothing to harvest.
- Motion: the body leaves quick and plain (opacity + a short translateY,
  ~160 ms), then leaves the flow; the way back has the usual beat. Low Power
  and reduced motion: instant. The wall below moves — a fold is the one
  layout change the person asked for.
- This replaces the bucket chips, the hidden-bucket whisper and
  `toggleBucketFlow`; `filters.js` loses its bucket functions;
  `bucketsOf` goes.

### 3.1 The show menu (Kevin, 2026-09-17)
The fest name at the end of the dock (phone) and of the day rail (desktop)
opens **the show menu**: the sort popover component reused (`.sort-wrap` +
`.sort-pop`, listbox semantics), headed `Show`, one row per room of the
festival week (`Portola`, `Afters`, `Folsom`) with a check, then a divider
and `Settings ›` — because that tap opens Settings today and nothing may
be lost. Unchecking a room folds it on every day; it is the SAME state as
§3's fold (`fn_fold_v1_<fid>`), the menu's one door. On the phone the popover
opens upward above the dock; on desktop it hangs under the rail. A fest with
one room has no menu: the tap goes straight to Settings, as today. Escape,
a tap outside and a row tap all close it; the way in has the beat, the way
out is quick.

**Since the ship round (2026-09-17):**
- **A hidden part renders nothing.** No header, no quiet label, no whisper,
  no note door: the plan (`wallPlanFor`) applies the fold, so a hidden
  section is absent from every day it played, a hidden extra (Late nights) is
  absent, and the festival's own room takes its grid, its billed names and
  its day-less names with it. A search never resurfaces a hidden part. The
  sheet still lists a note already written on a hidden date (§3a.3).
- **A day with nothing visible has no tab.** A day whose visible rooms are
  all empty is dropped from the plan's days: no rule, no tab in the dock or
  rail, not a scrollspy anchor, never the open — the open is the first
  VISIBLE grid day; during the fest, today if visible, else the next visible
  day. Kevin: "if all events for a day are hidden, don't show that day at all
  — not empty shells." Portola with Afters and Folsom hidden is SAT · SUN.
- **The menu reads the fest, not the wall** (`roomsOf`: the same plan with
  nothing folded), so every room is offered whether or not it is hidden —
  that is where the state is visible. Hiding repaints the wall and the tabs
  through the ordinary repaint path and lands where you were standing, or on
  the first visible day if that day went.
- **Weekend rows.** On a fest with two weekends (`weekendsOf(fest).length >
  1`, ACL) the festival-room row is replaced by `Weekend 1` and `Weekend 2`
  (keys `weekend:W1` / `weekend:W2`, in the same folded list, label-only rows
  like every other). Hiding a weekend drops its three dated tabs; both hidden
  leaves Late nights alone; a set tagged for both weekends keeps playing on
  the other. Row order: Weekend 1, Weekend 2, Late nights, Settings. A
  one-weekend fest is untouched.

## 3b. The ship notes, 2026-09-17

Kevin looked at the v84 preview: "if you're feeling good about it we can
ship it." Five things stood between the preview and production, in his
words:

1. **Stage solo is deleted.** "Tap a stage to see only that stage. Tap it
   again for all of them — this is no longer a thing, remove it." Feature,
   copy, CSS, tests: all of it (§1.1). A stage head is a plain header.
2. **Highlighting picks dims, never filters.** "Right now we hide
   non-timeline events the person hasn't tagged and just dim the ones they're
   not doing in timeline views. Let's use just dim everywhere. Deciding to
   highlight user(s) picks shouldn't work as a filter." One rule, one class
   (`.card.dim`), on the clock, in a stack, in a list, in a search; the "No
   picks here from …" block is gone.
3. **A hidden part renders nothing; a day with nothing visible has no tab.**
   "If all events for a day are hidden, don't show that day at all — not
   empty shells." (§3.1)
4. **ACL: Weekend 1 / Weekend 2 in the show menu.** "ACL needs options in the
   show/hide menu to hide weekend 1 or weekend 2." (§3.1)
5. **How it works.** One coded-in fest name (`ACL '26` — "easiest fix: code
   in one fest name, probs ACL"), the picture in brand rather than the
   accent, "red = something's wrong" ("just say something's wrong"), eight
   rows. (§3a.4)

## 4. Notes: artist, fest, dates (Kevin, 2026-09-17 — "a defensible MVP")

Three scopes, three doors. The `+ ✎` / `n ✎` chips on the day rule and on
every section header are removed (`dayHeader` and `sectionHeader` lose their
`onOpenNotes` option). **Section notes are gone:** no door, no whisper, no
sheet section for `Afters` / `Folsom` / `Late nights` as targets.

- *An artist:* hold (touch) or hover (mouse) the card → `+ note` on the
  grown card; a card that already has notes also opens from its corner chip.
  Unchanged; one thread per artist wherever they play.
- *A date:* day notes are keyed by the **ISO date** (`notes.day["2026-09-26"]`),
  a new, additive key. The wall's day rule (a real date under V4 — a grid
  day, an afters night, an ACL tab, a Late nights date-rule) carries the
  whisper once someone writes; the all-notes sheet lists each date with the
  open-door row the threads already use (`.n-door`, the viewer's avatar,
  `+ Add a note for Sat · Sep 26…`, quieter than a thread's `Reply…` and set
  apart at the section's foot), so the first note is two taps. Two Fridays
  are two dates: solved.
  **Legacy keys, read-time only, no migration:** a note stored under a
  weekday label (`"Saturday"`) renders under the date that label maps to
  through `dayMeta` (a two-weekend fest maps it to both dates, as it always
  did); a note stored under a section label (`"Afters"`) stays readable in
  the sheet under that label with no door. Nothing is renamed; the freeze is
  untouched.
- *The festival:* the composer at the top of the all-notes sheet, as today.

Door and section labels always use the day's short form (weekday · date),
never a raw key.

**No notes chip inside the notes sheet (Kevin, 2026-09-17: "confusing there
cause we're already in notes").** The artist sheet's header is the card grown
once more; its chip row drops the `+ note` / `n notes` chip there (the sheet
IS the thread) and keeps the Spotify chip. `sheetCard` passes `factsFor` a
flag, or filters the chip, whichever is the one-line change in `notes.js`.
The zoomed card on the wall keeps its notes chip: that one is a door.

## 5. The zoom: opaque from the first frame

The bloom fades the whole slot `0 → 1` over `MATERIALIZE_MS` while it grows,
so for ~90 ms the grown card is translucent over opaque neighbours — Kevin's
"tucks behind its neighbours" (reported 2026-08-31 and 2026-09-16). Change:
the slot and its surface are opaque, bordered and shadowed at frame 0; only
the scale (`k → 1`) and the grown rows' cascade animate. `MATERIALIZE_MS`
goes. A real-browser contract case asserts the slot's computed opacity is 1
on the first animation frame. Nothing else about the zoom changes in this
round — the close-logic rewrite (one pointer-position rule) stays scheduled
for after ACL.

## 6. Data

- A section entry (an `artists[]` entry whose `day` is not a grid day)
  carries **exactly one of** `night` (a weekday — joins the days) or `date`
  (ISO — a dated section), plus `venue`. The validator errors on both or
  neither. Everything else (`doors`, `close`, `closeApprox`, `closeSource`,
  `time`, `approx`, `order`) is as today. The legacy `"Thu · Venue"` stage
  string stays accepted; the structured pair wins when present.
- **ACL Fest Nights:** the 63 entries in the session's
  `fest-data/acl-fest-nights.json` join `acl-2026.json`'s `artists[]` with
  `day: "Late nights"`, `date`, `venue`, `doors`, `source`; `dayMeta["Late
  nights"] = { date: "Sep 29 – Oct 10", sub: "around Austin" }`. A late-night
  entry whose name matches a Zilker name case-insensitively IS that name (one
  pick key; the data teammate already unified them; the exact billing is kept
  in `billedAs` for the note). Freeze after entering. Venue map links can
  follow.
- `sections: {}` is still not a thing: a section is an `artists[].day` label
  that is not a grid day, as today.

## 7. What is deleted (the checklist)

| File | Goes |
|---|---|
| `js/v3/events.js` | `earnsColumns`, `sectionModeOf`, `bucketsOf`, `FEST_BUCKET`, `timetableOf`, `sortForTiles` if nothing else uses it |
| `js/v3/wall.js` | `renderEventsTimetable`, `bucketRow`, `hiddenWhisper`, `renderOffClock`, `eeActivityRow`, `offClockOf`, `tbaBlock`; the `onOpenNotes` chips in `dayHeader`/`sectionHeader`; the classic "extra sections underneath all the days" branch of `renderWallInner` once every section renders inside its day |
| `js/v3/app.js` | `toggleBucketFlow`, `updateWeekendRow`, the weekend and hidden-bucket state; **adds** the default-day rule and the fold state |
| `js/v3/filters.js` | `loadHiddenBuckets`, `saveHiddenBuckets`, `toggleBucket`, `applyBucketToggle`; `columnsTemplate`'s `hasEE` |
| `assets/v3.css` | `.bucket-row`, `.bucket-chip`, `.ee-col`, `.ee-item`, `.tba*`, the weekend `.seg` row if nothing else uses `.seg`; **adds** `.venue-grid`, `.venue-group`, `.venue-sub`, `.date-rule`, the fold chevron |
| `gallery.html` | the events section re-drawn in the new shape (the deck picture stays as the back pocket) |
| tests | `events-model` (columns/threshold/timetable cases → venue-group cases), `events-wall` (columns, buckets, hidden → groups, fold, default day), `wall-filters` (bucket cases out), `off-clock.test.mjs` (→ the festival room's non-grid groups), `scheduled-sections`, `afters-events`, `portola-events` (tilde-iff-approx stays), `day-image-sections` (a day's export includes its groups); browser contract gains the zoom opacity case and a fold case |
| docs | this file is the spec; MODEL-V3 §2–§4 marked superseded at their heads; `docs/user-flows.md` gains the wall flow; CLAUDE.md carries the one rule in one bullet; README's structure block |

Kept, untouched: the card, `factsFor`, the auras, the people filter (dims on a
timetable, hides in a list — now the only list is venue groups, so the rule
reads "dims on the clock, hides in a stack"), stage solo, search, the sort
chip on lineup-only walls, the notes sheets, the sync layer, the service
worker, `cardFor`'s room tie-break (an artist can still be one occurrence in
two rooms).

## 8. Build plan

Five lanes on branches off `integration-0916`, then integrate, stamp, gate,
Codex round, real-browser walk (Chromium + WebKit iPhone), Kevin's look on a
unique preview URL, merge #16, promote. Target: Sun 2026-09-20 / Mon 09-21.

1. **model + list** (`events.js`, `wall.js`, `v3.css`, their tests, `gallery.html`) — the venue groups, the composed day, the dated section, the deletions.
2. **shell** (`app.js`, `filters.js`, `index.html`, `settings.js` for the How it works rows) — day nav for dated sections and six-tab weekends, the default-day rule, the fold state and the show menu on the fest link, the now-mark ticker, the How it works rows in Kevin's words (§1.2: tilde, people filter, show menu; none for now), the deletions.
5. **notes** (`notes.js`, `js/v3/model.js` for the key mapping, `tests/notes-*`) — date-keyed day notes with the read-time mapping of legacy weekday and section keys (§4), the per-date doors in the all-notes sheet, the whisper keyed by date, no section notes.
3. **data + validator** (`api/_lib/festival-rules.mjs`, `scripts/`, `data/festivals/acl-2026.json`, the freeze, docs) — `night` xor `date`, the Fest Nights entries, MODEL-V3 supersede notes, user-flows, CLAUDE.md, README.
4. **zoom** (`card-facts.js`, `tests/browser/`) — opaque from frame one, the contract case.

Every lane: tests first where feasible, small scope-prefixed commits, no
stamp (the integrator stamps once), no push.

## 9. Kevin's notes on the canvas (2026-09-17), folded in

- The fest name in the dock/rail becomes the show menu (§3.1). ✔
- The grid keeps the full day so the now line is never weird (§1.1); stacks
  mark whoever is playing now (§1.2). ✔
- The inline tilde whisper goes; How it works explains it (§1.2, §8 lane 2). ✔
- The "what goes" note on the canvas is in plain English now.

Still open with Kevin: direction A vs B vs C; ACL as six dated tabs; activities
as pickable cards; where the Late nights tab sits (after the days, proposed);
the default-open day (the festival's first day, proposed).
