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
rows, lanes for same-stage overlaps, stage solo, the now line. Only a grid
day renders it. `computeTimesLayout` loses its dead `hasEE` parameter.
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
  inline"); the tilde is explained once in Settings → How it works, as a
  lesson row (copy drafted by Codex, Kevin picks).
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
  `scheduledWeekendOf`) is deleted. Day note keys are unchanged: both Fridays
  share the `Friday` thread, exactly as the picker left them.
- A lineup-only two-weekend fest (ACL 2025, archived) keeps the `W1`/`W2`
  card tags and shows both weekends; it never had a grid to split.

## 3. Sections fold on a tap of their header

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
§3's fold (`fn_fold_v1_<fid>`), read by both doors. On the phone the popover
opens upward above the dock; on desktop it hangs under the rail. A fest with
one room has no menu: the tap goes straight to Settings, as today. Escape,
a tap outside and a row tap all close it; the way in has the beat, the way
out is quick.

## 4. Notes keep three doors

The card's corner chip, the day whisper (nothing until someone writes, then
the newest note as one line), and the toolbar `Notes` sheet. The `+ ✎` /
`n ✎` chips on the day rule and on every section header are removed
(`dayHeader` and `sectionHeader` lose their `onOpenNotes` option).

**How a note gets added, by kind:**
- *An artist:* hold (touch) or hover (mouse) the card → `+ note` on the
  grown card; a card that already has notes also opens from its corner chip.
  Unchanged.
- *A day (or a section like Afters — a section IS a day label):* the
  `Notes` chip in the toolbar opens the all-notes sheet; every day and
  section there ends with the open-door row the threads already use (`.n-door`,
  "Add a note for Saturday"), so the first note is two taps. Once a day has a
  note, its whisper on the wall opens the same thread. The all-notes sheet
  must offer that door per day and per section — it lists sections today
  but ends only with the festival composer; add the per-day doors there,
  never a chip on the wall.
- *The festival:* the composer at the top of the all-notes sheet, as today.

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

Four lanes on branches off `integration-0916`, then integrate, stamp, gate,
Codex round, real-browser walk (Chromium + WebKit iPhone), Kevin's look on a
unique preview URL, merge #16, promote. Target: Sun 2026-09-20 / Mon 09-21.

1. **model + list** (`events.js`, `wall.js`, `v3.css`, their tests, `gallery.html`) — the venue groups, the composed day, the dated section, the deletions.
2. **shell** (`app.js`, `filters.js`, `index.html`, `settings.js` for the How it works rows) — day nav for dated sections and six-tab weekends, the default-day rule, the fold state and the show menu on the fest link, the now-mark ticker, the three How it works lesson rows (tilde, show menu, now), the per-day doors in the all-notes sheet (`notes.js`), the deletions.
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
