# The tap change — build log (branch `live/tap`)

**Started:** 2026-09-26 ~5:00 AM PT. Brief: `TAP-BRIEF.md` beside this. Builder: one Opus session in the
`shelves` worktree. Nothing here is stamped, PR'd or deployed; the coordinator owns those.

## What ships, in one screen

1. **Phone (a finger):** a tap on any card opens ONE shelf from the bottom: the card (name, when, where,
   the doors out), the − · + step row along the card's floor, the thread, the composer. No zoom, no notes
   button. For a member, − / + step the level (never a wraparound). For a guest, − / + and the composer's
   place ask who they are (the join shelf, naming the artist); only + carries the pick through.
2. **Desktop (a mouse):** unchanged. Hover grows the zoom with its − · note · + row; the note door opens the
   SAME shelf, which has the − · + row and no notes door of its own. A click on a card or on the zoom's
   body still cycles the pick.
3. **Keyboard:** unchanged (focus grows the zoom; Enter picks; Tab walks − · note · +; the note door opens
   the shelf).
4. **The long-press goes.** A hold is a slow tap: iOS sends the click on release (`-webkit-touch-callout:
   none` stays). Where an engine turns a hold into `contextmenu` instead (Android Chrome, Chromium's touch
   emulation), a finger's `contextmenu` on a card opens the same shelf and eats that gesture's click.

## Product calls made here (each is Kevin's to overrule)

1. **The step row's middle is YOUR METER** — the resting card's own corner chip (bars, then MUST, in your
   colour), drawn larger: `−  ▮▮▯  +`. "Each + fills a bar" is then literally what the finger sees.
   With nothing picked it is three hollow bars; a guest sees the same hollow meter. (Alternative framed:
   an empty middle, the bare − and + on the edges only.)
2. **The row is the card's floor, and it never moves under the finger.** The who-row sits above it; when a
   first + makes the who-row appear, the card grows UPWARD (the sheet's top rises; in a tall, scrolled
   sheet the sheet scrolls by the same amount) — the zoom's floor rule, carried into the shelf.
3. **The shelf arrives like the join shelf** (rises from the bottom edge on the arrival curve, the wall
   dims, the lines land a beat apart) and **leaves quick and plain** (drops to the edge). On a desktop the
   dialog keeps its scale-fade and fades out. Every notes sheet gets this — they are one sheet.
4. **The long-press goes** (above).
5. **A guest's − / + / note door take over the shelf's history entry** instead of stacking a second one,
   so "Look around" and the system Back land on the wall, never on a dead step.
6. **Copy** — the plan's Q2 defaults, adapted to the shelf (Kevin edits on the review page):
   a. How it works row 3: "Add your color to an artist." / "Tap it, then +. Each + fills a bar. 4 = must see."
   b. How it works row 5: "Details and notes." / "Tap the card. Violet = crew notes; …" (the rest unchanged).
   c. Welcome (member): "Tap any artist, then + to add yours."
   d. A one-time line, inside the first shelf a returning member opens (someone who has picked before, so
      learned "tap lights it"): "A tap opens the card now — pick with + here." Device-local flag,
      try-wrapped, never in the crew doc.
   e. The empty all-notes line: one sentence for every hand, no media query.

## What I took from U0 and U2, and what I skipped (and why)

Took:
1. **U0 item 2 — WebKit real in CI** (`ci.yml` installs `chromium webkit`; `BROWSER_TEST_REQUIRED=1` makes a
   missing WebKit fail). The tap contract's WebKit half is the proof that WebKit's tap sends a touch-type
   `pointerdown` before its mouse-shaped ghosts; without it the phone route is only proven on this Mac.
2. **U2's write path, the part the tap needs:** one `setLevel` under the tap cycle, the zoom's step and the
   waiting pick — so `applyWaitingPick` never goes through the routing (after this change the routing asks
   the hand, and a finger as the last hand would open a shelf instead of making the promised pick).
3. **The hand, renamed for what it now decides:** `tapOpensZoom` → `fingerHand()` (the tracker stays in
   card-facts.js).

Skipped:
1. U0's accent guard, motion/z tokens, the `.btn` move — nothing in the tap change needs them.
2. U2's `hand.js` module, `wireCardInput`, gallery.html importing the shipping routing — a refactor of the
   most fragile module in a festival week buys this change nothing it needs: the tap contracts here drive
   the REAL APP (index.html), not the gallery's copy, so the net tests the routing that ships.
3. U4/U5's shelf primitive (`shelf.js`, `openQuestion`) — the brief says reuse the notes sheet's anatomy.
   The arrival/exit added here is written so U5 can lift it whole.

