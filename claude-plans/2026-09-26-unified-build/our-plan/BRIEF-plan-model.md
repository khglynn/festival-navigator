# Brief — `js/v3/plan.js`, the Our plan model (written 2026-09-26 ~5:45 AM PT)

For: one Opus builder, started by the Our plan build session (the "orchestrator" below).
Worktree: `/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/plan`,
branch `live/plan`. Stay in it; use absolute paths (a stray `cd` has moved the shell twice today).

## What this is and why

Our plan is a feature for a festival crew: from everyone's picks, it works out where most of us
will be at each point of a day, as a route of stops, and shows it as one row above the phone's dock
(the "peek") that drags up into the whole day. Kevin approved the rules and the look in three design
rounds; the rules live in a working prototype model,
`claude-plans/2026-09-25-portola-live/design/ours-r2/ours-model.mjs` (356 lines, runs in Node).
Your job is to port that model into the app as a pure module, fixed so it is right on every
festival we run — including ACL (two weekends, a dated Late nights tab, starting Tue Sep 29),
where the prototype is wrong in four ways — and to prove it with tests.

The orchestrator builds the UI on top of your module at the same time, so the API below matters:
if you need to change it, change it, and say so at the top of your log.

Read first, in this order:
1. `claude-plans/2026-09-26-unified-build/our-plan/map-design-model-port.md` — the model's
   algorithm line by line (§1), the four ACL bugs and three more the port must fix (§2, §2a), the
   port sketch (§2b, §2c), and the golden output of the prototype on Portola (§5).
2. The prototype itself, `ours-model.mjs`, and `print-route.mjs` beside it (the golden run).
3. `js/v3/wall.js` `wallPlanFor` / `roomsOf` (around line 1380), `nightMinutes` (~1776), the grid
   cell's `occ` (~1302); `js/v3/events.js` `venueGroupsOf`, `timeBandsOf`, `sectionLayoutOf`,
   `occOf`, `eventModelOf`; `js/time.js` `computeDayArtists`; `js/state.js` `getDayArtists` (the
   weekend filter, ~408); `js/v3/now.js` `festivalClock`, `clockLabel`.

## The deliverable

1. `js/v3/plan.js` — pure: no DOM, no `state.js` import, no storage, no network. It may import
   from `events.js`, `wall.js` (exported functions only), `now.js`, `time.js`, `filters.js`.
