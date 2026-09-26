# Our plan — build log (sibling session "Our plan build", started 2026-09-26 ~4:40 AM PT)

Branch `live/plan` (worktree `.claude/worktrees/plan`), based on `live/list` @ aba41c3
(v93 underneath: NOW tab in the day row, the Show menu popover). Handoff:
`OUR-PLAN-HANDOFF.md` beside this file. Coordinator session: festival-navigator-81 —
it merges, stamps, opens the PR and runs the prod smoke. This session never does.

## What "done" means here

Kevin's call #5 (LEDGER): a peek row just above the dock (artist big, place under it;
NOW/NEXT with its time just left of the count; one second-line size) that drags up into
the whole day plan in the same rows (quiet times, bigger artist names); on a laptop a
corner card with an Open button that grows into a 400px right panel, the wall still
usable; one NOW once it exists; an artist who plays twice counts at both places; hidden
rooms stay hidden; the bar is max(3, ceil(pickers/4)). No "Tell a friend".

Gate before handing to the coordinator: `npm test` at UTC, Asia/Tokyo and the night
clock; `npm run test:browser` (Chromium + WebKit locally); a Sol 6 review with real
findings fixed; an independent Sonnet walker with real input.

## Steps (each one a commit on live/plan, pushed)

0. This log.
1. Fresh map of the current head (the maps in this folder describe plan-base abe7205;
   v93 and the List build have moved app.js / wall.js since) — `our-plan/map-*.md`.
2. U6: `week.js` lifted out of wall.js (re-exported), `liveWindowOf` in its own commit,
   `plan.js` ported from `design/ours-r2/ours-model.mjs` with the four ACL fixes.
3. Design pass for the undrawn states (frames rendered by the production app) → a
   review page of this session's own with tap-answerable decisions.
4. The floor line the peek needs (`--foot-h`), the peek, the drag into the day plan.
5. The laptop corner card and 400px panel.
6. Gate, then SendMessage the coordinator with the head SHA, results and frame paths.

## Log

- 2026-09-26 ~4:40 AM PT — read the handoff, PLAN.md (§2.5–2.7, U4, U6–U8, §4, §6),
  REVIEW-1, map-plan-now-dock, the round-three BRIEF and its frames, the LEDGER's calls,
  the review page's `ours-*` / `r5*` decisions (there are no `r4-*` rows in the
  collection; round four's answers are the LEDGER's calls #1–#5).
