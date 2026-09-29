# The two browser reds on main after v105 (2026-09-29, Tue)

Branch `fix/webkit-reds` off origin/main 1c97b25. Evidence carried from
`claude-plans/2026-09-27-test-flakes.md` on origin/fix/zoom-still-hand-glide (42846b6) and
origin/fix/list-hold-minus (798fc92).

1. zoom-still-hand "NOW glides the wall under a still mouse" (WebKit, Linux CI).
2. list-view "Chromium 1280 mouse, room above to hold by: un-pick A, then B".

## Log (appended as I go)

- Started. Read both branches' notes (identical doc on each).
- **List-view red is a real laptop bug** (probe: a copy of the test with every
  pointerdown/up/click, zoom grow/close reason, and the leftover leave logged;
  30 runs at a random 100-350 ms offset before the first − on Robyn, Chromium,
  no throttle: 3 failures, three shapes of one cause). When Tricky (un-picked,
  dimmed, let go) leaves while Robyn's zoom stands, `thinFlow` → `repaintWall()`
  restores Robyn's zoom on the fresh card BEFORE `keepWallPlace` scrolls the page
  back to hold Robyn. So the zoom is grown where Robyn sat with Tricky gone and
  the page not yet held: one row (65px) too high. Then either
  (a) the next-frame check "restored under a moved-away mouse" sees the still
  pointer (on the −, which hangs below the resting row) over neither card nor
  zoom and closes the zoom: exactly CI's "zoom gone at step 3, Robyn still
  picked"; or (b) the zoom later snaps back to the card and a click aimed at
  the − lands on the zoom's body (`div.f-grown`), which is a card tap: the pick
  cycles UP (picked → picked ×2; ×3 → must). A person on a laptop stepping a
  pick down watches it jump up, or the zoom vanish under a hand that never moved.
- Every `repaintWall(); keepWallPlace(place)` pair in app.js has the same order
  (fold, unfold, past recompute, the List's thin, the view switch).
- Test (9429c9a): the hold test now rests the hand on the −, clicks that one
  point, asserts the − is under it before every click and that each click is
  one level DOWN; Tricky leaves while the hand rests on Robyn. Red 3/3 on main
  ("the still hand is on its zoom's − (step 1)").
- Fix (099a8e5): `repaintWall({ place, byTime })` keeps the page between the
  render and the zoom's return (and again at the end, where callers kept it).
  All five repaint-then-hold callers pass the place. Test green; probe 0/30 at
  random timings (was 3/30), 0/2 at 4x CPU + 800 ms late; the − stays on the
  same pixel (555 → 554) through the leave.
- Branch CI run 36623791770 (4ec95f4): browser job GREEN (both engines, the
  list-view hold test included; main's still-hand WebKit test passed this time,
  which is the flake's nature); checks red only on the SW stamp (expected: the
  coordinator stamps at release).
- Local gate on 4ec95f4: `npm test` 1351 pass / 1 fail (stamp); Tokyo 1351/1
  (stamp) — one earlier Tokyo run also failed two tap-shelf tests ("Escape
  closes the shelf…", "a crew-mate's repaint redraws the shelf's card in
  place…"), which passed 3/3 alone and on the full re-run: a load flake, noted
  as a finding, not chased; NIGHT_CLOCK 2026-09-30T02:30Z 1351/1 (stamp);
  validate-festivals 0 errors.
- **Still-hand, local**: WebKit with LATE_ANIMATIONS_MS=800 and main's fixed
  400 ms beat: 2/2 no glide. The click lands inside NOW's measured box
  (x 144..177, the tab mid-slide to 165..198) but WebKit hit-tests the rail
  (`div#day-rail`) there: the box a transform animation draws is not the box
  WebKit's hit test uses while the slide is held. So clicking during the
  slide misses NOW; the branch's `motionDone` wait fixes that locally (0/6 at
  800 and 1500). The residual CI failure (click after motion, no glide) does
  not reproduce here in 36 WebKit runs at three aims: throwaway branch
  `probe/webkit-reds` runs 40 instrumented glides on CI (every pointer event,
  NOW's state each frame, what is under the aim point, running animations,
  jumpToNow entry/target).
- **Still-hand, CI probe (run 36624973677, probe/webkit-reds, full suite
  alongside):** main's fixed-beat aim: 1/12 no glide, and main's own test red
  again in the same run. The failing run logged it: 458 ms after the Ross
  click NOW's slide was still pending at its start (`transform: matrix(1,0,0,1,
  -21,0)`, every animation `running/pending`), `elementFromPoint` at NOW's
  drawn middle = `div#day-rail`, click went to the rail, jumpToNow never ran.
  Aims that waited for the rail's motion (`motionDone` on #day-rail, middle or
  above-a-column): 0/24. Chromium 0/4. So it is the TEST clicking mid-motion,
  not a lost click: while a slide is held at its start, WebKit draws NOW 21px
  left of where its hit test puts it. Not a laptop bug in practice (see the
  findings), fixed in the test.
- Test (a69d14a): `aimAtNow` waits for every finite animation on the page,
  NOW shown and not leaving, and a point on NOW above a card column that
  `elementFromPoint` gives to NOW three frames running; `glide` asserts the
  page moved; `openWall` takes lateStarts. Red first: main's test at
  LATE_ANIMATIONS_MS=800 failed 4/6 (both engines, CI's exact message). Now
  6/6 at 0, 800, 1500 and 36/36 over six more runs.
- list-view (2bf1b33): `open()` takes lateStarts; at 800 ms three phone cases
  were red on main's app code too (fixed 250 ms − taps on a rising shelf; a
  second tap on the past's line mid-arrival). They wait for the motion and for
  the pick to change now: 20/20 both engines at 0 and 800.

## Findings outside the lane

1. tap-shelf.test.mjs: "Escape closes the shelf and hands focus back to the
   card" and "a crew-mate's repaint redraws the shelf's card in place: a
   key's focus on + survives it" failed once in a full `TZ=Asia/Tokyo npm
   test` run, passed 3/3 alone and on the full re-run. A jsdom load flake;
   not chased.
2. WebKit hit-tests a held (not yet started, backwards-filled) transform
   animation at the element's resting box, not where it is drawn. In the app
   any `delay` + `fill: 'backwards'` slide has that window on Safari (NOW's
   arrival, STAGGER_MS); it is tens of ms on a real machine, so no fix, but a
   test must never click something mid-slide in WebKit.
3. The welcome-card WebKit 1280 flake (the 09-27 notes' item 3) did not
   appear in this branch's or the probe's runs.

## Gate (head cb3017b + this log commit)

- CI run 36627536174: **browser job green** — 496 tests, 492 pass, 0 fail,
  4 skipped (the WebKit glides, the slow hand and the List hold all ✔ by
  name). checks job red only on the SW stamp (the coordinator stamps).
- Local: `npm run test:browser` both engines 504 / 502 pass / 0 fail / 2
  skipped. list-view 20/20 at 0 and 800 ms late; zoom-still-hand 6/6 at 0,
  800, 1500 (+36/36 repeats). `npm test` 1351 pass / 1 fail (stamp); Tokyo
  1351/1 (stamp, see finding 1); NIGHT_CLOCK=2026-09-30T02:30:00Z 1351/1
  (stamp) — run as `NIGHT_CLOCK=… npm test`, since npm test already imports
  night-clock.mjs (the harness refused the NODE_OPTIONS form);
  validate-festivals 0 errors, 2 warnings (known empty lineups).
- Throwaway branch `probe/webkit-reds` (4ec95f4 + probe test + DEBUG lines in
  app.js) is on origin; never merge it — delete when convenient.