2. `tests/plan-model.test.mjs` (+ `tests/fixtures/plan-crew-nine.json`, the made-up nine's picks
   copied out of the design folder's `crew.mjs` — placeholder names Ana..Ivy only).
3. A log you write FIRST and grow as you go:
   `claude-plans/2026-09-26-unified-build/our-plan/plan-model-log.md` — API as built, each decision
   you made and why, every difference from the golden numbers with the rule that caused it,
   measurements, open questions.

Do not edit `app.js`, `wall.js`, `events.js`, `index.html`, any CSS, `sw.js`, or docs outside
`our-plan/`. The List build (another session) is editing wall.js and app.js right now. If you need
something that is private in wall.js or events.js, adding the word `export` is the one allowed
edit — name it in the commit message.

## The API (the orchestrator's UI codes against this)

```js
export const STEP = 5, FLOOR_MIN = 3, FLOOR_SHARE = 1 / 4, MIN_STOP = 15, CHANGEOVER = 20;
export const barFor = (n) => Math.max(FLOOR_MIN, Math.ceil(n * FLOOR_SHARE));
export function usOf(picks, members) {}

// picks: model.picksFor(doc, fid) — { artist: { person: level 1..4 } }
// members: active member names (state.activePeople().map(([n]) => n))
// folded: the Show menu's keys (ctx.folded)
export function planOf(fest, { picks, members, folded = [] }) {}
//  → { us, bar, available,
//      nights: [{ id, iso, days: [weekDay…], extraKeys: [...] }]   // ISO order
//      night(id) → { id, iso, items: Item[], stops: n }            // lazy, memoized
//      playsAt: Map<act, [{ nightId, place, from, kind }]> }
export function planAt(plan, fest, date) {}   // → { night, minutes, current, here, scattered, next, later } | null
export function peekOf(plan, fest, date) {}   // → { night, stop, tag: 'now'|'next', count, today } | null
export function forkFor(stop, bar, nowMin = null) {}   // r3-proto.mjs:122-126, unchanged
export function headlinersOf(stop, picks) {}           // unchanged
export function tillOf(stop) {}                         // the NOW row's end: a set's own end, a room's stop end
export function alsoOf(stop, plan) {}                   // [{ nightId, from, sameNight }] for the row's "also …"
export function quietClock(min) {}                      // "9 PM", "9:40 PM" — clockLabel with ":00" dropped
```

`Item` keeps the prototype's shape (map §1b): `{ kind: 'scattered', from, to }` or
`{ kind: 'stop', tier, place, placeKind: 'set'|'room'|'party', from, to, count, people, musts,
maybe, leansOnDoubles, alsoAt, timeline, forks, acts }` — each act carrying `occ` in the shape the
wall gives the same card (grid: `{ day, stage, time, weekend }` as wall.js ~1302; rooms and parties:
`occOf(entry)`), because the UI draws each node with the card's own facts from that `occ`.

## The decisions already made (build these; argue in the log if one is wrong)

1. **Windows are the wall's own, by construction.** Grid sets: `computeDayArtists` on the day's
   sets filtered the way `state.getDayArtists` filters by weekend (so an unprinted end is the next
   set on the stage clamped 30–120, else +75 — the same as the wall's glow; the prototype's +60 is
   gone). By-venue rooms: `venueGroupsOf` members' `nowFrom`/`nowTo`, room start `doors ?? first
   nowFrom`, end `close ?? last nowTo` (prototype rule 4). By-time sections
   (`sectionLayoutOf(fest, key) === 'by-time'`, Folsom): one `party` place per entry with the
   `timeBandsOf` window (a party's printed end wins). A test proves the plan's windows equal the
   Board wall's `data-now-from/to` (below).
2. **Nights are keyed by ISO date**, from `wallPlanFor(fest, { folded: [] })` — the week the wall
   draws. A night merges every grid day with that ISO, every section entry on those days, and every
   dated extra's entries for that ISO (ACL's Late nights share five dates with grid days; five are
   Late-nights-only, and those get a plan like any night — the rule as written: three of us picked
   shows there). A day with no ISO keys by its `day.key`. Order by ISO. No grid and no dated rooms
   (a lineup fest, Seismic) → no nights.
3. **Room keys are the Show menu's keys**: grid sets `weekendRoom(d.weekend)` on a two-weekend fest,
   `FEST_ROOM` otherwise; section places their section key(s); dated extras their extra key.
4. **Rule 8 by reusing the wall**: place bodies on `whole = wallPlanFor(fest, { folded: [] })`;
   a place is shown iff `shown = wallPlanFor(fest, { folded })` still has it (map §2b gives the
   three tests). That inherits the inert `:fest` on ACL and the one-room rule for free.
5. **A two-section show is one place** ("Afters & Folsom" appears under both sections — dedupe by
   the entry, union its room keys; it stays shown while either section is shown). If any of its
   sections is by-venue it joins that venue-night room; else it is a party.
6. **Rule 5 on ACL (PLAN Q5)**: the same set on the other weekend is not "playing twice". Identity
   for a grid play: `stage|weekday` (so W1 and W2 at the same stage on the same weekday are one
   play, whether or not the time moved); a room or party: `venue|iso`. A different place counts.
   Log how many stops on your made-up ACL crew carry `alsoAt` under this rule.
7. **After-hours past 5 AM**: `planAt` asks the previous night too, through
   `nightMinutes(prevIso, festivalClock(date, fest.timezone))`; if the previous night has a current
   stop, that night wins (Aftershock runs 3–10 AM "Saturday").
8. **peekOf** = the prototype's (r3-proto.mjs:129-135: current → NOW with the count at this minute;
   else the first MOST stop still to come, else the next stop → NEXT with its peak) on the plan
   night; when today's night has nothing left, the next night that has a stop, with `today: false`
   (whether the UI shows a future night is a review question — the model answers it).
9. **Activities and billed names without a grid set are not places** (the prototype's rule).
10. **The people filter (highlight) does not change the plan** — the plan is the whole crew.
11. **Lazy nights**: `planOf` builds places and `playsAt` for the week (cheap) and computes a
    night's route on first `night(id)`; memoize. Measure Portola Saturday and ACL Friday W1 and log
    the milliseconds.

## Tests (all must pass at three clocks — never let a test read the real clock)

The gate runs `npm test`, `TZ=Asia/Tokyo npm test`, and
`NIGHT_CLOCK=2026-09-27T04:30:00Z NODE_OPTIONS="--import ./tests/helpers/night-clock.mjs" npm test`.
Pass dates explicitly everywhere. (`tests/app-shell-complete.test.mjs`'s stamp check is red on this
branch on purpose — the coordinator stamps at release. Everything else must be green; the
baseline after this morning's merge is 1070 pass, 1 fail, which is that one.)

1. **Golden**: Portola + the made-up nine, folded `[]` and `['Folsom']`. Assert per night the stops'
   (place, from, to, count, tier). Where the port's fixes move a number (by-time Folsom parties,
   printed ends, dedupe), assert the NEW value and write each difference and its cause in the log.
   Expected unchanged unless a fix explains it: Thu 1 stop, Sat 12 stops, the Saturday headline
   stops (Tove Lo 5:40 PM 6, Robyn 7:10 PM 7, Dog Blood 9 PM 8), and "with Folsom hidden, Mochakk's
   stop starts 5:35 PM" (bodies placed before hiding).
2. **Windows equal the wall's**: render the Board wall in jsdom the way `tests/list-view.test.mjs`
   does, for Portola Friday and Saturday; every `.card[data-now-from]` that the plan also holds as an
   act has the same from/to.
3. **ACL, made-up crew** (write one in the test; placeholder names, the real `acl-2026.json`):
   nights in ISO order starting 2026-09-29; no two grid places of one weekend overlap on one stage
   (the prototype had 41 such overlaps); Late nights shows are places on their dates; hiding
   `weekend:W1` removes W1's stops but not the bodies; a stale `:fest` hides nothing; rule 5 as
   decision 6.
4. **Rules on tiny synthetic fests**: the bar (9→3, 13→4, 17→5); US ignores non-members and
   people with no pick; the placement key (level, then crowd, then staying put, then the later
   start); the 15-minute blip fold; scattered under 20 minutes removed; forks under 15 dropped;
   most is strictly more than half; `leansOnDoubles`; `headlinersOf`; `forkFor` even vs biggest;
   `planAt` after-hours on the previous night; `peekOf` now / most-first / next night /
   null; `quietClock` ("9 PM", "9:40 PM", "12 AM", "12:30 AM").
5. **No plan where there is no clock**: Seismic 9 and a lineup-only fest → no nights, `peekOf` null.

## Working rules

1. Bank as you go: create the log before any code; commit on `live/plan` after each coherent piece
   (scope-prefixed messages — `plan:`, `tests:`, `plans:` — never "wip"), and push:
   `git push -q origin live/plan`. Commit ONLY your own paths with a pathspec
   (`git commit -m "…" -- js/v3/plan.js tests/plan-model.test.mjs …`): the orchestrator commits
   docs in the same worktree at the same time.
2. This repo is PUBLIC. Before each commit scan the staged diff for a crew token with `&&`:
   `! git diff --cached | grep -nE '#g=[A-Za-z0-9_-]{16,}' && git commit …`
3. No network, no database, no real crew links, no browser. Don't run `node scripts/sw-stamp.mjs`.
4. Don't start agents or teammates of your own.
5. End with a final message listing: the commit SHAs; the three clocks' pass/fail counts; the API as
   built (any change from above, first); the golden differences with causes; the timings; and the
   questions you could not settle.

Every claim in the log is checked by the orchestrator against the code, so write what you verified,
and say so where you did not.
