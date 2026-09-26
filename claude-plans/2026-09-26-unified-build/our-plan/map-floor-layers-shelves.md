# Map: the floor, the layers, the shelves (for Our plan)

Head: e1eb206 (branch live/plan), mapped 2026-09-26. Status: DONE (sections 1-7 + short version at the end), 2026-09-26.

Read-only map. Every `file:line` is on head `e1eb206`. Older maps in the folder above
(`map-shelves-tokens.md`, `map-plan-now-dock.md`) cite `abe7205`; their line numbers are
stale (v3.css moved ~+30 to +50 lines, app.js ~+160 to +330). Re-verified, not repeated.

## 1. Every place that measures or hard-codes the bottom edge

The dock's own height is never named anywhere. From CSS it is 1px top hairline + 9px +
26px (the `you` avatar is the tallest child; every dock button opts out of the 44px
floor: `.dock .day-tab, .now-tab, .fest-link, button.avatar` v3.css:624-632) + 9px +
`env(safe-area-inset-bottom)` (v3.css:524-526, 535) = about **45px + inset**. The day
row's touch reach is padding 14px taken back by margin -14px (v3.css:653), so it adds
nothing. Everything below is a guess at "the dock plus some air".

### 1a. Hard-coded (CSS / HTML literals)

| What | Value | Where | Notes |
|---|---|---|---|
| `.shell` bottom padding (phone) | `calc(84px + env(safe-area-inset-bottom))` | index.html:80-81 | ~39px of air over the ~45px dock. ≥720: `22px … 40px`, no inset (index.html:82) |
| Dock | fixed bottom 0, z30, padding `9px 16px calc(9px + inset)` | v3.css:523-534 | `display:none` ≥720 (v3.css:721); `.dock.hidden { display:none }` (v3.css:720) while the search field has focus (app.js:3658-3660) |
| Welcome card + bring offer (`.bring-offer`, outer box) | `bottom: calc(64px + env(safe-area-inset-bottom, 0px))`, `left/right: 12px`, z38 | v3.css:184-189 | inner `.bring-card` max 440px centred (v3.css:190-195). **No ≥720 rule**: on a laptop it floats 64px above nothing, centred |
| Toast (`.undo-toast`) | `bottom: calc(64px + env(safe-area-inset-bottom))`, `left:50%` + `translateX(-50%)`, z50 | v3.css:888-896 | **No ≥720 rule**. Mounted in `#toast-root` (index.html:294), built by `showToast`/`showActionToast` wall.js:2576-2608 (no motion: `container.textContent = ''` in and out) |
| Spotify scan pill (`.spot-pill`) | `right: 12px; bottom: calc(70px + inset)`, z35; ≥720 `bottom: 16px` | v3.css:167-173 | built settings.js:1395-1404, appended to `body`, `pointer-events:none`. 70 where every other companion says 64. **On a laptop it is the only thing that lives bottom-right today** (right 12, bottom 16) |
| Join shelf | `.sheet` bottom 0 + `padding-bottom: calc(16px + inset)` | v3.css:483-490, 1426-1427 | the only sheet that honours the inset; plain notes sheets (`.sheet`, padding 16px, v3.css:487) do not |
| Notes / share / add sheets | `.sheet` fixed bottom 0, `max-height: 72vh`, z41 | v3.css:483-490 | ≥720 a centred dialog (v3.css:511-520) |
| Show menu popover (dock) | `.dock .sort-pop { top:auto; bottom: calc(100% + 8px) }` | v3.css:343 | anchored to the fest-name wrap, so it opens upward from the dock's top edge + 8px; it lives INSIDE the dock's stacking context (§2) |
| Settings page bottom padding | `calc(40px + env(safe-area-inset-bottom))` | index.html:264 | not the wall; unaffected |

### 1b. Measured at runtime (JS)

