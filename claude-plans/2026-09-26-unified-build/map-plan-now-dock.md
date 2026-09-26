# Map: Our plan, NOW and the dock (read-only map of plan-base, v92 head)

**Status:** complete map, 2026-09-25 late night PT. Nothing built; nothing edited in plan-base.
**Code mapped:** `.claude/worktrees/plan-base` at `abe7205` (v91 in production + guest first-open work). Nothing edited there.
**Design sources:** `claude-plans/2026-09-25-portola-live/design/ours-r2/BRIEF.md` (round three at its top is the decided design), `ours-r2/ours-model.mjs`, and the D1 prototype in `ours-r2/r2-proto.mjs:379-432`.

All `file:line` references are to plan-base unless marked `design/`.

## 1. The dock and the rail today (one component, two positions)

### 1a. The markup (index.html)

| Piece | Phone dock (`#dock`, <720px) | Desktop rail (`#day-rail`, >=720px) |
|---|---|---|
| You | `#dock-you` index.html:240 | `#rail-you` index.html:217 |
| NOW | `#dock-now` index.html:241, a sibling BEFORE the days row | `#rail-now` index.html:222, same |
| Days row | `<span class="days" id="dock-days">` index.html:242 | `<span class="rail-days" id="rail-days">` index.html:223 |
| Fest name (show-menu door) | `#dock-fest-wrap` > `#dock-fest-link` index.html:243-248 (inline `flex: none`) | `#rail-fest-wrap` > `#rail-fest-link` index.html:227-233 (`margin-left: auto`, carries `#sync-label`) |

The two share one vocabulary on purpose ("Kevin note 1.1", comments at index.html:214-216 and v3.css:411-413). Anything D1 or the peek does to one has to be decided for the other.

### 1b. The days row: build, scrollspy, centring, fades

- **Build:** `renderDayNav()` app.js:1197-1221 empties BOTH rows (`dock.textContent = ''`, `rail.textContent = ''`) and refills them from `dayNavOf(fest, ctx, wallRoot)` wall.js:1448-1473 on every repaint and every search keystroke (app.js:3355-3356). Tabs are `dayTab()` app.js:1182-1195 (`.day-tab`, `data-day`, dock gets `.num` for two-weekend fests). Ends with `paintNowTabs()` app.js:1220.
  - Consequence for D1: anything placed INSIDE the days row is destroyed by the next `renderDayNav`. NOW must be (re)inserted by `renderDayNav` itself or by `paintNowTabs` after it, never placed once.
- **Scrollspy + centring:** `wireScrollspy([dock, rail], wallRoot)` wall.js:2477-2625.
  - `centre(t, behavior)` wall.js:2498-2505 scrolls the ROW (never the page) so ONE tab (the active day) is in the middle, computed from `offsetLeft` (not rects, because tabs may be mid-FLIP).
  - `setActive(day)` wall.js:2507-2518 lights the tab and calls `centre()`.
  - `markOverflow()` wall.js:2523-2530 sets `.overflowing / .more-left / .more-right`, which drive the edge-fade mask v3.css:510-521 (`--row-fade: 18px` v3.css:519).
  - A `ResizeObserver` on each row wall.js:2600-2615 re-centres "the day you are in" when the row changes width (written for NOW arriving/leaving before the row, wall.js:2596-2599).
  - Geometry authority: `syncFromGeometry` wall.js:2552-2569 reads `--jump-offset`.
- **Centring when the row fits:** `.dock .day-tab:first-child { margin-left: auto }` / `:last-child { margin-right: auto }` v3.css:502-503. Only `.day-tab` is matched. A NOW tab that becomes the row's last child (the live day is the last tab: Portola Sunday, ACL SUN 11) breaks this pair of rules, because the last child is no longer a `.day-tab`.
- **Known wart on ACL (NOW.md "Next" 2):** the dock lights FRI 2 for about a second on open before it finds SAT 3. `wireScrollspy`'s initial claim wall.js:2577-2586 is `setActive(tabs[0])` at scrollY 0, then the day-of open scrolls (app.js:1081-1105) and the scroll listener corrects it. Also referenced in tests/browser/now-jump.test.mjs:873-876. D1 is a natural moment to fix it (claim after the open lands), and it matters more once NOW is pinned to the live day's side.

### 1c. NOW today (v87, "the NOW jump")