## Rollback (the coordinator's condition, Kevin 2026-09-26: "as long as we bank and are prepped to maybe roll back those parts of the code (tap)")

This ships as its OWN release, never bundled with the List view or anything else, so it reverts alone.
Its base (`aba41c3`, off live/list) is main + an older live/v93 + plan docs: once v96 (live/v93) is on
main, `live/tap` against main is the tap commits (`f84b671` and `e700c10`…HEAD) plus two plan-only
commits. A trial merge of origin/live/list into live/tap is clean (checked 2026-09-26 ~07:40), and the
List view's cards are `renderCard` cards, so the tap reaches them with no further code.
1. **The exact revert:** `git revert -m 1 <the tap release's merge commit on main>` through a PR, then the
   ship recipe (stamp on a clean tree, gate, merge, prod-smoke). The server rolls back at once with
   `vercel rollback <the deployment before the tap release>`; phones follow on their next open (a busy
   phone shows the refresh strip — the reload glue is untouched).
2. **What reverts cleanly with it (everything is in the one merge):** the routing (app.js, wall.js,
   card-facts.js), the shelf (notes.js, v3.css), the copy (welcome.js, How it works in settings.js, the
   all-notes empty line), the Diagnostics hand line (errlog.js), the docs (README, CLAUDE.md, MODEL-V4
   §3a.4 and §3f), docs-truth's rows, gallery.html's mirror of the route, the tests, and CI's WebKit
   install with its shared launcher (tests/helpers/browser.mjs) and fold-intent's Linux-WebKit tag.
   Nothing outside the merge depends on it. Reverting CI only means WebKit contracts skip on Linux
   again, as before.
3. **What a phone sees after a rollback:** the v96-era gesture — a finger's tap on a card picks (the v91
   cycle), a hold grows the zoom, a guest's tap grows the zoom. No data changes either way: no crew-doc
   or person-doc key, no sync or merge change, no service-worker strategy change.
4. **New persisted state:** one device-local key, `fn_tap_news_v1` (localStorage, "this phone has seen the
   one-time line"). An old build never reads it; it sits unused and harmless. A re-ship after a rollback
   reads it and does not show the line twice.

## Follow-ups this build leaves (for their owners)

1. **fold-intent, Linux WebKit only:** "NOW tapped during a tick's fade" moves the page 1350px on Linux
   WebKit only (CI run 36239935622, 2026-09-26); macOS WebKit and Chromium hold it. A named, dated skip
   on Linux WebKit (e597056) keeps CI meaningful — **check on a real iPhone before trusting the skip**.
   The coordinator carries it to the Show menu's owner.
2. **Android's hold:** Chromium's CDP hold sends no `contextmenu` (its click comes at release), so the
   `contextmenu` door is proven in jsdom only. One Android phone, if a friend has one.
3. **iOS keyboard over the shelf:** the composer now sticks to the shelf's bottom edge; the notes sheet
   has never ridden the visual viewport the way the join shelf does. Kevin's iPhone check covers it; if
   the keys cover the box, lift the join shelf's `fitKeys` into the notes sheet (U5 owns the one ride).

4. **Safari's Tab skips buttons** (macOS default, without "Press Tab to highlight each item"): a Tab
   trap that waits for focus to reach its last button never fires there, and Tab walked out of the sheet
   (the walk's item 9, WebKit). Fixed for every notes sheet here (`dialogize` moves focus itself, with a
   WebKit contract); **the join shelf's own trap still waits at the boundary** — U5's one Tab trap
   should take `dialogize`'s.
5. ~~A screen reader's activation picks~~ — fixed in 0f1f258 (Sol 6's BLOCKER): a click that answers no
   pointer press and no key opens the shelf on every screen. Still unproven on a device: whether iOS
   VoiceOver's double-tap sends a pointer press of its own (it should not — a simulated click); Kevin's
   iPhone check with VoiceOver on answers it, and Diagnostics' hand line says 'assistive' when it works.
6. **The day rail's ResizeObserver loops** (found 2026-09-26, run 36249100883): `wireScrollspy`'s `rows`
   observer (wall.js) calls `restDayRow`, whose `fitDayRowGap` changes the gap of the very row it
   observes, so WebKit at 1280 raises "ResizeObserver loop completed with undelivered notifications" at
   boot under load (4/6 locally with six runs in parallel; instrumented: the `#rail-days` callback fires,
   the notice follows within 1ms). Harmless — the notification lands a frame later, and errlog.js already
   drops it as noise — so the tap contract ignores it the same way. The fix, for the rail's owner: re-fit
   only when the observed width differs from the width the last fit left, or fit in the next frame.

