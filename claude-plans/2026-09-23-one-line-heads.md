# One line per room: "SAT PORTOLA", "SAT AFTERS" (2026-09-23)

**Status:** spec for the pre-Portola build, written 2026-09-23 (Wed). Afters
start Thu Sep 24, so this ships only after a preview walk and Kevin's yes.

## Why

Kevin, 2026-09-23: "combine the double lines (for day and then event) into
one line each like 'Sat Portola' 'Sat Afters'."

Today every day on the wall is two kinds of line stacked:

```
SATURDAY  Sat · Sep 26 ─────────────   ← .day-rule (the day: tab anchor, notes door for the date)
  you  Lunch at Pier 80 gate 1pm?        ← whisper of the date's newest note
PORTOLA  PIER 80 ───────────────────   ← .sec-head (the festival's room; no door)
  [grid]
AFTERS ─────────────────────────────   ← .sec-head (door to "Afters · Saturday" notes)
  [venue stacks]
FOLSOM ─────────────────────────────
```

Thursday is the worst case: `THURSDAY Thu · Sep 24` and then `AFTERS`, two
lines to say one thing. The day line is the redundant one. The dock's tab
already says which day you are on, and every room is inside exactly one day.

## The shape

Every room on a day gets ONE head, and it names both: when, then what.

```
SAT PORTOLA  Sep 26 · Pier 80 ──────   ← the day's first head: date + the room's own sub
  you  Lunch at Pier 80 gate 1pm?        ← the whisper of the note thread this head opens
  [grid]
SAT AFTERS ─────────────────────────
  [venue stacks]
SAT FOLSOM ─────────────────────────
```

