# Survey dimension: the card zoom and the tap cycle — 2026-08-30

Scope: js/v3/card-facts.js, js/v3/wall.js (renderCard/refreshCard), js/v3/app.js
(ctx wiring, tap cycle, zoom wiring), assets/v3.css (.card/.zoom/.facts-grown/.f-*),
tests/notes-round.test.mjs. Branch `notes-desktop-round` (PR #13).

Method: read every file whole, traced the click/pointer event graph by hand,
then wrote a throwaway jsdom repro (run from repo root so `jsdom` resolves;
deleted after use — not committed) that renders a real card via
`wall.renderCard`, wires the real `card-facts.wireCardZoom`, fires a real
`pointerenter` with `pointerType:'mouse'`, waits the real 350ms, and dispatches
real `click` events at different targets inside the zoomed card to see which
ones reach `ctx.onTap`. This empirically confirmed Finding 1 below (not just
reasoned from reading).

---

## FINDING 1 — P0 — desktop: once a card is hovered/zoomed, clicking it does not pick (Kevin's complaint #1, reproduced)

**Files:** `js/v3/wall.js:208-217`, `js/v3/card-facts.js:315-330,372-373`,
`assets/v3.css:620-624`.

**Evidence:**
- `card-facts.js` builds the grown content block and appends it as a REAL
  child of the card: `grown.appendChild(...)` (people pills, chips, a spacer
  `.f-spring`) then `el.appendChild(grown); el.classList.add('zoom');`
  (lines 315-330, 372-373).
- CSS positions that block over almost the entire card body:
  `.facts-grown { position: absolute; left: 8px; right: 8px; top: 38px;
  bottom: 10px; z-index: 1; }` (`v3.css:624`), while `.card.zoom .name` is a
  thin absolutely-positioned strip at `top: 13px` (`v3.css:623`).
- The card's own click handler explicitly refuses to pick when the click
  landed inside that block: `wall.js:208-217` —
  ```js
  el.addEventListener('click', (e) => {
    if (e.target !== el && e.target.closest && e.target.closest('.facts-grown, .chip-notes, .chip-spotify')) return;
    if (ctx.onZoomTap && ctx.onZoomTap(el)) return;
    ctx.onTap(artistName, el);
  });
  ```
  This guard fires for BOTH pointer types — `onZoomTap` only intercepts
  `source==='touch'` (`app.js:77-80`), so for a MOUSE zoom this `return`
  inside the `.closest('.facts-grown...')` check is the only gate, and it
  swallows the click outright (never calls `onTap`, never calls
  `onZoomTap`) for any click whose target is inside the grown block —
  which, given the CSS above, is almost the entire visible card once
  zoomed.
- **Reproduced in jsdom** (`node` run from repo root, script deleted after):
  hover the card (350ms) → click `.f-spring` (the spacer that fills most of
  the grown block) → `onTap` NOT called. Click `.f-who` (the pills row) →
  `onTap` NOT called. Click `.name` (outside `.facts-grown`) → `onTap` IS
  called. Output:
  ```
  tapCount after click on f-spring while zoomed: 1 (unchanged)
  tapCount after click on f-who while zoomed: 1 (unchanged)
  tapCount after click on .name while zoomed: 2 (incremented)
  ```
- Keyboard is NOT affected: `wall.js:87-93`'s `keydown` handler calls
  `ctx.onTap` directly on Enter/Space without any `.closest` hit-test, so
  Tab+Enter still picks correctly on a zoomed card. This asymmetry (keyboard
  fine, mouse broken) confirms the bug is specifically a DOM
  click-target/hit-testing defect in the zoomed state, not a tap-cycle logic
  regression (`model.nextTapLevel` itself is untouched and still unit-tested
  green in `tests/v3-model.test.mjs`).

**Journey:** F4 (wall tap cycle), F5 (set-times tap cycle) — "Tap a card →
pick cycle 0→1→2→3→must→0." On desktop this is the single most common path
(mouse naturally rests over a card before clicking it; the intent delay is
only 350ms), so anyone browsing normally hits this within seconds of landing
on the wall. Matches Kevin's words exactly: "multiple taps no longer
increases pick intensity" — the FIRST click (before 350ms elapses) still
works; every click after that, while the mouse keeps resting on the same
card, lands in the dead zone and does nothing.

**Fix:** the grown block must never be a hit-test obstacle for the pick
gesture. Two honest options: (a) make `.facts-grown` `pointer-events: none`
except for the specific interactive children it must expose (the notes
button — give that one `pointer-events: auto`), so a click anywhere else in
the enlarged area falls through to the card and picks, matching what a user
sees (a bigger card, still clickable everywhere); or (b) if the design intent
is that hovering the card and then clicking its BODY should show intent
before committing (unlikely, given Kevin's complaint), that intent needs to
be an explicit, discoverable interaction — not a silent no-op. Recommend (a):
it restores "click anywhere on the card picks" exactly as before this round,
while the notes button (already `e.stopPropagation()`'d, `wall.js:114`
equivalent in card-facts.js) keeps its own job.

---

## FINDING 2 — P1 — the zoom writes in-flow layout properties onto a CSS Grid item with default (auto) row sizing → the whole row resizes (Kevin's complaint #2)

**Files:** `js/v3/card-facts.js:374-379` (grow), `:262-264,276-280` (shrink),
`assets/v3.css:509-511` (`.wall-grid`).

**Evidence:**
- `.wall-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }`
  (mobile) / `repeat(auto-fill, minmax(176px, 1fr))` (desktop) —
  **no `grid-auto-rows` is set anywhere in the file** (`grep -n
  "grid-auto-rows" assets/v3.css` → no hits for `.wall-grid`), so row tracks
  use the CSS Grid default `auto`, which sizes each row to the tallest
  item's content/min-height in that row. `align-items` is also unset on
  `.wall-grid`, so its default is `stretch` — every sibling card in the row
  is stretched to fill whatever height the row ends up being.
- `zoomCard()` sets, as plain inline styles on the CARD ITSELF (a direct grid
  item, not a placeholder): `el.style.width = target+'px'; el.style.marginLeft
  = shift+'px'; el.style.minHeight = '132px';` (`card-facts.js:374,377-378`).
  `minHeight: 132px` on a resting card whose base is `min-height: 64px`
  (`v3.css:18`) is a real, large jump — and because the row track is `auto`,
  the ENTIRE ROW'S height becomes 132px+ the instant that write lands, and
  every sibling card in that row visibly stretches taller with it (default
  `stretch`), even though only one card should have moved. This is a direct,
  mechanical explanation for Kevin's words: "the whole row animates and
  resizes when only the one card should (centered over its original spot)."
- On unzoom, `card-facts.js:262-264` sets the width/marginLeft/minHeight back
  to their `prev` values as a plain style write (no animation) — but see
  Finding 3: the SHRINK path (`:276-280`) additionally *animates*
  width/minHeight/marginLeft via WAAPI, meaning the row's auto-height is
  recomputed on every animation frame for 260ms, not just once.
- Distinct from the timetable (`F5`, `.times-grid`): its row heights are set
  as an explicit inline `grid-template-rows` string computed from real hour
  slots (comment at `v3.css:445`), so a zoomed cell's `min-height` there
  overflows past its own row via `overflow: visible` (`v3.css:620`) rather
  than growing the row — the reflow bug is specific to `.wall-grid` (the
  unscheduled "lineup" view, F4), which is also where Kevin was almost
  certainly testing (lineup-mode fests read simplest for a quick check).

**Journey:** F4. The design intent, stated in the branch's own comment
(`card-facts.js:163-171`): "the card grows around its centre... nothing new
appears, and nothing vanishes in place." Reflowing the whole row is the
opposite of "the card itself growing around its centre" — it is the row
reacting to the card, which is a layout side-effect nobody asked for and (per
NOW.md) not what the design canvas showed.

**Fix (the direction Kevin's brief asks me to sketch):** stop growing the
grid item in place. What a transform-only, centre-anchored overlay needs:
1. The real grid item keeps its resting box (no width/marginLeft/minHeight
   writes at all) — the grid track sizes never change, so no sibling moves.
2. The SAME element (not a visual clone — it must keep its existing click,
   pointer, and focus listeners) is switched to `position: fixed`, anchored
   at its measured resting `getBoundingClientRect()` centre, then animated
   with `transform: translate() scale()` growing to its target on-screen
   size/position and `clip-path`/`opacity` for the reveal — never `width`,
   `minHeight`, or `marginLeft`. Both are compositor-only properties, so the
   grid layout underneath is never touched and nothing else in the row can
   move.
3. A zero-size (or `visibility:hidden`) placeholder must occupy the card's
   original grid cell for the duration of the zoom, so the grid doesn't
   collapse the column/row the real card vacated.
4. Everything that must stay tappable — the resting name/time, the notes
   button, the pills once grown — travels with the SAME reparented node
   (this is exactly the "shared element" ambition already in the code
   comments), so none of the existing click handlers need to be rewired,
   only the property list being animated needs to change from layout
   properties to transform/opacity.

This is the single change that also kills most of Finding 3's heaviness,
since `transform`/`opacity` animations run on the compositor thread without
forcing per-frame layout.

---

## FINDING 3 — P1 — the shrink-back animation literally animates layout properties every frame; animation count per zoom is high (Kevin's complaint #3)

**File:** `js/v3/card-facts.js:274-280`.

**Evidence — the smoking gun for "the animation seems to slow and make the
site jitter":**
```js
const ms = 260;
const out = [];
out.push(el.animate(
  [{ width: `${r0.width}px`, minHeight: `${r0.height}px`, marginLeft: `${restMargin + (r0.left - r1.left)}px` },
   { width: `${r1.width}px`, minHeight: `${r1.height}px`, marginLeft: `${restMargin}px` }],
  { duration: ms, easing: EASE },
));
```
This WAAPI animation keyframes `width`, `minHeight`, and `marginLeft` — all
three are layout-triggering properties, not compositor-only
(`transform`/`opacity`). Animating them forces the browser to recompute
layout on every animation frame for the full 260ms, not once. Combined with
Finding 2 (this card sits in a grid row with `auto` height), that per-frame
layout recompute is not scoped to the one card — it is a per-frame reflow of
the WHOLE grid row (every sibling's stretched height is recomputed 60 times
a second for 260ms). This is measurably heavier than the grow-in path (which
sets these same properties ONCE, synchronously, not as a multi-frame
animation) and is a plausible, specific mechanism for "too heavy... makes the
site jitter."

**Animation count per zoom** (counted by reading `zoomCard`/`unzoom`
directly, `card-facts.js:386-420` and `:274-297`):
- **Zoom-in:** 1 clip-path reveal on the card + 1 name hop + up to 2 for the
  sub/time hop (`hop()` animates both the destination AND the resting
  original when a "from" element exists, `:202-227`) + **2 animations per
  picker pill** (a card with 3 people picked → 6 animations just for pills)
  + up to 2 for the notes-chip hop (notes chip exists on essentially every
  resting card, so this path is taken almost always) + up to 2 for the
  Spotify-chip hop (common — Spotify affinity is a core feature) + 1 per
  "extra"/ghost element dissolving (weekend tag chip, Spotify glow). A
  realistic card (2-3 pickers + Spotify + a weekend tag) spawns **12-19
  concurrent `Element.animate()` calls** on a single hover.
- **Zoom-out:** 1 layout-property shrink (above) + 1 grown-block fade + 1
  name hop + **1 animation per resting piece** in `rest` (`:292-296`, where
  `rest = [time, ...marks, ...ghosts, notes, spot].filter(Boolean)`) — same
  order of magnitude, roughly 7-15 depending on the card.
- None of these are pooled/deduped across cards; each hover-in/hover-out
  pair spawns and discards a fresh batch. On a wall where a user's mouse
  naturally passes over several cards while scanning (very common — this is
  literally "browsing the lineup"), this is a lot of animation churn for
  something the design brief calls "the type of light weight we always want
  this app to work" (Kevin, in the ask).

**Forced synchronous layout reads:** `zoomCard()` mutates the card's inline
styles (`el.style.width/marginLeft/minHeight/zIndex`, `card-facts.js:374-379`)
and then immediately calls `rect(el)` (`getBoundingClientRect`,
`card-facts.js:385`) to compute the clip-path keyframe — a write-then-read
that forces one synchronous layout recalculation per hover. A second forced
layout happens for the off-screen `probe` measurement (`:333-340`:
`document.body.appendChild(probe)` then `probe.getBoundingClientRect()` then
`probe.remove()`). `unzoom()` has the same write-then-read pattern once
(`:262-272`). So every hover-zoom cycle costs ~2 forced synchronous layouts
of the whole document, on top of the per-frame layout cost from Finding 2/3's
animated layout properties.

**Journey:** F4/F5/F6. **Fix:** same as Finding 2's fix — once the grow/shrink
stop touching width/minHeight/marginLeft (moving to a fixed-position,
transform-only overlay), the shrink animation becomes compositor-only and
the row-reflow disappears with it. Separately, worth asking whether every
piece really needs its own hop animation, or whether the sub-line + pills
+ chips can fade/scale as one group — 12-19 simultaneous animations per
hover reads as more machinery than "a card growing" needs, independent of
which CSS properties are used.

---

## FINDING 4 — P2 — a live-sync repaint silently kills an active zoom, and can retrigger a full replay if the pointer never left

**Files:** `js/v3/app.js:373-388` (`repaintWall`), `:1724`
(`onRemoteChange`), `js/sync.js` (25s poll cadence, confirmed at
`app.js:1818-1831`), `js/v3/card-facts.js:428-437` (`pointerenter` intent
timer).

**Evidence:**
- `repaintWall()` starts with `unzoom();` unconditionally
  (`app.js:374`), then rebuilds the ENTIRE wall DOM from scratch
  (`renderWall($('wall-root'), ctx)`, `:376`) — fresh `renderCard()` nodes
  for every artist, always (confirmed: `wall.js`'s day-section rendering
  path has no diffing/reuse of existing card nodes).
- `repaintWall` is the callback for `onRemoteChange`
  (`app.js:1724`: `onRemoteChange: () => { repaintWall(); ... }`), which
  fires whenever `sync.pollSync()` sees the crew doc actually changed
  (`sync.js:85,224`: `if (state.applyRemoteDoc(remote)) onRemoteChange();`).
  The poll runs every 25 seconds while online (`app.js:1818-1831`,
  `setInterval(..., 25000)`), and low-power stretches it to 5 minutes but
  does not disable it.
- Net effect: **any** pick, note, or other change from **any** other crew
  member — not just changes to the artist you're currently looking at —
  closes your zoom, with no confirmation and no attempt to reopen the SAME
  artist's zoom on the fresh node. Compare this to the deliberate care taken
  for the "my own tap" path: `refreshArtistCards()` explicitly re-grows the
  zoom on the fresh node with `instant: true` so a self-inflicted repaint
  doesn't flicker (`app.js:126-143`, well-commented: "A pick while zoomed
  keeps the zoom... The fresh node re-grows at once — no intent delay, no
  morph replay"). No equivalent care exists for `onRemoteChange`'s full
  repaint — the exact same "don't lose the user's place" concern the code
  clearly already cares about elsewhere is simply absent on the remote path.
- Since `renderCard()` always creates brand-new elements, and the new card
  occupies the exact same screen position the old (torn-down) one did, a
  mouse that never moved will receive a fresh `pointerenter` on the new node
  (standard browser behavior when the DOM under a stationary cursor is
  replaced). `wireCardZoom`'s `pointerenter` handler (`card-facts.js:428-437`)
  then restarts the full 350ms intent timer and, once it fires, replays the
  ENTIRE zoom-in morph (clip-path reveal, every hop) from scratch — not the
  instant, no-replay path used for self-inflicted picks. In an actively
  syncing crew (the exact scenario this app is built for — several people
  picking together at a festival), a person who parks their mouse on a card
  to read its notes can have that card snap shut and silently re-grow with a
  visible replay roughly every 25 seconds, for no reason connected to what
  they're looking at.

**Journey:** F4/F6 combined with the live-sync model described in
CLAUDE.md/user-flows.md (sync states, additive merges). Not data-unsafe (no
information lost), but it is an unhandled interaction between two features
that individually work as designed.

**Fix:** in `onRemoteChange`'s repaint, if a zoom is active, capture its
artist + occurrence + source the same way `refreshArtistCards` already does
(`app.js:130`), and after the repaint, either (a) instantly re-grow the SAME
zoom on the fresh node for that artist (matching the self-pick path,
`instant:true`, no replay), or (b) leave it open and only re-render the rest
of the wall (harder, but truer to "don't disturb what the user is doing").
(a) is a small, consistent change since the exact re-grow primitive already
exists and is exercised on every self-tap.

---

## FINDING 5 — P2 — zero test coverage for the zoom's interaction with the tap cycle (why Finding 1 shipped)

**Files:** `tests/notes-round.test.mjs` (whole file read), `tests/wall-dom.test.mjs`,
`tests/wall-filters.test.mjs`.

**Evidence:** `grep -rln "zoomCard\|wireCardZoom\|facts-grown\|onZoomTap\|zoomedCard" tests/`
returns **no matches at all**. `notes-round.test.mjs` (the test file added
with this round) exercises the notes/threads UI exhaustively but never
simulates a hover, a long-press, or a click while zoomed. `wall-dom.test.mjs`
stubs `onTap: () => {}` as a no-op and never dispatches a `click` event to
assert a pick actually lands; the tap-cycle math itself
(`nextTapLevel`) is unit-tested in isolation in `tests/v3-model.test.mjs`,
but nothing exercises the real DOM path (`wall.js`'s click handler +
`card-facts.js`'s zoom state) end to end. This is precisely the kind of gap
that let Finding 1 ship: a jsdom test that hovers a card (fake/real timers),
advances past `ZOOM_IN_MS`, and clicks inside the grown block would have
failed immediately — the same jsdom technique used for this survey's repro
(see the top of this file) is directly reusable as a permanent regression
test.

**Journey:** all of F4/F5/F6 depend on the tap cycle; this is a coverage gap,
not a journey break by itself.

**Fix:** add a test to (a new or existing) suite that: renders a card via
`wall.renderCard`, wires `card-facts.wireCardZoom`, fires `pointerenter`
(`pointerType:'mouse'`), advances past `ZOOM_IN_MS`, dispatches `click` on
`.f-spring`/`.f-who` inside the zoomed card, and asserts `ctx.onTap` fires.
Add the mirror case for a long-press-then-second-tap on touch (see Finding 6)
so the intended "tap dismisses" contract is pinned down explicitly too.

---

## FINDING 6 — P2 — worth Kevin's explicit re-confirmation: on touch, the tap right after a hold does not pick, it dismisses (matches "multiple taps" but is currently spec'd behavior)

**Files:** `docs/user-flows.md` F6 ("tap anywhere else puts the zoom away"),
`js/v3/app.js:77-80` (`onZoomTap`), `js/v3/wall.js:158-190` (long-press wiring).

**Evidence:** this is implemented exactly as `user-flows.md` F6 describes it
("Mobile: hold a card... Tap anywhere else puts the zoom away") and as
`app.js:74-76`'s own comment states ("A touch-born zoom is a preview: tapping
its body puts it away rather than picking"). So on a touchscreen: hold (500ms)
→ zoom appears, no pick yet → first tap on the body → zoom closes, no pick →
a SECOND, separate tap is required to actually cycle the pick. This is
intentional per the documented design, but it produces literally the same
observable symptom Kevin described ("multiple taps no longer increases pick
intensity") on a touch device, independent of Finding 1's desktop bug: the
tap immediately following any hold is consumed as a dismissal, not a pick,
so a person who holds-to-preview then taps to pick is one tap short of what
they expect. Flagging because Kevin's own phrasing doesn't distinguish
mouse from touch, and it's worth him explicitly re-confirming this contract
now that he's felt its effect, rather than assuming F6's original design
intent survives contact with "why didn't my tap register."

**Journey:** F6 (mobile hold → zoom → tap-anywhere-dismisses).

**Fix (if Kevin wants to change it):** the simplest tweak that keeps the
"preview vs. commit" idea but removes the tap tax: make a tap on the zoomed
card's BODY (not its notes chip) pick AND keep the zoom open (so multiple
taps do cycle the level while previewing), and reserve "tap outside the
card" / Escape for dismissal — bringing touch in line with how mouse already
behaves (`onZoomTap` only intercepts touch; a mouse click while zoomed
already picks, per code intent, once Finding 1 is fixed).

---

## Minor / not filed as a top-level finding

- `card-facts.js:466-468` (`wireCardFocusZoom`'s `focusout` handler) never
  checks `dismissedEl`, unlike the mouse path's `pointerenter`
  (`:432`). A keyboard user who dismisses a zoom with Escape and then tabs
  away and back to the SAME card (without visiting another card first) will
  see it re-zoom immediately, whereas a mouse user who dismisses via Escape
  must actually move the pointer off the card and back. Narrow edge case,
  P3 if filed at all — noting it here for completeness rather than as a
  headline finding.
- The coach mark copy "Hold for notes." (tracked already as an open item in
  NOW.md, Kevin's call, not re-filing it here) is still present and now
  reads as doubly stale given Finding 6: hold no longer leads directly to
  notes, it leads to a zoom, whose OWN notes chip is a further tap away, and
  that further tap is also the one a plain "tap the body" gesture would
  naturally reach for.

## Skeptic

### zoom-1 — CONFIRMED (P0)
`wall.js:212`'s gate — `if (e.target !== el && e.target.closest && e.target.closest('.facts-grown, .chip-notes, .chip-spotify')) return;` — runs unconditionally, before `ctx.onZoomTap`, for BOTH mouse and touch zooms. Verified the DOM shape it swallows clicks from: inside `.facts-grown`, only `.f-chip.notes` calls `e.stopPropagation()` (`card-facts.js:114`); `.f-sub`, `.f-spring`, `.f-pill`, and `.f-chip.spot` (the spotify line) are plain, handler-less nodes (`card-facts.js:150-179, 240-246`) that would otherwise bubble a click straight to `el`'s pick listener. `.facts-grown` is CSS-positioned `top:38px; bottom:10px; left/right:8px` (`v3.css:624`), i.e. most of a 132px-tall zoomed card. This directly contradicts the code's own stated intent in `app.js:75-77` ("A mouse zoom is just hover — clicking still picks") and the doc contract at `docs/user-flows.md:110` ("click still picks"). Also confirmed the asymmetry that makes this read as an oversight rather than a deliberate choice: the RESTING corner pieces (`.time`, `.corner-who`, `.corner-about`, `.spot-glow`) are given `pointer-events: none` in `.card.zoom` (`v3.css:621-622`) specifically so clicks fall through to `el` — the same treatment was never extended to `.facts-grown`'s non-interactive children, which instead rely on the wall.js JS gate that swallows too broadly. Severity P0 is right: this breaks click-to-pick for the majority of a zoomed card's body on the primary desktop interaction path.

### zoom-2 — CONFIRMED (P1), with a sharper root cause
Verified `.wall-grid` (`v3.css:509-511`) declares no `grid-auto-rows` (default `auto`, content-sized) and no `align-items` (default `stretch`), while `.times-grid` gets an explicit `grid.style.gridTemplateRows = rowsTemplate` written in JS (`wall.js:715`) — confirming the reader's claim that the schedule grid is immune and the lineup wall is not. `zoomCard` (`card-facts.js:374,377-378`) writes `width`/`marginLeft`/`minHeight` directly onto `el`, the live grid item. One nuance the reader's writeup blurs: `.card.zoom` also sets `overflow: visible; z-index: 30` (`v3.css:620`), and the `shift` math (`card-facts.js:344-352`) clamps against the WHOLE grid's bounding rect, not the current column — i.e. horizontal overflow across neighboring columns looks like a deliberate "spotlight over neighbors" pattern (Netflix-hover-card style), not an accident. The part that's actually unintended is narrower and more clear-cut than the finding states: `el.style.minHeight = '132px'` is a real, non-absolute box-model change on a grid item whose OWN row track defaults to content-based `auto` sizing — and since `.facts-grown` itself is `position: absolute` (doesn't contribute to parent height), that minHeight write is the one piece of this that had no reason to touch layout at all. It's the sole cause of the row-track growth Kevin described; the width growth's neighbor-overlap is presumably intended. Same P1 severity, but the fix is smaller than "switch everything to transform" — dropping just the `minHeight` write (letting `.facts-grown`'s own height, or a `min-height` on `.facts-grown` itself rather than `el`, drive the visual size) would likely kill the row-resize without touching the horizontal spotlight effect at all.

### zoom-3 — CONFIRMED (P1)
Verified `card-facts.js:276-280` animates `width`/`minHeight`/`marginLeft` — layout-triggering properties — via WAAPI on the shrink-back path, in contrast to the grow-in path's `clip-path` reveal (`card-facts.js:388-392`), which IS compositor-friendly. Re-counted the animations for a card with sub + 3 picker pills + notes + spotify: 1 (clip-path, grow only) + 1 (name) + 2 (sub hop) + up to 6 (3 pills × 2 for a hop pair) + 2 (notes) + 2 (spotify) ≈ 13-15 on the way in, roughly matching the reader's 12-19 estimate (an estimate, not an exact count, but directionally right and easily reproduced by reading `hop()`'s two-animation return at `card-facts.js:154-172`). The core claim — real layout-property animations, no pooling, a double-digit animation count per zoom on a realistic card — is verifiable from the code as written.

### zoom-4 — CONFIRMED (P2)
Verified `repaintWall()` (`app.js:373-374`) starts with an unconditional `unzoom()`, with no capture-and-restore logic, while `refreshArtistCards()` (`app.js:122-142`) explicitly captures `keepZoom` and re-grows instantly. Verified `onRemoteChange: () => { repaintWall(); ... }` (`app.js:1724`) is the callback passed to `sync.js`, and that `onRemoteChange()` there only fires when `state.applyRemoteDoc(remote)` returns true (`sync.js:85,217-218`) — i.e. gated on an actual doc change, not every poll tick, which matches the reader's own phrasing ("every crew-doc change seen by the 25s poll") rather than overstating it as literally every 25 seconds. The 25s interval itself is confirmed at `app.js:1818` (`setInterval(..., 25000)`). Finding stands as described.

### zoom-5 — CONFIRMED (P2)
Verified the grep independently: no test file references `zoomCard`, `wireCardZoom`, `facts-grown`, `onZoomTap`, or `zoomedCard`. `tests/wall-dom.test.mjs:40` stubs `onTap: () => {}` with no click dispatched against it. `nextTapLevel` is exercised only as a pure function in `tests/v3-model.test.mjs:59`, never through a real DOM click. Coverage gap confirmed exactly as described.

### zoom-6 — CONFIRMED (P2, informational)
Verified `docs/user-flows.md:107-110` states both halves the reader cites verbatim: "tap anywhere else puts the zoom away" (touch) and "click still picks" (desktop), and `app.js:74-78`'s `onZoomTap` implements exactly the touch half. This is spec-compliant as the reader says — filing it as a re-confirmation item rather than a bug is the right call.

### What the survey missed

1. **A self-pick can re-zoom the WRONG occurrence card for a multi-occurrence artist, when the zoom came from keyboard (or touch).** `refreshArtistCards` (`app.js:122-142`) captures the right `occ` off the originally-zoomed element (`app.js:130`, reading `z.dataset.occ`) but then picks WHICH fresh node to re-grow with `const target = fresh.find((el) => el.matches(':hover')) || fresh[0];` (`app.js:141`). `:hover` never matches a keyboard-focused element, and is unreliable-to-absent on touch — so for an artist with two occurrence cards (the codebase explicitly supports this: "a grid set and an afters event, or two EF days," `card-facts.js:27-28` / `wall.js:60-61`), a keyboard-zoomed SECOND card, picked via Enter (which calls `ctx.onTap` directly from `el`'s own `keydown` handler at `wall.js:104-108`, bypassing zoom-1 entirely), will have `keepZoom.occ` correctly point at the second occurrence but `target` fall back to `fresh[0]` — the FIRST occurrence's card. The result: the first card visually re-zooms showing the SECOND occurrence's stage/time facts, while the card the user actually interacted with silently returns to rest. Reachable specifically via keyboard (the one input mode the reader's own F4/F5 journey confirms bypasses zoom-1's click bug, making this the keyboard user's actual remaining zoom bug) on any artist with 2+ scheduled occurrences. Worth a P2 filing of its own — narrow (multi-occurrence + keyboard) but a genuine correctness/accessibility bug the reader's keyboard journey didn't push far enough to hit.

2. **`wireCardFocusZoom`'s `focusout` doesn't check the active zoom's `source`, so it can prematurely kill a MOUSE zoom.** `card-facts.js:466-468`: `if (zoomed && zoomed.el === el && !(e.relatedTarget && el.contains(e.relatedTarget))) unzoom();` fires for ANY zoom on `el`, not just keyboard-sourced ones. A `<div tabindex="0" role="button">` (which is what every card is, per `wall.js:85-86`) receives DOM focus on a plain mouse click per the HTML focusing-steps spec, even though `:focus-visible` won't match it (so the `focusin` handler's own `zoomCard` call is correctly skipped, per the reader's noted `dismissedEl` gap right next to this). But `focusout` has no equivalent `:focus-visible`/source guard: click a card to pick it (mouse-hover zoom already open) → the click focuses the div → immediately press Tab (or click any other focusable control) → `focusout` fires → `unzoom()` runs instantly, even though the mouse pointer never left the card and the mouse path's own carefully-commented "generation-exact" 300ms exit timer (`card-facts.js:441-448`, which the reader quoted approvingly elsewhere) never got a chance to apply. This is the same class of gap as the reader's own noted `dismissedEl`-in-`focusin` miss (already filed as Minor, not re-filing that one) but on the opposite handler and with a different, arguably more visible symptom: a mouse-hover zoom can vanish out from under a still-hovering pointer. P2/P3 — real, reachable via an ordinary click-then-Tab sequence, but requires that specific interleaving to notice.

3. **A mobile-width nuance in the zoom-2 root cause.** `.wall-grid`'s narrow-viewport template is a bare `repeat(2, 1fr)` (`v3.css:509`), not `minmax(176px, 1fr)` (that only applies ≥720px, `v3.css:510`). Per the CSS Grid spec, a bare `<flex>` track size is equivalent to `minmax(auto, <flex>)` — its minimum sizing function is `auto`, an INTRINSIC sizing function, unlike the ≥720px breakpoint's fixed `176px` minimum. That means on mobile (<720px, the primary surface for touch long-press zooms) the explicit `width` write in `zoomCard` could also grow the COLUMN track via the same content-based mechanism that grows rows, not just overflow visually via `overflow:visible`/`z-index:30` as it likely does at desktop widths. The reader's writeup treats the row-growth bug as breakpoint-independent (true) without flagging that touch users on narrow viewports may see BOTH axes misbehave where desktop mouse users see only the row axis — worth a real-device check before scoping the fix to "rows only."
