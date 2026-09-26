# Map: NOW, dock/rail, and the data flow a cached plan model must follow

Status: COMPLETE (head e1eb206, 2026-09-26). Read-only map; no code changed.

All `file:line` are on head `e1eb206` (branch live/plan) unless marked. "Old map" = `claude-plans/2026-09-26-unified-build/map-plan-now-dock.md` (written on abe7205).

## 1. The dock, the rail and NOW as they are now

### 1a. Markup (index.html)

| Piece | Phone dock `#dock` (<720) | Desktop rail `#day-rail` (>=720) |
|---|---|---|
| You | `#dock-you` index.html:243 | `#rail-you` index.html:218 |
| NOW (parking slot) | `#dock-now` index.html:244, hidden, sibling BEFORE the row | `#rail-now` index.html:224, same |
| Days row | `<span class="days" id="dock-days">` index.html:245 | `<span class="rail-days" id="rail-days">` index.html:225 |
| Fest name / show-menu door | `#dock-fest-wrap` > `#dock-fest-link` index.html:246-252 (inline `flex: none`) | `#rail-fest-wrap` > `#rail-fest-link` index.html:229-236 (`margin-left: auto`, carries `.sync-dot` + `#sync-label`) |

- The index.html slots are only NOW's PARKING place now (comment index.html:219-223): while something is live, app.js moves the button INTO the day row right after the live day's tab (v93, "D1"). Nothing live = hidden in the slot.
- The rail sits inside `.shell` (index.html:217, before `#wall-root` :238); the dock is outside `.shell` (index.html:242), fixed. `#dock` z30 fixed bottom (v3.css:523-534); rail sticky top z25, 100vw (v3.css:422-440). `.dock.hidden { display:none }` v3.css:720; `.dock` is display:none >=720 (v3.css:721).
- `.shell` bottom padding is still the literal `calc(84px + env(safe-area-inset-bottom))` (index.html:81). There is NO `--foot-h` anywhere yet (grep: no hits in js/ or assets/). The other literal floors are unchanged: `.spot-pill` bottom 70px (v3.css:168, desktop 16px :174), `.bring-offer` bottom 64px (v3.css:186), `.undo-toast` bottom 64px (v3.css:890).
- `#now-status` polite live region, pre-rendered: index.html:298.
- Row CSS: `.dock .days { flex:1; --gap:24px; --gap-min:15px; overflow-x:auto }` v3.css:540; the centring pair now matches ANY first/last child (`.dock .days > :first-child` / `> :last-child`, v3.css:541-542), so a NOW that ends the row (SUN · NOW) still centres. (The old map's 6a.5 fix is DONE.) Rail row v3.css:447 (`--gap:20px; --gap-min:14px`). Edge fade `--row-fade: 18px` v3.css:566-568. `.now-tab` v3.css:683-691 (`[hidden]` display none :686). Show menu raise: `.dock.menu-up, .day-rail.menu-up { z-index: 39 }` v3.css:348 (the Codex #7 "raise the bar" fix is COMMITTED; no portal).

### 1b. renderDayNav (app.js:1374-1418)

Order, every call:
1. Remember whether each NOW button has focus (app.js:1380).
2. `parkNowTab(tab,row)` for both doors (app.js:873-884): lift NOW out of the row back to `row.before(tab)` BEFORE the row is emptied; a half-finished leave is completed instantly (hidden, animations cancelled). Row `scrollLeft` is remembered (app.js:1381).
3. Empty both rows (app.js:1382-1383) and rebuild from `dayNavOf(state.fest(), ctx, $('wall-root'))` (app.js:1387; wall.js:1499-1524). Each day makes two `dayTab()` buttons (app.js:1359-1372: `.day-tab`, `data-day = anchor||key`, dock gets `.num` for dated two-weekend tabs). Click = `settleFold()` then `scrollIntoView` of `anchorFor(at)` (app.js:1389-1393).
4. Restore each row's old `scrollLeft` (app.js:1398), `unspy()` then `wireScrollspy([dock, rail], wallRoot)` (app.js:1399-1400).
5. `paintNowTabs()` (app.js:1405) puts NOW back; restore focus to NOW if it had it (app.js:1408-1411) so a keyboard walking NOW survives the 25 s poll repaint.

Callers of renderDayNav: `repaintWall` (app.js:1645) and the search `input` handler (app.js:3626). Nothing else.

### 1c. How v93 puts NOW into the day row

- `NOW_DOORS = [['dock-now','dock-days'], ['rail-now','rail-days']]` app.js:855 (replaces the old `NOW_TABS`).
- `paintNowTabs(date = ctx.now || new Date())` app.js:856-862: `landing = nowLanding(wallRoot, ctx, date)`; the live DAY is `(landing.card || landing.line).closest(DAY_ANCHOR).dataset.day` (`DAY_ANCHOR = '.day-block[data-day]'` wall.js:2663); `day` is the key, `''` (live but in no day block: the row's start) or `null` (nothing live). Then `showNowTab(tab,row,day)` for both doors.
- `liveTabIn(row, day)` app.js:864 finds the `.day-tab` whose `data-day === day`; `placeNowTab` app.js:866-869 does `after.after(tab)` or `row.prepend(tab)`.
- `showNowTab(tab,row,day)` app.js:907-962:
  - live + already in place: no-op (app.js:912).
  - live + shown but PARKED by a rebuild: re-insert silently, `restDayRow(row)`, no slide (app.js:913-918).
  - arriving / moving day: record `tabLefts(row)` + current edge classes, place, unhide, `restDayRow(row)`, `slideTabs(row, before, edges)` (FLIP of every other tab), and NOW's own fade-in from -6px after `STAGGER_MS` (app.js:920-945).
  - leaving: `data-leaving`, fade out `OUT_MS`, then `gone()` re-parks it hidden before the row, re-rests the row and slides the rest back with `{out:true}` (app.js:947-961). Parked + not in row: just hide (app.js:949).
- `slideTabs(row, before, edges, {out})` app.js:891-903: per-tab `translateX` FLIP (CASCADE_MS, EASE_ARRIVE in / EASE_SURFACE out), and `holdDayRowEdges(row, edges, settled)` (wall.js:2784-2791) keeps the old edge fades until the slide ends.
- **`fitNowTab`, the `.compact` dot and `.dock.squeezed` are gone** (grep: no hits). `centre()` is gone too.

### 1d. What replaced centre()/fitNowTab: restDayRow + restingLeft (wall.js)

- `restingLeft({items,width,max,fade,active,now,live})` wall.js:2697-2733 — PURE: brute-forces every integer scrollLeft and scores lexicographically: active day whole > NOW whole > live day whole > no slivers (EDGE_HINT 6px, wall.js:2690) > focus tabs out of the fades > closest to centring the focus tabs. Unit-tested in `tests/day-row.test.mjs:104-147`.
- `dayRowGeometry(c)` wall.js:2749-2764: items from `offsetLeft/offsetWidth` (never rects: tabs may be mid-FLIP); `now` = index of a `.now-tab` that is not leaving; `live` = the tab just before NOW if it is a `.day-tab`.
- `fitDayRowGap(c)` wall.js:2799-2818: a row that overflows by less than what its gaps can give tightens `--gap` toward `--gap-min` instead of scrolling.
- `restDayRow(c, behavior='auto')` wall.js:2824-2831: fit gap, `scrollTo({left: restingLeft(...)})`, `markDayRow` (edge classes, wall.js:2769-2777).
- `wireScrollspy(containers, wallRoot)` wall.js:2834-2955: one geometry authority (`syncFromGeometry` :2891-2909, last day block whose top is above `--jump-offset + 32`), `setActive(day)` lights tabs and calls `restDayRow(c, glide?'smooth':'auto')` on both rows (:2865-2877); initial claim = geometry if `scrollY > 0` (+ one more rAF read) else `tabs[0]` (:2918-2926); window scroll (rAF-throttled) and resize listeners; a `ResizeObserver` on each row re-rests it (:2941-2948). Returns an unwire fn.
- Late font: `document.fonts` `loadingdone` re-rests both rows (app.js:3631-3633).

### 1e. NOW's other machinery (unchanged in kind since the old map, new lines)

| Function | Where | Notes |
|---|---|---|
| `tickClock(date = new Date())` | app.js:824-832 | clears a stale `busy=show-menu` flag (:828), `positionNowLines`, `positionNowMarks`, `paintNowTabs(date)`. |
| `startClock()` | app.js:819-823 | `setInterval(tickClock, 60_000)` + `visibilitychange` → `tickClock()` when visible. Started once from `enterApp` (app.js:3203). Not wall-clock-minute aligned (fires 60 s after start, drift allowed). |
| `seenBand(inGrid)` | app.js:966-977 | top = `--jump-offset` (or `--rail-h` + stage strip inside a grid); bottom = `#dock` top if displayed and not `.hidden`, else innerHeight. |
| `pageGeo(root)` | app.js:1015-1057 | now has a `box(el)` that un-scales a pulsing card (new since old map, :1026-1034). |
| `jumpToNow()` | app.js:1058-1182 | `settleFold()`; `nowStops(...)`; empty → `nowCycle=null; paintNowTabs(); return` (:1064). Otherwise nowStep, quiet toast for a highlight with nothing on, `sayNow`, grid slide, stack-row slides, page scroll, scrollend bookkeeping, pulse. |
| `sayNow(text)` | app.js:1189-1195 | empties `#now-status`, refills after 100 ms. |
| `nothingOnFor` | app.js:1211-1218 | |
| `nowLanding(root, ctx, date)` | wall.js:1802-1810 | `liveOnWall` wall.js:1770-1799 reads the DOM: `.times-grid .now-line`s (+ onGrid test), `.venue-grid[data-iso] .card.now, .time-list[data-iso] .card.now` marks (v94 time lists count), and with `ctx.filterPeople` the highlighted people's live, undimmed picks, best level then latest start. |
| `nowStops / nowStep / nowPulseable / nowSaid / landingTarget` | wall.js:1958, 2128, 2034, 2049, 1863 | |
| `positionNowLines(root,date)` / `positionNowMarks(root,date)` | wall.js:999-1036 / 1729-1745 | Both read `festivalClock(date, grid.dataset.tz)` (section 5). |
| `maybeOpenOnDay()` | app.js:1258-1281 | day-of open, once per fest per festival-day (`dayOfScrollKey`); never while `ctx.query`; uses `new Date()` directly (:1265, :1276). |
| `dockTop()` | card-facts.js:833-838 | the zoom's floor = `#dock` top while it has client rects. |

Click wiring: `for (const [id] of NOW_DOORS) $(id).addEventListener('click', jumpToNow)` app.js:3666.

### 1f. Where the one-NOW rule goes

**Best single place: `paintNowTabs()` (app.js:856).** It is already the only function that decides whether NOW is shown, and every path that could change the answer already runs it: the minute tick (app.js:831), every `renderDayNav` (app.js:1405 — so every repaint, every search keystroke, every fold), and an empty `jumpToNow` (app.js:1064). Make it compute `day` as today, then pass `null` to `showNowTab` for a door whose layout's peek is showing a NOW row:

```
const peekNow = peekShowsNow(layout)   // per door: 'dock' (phone) or 'rail' (desktop)
showNowTab($(tab), $(row), peekNow ? null : day)
```

What it must read:
1. `nowLanding(...)` (already) — "something live".
2. The cached plan model's current peek row (NOW vs NEXT vs none) at the SAME `date` — so the peek and NOW can never disagree across a minute boundary. The peek painter and `paintNowTabs` must take one `date` from one caller (tickClock passes it; renderDayNav should pass `ctx.now || new Date()` once).
3. Whether that peek is VISIBLE on that door's layout (Codex #6): phone = `#dock` displayed (not `.hidden` by search focus, not <720 display none) AND the peek element displayed; desktop = the corner card or panel rendered. Until the desktop plan exists (U8) the rail door must keep its NOW. Since each door is handled separately in the `NOW_DOORS` loop, this is a per-door boolean, cheap.
4. The peek must be painted BEFORE `paintNowTabs` runs in the same pass (in `renderDayNav`, and in `tickClock` put the peek update before `paintNowTabs(date)`), otherwise the tab arrives for one frame and leaves (visible motion: NOW has an arrival animation).

A subtlety: `showNowTab` with `null` animates a LEAVE. When the peek first appears with a NOW row, the tab leaving with its normal fade is the right motion; on a rebuild where NOW was parked and the peek already carries NOW, the parked branch (`tab.parentElement !== row` → hide, app.js:949) makes it silent. Good.

## 2. Every path that changes what a plan would count

The plan's inputs: the festival object (`state.fest()`), `ctx.fid`, picks (`ctx.picks`), the active member set (`state.activePeople()`), and the fold (`ctx.folded`). Possibly `ctx.query` (a product call, section 4). The scrolled day is NOT an input to the model (see "day changes" below).

### 2a. The choke point that already exists: refreshCtx (app.js:207-221)

`refreshCtx()` rebuilds `ctx.fid`, `ctx.meName` (`crew.me(token)`), `ctx.picks` (`model.picksFor(state.crewDoc, fid)` — a NEW object every call), `ctx.affinity`, `ctx.filterPeople` (pruned to active members), `ctx.folded` (`loadFolded(fid)`), `ctx.festDates`. Every path below that changes a plan input reaches `refreshCtx()`, either directly or through `repaintWall()` (which calls it first, app.js:1639). That makes it the one reliable invalidation point.

Do NOT memo on identity alone: `ctx.picks` is fresh per call (good), but `loadFolded` can return the SAME array from memory (filters.js:100-101, the `memoryWins` path), and `state.fest()` identity changes only on a file refresh. An explicit dirty flag set inside `refreshCtx` is simpler and cannot miss.

### 2b. Path by path

| Path | Function(s) that run | Calls refreshCtx? | What it repaints | Peek would be stale today if the model were cached only in repaintWall? |
|---|---|---|---|---|
| Resting-card tap (member) | `ctx.onTap = handleTap` (app.js:111) → `handleTap` app.js:467-500: `state.recordSelection`, `applyLocalPick` (app.js:724-729, mutates `crewDoc` in place + persist), **`refreshCtx()`** (:491), **`refreshArtistCards(artist)`** (:492), `sync.scheduleSync()` | yes | `refreshArtistCards` app.js:445-464: `refreshCard` on every card of that artist + `positionNowMarks`. Falls back to `repaintWall()` ONLY if no card of that artist is on the wall (:447). No `renderDayNav`, so no `paintNowTabs` either. | **YES** (REVIEW-1 #2 still true) |
| Guest resting-card tap | `handleTap` guest branch app.js:468-481: finger tap opens the zoom; otherwise `askToJoin` | no | nothing on the wall | no (no pick) |
| Zoom − / + | `ctx.onStep` (app.js:137) → `stepPick` app.js:503-518: same as handleTap with a clamp 0..4, no wrap | yes (:514) | `refreshArtistCards` (:515) | **YES** |
| Bulk paste | Settings sub-view `sub:bulk` → `openBulkPaste` tools.js:199-254 → `applyBulkText(text, actions.recordPick)` tools.js:172-197 (writes for ANY named active person, not just meName) → `recordPick` app.js:2376-2381 (`recordSelection` + `applyLocalPick` per line, persists per line) → `afterApply = afterBulk` app.js:2382 = `sync.scheduleSync(); refreshCtx()` | yes | nothing: the wall is behind `screen-settings`; it repaints on `closeSettings` app.js:2320 → `repaintWall` | no, as long as the peek lives inside `#screen-app` (hidden with Settings) and the model is dirty-flagged by refreshCtx |
| Bring your picks | welcome/offer card → `bringPicksHere(key)` app.js:2823-2855: `bringFromSource` (crew-entry.js:124), loop of `recordSelection` + direct `sels[...]` writes, ONE `state.persist()`, `scheduleSync`, `repaintWall()` | via repaintWall | full | no |
| Remote updates (poll) | `setInterval` 25 s (5 min in low power) app.js:3717-3728 → `sync.pollSync` sync.js:234 → `state.applyRemoteDoc` (state.js:363-386; true only if people/selections/notes/affinity/meta changed, order-insensitive) → `onRemoteChange = repaintFromRemote` app.js:3552 (`repaintWall(); renderPersonChips(); renderYou(); refreshOpenSheet()`). Also after a push (`applyRemote` sync.js:93-95) and on tab show (app.js:3729-3731). | via repaintWall | full | no |
| Festival file refresh (set-times drop) | `refreshFestivalFile` app.js:3324-3331 / `applyFreshCustoms` app.js:3336-3347 → replaces `state.FESTIVALS[fid]`, `forgetComputedDays`, `repaintFromRemote` | via repaintWall | full | no (but a model keyed on picks alone would miss it: the dirty flag in refreshCtx covers it) |
| Claim / join (guest → member) | join shelf `showJoinShelf` (join-shelf.js:59) → `joinAnswers` app.js:2867+ → `enterApp(token, doc, …, {member:true})` app.js:3085 (does `refreshCtx` :3195, `renderPersonChips`, `renderYou`, `repaintWall` :3201) → `entered` → `finishJoin` app.js:654-662 → `applyWaitingPick` app.js:671-680 → `handleTap` | yes | full, then the waiting pick through the card-tap path | the waiting pick: **YES**, same as a tap |
| Look around (guest back to the wall) | `lookAround` app.js:684-697: `refreshCtx`, chips, you, `repaintWall` | yes | full | no |
| Member add | `+ Add` chip / Settings → `openAddMember` app.js:2128 → `succeed` app.js:2185-2188: `refreshCtx(); renderPersonChips(); repaintWall()` | yes | full | no |
| Leave crew | Settings → `leaveCrew` app.js:2420-2427: `crew.forgetCrew`, `renderLanding()` | no | leaves the app screen | n/a (screen gone) |
| Self-rename | `renameSelf` app.js:2431-2467: new person + tombstone old + picks moved; `refreshCtx(); renderPersonChips(); renderYou()` — **no repaintWall** | yes | chips + avatar only; the wall repaints on `closeSettings` | no if peek is in `#screen-app`, dirty flag set |
| Identity switch | `switchIdentity` app.js:1283-1292 → `repaintWall` | via repaintWall | full | no (meName changes "you" in the plan, not its counts) |
| Colour change | `changeColor` app.js:2468-2480: refreshCtx, chips, you | yes | chips + avatar | no (colours only) |
| Highlight (people filter) | chip tap → `togglePeopleFilter` → `setPeopleFilter` app.js:803-808: `savePeopleFilter`, `refreshCtx`, `renderPersonChips`, `repaintWall` | yes | full | not a model input; but the peek's HIGHLIGHT row ("Ross's now") would read `ctx.filterPeople` at paint time |
| Fold toggle | Show menu row → `toggleFoldFlow(key)` app.js:320-378: `applyFoldToggle` writes memory+storage+`ctx.folded` at once, leave animation, then `finish` → `repaintWall(); keepWallPlace(place)` (+ arrive). `unfoldAll` app.js:393-406 same end. `settleFold()` (app.js:319) forces a pending finish — called by NOW, day tabs, the next fold. | via repaintWall (deferred up to `OUT_MS*3+50`) | full, after the fade | briefly: between the tap and `finish` the model would still show the hidden room. Painting the peek from `repaintWall` (or making the peek call `settleFold()` like NOW does) closes it |
| Search keystroke | `#search-input` `input` app.js:3622-3628: `ctx.query = value; unzoom; renderWall(...)` **directly (no repaintWall, no refreshCtx)**; `renderDayNav()`; `measureStickyChrome()` | **no** | wall + day rows (+ `paintNowTabs` through renderDayNav) | not a model input; see section 4 |
| Day change (tab tap or scroll) | tab click `jump` app.js:1389-1393 (`settleFold` + `scrollIntoView`); scroll → `wireScrollspy` `setActive` (wall.js:2865-2877). The active day lives only in wireScrollspy's closure (`let active`, wall.js:2864); no callback, no ctx field. `state.currentDay` is dead state (written at state.js:62/101, app.js:2339; never read). | no | tab classes + row rest | not a model input. If the open plan should follow the day you are LOOKING at, wireScrollspy needs an `onActive(day)` callback; nothing exposes it today |
| Sort change (lineup fests only) | `createSortControl` onChange → `ctx.sort = v; repaintWall()` app.js:3655 | via repaintWall | full | irrelevant (no clock, no plan) |
| Festival switch | Settings → `switchFestival` app.js:2329-2362: `loadFestival`, `setActiveFestivalId`, `ctx.query = ''` + clears the box, `closeSettings()` → `repaintWall` | via repaintWall | full | no (fid changes; dirty flag) |
| Crew switch / new crew / hash change | `boot()` → `enterApp` → refreshCtx + repaintWall | yes | full | no |
| Migration lands | poll → `repaintWall(); applyWaitingPick()` app.js:3724 | via repaintWall | full | no |
| Spotify badge sweep | app.js:3215 `refreshCtx(); repaintWall()` | yes | full | no (affinity only) |
| Notes change | `onNotesChange` app.js:202-205 → `repaintWall` | via repaintWall | full | not an input |

### 2c. Recommendation: one invalidation hook, one paint function

1. **Invalidate in `refreshCtx()`** (app.js:207): one line at its end, `planDirty = true` (or bump a `planGen`). Every write path above reaches it; nothing that is not a plan input needs to avoid it (the extra rebuilds — notes chip, openSettings, a notes change — are rare and cheap enough, and a rebuild only happens lazily at the next paint).
2. **One paint function**, e.g. `paintPlan(date = ctx.now || new Date())`: if dirty, rebuild the model (`planOf(...)` with `state.activePeople()` names, the unfolded week for placing and `ctx.folded` for visibility); then compute `peekOf(model, today, minutes)`; paint the peek; THEN run the one-NOW rule. Called from exactly:
   a. `renderDayNav()` in place of its bare `paintNowTabs()` at app.js:1405 — this covers `repaintWall` (every poll change, fold finish, member add, join, fest switch, fest-file refresh) and every search keystroke;
   b. the end of `refreshArtistCards()` (app.js:463, after `positionNowMarks`) — this is the REVIEW-1 #2 fix: a resting tap, a zoom step and a joined guest's waiting pick all go through it and nowhere else;
   c. `tickClock(date)` in place of `paintNowTabs(date)` at app.js:831 — the cheap per-tick update: no rebuild unless dirty, only `peekOf` on the cached model;
   d. the empty branch of `jumpToNow` (app.js:1064).
   The one-NOW rule lives inside `paintNowTabs` (section 1f); `paintPlan` just guarantees the order peek-then-tab and hands both the same `date`.
3. Why not "cache in repaintWall" (PLAN.md §2.6.4 / U7.2): the card-tap and zoom-step paths deliberately avoid repaintWall (a full repaint rebuilds ~110 cards and tears down the zoom — state.js:367-371 explains why remote echoes were made not to repaint). The model must be invalidated where ctx is rebuilt, not where the wall is rebuilt.
4. Tests that pin it: a jsdom shell test that taps a card (`handleTap` via the card's click) and asserts the peek's count changed without any poll; same for `stepPick` via the zoom's + door; a remote doc applied through `repaintFromRemote`; and a bulk paste followed by `closeSettings`.

## 3. ctx and state

`ctx` is a module-private object in app.js (app.js:93-148), passed by reference into wall.js/card-facts.js/notes.js/settings.js. It is NOT exported (app.js exports only `nameDates`, `roomsOnWall`, `defaultDayOf`, `nextVisibleDay`, `dayTab`, `boot`, `init`), so a plan-shelf module receives `ctx` as an argument the way every other module does.

| Field | Where set | Shape / meaning |
|---|---|---|
| `ctx.fid` | app.js:94; `refreshCtx` :208 | `state.activeFestivalId`, e.g. `'portola-2026'` |
| `ctx.meName` | :95; `refreshCtx` :209 = `crew.me(state.getCrewToken())` (js/crew.js:44-50, localStorage `me` per token with an in-memory fallback) | the name this phone is, or **null for a guest**. Guest = no name on this phone for this crew; `guestOf` (app.js:89) + `state.setWritePolicy` (app.js:90) block writes. Guests read everything, write nothing; `handleTap`/`stepPick` send them to `askToJoin`. The plan should render for a guest (crew link = consent boundary) with no "you". |
| `ctx.picks` | :96; `refreshCtx` :210 = `model.picksFor(state.crewDoc, fid)` (js/v3/model.js:32-43) | `{ [artist]: { [person]: level } }`, levels 1..4 in v4 semantics (1-3 picked, 4 must), zero tombstones dropped, legacy v3 mapped. **Not filtered by membership**: a removed person's picks are still in it — filter with `state.activePeople()`. A fresh object each call. |
| `ctx.filterPeople` | :104; `refreshCtx` :214-218 = `pruneToActive(loadPeopleFilter(fid), activeNames)` (filters.js:34, 58) | the highlight: array of member names (sessionStorage per fest per tab). It dims, never hides. `nowLanding`/`nowStops` read it (wall.js:1788-1797). |
| `ctx.folded` | :109; `refreshCtx` :219 = `loadFolded(fid)` (filters.js:100-110); also written directly by `toggleFoldFlow` :329 and `unfoldAll` :400 | array of room keys: `':fest'` (FEST_ROOM filters.js:91), `'weekend:W1'`/`'weekend:W2'` (wall.js:1364 `weekendRoom`), section labels (`'Afters'`, `'Folsom'`), dated extras (`'Late nights'`). Device-local; never in the crew doc. A key the menu does not offer is inert (wall.js:1398-1407). |
| `ctx.query` | :98; search `input` app.js:3623; cleared on fest switch app.js:2344 | the search string; never cleared by blur. |
| `ctx.now` | :110 `now: null` | **Never assigned anywhere in app.js** (grep `ctx.now =`: none). The comment "tests pin the clock" is true only for unit tests that build their OWN ctx for wall.js (e.g. tests/clock-stacks.test.mjs:65, tests/by-time.test.mjs:102, tests/events-wall.test.mjs:142 pass `now: new Date(...)`). In the running app it is always null → `new Date()`. |
| `ctx.festDates` | `refreshCtx` :220 = `festDatesOf()` app.js:238 | the day axis's dates for the notes sheet |
| others | `affinity`, `sort`, `lowPower`, `migrationPending`, callbacks `onTap`, `onStep`, `onOpenNotes`, `onOpenDayNotes`, `onOpenFestNotes`, `onJoin`, `onGuestAsk`, `wireZoom`, `onPeek` (app.js:111-147) | `ctx.weekend` is read by wall.js:2534 / wallPlanFor :1384 but never set in app.js (undefined = no filter). |

**state (js/state.js):**
- `state.crewDoc` (state.js:32) — the full doc (remote + pending overlay). `state.activeFestivalId` (:34).
- `state.fest()` (:125) = `FESTIVALS[activeFestivalId]` — the current festival object (js/festivals.js:14 `FESTIVALS` id → object). Its id is both `state.activeFestivalId`/`ctx.fid` and `fest.id`. Portola's top-level keys: `id, name, year, subtitle, location, locationUrl, dates, accent, status, timezone, artists, meta, dayMeta, venues, days` (`timezone: 'America/Los_Angeles'`). A festival file refresh REPLACES the object (app.js:3327), so hold the fid, not the object, across ticks — or treat identity change as dirty.
- `state.people()` (:127) = `crewDoc.people`; `state.activePeople()` (:145) = entries whose value is not `removed` → `[[name, personObj], …]`.
- `state.getDayArtists(day, weekend)` (state.js:403-411) — a ready, cached, weekend-aware reader of one grid day's sets with `startMin/endMin` resolved by `computeDayArtists` (js/time.js:43-69). Untagged and `weekend: 'both'` sets play every weekend. Cache cleared by `forgetComputedDays(fid)` (state.js:392) on a file refresh. The plan model should read grid sets through this, not re-parse `fest.days`.
- `state.applyRemoteDoc(remote)` (state.js:363-386) returns whether the visible slice changed (people, this fest's selections and notes, affinity, meta).

**A crew doc's people and picks (made-up example — invented names, no real data, no token):**

```json
{
  "v": 4,
  "meta": { "name": "Test Crew", "inviteFestId": "portola-2026" },
  "people": {
    "Ana":  { "colorIndex": 2, "pid": "<public person id>" },
    "Ben":  { "colorIndex": 5 },
    "Cleo": { "colorIndex": 1, "removed": true }
  },
  "festivals": {
    "portola-2026": {
      "selections": { "Robyn": { "Ana": 4, "Ben": 2, "Cleo": 3 }, "Soulwax": { "Ben": 0 } },
      "notes": { }
    }
  },
  "affinity": { }
}
```

Here `ctx.picks` = `{ Robyn: { Ana: 4, Ben: 2, Cleo: 3 } }` (Soulwax's 0 dropped; Cleo still present though removed), and `state.activePeople()` = `[['Ana',…], ['Ben',…]]`. So "pickers" for the bar must be counted over active members only: here 2 → no plan (bar = max(3, ceil(pickers/4)) and the plan needs at least 3 pickers).

## 4. Search (REVIEW-1 #6)

- **Focus hides the dock, blur brings it back:** `$('search-input').addEventListener('focus', () => dock.classList.add('hidden'))` / `blur → remove('hidden')` app.js:3658-3660. Only `#dock`; the desktop rail is never hidden. `.dock.hidden { display: none }` v3.css:720. `seenBand` (app.js:975) and `dockTop` (card-facts.js:835, `getClientRects`) both already treat a hidden dock as absent. Nothing remeasures the shell padding on hide (it is a literal).
- **A keystroke** (app.js:3622-3628): `ctx.query = value`, `unzoom({instant:true})`, `renderWall($('wall-root'), ctx)` directly — NOT `repaintWall`, so no `refreshCtx`, no `paintShowMenus`, no `positionNowMarks`, no notes count, no `updateMigrationBanner` — then `renderDayNav()` (tabs = only the days that answered, wall.js:1521-1523, and `paintNowTabs`), then `measureStickyChrome()`.
- **What the wall is while a query is on:** `renderWallInner` skips the composed wall (wall.js:2442-2445) and, on a scheduled fest, draws the week with the misses removed as LISTS: each answer group is a `listHead` over a `.wall-grid` of cards inside the day's `dayBlock` (wall.js:2449-2532). No `.times-grid`, no `.venue-grid`, no `.time-list` → no now line and no NOW marks → `nowLanding` returns null → **the NOW tab is absent for as long as `ctx.query` is non-empty**, including after blur. `maybeOpenOnDay` refuses while searching (app.js:1259); `paintShowMenus` returns early (app.js:1594).
- **After blur the query stays.** Nothing clears it except typing it away or a festival switch (app.js:2344-2346). There is no Escape-to-clear and no clear button (a plain `<input>`, index.html:210). So a phone can sit with the dock back, a filtered list wall, no NOW tab, and (if the peek followed the dock) a peek whose "land on this card" target may not be on the wall.
- **Recommendation for the peek:** hide it while `ctx.query` is non-empty, not only while the input is focused. Reasons: the search wall has no clock (no NOW anywhere, so the one-NOW rule has nothing to reconcile), a peek tap that should land the wall on a stop's card would find a list or nothing, and it matches how NOW already behaves. Implementation: the search `input` handler already calls `renderDayNav()`, so if `paintPlan` runs there (section 2c-a) it can read `ctx.query` and hide; focus/blur toggle the dock class only, so the peek also needs hiding on focus (make the peek a child of `#dock`, or have the focus/blur handlers toggle both). If the peek lives inside `#dock`, focus hiding is free.
- Whatever `--foot-h` becomes must be re-measured on focus/blur (REVIEW-1 #7's tail), because hiding the dock changes the floor; today no code runs on those events except the class toggle.

## 5. The clock

- **There is no single `now()` function in the app.** Each caller does `ctx.now || new Date()` or `new Date()`:
  - `ctx.now || new Date()`: `paintNowTabs` default (app.js:856), `refreshArtistCards` (:463), `jumpToNow` (:1063), its pulse (:1162), `repaintWall` (:1647), wall.js:1333 (`renderScheduledDayBody` now line) and :2309 (`renderComposed` marks).
  - bare `new Date()`: `tickClock(date = new Date())` (app.js:824, and the interval calls it with no arg), `maybeOpenOnDay` (app.js:1265, :1276), wall.js defaults (`positionNowLines(root, date = new Date())` :999, `scrollToNowLine` :1044, `positionNowMarks` :1729, `nowLanding` :1802).
  - Since `ctx.now` is never set in the running app (section 3), all of these are the device's instant today. But `tickClock` passes its own `new Date()` into `paintNowTabs`, so a future test hook that sets `ctx.now` would be overridden every minute. **Recommendation:** add one `appNow()` (= `ctx.now || new Date()`) and use it in `tickClock`'s default, `maybeOpenOnDay`, and the new `paintPlan`, so peek, NOW tab, now line and day-of open all read one instant.
- **The festival-timezone rule** lives in `js/v3/now.js`: `festivalClock(date, timeZone)` now.js:45-57 → `{ iso, minutes }` in the festival's IANA zone via `Intl.DateTimeFormat` (`wallClock` now.js:29-40; any failure or no zone → device clock). The day rolls over at 5 AM (`DAY_ROLLOVER_HOUR` now.js:21): 12:40 AM Sunday is Saturday at minute 24*60+40, matching `timeToMinutes`' "AM = after midnight" axis (js/time.js:5-17). `nowOnDay(fest, day, weekend, date)` now.js:69-74 uses `fest.timezone` and `dayIsoOf(dayMeta[day], weekend)` (now.js:61-65; `isos: {W1, W2}` on a two-weekend fest). Grids carry their zone in `data-tz` and `data-iso` so the ticker never asks the fest (wall.js:1001, 1732). Stacks use `nightMinutes(iso, clock)` wall.js:1724-1727 (yesterday's night still counts at 29:00). `clockLabel(minutes)` now.js:77-83 formats "5:42 PM". **The plan model should compute "now" exactly this way**: `festivalClock(date, fest.timezone)`, then match stops by night ISO and axis minutes (with `nightMinutes` for the after-midnight tail) — never the device's local time.
- **Live windows (for "NOW till …"):** grid cells' `data-now-to` is `a.liveTo = a.endMin ?? a.startMin + 60` (wall.js:1234, :1308), but `endMin` is ALWAYS filled by `computeDayArtists` (time.js:52-66: next set on the same stage, clamped 30..120 min; a stage's last set +75), so on the grid the `+60` never fires. Stacks: `nowTo = nextStart ?? endMin ?? close ?? start+60` (events.js:260), with a printed set end overriding in by-time lists (events.js:387). So there are two live rules in practice, not three; the plan's stop end should reuse `state.getDayArtists` (grid) and the stack members' `nowTo` (events.js) or a shared `liveWindowOf`, so the peek's "till" equals the wall's glow.
- **Cadence:** `startClock` app.js:819-823: `setInterval(tickClock, 60000)` from the moment `enterApp` first runs (app.js:3203), not aligned to the wall-clock minute (so the NOW tab and line can lag a boundary by up to 59 s), plus an immediate tick on `visibilitychange` → visible. Low power does NOT slow the clock (only the poll, app.js:3718). The peek's per-tick update rides this same tick.
- **How tests pin it:**
  1. Browser suites: Playwright `page.clock.setFixedTime(...)` before load — Date frozen, timers still run, so `tickClock` fires and reads the frozen instant (tests/browser/now-jump.test.mjs:106, zoom-still-hand.test.mjs:66, stack-row.test.mjs:58, show-menu-stacking.test.mjs:38, fold-intent.test.mjs:42, heads-contract.test.mjs:52, shell-contract.test.mjs:431, error-report.test.mjs:68 "nothing live: NOW never renders", and others). Memory note: the fake clock delays timers on big walls.
  2. Unit wall tests: build their own ctx with `now: new Date(...)` and pass dates straight into the pure functions (`festivalClock`, `positionNowLines(root, date)`, `nowLanding(root, ctx, date)`).
  3. Shell unit tests (jsdom booting app.js): `tests/helpers/night-clock.mjs` — `NIGHT_CLOCK=<ISO> NODE_OPTIONS="--import ./tests/helpers/night-clock.mjs"` shifts `Date` by an offset (time keeps moving) so CI exercises a live festival night; or `mock.timers.enable({ apis: ['Date'], now })` (tests/errlog-boot-crash.test.mjs:19). Memory: "Tests that pass by daylight" — boot tests on real time hit the NOW path only at night; pin clocks and use `window.X` for DOM globals.
  4. `restingLeft` is tested with pure numbers (tests/day-row.test.mjs).
  A plan-peek jsdom test should pin with `mock.timers`/NIGHT_CLOCK (the app reads `new Date()`), or the build adds the `appNow()` seam above and a test-only way to set `ctx.now`.

## 6. Surprises versus the old maps, and open questions

**Surprises (old map / PLAN.md on abe7205 vs head e1eb206):**
1. D1 is SHIPPED (v93): NOW lives inside the day row after the live day; `fitNowTab`, the ringed dot, `.dock.squeezed`, `centre()` are gone; `restingLeft`/`restDayRow` (wall.js:2697, 2824) replaced them, with gap tightening (`fitDayRowGap`). The centring CSS fix for a trailing NOW is done (v3.css:541-542). `NOW_TABS` is now `NOW_DOORS` (app.js:855).
2. The Show-menu stacking bug is fixed by raising the bar (`.menu-up` z39, v3.css:348; app.js:1491-1492), not a portal. PLAN.md §2.5.4 is stale. The menu is a popover with no history entry: Escape closes it first (app.js:3751), Back/pagehide close it instantly (app.js:3695-3696), a tap outside closes it and a tap on a card is swallowed (app.js:3684-3690), and a repaint re-checks rows in place so the poll never snatches it (app.js:1614-1620).
3. `ctx.now` is never set in the running app; `tickClock` passes its own `new Date()`. There is no single clock seam.
4. The grid's live window is effectively `computeDayArtists`' rule (next set on the stage, clamped 30..120, last set +75), not "+60": the `?? +60` at wall.js:1234 never fires on a grid. Two live rules, not three.
5. `state.getDayArtists(day, weekend)` already does the ACL weekend filter (untagged + `'both'` on every weekend) with a cache that a festival-file refresh clears — the plan model can use it instead of re-filtering `fest.days`.
6. `state.currentDay` is dead state; the scrolled active day is private to `wireScrollspy`.
7. `refreshCtx` (not `repaintWall`) is the real choke point: every pick path calls it; card taps and zoom steps never call `repaintWall` (they call `refreshArtistCards`).
8. Self-rename and bulk paste repaint nothing on the wall (the wall is behind Settings until `closeSettings`).
9. During a search the NOW tab disappears even after blur (the search wall has no now hosts).
10. `--foot-h` does not exist yet; the four literal floors (84/70/64/64 px) and the two `#dock` readers (`seenBand`, `dockTop`) are unchanged.

**Open questions:**
1. Should the peek hide for any non-empty `ctx.query` (recommended) or only while the search field is focused?
2. Does the OPEN plan show today (clock) or the day the person is scrolled to? If the latter, `wireScrollspy` needs an `onActive` callback.
3. With a highlight on, does the peek's row switch to the highlighted person ("Ross's now"), and does a peek tap then land the wall on their card (i.e. call the `nowStops` cycle)? Undrawn.
4. When something is live but no plan stop is (scattered, between stops): keep the D1 tab beside a NEXT peek (PLAN default Q4a)?
5. Where does the peek live in the DOM: inside `#dock` (search hiding and the fixed stacking come free, and a raised `.menu-up` dock lifts it too) or as a sibling companion? This decides how `seenBand`/`dockTop` measure the floor.
6. Should minute ticks align to the wall-clock minute (a `setTimeout` to the next :00, then 60 s), so "NOW till 10:15" flips at 10:15 and not up to 59 s late?
