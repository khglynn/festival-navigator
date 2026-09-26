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

## Gate, round two (2026-09-26, ~7:05–7:35 AM, gated head 666cc6f)

- Codex re-review of round one's delta: two real findings, fixed in bf50a67 with
  tests. (1) Focus on a stop the minute folds into Earlier was dropped with the old
  row; a redraw now hands it to the same stop, else Earlier, else the tagged row, else
  the grabber. (2) The peek's row still said `aria-expanded`, a card it cannot show;
  the attribute lives only in the open plan. A third Codex pass on the new delta found
  nothing (cx-20260926-070610-62927-c34dc6).
- The re-walk (Sonnet, real input, bf50a67): 41 of 42. Tab reaches the corner card in
  23 presses from page load (it was ~490). The late-font case sits 0.00px on the dock
  in both engines; a grown card through phone → laptop → phone lands within 0.5px.
  Its one red was its own: in WebKit a tap on the stage strip (tabindex -1) never
  takes focus off the search field, so search mode rightly stayed on; with a real
  blur the peek comes back as the peek and the dock's NOW stays hidden (probed in
  both engines). Its "resized panel is 28px shorter than a fresh one" was a mouse
  page beside a touch page: the 44px floor lifts the Earlier row and the ✕ under a
  coarse pointer. A fresh mouse page at 700px measures 597.11px, exactly the resized
  one. Its note that a cleared-but-focused search keeps the peek away is the rule
  (the dock goes with it while the keyboard is up), unchanged.
