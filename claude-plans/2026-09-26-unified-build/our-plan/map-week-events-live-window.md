# Map: the week, the events model, and when a set is over (head e1eb206)

Status: complete — sections 1-4 below (2026-09-26, head e1eb206).

## 1. The week in wall.js — what exists, what it touches, and the lift to week.js

All lines are `js/v3/wall.js` on e1eb206 unless named.

| Function | Lines | Exported | Pure? | Depends on |
|---|---|---|---|---|
| `splitDays(dayStr, knownDays)` | 720-731 | yes | pure | nothing |
| `knownDaysOf(fest)` | 733-744 | yes | pure | nothing (dayMeta keys, else atomic `artists[].day` in first-appearance order) |
| `groupByDay(artists, knownDays)` | 748-767 | yes | pure | `splitDays` |
| `applyWeekend(artists, weekend)` | 906-909 | yes | pure | nothing. NB filters on `a.weekends` (plural, the artists[] field) — while `weekendsOf` reads `days[d].artists[].weekend` (singular, the grid set field). Two different fields, both live. |
| `computeTimesLayout(fest)` | 932-945 | yes | pure | `model.canonicalStages`, `COL` (filters.js) |
| `weekendsOf(fest)` | 1355-1360 | yes | pure | nothing. **Duplicated** in `tests/helpers/fest-shapes.mjs:28-32` (hand copy, not an import). |
| `weekendRoom(w)` | 1364 | yes | pure | nothing (`weekend:W1`) |
| `wallPlanFor(fest, ctx)` | 1377-1415 | yes | pure (reads only fest + ctx.sort/weekend/folded) | `weekendsOf`, `applyWeekend`, `groupByDay`, `knownDaysOf`, `eventModelOf` (events.js), `roomsIn`, `weekendRoom`, `FEST_ROOM` (filters.js:91) |
| `roomsOf(fest, ctx)` | 1422-1426 | yes | pure | `wallPlanFor` (with `query:'', folded:[]`), `roomsIn` |
| `roomsIn(fest, model, weekends)` | 1429-1440 | no | pure | `weekendRoom`, `FEST_ROOM` |
| `festLinkLabel(fest)` | 1445 | yes | pure | nothing |
| `nothingVisible(plan)` | 1469 | no | pure | nothing (used 2298, 2524) |
| `dayTab(d)` | 1479 | no | pure | nothing (NB app.js:1359 has its OWN exported `dayTab` that builds a button — different function, same name) |
| `groupTab(fest)(day)` | 1481-1496 | no | pure | `dayLabelParts` (time.js) |
| `dayNavOf(fest, ctx, wallRoot=null)` | 1499-1524 | yes | pure when `wallRoot` omitted; with `wallRoot` + `ctx.query` it reads the DOM (`wallRoot.querySelectorAll(DAY_ANCHOR)`, 1522) | `wallPlanFor`, `dayTab`, `groupByDay`, `knownDaysOf`, `groupTab`, `DAY_ANCHOR` (2663, a selector string constant) |
| `DAY_ANCHOR` | 2663 | yes | const | — |

Import sites on this head (grep of js/, tests/, gallery.html, scripts/, index.html; scripts/ and gallery.html import none of these):
- `wallPlanFor`: js/v3/tools.js:6 (used :249 `planFor`), tests/hidden-parts.test.mjs:37.
- `applyWeekend`: js/v3/tools.js:6 (used :317); wall.js 1383, 2227, 2490, 2534.
- `roomsOf`: js/v3/app.js:12 (used 304, 306, 2043); tests/hidden-parts.test.mjs:37, tests/by-time.test.mjs:33; (tests/portola-events.test.mjs:62 defines its OWN local `roomsOf` — a venue-room helper, unrelated; shell-v4.test.mjs:498 is a comment.)
- `weekendRoom`: tests/hidden-parts.test.mjs:37 only.
- `weekendsOf`: nobody imports it (fest-shapes.mjs copies it).
- `groupByDay`, `knownDaysOf`: tests/day-grouping.test.mjs:17, tests/events-model.test.mjs:28, tests/afters-events.test.mjs:25. (events.js:409 only names it in a comment.)
- `splitDays`: tests/day-grouping.test.mjs:17.
- `dayNavOf`: js/v3/app.js:12 (used 246, 283, 1273, 1349, 1388); tests/events-wall.test.mjs:33, hidden-parts.test.mjs:37, search-fold.test.mjs:34, shell-v4.test.mjs:616, two-weekend-schedule.test.mjs:26.
- `festLinkLabel`: js/v3/app.js:12 (used 740-741).
- `computeTimesLayout`: tests/wall-filters.test.mjs:26, tests/fest-room-extras.test.mjs:35.
- `applyFilter/searchFold/searchMatches`: tests/search-fold.test.mjs:34 (search, not week — leave in wall.js).

