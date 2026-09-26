# Input map — who decides what a finger, a mouse or a key does

*2026-09-26 (CT night of 09-25). A read-only map of the plan-base worktree (v92 branch head, `abe7205`). Complete: §1 rules, §2 other surfaces, §3 tests, §4 architecture, §5 questions.*

## In one screen

1. **The hand is already tracked in one place, but asked in five.** card-facts.js holds the only tracker: last input, last pointer type, the WebKit ghost filter and the still-hand record. But wall.js decides the hold by itself, app.js decides the finger close-tap and the guest's tap by itself, and gallery.html and the zoom test rig re-type app.js's routing by hand. The gallery's copy has already drifted (§2).
2. **Under the decided model:**
   a. **Goes:** the long-press, with its 500ms timer and click swallow (wall.js:144-180), the `onPeek` plumbing, the finger overlay's arming (card-facts.js:1185-1211), the `'touch'` zoom source, and the door-settle rule for fingers.
   b. **Changes:** routing a tap (a finger opens the zoom for everyone), the overlay body (a finger zoom's body does nothing), the finger close-tap (it only closes, for everyone), the Tab walk (− · note · +), and the zoom row's sizing (by the hand, not `pointer: coarse`).
   c. **Stays:** everything about the mouse and the keyboard, and the ghost and still-hand laws.
3. **Two hazards the design has not answered yet:**
   a. A mouse zoom's body must keep picking. Hover opens the zoom 200ms after the mouse arrives, so nearly every desktop click lands on the zoom (§5 Q1).
   b. The − · note · + row must not move under a finger between presses. Today every pick re-centres the zoom (§5 Q2).
4. **Tests:** 1 unit file is deleted (long-press); about 12 unit cases and 7 browser files change premise (§3). 5 new browser contracts are needed, the key one being a real-WebKit tap → + → + walk.
5. **The clean shape (§4):**
   a. `js/v3/hand.js` answers `hand()` = finger / mouse / keyboard, once.
   b. card-facts.js gives every press its meaning in one function (`pressCard`), wires every card with one call, and owns the document zoom rules.
   c. app.js supplies only intents (`onPick`, `onStep`) over one write path (`setLevel`).
   d. The gallery and the rig import the same wiring, so the browser net tests what ships.
   e. The rule each surface follows: *an event that carries its own pointer answers for itself; a click or a focus asks `hand()`.*

Source tree: `.claude/worktrees/plan-base` (paths below are relative to it). Design sources: `portola-live/claude-plans/2026-09-25-portola-live/design/guest-shelf/BRIEF.md` §2 and §5.4 (the L change, already scoped there), `…/guest-shelf/buttons/BRIEF.md`, `…/ours-r2/BRIEF.md` §4, `…/guest-shelf/proto.diff` (the prototype of `step`).

Fate key: **KEEP** (survives as is) · **CHANGE** (survives, rule changes) · **GONE** (deleted) · **NEW** (a rule the decided model needs that no code has yet).

## 1. The rules, file by file (banked 22:20)

### js/v3/card-facts.js (the zoom; the only module that knows the hand today)

| # | Rule | Where | Applies to | Why it exists | Fate |
|---|---|---|---|---|---|
| C1 | `lastInput` = 'pointer' / 'keyboard', set by document capture `pointerdown` / `keydown` (lone modifiers ignored) | 586, 593, 640-649 | all | Chrome 152 flips a focused card to `:focus-visible` after ANY key; click · Escape · click grew a keyboard zoom that hover-out could not close (2026-09-02). CLAUDE.md law. | **KEEP**, moves into the one modality module (§4) |
| C2 | `lastPointerType` + `tapOpensZoom()` = last press was a finger or pen (and not a key since) | 587-592, 642 | today: guests only (app.js:414) | v92 guest round: "people will try to zoom rather than pick"; an iPad with a mouse must behave like a desktop, so decided by the hand, not the width | **CHANGE**: becomes THE question for everyone. Rename to `isFinger()` / `hand() === 'finger'` |
| C3 | Touch ghost filter `touchAt`: mouse-type pointer events within 3px of the last 6 finger landing/lift points arm nothing, until a mouse really moves or presses | 594-615, 617-622, 643-646; used 1408-1417, 1432 | mouse hover on devices that ever see a finger | WebKit follows a touch tap with MOUSE-type click + pointerenter at the lift point; the tapped card grew as a mouse zoom a phone can never hover out of (2026-09-23, WebKit bug 214609). CLAUDE.md law. | **KEEP**, more important than before: a finger tap now leaves a zoom standing exactly where the ghost lands |
| C4 | Still hand: `lastMouse`, `handEl`/`handCard`, `stillHand()`, `slidAt` — a card that slid under a resting mouse (NOW glide, day tab, wheel) waits for the hand to move | 553-573, 623-631, 1404-1417, 1428-1435 | mouse | v87 review 2026-09-24: Skepta (cancelled) grew under a resting pointer and the next click on NOW picked it | **KEEP** (mouse only) |
| C5 | Stay-away mark `dismissedKey`: Escape on a MOUSE zoom stops that card re-growing until the mouse is elsewhere; never for keyboard/touch | 550, 632-638, 704-714, 1392 | mouse | 2026-09-02 random walk: a mark on a keyboard zoom waited for a leave that never comes | **KEEP** ('tap' is not 'mouse', so already exempt) |
| C6 | Hover intent: `pointerenter` (mouse only) arms a 200ms timer; `pointerleave` cancels; rAF re-arm for a card born under a still mouse (elementFromPoint, never `:hover`) | 1386-1442, `ZOOM_IN_MS` 544 | mouse | "a real intent delay, or cards pop like crazy" (Kevin 2026-08-29); Safari's stale `:hover` chains; "then it's stuck" (2026-08-31) | **KEEP** |
| C7 | Keyboard route: `focusin` zooms only when `lastInput === 'keyboard'`; `focusout` closes unless focus went into the zoom or a press on the overlay just happened | 1444-1468 | keyboard | see C1 | **KEEP** |
| C8 | The hold's arming: a `source: 'touch'` overlay has `pointer-events: none` until the lift's synthetic click has passed (or 350ms / pointercancel) | 1185-1211 | finger, long-press only | real-phone walk 2026-08-30: the click after the lift landed on the freshly armed overlay and recorded a pick nobody made (Codex review) | **GONE** with the long-press. The 'tap' route opens from the card's click, after the lift, so it is live at once (guest-shelf BRIEF §5.4a) |
| C9 | `isOwnControl`: a button or link inside the zoom is its own control, never a pick | 1213-1217 | all | two handlers drew the line in "two slightly different inks" | **KEEP**; − and + are buttons, so they fall under it with no edit |
| C10 | The overlay never steals focus: `mousedown` preventDefault on the overlay except on its own controls | 1219-1235 | mouse (and iOS's lift-time mousedown) | "hover and click, it closes" (Kevin 2026-08-31): the overlay blurred the focused card, whose focusout closed the zoom before the click | **KEEP** |
| C11 | `overlayPressAt` / `pressedOverlayJustNow` (600ms): focus that goes NOWHERE right after a press on the zoom is that press, not a departure | 1043-1055, 1227, 1232, 1374, 1465 | Safari (does not focus a pressed button) | Kevin on v88 2026-09-25: "clicking notes was harder" — two "focus left the card" closes before the sheet opened | **KEEP**; − and + need the same protection, and get it (the pointerdown is on the whole overlay card). Needs its own browser test (the notes-chip one is `tests/browser/zoom-notes-chip.test.mjs`) |
| C12 | Door settle (`DOOR_SETTLE_MS` 700): for a beat after a pick's refresh, a press on a link/map/order/cancel door PICKS instead | 1056-1065, 1237-1252 | today: everyone | links-row review 2026-09-25: the refresh re-centred the zoom and slid AXS under a finger still tapping toward MUST | **CHANGE**: a finger zoom's body no longer picks, so for `tap` it goes (proto.diff already skips it); for mouse/keyboard zooms, whose body still picks, it stays |
| C13 | The overlay body picks (`ctx.onTap`) except on own controls; a GUEST's finger zoom body does nothing | 1254-1265 | today: members everywhere, guests on mouse | "one grammar on both surfaces" (Kevin 2026-08-30); v92 guest: "a look never turns into a question by accident" | **CHANGE**: a finger zoom's body does nothing for EVERYONE. A mouse zoom's body keeps picking — see §3 Q1, this is load-bearing |
| C14 | Hover-out grace (260ms), overlay `pointerenter`/`pointerleave`, and the document `pointermove` belt | 1267-1300 | mouse zooms only | "after click, it doesn't un-hover" (2026-08-31): a zoom restored under a hand that had already left | **KEEP** |
| C15 | Follow on scroll: the zoom rides its card; closes only when the card is off screen or fully under the sticky chrome | 1302-1341 | all | trackpad micro-scrolls closed it and poisoned it with the stay-away mark (2026-08-31); orphaned zooms under chrome (2026-09-24) | **KEEP** |
| C16 | Tab inside the zoom: card → notes chip → next focusable after the card; Shift+Tab back. Hard-codes `button.f-chip.notes` | 1343-1370 | keyboard | the door to a FIRST note needs no pointer (2026-08-29) | **CHANGE**: the row becomes − · note · +; Tab must walk the row's buttons in order (see §4.3) |
| C17 | Overlay `focusout` closes the zoom unless focus went inside it or a press just happened | 1371-1376 | all | same as C7/C11 | **KEEP** |
| C18 | `buildParts`: a guest's zoom gets "Pick shows" (`ctx.onGuestPick`) | 807-811, `factChips` 289-322 | guests, every source | v92 guest shelf | **CHANGE**: the decided model gives a guest the same − · note · + row, any press on − or + opens the join shelf; `step` rides every source (proto.diff gated it to fingers; the decided model says the mouse zoom shows it too) |
| C19 | Refresh re-centres the zoom on a pick (`sizeSlot` + `place`, centre-anchored) | 963-1041, 771-792, 815-824 | all | the rebuild is itself a small event (Kevin 2026-08-30) | **CHANGE / NEW**: the row under the finger must not move between two presses — see §3 Q2 |
| C20 | Airbag: every zoom entry point catches a throw, journals it, sweeps the stage | 1141-1173 | all | Kevin's Safari recording 2026-08-31: stranded content-invisible card | **KEEP** |
| C21 | `unzoom({meant})`: a close that IS the press's purpose is not journalled as `zoom-close-after-click` | 1066-1076 | all | false alarms in the guest-shelf rig (2026-09-25) | **KEEP**; − and + do not close the zoom, but the BRIEF (§5.4g) saw the alarm fire on every close within 1s of a − / + press — the outside-tap close after a step must pass `meant` for fingers (app.js:161-162 already does for `finger`) |

### js/v3/wall.js (the resting card)

| # | Rule | Where | Applies to | Why | Fate |
|---|---|---|---|---|---|
| W1 | Enter / Space on the card's OWN focus picks (not bubbled from a nested button) | 83-89 | keyboard | Codex gate 2026-08-29: Enter on the notes button picked AND opened | **KEEP** (keyboard = mouse: activation picks) |
| W2 | Long-press: non-mouse pointerdown arms 500ms (10px slop, re-checks `isConnected` + `offsetParent`), fires `ctx.onPeek`; a capture-phase click swallow after a long-press | 144-180 | finger, pen | 2026-08-29 round (the OS constants); hardened with pointercancel + isConnected (DEVLOG CORE-15); a held MOUSE button opened a touch zoom that swallowed its next click (2026-09-02, DEVLOG); digitizer jitter (Codex P3) | **GONE** (guest-shelf BRIEF §2.7). Keep `-webkit-touch-callout: none` on `.card` (v3.css:30). A hold then release must act like a tap — confirm on a real iPhone, and on Android where a hold fires `contextmenu` |
| W3 | Card click → `ctx.onTap(artist, el, occ)` unless the target is a nested button | 182-191 | all | the Ant Design lesson; the 2026-08-29 version that excluded the grown block stopped zoomed cards picking | **CHANGE** (in app.js, not here): the click stays one call; what it MEANS is decided by the hand (§4) |
| W4 | Corner notes chip (`.chip-notes`, a real button) opens the notes sheet straight from the resting card | 253-262 | all | audit 4.4 | **KEEP**, with a note: on a phone it is 13px with no borrowed space (`.card button::after { content: none }`, v3.css:623), so most taps near it open the zoom, which has the same door. Fine, but see §3 Q5 |
| W5 | `refreshCard` lands the fresh node first, hands the zoom over (`onSwap`), then removes the old node, carrying focus | 473-513 | all | Kevin's journal 2026-09-01: every pick on a focused card blinked the zoom ("focus left the card" ×2) | **KEEP**; − and + ride the same path |

### js/v3/app.js (routing and the document-level rules)

| # | Rule | Where | Applies to | Why | Fate |
|---|---|---|---|---|---|
| A1 | `handleTap`: guest + finger + card on screen + not already zoomed → open a `source: 'tap'` zoom (and the welcome goes); any other guest press → `askToJoin`; member → `nextTapLevel` cycle 0→1→2→3→4→0 | 406-436 | all | v92 guest shelf; the cycle is the original grammar | **CHANGE**: split in two — `activate(card)` (input routing: finger → open the zoom for everyone; mouse/keyboard → pick or join) and `setLevel(artist, level)` (data). See §4.2 |
| A2 | `applyWaitingPick` calls `handleTap(w.artist)` with no element to make the pick a guest's tap promised | 548-557 | after a join | review 2026-09-25 | **CHANGE**: must call the data path (`setLevel(artist, 1)`) directly. If it keeps calling the routing path and the last press was a finger, the promised pick would try to open a zoom instead (today it only works because `el` is null and the member branch never asks the hand) |
| A3 | `ctx.onGuestPick` → `askToJoin(artist)` | 133-137, 480-491 | guests | v92 | **KEEP** as the target of a guest's − / + |
| A4 | `ctx.wireZoom` = hover + focus wiring per card | 138-144 | mouse, keyboard | — | **KEEP** |
| A5 | `ctx.onPeek` = long-press → `source: 'touch'` zoom | 145-148 | finger | the hold | **GONE** with W2; the `'touch'` source value disappears everywhere (card-facts 1189, 1262; tests) |
| A6 | Document capture `pointerdown` outside the zoom closes it (`meant` for a finger); a GUEST finger's close-tap that lands on a card eats the next click (700ms) | 151-174 | all / guest fingers | guest-shelf BRIEF §2.6d: on a dense wall "outside" is almost always another card; the first close-tap opened Airwolf Paradise's zoom | **CHANGE**: drop `!ctx.meName` — every finger's close-tap on a card only closes. Mouse unchanged: a click on another card closes this zoom and picks that card |
| A7 | Escape closes a live zoom first (capture), never a sheet in the same press | 175-179, 3462-3470 | keyboard | FLOW-2 | **KEEP** |
| A8 | A pick while zoomed keeps the zoom (`refreshArtistCards` → `refreshZoom` on the zoomed occurrence) | 381-404 | all | "cycling to MUST while watching the pills" | **KEEP**; it is exactly what − / + need |
| A9 | `repaintWall` restores a standing zoom on the fresh card, same source, instantly | 1366-1382 | all | a crew-mate's pick on the 25s poll must not eat the card you rest on | **KEEP**; a restored `tap` zoom has no arming to redo (C8 is gone) |
| A10 | Search input closes the zoom instantly | 3352-3356 | all | — | **KEEP** |

### assets/v3.css (where CSS decides by device, not by hand)

| # | Rule | Where | Fate |
|---|---|---|---|
| S1 | `html { touch-action: manipulation }` — no double-tap zoom (Kevin at Portola 2026-09-25: a quick tap-tap cycled a pick and Safari zoomed) | 8-15 | **KEEP**, now protects + + + + to must |
| S2 | `.card` and `.zoom-card` carry `-webkit-touch-callout: none; -webkit-user-select: none` (the WebKit prefix law) | 30, 1124 | **KEEP** (the hold still must not raise the callout) |
| S3 | `@media (pointer: coarse)`: 44px floor on `button`, opt-outs, `.card button::after { content: none }`, and the zoom's `.f-chip` grown to 30px with a 7px reach | 556-622 | **CHANGE for the zoom row only**: the row's size must follow the zoom's SOURCE, not the device class. `pointer: coarse` is true on an iPad whose person uses a mouse (primary pointer = touch), and false on a touch laptop someone taps. Put `data-hand="finger|mouse|keyboard"` on `.zoom-slot` at grow time and key the row's reach on it. The 44px `button` floor itself stays a media query (it is about the device, and it is the law) |
| S4 | Guest row: `.f-guest-row`, `.f-pick` | 1373-1377 | **CHANGE** to the one row (the design slice owns the look) |

## 2. The other surfaces (banked 22:35)

### gallery.html — a second, drifted copy of app.js's routing (the biggest structural finding)

The browser contracts (`tests/browser/*`) drive `gallery.html`, not `index.html`. The gallery builds its own `ctx` twice and re-types app.js's routing by hand:

1. `handleTap` (gallery.html:592) and `eventsTap` (gallery.html:954) are the member cycle only — no guest branch, no `tapOpensZoom()`, no migration gate.
2. `onPeek` with `source: 'touch'` (gallery.html:570, 935) — the long-press.
3. The document `pointerdown` outside-close (gallery.html:617-619) has no `meant: finger` and no guest click-eat; app.js:159-174 has both. **It has already drifted.**
4. Escape (gallery.html:620-622) matches app.js:177-179 today.
5. The hint text (gallery.html:76) teaches "hold (touch)", "click the grown card to cycle the pick".

So today the real-browser net tests a routing that is not the one that ships: v92's guest finger route (app.js:414) has no browser contract through the gallery at all. Under the decided model this matters more, because the tap route IS the phone. **The fix is architectural, not a test edit: the routing moves into one module both pages import** (§4). The gallery's own jobs (states, slow motion, the chip cases at gallery.html:770-800 that call `handleTap` directly and zoom with `source: 'keyboard'`) stay.

### js/v3/notes.js

| # | Rule | Where | Fate |
|---|---|---|---|
| N1 | A note row's press-and-hold (non-mouse) reveals its actions; mouse uses CSS hover; keyboard uses focus-within | 455-490 | **KEEP** — a different surface (a note, not a card), and its own law: timing only, never preventDefault (Kevin on v88) |
| N2 | Grabber drag > 70px closes a sheet | 734-750 | **KEEP** (the shelves slice may unify it with join-shelf's copy, below) |
| N3 | Empty all-notes copy picks its verb by media query: "hover any artist and tap its note chip" vs "hold any artist" | 1072-1078 | **CHANGE**: "hold" is gone. One sentence for every hand, e.g. "open any artist and use its note". Also drop the `(hover: hover) and (pointer: fine)` read — copy should not branch by device when the gesture no longer does |
| N4 | A guest's join door in a notes sheet → `ctx.onJoin` | 703 | **KEEP** |

### js/v3/join-shelf.js, js/v3/welcome.js

| # | Rule | Where | Fate |
|---|---|---|---|
| J1 | Shelf: Look around / tap on the dimmed wall / handle dragged down > 70px all `leave()`; never while an answer settles | join-shelf.js:201-225 | **KEEP**. Its drag is a second copy of notes.js N2 (same 70px, same shape) — a candidate for one `wireGrabber(sheet, onClose)` in the shelves slice |
| J2 | Tab trapped in the shelf | join-shelf.js:227-237 | **KEEP** |
| J3 | A guest's finger tap on the wall takes the welcome card down | app.js:415 | **CHANGE**: under "tap opens the zoom for everyone", the same line applies to a member's first tap (a member's welcome "Tap any artist to add yours" is otherwise still up over the zoom). The shelves slice owns whether companions leave on a wall tap |

### Copy that teaches the old gesture (downstream of the input change — must move in the same release)

1. `js/v3/welcome.js:57` "Tap any artist to add yours." · `:59` "Tap any artist to be first — you'll pick a name as you do." · `:63` "…Tap any artist to be first."
2. `js/v3/settings.js:446` How it works: "Tap an artist to add your color." / "Your bars fill each tap. 4 taps = must see." · `:456` "Hold for details."
3. `js/v3/notes.js:1078` (N3 above).
4. `js/v3/settings.js:1815-1816` "tap some cards first" (still true: tap, then +).
5. `gallery.html:76` hint.
6. The one-time line the guest-shelf BRIEF §2.8 proposes for the release that changes it: "A tap opens the card now — pick with + inside."

### index.html

1. The new-build reload waits while a zoom is standing (`#zoom-layer .zoom-slot`, index.html:325-329). **KEEP** — every finger tap now leaves a zoom up, so the reload waits more often; that is the intended cost.
2. iOS text-field auto-zoom fix (index.html:7-21). Unrelated.

### Present-tense docs that describe the gesture (docs-truth territory)

1. `README.md:28` "**Tap to pick.** Levels are picked ×1 → ×2 → ×3 → must → clear" — true for a mouse and a key only now.
2. `README.md:59` card-facts.js "(hover, hold, keyboard)" → "(hover, tap, keyboard)".
3. `CLAUDE.md`, the zoom-modality law: "The long-press ignores mouse pointers for the same reason (a held button is a slow click)" — goes with the long-press; the ghost half of that law stays and gets stronger (§1 C3).

## 3. Tests: every file and case that assumes "a tap picks" or "a hold opens" (banked 22:55)

How to read this: jsdom tests that dispatch a bare `card.click()` (or press `'mouse'` first) keep passing under the new routing, because the hand defaults to mouse and `zoom-rig.mjs` `mountCard` (tests/helpers/zoom-rig.mjs:83-89) resets it to mouse on every mount. That is correct, not luck: those tests are about the MOUSE route. The ones below are the ones whose premise changes.

### Unit tests (jsdom)

| File · case | Assumes | Becomes |
|---|---|---|
| `tests/long-press.test.mjs` — all 5 cases (27, 37, 47, 57, 69) | a finger/pen HOLD peeks; a mouse hold never does; a lift cancels; no peek wired → nothing | **Delete the file.** Replace with `tests/tap-zoom.test.mjs` (name it as you like): a finger tap opens a `tap` zoom for a MEMBER and a GUEST; a pen tap does the same; a mouse click picks; a key (Enter) picks; a hold then release = a tap; a tap on the zoom body writes nothing; with a zoom open, a finger tap on another card only closes (member and guest) |
| `tests/zoom-overlay.test.mjs:151` "a hold on touch: the lift and its own click cannot pick; the NEXT tap does" | the hold's arming (C8) and a finger zoom's body picking | **Delete**; its successor: "a tap zoom is live at once: the first press on + steps (no arming)" and "a tap zoom's body never picks" |
| `tests/zoom-overlay.test.mjs:106`, `:124` "a click on the grown card PICKS…", "taps while zoomed cycle 1 → 2 → 3 → 4 → 0" | the body picks and cycles | **KEEP for mouse** (default source) — rename "clicks" to make the hand explicit; add the finger twin: + steps 0→1→2→3→4 and stops (disabled at 4), − steps down to 0 and stops (disabled at 0) |
| `tests/zoom-overlay.test.mjs:327`, `:365`, `:404` (focus / Safari press grace) | pressing the body or notes chip | **KEEP**; add − and + to the Safari press-grace case (a press on + that sends focus nowhere keeps the zoom and steps) |
| `tests/zoom-touch-ghost.test.mjs:158` "a long-press still zooms the card the finger holds" | the hold | **CHANGE**: "a finger tap zooms the card it tapped, and the ghost that follows at the lift point neither converts it to a mouse zoom nor grows another" |
| `tests/zoom-touch-ghost.test.mjs:37-143` (the other 9) | mouse zooms after a finger | **KEEP** — the rule is unchanged and more exposed |
| `tests/zoom-hover-grace.test.mjs:242` "a touch restore never asks where the mouse is" | `source: 'touch'` | **CHANGE**: `source: 'tap'` (same assertion) |
| `tests/zoom-hover-grace.test.mjs:71`, `:147` | a finger crossing a MOUSE zoom never closes it; a touch pointerenter never arms hover | **KEEP** |
| `tests/zoom-modality.test.mjs:79` "a touch press counts as a pointer…" | tracker | **KEEP**; add: the tracker reports `finger` after touch/pen, `mouse` after a mouse press, `keyboard` after a key, and a lone modifier changes nothing (the existing `:66` case, generalised) |
| `tests/zoom-keyboard.test.mjs:26-204` (Tab handoff: card → notes chip → on) | the row has ONE button | **CHANGE**: card → − → notes → + → on; Shift+Tab walks back; a disabled − (at 0) or + (at must) is skipped |
| `tests/zoom-chips-motion.test.mjs` (all 10, e.g. `:224` "rapid taps never strand anything") | picks by clicking the overlay's `.f-name` on a mouse zoom, cycling 2,3,4,0,1 | **KEEP** as the mouse route. Add one finger case per motion: carry (+ at 2), clear (− at 1), first (+ at 0), and the rapid case as alternating +/− presses |
| `tests/zoom-app-glue.test.mjs:99-189` (outside press, capture phase, Escape, repaint) | app.js's document rules; mouse | **KEEP**, and point it at the shared module once the rules move (§4); add: a MEMBER finger's close-tap on another card only closes (today only guests) |
| `tests/first-open-guest.test.mjs:183` "a guest's finger tap … + note and Pick shows inside" | the guest row = `['+ note', 'Pick shows']` | **CHANGE**: the guest's row is − · note · +; a press on − or + opens the shelf (naming the artist); the body does nothing |
| `tests/first-open-guest.test.mjs:199` "a guest finger's tap on another card only closes it" | guest-only close rule | **KEEP**, and add its member twin |
| `tests/first-open-guest.test.mjs:211`, `:314` "Pick shows in the zoom asks…", "joining from a tap…" | `.f-pick` button | **CHANGE**: press + (the guest's way in); the waiting pick is still level 1. Keep the "not journaled as zoom-close-after-click" assertion |
| `tests/first-open-guest.test.mjs:164` "Pick shows on the welcome…" | the welcome's door | **KEEP** (the welcome card's words are the shelves slice's) |
| `tests/first-open-tap-welcome.test.mjs:35` "a guest's finger tap … takes the welcome down and opens the card" | guest only | **CHANGE / widen**: a member's first finger tap takes a member's welcome down too (J3) |
| `tests/first-open-joins-hold.test.mjs:101` "…keeps picking — and every pick sends" | bare `cardOf('Soulwax').click()` picks | **KEEP** (mouse); it is also the guard for A2 (the waiting pick must go through the data path) |
| `tests/pick-cycle.test.mjs:78` "a real dispatched click on the resting card cycles 0→1→2→3→4→0" | a click on the resting card picks | **KEEP**, retitled as the mouse/keyboard grammar. Add: a finger tap on the same card opens its zoom and writes nothing |
| `tests/v3-model.test.mjs:59` `nextTapLevel` | the cycle | **KEEP**; add the step function's table (`stepLevel(0,+1)=1 … stepLevel(4,+1)=4`, `stepLevel(4,-1)=3 … stepLevel(0,-1)=0`) |
| `tests/events-wall.test.mjs:705-798`, `tests/cancelled-acts.test.mjs:263-270` ("a tap on a cancelled card picks like any other") | stubbed `onTap` reached by a bare click | **KEEP** (mouse); `cancelled-acts:270` should say "a click" |
| `tests/helpers/zoom-rig.mjs:55-78` `makeCtx().onTap` | a third hand-typed copy of handleTap | **CHANGE**: once `setLevel` / `stepLevel` exist, the rig calls them instead of re-typing the cycle, so the rig cannot drift from the app |

### Browser contracts (real input; CI runs Chromium, WebKit when installed)

| File · case | Page | Assumes | Becomes |
|---|---|---|---|
| `touch-ghost-contract.test.mjs:67` Chromium ghost | gallery | "the tap picked" (level +1), then no ghost zoom | **CHANGE**: the tap opens the tapped card's zoom (`source` tap); a mouse move to the lift point changes nothing (still one tap zoom, not a mouse zoom, not a second card); a real mouse move away hovers another card as ever |
| `touch-ghost-contract.test.mjs:89` WebKit "touch taps on a card pick it and nothing grows" | gallery | two finger taps pick | **CHANGE**, and this becomes the most important contract in the build: in real WebKit, tap → zoom opens; tap + → level 1, zoom still open, nothing else grows; tap + again → 2; scroll a card under the lift point → nothing grows. This is also the only place that proves WebKit's tap sends a `touch` pointerdown before its mouse-type ghosts (if it ever sent a mouse-type pointerdown, the hand would read "mouse" and the tap would pick) |
| `zoom-chrome-contract.test.mjs:124-166` route `'touch'` = a CDP hold (touchStart … wait for the zoom … touchEnd) | app | the hold | **CHANGE**: route `'tap'` = touchStart + touchEnd; the geometry asserts stay. Add a WebKit tap route (only mouse and keyboard run on WebKit today, :166-167) |
| `zoom-chips-contract.test.mjs:99-130` `holdOpen`, and the cases at :215, :226, :245, :306 | app | the hold opens; `:306` picks by tapping the body | **CHANGE**: open by tap; `:306` "a pick's first frame is the old layout" steps with + / − |
| `zoom-chips-burst.test.mjs:84-128` `holdOpen` + `tap()` on `.f-name`; cases :172 (ten taps 40–90ms apart), :235, :292 | app | hold opens; the body picks and cycles | **CHANGE**: open by tap; the burst presses + and − (a burst of + alone stalls at must, so alternate, or + ×4 then − ×4); it keeps its law — never a person twice on any frame |
| `stack-row.test.mjs:182-212` `holdZoom`; :200, :267 "a hold on a card in the row's last line … opens the zoom on screen" | app | the hold | **CHANGE**: a tap opens it; the swipe assertions at :200 stay (a sideways swipe must still not open anything — a drag sends no click) |
| `show-links.test.mjs:132` "in the app, a door tapped just after a pick picks and the zoom stays open" | app, real finger | the door-settle rule for fingers | **CHANGE / invert**: in a finger zoom a door is a door from the first frame, and a + press never slides a door under the finger (Q2). The mouse twin `:97` "a door a pick just slid under the pointer picks instead" stays |
| `meter-contract.test.mjs:417` "a real tap is a small event…", `:454` "Reduce Motion: every tap lands the finished chip at once" (`tapAndSample`, :375-381 via `page.touchscreen.tap`) | app | a finger tap on a resting card picks and its corner meter animates | **CHANGE**: a finger's pick now happens in the zoom, over a resting card whose content is hidden (`.card.zoom-source > * { opacity: 0 }`, v3.css:1157), so the meter's motion is only seen on a mouse/keyboard pick. Drive these by mouse click (or Enter); add a finger case: + in the zoom, close, and the resting meter reads the new level |
| `hover-contract.test.mjs:278` "a mouse button held on a resting card is a slow click, never a touch-style zoom" | gallery | the long-press ignoring the mouse | **KEEP** (still true; simpler reason). The other 10 hover cases stay — mouse is unchanged |
| `zoom-notes-chip.test.mjs:26` WebKit: after a pick, one click on the notes chip opens notes | app | Safari press grace on the chip | **KEEP**; add the − / + twin: one press on + steps and the zoom does not close first |
| `zoom-still-hand.test.mjs` (3 cases), `hover-contract` rest, `now-jump`, `heads-contract`, `shell-contract`, `strip-follow`, `error-report` | — | no card pick by finger | **KEEP** |

New browser contracts the decided model needs (none exist):

1. **Real WebKit, finger:** tap → zoom; + ×4 → must, + dims; − ×4 → 0, − dims; the zoom never closes between presses; nothing else grows; the row's screen position is the same before and after every press (Q2). At 390 and 320.
2. **Real WebKit, Safari press grace on − and +** (the `zoom-notes-chip` twin).
3. **Chromium, a touch-screen with a mouse (iPad + trackpad shape):** a finger tap opens; a mouse hover on another card replaces it with a mouse zoom; a mouse click on the wall picks. Decided by the press, never the width.
4. **Mouse:** the hover zoom shows − · note · +; a click on + steps; a click on the body still cycles (Q1).
5. **Keyboard:** Tab walks card → − → note → + → on.

## 4. The architecture: decide the hand once, let every surface ask it (banked 23:15)

### Today: the question is asked in five places, in three different ways

1. card-facts.js owns the only tracker (C1–C4), but it is the zoom module, and app.js imports `tapOpensZoom` from it to route a guest's tap (app.js:22, 414).
2. wall.js decides the hold by `e.pointerType` itself (W2) and hands every click to `ctx.onTap` with no hand attached (W3).
3. app.js decides the finger close-tap by `e.pointerType` at the document (A6) and the guest route by `tapOpensZoom()` (A1).
4. gallery.html and tests/helpers/zoom-rig.mjs each re-type app.js's routing (§2), and the gallery's copy has already drifted.
5. CSS decides the zoom's row size by `(pointer: coarse)` (S3), which is the device, not the hand.

### The one rule every surface follows

**An event that carries its own pointer answers for itself; everything else asks `hand()`.**

1. `pointerenter` / `pointermove` / `pointerleave` / `pointerdown` know their `e.pointerType`, so hover, the notes-row reveal and the close-tap read it directly, plus `isGhost(e)` for WebKit's mouse-shaped ghosts.
2. `click` and `focus` carry no trustworthy hand: WebKit's click after a finger says "mouse" (C3's comment), and a script `focus()` inherits `:focus-visible` (C1). They ask `hand()`, which remembers the last real press or key.

### The shape (a proposal, sized for one focused session)

1. **`js/v3/hand.js` (new, no imports, ≈80 lines): the hand, decided once.** It holds the document-level capture listeners that card-facts.js:616-650 holds today, moved as they are:
   a. `hand()` returns `'finger'` (last press touch or pen), `'mouse'` or `'keyboard'` (last input a non-modifier key). Default `'mouse'`, so a click with no press before it (a screen reader's activation, a test's bare `click()`) keeps today's meaning. It replaces `lastInput` + `lastPointerType` + `tapOpensZoom`.
   b. `isGhost(e)`: the `touchAt` rule (C3), unchanged.
   c. `mouseAt()` and `stillHand(e)`: the still-hand reads (C4). card-facts keeps `handCard` and the stay-away mark, fed by a `onMouseMove(fn)` subscription, because those are about zooms and cards.
   d. Why its own module rather than exports from card-facts: the hand is asked by the wall, the zoom, the document rules, notes and Diagnostics. A 1468-line zoom module acting as the input model is how app.js came to import zoom internals to route a tap.
2. **card-facts.js: one wiring call per card, one meaning per press.**
   a. `wireCardInput(el, artist, ctx, occ)` replaces `ctx.wireZoom` + `ctx.onPeek` + wall.js's click/keydown/long-press block (wall.js:83-89, 144-192). It wires the click (→ `pressCard`), Enter/Space on the card's own focus (→ `ctx.onPick`), hover (C6), and keyboard focus (C7). A card rendered with `ctx.interactive === false` gets none of it (the export render, tools.js:335, and the gallery's inert grid, gallery.html:1060, today pass stub `onTap`s and still inherit `wireZoom`/`onPeek` by spread).
   b. `pressCard(el, artist, ctx, occ)`, the only place a press on a card is given a meaning:
      - finger: this card already zoomed → nothing; otherwise open its zoom (`source: 'finger'`). Covers the exposed sliver of a clamped zoom's own card (§5 Q6).
      - mouse or keyboard: `ctx.onPick(artist, el, occ)`.
   c. The overlay body (C13) asks the same thing with `z.el`: finger → nothing; mouse/keyboard → `ctx.onPick`, with the door-settle capture (C12) kept for those two only.
   d. The row is the same for every hand: − / + → `ctx.onStep(artist, el, dir, occ)`, the note → `onOpenNotes`. A guest gets the same row; `onStep` decides what a guest's press means (the shelf), because that is about identity, not input.
   e. `installZoomDocumentRules()` moves app.js:151-179 here, idempotent, and app.js and gallery.html both call it: an outside press closes (`meant` when the press is a finger); a finger's close-tap on any card only closes, for members and guests; Escape closes one layer. Harden the click-eat while moving it: disarm on `pointercancel` and eat only a click on a card. Today, with a zoom open, it eats the first click anywhere for 700ms: a flick that starts on a card closes the zoom and turns into a scroll (no click), and a quick tap on a day tab inside that 700ms is the click it eats. Today that hits guests only. After the change it would hit everyone.
   f. Zoom sources become the hand's own words: `'mouse' | 'keyboard' | 'finger'`. `'touch'` (the hold) and `'tap'` (v92) both go. The slot carries `data-hand` so the row's CSS keys on the hand (S3), not on `(pointer: coarse)`.
   g. The finger arming (C8) is deleted with the hold, including its cleanup and its comment.
3. **app.js: intents and one data path.**
   a. `ctx.onPick`: a member cycles (`nextTapLevel`, today's click); a guest → `askToJoin(artist)`.
   b. `ctx.onStep`: a member → `stepLevel(current, dir)`, clamped 0..4 with no loop; a guest → `askToJoin(artist)`.
   c. `setLevel(artist, level)`: the one write path, holding the migration gate, `recordSelection`, `applyLocalPick`, `refreshCtx`, `refreshArtistCards` and `scheduleSync`. `handleTap`'s body, `applyWaitingPick` (A2) and the bulk path's `recordPick` (app.js:2111-2116, which re-types the gate) all go through it.
   d. `handleTap`, `ctx.onTap`, `ctx.onPeek` and `ctx.wireZoom` are gone.
4. **model.js:** `stepLevel(current, dir)` next to `nextTapLevel` (v3-model tests hold both tables).
5. **wall.js:** `renderCard` calls `wireCardInput` and keeps the corner notes button (W4) and `refreshCard` (W5). It no longer knows about fingers at all.
6. **gallery.html and tests/helpers/zoom-rig.mjs** import the wiring and the document rules. Each supplies only `onPick`/`onStep` over a local `setLevel`, so the pages the browser contracts drive run the routing that ships.
7. **Diagnostics:** add one line with the last hand and the standing zoom's hand. It is the input twin of the strip's `data-follow` line. The next "my tap picked instead of opening" report then carries its own evidence (the build-line law, CLAUDE.md "A hover report is only as good as the shell that made it").

### Who asks what, after the change

| Surface | Event | Asks | Result |
|---|---|---|---|
| Resting card | click | `hand()` via `pressCard` | finger → open zoom; mouse/key → `onPick` |
| Resting card | Enter / Space on itself | nothing (a key is a key) | `onPick` |
| Resting card | pointerenter / move / leave | `e.pointerType`, `isGhost`, `stillHand` | mouse → hover intent |
| Resting card | focusin | `hand() === 'keyboard'` | keyboard zoom |
| Resting card | corner notes button | nothing | notes sheet |
| Zoom body | click | `hand()` | finger → nothing; mouse/key → `onPick` (+ door settle) |
| Zoom row | − / + click | nothing | `onStep(±1)` (guest → shelf) |
| Zoom row | note click | nothing | notes sheet |
| Zoom | pointerleave / belt | `z.source === 'mouse'` | grace close |
| Document | pointerdown outside | `e.pointerType` | close; a finger on a card also swallows that tap's click |
| Document | Escape | nothing | close one layer |
| Note row (notes.js) | pointerdown hold | `e.pointerType` | reveal (unchanged) |
| Zoom row CSS | — | `.zoom-slot[data-hand]` | the row's reach |

## 5. Open questions and hazards (each with a default)

1. **Q1. A mouse zoom's body keeps picking.** Default: yes, cycling as today. This is load-bearing, not a nicety: hover opens the zoom 200ms after the mouse arrives, so almost every desktop click on a card lands on the zoom, not the card. If the zoom body stopped picking, "click on the wall picks" would die on desktop. The cost: in a mouse zoom, the body cycles (must → clear) while + steps and stops at must. Two grammars in one box. The alternative (the body acts as +) changes the mouse, which the brief says stays as is.
2. **Q2. The row must not move under a finger between presses.** Default: anchor a refresh on the row. Today a refresh re-centres the zoom (C19). The first + on a card nobody picked adds the who-row, so a centred zoom grows both ways and the row drops by half the row's height. The width also shifted about 12px in the guest-shelf rig (BRIEF §5.4f). Three fixes:
   a. A fixed width for finger zooms.
   b. On refresh, keep the row's screen y and let the card grow upward. A floor-clamped zoom already does this, because its bottom is pinned. When the ceiling forbids it, the ceiling wins.
   c. This is also why the door-settle rule can go for fingers: with the row anchored, the doors above it move UP, away from the finger.
   Without the anchor, a fast second + can land on the note door or a link.
3. **Q3. − is one step down** (must → 3 → 2 → 1 → 0, dimmed at 0), matching proto.diff's `onStep(dir)` and "never loops". The task text's "− down to not picked" also reads as "− clears in one press". Default: one step.
4. **Q4. A guest's row:** − and + both open the join shelf naming the artist, and the pick waiting behind the join is level 1. The note door opens the read-only notes sheet (which has its own join door, N4) rather than the shelf. Default as written. The brief's "any tap opens the join shelf" could also be read to include the note door.
5. **Q5. The resting card's corner notes button on a phone** stays a door (13px, no borrowed reach). A hit opens notes; a near miss opens the zoom, which carries the same door. Default: keep.
6. **Q6. A finger tap on the zoomed card's own resting node** (the sliver a dock-clamped or ceiling-clamped zoom leaves exposed): nothing, like the body. Today a guest there gets the join shelf, because app.js:414 requires `zoomedCard() !== el` and falls through to `askToJoin`.
7. **Q7. A hold then release** must act like a tap. iOS should deliver the click (`-webkit-touch-callout: none` is kept). On Android a long hold may raise `contextmenu` and send no click. Default: verify on real phones in the walk. If Android drops the click, the fix is `contextmenu` preventDefault on cards for touch, not a new timer.
8. **Q8. The one-time line for friends who learned "tap lights it"** (BRIEF §2.8): "A tap opens the card now — pick with + inside." It ships in the release that changes the gesture, and it is the shelves/welcome slice's to place.
9. **Hazard: WebKit's hand at click time.** The finger route depends on WebKit sending a `touch` pointerdown before its mouse-shaped ghosts. Nothing in CI proves that for the tap route today: v92's guest route is jsdom-only, and the WebKit ghost contract drives members, whose tap picks whatever the hand. New contract 1 in §3 is the proof, and it should be green before merge.
10. **Hazard: the gallery is the net, and today it tests a copy** (§2). Moving the routing into production modules (§4.2e, §4.6) is a precondition for trusting any browser contract on this change.