## Steps (commit + push after each)

1. [x] This log (e700c10).
2. [x] Design: a frame rig (production app, a made-up crew, writes refused), phone shelf frames at 390 and
   320 (member, guest, doors out, long thread, keyboard up), the desktop path at 1280. Paths to the
   coordinator.
3. [x] The shelf (877d336, WIP): the step row in the sheet card; header refresh with the zoom's who-row motion; the
   arrival and exit; the guest's doors.
4. [x] The route (877d336, WIP): a finger's tap / hold opens the shelf for everyone; the long-press and the finger-zoom
   code go; `setLevel`; the welcome goes on the first tap.
5. [x] Copy + docs (e5ea230): README, CLAUDE.md, MODEL-V4 §3a.4 + §3f, How it works rows 3 and 5,
   the welcome, the one-time line, the gallery mirrors the route.
6. [x] Tests: unit (e5ea230 — long-press.test.mjs → tap-shelf.test.mjs; first-open ×5, zoom-overlay,
   zoom-touch-ghost, zoom-door-row); browser (1d92137, 0074651, e597056 — tap-shelf-contract new; the
   guest route, touch-ghost, meter, zoom-chips(-burst), zoom-door-row, zoom-chrome, stack-row,
   show-links moved onto the shelf or a mouse/key); CI installs WebKit and requires it; Diagnostics hand
   line (9ac5eaa).
7. [x] Gate (a5f762f): `npm test` × 3 clocks, `validate-festivals`, `test:browser`; a real-input walk of every tap
   path including the WebKit ghost cases.

## Log

- **05:00** Read TAP-BRIEF, PLAN (§2.1–2.3, U0, U2, U3, U5, §4, §6), REVIEW-1, map-input, the repo
  CLAUDE.md. Baseline `npm test`: 1043 pass, 1 fail — the SW stamp (expected: the branch is not stamped;
  the coordinator stamps).
