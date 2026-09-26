# plan.js build log — the Our plan model (2026-09-26)

Builder: one Opus agent, brief `BRIEF-plan-model.md` beside this file. Worktree
`.claude/worktrees/plan`, branch `live/plan`. Files: `js/v3/plan.js`,
`tests/plan-model.test.mjs` (35 tests), `tests/fixtures/plan-crew-nine.json`.

## API changes from the brief (read this first, orchestrator)

Decided before the first line of code; unchanged since. Every name and argument in the brief's
API block exists as written. These are the choices the brief left open, and the additions.

1. **`stop.place` is the Place OBJECT, as in the prototype** (map §1b), not a string:
   `stop.place.place` is the stage or venue name, `stop.place.kind` the kind, `stop.place.acts`
   the acts. The brief's `placeKind` and `acts` are ALSO on the stop (copies of
   `stop.place.kind` / the same array as `stop.place.acts`). Forks carry the same `place` object
   plus `placeKind`. (plan-rows.js already reads both forms.)
2. **Additions (additive, nothing renamed):**
   - `stop.nightId` — the night the stop is in (what `alsoOf` compares against).
   - `plan.places` — every place of the week, hidden ones included, each with `shown`.
   - `plan.folded` — the fold the plan was built with.
   - each `nights[]` entry and each `night(id)` result carries `wd` ('Tue' — from the ISO date
     when there is one; a Late-nights-only date has no week day to borrow it from).
   - `playsAt` entries: `{ nightId, place, from, kind, play, shown }` (`play` = the rule-5
     identity, decision 6). Here `place` is the stage or venue NAME (a string), unlike
     `stop.place` — an entry points at a play, not at a routed place.
   - `alsoAt` entries: `{ act, nightId, place, from, kind, play, shown }` (`place` a name, as
     in `playsAt`).
   - each act: `{ name, from, to, time, approx, occ, play, section }` — `section` is the section
     or extra key whose list gave the act its window (null for a grid set).
3. **Under three of us (`available: false`)**: `nights: []`, `night(id)` → null, `playsAt` an
   empty Map (never undefined), `places: []`.
4. **`nights[].days` / `extraKeys` are the SHOWN week's** (the fold applied): with `weekend:W1`
   hidden, Oct 2's entry lists no days and `['Late nights']`.

Place: `{ id, nightId, kind: 'set'|'room'|'party', place, room, start, end, approx,
roomKeys, shown, dayKey|null, acts, doors?, close? }`. An act's `from`/`to` are null for an
untimed act in a timed room (rule 4 then seats its pickers for the whole room, as the
prototype did).

## Results (all verified by running them)

- **Golden: zero differences.** The port's output for the made-up nine on Portola is
  byte-identical to `print-route.mjs` (prototype) for both folded `[]` and `['Folsom']`
  (diffed line by line in a scratch run; the same `portola-2026.json`, md5 e5fb4ad3…). Thu 1,
  Fri 2, Sat 12, Sun 11 stops (13 with Folsom hidden); Tove Lo 5:40 PM 6, Robyn 7:10 PM 7,
  Dog Blood 9 PM 8; Mochakk from 5:35 PM with Folsom hidden. The test asserts every stop's
  tier, from, to, count and place.
- **Suite, on committed HEAD 5d283c5, in a clean `git archive` copy** (so the orchestrator's
  uncommitted UI work in the shared worktree is not in it): `npm test` 1105 pass / 1 fail /
  1 skipped; `TZ=Asia/Tokyo npm test` the same; the NIGHT_CLOCK run the same (first run on
  370e993 gave the identical counts; 5d283c5 only removed two internal fields nothing read). The one fail is
  `app-shell-complete`'s stamp check (red on purpose); the skip is `db-concurrency` (needs
  DATABASE_URL). 1070 baseline + 35 new = 1105.
- **Mutation check** (in the scratch copy, never the shared tree): 16 deliberate breaks of
  plan.js that change behaviour, each caught by at least one test — no stay-put, earlier start wins, crowd before
  level, grid +60, no weekend filter, no previous-night rule, "also" naming hidden plays, play
  identity by night, fold applied before seating, most at exactly half, no blip fold, no
  dedupe, Folsom read as rooms, peek without MOST-first, strays dropped, nights listed only
  where a clock place is.