- `NOW_TABS = ['dock-now', 'rail-now']` app.js:715.
- `paintNowTabs(date)` app.js:716-719: live = `!!nowLanding(wallRoot, ctx, date)`; then `showNowTab` + `fitNowTab` on both. Callers: the minute ticker `tickClock` app.js:699-703, `renderDayNav` app.js:1220, `jumpToNow` when the plan is empty app.js:887.
- `fitNowTab(tab)` app.js:737-754: the squeeze logic. Measures the row as `tab.nextElementSibling` (assumes NOW sits directly BEFORE the row). Three outcomes: word; `.compact` (a 17px ringed dot, v3.css:642-645); and the last resort `.squeezed` on the dock that lets the fest name ellipsize (v3.css:651-653, `!important` to beat index.html's inline `flex: none`) while the row claims `min-width: <widest tab>`. Re-run on font load app.js:3361-3363 and resize app.js:3369.
- `showNowTab(tab, on)` app.js:768-801: arrival = fade in from -6px after `STAGGER_MS`; leave = quick fade to -6px then `hidden`. `slideTabs(before)` app.js:760-767 FLIPs every tab in `tab.nextElementSibling` (again: assumes NOW is before the row).
- Click: app.js:3396 `for (const id of NOW_TABS) $(id).addEventListener('click', jumpToNow)`.
- CSS: `.now-tab` v3.css:632-637 (brand violet, never `--fest`: NOW is not one of the four accent places), dock type v3.css:646, rail type v3.css:654-655, touch floor opt-out and borrowed reach v3.css:578, 587, 597, 603 (the `.compact` reach is asymmetric because the avatar's reach is on its left).
- Screen reader: `#now-status` index.html:286 (polite, pre-rendered), filled by `sayNow()` app.js:1012-1019 with `nowSaid()` wall.js:1905-1930.

## 2. The NOW jump and the now line (the logic Our plan's peek inherits)

Pure-ish logic in wall.js (unit-tested through jsdom geometry stubs), glue in app.js.

| Function | Where | What it decides |
|---|---|---|
| `positionNowLines(root, date)` | wall.js:948-990 | draws/moves the full-width `.now-line` and the rail's `.now-label` on today's grid; no repaint |
| `positionNowMarks(root, date)` | wall.js:1585-1602 | toggles `.card.now` on stack cards (afters, Folsom, Late nights) and appends ", playing now" to the aria-label |
| `scrollToNowLine(root, …)` | wall.js:993-1017 | the day-of open (line a third down, else today's block, else a dated section's room) |
| `liveOnWall` | wall.js:1626-1655 | lines (and whether the clock is inside the grid's hours), marked stack cards, and the highlighted people's live picks, best first (level, then most recent start) |
| `nowLanding(root, ctx, date)` | wall.js:1658-1666 | the first tap's answer `{kind, line, card, match}`; null = nothing live = no NOW tab |
| `landingTarget(m, geo)` | wall.js:1719-1743 | the scrollY a landing parks at (line a third down; card a quarter down; tall-set clamp) |
| `nowStops(root, ctx, date, geo)` | wall.js:1814-1880 | every stop a tap can go to, by height then across; grid frames (`frameSlide`) and v91's stack-row slides (`rowSlide` wall.js:1802-1808, `rowSpanIn` wall.js:1790-1800) |
| `nowPulseable` | wall.js:1890-1895 | what may pulse when the glide lands (rule re-read at landing) |
| `nowSaid(plan, stop)` | wall.js:1905-1930 | the screen-reader sentence |
| `stillThere(cycle, geo)` / `nowStep(plan, cycle, geo)` | wall.js:1956-1999 | tap again = next stop while the page is where the last tap left it (4px, grid by day, stack rows by `stackRowKey` wall.js:2223) |

App glue, app.js:803-1043: `seenBand(inGrid)` app.js:806-816 (the visible band is under the rail + stage strip and ABOVE `#dock`'s top), `nowCycle` / `nowSeq` app.js:850-853, `pageGeo(root)` app.js:854-881 (v91's `row` / `rowLeft` readers are the "stack-row slide"), `jumpToNow()` app.js:882-1006 (page glide, grid slide, v91 row slides app.js:931-940, scrollend bookkeeping, pulse), `sayNow`, `pulseLine` app.js:1023-1030, `nothingOnFor` app.js:1034-1043 (the quiet toast "Nothing of Kat's is on right now").

**This logic is not dock code.** It answers "where on this wall is now, for this highlight", and it moves with whichever button calls `jumpToNow()`. D1 and the end state both keep every line of wall.js's NOW functions; only the door changes. Two geometric inputs change with the end state: `seenBand`'s bottom (app.js:813-815) and the zoom's floor `dockTop()` card-facts.js:728-733 both read `#dock`'s top edge. A peek row stacked above the dock is a new, taller floor; both must read it (see section 7).

## 3. The people row (member chips, + Add, highlight)

- **Markup:** `<span id="person-chips">` inside `.toolbar` index.html:208, followed by a divider, the search pill, `#sort-control`, `#notes-chip` index.html:209-215. The toolbar is NOT sticky: on the day-of open it sits 2,600-3,300px above the screen (the people-row test in `design/ours-r2/BRIEF.md:326-343`).
- **Render:** `renderPersonChips()` app.js:630-676. One chip per `state.activePeople()` (js/state.js:145); colour from `colorIndexOf` / `hslOf`; your chip gets `.you`. Tap = the people filter ("highlight"), app.js:650 → `togglePeopleFilter` app.js:684 → `setPeopleFilter` app.js:678-683 (saves to sessionStorage via filters.js `savePeopleFilter` js/v3/filters.js:44-46, then `refreshCtx`, re-render chips, `repaintWall`). `everyone ✕` appears while a filter is on app.js:656-664. Callers of `renderPersonChips`: app.js:568, 1922, 2199, 2215, 2432, 2929, 3281.
- **+ Add:** app.js:665-675, only for a named member (`ctx.meName`); text `'+ Add'`, aria "Add someone to the crew", opens `openAddMember()` app.js:1863 and pushes `sheet:add-member`. Style `.person-chip.add` v3.css:251-252 (dashed 1.5px ring).
  - Settings already says `+ Add someone` for the same act (js/v3/settings.js:569-572). The brief's small fix makes the wall match.
  - **Copy lock:** How it works row 2 is `chipDemo('+ Add', { dashed: true })` + `'Add your people with + Add,'` js/v3/settings.js:428-430, and `tests/docs-truth.test.mjs:178` pins that string word for word (Kevin's eight rows, MODEL-V4 §3a.4). Changing the chip to "+ Add someone" means changing settings.js, the test row and MODEL-V4 §3a.4 together; the sub line stays. It is Kevin's copy, and round two's Q5 default ("yes") is the authority to cite.
- **Highlight = `ctx.filterPeople`** (app.js:103-104, refreshed in `refreshCtx` app.js:193-197, pruned to active members). It dims, never hides (filters.js:1-10). NOW reads it (`liveOnWall` wall.js:1641-1654), so "tap Ross, then NOW" is the Ross story. The people row is the only door to a highlight today, and it scrolls away; R1 in the brief would have pinned it; R3 (picked) leaves it where it is and moves "Ross's now" into the peek.
- **The `+3` overflow ring:** `aura.js:83` pushes `{ kind: 'ghost', label: '+n' }`; styled `.mark.ghost` v3.css:235-236 with `border: 1px dashed`. The fit table measures it as "a dashed 1px edge" aura.js:203-204 (`10 + textWidth`). A solid ring keeps the same 1px, so the width table and `tests/browser/meter-contract.test.mjs` are untouched; only the comment at aura.js:203 changes. The gallery's `18b` / `18c` rows (gallery.html:744-745) and the zoom-chips "crowd" row (gallery.html:772) are where to look. The dashed guest ring on `.you-avatar.guest` v3.css:666-667 is the "add" meaning the rule protects.

## 4. The show menu (the fold) and why the plan must read it

- **Door:** the fest name at the end of the dock and the rail. `SHOW_MENUS` app.js:1234; `paintShowMenus()` app.js:1329-1364 builds a `.sort-pop` listbox in each wrap when the fest has 2+ rooms (`roomsOnWall()` app.js:284-286 → `roomsOf` wall.js:1371-1376), else the tap goes to Settings. Rows are real buttons (`showMenuRow` app.js:1268-1293). A row tap → `toggleFoldFlow(key)` app.js:294-340 (the leave/arrive motion, then `repaintWall`). Opens upward from the dock (v3.css:318). Wired app.js:3401-3409; Escape closes it first app.js:3465-3470.
- **State:** `ctx.folded` (app.js:105-110), device-local per fest, `loadFolded`/`saveFolded` filters.js:100-117 (localStorage, memory wins on a refused write). Never in the crew doc (law 2). v92 adds link seeding (`&show=`) filters.js:139-190.
- **Keys:** `':fest'` (FEST_ROOM filters.js:91) for the festival's own room on a one-weekend fest; `weekend:W1` / `weekend:W2` (wall.js:1313) INSTEAD of `:fest` on a two-weekend fest (roomsIn wall.js:1378-1391); a section's label (`Afters`, `Folsom`) and a dated extra's key (`Late nights`) otherwise.
- **The plan applies the fold:** `wallPlanFor(fest, ctx)` wall.js:1326-1369 drops hidden sections/extras/weekends and any day left empty. `roomsOf` reads the same plan with nothing folded (wall.js:1373).
- **Consequence for Our plan (rule 8):** bodies are placed on the UNFOLDED plan, then only visible places are shown. So the model needs both: `wallPlanFor(fest, { ...ctx, query: '', folded: [] })` for placing, and a visibility test built from the same keys the menu writes. The design model's `visibleIn` (design `ours-model.mjs:141-144`) tests `place.roomKeys` against `folded`, and its grid places carry `roomKeys: [':fest']` (design `ours-model.mjs:84`), which is wrong on ACL (see 5b).

## 5. Where the Our plan model would live, and what it must fix first

### 5a. The shape I recommend

1. **`js/v3/plan.js`, a pure module** (no DOM), ported from `design/ours-r2/ours-model.mjs`. Exports: `barFor`, `usOf`, `planOf(fest, picks, members, { folded })` (was `oursModel`), `planAt(plan, dayKey, minutes)` (was `oursAt`), `peekOf(plan, dayKey, minutes)` (lift from `design/ours-r2/r3-proto.mjs:129-135`: NOW = the stop the clock is in, else NEXT = the next MOST stop, else the next stop, else null), `headlinersOf`, `forkFor` (from `r3-proto.mjs:122-126`). `shareTextOf` stays in the design folder only (the brief retired "Tell a friend", BRIEF.md:81-83; do not port dead code).
2. **Its input is the wall's own week, not a second reading of the file.** The design model re-derives nights from `fest.days` keys + `dayMeta.wd` (`ours-model.mjs:72-121`). The app already has one authority for "what days exist, on what date, in which rooms": `eventModelOf` (js/v3/events.js:320-460) behind `wallPlanFor` (wall.js:1326). `planOf` should walk `plan.model.days` (each has `key`, `dayKey`, `iso`, `weekend`, `grid`), take a grid day's sets from `fest.days[day.dayKey].artists` filtered by `a.weekend` (null or equal to `day.weekend`), the sections from `plan.model.sections[i].byDay.get(day.key)`, and each dated extra's `byDate` (one night per ISO date). Nights are keyed by `day.key` (e.g. `Saturday`, `Friday|W1`) or, for a dated extra, by its ISO, and ordered by ISO, never by `WEEKDAYS`.
3. **`wallPlanFor` is in wall.js, a DOM module.** A pure `plan.js` should not import wall.js. The unification move: lift the week (`wallPlanFor`, `roomsOf`/`roomsIn`, `weekendsOf`, `weekendRoom`, `groupByDay`, `knownDaysOf`, `splitDays`, the pure half of `dayNavOf`) into a pure `js/v3/week.js` that wall.js imports and re-exports, so every existing import keeps working. S-M, pure motion of code, and it gives Our plan, the tabs and the show menu one reader of the week.
4. **One live window for a set.** The wall lights a grid cell for `endMin ?? startMin + 60` (wall.js:1183, written to `data-now-to` wall.js:1257); the design model ends an unprinted set at the next set on its stage, else +60 (`ours-model.mjs:81-82`); stacks use `venueGroupsOf`'s rule (events.js:249-258). Three rules for "when does this end" would let the peek say "NOW till 10:15" while the wall's glow ended at 10:00. Put one `liveWindowOf` beside `parseEventTime` in events.js and use it in the grid layout, the plan, and the peek. This is the same question as NOW.md "Next" 2 (ACL headliners print only a start), so decide it once, there.
5. **Members = active people only:** `planOf(..., state.activePeople().map(([n]) => n))`. `ctx.picks` (model.js:32-43) is not filtered by membership; a departed member's picks must not count toward "us" or the bar.
6. **Cache per repaint, not per tick.** The model is a 5-minute slice sweep over every place and every person (`ours-model.mjs:168-212`). Build it in `repaintWall` (app.js:1366) when picks, members or the fold change; the minute ticker (`tickClock` app.js:699-703) only calls `planAt`/`peekOf` on the cached model.

### 5b. What the design model gets wrong on ACL (verified 2026-09-25, read-only run against `data/festivals/acl-2026.json`)

A probe (`placesOf` from the design model on the ACL file, scratchpad script, no network) returned:

| Check | Result | Why it matters |
|---|---|---|
| Nights | `['Fri','Sat','Sun']` | ACL is six dated days (FRI 2 … SUN 11) plus a Late nights tab (events.js:437-456). |
| Same-stage overlaps on Friday | 18, e.g. "Kings of Leon 8:15 PM / Skrillex 8:15 PM @ T-Mobile" | W1 and W2 sets land on one clock; bodies would be placed at sets on the wrong weekend. |
| Room places | 0 of 66 Late nights entries | `nightOf` (events.js:31-39) only reads `night`/"Wkd · Venue"; dated entries (`date`, events.js:43-46) are dropped. |
| Grid `roomKeys` | `[':fest']` | ACL's menu offers `weekend:W1/W2` instead; hiding Weekend 1 would hide nothing in the plan (rule 8 broken). |

All four are fixed by reading the wall's week (5a.2). One product call remains after the fix (section 8, call 3): ACL's 12 untagged sets per day play BOTH weekends, and picks are per artist, so rule 5 ("an artist who plays twice counts at both places, and the stop says 'also …'") would fire on nearly every ACL stop.

### 5c. Tests for the model

- `tests/plan-model.test.mjs` (pure, like `tests/events-model.test.mjs`): the brief's numbers as fixtures, computed on the shipped Portola file with the invented nine (`design/ours-r2/crew.mjs`, to become `tests/fixtures/plan-crew.mjs`; placeholder names, never real crew data): bar 3 for nine, 4 for thirteen; Saturday's spine (Tove Lo 6 / Robyn 7 / Dog Blood 8 / Soulwax 5 / Public Works 6 from 10:30 PM); Folsom hidden changes Sunday afternoon only and Mochakk stays 5 (rule 8); Thursday Regency 5 "also Sat" (rule 5); a departed member not counted; fewer than 3 pickers = no plan. ACL: six nights plus Late nights dates, no same-stage overlap, Weekend 1 hidden removes W1 stops only.
- The live-window rule gets its own cases next to `tests/time.test.mjs`-style checks, and a jsdom assertion that a grid cell's `data-now-to` equals the plan's stop end for the same set.
- `tests/app-shell-complete.test.mjs` will fail until `/js/v3/plan.js` (and any shelf module) is in `APP_CORE` (service-worker.js:22-61), then `node scripts/sw-stamp.mjs`.

## 6. D1: NOW as a tab beside the live day (ship first, size S)

The decided dock for Portola (BRIEF.md:467-478; prototype `design/ours-r2/r2-proto.mjs:413-432`, which did `tab.after(now)` and a sliver-free snap, `snapRow` r2-proto.mjs:383-411). What it means in the code:

### 6a. Changes

1. **Where NOW lives.** Keep the two buttons and their ids (`#dock-now`, `#rail-now`: the click wiring app.js:3396, `#now-status`, and every test that finds `#<door>-now` keep working), but hold them by reference once at init and insert each INTO its row, right after the tab of the live day, on every `renderDayNav` (app.js:1197). The row is emptied on every repaint and search keystroke, so the insert must happen there, silently (no arrival animation when NOW was already showing before the rebuild; the 25 s poll repaints). Delete the sibling slots at index.html:218-222 and :241.
2. **Which day is live:** the day block that holds `nowLanding()`'s answer: `(landing.card || landing.line).closest('.day-block').dataset.day`. That value is exactly a tab's `data-day` (`DAY_ANCHOR` wall.js:2470; `dayTab` app.js:1182-1195 writes `anchor || key`), so it works for a grid day, a two-weekend day (`Saturday|W1`) and a dated tab (`Late nights`). One source for "live" and "where": the same call that decides NOW exists (app.js:717).
3. **Retire the squeeze.** Delete `fitNowTab` (app.js:720-754), `.now-tab.compact` and its reach (v3.css:603, 639-645), `.dock.squeezed` (v3.css:647-653) and the `min-width` hack, and the font-load / resize refits (app.js:3361-3363, 3369). `showNowTab`/`slideTabs` (app.js:756-801) read `tab.parentElement` instead of `tab.nextElementSibling`, and FLIP the day tabs around NOW (the arrival: NOW fades in from -6px, the tabs after it slide right; the leave: quick, then they slide back).
4. **Row framing.** `centre(t)` (wall.js:2498-2505) centres one tab. D1 needs "keep these tabs whole" (the active day, and NOW with the live day when they are the same day) plus the new rule for every fest: no tab ever shows as a sliver; anything past an edge sits inside the fade. Port the prototype's `snapRow` scoring into wall.js as `frameRow(row, keep)`, used by `setActive` and by the row `ResizeObserver` (wall.js:2600-2615). Same geometry basis as today: `offsetLeft`, never rects, because tabs may be mid-FLIP.
5. **Centring when the row fits:** `.dock .day-tab:first-child { margin-left: auto }` / `:last-child { margin-right: auto }` (v3.css:502-503) become `.dock .days > :first-child` / `> :last-child`, so a NOW that ends the row (the live day is the last tab: Portola SUN, ACL SUN 11) still centres it.
6. **Desktop rail:** the same move inside `#rail-days` (one component, two positions). The rail never needed the dot; nothing else changes there.
7. **Fix the ACL FRI flash with it** (NOW.md "Next" 2). `wireScrollspy`'s first claim at scrollY 0 is `tabs[0]` (wall.js:2577-2586) before the day-of open lands (app.js:1081-1105), so ACL lights FRI 2, glides, then finds SAT 3. With NOW pinned beside the live day, that first wrong claim also glides the NOW pair out and back. Claim after the open instead.

### 6b. What D1 removes

`fitNowTab`, the ringed dot, the squeeze and the fest-name ellipsis, two resize/font hooks, and the "NOW is not in the tab rows" rule in MODEL-V4 §3d ("Where" and "Room" bullets, `claude-plans/2026-09-16-wall-v4/MODEL-V4.md:317-319, 380-383`), which D1 reverses and must rewrite with a date.

### 6c. The risk D1 has to answer: ACL on a narrow phone

The brief measured D1 on Portola only ("390 shows FRI SAT NOW SUN, 320 shows SAT NOW"). ACL's dock label is `ACL MUSIC FESTIVAL '26` (`festLinkLabel` wall.js:1394 on `"ACL Music Festival"`). The v87 tests record ACL's row width beside the 17px dot as 146 / 106 / 91 / 36px at 430 / 390 / 375 / 320 on CI's Linux Chromium (tests/browser/now-jump.test.mjs:858-867, measured 2026-09-24). Without NOW in front, the row gains the dot plus one 14px gap (about 31px): roughly 177 / 137 / 122 / 67px. D1 needs the live day (about 40-45px for `SAT 3`) + the 24px gap + NOW's word (about 40px) whole: about 105-110px. So ACL fits at 390 and up, is marginal at 375, and does not fit at 320 (about 67px) unless something gives. These are estimates from recorded widths; measure them in the rewritten contract. Options are in section 8 (call 1).

### 6d. Tests D1 changes

| Test | Now | With D1 |
|---|---|---|
| tests/browser/now-jump.test.mjs:169-194 | "NOW sits before the days" (`r.right <= days.left + 1`) | NOW is inside the row, directly after the live day's tab; not a day (no `data-day`, never `.active`) stays |
| :771-792 | ACL 305: NOW squeezes the fest name, gives it back | deleted, or inverted by call 1 |
| :802-813 | 320: you / NOW / days / fest in a row | you / days-row (holding NOW) / fest, no overlap |
| :815-906 | the dock-fit matrix (9 fests x widths, x2 glyph widths): word vs dot, `squeezed`, `festCut` | same matrix, new contract: NOW always has its word; the live day and NOW whole when you stand on the live day; no tab a sliver (a partial tab only inside the fade); `festCut` false unless call 1 says otherwise; `overflowing` re-read |
| :157-161 `tapNow` | clicks `#<door>-now` | unchanged if the ids stay |
| tests/browser/zoom-still-hand.test.mjs:131 | clicks `#rail-now` by its centre | unchanged (it finds the button wherever it sits) |
| tests/browser/shell-contract.test.mjs:258-313, heads-contract | read `#dock-days .day-tab` | unaffected (`.now-tab` is not `.day-tab`); the no-sliver rule is worth an assertion here, on ACL's seven tabs |
| tests/now-jump.test.mjs (unit) | pure wall.js NOW logic | unaffected |
| gallery.html:295-301 | a static dock with no NOW | add the D1 states (SAT NOW SUN at 390; the 320 pair; ACL) so they live somewhere |

Plus `node scripts/sw-stamp.mjs` (index.html, app.js, wall.js, v3.css are all APP_CORE).

## 7. The end state: one NOW, in the peek (size L, with the plan)

### 7a. The one-NOW rule, as states

"One NOW everywhere" (BRIEF.md:112-114) holds only if every moment has at most one NOW door. The design covers the first row below; the others are not drawn:

| Something live on the wall | Our plan for today | A plan stop live now | Proposed NOW door |
|---|---|---|---|
| no | any | – | none (the peek, if any, says NEXT) |
| yes | none (fewer than 3 pickers, a solo, a new crew, a day with no stop) | – | **the D1 tab** (fallback) |
| yes | yes | yes | **the peek's NOW row** |
| yes | yes | no (scattered, between stops, afters after the last stop) | open: the peek says NEXT; see call 2 |

So D1 is not throwaway: it is the NOW door whenever the peek is not carrying NOW. Rule to build: the tab shows exactly while `nowLanding()` is non-null AND the peek is not showing a NOW row.

### 7b. What the end state removes (on top of D1)

- `#dock-now` / `#rail-now` as the everyday door (they stay only as the fallback in 7a), the NOW pair in `frameRow`'s keep-list when the peek carries NOW.
- The dock's job of answering "where are we now". The dock is you · days · fest name again (BRIEF.md:433-436), which also dissolves ACL's narrow-phone problem from 6c whenever the peek is up.
- The v87 tap-again cycle with nobody highlighted (line → afters rows → wrap). In the brief a tap on the peek opens the plan; only with a highlight does a click "land the wall on their card" (BRIEF.md:112-114, 433-436). The cycle logic (`nowStops`/`nowStep`) stays in wall.js; whether anything still calls it without a highlight is call 2.

### 7c. What it adds, and where each piece plugs in

- `js/v3/plan.js` (section 5) and a shelf module (e.g. `js/v3/plan-shelf.js`) beside `join-shelf.js` / `welcome.js` / `crew-entry.js`: the peek row, the phone shelf (drag up past a third to open; direct manipulation, never eased; Reduce Motion / Low power jump), the desktop corner card (380px, 20px in, "Open ⌃") and panel (400px, rail bottom to window bottom, no backdrop, "Close ⌄").
- The peek's row with a highlight ("Ross's now") is not designed (BRIEF.md:570-573 lists it as not drawn). It needs a row grammar before it is built.
- Brand only, never `--fest` (the four places, v3.css:424, 657, 662, 760 and index.html:86 are the accent's homes today; the peek, its NOW/NEXT pills and "Open" are not among them). Note Seismic 9's accent (167,139,250) sits close to `--brand` (192,132,252, v3-tokens.css:45): with D1 an active SAT and a NOW side by side would read as two violet tabs there.
- The desktop card is "one button" with an "Open ⌃" button on its top line (BRIEF.md:96-103). A button inside a button is invalid; make the whole card the `<button>` and draw "Open ⌃" as a span, so Enter/Escape and the 44px floor (v3.css:562-564, applied to `button`) come for free.

### 7d. Geometry: everything that clears "the dock" must clear the dock plus the peek

On a phone the peek adds about 44px on the dock's top edge. Every place that measures or hard-codes the dock:

| Where | Today | Needs |
|---|---|---|
| index.html:81 `.shell` bottom padding | `calc(84px + env(safe-area-inset-bottom))` | + the peek, or the wall's last row hides under it |
| app.js:806-816 `seenBand()` | band bottom = `#dock` top | the peek's top (NOW landings, `nowStops`' "already shown" test) |
| card-facts.js:728-733 `dockTop()` | the zoom's floor = `#dock` top | the peek's top (the zoom clears it by 8px) |
| v3.css:184-187 `.bring-offer` (welcome card, bring offer) | `bottom: calc(64px + env)` | above the peek, or the family's stacking rule (the phone stack of welcome + peek is not drawn) |
| v3.css:837-839 `.undo-toast` | `bottom: calc(64px + env)` | above the peek |
| v3.css:167-173 `.spot-pill` | right 12px, bottom 70px (phone) / 16px (desktop) | collides with the desktop corner card (bottom-right, 20px in) |
| app.js:3388-3390 | search focus hides the dock | hides the peek too |
| tests/browser/zoom-chrome-contract.test.mjs:89-90, 172-180; tests/browser/stack-row.test.mjs:277-290 | measure `#dock`'s top as the floor | measure the peek (one helper both use) |

The cleanest move is one measured variable, like `--rail-h` (`measureStickyChrome` app.js:1156-1170): `--foot-h`, the height of the dock plus whatever sits on it, written on every repaint and resize, read by the padding, the toasts and offers, `seenBand` and `dockTop`. The four `64px`/`70px`/`84px` literals go.

On desktop, the open panel covers the right 400px of a full-bleed grid (`.times-wrap` is 100vw). The NOW landing's sideways `frameSlide` (wall.js:1780-1784) frames within the grid's full width, so a stop could land under the panel. While the panel is open, the seen band needs a right edge (the panel's left), and the zoom layer (z 36) needs a rule for the corner card and panel (the brief's cost line names "the zoom learning to clear it", BRIEF.md:443-445).

## 8. Downstream, and the calls that need Kevin

### 8a. Other fests (Kevin: "ACL and other fests at the same time")

Everything here is one codebase, so every change lands on every fest the day it ships. What differs is data shape:

- **Portola** (one weekend, sections by weekday, afters, Folsom): what the design was drawn on.
- **ACL** (two weekends, 36 of 48 Friday sets weekend-tagged, a dated Late nights tab of 66 entries, a long dock label): section 5b's four model bugs; 6c's narrow-phone fit; the rule-5 "also" noise (call 3); the FRI flash (6a.7); ACL's headliners printing only a start (NOW.md "Next" 2), which is the live-window rule in 5a.4.
- **Seismic 9, Electric Forest, EDC and other lineup-only files:** no clock, so no NOW and no plan (`wallPlanFor` returns a plan but `placesOf` finds no timed sets; the design model returns `available` but empty nights). The peek must simply not appear. Worth one test.

### 8b. Test surface, in one list

- D1: section 6d.
- End state: the browser NOW suite (tests/browser/now-jump.test.mjs, 982 lines) keeps its landing and cycle assertions but changes its door from `#<door>-now` to the peek (with a highlight) or the fallback tab; zoom-still-hand moves its "click NOW again" to the corner card with Ross highlighted; zoom-chrome and stack-row measure the new floor; new `tests/plan-model.test.mjs`, a jsdom peek test (presence, the one-NOW rule of 7a, NOW vs NEXT, hidden rooms, a guest sees the crew's plan), and a browser plan contract (drag threshold, settle, Reduce Motion instant, zoom clears the peek, desktop card and panel, Enter/Escape, keyboard focus). APP_CORE + sw-stamp.
- MODEL-V4 §3d is the NOW spec; it gets a dated rewrite at each step. How it works row 2 and tests/docs-truth.test.mjs:178 move together if "+ Add someone" ships.

### 8c. Calls for Kevin (each has a default)

1. **ACL at 320-375 with D1:** the live day and NOW do not both fit beside `ACL MUSIC FESTIVAL '26`. (a) A short dock label from the fest file (How it works already draws `ACL '26`, per tests/docs-truth.test.mjs), (b) the fest name ellipsizes as today, (c) NOW drops to its dot again at that width. *Default: (a), a short label, because it keeps "the fest name never gives way" true and removes the squeeze for every long name.*
2. **NOW when a set is live but no plan stop is:** (a) the fallback tab shows beside the peek's NEXT row, (b) the peek's row gets a small NOW jump, (c) no NOW until the next stop. And with nobody highlighted, does a NOW tap still cycle live stops (v87), or does the peek only open the plan? *Default: (a), and the cycle lives on the fallback tab and on a highlighted peek.*
3. **ACL and rule 5:** an untagged ACL set plays both weekends and picks are per artist, so almost every ACL stop would say "also Oct 9". *Default: a set repeated on the other weekend at the same stage and time is not "playing twice" for rule 5; only a different place counts.* (Separately, a crew split across weekends will look bigger than it is on each weekend; the data cannot say who goes which weekend.)
4. **When you are looking at another day than the live one (D1):** keep the active day whole first, and NOW whole only if both fit? *Default: yes; past an edge, NOW sits in the fade.*
5. **The peek with a highlight:** the row grammar for "Ross's now" (artist, place, NOW till, and Ross's chip in place of "n of us"?) is undrawn. *Default: draw it before building 7c.*