- ~5:00 AM — merged main #52 (docs: "a menu or popover takes no history entry; layers
  Back must close ride js/v3/router.js"). Agreed with the coordinator: the peek and the
  open day plan take NO history entry — closed by a drag down, the grabber, ×, Escape,
  the fest name or another screen; gone on pagehide and boot. Goes on the review page as
  a stated default, and it must say plainly (coordinator's ask): with the plan open
  full-height, a friend's instinct is swipe-back / Back, and Back will leave the wall
  instead of closing the plan — verify what Back actually does from the wall before
  writing that sentence.
- ~5:25 AM — step 1 banked: six maps of the current head in `our-plan/` (NOW + dock
  data flow; floor, layers and shelves; the design model's port with the golden route
  numbers; the week, events and live windows; tests, gallery and gate; the neighbours).
  What they changed about the plan: the grid's end rule is next-set clamped 30–120,
  else +75 (the +60 is dead code) and there are four live-window rules, so plan.js
  reads the WALL's own windows rather than a new `liveWindowOf`; the `week.js` lift is
  deferred (live/list and live/import both edit wall.js — the lift would collide with
  both for no user gain); U4.5 is already done by v93's `.menu-up`.
- Back, verified in code (app.js 3204, 2300, 3613–3621): the wall's entry is the
  crew link itself (`replaceState` to `/#g=…`). The only entries the wall ever adds are
  router layers (sheets), the join shelf, and the fest list's ‹. So with the plan open
  a Back does what it does from the wall today — it leaves the wall (to whatever the
  link was opened from; on Android it closes the app; on an iPhone opened from
  Messages there is usually nothing behind it). The review page says this in those
  words.
- live/list moved (c5e436b → 32d9b1e: view persistence, the List, the menu bar
  `dot · FEST '26 · ☰` in the dock). Not merged here yet — asked the coordinator; the
  peek builds on the dock, so it waits for that merge. plan.js (pure) goes first.
- ~6:10 AM — merged live/list (32d9b1e) and then again (41bb914, which carries v96).
  The first merge's base already failed six now-jump day-row contracts on its own
  (checked on a clean worktree of 32d9b1e: 8 fails there); after the second, the
  whole browser suite was green (235/235) before any Our plan browser test existed.
- The model (Opus builder): `js/v3/plan.js` + `tests/plan-model.test.mjs`, golden
  identical to the prototype's print-route on both folds, 1105/1/1 at three clocks on a
  clean archive, 16 hand-made breaks each caught. Its log: `our-plan/plan-model-log.md`
  (the open questions there go on the review page, ACL Late nights first).
- The phone (84292d3, c393598, e40faf2): the peek is the day plan's own NOW/NEXT row
  seen through a window (#plan at its open height, pushed behind the dock), one number
  p drives the drag, `foot.js` is the floor (footTop, --foot-h/--dock-h), one NOW, a
  search and the welcome card put it away, no peek before a festival but tomorrow's.
  A NEXT row's faces wait just under the window. The shelf's jsdom tests caught a
  bare getComputedStyle that took the whole boot down on a festival night — fixed,
  and paintPlan now records a throw and puts the peek away instead of the wall.
- The laptop (0c86671): the same element as the corner card and the 400px panel, one
  clip-path; head line cross-fade; zoom right bound (sideLeft); rail NOW steps aside.
  Browser: `tests/browser/plan-drag.test.mjs` 13/13 (Chromium + WebKit).
- Frames: `our-plan/frames.mjs` → `our-plan/shots/` (git-ignored PNGs), rendered by the
  production app on the ours-r2 rig (made-up nine, no network, no database).

- ~7:00 AM — the motion clips (`our-plan/motion.mjs`, real pointer input on the same
  rig, MP4s git-ignored with every recording now) caught two real bugs the stills and
  the tests had not:
  1. A mouse on the phone's grabber could neither open nor close the plan. The drag
     captures the pointer, so a captured mouse's click lands on `#plan`, never on the
     grabber (a finger's click still reached it in Chromium, which is why the tests
     passed). The grabber's pointer tap is now taken in `onUp`; its click is the
     keyboard's.
  2. A row tap below the NOW card slid the tapped row up under the finger — first by
     folding the NOW card above (one grown card at a time), then, once grown cards
     became a set, by the window growing with its content. Storyboard 8 says only the
     rows below make room: a tap now pins the window's height (border-box), the rows
     below scroll out of sight, and only a card the bottom edge would cut off moves
     things — the window grows toward its cap, then the list scrolls, by exactly the
     overflow. The pin lasts while the plan is open. An open list also keeps its
     scroll across a redraw (a new list element used to start at the top).
  Both have Chromium + WebKit tests now (plan-drag 17/17).
- A full browser run under load failed the flick test once: the helper read the
  page's geometry between the last move and the release, and on a busy machine that
  round trip outlasted the flick's 80ms. A CPU-throttle probe also showed a 60px
  synthetic flick stops reading as a flick at 4x (CDP input waits on the page, so
  its timestamps slow with it — real touches keep hardware time). The test's flick
  is now 90px (still under a third) released at once; it holds at 4x.
- Welcome frames had broken on v96's boot address (`/f/<fest>#g=…`, a Vercel rewrite
  the static server lacks); the rig now re-opens `/#g=…` instead of reloading.
- The review page (my own artifact, `our-plan/review.html`, frames and clips from
  `our-plan/shots/`): ten calls with my pick marked, answers stored in its db.

## Gate, round one (2026-09-26, ~6:20–7:00 AM, head 098ea40)

- Unit, three clocks (UTC, Tokyo, the night clock): 1163 pass, the stamp red (expected).
  Browser: 252/253 — the one red was real (below).
- **A late font (WebKit).** The peek sat 27px above the dock. Holding the woff2 files
  1.5s reproduced it 3 of 3 in WebKit, 0 of 3 in Chromium: WebKit's
  `document.fonts` `loadingdone` arrives before the new face's layout, so the refit it
  drove measured the fallback face. (Chromium also holds its load event for fonts
  requested before it, which hides the case there.) The shelf now watches its own
  boxes — `#plan`, the grabber, the head and the rows down to the tagged one — with a
  ResizeObserver, and a refit waits for the shelf's own Web Animations to end first
  (a ruler read mid-FLIP reads the motion). The font event no longer refits it.
- **Codex Sol (gpt-6-sol, high), five real findings, all fixed with tests that fail
  on the old code:**
  1. A query cleared in the field, then the blur: the dock's NOW beside the peek's.
     Focus and blur re-read the one-NOW rule.
  2. A card grown on a phone pins the window's height; widened to a laptop, the panel
     kept it. A refit on the laptop unpins and settles its state (the panel bounds the
     zoom again).
  3. A new answer mid-drag put the window back where the last settle left it. It is
     held until the hand lets go, then drawn before the settle.
  4. Stop rows were divs, unreachable by keyboard. They are buttons now
     (`aria-expanded`), out of the Tab order in the peek; a redraw hands the focus to
     the same stop's new row. A bare click on the peek (a screen reader's) opens it.
  5. The open grabber bar is 13px: the head, which opens nothing and already dragged,
     takes a tap too.
- Two traps the button change sprang: the touch floor's `min-height` replaces a flex
  item's content minimum, so a pinned list squeezed the NOW row from 61px to 44 (list
  items are `flex: none` now); and Chromium moves the focus off an element the moment
  it turns inert, so the peek's focus hand-off reads the focus first.
- **The walker (Sonnet, real input, 16 steps):** phone 26/26 in both engines once its
  own harness was fixed (its search tap had landed on a field scrolled off screen).
  Laptop: the corner card was more than 40 Tabs away, after every wall card — the
  frame now follows the day rail in the page's order (fixed at z29 under the dock's
  30, so nothing is drawn differently), one Tab after the rail. Safari's convention
  (Tab skips buttons without Full Keyboard Access) is kept, as for every button here.
  Its one other red, the 20px gap reading as the card once, did not reproduce (6 of 6
  clean on the new head); the re-walk checks it again.
- Merged origin/main after v97 shipped (no content change: main was live/list plus
  its merge). Head e97272f; round two (full browser suite, a Codex re-review of the
  delta, a re-walk) next.