- **Timings** (Apple M2 Pro, Node 26.9; `planOf` builds the week's places and `playsAt`,
  `night(id)` routes one night):

  | | planOf | night(id) | memoized night |
  |---|---|---|---|
  | Portola Saturday, cold (first call in a process) | 5.6–6.0 ms | 5.5–7.0 ms | 0.007 ms |
  | Portola Saturday, warm (median of 40) | 0.93 ms | 1.86 ms | |
  | ACL Friday W1, cold | 1.4–1.5 ms | 1.0 ms | 0.001 ms |
  | ACL Friday W1, warm | 0.53 ms | 0.32 ms | |
  | Whole week, warm (planOf + every night) | Portola 4.7 ms · ACL 2.3 ms | | |

## Where the port moves the prototype's numbers (and why the golden did not move)

Measured by running the prototype's `placesOf` and the port on the same files:

1. **Portola, by-time Folsom (v94).** Every Folsom show is its own party with the
   `timeBandsOf` window (printed end wins). Against the prototype: 195 acts in both, none
   added or dropped; **9 act windows change** (all Folsom parties whose printed end came before
   the next party at the same venue — e.g. Fri The Stud BARK BEFORE DARK 5–10 PM → 5–9 PM,
   Sat DNA Lounge Big Muscle 1–10 PM → 1–7 PM) and **20 place spans change** (the prototype's
   10 merged venue-nights split into their parties — Fri The Stud 5 PM–2 AM becomes 5–9 PM and
   10 PM–2 AM). Rooms 77 → 24 Afters rooms + 64 parties. **Why no golden number moved:** the
   nine's Folsom picks are the Street Fair (alone at its venue, printed 11 AM–6 PM, the same
   window either way), BRUT SF (Hal only), Real Bad 37 (Hal and Cy — under the bar), and Horse
   Meat Disco (billed to Afters too, so it joins the Afters room, as the prototype's single
   read of `fest.artists` also had it).
2. **Printed ends / the grid rule.** Portola's 63 grid sets all print their ends, so
   `computeDayArtists` gives the prototype's numbers. On ACL the 12 unprinted closer occurrences
   glow +75 (Skrillex 8:15–9:30 PM; the prototype said 9:15).
3. **Dedupe of two-section shows.** The prototype read `fest.artists` once, so it never
   double-seated; the port reads the wall's section lists (where "Afters & Folsom" appears
   twice) and dedupes by card identity. Nothing to move — the test proves HMD is one act.
4. **ACL.** The prototype's 41 same-stage overlaps (re-verified: 133 set places, 41 overlaps,
   0 rooms) become 0 (182 set places = 49 untagged × 2 weekends + 42 × 2 tagged); nights go from
   Fri/Sat/Sun to 11 dates; one Late nights room exists (see open question 1).

## Decisions (each built; the brief's numbering where it applies)

1. **Windows are the wall's, by construction** (brief 1). Grid: `computeDayArtists` on the
   weekend-filtered sets, `endMin ?? startMin + 60` exactly as wall.js's `liveTo`. Rooms:
   `venueGroupsOf` on the SAME list the wall's stack gets (the section's `byDay` list, no
   fallback venue). Parties: `timeBandsOf` on the by-time list, as `timeGroups` calls it.
   Proven by the jsdom test that renders the Board and compares every `.card[data-now-from]`:
   Portola Friday + Saturday (110 cards matched), ACL both Fridays (60) + the Oct 10 Late
   night, and a synthetic stray fest (3). It also asserts the reverse: every timed act in the plan has its card.