### Lift plan: `js/v3/week.js` (pure) + re-exports from wall.js
Move: `splitDays`, `knownDaysOf`, `groupByDay`, `applyWeekend`, `weekendsOf`, `weekendRoom`, `wallPlanFor`, `roomsOf`, `roomsIn` (still private), `festLinkLabel`, `nothingVisible` (export it — Our plan needs "is the visible week empty"), `dayTab`/`groupTab` (private) and a pure core of `dayNavOf`.
- week.js imports: `eventModelOf` from ./events.js, `FEST_ROOM` from ./filters.js (filters.js imports only ../util.js, filters.js:87 — no cycle), `dayLabelParts` from ../time.js. No state.js, no DOM. That makes it safe for a peek row / panel module to import without pulling wall.js's DOM graph.
- `dayNavOf` split: week.js exports `dayNavOf(fest, ctx, answeredKeys = null)` taking a Set; wall.js keeps the DOM wrapper `dayNavOf(fest, ctx, wallRoot)` that reads `DAY_ANCHOR` off the root and calls it. Keeps app.js and six test files unchanged.
- wall.js: `export { splitDays, knownDaysOf, groupByDay, applyWeekend, weekendsOf, weekendRoom, wallPlanFor, roomsOf, festLinkLabel } from './week.js';` plus an `import` of the same names for internal use (wall.js uses groupByDay at 1385/1512/2547, knownDaysOf, applyWeekend at 2227/2490/2534, wallPlanFor at 2443/2460/2473). No caller has to change.
- `computeTimesLayout` depends on model.js; model.js imports? (it is pure too) — it is layout, not week; leave it.
- Optional cleanup in the same move: `tests/helpers/fest-shapes.mjs:28-32` can import `weekendsOf` instead of copying it.
- Not week: `sectionLayoutOf`, `BY_TIME`, `timeBandsOf` stay in events.js; `nightMinutes` (1724-1727, pure) belongs with the live window (section 4), not the week.

## 2. The events model and every rule for when a set is over

### 2a. events.js (pure; imports only `activityMinutes`, `dayLabelParts` from ../time.js and `dayIsoOf` from ./now.js, events.js:16-17)
- `nightOf(entry)` 32-40: `entry.night` if a WEEKDAYS 3-letter, else the head of a legacy `"Thu · Venue"` stage string. `dateOf` 44-47 (ISO `date`), `venueOf` 48-55, `areaOf` 59-61, `occOf` 75-86 (the card identity: day, stage, time, weekend←`entry.weekends`, date, venue).
- `parseEventTime(time)` 130-142: `"S"` or `"S - E"`; both on the **activityMinutes axis** (time.js:29-38: before 9 AM adds 24 h). End ≤ start adds 24 h. `"11 PM - Close"` → endMin null (non-clock end ignored). Returns `{startMin, endMin, startStr, endStr}`.
- `venueGroupsOf(entries, {fallbackVenue})` 239-301 — the stacks. Window per member (250-264):
  `nowTo = nextStart ?? m.t.endMin ?? (closeMin > start ? closeMin : null) ?? start + 60` (events.js:260), where `nextStart` is the next NON-cancelled member's start if later (258). **The next member beats a printed end** in a stack. A room where nothing is timed lights every member doors→close (261-263) only if both exist. Untimed member in a timed room: no window. Cancelled: no window, not "next".
