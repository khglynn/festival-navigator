# v94 — Folsom weekend by time (build log)

Started 2026-09-25 ~11:10 PM PT. Branch `live/v94`, worktree
`.claude/worktrees/v94`, based on v92's head (7c41b59). Builder: an Opus
teammate who designs first, then builds. The party data is prepared in
parallel on `data/folsom-all` (worktree `.claude/worktrees/data-folsom-all`)
and merged into this branch before release.

## Why

Kevin wants every Folsom-weekend party in the app — 68 verified public
queer parties Fri Sep 25 – Mon Sep 28 (the pick list:
`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live/claude-plans/2026-09-25-portola-live/research/gay-events/PICK-LIST.md`
and `pick-list.json`). Today the Folsom section is a stack of cards under
each venue. Measured on the real list: 39 venues for 68 parties, and on any
night only 2–3 venues host more than one (The Stud, SF Eagle; Powerhouse 3
on Sunday) — so venue columns would be 18–20 one-card columns a night; and
10 parties start in Saturday's 9 PM hour (up to 16 run at once Friday), so a
clock would pile up on a phone. Kevin chose (2026-09-25): cards sorted by
time that wrap responsively, "closer to our seasonal view".

## What to design, then build

1. **A third presentation, declared by the data, never inferred.** MODEL-V4's
   law: the data's shape picks the presentation, never a threshold. So the
   festival file says it — e.g. one top-level declaration that the Folsom
   section is shown by time (pick the cleanest shape: a section map is
   likely better than a field on every entry; the validator must enforce it
   and reject a section that disagrees with itself). Everything else renders
   exactly as today.