2. **A set whose stage is not a column (a "stray") is a place with the STACK's window**, read
   the way the wall draws it (`festRoomExtras` → `venueGroupsOf` over strays + billed names +
   activities, fallback venue = the fest's site). No live festival has one; a synthetic test
   renders the wall and proves the match (6 PM stray runs to the next stray at 9 PM, not the
   grid's 120-minute cap). Billed names and activities are never places (brief 9).
3. **Nights** (brief 2, refined): keyed by ISO (or `day.key` without one), ordered by date,
   un-dated nights after in week order. **A night is listed when the SHOWN wall has a grid or a
   room on that date** — a grid day (fest room shown), a section's night, a dated extra's date.
   So ACL lists all 11 dates from Tue Sep 29, including the five Late-nights-only ones whose
   shows print doors only: they are nights with zero stops, not missing dates. A lineup's
   billing day is not a night (Seismic, a lineup with day labels → no nights), and a date
   whose every room is hidden is not a night.
4. **Rooms**: one per venue per night; if two by-venue lists bring acts to one venue on one
   night (none today) they merge, each act keeping the window its own list gave it. Start
   `doors ?? first nowFrom`, end `close ?? last nowTo`, `+1440` if end ≤ start; a group with
   neither is not a place (prototype rule 4). Cancelled members are not acts.
5. **Two-section shows** (brief 5): one place per card identity (`name` + `occOf`), room keys
   = every section it appears in that night; joins a by-venue room if any of its sections reads
   by venue, else it is a party.
6. **Rule 5 identity** (brief 6): grid `stage|weekday`, room/party `venue|iso`. On the made-up
   ACL crew **7 of 22 stops carry `alsoAt`** (Faouzia ×2, Arcy Drive ×2, Fcukers ×3); Paris
   Paloma (W1 3:15 / W2 5:15, both Miller Lite), Ryan Beatty and every untagged set are one
   play and carry none.
7. **Rule 8 reaches "also"** (mine): `alsoAt` never names a play in a hidden room — the rule's
   text is "never appears in OURS: not as a stop, a fork, a count or a line". The stop still
   says `leansOnDoubles`; `playsAt` keeps the hidden play with `shown: false`. (Portola, Afters
   hidden: Fatboy Slim's Sat stop keeps its crowd and loses "also Sun".) The prototype did not
   filter — argue if you disagree.
8. **After-hours** (brief 7, widened): the previous night wins while **any of its stops is
   still to run** (`to > nightMinutes(prev, clock)`), not only while one is current — a gap
   between two after-hours stops at 5:10 AM would otherwise hand the peek to the next day's
   11 AM with a 5:30 AM stop still coming. Same answer as the brief whenever a stop is current.
9. **peekOf** (brief 8): as the prototype, plus the next night that has a stop with
   `today: false` — also BEFORE the festival (Oct 1 → the first night's MOST stop), and `null`
   after it. Nights without an ISO date (Electric Forest, Lolla 2025) never peek: there is no
   date to stand on.
10. **The week** comes from `wallPlanFor(fest, { sort: 'billing', query: '', folded })`:
    `billing` is the app's default sort; it matters only on a lineup fest.
11. **quietClock** = `clockLabel(min).replace(':00 ', ' ')` — identical to the prototype's
    `clock()` on every minute tested (9 PM, 9:40 PM, 12 AM, 12:30 AM, 12 PM, 1:05 AM).
12. **tillOf**: a set's or a party's own end (`acts[0].to`); a room's stop end.
13. **alsoOf** order: same-night plays first by time, then other nights in date order; each
    night once.

## Since main's data release #56 (merged into live/plan 2026-09-26, ~9 AM PT)

The model did not change; the data under it did, and eight tests moved with it
(`tests/plan-model.test.mjs` says why at each line).

1. **Portola, Regency laid out as concerts** (`portola-2026.json` md5 e5fb4ad3… → af994fcc…).
   Each Regency act starts earlier, so three golden lines moved: Thu's Soulwax stop starts
   9:30 PM (was 10:30); Fri's Regency stop ends 8:45 PM, where Jyoty now starts (it ended at
   9 PM); Sat's Parcels at
   10 PM (was 10:45) takes Cy off Soulwax at 10:15, so that stop is some-4, not most-5.
   Soulwax's "also" now says Thu 9:30 PM.
2. **ACL Late nights all have times** (posted, or written by `scripts/guess-run-times.mjs` and
   marked approx). Open question 1 below is answered by data, as it proposed: 40 Late nights
   rooms (one per date and venue) where there was one; every one of the 66 shows has a card
   whose window matches the plan's (the windows test now covers every ACL night: 248 cards,
   exactly the plan's timed acts). The made-up crew's stops per night went
   `[0,0,6,3,2,0,0,0,5,4,2]` → `[1,1,6,3,5,0,0,1,5,4,2]`; stops with an "also" 7 of 22 → 16 of
   28; `playsAt` holds 45 artists (was 3); Fcukers on Oct 10 is 11:45 PM–2 AM (Devil May Care
   posts 11:45; the old 10 PM was doors). The doors-only rule is kept on a synthetic festival.
3. **New open question 7 below** — a Late night that starts while the festival still plays
   sends the route across town and back.

## Rule 3's trip (built 2026-09-26, ~10:45 AM PT — Kevin's answer to open question 7)

Kevin: "Build it: move only for something better, never back … don't overengineer for
stuff like that. Just make sure the filters for locations work apply here."

1. **The rule** (`slicesOf` in `js/v3/plan.js`): a SITE is the grounds (every grid set and
   stray of the festival's own) or one venue (its room or its parties). Within a site,
   rule 3 is unchanged. A person changes site only for a live pick at a level above the
   most they want anything of theirs not yet over at their site, and one they would catch
   (item 5), or once nothing of theirs is left there; and a site they left that night is
   never a candidate again. A person's first site is simply their first live pick.
2. **What moved on the made-up crews** (each re-pinned with its reason in
   `tests/plan-model.test.mjs`):
   a. Portola Sat: Cy stays at Parcels (3) to its end instead of leaving at 10:30 for
      Public Works (also 3), so Soulwax runs 10:15–10:55 PM and Public Works starts 10:55.
   b. Portola Sun: Eli stays at Public Works through Overmono (3) instead of leaving at
      1:30 AM for SG Lewis (3), so the Great Northern stop is 3, not 4.
   c. ACL Sun Oct 4: five stops (Scoot Inn, Tito's, Scoot Inn, T-Mobile, Scoot Inn) become
      two (Tito's 6:30, T-Mobile 8:30) with a scattered hour between. Ada goes to Ryan
      Beatty at 6 and leaves for The xx (wanted more), Bo stays at the Scoot Inn through
      Fcukers (both 3), Cal waits at Zilker for The xx and goes after it; two at the Scoot
      Inn is under the bar. Stops per ACL night: `[1,1,6,3,2,0,0,1,5,4,2]`; stops with an
      "also": 25 / 13 (was 28 / 16).
   d. Hiding W1 now leaves Sun Oct 4 as a night with no stop (it had three Scoot Inn stops).
3. **The location filters** (Kevin's condition): hidden rooms still never appear as a
   stop, fork, count or "also" (rule 8), and bodies are still seated on the whole festival
   first, so hiding a room never re-seats its crowd somewhere you can see. The trip runs
   in that seating, before the fold: a hidden Late night takes someone off Zilker (or keeps
   them from it) on exactly the terms a shown one would, and hiding it changes only what
   the plan shows, never where anyone is. (An earlier line here said hidden rooms "pull
   fewer people off the grounds, never more" — Sol: people who start the night at a hidden
   room can be held there by it, so no direction holds.)
4. Synthetic tests pin the rule itself: a tie stays, a higher pick goes, nothing left
   goes; never back (with a pick at the old site that every other rule would go back
   for); a must that is over holds nobody; never for a tail. Each fails with its own
   clause removed (checked by hand, 2026-09-26).
5. **Sol's round** (11:10 AM). What a site weighs against a move was a stretch's level —
   the most a person wants anything there — held until their last pick there ended, so a
   6 PM must kept a crew in a Club past an 8 PM set they wanted more than the Club's late
   level 2. Now it is `levelAt`: the most they want anything there that is not over yet
   (a room still holds a body from its first pick to its last, rule 4). Weighing that
   alone on Portola sent Ivy from Public Works (after Milli Meng, 2) to the last 15 minutes
   of Parcels (2, running since 10 PM) and stranded her before Fcukers — so a trip is also
   only for a pick they would catch: not started, or begun less than a changeover (20
   minutes) ago; once nothing of theirs is left where they are, anything live will do.
   Net on the made-up crews: no line moves; Ben now leaves Audio's Airwolf Paradise (1)
   for Chloé Caillet (3) at Public Works at 11:45 PM, where he used to arrive at 12:40.

## The highlight reaches the peek (built 2026-09-26, ~11 AM PT)

Kevin, on the one-NOW call: "the filters should filter the now too." The route is still
the whole crew's (rule 1; `planOf` takes no highlight). `hasAny(stop, people)` says whether
a stop is one of theirs — anyone of them in its crowd at any slice of it (its timeline); a
fork, in its peak crowd — and `peekOf(plan, fest, date, { people })` names only those:
NOW if the current stop is theirs, else the next of theirs (MOST first), else the next
night's, else nothing. The count on a NOW stays the crew's count at this minute. Pinned on
Portola Sat 9:40 PM: Ana → NOW Dog Blood 8; Gus → NEXT The Great Northern 1:30 AM 4;
nobody → null.

## Open questions (not settled here)

1. *(Answered 2026-09-26 by main's #56 — the Late nights now have times; see the section
   above.)* **ACL Late nights: 65 of 66 shows print doors only** (no `time`, no `close`), so the wall
   gives them no now window and the plan cannot seat anyone there. Only Fcukers, Oct 10, Devil
   May Care (doors 10 PM, close 2 AM) is a place. The five Late-nights-only dates are nights
   with no stops. The fix is data, not a guessed window in the renderer: closes (and run
   guesses) via `scripts/guess-run-times.mjs`, which records each as a reviewable diff. Until
   then "three of us picked a Tuesday show" produces no Tuesday plan. Kevin's call whether to
   run it before ACL (Tue Sep 29 is the first date).
2. **HMD's two windows.** In Afters it is a stack card (next member rule), in Folsom a party
   (printed end). The plan uses the Afters one (decision 5). Equal today (alone in the room);
   they could diverge if another Afters act joined Public Works that Friday.
3. **Board vs List for strays.** The List draws a stray through `timeBandsOf` (printed end
   wins), the Board through `venueGroupsOf` (next member wins); the plan follows the Board. No
   live festival has a stray.
4. **Morning grid sets.** Grid times use `timeToMinutes` (any AM +24 h), rooms use
   `activityMinutes` (before 9 AM +24 h); inherited from the wall, identical on all live data
   (no grid set starts between 5 AM and noon). A 10:30 AM grid set would land at 34:30.
5. **Show a future night's peek?** The model answers (`today: false`), app.js currently shows
   only tomorrow's. Before the festival the model points at the first night.
6. **sw.js**: once app.js imports plan.js, it belongs in APP_CORE and the stamp must be re-run
   (the coordinator's release step; I touched neither).
7. *(Answered and built 2026-09-26, ~10:45 AM: Kevin chose "move only for something better, never back" — see "Rule 3's trip" above.)* **A route across town and back (found 2026-09-26, after #56).** Rule 3 seats each person
   at their highest live pick every five minutes, and a room holds them from their first pick
   to their last. On Portola's made-up nine no route goes back to the grounds after a room
   (Saturday's Regency opens at 9 PM while the grid runs to 11, but whoever leaves for it
   stays). On ACL, 16 of the 41 Late nights acts on festival dates start before that day's
   last grid window ends (9:45–9:55 PM, the unprinted closers' +75); 10 of those times are
   posted, 6 are guesses, and most start at 9–9:30 PM, during the headliners. The early ones
   are the Scoot Inn's: Malcy and Fancy Hagood at 7 PM and Noga Erez at 8:30 PM posted, Finn
   Wolfhard and CMAT at 8 PM and Ryan Beatty at 6 PM guessed from doors. On the made-up crew,
   Sun Oct 4 reads Scoot Inn 6 PM →
   Tito's 6:30 → Scoot Inn 7:30 → T-Mobile 8:30 → Scoot Inn 9:45: Zilker to East Austin and
   back twice, which no one walks. Candidate rule, not built (it changes Kevin's approved
   rule 3): **a person changes site — the grounds, or one venue — only for a pick they want
   more, or when their site has nothing of theirs left, and never goes back to a site they
   left that night.** Each person then makes at most one trip per site, so the route can still
   cross town, but never back (not simulated on the example yet). Its cost: it can move
   Portola's approved lines (a person now leaves the grounds only for a higher pick or after
   their last grounds set), so it needs the goldens re-derived and Kevin's look. Kevin's call.


## Not verified here

- No real-browser run (by the brief: no browser). The windows test is jsdom against the real
  wall modules.
- The prototype's r3 UI behaviour (fork row, earlier fold) is the UI's; only `forkFor` is
  ported, unchanged, and unit-tested.
