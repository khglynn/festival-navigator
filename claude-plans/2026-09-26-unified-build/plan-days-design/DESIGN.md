# Our picks: a drop-in room, the open plan across the days, and the menus while open (design round, 2026-09-26)

Branch `live/plan-days-design`, cut from the Share build's head (fc86005). Brief: `BRIEF.md`
beside this. Frames: `node frames.mjs` here (43 frames, each with a checked report line),
review page: `review.html`. Status: **round complete, waiting on Kevin's calls** (the
questions at the end). Nothing here ships; the build comes after his answers.

## The three decisions in one breath

- **A. Despacio.** The festival file says a room is a drop-in room (`"dropIn": true`).
  The plan then seats a person there only when none of their real picks is on, never
  makes it a stop, an "or" or the NOW, and gives it one quiet line a day ("Despacio · drop
  in till 9:45 PM · 7 picked"). Kevin's crew's Saturday goes back to the 12 real stops it
  had before seven people picked Despacio.
- **B. Across the days.** The open plan lands on today, scrolls on into every later day
  under the wall's own day heads, folds everything already over behind one Earlier line,
  and the Share (and the head) follow the day at the top: "Share Sunday's picks".
- **C. Menus while open.** Both menus open over the open plan and it re-plans as you
  change them. A highlight now FILTERS: the plan is made for just those people, with
  "two is together" as the bar, the rows say who ("Crane Stage · you + Hal"), and one
  person gets their own day with their conflicts as "or" lines.

## What I found before designing (evidence, 2026-09-26 afternoon)

1. **The made-up crew reproduces Kevin's afternoon.** `crew-despacio.mjs` is round two's
   nine plus Despacio picked by seven (Ana 1, Ben 1, Cy 2, Dot 1, Fay must, Gus must,
   Ivy 1). `node print-route.mjs despacio --option=today` gives Saturday as Despacio
   2:45–5:40 PM NOW, Tove Lo with "or Despacio", Despacio again 6:30–7:10 and 8:10–9, and
   Gelli Haha, Tricky, Groove Armada, DJ Shadow, Kettama and Fatboy Slim fall out of the
   route. Sunday is worse (Despacio twice as MOST, again at 10 PM, and as an "or").
2. **Why:** rule 3 seats a person at their highest-level live pick, ties to where more of
   the crew is. Despacio is live all afternoon, so every tie goes there and it snowballs;
   the two musts anchor it. Exactly the brief's reading.
3. **A second, hidden Despacio: Friday.** A pick is keyed by NAME, and "Despacio" has
   three plays: the Saturday and Sunday grid sets AND an Afters entry, "Pier 80 (loyalty
   invite)", Friday 5–11 PM (sold out, every-year passholders only, per the file's note).
   Rule 5 counts a pick at every play, so today the seven are a MOST stop on Friday,
   5–9:30 PM, at an invite-only event (frame A0-today-fri). Kevin's real crew sees the same.
4. **The shape rule misfires on real data.** A stage whose whole day is one set appears in
   our files four times: Portola's Despacio (Sat, Sun) and Lollapalooza 2025's Bonus Tracks
   (a 30-minute set), Toyota Music Den (30 min) and Fountain (2 h). Only Despacio is a room
   people drift through. The shape also cannot see Friday's invite (a section room, not a
   stage) — frame A2-shape-fri still says NOW: Pier 80.