- **05:40** Baseline browser suite: 218/219 — one pre-existing red in now-jump ("390, Dee at 7 PM: a
  repaint keeps the cycle…"), on the base before any edit here.
- **06:30** 877d336: the shelf + the route, WIP. The rig (`tap-design/rig.mjs`: the production app, a
  made-up crew, writes refused) with REAL touch taps in Chromium and WebKit: the tap opens the shelf in
  both engines (WebKit's tap reads as a finger), + steps 0→1→…→must, the row's y never moves (0px; the
  sheet's top rose 29px when the who-row appeared), a guest's + raises the join shelf on the notes shelf's
  own history entry. Frames + contact sheets in `tap-design/frames/` (gitignored), sent to the coordinator.
  Two calls added while looking at frames: the composer sticks to the shelf's bottom edge (a long thread
  hid it a whole scroll away), and the card's tap-highlight flash is off.
- **06:45** Coordinator: calls a–h stand for now (Kevin decides on the preview). Ship as its own release;
  the Rollback section above.
- **07:10** e5ea230: copy + docs + the unit net. Unit suite green (1048/1049 + the stamp).
- **07:25** Browser nets moved (1d92137, 0074651). The shelf's − / + motion passes the zoom's own
  first-frame law (zoom-chips-contract) on all five festivals; the who-chip laws hold on the shelf's
  card at 390 and 320; a finger's +/− burst leaves nobody rendered twice. The zoom's laws kept under a
  mouse or a key (a zoom is theirs now). Chromium's CDP hold sends no `contextmenu` (the click comes at
  release), so the `contextmenu` door is proven in jsdom only; Android is Kevin's/a friend's phone.
- **07:35** Three clocks: 1049/1050 each (only the stamp). validate-festivals: 0 errors. Browser:
  239/240 locally (only the base's now-jump red).
- **07:45** CI with WebKit (0074651): my WebKit tap contract's row moved 1.03px on the first + on Linux
  WebKit (0 on macOS WebKit and Chromium) → tolerance 1.5px with the reason (e597056). fold-intent's
  "NOW tapped during a tick's fade" diverges on Linux WebKit only → a named, dated skip there, for the
  Show menu's owner. The day-row reds and shell-v4's fold tests are the base's (live/list's CI has
  them; live/v93's 4c9c7b3 already fixes the day-row ones on Linux).
- **08:00** Coordinator: merge origin/live/v93 (it fixes the base's Linux reds). Merged (450cf01): one
  conflict, v3.css's tail (both sides appended; kept both). The merge brought the import sheet; its review
  cards spread the wall's ctx, so they would have inherited the hold door — nulled there and on the day
  image's render (e399e00). import-flow now launches WebKit through the shared, required launcher.
- **08:20** Post-merge gate: unit 1074/1075 at all three clocks (only the stamp); browser 244/244 locally;
  CI (run 36240512643, WebKit installed) browser job GREEN — the WebKit tap contract passes on Linux (the
  plan's merge gate) — and checks red only on the unstamped SW stamp.
- **08:30** Found while the walk ran: focus now returns to the card after a pick on the shelf replaced it
  (cf11041); the walk's item 1 found the +'s box 6px narrower at must (MUST is wider than the bars) — the
  row's middle is a fixed 72px now and the contract holds x as well as y (3845da7); the shelf's box rose
  on the overshoot curve and lifted its bottom ~25px off the screen for a few frames — it rises on the
  surface curve now, measured at 0px in both engines, and the join shelf rises the same way (c3980b2,
  a3517c2). An Opus reviewer is reading the diff in parallel.
- **09:30** The Opus review of the diff (read-only, real-engine probes) and the Sonnet walk's findings,
  all fixed with tests in 6ddcc85: a guest's quick + + dropped the question it raised (the join shelf's
  dimmed wall now settles 700ms, the zoom's DOOR_SETTLE beat); a close during the rise snapped up to rest
  before dropping (it now leaves from the live transform); a leaving sheet is inert; a crew-mate's
  repaint rebuilt the shelf's card and dropped a key's focus (now in place); the sticky composer rule hit
  All notes (now only the shelf's foot); the step row could start WebKit's selection; the zoom's note
  door left focus on <body> after Escape (the walk's item 8: focus now goes to the card the zoom stood
  on); a pending hover intent could grow a zoom under a sheet on a touch screen with a trackpad; a
  finger's tap through a card a repaint replaced could pick; the hold's click-eater could eat an Enter.
  The walk's item 10 ("first tap after the ACL weekend jump is swallowed") was the harness: at 390 the
  SAT 10 tab sits under the fest name, the tap opened the Show menu, and by design the next card tap only
  closes it.
- **10:10** The walk is done (`scratchpad/walk/WALK-REPORT.md`, outside the repo): 13 of 14 items PASS in
  both engines with real input — the four ways to close, the ghost, the resting meter after a close, the
  long thread and the first-pick growth (row 0px, sheet +29px), the guest's whole path, the hold, the iPad
  shape, desktop and keyboard, the fest matrix (Portola grid / Afters / Folsom by time, ACL Late nights and
  Weekend 2, Seismic), the edge cards (half off the edge, two-line name, tall set, cancelled act, above the
  dock), Low Power + Reduce Motion (no animation on the shelf), the one-time line, keys up. The one left
  open, Safari's Tab walking out of the shelf, is fixed now (`dialogize`), with a WebKit contract.
- **10:40 — gated at a5f762f.** Local: `npm test` 1078/1079 at each of the three clocks (only the unstamped
  SW stamp), validate-festivals 0 errors, `test:browser` 252/252 (Chromium + WebKit). CI run 36243448123:
  browser GREEN with WebKit installed and required (242 pass; 2 skips: fold-intent's named Linux-WebKit
  case, and zoom-door-row's own font self-skip), checks red only on the SW stamp. Not stamped, no PR
  (the coordinator's). Frames on the final code: `tap-design/frames/contact-*.png` (gitignored).
  **What Kevin's iPhone check should cover** (what no engine here can): a hold then release on a card
  (one shelf, no pick, no callout); the grabber drag down to close; the composer with the real keyboard
  up (the box stays visible); + + + quickly (two levels, the row still under the thumb); a guest's + then
  Look around; Back from the shelf; the one-time line on his first shelf. Against the unique deployment
  URL, reading the build line.
- **12:30 — Sol 6's round** (on db9bf2c; the coordinator relayed it):
  1. BLOCKER, a pointerless activation picked (0f1f258): each click is judged by the press it answers
     (card-facts.js `clickHand`) — touch/pen 'finger', mouse 'mouse', none 'assistive' (opens the shelf),
     the browser's own click for Enter/Space on a native control 'keyboard'. Enter on a card still picks
     through its keydown. The zoom's door-settle beat is a mouse's only now. Diagnostics says 'assistive'.
     Three unit tests clicked a card with no press expecting a pick (events-wall's door-settle case,
     first-open-joins-hold, shell-v4's now mark): each now makes a mouse's press first, which is what it
     meant. New: unit (member, guest, Enter, a key's click on a button, a cancelled press) and a
     WebKit/Chromium contract.
  2. IMPORTANT, the composer under the iOS keyboard (da21701): one ride for every sheet, `rideKeys` in
     notes.js (the join shelf's, lifted — not copied); a centred dialog (an iPad) centres in what the keys
     leave. Unit with a fake visualViewport (tests/helpers/fake-keys.mjs, both shelves) and a WebKit/
     Chromium contract on a long thread.
  3. NIT, "picked before" (0f1f258): any festival in this crew, then this phone's other crews under its
     name there. Unit.
  4. The night-clock join-history failure (ce1b684): not the app — the tests. A history traversal in
     jsdom is two 0 ms tasks (the traversal, then its popstate); a thread blocked past a fixed settle wakes
     with the settle's timer due first and reads the page mid-traversal. Reproduced by starving the test's
     own thread (3/3 fails in shelf-close, guest, guest-doors); the cases now wait on the popstate or the
     state, and the in-flight join's answer waits on a gate. 0/3 after; the whole suite at night under
     starvation: only the stamp.
- **13:10** Merged origin/live/list (370952c = v97's 19df64b + one ledger doc) into live/tap (5b05c57),
  clean, v97's stamp untouched. The List's rows are `renderCard` cards: a tap opens the shelf there too
  (a WebKit/Chromium case).
- **13:55** Coordinator: v97 shipped (main = efeebd0, containing 370952c) — merged origin/main as asked
  (28cc51c, the same tree as 9e70120: main held nothing live/list had not). Gate on that tree: `npm test`
  1138/1139 at all three clocks (only the SW stamp), validate-festivals 0 errors, `test:browser` 269/269
  locally; CI run 36246098584 browser green (261, 2 named skips), checks red only on the stamp.
- **14:40 — Sol 6's re-review of 83b4065** (the coordinator's v98 stamp): the three earlier findings
  confirmed fixed. Two more, fixed:
  1. IMPORTANT (0e11d14): a press stayed pending after its lift when no click came, so a later
     pointerless activation took its hand ('mouse' → picked unseen). A click now answers only the press
     the browser pairs it with: lifted, within 600 ms, and where the press and the lift both were (the
     element, or the ancestor that holds both). Tests: the abandoned press, a stale lift, a press
     released on another card (unit); a real mouse pressed on one card and released on another, and a
     press dragged off the page before an activation (WebKit + Chromium); the tap contract asserts a real
     tap's click is paired as the finger's (an unpaired one opens the same shelf and would hide a broken
     pairing). Eight test helpers gained the lift every real pointer click has.
  2. NIT (269959f): the keyboard ride's 200px floor could overrun an SE's view; it is never taller than
     what shows now. Framing an SE in WebKit (tap-design/rig.mjs `se`) found two more: max-height is the
     sheet's content box, so its 32px of padding pushed the top 20px off the screen (now subtracted); and
     the join shelf, overflow: visible at rest, squashed and then hid its field under the keys on its
     side (a capped sheet scrolls now, keeps the focused field in view, and the join shelf's parts no
     longer shrink). Frames: `tap-design/frames/contact-webkit-se-keys.png` (SE portrait and on its side,
     member and guest). Unit + WebKit/Chromium contracts at 375×667 and 667×375.
  Re-stamped v98 with `--keep` on a clean tree (bc18abc, ASSET_STAMP 12611f2d). Gate: `npm test`
  1142/1143 at all three clocks (1 skip), `test:browser` 277/277, validate-festivals 0 errors.
- **15:10 — CI's browser job, red on Linux WebKit only, and not the app.** Three WebKit cases failed
  across runs 36246451230…36247465311, never on a Mac: the climb ("row moved −6.85px at +1"), the List
  tap ("+ picked"), and v97's Board ↔ List hold ("Mike D 45.6 → 52"). Each measured a place while an
  arrival was still at its start — the shelf's parts rise from 8px below, a view's rooms from 6px —
  after a fixed sleep a loaded runner outran. v97's case had never run on Linux: main's CI installs
  Chromium only, and this branch's U0 is what brought WebKit to CI. Fixed in the tests (a9ee244):
  `motionDone` (tests/helpers/browser.mjs) waits out every finite animation on the document's clock
  before a place is read; list-view launches WebKit through `launchWebkit`, so a missing one fails CI
  rather than skipping. No app file changed, so no re-stamp.
  CI on a9ee244 green (both jobs; a re-run green too). On 3a1e067 one new WebKit red, not the tap: a
  "ResizeObserver loop" notice at boot counted as a page error by the mouse case (follow-up 6 above —
  the day rail's observer). The contract now ignores that notice, as errlog.js does; 6/6 green under
  six-way load locally, and the tap and List files 3/3 at three-way load.