- `sectionLayoutOf(fest, key)` 324-327: `dayMeta[key].layout === 'by-time'` → BY_TIME, else BY_VENUE. `showsOnItsOwn` 337-340.
- `timeBandsOf(entries, opts)` 380-406 — by-time (v94). Built ON `venueGroupsOf`, then (386-387): `nowTo = (m.nowFrom != null && set.endMin != null) ? set.endMin : m.nowTo` — **"a party's printed end wins"**; without one the stack's rule stands. Bands 357-367 fixed on the activity clock (Daytime 9-17, Evening 17-21, 9 PM, 10 PM, Late 23-26, After-hours 26-33, Time TBA).
- `eventModelOf(fest, groups, {gridDays, weekends})` 427-567 — the week model: `days` (key, dayKey, wd, iso, weekend, grid, billing, synthetic, short/long/sub/when), `sections` (byNight → byDay keyed by tab id), `extras` (dated: `byDate` Map iso→entries sorted by ISO; or undated `entries`), `looseNoDay`, `anchor`.
  - Dated sections (entries with `date`, ACL Late nights) → `extras` with `byDate` (452-461). Never on the week axis.
  - Weekday axis only when every day key names a unique weekday (469-485); else sections become undated extras (EF's "Day N" would, but EF has no sections).
  - Synthetic days (a night with no grid day, Portola Thu/Fri) get an ISO borrowed from a real day (517-519, `isoPlusDays`).
  - Two weekends (`weekends.length > 1`): only grid days split into `key|W1`, `key|W2` with ISO from `dayMeta.isos[w]` (536-556). Sections on a 2-weekend fest attach by weekday to both weekends' tabs (558-561).
- `isCancelled` 106, `cancelledNames` 111-124.

### 2b. Every place that computes a set's end or live window (head e1eb206)
1. **Grid ends are ALREADY filled before wall.js sees them** — `computeDayArtists` time.js:43-69, called by `state.getDayArtists` state.js:403-411 (cached per fest|day|weekend; weekend filter keeps untagged and `'both'`, state.js:407):
   - printed end (`"S - E"`, E ≠ "close") → `timeToMinutes(E)` (time.js:49);
   - else next set on the same stage: `start + clamp(gap, 30, 120)` (time.js:60-63);
   - else (stage's last set) `start + 75` (time.js:65).
   - Axis: `timeToMinutes` (time.js:5-17: ANY AM adds 24 h), not activityMinutes. Identical on all live data (no grid start or end between 5 AM and noon in Portola, ACL or EF — checked).
2. **Grid cell drawing and liveTo** wall.js:1230-1235: `endMin: max(a.endMin ?? start+60, start+30)` (display floor) and `liveTo: a.endMin ?? start + 60`. **The `?? start + 60` never fires** — endMin is never null out of computeDayArtists. So the old map's "grid = endMin ?? start+60" (map-plan-now-dock.md:91) is wrong: the grid's real rule is printed / next-on-stage clamped 30..120 / +75. Written to `data-now-from/to` wall.js:1307-1308. Grid rows span `dayMeta.doors/close` when given (1241-1246).
3. **Stacks** — `venueGroups` wall.js:1579-1638 stamps `data-now-from/to` from `venueGroupsOf` (1603-1606). Used for sections (by-venue), the festival room's extras (`festRoomExtras` 2225-2229: grid **strays** whose stage is not a column, billed names without a set, activities) and undated/dated extras (`renderExtra` 2340-2361). NB a grid stray goes through the STACK rule on the activity axis, not the grid rule.
4. **By-time** — `timeGroups` wall.js:1666-1695 stamps from `timeBandsOf` (1682-1685).
5. **Refresh keeps the window** — `refreshCard` wall.js:540-543 copies `data-now-from/to` to the fresh node.
6. **Now line** — `positionNowLines` wall.js:999-1037: grid must have `data-iso` equal to `festivalClock(date, tz).iso` (1003); `nowOffsetPx` now.js:123-128 keeps it drawn up to 2 rows outside the grid. `festivalClock` now.js:45-57: rollover at 5 AM (`DAY_ROLLOVER_HOUR`, now.js:22), minutes past midnight + 24 h before 5 AM.
7. **Now marks** — `positionNowMarks` wall.js:1729-1745 on `.venue-grid[data-iso], .time-list[data-iso]` (NOW_HOSTS 1702): `on = at >= from && at < to` (1737) with `at = nightMinutes(host.iso, clock)`.
   - `nightMinutes(iso, clock)` wall.js:1724-1727: the host's own night OR the next calendar day (+24 h), never further — so a Saturday after-hours stays live past the 5 AM rollover until its own printed end (v94 fix). **Grid cells never go through nightMinutes** — they are only live while their grid is "today" by festivalClock.
   - Hosts without `data-iso` never light: undated extras (renderExtra passes no day, 2346) and a synthetic day with no borrowable ISO.
8. **liveOnWall** wall.js:1770-1799: lines + `onGrid` (clock inside `startRow*15 .. (startRow+rows)*15`, 1778-1779); marks = `.card.now` in stacks/time lists (1781); with a highlight, grid cells live by `from <= minutes < to` using festivalClock minutes (1789-1792). Feeds `nowLanding` 1802-1810, `nowStops` 1958-2032, `nowPulseable` 2034-2039.
9. **nowSaid** wall.js:2049-2072 re-reads grid cells `from <= minutes < to` off the line's `data-minutes` (2065).
10. **app.js** — `tickClock` app.js:823-831 (positionNowLines, positionNowMarks, paintNowTabs each minute + on visibility); `paintNowTabs` app.js:855-861 (NOW tab exists iff `nowLanding` non-null; it sits after the live day's tab — `NOW_DOORS` 854 `dock-now/dock-days`, `rail-now/rail-days`). This is where Our plan's one-NOW rule hooks in (hide while the peek shows a NOW row). Other app.js calls: positionNowMarks 464, 1647; open-day `nextVisibleDay(tabs, festivalClock(...).iso)` 1273-1274 / 1239-1243.
11. **Not a window, but ends:** tools.js export uses `state.getDayArtists` (tools.js ~313) for text rows; `api/_lib/festival-rules.mjs:603` overlap check uses computed start/end; `js/overlap.js` lanes use endMin (display extents).
12. **The List build's "over" rule is NOT on this head.** Branch `live/list` (49d3e04) is this head plus only `LIST-BUILD.md`; its plan (§3 there) is "each card's own window (`data-now-from/to` on its host's night) against a FROZEN clock (`ctx.pastAt`)" — i.e. it will consume the same stamped windows, so liveWindowOf changes List's "over" too. The List will also turn grid sets into by-time entries "with the grid's own occurrence and now window" — a second consumer that must read the grid window, not re-derive it via `timeBandsOf` (which would apply the stack rule).
13. **Design model** `claude-plans/2026-09-25-portola-live/design/ours-r2/ours-model.mjs:82`: `end = t.endMin ?? (next ? next.startMin : start + 60)` — unclamped next, +60, on the activity axis via parseEventTime, all grid days' sets without weekend filtering. Rooms (sections): `closeMin ?? max(members' nowTo)` (:106).

So today there are FOUR end rules, not three: grid (printed / next clamped 30-120 / +75), stack (next member / printed / room close / +60), by-time (printed / then stack rule), design model (printed / next unclamped / +60).

## 3. The festival data shapes (data/festivals/, head e1eb206)

No festival file carries `dayMeta.doors` / `dayMeta.close` today (checked all 11), though wall.js:1241-1246 honours them. There is no separate `start`/`end` field anywhere: a set's end lives in `time` as `"S - E"`.

**Portola 2026** (`portola-2026.json`, status scheduled, `timezone: America/Los_Angeles`)
- `days`: Saturday (5 stages, 31 sets), Sunday (5 stages, 32 sets). Stages: Pier Stage, Crane Stage, Warehouse, Ship Tent, Despacio. Grid sets are `{name, stage, time}` only — **all 63 print an end** (`"9:00 PM - 10:15 PM"`). No strays (every set's stage is a column).
- `dayMeta`: `Saturday {wd:'Sat', date:'Sep 26', iso:'2026-09-26'}`, `Sunday {wd:'Sun', date:'Sep 27', iso:'2026-09-27'}`, `Afters {date:'Sep 24-27'}`, `Folsom {date:'Sep 25-27', layout:'by-time'}`.
- `artists[]` 195: by day Saturday 31, Sunday 31, `Saturday & Sunday` 1 (Despacio, no time), Afters 67, `Afters & Folsom` 1 (Horse Meat Disco, Fri Public Works 9 PM - 3 AM — rendered in BOTH rooms; stack rule in Afters, printed-end rule in Folsom; same answer today because it is alone in that room), Folsom 64. Fields seen: name, day, venue, stage (legacy `"Thu · Venue"`), night (Thu/Fri/Sat/Sun), time, approx (61), doors (66), close (66), closeApprox (38), closeSource (39: 18 https, 11 "kind default (hall)", 10 "venue's routine close"), order `{seq, of, source, confirmed}` (62), page, tickets, cancelled (1: Skepta, `{on, source, note}`, Saturday — billed, off the grid).
- Afters (by-venue, 24 rooms, 21 multi-member): 62 start-only + doors + close; 1 range; 4 doors+close untimed. Window sources today (probe via events.js): next member 41, printed end 2, room close 21, +60 fallback 0, whole-room 1, no window 3.
- Folsom (by-time, 55 venue-nights; 9 venue-nights hold 2-3 parties, e.g. Fri The Stud 5-9 PM then 10 PM-2 AM): 62 ranges; 2 start-only (Sun RATED X 9 PM at City Nights SF, Sun NOCTURNAL EXTREME 3 AM at Halcyon) → +60 today.
- `venues`: map name → maps URL. No `activities`.

**ACL 2026** (`acl-2026.json`, scheduled, `timezone: America/Chicago`)
- `days`: Friday (48 sets), Saturday (42), Sunday (43), 7 stages each. Grid sets `{name, stage, time, weekend?}`: 84 tagged W1/W2 (42 each), 49 untagged (play both). No `'both'` value on grid sets (only untagged).
- `dayMeta`: Friday/Saturday/Sunday `{wd, date:'Oct 2 & 9', dates:{W1,W2}, isos:{W1:'2026-10-02', W2:'2026-10-09'}}`; `Late nights {date:'Sep 29 – Oct 10', sub:'around Austin'}`. No layout (Late nights is by-venue).
- `artists[]` 196: grid-day billing 130 with `weekends` (plural: both 53, W1 38, W2 39); Late nights 66 with `date` (10 distinct ISO dates), `venue`, `doors`, `source`, `page`, `tickets` — **no `time`**, and only 1 carries `close` (Fcukers, Oct 10, Devil May Care, doors 10 PM close 2 AM). So venueGroupsOf gives **1 of 66 Late-nights shows a now window**; the rest can never be live or "over" by any window rule. Our plan's NEXT for a Late night can only speak doors.
- **Grid sets with no printed end: 7 raw entries = 12 weekend occurrences, and every one is a stage's last set of the day** (the two headliner stages): Fri T-Mobile Skrillex (W1) / Kings of Leon (W2) 8:15 PM; Fri American Express Charli xcx 8:40 PM (both); Sat T-Mobile Lorde 8:15 PM; Sat Amex RÜFÜS DU SOL 8:30 PM; Sun T-Mobile The xx 8:30 PM; Sun Amex Twenty One Pilots 8:30 PM. Today they glow start+75 (computeDayArtists) — Skrillex "over" at 9:30 PM. No mid-day set lacks an end, so "next set on the stage" never fires on ACL.
- The two weekend fields: grid sets filter by `weekend` (state.js:407), billing by `weekends` (`applyWeekend`, wall.js:906-909). `weekendsOf` keys off the grid field only (wall.js:1357-1358).

**Lineup-only: Seismic 9** (`seismic-9.json`, status lineup): 33 artists with `name` only — no day, no days, no dayMeta, no timezone. wallPlanFor gives a plan only under sort billing/day (`looseNoDay` = THE LINEUP); no ISO anywhere, so nothing is ever live. Our plan: none (PLAN §2.6 UI 6).

**Electric Forest 2026** (archived, reference for the rules): 4 grid days "Day 1-4", `dayMeta {wd, num, date}` with **no iso and no timezone** → no now line ever. All 199 grid sets are start-only: 171 end at the next set on the stage (22 of those gaps exceed 120 min and are clamped to 120; gaps up to 300 min), 28 stage-last get +75. Has `activities` (per day) and top-level `stages`. This is the fest where "next set on the stage, unclamped" would be visibly wrong (a 5-hour glow).

## 4. liveWindowOf — recommended signature, rule, call sites, and the tests that move

### 4a. Where it lives
Put the rule in **js/time.js** (a leaf: no imports) and re-export it from events.js as the public name. Reason: the grid's fill happens in `computeDayArtists` (time.js:43-69), which state.js imports; events.js already imports time.js (events.js:16), so defining it in events.js and calling it from time.js would make a time.js ↔ events.js cycle. It is axis-agnostic (takes minutes), so it serves the grid's `timeToMinutes` axis and the rooms' `activityMinutes` axis alike (they agree on all live data).

### 4b. Signature
```js
// start/end on one festival-day axis; next = the next act's start in the same
// run (same stage / same room, not cancelled, later than start) or null;
// close = the room's (or the day's) printed close or null.
// kind: 'stage' (a festival stage: changeovers, so a gap is capped) |
//       'room'  (a club run: the next act takes over, uncapped) |
//       'party' (by-time: its own show — same as room once the printed end wins)
liveWindowOf({ startMin, endMin }, { next = null, close = null, kind = 'room' } = {})
  → { from, to, source: 'printed' | 'next' | 'close' | 'default' } | null   // null when startMin is null
export const OPEN_END_MIN = 75;   // one number for every open end
export const STAGE_GAP_CAP = 120;
```
Rule, in order:
1. **Printed end wins** (`endMin != null`) — everywhere. The grid and by-time already do this; stacks change (today `nextStart` beats it, events.js:260).
2. Else **the next act**: `kind === 'stage' ? min(next, start + STAGE_GAP_CAP) : next`. The cap keeps EF's 3-5 h stage gaps from glowing (today's clamp upper bound, time.js:63); rooms stay uncapped because club runs really are back-to-back (Portola Afters has 150/135 min runs by the next act: Rory Phillips at 1015 Folsom, Masha Mar and riria at 888 Garage). The 30-min floor in time.js:63 is a DISPLAY rule — it stays on `endMin` for drawing and lanes, not in the live window.
3. Else **close** when later than start: the room's `close` (stacks today) or `dayMeta[day].close` for a grid stage's last set (new for the grid; honoured already for grid rows at wall.js:1241-1246, but no file carries it yet).
4. Else `start + OPEN_END_MIN`.
Plus the untouched room rules: a room where nothing is timed lights doors→close; an untimed member in a timed room and a cancelled member get no window (events.js:261-264, 274-277) — liveWindowOf returns null for a null start and venueGroupsOf keeps its room-level branch.

**Why 75, not PLAN Q3's 60:** 75 is what the grid ships today (time.js:65), and the only live open ends on the calendar before Our plan lands are ACL's 12 headliner occurrences — at 60 they would go dark at 9:15-9:40 PM instead of today's 9:30-9:55. With 75 the adoption commit is nearly invisible on current data: grid — no change (gap<30 never occurs; ACL has no mid-day open end); Portola Afters — printed-wins changes **0** cards (probe: no Afters member's printed end differs from its stack window); Folsom — 2 start-only parties (RATED X, NOCTURNAL EXTREME) go from +60 to +75. If Kevin prefers 60, the visible change is ACL headliners 15 min shorter.

**The real ACL fix is data, not a default:** add `close` to ACL's grid-day `dayMeta` (the official nightly end, to be verified from ACL's own schedule — not asserted here) and rule 3 ends every headliner there. That is a festival-file edit (validator: `node scripts/validate-festivals.mjs`); checked: festival-rules.mjs's dayMeta block (api/_lib/festival-rules.mjs:651-685) validates only iso/isos/date/dates and `layout` (:281-290) — a grid day's `doors`/`close` is neither rejected nor validated, so adding it passes CI today but deserves a rule (a clock string, after the day's first set) in the same PR.

### 4c. The companion: one "is it on / over" reader
Move `nightMinutes` (wall.js:1724-1727, pure) to now.js, re-export from wall.js, and add beside it:
```js
phaseAt({ from, to }, hostIso, clock) → 'before' | 'now' | 'over' | null
// at = nightMinutes(hostIso, clock); null at → compare clock.iso with hostIso
// (earlier → 'before', later → 'over'); else at < from 'before', at < to 'now', else 'over'.
```
`nightMinutes` returns null both for "days before" and "two+ days after", so the plan / List need the ISO comparison to tell them apart. Grid cells should read through the same `nightMinutes` (today they use raw festivalClock minutes and only while their grid is "today", wall.js:1003, 1773, 1789-1791, 2065) — no data difference now (no grid set ends past 5 AM), but it makes the grid, stacks, by-time, plan and List one rule.

### 4d. Call sites to adopt
1. `computeDayArtists` time.js:56-68 — keep `endMin` as the display extent (lanes js/overlap.js:18-40, validator api/_lib/festival-rules.mjs:603, tools.js rows) and add `liveTo = liveWindowOf({startMin, endMin: printedEnd}, {next, close: dayClose, kind:'stage'}).to`. Needs the day's close → pass `dayMeta` close into computeDayArtists (state.js:403-411 has `fest()` and `day`).
2. wall.js:1230-1235 — `liveTo: a.liveTo` (drop the dead `?? start + 60`); `data-now-to` 1308 unchanged.
3. `venueGroupsOf` events.js:255-264 — `nowTo` via liveWindowOf(kind 'room', next = nextStart, close = closeMin).
4. `timeBandsOf` events.js:385-387 — the printed-end override becomes redundant (rule 1); delete it, keep `kind: 'party'` for the record.
5. `positionNowMarks` wall.js:1733-1737, `liveOnWall` 1789-1791, `nowSaid` 2065 — through `phaseAt` / `nightMinutes`.
6. `js/v3/plan.js` (new, U6) — stops take their windows from the SAME sources (getDayArtists().liveTo for grid sets, venueGroupsOf/timeBandsOf members for rooms), never re-derived as ours-model.mjs:82 does.
7. `live/list`'s past pass — reads `data-now-from/to`, so it follows automatically; its grid-as-by-time conversion must carry the grid's `liveTo`, not re-run `timeBandsOf`'s stack rule on grid sets.
8. `festRoomExtras` strays (wall.js:2209-2215) are grid sets rendered as stacks — they then get the stack (`room`) rule; either accept that (none exist in Portola/ACL) or stamp them with their `liveTo`.
9. week.js + (if split) phase helpers: add to `service-worker.js` APP_CORE (events.js/now.js are at :59-60) and run `node scripts/sw-stamp.mjs`; `tests/app-shell-complete.test.mjs` walks the import graph and fails otherwise.

### 4e. Existing tests that pin today's behaviour
Would change (under the rule above):
- tests/by-time.test.mjs:186 — asserts a STACK runs Tea Dance to 21:00 (the next party) despite its printed 20:00 end; printed-wins makes it 20:00.
- tests/by-time.test.mjs:189 — "Half Past" +60 → +75 (only if OPEN_END_MIN = 75).
- tests/events-model.test.mjs:137 — "an open-ended set is an hour" (22:00) → 22:15 (only if 75).
Stay green but touch the rule (re-read after the change):
- tests/time.test.mjs:31-44 and 46-57 — computeDayArtists clamp 30..120 and +75 (endMin unchanged under 4d.1; add liveTo cases).
- tests/events-model.test.mjs:126-135, 150-164 — run/next, ranged solo, doors-only room, untimed-in-timed-room.
- tests/cancelled-acts.test.mjs:204-219 (opener runs to the next non-cancelled start), :229, :284.
- tests/by-time.test.mjs:173-185 (member parity with stacks when no printed end), 296-306 (`nightMinutes` — import path survives via re-export), 308+ (Portola after-hours across 5 AM).
- tests/events-wall.test.mjs:325-345 (Portola Sun 11:30 PM PT: VTSS is the Midway's live card; window contains 23:30).
- tests/now-jump.test.mjs (reads windows off the DOM, e.g. :516), tests/shell-v4.test.mjs:634-700 (refresh keeps the window).
- tests/helpers/fest-shapes.mjs:42 hand-copies the dead `a.endMin ?? a.startMin + 60` display floor — update with the grid.
New tests to add (PLAN U6 + REVIEW-1 item 5): printed end beats next; stage cap (EF-shaped 300-min gap → 120); room uncapped; dayMeta close on a stage's last set; ACL headliner occurrence per weekend (untagged + tagged sets both kept per weekend); dated Late night with doors only → no window; a jsdom check that a grid cell's `data-now-to` equals the plan stop's end for the same set.

Status: COMPLETE (2026-09-26).