5. **Both menus already close the open plan.** The people menu opens through the Show
   menu's own `openShowMenu`, whose second line was `closePlan()`. The doors ARE reachable
   with the plan open on a phone: the shelf stands on the dock (fixed,
   `bottom: var(--dock-h)`, z29 under the dock's z30) and never covers it; on a laptop the
   panel sits under the day rail.
6. **v103's predicate is `passesPeople` in `js/v3/filters.js`.** `origin/live/v103`
   (4b7f92d) names it "the ONE predicate for 'did the highlighted people pick this'", and
   adds `thinnedWords(people, meName)` in wall.js ("nothing Ross picked"). The function
   is unchanged on this branch, so the prototype calls it directly (the coordinator's
   note: call it, don't merge v103; it ships as v104 after the Share).

## A. A drop-in room

### Recommendation: declared in the data, and it yields

The word is **drop in** ("Despacio · drop in till 9:45 PM"). It says what you do there
and it is the word a friend would text. The data key is `"dropIn": true`.

Model rules (rule 9 in `js/v3/plan.js`'s header; prototyped behind `dropIn: 'declared'`):

1. **Data.** `"dropIn": true` on a grid set (`days.<Day>.artists[]`) or on a section entry
   (`artists[]`). Portola now declares three: Sat Despacio 2:45–9:45, Sun Despacio
   3:30–10:30, and Fri "Pier 80 (loyalty invite)". `weekPlaces` and `roomsAndParties`
   carry `place.dropIn`; a venue room is a drop-in when every act in it is.
2. **Seating (`slicesOf`).** A person's live candidates sort real-before-drop-in first,
   then rule 3's level, crowd, stay-put and start: a person is seated at a drop-in only in
   a minute when none of their real picks is on. Rule 3's "crosses town at most once"
   (`aheadAt`) ignores drop-ins, so a drop-in never holds a body against a trip.
3. **The route.** Drop-ins are left out of each slice's `ranked`, so they are never a stop,
   never a fork ("or") and never the peek's NOW or NEXT. Each slice still counts how many
   sit in a drop-in (`drops`); a scattered stretch where a drop-in holds the bar says so
   (`item.dropIn` → the row "Between sets · Despacio").
4. **The line.** `night().dropIns`: each shown drop-in room whose pickers clear the bar,
   one quiet line leading its day. The window rides on the line ("drop in 3:30 – 10:30 PM",
   "drop in till 9:45 PM" once it has opened), the time column stays empty so a line
   leading the day never reads as a row sorted above an 11 AM stop, and the count is the
   people who picked it (7 picked), not who happens to be seated there.
5. **The grid is unchanged.** The Despacio column is still one tall card (frame
   A1-declared-corner-315-1280).
6. **The validator nudges** (prototyped in `api/_lib/festival-rules.mjs`): `dropIn` must be
   a boolean (an error); on a live festival, a stage whose whole day is one set, beside
   stages that run several, and says nothing gets a warning asking the author to answer
   `"dropIn": true` or `false` (a day of one-set stages is a small show, not a room beside
   a festival — the suite's small fixtures stay clean). Archived
   files (Lollapalooza 2025) are not asked. Portola, declared, stays at zero warnings.

What it does to the crew (same clock, same crew, `node print-route.mjs despacio`):
Saturday is the nine-crew golden route exactly (12 stops: Gelli Haha, Tricky, Groove
Armada, Tove Lo, DJ Shadow, Robyn, Kettama, Fatboy Slim, Dog Blood, Soulwax, Public Works,
the Great Northern) plus the one Despacio line. Friday is the golden plus the invite's
line; Sunday likewise.

### Alternatives, and why not

- **A2, the shape rule** (a stage whose day is one set is a drop-in). No data work, and it
  fixes Saturday and Sunday. But it would also turn Lollapalooza's 30-minute Bonus Tracks
  set into a room to drift through, and it cannot see Friday's invite, which stays a MOST
  NOW (frame A2-shape-fri-7pm-390). The shape is a good question for the data author (the
  validator's nudge), not an answer for the plan.
- **A3, the lighter touch** (seating unchanged; forks to it dropped, repeats merged into
  "back to Despacio"). Smallest change, but the NOW is still Despacio all afternoon and
  the six real sets are still gone (frame A3-light-open-315-390). It treats the symptom.

### Edge cases

- **A drop-in that is someone's only pick.** They are seated there whenever it is on
  (nothing real competes), so they count toward its line and toward any "Between sets ·
  Despacio" stretch. It never becomes a stop for them, even solo: Gus alone (frame C6) sees
  the line and "Between sets · Despacio 9:25 PM", never a Despacio stop.
- **A must on Despacio** (Fay, Gus). It yields like any other level (a room open seven
  hours can wait for a 45-minute set) and shows in the line's count. Question A2.
- **Nothing else on.** If a drop-in is the only thing that clears the bar, the peek names
  the next real stop, not the drop-in; the open plan's line carries it. Question A3.
- **The Friday invite.** Declared too (it is the same drift-through room), so the seven
  are a line on Friday, not a MOST stop. Its name is the frozen pick key "Despacio", so a
  pick on the festival Despacio still counts there; renaming it would orphan picks.
  Question A5.

## B. The open plan across the days

### Recommendation

`planDays` in `js/v3/plan-rows.js` (replacing the one-night `planList` in the open plan):

1. **Lands on today** exactly as now: the peek's row is the NOW row, its card grown.
2. **Earlier folds.** Every night before today and today's stops already over sit behind
   one line in the wall's own words: "Earlier · Thu · Fri · 4 stops"; open, it reads
   "Hide earlier" and the past nights appear dimmed under their own heads. With more than
   three nights behind (ACL's second weekend) the days become a span: "Earlier · Sep 29 –
   Oct 9".
3. **Every later night** follows under a `.plan-day` head in the wall's head grammar
   (`SUN  SEP 27` and a hairline), then its drop-in line and its stops, one path per day.
4. **A night with no plan** says why in one quiet italic line: "No set times yet",
   "Nothing picked yet", "Scattered all day"; under a highlight, v103's words ("Nothing
   Gus picked") and "Never together — no stop". A run of such nights with the same reason
   folds into one head: `MON · TUE  OCT 5 – 6 / Nothing picked yet` (frame B8).
5. **The head follows the day at the top** (`nightAtTop` on scroll): `SUN OUR PICKS ·
   SEP 27 · 9 PICKING`. When the day changes the weekday and date turn over like a page
   number (a 200 ms rise from the side the list moves toward); instant under Reduce Motion
   or Low power (`canAnimate`).
6. **The Share sends the day at the top, and says so**: "Share today's picks" (from now,
   "now till end of day"), "Share Sunday's picks" (the whole day), "Share Sat Oct 10's
   picks" when the weekday repeats (ACL). On a day with nothing it rests, dimmed:
   "Nothing to share Monday".
7. **The list can bring the last day to the top** (`fitTail` pads the end just enough),
   so Sunday can be read and shared from the head like any day.
8. **The peek is unchanged**: today's one row. On a laptop the corner card stays today's;
   the open panel scrolls the days the same way (frames B5, B6).

### Alternatives

- **Share always sends today** (or has its own day picker). Simpler, but then the button
  under Sunday's rows sends Saturday — the one thing a Share button must never do.
- **Tabs per day inside the plan** instead of one scroll. Clear, but it is a second day
  switcher beside the dock's, and Kevin asked for scroll.

### Edge cases

- **ACL, two weekends and dated Late nights between** (frames B7, B8, B9, D5): dated heads,
  the date-span Earlier line, bare weeknights folded, dated share words.
- **Reduce Motion**: the head's turn is instant; everything else the shelf already does
  instantly there.
- **Rooms hidden in the Show menu** re-plan every day at once (rule 8), including the
  Earlier line's days ("Earlier · Fri" once Afters is hidden: frame C2).

## C. The menus while the plan is open

### Recommendation

1. **Both menus open over the open plan.** `openShowMenu` no longer calls `closePlan()`;
   the people menu rides the same path. A menu still takes no history entry. Every change
   re-plans through the existing repaint (`planDirty`): hiding a room re-routes (rule 8),
   the view changes nothing in the plan. The people menu's "Our picks" row shows only
   while the plan is closed (`menuHasPlan = planHere() && !planIsOpen()`).
2. **A highlight filters** (rule 10). Bodies are still seated on the whole crew (one body,
   one place, whoever is looking); then only the highlighted people's seats are counted.
   Whether a place is theirs is `passesPeople(picks, name, people)` — v103's one predicate,
   so the List and the plan never disagree about who picked what.
3. **The bar: "two is together."** `barForGroup(n)`: one person → 1 (their own day); two
   or more → max(2, ceil(n/4)), so 2–8 people → 2, 9–12 → 3, and nine of nine is the
   crew's own 3. The brief started at bar 1 for two or three; frame C7a shows why not: at
   bar 1 every lone choice becomes a stop and an "or" (Fatboy Slim "with Hal" three times,
   13 stops), and the Share would send one person's set as "Our picks". At 2 the three's
   Saturday is Robyn, Dog Blood, Soulwax with "Between sets · Despacio" where two of them
   drift (frame C7), and a pair reads as the four sets they share (frame C13).
4. **The rows say who.** The count is "2 of 3" (nothing when every stop must hold all of
   them — one person, or a pair — since it would never change). When some of the
   group are there and not all, the place line names them: "Crane Stage · you + Hal". The
   faces on MOST rows are off under a highlight (they said it twice; for one person they
   are always that person).
5. **One person** sees their own day, with the picks they give up as "or" lines (`alt`):
   Gus: DJ Shadow NOW, Kettama "or Fatboy Slim", Fatboy Slim, Between sets · Despacio,
   Prospa "or Audio"… (frame C6).
6. **The head says whose plan it is**: `SAT OUR PICKS · SEP 26 · YOU, CY + HAL`, "JUST
   GUS", "5 OF US"; the laptop corner likewise.
7. **The Share under a highlight** sends what you are looking at, still with no names:
   "Our picks for Sat Portola…" for a group, "Picks for Sat Portola…" for one person. Its
   link opens on everyone's plan (a highlight never rides in a link — it would carry
   names), and the foot says so: "Opens on everyone's picks" (frames D3, D4).

### Where the build switches to v103

- `js/v3/plan.js`: `import { FEST_ROOM, passesPeople } from './filters.js'` — already v103's
  function, unchanged; nothing to switch. Keep it the only "theirs" test.
- `js/v3/app.js`: `thinnedWordsLocal` is a DESIGN-ONLY copy of v103's wall.js
  `thinnedWords`; the build imports v103's and deletes the copy.
- The List's filter and the plan must read the same `ctx.filterPeople`; v104 lands first
  (after the Share), then this.

### Alternative

- **Keep the dim** (today's behaviour: the crew's route, rows the highlighted people are
  not in dimmed; frame C8). It never changes the route, but it answers "where is the crew"
  when the question was "where are we".

### Edge cases

- **A highlight of one person with no picks today**: today's line reads "Nothing Gus
  picked". The peek follows the existing rule (it may name their first stop tomorrow,
  never later); with no peek a closed shelf leaves (animated out), and an open plan stays
  open on today with the later days under their heads.
- **A highlighted person with no picks at all** is not in the group (`usOf`); the head
  still names them ("just Eli") and every day says "Nothing Eli picked".
- **Everyone highlighted**: bar 3 for nine, the crew's own route, counts read "N of 9".

## What changes in code (the prototype, 2026-09-26)

- `js/v3/plan.js`: rules 9 and 10 in the header; `dropIn` through `weekPlaces` /
  `roomsAndParties`; `slicesOf` (seating key, `aheadAt`, `drops`, group counting, solo
  `alt`); `routeOf` (drift captions, tier by group size); `night()` (`dropIns`, `why`);
  `planOf({ people, dropIn, groupBar })`; `barForGroup`.
- `js/v3/plan-rows.js`: `planDays`, day heads, empty lines, `dropInRow`, drift rows, who on
  the place line, `stopKey` carries the night (the same place and minute can recur on
  another night in one list), Share words per group.
- `js/v3/plan-shelf.js`: `nightAtTop`, `paintHead` (the turn), `fitTail`, Share per day,
  resting Share.
- `js/v3/app.js`: `planAnswer` (dayOf, emptyWords, who), `openShowMenu` keeps the plan,
  the highlight feeds `planOf`, `opensForHighlight`.
- `assets/v3.css`: `.plan-day`, `.plan-row.empty / .dropin / .drift`, `.with`, the resting
  Share, the Earlier line centred on the touch floor.
- `data/festivals/portola-2026.json`: three `"dropIn": true`.
- `api/_lib/festival-rules.mjs`: the boolean check and the one-set nudge.

**DESIGN-ONLY, the build deletes:** `window.__planDesign` (`dropIn`, `filter`, `groupBar`)
read in app.js; `planOf`'s `dropIn: 'shape' | 'light' | 'today'` and `groupBar`;
`lightTouch()` and `backRow` (the rejected lighter touch); `thinnedWordsLocal`.

**FYI for the build, not this round's:** the Share's times can read earlier than the
row's (Mochakk "5:35pm" in the text, 6 PM on the row; Fatboy Slim 7:55 vs 8:30) because
`planPicks` takes a place's first time as ours, forks included. Both are true (the set's
start vs when the bodies arrive); worth one look when the Share is next touched.

**Tests** (`npm test`: 1257, 4 fail, all expected): the highlight-dims test (rule 10
replaces the dim), the people menu's Our picks row with the plan open (the row now waits
for the plan to close), the welcome card (a cascade of the first), and the service-worker
stamp (this round may not stamp). The validator's nudge passes the whole rules suite. The fold-focus test was updated for the new `stopKey`
and passes: a keyboard on a stop that folds still lands on the Earlier line. The build
adds model goldens for rule 9 (the Despacio crew's three nights) and rule 10 (one, two,
three, five), and browser tests for the head's turn and the per-day Share.

## The frames (43, `node frames.mjs`; every report line checked, 0 misses, 2026-09-26)

Phone frames are 390×844 with touch input; laptop frames 1280×800 with a mouse. Clocks
are Portola Sat 3:15 PM and 6:45 PM, Fri 7 PM (PT), ACL Sun Oct 4 7 PM and Sat Oct 10
4 PM (CT). Scrolls are real finger drags that end still (a wheel on the laptop), menus
are real taps. `shots/` is git-ignored (the repo's image allowlist); re-run to rebuild.

- **A, Despacio:** A0-today-peek/open-315-390, A0-today-open-645-390, A0-today-open-315-1280,
  A0-today-corner-315-1280; A1-declared-peek/open-315-390, A1-declared-open-645-390,
  A1-declared-open-315-1280, A1-declared-corner-315-1280; A3-light-open-315/645-390;
  Friday: A0-today-fri-7pm-390, A1-declared-fri-7pm-390, A2-shape-fri-7pm-390.
- **B, the days:** B1-days-sat-645-390, B2-days-into-sun-390, B3-days-sun-top-390,
  B4-earlier-open-390, B5-days-sun-1280, B6-days-sat-1280, B7-acl-w2-sat-390,
  B8-acl-w1-sun-390, B9-acl-w1-sun-oct9-390.
- **C, the menus:** C1/C10-show-menu-over-open (390/1280), C2-afters-hidden-390,
  C3-afters-hidden-closed-390, C4-people-menu-over-open-390, C5-just-gus-menu-390,
  C6/C12-just-gus (390/1280), C7/C11-three (390/1280), C7a-three-bar1-390, C13-pair-390,
  C8-today-dim-gus-390, C9-five-390.
- **D, the Share's words:** D1-share-sat-390, D2-share-sun-390, D3-share-three-390,
  D4-share-gus-390 (each report carries the text it handed the sheet, link redacted),
  D5-acl-bare-day-390.

## Questions only Kevin can answer (each with my default)

- **A1.** Drop-in rooms are declared in the festival file, never guessed. *Default: yes.*
- **A2.** A must on a drop-in room still yields to real picks (it is on all day).
  *Default: yes.*
- **A3.** The drop-in is never the peek's NOW, even when nothing else is on; the open
  plan's line carries it. *Default: yes.*
- **A4.** The Share leaves drop-in rooms out (they are not a place to meet at a time).
  *Default: yes.* The other way: one closing line, "Despacio · drop in all afternoon".
- **A5.** Friday's Pier 80 invite is declared a drop-in too, and a Despacio pick keeps
  counting there (its name is a frozen pick key). *Default: yes.*
- **A6.** The words: "drop in till 9:45 PM" and "Between sets · Despacio". *Default: yes.*
- **B1.** The Share sends the day at the top of the view and the button names it.
  *Default: yes.*
- **B2.** Later days under the wall's day heads; bare days fold into one line with why.
  *Default: yes.*
- **B3.** Laptop: the panel scrolls the days the same way; the corner card stays today's.
  *Default: yes.*
- **B4.** Past three nights behind, Earlier shows a date span (ACL). *Default: yes.*
- **C1.** Both menus open over the open plan and re-plan it live. *Default: yes.*
- **C2.** A highlight filters the plan to those people (not a dim). *Default: yes.*
- **C3.** Group bar "two is together" (2 for 2–8 people) rather than the brief's 1 for two
  or three. *Default: two is together.* Compare frames C7 and C7a.
- **C4.** Under a highlight the place line names who; faces are off. *Default: yes.*
- **C5.** The Share under a highlight sends that group's route, unnamed ("Our picks" /
  "Picks"), and the foot says the link opens on everyone's picks. *Default: yes.*
- **C6** (a second opinion, from the session building the Share). From five highlighted
  people up, the bar is the crew's own, `barFor(n)` (at least three together), not
  `barForGroup`'s two: as drawn, eight highlighted need two while nine need three, so
  five friends get a busier plan as a highlight than as a crew of their own. *Default:
  yes*; the design round's version keeps two up to eight.

Published for Kevin on 2026-09-26 as https://claude.ai/artifact/PZPqA9buY6JZSSsVqrZUmy
(login kevin.hq@tecovas.com), with a note that the Share release now carries the plan
link's day and filters a highlighted Share to the highlighted people's picks.