- Main's docs after v97 merged (666cc6f, no code). On that head: unit 1168 of 1170 at
  UTC, Tokyo and the night clock (1 skipped; the red is the stamp, the coordinator's);
  browser 260 of 261, the skip being the Chromium-only keyboard test.

## The people menu merged, and its "Our plan ›" row (2026-09-26, ~8:20–8:50 AM)

- `live/people` (b78b274) merged in (b008b1d). One conflict, app.js's dock wiring:
  Our plan's search focus/blur (they re-read the one-NOW rule) and its welcome-card
  watcher kept; the you-slot is the people menu's (Jump to top retired there).
- The row (f449d52): "Our plan ›" in tonal text, first below the menu's line, above
  Pick as someone else / Join the crew — the people-shelf design. Offered only while
  a plan is on screen (`planHere()` in plan-shelf.js; passed as null otherwise, so the
  menu's signature redraws). A tap closes the menu and the plan rises from its peek;
  on the laptop the corner card grows into the panel. A click with no pointer behind
  it (Enter, Space, a screen reader: `detail === 0`) takes the focus to the grabber.
  docs/user-flows.md gains F18 (Our plan) and F9 names the row.
- Codex on f449d52, one real finding: the row was decided when the menu was drawn, so
  a plan that left under an open menu left a row that opened nothing (and one that
  arrived left none). paintPlan redraws the menu when `planHere()` changes; a redraw
  now hands a keyboard's focus to the same row, else the first (a crew change dropped
  it to the page too). Fixed in 6930254 with tests that fail without each half;
  Codex's confirmation found nothing new.
- Gate on 6930254: unit 1181 of 1183 at UTC, Tokyo and the night clock (the stamp red,
  1 skipped); browser 288 of 289. One UTC run also failed a people-menu test ("the
  menu gained Zed…": its 10ms settle after a click) with the load average at 25 from
  other sessions; that crew has no plan, so the new hook never runs there; 3 of 3
  alone and the full UTC suite again were clean.

## live/people 1b678c0 and main's ACL data release #56 merged (2026-09-26, ~8:55–9:30 AM)

- Merged `origin/live/people` at 1b678c0 (440c58b: one add at a time in the invite
  sheet, no conflict, nothing of Our plan's touched) and `origin/main` at e19273c
  (e6ded61: data release #56 — Portola's Regency rooms laid out as concerts, every ACL
  Late night given a time, the venue registry). The arc NOW conflicted; main's text
  kept, my line updated in place.
- The model did not change; eight of its tests had pinned the old data. 6407881
  re-pins each with the reason at the line: three Portola golden lines move with the
  earlier Regency acts (Sat's Soulwax stop is now some-4, Cy leaving for Parcels at
  10 PM); ACL has 40 Late nights rooms where it had one, and the windows test now
  compares every ACL night (248 cards, exactly the plan's timed acts). The doors-only
  rule moved to a synthetic festival so it stays pinned.
- Codex (Sol, high) on 6407881: three real findings, fixed in 4971f30 — playsAt pinned
  on the whole festival rather than a filter that repeated its own; and two overclaims
  in the model log (Portola's Regency does open during the grid; 16 of 41 festival-date
  Late nights acts start before the last grid window ends, not 7).
- Found and NOT built — a product call: a Late night that starts while the grounds
  still play sends the route across town and back (made-up crew, Sun Oct 4: Scoot Inn,
  Tito's, Scoot Inn, T-Mobile, Scoot Inn), because rule 3 re-seats everyone at their
  best pick every five minutes. Proposed rule and its cost: the model log's open
  question 7; on the review page as the last call (it replaced the ACL-doors call,
  which #56 answered).
- Frames and both clips re-rendered on the new data (23 of 23; the day-before peek
  says Thu ~9:30 PM, the Saturday list's Soulwax row is some-4, so the open sheet is
  28px shorter).
- Gate on 4971f30: unit 1199 of 1201 at three clocks (the stamp red, 1 skipped);
  browser 287 of 289 — Our plan's Chromium flick failed with the app unchanged, at a
  load average of 17 from other sessions (its second failure in about ten runs). The
  cause is the harness: under `page.clock` Playwright redefines `Event.timeStamp` as
  the fake `performance.now()` at first read, so the shelf's flick times are when each
  listener ran, and a release landing 80 ms after the last move is a stopped hand.
  Protocol timestamps were tried and cannot help (the clock hides them). c1b2301 makes
  the test read back what the page's listeners saw, ask the shelf's own question of it
  (thresholds read from plan-shelf.js), and resend a gesture the machine did not
  deliver as a flick, up to three times; the flick is 28% of the way. An inverted flick
  rule still fails both engines; under CPU throttling the old test failed at 8x, 10x
  and 12x where the new one passed.
- Codex on c1b2301: nothing real (the read-back matches the shelf's decision for these
  gestures; a regression that stops flicks still fails). The gate on c1b2301 was
  stopped when the coordinator said `live/people` had moved: merged 58e75fe (23bbcf2,
  clean, openInvite and sync.js only — the menu's rebuild path untouched) and gated
  the merged head once instead.
- Gate on 23bbcf2 (load average up to 19 during it): unit 1203 of 1205 at UTC, Tokyo
  and the night clock (the stamp red, 1 skipped); browser 288 of 289 (the WebKit Tab
  skip), 0 failures. Sent to the coordinator with the review page republished.

## Kevin's second round (answers relayed ~10:15 AM) — the pick-up brief written at the false wrap (~10:50 AM)

Kevin's answers, via the coordinator: ship as soon as the gate is clean, even Sunday, after
the people menu; tomorrow-only peek, no history entry, tucked faces, grown cards, head tap,
crossfade and cover all as built. Four changes asked for; one is built.

1. **Built — rule 3's trip** ("move only for something better, never back"): `slicesOf` in
   `js/v3/plan.js`; what it moved and why is in the model log's "Rule 3's trip". Unit 1205
   of 1207 at UTC (the stamp red, 1 skipped). NOT yet gated at Tokyo, the night clock or
   the browser suite, and not Codex-reviewed.
2. **Not built — every filter reaches NOW and the plan** (Kevin on op-nowtab: "I don't get
   it. But the filters should filter the now too"; the coordinator: the Show menu's rooms).
   a. Room folds already reach both: the plan seats bodies first and shows only what the
      fold shows (rule 8), and the dock's NOW walks the rendered wall. Pin it with an app
      test (hide Afters: the peek never names a Public Works stop, the dock NOW never lands
      there).
   b. The people highlight is the gap: the plan ignores it, so with "just Ross" on the peek
      can promote a stop Ross is not at while the wall dims that card. Recommended design:
      stops and forks with none of the highlighted people dim like wall cards; the peek
      looks only at stops that include one of them (NOW if the current stop does, else
      NEXT among those); drop the `!(ctx.filterPeople || []).length` exception in
      `paintNowTabs` (app.js) so there is always one NOW — the dock's NOW comes back only
      when the peek is not saying NOW, filtered to the highlight as today. Then replace the
      model test "the people filter is not an input" with the filtered view's tests.
   c. The review page's op-nowtab gets one line: "Every filter reaches NOW: hidden rooms
      never appear in the plan, and with a highlight on, the plan dims stops without those
      people and the peek names only stops they are at."
3. **Not built — floating cards sit where the NOW card sits** (Kevin: "all the cards like
   that should be lower right justified in the same spot as our now… or centered… where
   that card floats right now is so awk"). Inventory first: `#welcome-card` and the
   bring-your-picks offer (`.bring-offer`) at least. Laptop: the corner card's spot (right
   and bottom 20px in); phone: where the peek rides above the dock. Centre only if the
   corner fights the zoom or the Spotify pill.
4. **Not built — big titles mean "most of us" only** (Kevin: the show title's size should
   only ever say "a bunch of the crew will be there"; NOW has its own signals). The rows
   already size by tier (`.plan-row.some .nm` is 14.5px, most is 17px); the grown NOW
   card's name is 17px whatever its tier (`.plan-grow .sheet-card .f-name` in
   `assets/v3.css`). Make that follow the stop's tier, and check the peek and the laptop
   corner card for the same leak.
5. **Then the gate** as before: `npm test` at UTC, Tokyo and the night clock, `npm run
   test:browser`, Codex Sol high with real findings fixed, a Sonnet real-input walker for
   2–4, frames re-rendered; the head SHA goes to the coordinator, which merges, stamps and
   ships after the people menu. `live/people` has moved to 6178e38 since the last merge;
   merge it when the coordinator says so.

## Kevin's second round, resumed (~11 AM — the wrap note was not meant for the builds)

The coordinator relayed Kevin: the pasted wrap note "confused a bunch of yall"; op-ship
stands ("ship as soon as the gate is clean, even Sunday"), released after the tap change,
the people menu and the wall's left-edge fix. Built from the brief above:

1. **A highlight filters the plan and its NOW** (0c9f85f). `hasAny` in plan.js (a stop's
   whole timeline, a fork's peak crowd) and `peekOf(…, { people })`: NOW only for a stop
   the highlighted people are in, else their next stop (MOST first), else their next
   night's, else no peek. Rows, grown cards and forks none of them is in dim (`.dim` on
   the row's content, `--plan-dim: .28`, the wall card's value; the row's own opacity
   stays the window's), faded in place by `play()`. `paintNowTabs` lost its highlight exception: one NOW always — the
   dock's comes back exactly when the peek is not saying NOW, as "what is on for Gus".
   On Portola Sat 9:40 PM, Gus highlighted: NEXT The Great Northern ~1:30 AM, Dog Blood,
   Soulwax and Public Works dim, his Warehouse and Audio forks stay bright (forks are
   never the peek). The op-nowtab one-liner, for wherever it is shown: "Every filter
   reaches NOW: hidden rooms never appear in the plan, and with a highlight on the plan
   dims stops without those people and the peek names only stops they are at."
2. **The welcome-style cards wait in the corner** (e5f3bde): on >=720px `.bring-offer`
   (the welcome card and the bring-your-picks offer — the only floating cards; the
   new-build notice is an inline strip, toasts stay centred) takes the corner card's box,
   right and bottom 20px, 380px wide. The phone is unchanged (the cards already share the
   strip above the dock with the peek). A browser test holds the box in both engines and
   that the corner card rises in the same place. It found a WebKit notice that predates
   this change ("ResizeObserver loop completed…" as the card leaves and the plan arrives,
   the same with the card centred): the test filters it the way errlog.js already drops
   it as noise.
3. **A big name means most of us** (e5f3bde): the grown card carries its stop's tier, and
   a SOME stop's card name is 14.5px (the SOME row's), NOW or not.
4. Frames: P-highlight-gus-390, P-highlight-gus-open-390, D-highlight-gus-open-1280 added;
   D-welcome-1280 shows the card in the corner. No review-page republish (Kevin: "good to
   wrap without artifacts").
5. Merged `origin/live/people` at 139c0a7 (e3c6b1b, clean); `origin/main` had nothing new.

## Gate, round three (2026-09-26, ~11:00 AM–)

1. **The first gate on e3c6b1b** (three clocks, the browser suite 290/290) had one real
   red: `tests/wall-filters.test.mjs`'s "one .dim rule" counted every `.dim` in v3.css,
   comments included, so Our plan's own dim broke it. The test now reads selectors with
   comments stripped and allows only Our plan's `plan-*` classes besides `.card.dim`;
   the plan's dim took the wall card's .28 (04e6c6a).
2. **Sol, first pass** on the round (26f7432, 0c9f85f, e5f3bde), four findings, all fixed:
   a. The trip weighed a room by its best pick until the last pick there ended, so a
      finished must held people in it. Now `levelAt` (not over yet) and `worthTheTrip`
      (a pick they would catch). The model log's "Rule 3's trip" item 5 has the numbers
      (f06d651).
   b. The "never back" test could not fail: nothing drew the crew back to the site it
      left. It now has a Club pick that every other rule would return for (f06d651).
   c. The Spotify scan pill sat under the welcome / bring-picks card: in the laptop's
      corner (this round's move) and above the phone's dock (older). `measureOffer` in
      foot.js writes `--offer-top`; the pill stands above the card. Two browser checks
      (c28784c).
   d. The model log claimed hidden rooms pull fewer people off the grounds; corrected.
3. **Merged `origin/live/people` 6cea2e2** (v99, which carries main's v98, the tap
   change) at 33f62bf. app.js: both blocks kept (Our plan's cache, the hold's click
   eater); `tests/browser/stack-row.test.mjs` took people's side (the tap opens a shelf,
   no zoom). A finger's tap and a bare `el.click()` open the card's shelf now, so the
   plan's shelf test picks Dog Blood with a mouse's click (b2c9d27).
4. **Sol, second pass** on the fixes and the merge: the approach holds (no hole found in
   `levelAt`/`worthTheTrip` across rooms, parties, missing ends and first placement).
   Two findings:
   a. The dock's resize path re-measured the floor but not the waiting card, so a dock
      that changes height while a card is up left the pill's number stale. Fixed: the
      card stands on the floor, so `measureFoot` measures it too.
   b. **Banked, a product call:** a grown card inside the plan has no tap. Before the tap
      change nothing in the plan picked either, but now the wall's cards open a shelf
      with − and +, and the plan's cards, which look the same, don't. Wiring a finger's
      tap on a grown card to the same shelf (over the plan, Back closes it through the
      router) is a new behaviour on an approved surface, so it goes to Kevin, not into
      this release.
5. **Merged `origin/live/people` 7087828** (the coordinator's fix for a people test that
   failed on 6cea2e2 itself: a fading menu's footprint eats a quick second tap, which had
   fallen through onto a card and opened its shelf) at 673123d, clean.
6. **The gate on 673123d:** three clocks 1246/1249 each (the service-worker stamp only,
   the coordinator's at release), browser 339/340 (one skipped, none failed). The
   earlier run on b2c9d27 had the people test above and one show-links case that passed
   alone (load).
7. **The walk** (a Sonnet walker, real input, 5ddb33e — 673123d without the menu fix,
   which touches nothing it walked; brief and screenshots in the session's scratchpad).
   It scored 13 pass / 14 fail, and every fail was the walker's own check, each
   re-checked by hand or by a probe with real input in both engines:
   a. Highlight Gus: NEXT The Great Northern ~1:30 AM, 4 of us; the dock's NOW back; Dog
      Blood, Soulwax and Public Works dim, his Prospa and Audio forks bright, the Great
      Northern's own fork dim (the walker read that fork's key as the stop's).
   b. Clearing: with a highlight on, the avatar gives way to the pill, so `#dock-you` has
      no box (the walker's "null x"); the pill's ✕ clears it, and the peek is back at NOW
      Dog Blood, 8 of us, nothing dim, the dock's NOW hidden (Chromium and WebKit).
   c. Tonight's stops read, in order, exactly the golden Saturday (the walker counted the
      "or" fork rows as stops).
   d. Grown names: Dog Blood (most) 17px, Soulwax (some) 14.5px, both engines.
   e. A finger's tap on Tove Lo opens its shelf over the peek, picks nothing ("A tap opens
      the card now — pick with + here").
   f. The welcome card above the phone's dock and in the laptop's corner, 20px in, 380
      wide; "Look around" raises the plan in the same place.
   g. The laptop: a zoom beside the panel stays left of it (872 against 880); Escape
      closes the zoom, a second Escape the panel.
   No page errors in any run.