2. **By time:** within each night of the section, cards in start-time order
   (after-midnight starts count as that night's late hours), grouped under
   quiet time headers (e.g. daytime, 9 PM, 10 PM, late, after-hours — choose
   bands that read well for this data), wrapping two across on a phone
   (`--col-w`, one card width everywhere) and more on a computer. Each card
   carries its place (venue, and neighbourhood if the data has it) — the same
   card component, so picks, the zoom (with its Tix/Info doors and the new
   − · note · + row), notes, crew colours, NOW lighting and the room head's
   note door all work unchanged. A night with nothing in the section renders
   nothing. The Folsom show/hide toggle and share links' `&show=` keep working.
3. **Reuse before inventing.** The city-seasons session built a similar
   "cards by time, wrapping" view on `origin/seasons/view` (not merged; read
   it with `git show`/`git diff origin/main...origin/seasons/view`, never
   check it out). If its component fits cleanly, share one component (and
   say so in the Log); if not, say why and keep ours shaped so the two can
   merge later.
4. **Frames first.** Before building, render the Folsom nights with the REAL
   68 parties (from pick-list.json, in a scratch fixture) at 390, 320 and
   1280, using the production CSS and card rendering (the rigs under
   `claude-plans/2026-09-25-portola-live/design/` show how), plus one frame
   of today's venue stacks with the same data for comparison. Save them to
   `claude-plans/2026-09-25-portola-live/design/folsom-by-time/` in the
   portola-live worktree (/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live/…) and reply
   with the paths as soon as they exist — the orchestrator shows Kevin while
   you build. Kevin judges alignment and feel; nothing crowded in the middle,
   edges aligned, motion light.
5. Update MODEL-V4 / docs/add-a-festival.md for the new declaration, and the
   validator + tests.

## Rules

Same as v90–v93: only this worktree; commit and push as you go on `live/v94`
(preview only); no PR/merge/stamp; no crew-data, sync, merge, artist-name or
update-machinery changes; note keys unchanged (`<iso>|<section>`); never load
production with a crew link or write to the production database; one suite
and one browser at a time. Walk it with real touch at 390/320 and a mouse at
1280, screenshots into `v94-shots/`, full `npm test` at the end.

## Log

### 2026-09-25 ~11:55 PM PT — frames are up

All in the portola-live worktree,
`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live/claude-plans/2026-09-25-portola-live/design/folsom-by-time/`:

- **Contact sheets (show Kevin these):** `sheet-1-phone.png` (today's venue
  stacks vs by time, Fri/Sat/Sun at 390 and 320), `sheet-2-desktop.png` (1280,
  Fri with no clock, Sat under the Portola clock, today's stacks),
  `sheet-3-in-context.png` (what a phone screen shows: afters above Folsom,
  Friday, the zoom with Tix/Info and − note +).
- **Frames:** `frames/{fri,sat,sun}-{390,320,1280}.png` (each night whole,
  chrome hidden), `frames/view-*.png` (the phone screen as it is),
  `frames/zoom-sat-390.png`, `frames/today-venue-*.png` (today's stacks, same
  data).
- **How they were made:** `fixture.mjs` turns `pick-list.json` into a scratch
  copy of portola-2026.json (67 parties + Horse Meat Disco's existing
  "Afters & Folsom" entry = 68; small-hours starts filed on the night before,
  so AFTERSHOCK is Saturday's and Nocturnal is Sunday's; the ten parties the
  file already has keep the file's names). `rig.mjs` serves the v94 worktree's
  own app with that fixture in a real Chromium (touch at 390/320, mouse at
  1280, clock pinned to Fri 11:30 PM PT, a made-up crew, every write refused);
  `rig-report.txt` has the measured geometry; `sheets.py` builds the sheets.
- **Measured, not eyeballed** (rig-report.txt): one card width per screen
  (178 at 390, 143 at 320, 176 at 1280); every card's left edge at the room
  head's (14px) on a phone; at 1280 under Saturday's clock the columns start
  at 140/320/500/680/860, exactly the clock's columns; nothing past the right
  edge; one gap between rows (6px phone, 7px desktop); no row with two card
  heights.
- **Rig trap found and fixed:** Chromium's full-page capture drops touch
  emulation, so `(pointer: coarse)` stops matching and every room head falls
  from 44px to 24px. The first round drew a mouse's layout on a phone; the
  rig now stitches viewport slices instead. Worth knowing for any future rig.

**The design, in short.** A section says `"layout": "by-time"` in its own
`dayMeta` entry (one declaration per section, so it cannot disagree with
itself). Each night of the section is its cards in start order under six
fixed bands: DAYTIME (before 5 PM), EVENING (5–9), 9 PM, 10 PM, LATE (11 PM to
2 AM, bar close) and AFTER-HOURS (2 AM on), plus TIME TBA for a party with no
clock. A band with nothing in it isn't drawn. The bands are fixed times,
never fitted to the data. The card is the same card; its time line reads
`9 PM – 3 AM`, then `Public Works · Mission` (the venue, then `area` if the
entry has it).

**One call made, open to a veto: a phone does not step the list in under
the clock.** On Sat/Sun the afters stacks sit 40px in and scroll sideways so
their columns line up under the timetable (v91). A time list is read across,
not down (the 9:30 party beside the 9 PM one), and that sideways row parks the
right-hand card 38px off the screen, which would clip half of every pair.
So on a phone the list keeps the shell's two full columns, lined up with its
own SAT FOLSOM head. From 720 up it does step in and sits exactly under the
clock's columns. The one place this shows is `view-sat-390.png`: the afters
cards above start 40px further in than the Folsom cards below.

**For the data agent (data/folsom-all), so the real file renders like the
frames:** `dayMeta.Folsom.layout = "by-time"`; an optional `area` string per
entry (the neighbourhood: "SoMa", "Castro"; ≤ 40 chars); venue names short,
with the street address in `venues{}` as the map link (the pick list's
"Power Exchange (220 Jones St)" reads as "Power Exchange · Tenderloin" on the
card); small-hours starts on the night before (Kevin's rule).

**Reuse (the seasons view on `origin/seasons/view`):** not shared. Its
season grid is `.wall-grid` (`repeat(2, 1fr)`, `minmax(176px, 1fr)` from
720), so its cards stretch to fill and would break `--col-w` on the same wall
as the timetable. Its grouping (weeks) is also a different axis. What *is*
shared is the one card: both call `renderCard(name, ctx, { time, occ })` with
a two-line time label. If the season view moves to the `--col-w` track later,
`timeGroups` (a list of headed bands over a card grid) is the shape it can
adopt.

Next: validator + tests, docs, the day image in time order, then the walks.

### 2026-09-26 ~2 AM PT — built, merged with the full data, walked

**What shipped on `live/v94`** (preview only; not stamped, per the rules):

1. **The declaration.** `dayMeta.Folsom.layout = "by-time"` in
   `portola-2026.json`. `by-venue` is the default. The validator
   (`festival-rules.mjs checkLayouts`) errors on an unknown value, on a grid
   day, on a combined label, on a label nobody plays under, and on a festival
   with no grid. A by-time party with no clock gets a warning (it goes last,
   under TIME TBA). `area` is a new optional short string.
2. **The list.** `events.js timeBandsOf` builds on the stacks' own model
   (`venueGroupsOf`, so the now window, cancelled handling and the tilde
   come for free), and `wall.js timeGroups` draws it. The bands are fixed:
   DAYTIME, EVENING, 9 PM, 10 PM, LATE (to 2 AM), AFTER-HOURS, TIME TBA. There
   is one difference from a stack: a party's printed end is when its ring
   goes out, not the next party's start in the same room.
3. **Each party is its own show** (the coordinator's ask, 2026-09-26).
   `events.js showsOnItsOwn` answers one question: does every room this entry
   sits in read by time? The validator and the file's own tests all ask it,
   so they can't drift apart. Where the answer is yes, none of the three
   one-show-per-room checks applies: the "timed sets and no running order"
   warning, the complete-run test (`portola-events`) and the one-bill links
   test (`show-links`). All three stay fully in force for stacked sections,
   and a combined label ("Afters & Folsom") is still held to them through its
   Afters room. **How the validator knows:** it reads the section's own
   `dayMeta` `layout`. A test on the real file checks that each party in a
   shared venue opens its own doors in the zoom.
4. **The data.** Merged `data/folsom-all` at its final head b4f562a (36
   cards, PRIME door-only, HMD's tickets at Sickening). The 18 same-venue
   parties are spliced in per the splice file's readme, all names frozen,
   and the splice file is retired (DATA-NOTES says so). The file now has 65
   Folsom cards (Fri 20, Sat 24, Sun 21). The validator reads **0 errors**,
   and the Portola file has **0 warnings**.
5. **Place lines never break mid-phrase** (Kevin via the coordinator). A
   card's place is phrases (the venue, then the area). They share one line,
   with a dot, only while every phrase fits whole. Otherwise each gets its
   own line and the dot goes: `wall.js fitPlaces` decides from the drawn
   widths, inside the fit pass that already runs before paint. The time line
   never wraps. Checked in a real browser at 320/390/1280 and in WebKit
   (`tests/browser/by-time-contract.test.mjs`).
6. **Two small real bugs the full data showed:**
   a. `timeRange` read 10 AM – 12 AM as "10 – 12 AM", a two-hour brunch
      instead of a party to midnight. It now drops the first AM/PM only
      inside one half-day.
   b. A second NOW tap during the first tap's pulse (~0.9s) measured the
      pulsing cards up to 12px larger, and the stops regrouped, so the same
      show landed twice. NOW now measures a card's layout box.
      `app.js pageGeo.box`.
7. **Docs:** MODEL-V4 §3e, `docs/add-a-festival.md` (the declaration, `area`,
   the room rules not applying), CLAUDE.md's one bullet, and the gallery's
   Folsom (every band, a guessed close, TIME TBA, Mayes Oyster House /
   Polk Gulch).

**Frames with the full data** (portola-live `…/design/folsom-by-time/`):
`sheet-4-full-data.png` (Fri/Sat/Sun at 390, all 65), and
`frames/real-{fri,sat,sun}-390.png`.

**The clock-day question, shown both ways** (`sheet-5-clock-day.png`,
`frames/real-{A,B}-view-sat-{390,320}.png`). B applies the v91 stack rule to
the time list: 40px of lead space, columns under the timetable's, a sideways
row. It lines the Folsom cards up under the afters, but at rest every
right-hand card runs 38px off the screen ("GearedUp Alley Pa", "Folsom
Street's Miracle Mile walki"; at 320, "GearedUp All"). A time list is read
across (the 9:30 party beside the 9 PM one), so B hides half of every pair.
**Built: A.** On a phone the list keeps the shell's two full columns, edge to
edge with its own SAT FOLSOM head. From 720 up it sits exactly under the
clock's columns (measured: 140/320/500/680/860 on both). It is one CSS
block to switch if Kevin prefers B (the rig's `ALT_B`).

**Verified:**

1. `npm test`: 1005 pass. The one failure is the service-worker stamp,
   which is the integrator's.
2. `npm run test:browser`: every contract passes, including the new
   by-time contract. The stack-row contract now also measures time lists
   (phone: two full columns, never a sideways row; 1280: under the clock).
3. The NOW contract: each side-by-side pair lands in one tap, read off the
   page.
4. The walk (`v94-walk.mjs`: real touch at 390/320, a real mouse at 1280,
   Reduce Motion; 0 page errors; writes only to its in-memory mock):
   a. a tap picks in place (the band, the time line and the ring all kept);
   b. a hold opens the zoom with Tix/Info and − note +;
   c. the head opens "FOLSOM · FRIDAY";
   d. NOW reaches the Folsom 9 PM band as one stop;
   e. a highlight dims 18 of 20 cards;
   f. the show menu hides Folsom and brings it back;
   g. a fresh phone opening `&show=folsom` sees Folsom only;
   h. Thursday has no Folsom room;
   i. at 1280, hover zooms and a click picks.

**For Kevin to decide:**

1. A vs B on clock days (above). A is built.
2. At 11:30 PM on a Friday, 16 of 20 Folsom cards wear the NOW ring, because
   that's how many parties are open. It's honest, and the NOW button walks
   them band by band. A party with no printed end rings for only an hour.
   If he wants those to ring longer, that's data (a guessed `close`), not
   the renderer.
3. The real data carries no `area`, so cards say the venue alone. The
   pick list has a neighbourhood for every party if he wants it (a data
   pass).