| What | How | Where |
|---|---|---|
| `seenBand(inGrid)` — the band a NOW landing must land inside | top = `--jump-offset` (or `--rail-h` + the block's stage strip inside a grid); **bottom = `#dock` top** when the dock is not `display:none` and not `.hidden`, else `innerHeight` | app.js:964-977; fed to wall.js through `pageGeo().band` app.js:1035 (the NOW stops' "already on screen" test, wall.js:1831, 1847) |
| `dockTop()` — the zoom's floor | `#dock` top if it has client rects and sits inside the viewport, else null | card-facts.js:828-838 |
| `place()` — zoom placement | floor = `dockTop()`; a zoom within 8px of the floor moves UP (never shrinks); ceiling (`chromeCeiling`: `#day-rail` + the card's own `.tt-block > .stage-strip`) wins a tie | card-facts.js:863-900 (floor line 893-895) |
| zoom `follow()` on scroll | unzooms when the card's top passes the floor (`r.top >= floor`) or its bottom passes the ceiling | card-facts.js:1514-1518 |
| Welcome / bring offer stepping up for a toast | a MutationObserver on `#toast-root`; outer box gets `translateY(-(toastH + 8)px)`; CSS transition `.24s cubic-bezier(.2,1.15,.35,1)` (v3.css:188) | welcome.js:132-151, crew-entry.js:217-237 (two copies, line for line) |
| Join shelf riding the keyboard | `visualViewport` resize/scroll → `sheet.style.bottom = keys px`, `maxHeight` | join-shelf.js:162-184 |
| Day-of open | `scrollToNowLine` puts the now line at `innerHeight * 0.33` — it does NOT subtract the dock or any peek | wall.js:1044-1050, called app.js:1270 |

Strips (`#new-build-strip` app.js:1740-1755, `#migration-banner` app.js:1704-1733, the
archive note) are **not bottom chrome**: `insertStrip` puts them in flow after
`.toolbar` (app.js:1694-1699). They never measure the dock. The new-build strip is read
by id in Settings (settings.js:991).

### 1c. Browser tests that measure `#dock`

| Test | What it measures |
|---|---|
| tests/browser/zoom-chrome-contract.test.mjs:79-90, 106-120, 172-180, 226-239 | `floor` = `#dock` top; "a card by the dock moves UP to clear it by 8px, exactly"; ≥720 `floor === null` |
| tests/browser/stack-row.test.mjs:330, 337 | `#dock` top as the floor a NOW row slide must stay above |
| tests/browser/now-jump.test.mjs:127-128, 139, 219, 233, 261-262, 337-342, 396, 436, 646-650, 806-809, 1060-1064, 1104 | a local `dockTop` (the dock's top, else `innerHeight`) as the bottom of the seen band for every landing assertion; :835 and :919 still read `.squeezed` on `#dock` |
| tests/browser/show-menu-stacking.test.mjs:50-100 | `#dock .sort-pop`, `#dock.menu-up` (§2) |
| tests/browser/guest-tap-route.test.mjs:178, 187 | `#dock .day-tab`, `#dock .now-tab` (taps, not geometry) |

All three geometry suites (zoom-chrome, stack-row, now-jump) define "the floor" as
`#dock`'s top **independently**, inline. A `--foot-h` (or a `bottomChromeTop()`
helper exported to the page) should become the one thing they read, or each test will
keep passing while a zoom or landing hides under the peek.

## 2. Layers: every z-index, the stacking contexts, the Show-menu bug

### 2a. Page-level layers (index.html has no z-index; its inline `<style>` sets none; no JS sets `zIndex`)

| z | Element | Where | Positioning / context | For |
|---|---|---|---|---|
| 24 | `.stage-strip` | v3.css:825-830 | sticky `top: var(--rail-h)`, `backdrop-filter` → own context | stage names pinned under the rail |
| 25 | `.day-rail` (≥720) | v3.css:423-440 | sticky top 0, `backdrop-filter` → own context | the desktop dock |
| 30 | `.dock` (<720) | v3.css:523-534 | `position: fixed` + z → **own stacking context** | the phone dock |
| 35 | `.spot-pill` | v3.css:167-173 | fixed, in `body` | Spotify scan status |
| 35 | `.sort-pop` | v3.css:293-298 | absolute in `.sort-wrap` (relative, no z) — so it paints at its BAR's level: 30 in the dock, 25 in the rail (39 while `.menu-up`) | sort chip + Show menu |
| 36 | `#zoom-layer` | v3.css:1160 | fixed inset 0, `pointer-events:none`, appended to `body` (card-facts.js:785) | the grown card |
| 38 | `.bring-offer` (welcome card, bring offer) | v3.css:184-189 | fixed, mounted in `#screen-app` (app.js:2738, 2791) which is NOT a context, so root-level | companions above the dock |
| 39 | `.dock.menu-up`, `.day-rail.menu-up` | v3.css:344-348 | the bar raised while its Show menu is open | fixes the menu-under-welcome bug |
| 40 | `.sheet-backdrop` | v3.css:482 | fixed inset 0, `rgba(0,0,0,.45)`, in `body` | modal scrim |
| 41 | `.sheet` | v3.css:483-490 | fixed; `animation: sheetIn` (transform) | notes, share, add, join shelf |
| 50 | `.undo-toast` | v3.css:888-896 | fixed, `transform` | toasts |

Inside-component z (not page layers): card corners z1 (v3.css:120, 130); zoom-card
internals z1-4 (v3.css:1099, 1117-1123, 1178, 1187-1192, 1255, 1258). `.stage-strip
.times-grid` has `will-change: transform` (v3.css:864), a context inside the strip only.
`#screen-app`, `.shell`, `body` create no context, so every fixed layer above competes
at the root. No z-index is a token (none in v3-tokens.css).

### 2b. The Show-menu-under-the-welcome-card bug: FIXED on this head

The old map (§5c.1 of map-shelves-tokens.md) found the dock's upward menu painting at
z30, under the welcome card (z38). v92/v93 fixed it without a portal: `openShowMenu`
adds `.menu-up` to the owning bar (`wrap.closest('.dock, .day-rail')`, app.js:1485-1492),
CSS raises it to 39 (v3.css:344-348), and `hideShowMenu`/`settleMenuExit` take it off
only when that bar's menu is no longer open, including across a close-and-reopen
inside the 130ms fade (app.js:1437-1480).

tests/browser/show-menu-stacking.test.mjs (Chromium + WebKit, 390×844, touch, a guest
with the welcome card up) asserts: the menu opens with the card still there (:65-68);
the two really overlap and `elementFromPoint` in the overlap is the menu (:69-71); every
row is hit-testable (:73-77); tap-close + tap-reopen mid-fade leaves it open with
`aria-expanded=true` and `#dock.menu-up` (:80-87); Escape closes it and the dock steps
back (`menu-up` count 0) (:89-92); opening the join shelf (via `#dock-you`) puts the
menu away and the fest name is then behind the shelf (:94-103); no page errors.

### 2c. What this means for the peek and the plan shelf

1. A peek that is a **separate fixed element** above the dock competes at root level. At
   z < 38 the welcome card / bring offer (bottom 64px, full width on a phone) covers it;
   at z > 39 it covers the open Show menu (which rises from the dock's top edge + 8px,
   v3.css:343, straight into the peek's band). So either (a) the peek joins the
   `.menu-up` policy (raise the menu's bar above the peek too), or (b) the peek lives
   INSIDE the dock's stacking context (DOM child of `#dock`), where the menu (z35 in
   that context) paints over it by z and `.menu-up` lifts both together.
2. The zoom (36) is below the companions (38): today a zoom grown near the bottom is
   covered by the welcome card, because the zoom's floor only knows `#dock`. A peek at
   z < 36 would be covered by a zoom unless the floor learns it (§1b `dockTop`).
3. The open plan on a phone is non-modal (no backdrop), so it does not belong at 40/41.
   Toasts at 50 will sit over it (bottom 64px) — fine only if the toast moves above
   `--foot-h` (§3).
4. Recommended order, bottom-up: dock 30 → peek/plan shelf in the dock's context (or a
   sibling at 31-34) → spot pill 35 (must move above the peek) → zoom 36 (floors on the
   peek) → companions 38 (must sit above `--foot-h`, or never share the screen with the
   peek) → raised bar 39 → sheets 40/41 → toasts 50. Make these tokens (`--z-*`) while
   touching them; the old map proposed the same.

## 3. `measureStickyChrome` and `--rail-h`: the model for `--foot-h`

`measureStickyChrome()` app.js:1328-1345:
- reads `#day-rail`'s `offsetHeight` (0 under 720, where the rail is `display:none`) and,
  only when the wall is not day-first (`#wall-root .tt-block` absent), the page's single
  `.stage-strip` height;
- writes on `document.documentElement.style`: `--rail-h: <railH>px` and
  `--jump-offset: <railH + stripH + 6>px`.

Called from exactly three places: the end of `repaintWall()` (app.js:1628, call at
:1655); the search field's `input` handler after `renderWall` + `renderDayNav`
(app.js:3622-3628); and a 150ms-debounced `resize` (app.js:3635-3639). NOT on font
load (`document.fonts` loadingdone only re-rests the day rows, app.js:3632-3634), NOT on
the dock's hide/show at search focus/blur (app.js:3658-3660), and no ResizeObserver.

Readers: `.stage-strip { top: var(--rail-h, 0px) }` (v3.css:826); block
`scroll-margin-top: var(--jump-offset, 8px)` (v3.css:374); `seenBand` (app.js:968, 972);
`takeWallPlace` band top (app.js:419); wall.js's scrollspy geometry (wall.js:2871-2927).

A `--foot-h` built on the same pattern needs more triggers than `--rail-h` has, because
the bottom chrome changes without a repaint:
1. the peek appearing/leaving (minute tick `tickClock` app.js:824-832, which already
   repaints NOW; plan-cache invalidation on a pick — REVIEW-1 finding 2);
2. the dock `.hidden` on search focus and back on blur (app.js:3658-3660; REVIEW-1
   finding 7);
3. the plan shelf dragged open (do NOT rewrite a root variable per pointermove — that
   would restyle the page every frame; measure the resting peek only, and treat the
   open plan as covering the wall, which is what it is);
4. resize/rotation (already debounced) and the late font (the peek's artist line is
   display type and its height can change when Anton lands);
5. the companion stack (welcome, bring offer) if they are to sit above the peek.
A ResizeObserver on the foot element (the pattern wall.js:2939-2940 uses for the day
rows) catches 1, 2, 4 and 5 in one place; write `--foot-h` from its callback and from
`measureStickyChrome` so there is one writer. Readers to switch: `.shell` padding
(index.html:81), `.bring-offer` and `.undo-toast` bottoms (v3.css:186, 890),
`.spot-pill` (v3.css:168), `seenBand` (app.js:974-976), `dockTop` (card-facts.js:833-838),
and the three browser suites in §1c. Keep `dockTop`/`seenBand` reading a real box (the
code's own rule: "Real boxes, never tokens", card-facts.js:840-848) — so export one
`footTop()` from a shared module rather than parsing the variable.

## 4. Shelves and sheets today, and the pattern the plan shelf should follow

### 4a. What exists

| Surface | Module / opener | Modal? | Mount | History | Closes by | Motion in / out |
|---|---|---|---|---|---|---|
| Notes: artist, day, section, fest | notes.js `openScopeSheet` :831-929 (`openArtistSheet` :931, `openDayNotes` :938, `openFestNotes` :942) | yes, backdrop z40 | `body` (:923) | router `sheet:notes:…` / `sheet:day:…` / `sheet:fest`, pushed by the caller AFTER opening (app.js:118, 126, 130) | ✕, backdrop tap, grabber drag > 70px — all `requestSheetClose` → `router.requestClose()` → `history.back()` → popstate reconcile → `closeSheet()` (notes.js:70-72, 731-766, 946-960) | CSS `sheetIn` .15s fade+scale(.98) in (v3.css:489-491); **none out** (teardown removes the nodes) |
| All notes | notes.js `openAllNotes` :965-1086 | yes | `body` (:1086) | `sheet:all` (app.js:3698) | same | same |
| Share moment | app.js `openShareMoment` :2054-2119 | yes | `body` (:2119) | `sheet:share` (app.js:1963) | same | same |
| Add someone | app.js `openAddMember` :2128-2182 | yes | `body` (:2182) | `sheet:add-member` (app.js:798, 2394) | same | same |
| Join shelf (guest) | join-shelf.js `showJoinShelf` :59-289, glue app.js `openJoinShelf` :594-615, `leaveShelf` :626-639 | yes | `body` (join-shelf.js:116) | **its own** `history.pushState({ joinShelf: true })` (app.js:614), consumed by `popShelfEntry`/`dropShelfEntry` (:643-648); busy Back re-pushes the entry (:629-633); a second popstate listener (:3616-3621) | Look around, backdrop, grabber > 70px (`DRAG_CLOSE_PX`, join-shelf.js:40, 228-242), Escape (app.js:3752), Back | WAAPI rise `translateY(100%)→none` GROW_MS EASE_ARRIVE + backdrop fade + 6px cascade (join-shelf.js:265-272); drop `translateY(100%)` OUT_MS EASE_LEAVE (:196-217). Sets `animation:none` to cancel `sheetIn` (v3.css:1427) |
| Welcome card | welcome.js `showWelcome` :153-219, `dismissWelcome` :223-236; glue `maybeWelcome` app.js:2776-2802 | no | `#screen-app` (app.js:2791) | none | its buttons; `instant` on crew switch (app.js:3092) | rise 12px + fade after `ARRIVE_DELAY_MS` 360 (welcome.js:102, 189-204); fall 8px OUT_MS (:229-235) |
| Bring offer | crew-entry.js `showBringOffer` :241-285, `settleBringOffer` :291-320, `dismissBringOffer` :324-337; glue app.js:2721-2745 | no | `#screen-app` (app.js:2738) | none | its buttons; instant on crew switch (app.js:3091) | rise 14px (crew-entry.js:264-273); fall 8px (:330-336) |
| Show menu (v93 popover) | app.js `openShowMenu` :1482-1505, `closeShowMenu` :1459-1480 | no | inside the fest-name wrap in the dock / rail | **none** (app.js:1426-1433) | outside tap (capture listener; a tap on a card only closes, it never picks: app.js:3686-3691), Escape first in the chain (:3751), the fest name again (:3676), a row "Settings" (:1575), any popstate (:3695), pagehide (:3696), `show()` of a non-app screen (:1763), boot (:3400), the join shelf opening (:571), its rooms changing (`dropShowMenu` :1585-1589) | rise 4px CASCADE_MS EASE_ARRIVE (:1497-1500); fall 4px OUT_MS EASE_LEAVE (:1472-1479), reopen-mid-fade safe (`menuExit`, :1437-1457) |

The `#sheet-backdrop` / `#artist-sheet` id pair is read by: `teardownSheet`/`closeSheet`
(notes.js:802-806, 946-960), `rememberOpener` (notes.js:796-798), index.html `quiet()`
(index.html:333, backdrop only), the join shelf (join-shelf.js:38-39, 49-52, 60-65), the
share/add openers (app.js:2059-2063, 2133-2137), and — new since the old map — the two
**companion waiters**: `offerWhenSheetCloses` and `welcomeWhenSheetCloses` observe
`body`'s children and hold the card until `#artist-sheet` is gone (app.js:2734, 2753-2764,
2779, 2803-2813). **The plan shelf must not take these ids**: it is not modal, and
wearing `#artist-sheet` would hold the welcome card and the offer for as long as the
plan is open, and `#sheet-backdrop` would make `quiet()` hold every reload.

### 4b. The router and history entries

router.js:41-107 keeps a layer stack in `history.state.layers`. Rules (router.js:4-8):
open paths `push(key)` after opening; close affordances call `requestClose()` →
`history.back()`; the real close happens in the popstate reconcile. A `sheet:` on top is
REPLACED, not stacked (router.js:73-83). Kinds are `settings`, `sub:*` and `sheet:*`
(app.js:3601-3612). The popstate listeners run in this order: router reconcile
(app.js:3613), the join shelf's (:3616-3621), the Show menu's close (:3695). Escape's
chain (app.js:3749-3754): open Show menu → join shelf (`leaveShelf`) →
`router.requestClose()` → a bare `closeSheet()` fallback.

Latent seam worth knowing: the join shelf's entry carries `{ joinShelf: true }` with no
`layers`, so a **Forward** into it runs `router.onPopState` with target `[]`, which closes
any router layer that was open (settings, a sheet). Nothing reaches that today (the
shelf is only pushed from the wall), but a third history owner would multiply seams
like this one. PLAN.md §2.3.2c proposes moving the join shelf onto the router as
`sheet:join` (and REVIEW-1 finding 3 lists the cases that must be tested first).

### 4c. v93's lesson, in the code's own words

app.js:1426-1433: the Show menu "is a popover, not a place: it has no history entry. A
Back with it open does what Back always did, and the menu goes with the page (popstate,
pagehide, any screen but the wall, a boot). A menu that Back itself closes — an entry
of its own — was built and cut in v93 (four review rounds on its history)". The join
shelf, which does own an entry, needed a busy-Back repair (app.js:629-633), a
drop-vs-pop split after a join (:643-648) and a second popstate listener.

### 4d. Recommendation for the plan shelf (the peek that drags open, no backdrop)

1. **No history entry.** Follow the Show menu, not the join shelf. The open plan is a
   companion, not a place: the wall stays live under it and nothing in it is unsaved.
   Back does what it always did; the plan closes **instantly** with the page on
   popstate, pagehide, `show()` of a non-app screen, boot, crew switch (the three
   places the menu and the companions already hook: app.js:3695-3696, 1763, 3400,
   3091-3092). The one cost: Android's system Back with the plan open leaves the page
   rather than closing the plan. If Kevin wants Back to close it, that is a product
   call with a known price (v93's four rounds); ask, do not default into it.
2. **Its own close paths**: drag down (pointer-driven transform, §6), a tap on the
   grabber, a Close button, Escape. No outside-tap close: on the phone the peek is
   permanent and the wall above the open plan stays usable; on a laptop the panel sits
   beside a usable wall. Escape order becomes: Show menu → join shelf → a modal sheet
   if one is open (`#sheet-backdrop` present, or `router.top()` starts `sheet:`) →
   the open plan → `router.requestClose()`. The plan must not come before an open
   modal sheet, which paints above it.
3. **Own ids and classes** (e.g. `#plan-shelf`, `.plan-shelf`), never the sheet pair
   (§4a).
4. **Mount inside `#screen-app`**, like the companions (welcome.js:17-20,
   crew-entry.js:196-201), so Settings and the landing hide it with the wall with no
   extra code. Two concrete options:
   a. **inside `#dock`** as a first row (wrap today's row in a `.dock-row`): `#dock`'s
      box then includes the peek, so `dockTop()`, `seenBand`, the search-focus hide
      (`.dock.hidden`) and all three browser suites' "floor = `#dock` top" become right
      with no edit, the Show menu paints over the peek inside one stacking context and
      `.menu-up` lifts both. Cost: the dock's flex row is restructured (the List build
      on `live/list` is editing the dock's left side — merge risk) and the dock becomes
      tall when the plan opens (a floor at the plan's top is correct for a zoom, harmless
      for `seenBand`).
   b. **a sibling of `#dock`** at `bottom: var(--dock-h)`: no merge with the dock row,
      but every floor reader switches to a shared `footTop()` and the stacking against
      the Show menu needs the `.menu-up` policy extended (§2c.1).
   (a) fits "the peek sits on the dock" literally and is the smaller change to the
   readers; (b) is the smaller change to the dock. Decide with the List build's owner.
5. **Handle, like the join shelf's**: `{ el, open(), close({ instant }), isOpen(),
   setPeek(row) }`, `ctx` required (Low Power), `instant` for boot and crew switch.
6. **Companions and the peek**: the welcome card and the offer sit at 64px, in the
   peek's band. Either they read `--foot-h` (stand on top of the peek) or the peek waits
   for them (`welcomeCard() || bringOfferCard()`), the way the offer waits for the
   welcome (app.js:2729-2733). Round three did not draw the phone stack of welcome +
   peek (map-plan-now-dock §7d) — a design question.

## 5. The new-build reload glue (index.html:311-359)

- A controller change after the first means the page runs an old build: `pending = true`,
  `settle()`, and if still pending, `fn:new-build` (index.html:344-351) → app.js puts up
  `#new-build-strip` (app.js:3580, 1740-1755).
- `settle()` reloads only when `quiet()` (index.html:341-343); re-checked on
  `visibilitychange` and every 15s (:352-353).
- **`quiet()` is false when** (index.html:331-340): `body[data-busy]` is set; OR
  `#sheet-backdrop` exists; OR a `#zoom-layer .zoom-slot` exists; OR any on-screen,
  non-readonly `input`/`textarea` is focused or holds text.
- **How a flow marks itself busy**: one string slot, `document.body.dataset.busy`.
  Owners: `create` (app.js:1899/1984), `me-link` (:2514-2515), `join` (:2901/2945),
  `spotify-scan` (settings.js:1433/1482), `show-menu` (app.js:1504/1466 — the only one that
  takes the slot **only when free** and gives it back **only when it is its own**, plus
  a leftover sweep at the minute tick, app.js:825-828). Settings names the busy value in
  its update row (`BUSY_WORDS`, settings.js:887-895; an unlisted value still holds, just
  unnamed).
- **Should the plan mark busy?**
  a. **A drag in progress: yes**, the Show menu's way (take only if free, give back on
     pointerup / pointercancel / lostpointercapture, and sweep a leftover at the tick).
     A reload mid-gesture is the "nothing moves under the hand" failure.
  b. **An open plan: no.** It holds nothing a reload destroys (the open state and a
     scroll position), and a desktop panel may stay open for hours — a busy flag there
     would hold every new build indefinitely, the exact failure the menu's leftover
     sweep exists to prevent. (If Kevin wants the open plan kept across a reload, write
     "open" to sessionStorage in a try, like the fold, instead of blocking the reload.)
  c. The peek's search field? It has none; `quiet()`'s field rule does not apply.

## 6. Motion

### 6a. The constants (one JS home)

js/v3/motion.js:5-13: `GROW_MS 240`, `CONTENT_FADE_MS 90`, `OUT_MS 130`, `CASCADE_MS 170`,
`STAGGER_MS 30`, `REFRESH_MS 300`, `EASE_ARRIVE cubic-bezier(.2,1.15,.35,1)` (4%
overshoot), `EASE_LEAVE cubic-bezier(.4,0,1,1)`, `EASE_SURFACE cubic-bezier(.4,0,.2,1)`.
`reduced()` (:15-16) reads `prefers-reduced-motion`; `canAnimate(node, ctx)` (:22-23) =
has `animate()` AND not reduced AND not `ctx.lowPower`. notes.js keeps its own copy of
both (notes.js:64, 68). `ARRIVE_DELAY_MS = 360` is NOT in motion.js: defined twice,
welcome.js:102 and crew-entry.js:203. No CSS motion tokens exist; CSS re-types
`.24s cubic-bezier(.2,1.15,.35,1)` for the companions' toast step (v3.css:188).

**FLIP helpers**: there is no shared one. Each site hand-rolls it: `slideTabs`
(app.js:887-903, the day tabs around NOW: measure lefts, move, animate
`translateX(dx)→none` CASCADE_MS, EASE_ARRIVE in / EASE_SURFACE out, holding the row's
edge fades through the slide via wall.js `holdDayRowEdges`); who-motion.js (the zoom's
who-row names, :15, 84); card-facts.js's refresh (`REFRESH_MS`). A peek that becomes the
open plan "in the same rows" would be a fourth; if it is written, write it once where
the plan shelf and slideTabs could share it.

### 6b. Reduce Motion and Low Power

1. **CSS kill rules** (v3-tokens.css:150-153 for `prefers-reduced-motion`, :224-225 for
   `.low-power *`): `animation: none !important; transition: none !important` on every
   element and pseudo. They stop CSS animations and transitions only. **They do not
   touch WAAPI** (`element.animate`) **and do not touch an inline `style.transform`** set
   from a pointer handler. The strip follower is the one CSS animation that out-ranks
   them (v3.css:866-879).
2. **Low Power is also switched on by the OS setting**: `applyLowPower(saved.lowPower ||
   matchMedia('(prefers-reduced-motion: reduce)').matches)` at init (app.js:3711-3713),
   which sets `ctx.lowPower` and `body.low-power` (app.js:2306-2309). Read once at boot,
   not live. So `canAnimate(node, ctx)` covers both, provided `ctx` is passed —
   join-shelf, welcome and crew-entry default `ctx = null`, which would drop Low Power
   (not Reduce Motion) for a caller that forgets it.
3. For the plan's drag: follow the finger with an inline `transform` in `pointermove`
   (never a CSS transition — it would work, but only by accident of the kill rules),
   then settle with WAAPI behind `canAnimate` (open: GROW_MS EASE_ARRIVE; drop back /
   close: OUT_MS EASE_LEAVE). Under Reduce Motion / Low Power the finger-follow stays
   (direct manipulation, the strip-follower precedent, CLAUDE.md) and the settle is
   instant. Clear the inline transform in the settle's `onfinish` and `oncancel`, and
   on `pointercancel` (the join shelf's pattern, join-shelf.js:234-242, which snaps back
   instantly today — the plan should animate the drop-back).

### 6c. How the companions arrive and leave (the plan shelf's neighbours)

| Surface | In | Out | Where |
|---|---|---|---|
| Welcome card | card rises 12px + fades in, GROW_MS EASE_ARRIVE, delay 360; faces cascade (`translateX(-4px) scale(.7)`, CASCADE_MS, 2×STAGGER apart); then the buttons 6px | card falls 8px + fades, OUT_MS EASE_LEAVE; id removed first so a new card can mount while it leaves; `pointer-events:none` while leaving | welcome.js:186-204, 223-236 |
| Bring offer | rises 14px, same timing; buttons follow a stagger; "done" swaps text and shrinks height GROW_MS EASE_SURFACE (a layout animation on one small card), leaves after 1500ms | falls 8px, as the welcome | crew-entry.js:261-273, 287-337 |
| Toast step-up | the outer box translates by the toast's height + 8 (CSS transition, killed under the rules → jumps) | same | v3.css:188; welcome.js:135-147 |
| Join shelf | rises from `translateY(100%)`, backdrop fades, 6px cascade | drops to 100%, OUT_MS; a 3×OUT_MS+50 safety timer removes it if the animation never ends (backgrounded tab) | join-shelf.js:196-217, 261-272 |
| Show menu | 4px rise CASCADE_MS | 4px fall OUT_MS, reopen-mid-fade safe | app.js:1472-1500 |
| Notes/share/add sheets | CSS `sheetIn` (fade + scale .98) | none | v3.css:489-491 |
| Toast | none | none | wall.js:2576-2608 |

The safety timer in the join shelf (join-shelf.js:216) and the menu's `menuExit`
(app.js:1437-1457) are the two lessons a leaving plan needs: an exit whose `onfinish`
never fires must still remove/hide, and a reopen during the exit must not be hidden by
the old exit's end.

## 7. Desktop (≥720px)

1. **The rail**: `#day-rail` sticky `top:0`, z25, full viewport width, padding 9px,
   `margin-top: 4px`, blur backdrop, bottom hairline (v3.css:422-456). Its height is not
   typed anywhere; from CSS it is about 9 + 26 (the `.you` avatar, v3.css:444) + 9 + 1 =
   **~45px**, measured into `--rail-h` (§3). It lives in `.shell` after the toolbar, so
   at the top of the page it sits below the header and toolbar (index.html:197-237) and
   only pins at 0 once scrolled past. A panel "from the rail's bottom to the window's bottom" must track the rail's
   real box (as `chromeCeiling` does, card-facts.js:849-861), not `--rail-h` — or it
   overlaps the header at the top of the page.
2. **Bottom-right today**: only the Spotify scan pill (`right:12px; bottom:16px`, z35,
   non-interactive, only while a library scan runs; v3.css:167-173). The welcome card
   and bring offer are bottom-CENTRE, 64px up, max 440px (v3.css:184-195, no ≥720 rule);
   toasts are bottom-centre, 64px up (v3.css:888-896, no ≥720 rule). Nothing sits in the
   bottom-right corner card's place except the pill, which must move (PLAN U8.5).
3. **The zoom's `place()` on a laptop** (card-facts.js:879-900): horizontal clamp only
   to `[8, innerWidth - 8 - w]` (:892); floor null (the dock has no client rects,
   :835); ceiling = the rail's bottom and the card's own stage strip (:849-861). With a
   400px panel open, a zoom will grow under it; `place()` needs a right bound
   (`rightChromeLeft()`), and `follow()`'s off-screen test (:1510) should treat a card
   under the panel as hidden.
4. **The NOW landing's sideways frame**: `frameSlide` centres a stop in `sc.width`
   (wall.js:1924-1927), which is the scroller's full `clientWidth` (app.js:1036-1039).
   With the panel open the grid (full-bleed, `.times-wrap` 100vw, v3.css:789-799) runs
   under it, so a stop can be centred under the panel. `pageGeo().scroller` should
   report the width to the panel's left edge; `seenBand` has no right edge at all
   (app.js:976).
5. **Sheets become centred dialogs at 720+** (v3.css:511-520): `inset:auto; left/top
   50%; translate: -50% -50%; width: min(560px, 92vw); max-height: 80vh; radius 20px`,
   grabber hidden. `translate` is a separate property from `transform`, so the join
   shelf's `translateY(100%)` rise composes with the centring: on a laptop the dialog
   rises from one own-height below centre (join-shelf.js:267; not re-walked here).
   The plan panel is not a dialog: give it its own ≥720 rule, not `.sheet`'s.
6. **Shell under the panel**: at 1280 the shell is `min(1080px)` centred (tokens
   v3-tokens.css:132-134, index.html:80), i.e. x≈100-1180, so a 400px panel (x 880-1280)
   covers its right ~300px (the wall-grid and venue stacks); at 1440, x≈180-1260 →
   ~220px covered. "The wall still usable" either accepts that (the grid scrolls; stacks
   do not) or pads the shell by `--panel-w` while open (a one-time reflow of the whole
   wall, which the motion law discourages). A design call for U8.

## 8. The short version (for whoever builds the peek)

1. The dock is ~45px + inset and its height is typed nowhere; the "above the dock"
   literals are 84 (shell, index.html:81), 64 (companions v3.css:186, toast :890) and
   70 (spot pill :168). Runtime floors are `seenBand` (app.js:966-977) and `dockTop`
   (card-facts.js:833-838), both reading `#dock`'s box; three browser suites re-derive
   the same floor inline (§1c).
2. The Show-menu-under-the-welcome-card bug is fixed on this head by `.menu-up` z39
   (v3.css:344-348, app.js:1485-1492) and pinned by show-menu-stacking.test.mjs in both
   engines. PLAN.md §2.5.4 and U4.5 ("move the popover into a top-level layer") are
   stale — cut that work.
3. `--rail-h` is written only on repaint, search input and debounced resize
   (app.js:1333-1345, 1655, 3627, 3639). `--foot-h` needs more triggers (peek change, dock
   hide on search focus, late font, companions) — a ResizeObserver on the foot plus one
   exported `footTop()` box reader.
4. The plan shelf must not wear `#sheet-backdrop` / `#artist-sheet`: `quiet()` would hold
   reloads, and the welcome/offer waiters (app.js:2734, 2753-2813) would hold the
   companions for as long as the plan is open.
5. No history entry for the plan (the v93 Show-menu precedent, app.js:1426-1433); close
   with the page on popstate/pagehide/show()/boot/crew switch; Escape after any open
   modal sheet; no outside-tap close.
6. Busy: a drag yes (take-if-free / give-back-if-mine, like `show-menu`), an open plan no.
7. Motion: follow the finger with inline transform (the kill rules do not touch it or
   WAAPI), settle with WAAPI behind `canAnimate(node, ctx)`; `ctx` must be passed (Low
   Power is also on under the OS Reduce Motion, app.js:3713).
8. Desktop: only the spot pill lives bottom-right today; companions and toasts are
   bottom-centre with no ≥720 rule; `place()` clamps only to `innerWidth - 8`;
   `frameSlide` centres in the full scroller width; the panel's top must track the
   rail's real box, not `--rail-h`.
9. The one-NOW hook is `paintNowTabs` (app.js:856-862), which loops both doors with one
   `day`; the rule "hide NOW while the peek shows a NOW row" must be decided per door
   (dock vs rail), since the phone peek and the laptop card are different surfaces
   (REVIEW-1 finding 6).