- **Label:** the weekday short form (`SAT`, from the day's `short`/`wd`)
  then the room label (`PORTOLA`, `AFTERS`, `FOLSOM`), in the display face,
  uppercase. No dot between them. Kevin wrote them as "Sat Portola".
- **Sub:** the FIRST head of a day carries the date (`Sep 26`), then the
  room's own sub if it has one (the festival room's place `Pier 80`; a
  section's `dayMeta[label].sub`). Later heads on the same day carry only
  their own sub. A two-weekend fest's first head says its weekend too
  (`FRI ACL  Oct 2 · Weekend 1 · …`), because two Fridays must be told
  apart while scrolling. Use the day's existing `sub`, which already says
  that. Don't invent a second date format.
- **One look.** All room heads on the wall are one component at one size.
  A head is the day's landmark now, so it takes the old day rule's weight
  (`--fs-day`, the display tracking). A day's first head is not bigger than
  its others. Choose the weekday's colour vs the room's colour with taste
  (e.g. the weekday in `--text-secondary`, the room in `--text-header`).
  Look the values up in `assets/v3-tokens.css`; never invent one, and never
  use `--fest`. The accent's four homes do not include these heads (CLAUDE.md).
- **Ellipsis, never wrap:** `THU ELECTRIC FOREST` and `SUN TOMORROWLAND
  WINTER` must fit a 390px phone on one line. If the room label can't fit,
  it ellipsizes and the sub goes first. Check every fest in
  `data/festivals/`.

### Dated sections (ACL's Late nights)

Same rule. Today it is a `LATE NIGHTS` header with a quieter `.date-rule`
per date under it: two lines again. It becomes one head per date,
`TUE LATE NIGHTS  Sep 29 ───`, and the tab lands on its first date. That
head is the date's notes door, as the `.date-rule` is today. A section
whose entries never said a night (an undated extra) keeps a plain
`AFTERS`-style head with no weekday. It has no day to name.

### The notes doors (MODEL-V4 §3a.3 stays true: a note is written where you are standing)

- The **festival's own room** head on a date is the door to **that date's**
  notes: the bare ISO key, exactly the thread the day rule opened. Existing
  day notes keep their door with no migration and no new key. On a
  Portola Saturday, the date and the festival's day are the same thing.
- A **section's** head on a date is the door to `<iso>|<section label>`,
  unchanged.
- A **Late nights** date head is the door to that date (bare ISO),
  unchanged from the `.date-rule`.
- A date with no festival room (Portola's Thu/Fri: only Afters/Folsom) has
  no bare-date door. A note already written there (a legacy weekday key or
  a bare ISO) stays readable in the all-notes sheet, which lists every
  target that has notes. Nothing is lost and nothing rolls up. Checked in
  production 2026-09-23: no Portola crew has a Thu/Fri date note.
- Each head's whisper stays pinned directly under the head that opens it.

### What the day line did, and where each job goes

1. **Tab anchor + scrollspy** (`DAY_ANCHOR`, `wireScrollspy`,
   `scroll-margin-top: var(--jump-offset)`): the day's FIRST head carries
   `data-day` (+ `data-iso`) and is where the tab lands. Or wrap each day in
   a day block and anchor on that. Choose whichever leaves the code most
   legible (see below). The dated section's heads already work this way.
2. **Today jump** (`scrollToNowLine`, `.day-rule[data-iso]`): lands on the
   day's first head.
3. **The fold's leave/arrive** (`app.js` `dayBlocksOf`, `foldBlocksOf`,
   `landAfterFold`): a day that a fold empties must still leave as a unit,
   and arrive with the beat. The day's first head changes when its first
   room is hidden (hide Portola and Saturday's first head is `SAT AFTERS`,
   which now carries the date). The plan is recomputed on every paint, so
   the render decides this, never a cached guess.
4. **The 44px touch floor**: heads that are doors are buttons, so they get
   it for free. Heads that are not doors keep the same min-height so one
   component has one look (the v3.css comment on `.day-rule, .date-rule,
   .sec-head` explains why).

**Structure call (yours to make, with a reason in the commit):** today the
wall is a flat list of siblings (rule, whisper, room, room, rule, …) and
`dayBlocksOf` walks it. A day wrapper (`.day-block[data-day][data-iso]`
holding its rooms) would make "a day is a block of rooms" legible and give
the fold one element to animate. It also touches harvest/restore,
scrollspy, now-marks, the sticky strip (a strip's `position: sticky` is
bounded by its `.tt-block`, so it should be unaffected, but verify) and the
tests. A flat list with the first head carrying `data-day` is the smaller
diff. Pick the one a fresh session would understand fastest. Don't keep
both shapes alive.

### Untouched

The pseudo-headers that share `dayHeader()` anatomy (`THE LINEUP`,
`EVERYTHING ELSE · NO SET TIME YET`, `NOTES · PORTOLA`, a lineup fest's
flat-search group headers) are not day+room pairs. Leave them alone, but
rename the helper or class if leaving `.day-rule` on them would mislead the
next reader. The day tabs, the dock, the rail and the show menu are
unchanged.

## Done means

- Portola (Thu–Sun), ACL (six dated days + Late nights), Electric Forest,
  EDC Orlando, Seismic and Tomorrowland all render one head per room per
  day, on a 390px phone and at desktop width.
- Tabs land on the right head. The scrollspy lights the right tab through a
  whole scroll (Chromium AND WebKit: see the `LANDED_WITHIN` comment).
  Today-jump works. Hiding/showing Portola, Afters and Folsom, and ACL's
  Weekend 1/2 and Late nights, leaves and arrives as before, and a day
  emptied by a fold still takes its tab with it.
- Every notes door opens the same thread it opened before. The whisper sits
  under its door.
- `npm test` green, and the browser contract (`npm run test:browser`) too.
  Update the tests that assert `.day-rule` to assert the new truth: change
  what they check, never delete coverage.
- CLAUDE.md's notes bullet ("The doors are the day rule, the section header
  on that day…"), MODEL-V4 (a short new section pointing here) and any
  README line say what the code does now. `tests/docs-truth.test.mjs` must
  still pass.
- No service-worker stamp (the integrator stamps once, on a clean tree).
