# ACL weekend one — last set's end + the dock's first-paint day (2026-09-29)

Branch `fix/acl-weekend` off main 1c97b25 (production v105). Builder log,
banked as I go.

## Task
1. LEDGER follow-up 20: a stage's last set of the day with no printed end
   runs to the day's close (published close for that day, else latest printed
   end on any stage that day), marked approximate. One place feeds grid height,
   ring/NOW window, Our picks' stops, Share text.
2. The dock's day row lights the wrong day (FRI) for ~1s on open before
   settling on today (SAT). First paint must land on the right day.

## Findings

### 1. The headliners' ends (read 2026-09-29 morning)

- One place already computes every grid set's window: `js/time.js
  computeDayArtists`. The wall's grid (`state.getDayArtists` -> height, the
  cell's `data-now-to`), the List's rows (`festRoomListEntries` win), Our
  picks (`plan.js weekPlaces` calls computeDayArtists itself, with a copy of
  getDayArtists' weekend filter) and the Share (planText reads the plan's act
  ends) all read it. Today a stage's last set with no end gets a flat 75 min.
- ACL's data: every endless set is a closer (Skrillex / Kings of Leon 8:15,
  Charli xcx 8:40, Lorde 8:15, RUFUS 8:30, The xx 8:30, Twenty One Pilots
  8:30). The latest PRINTED end on any stage, every ACL day and weekend, is
  8:30 PM — at or before the headliners' starts. So the brief's fallback
  ("else the latest printed end on any stage that day") cannot help ACL: taken
  literally it would cut Skrillex to 15 minutes and The xx to zero.
- The file has no `dayMeta.<day>.close`. No festival file uses one yet; the
  wall already reads it (`renderScheduledDayBody` dayEnd) and the validator
  never checks it. ACL's own meta note records the published close: posters
  run "12:45 PM to 10 PM", CultureMap 2026-08-17 "the AmEx headliner finishes
  at 10 PM".
- Decision: the rule runs a closer to the published close when the file has
  one; the latest printed end is a floor, so it can only LENGTHEN a closer
  past the default, never shorten it; and only a set in the closing slot (it
  starts no earlier than every set with a printed end has started) runs to the
  close, so a small stage whose last endless set is at 3 PM keeps its default
  instead of running seven hours. Every end we did not read off the poster is
  marked `endApprox`, and a "till" that reads it wears the tilde ("till ~10 PM").
- CONSEQUENCE, needs the coordinator: for ACL to benefit before Oct 2 the file
  needs `"close": "10 PM"` on dayMeta Friday / Saturday / Sunday (a published
  fact already quoted in the file's meta note). I was told not to edit the
  festival JSON, so this is handed back as a paste-ready data change.

### 2. The day row's first paint (probes 2026-09-29)

- Cause, read in the code: `renderDayNav` wires the scrollspy
  (`wall.js wireScrollspy`) INSIDE `repaintWall`, and the spy claims a day at
  once — before the caller places the page (`maybeOpenOnDay` on open,
  `keepWallPlace` after the day turns / a fold / a resume). At scrollY 0 it
  claims the first block on the wall with no re-read; the landing's scroll
  event fixes it later. At scrollY > 0 it claims from geometry of an unplaced
  page and re-reads next frame. Either way the provisional claim also starts a
  smooth glide of the row toward the wrong day.
- Probes (scratchpad flash-probe*.mjs, sampling each frame start and after
  each paint via a MessageChannel post): on v105 an ACL open on Saturday no
  longer PAINTS FRI in headless Chromium or WebKit — Friday is over by then and
  folds away (Phase 1), so the first block is SAT. But the provisional claim is
  still there: the day turning under an open Portola page (Sat -> Tue, the
  v104 builder's case) starts the next frame with FRI lit in both engines
  (fixed before that frame paints, by the spy's own rAF re-read), and an ACL
  open at 11:30 PM (landing in LATE) starts with SAT lit until the landing's
  scroll event arrives. On an engine whose scroll event arrives after a paint,
  that provisional day is what paints — the ~1 s flash.

## Built

### 1. Closers run to the close (commits 271431c, d05e027)
- `js/time.js`: `computeDayArtists(dayData, { close })` + `daySetsOf(fest,
  day, weekend)` + `playsWeekend`. `state.getDayArtists` and `plan.js
  weekPlaces` both call daySetsOf now (plan.js had its own copy of the
  weekend filter). Every set carries `endApprox`.
- `plan.js tillApprox` + `plan-rows.js`: the NOW row and the Share's "now
  till" wear `~` when the till is an end the poster left off.
- Validator: `dayMeta.<day>.close|doors` must be one clock time; a close no
  set starts before warns. Doc: docs/add-a-festival.md.
- No festival's windows change today (diffed every file old vs new: zero
  endMin changes, because no file has a close yet and ACL's latest printed
  end never beats the default). What changes today: the tilde on inferred
  "till"s — ACL has 12 inferred ends, Electric Forest 199, Lolla 2025 one,
  Portola none (its goldens are untouched). One ACL golden moved:
  "SOME The xx T-Mobile NOW till ~9:45 PM".
- Red first: tests/day-close.test.mjs run against origin/main's js/ (with a
  shim exporting the old behaviour as daySetsOf): 8 of 10 red at the time
  (the 2 green were cases whose answer is the old default). The Board test
  and the validator test were added after and fail on old code by
  construction (nowTo 1290, no close error).
- The till parsers in plan-stop-ends / plan-text accepted only "till 9:45";
  they now accept "till ~9:45" (otherwise the sweeps silently skip the line).

### 2, reproduced PAINTED (tests/browser/day-row-first-paint.test.mjs, red on 1c97b25's js)
- Under page.clock (the suite's clock) the wrong day is painted, both engines:
  ACL opened Sat Oct 3 11:30 PM paints SUN 3 (W1 — the first block left on
  the wall once Saturday's grid is over) for ~600 ms in Chromium and ~1 s in
  WebKit, while the page already stands in LATE (y 6813, the LATE block's top
  at -2226, --jump-offset 6px): the spy claimed at scrollY 0 before
  maybeOpenOnDay scrolled, and the landing's scroll event never re-read it —
  the fix came only when the late font landed and something re-read. That is
  Kevin's "FRI for about a second": before Phase 1 folded a finished Friday,
  FRI 2 was the first block on an ACL Saturday.
- The Portola day turn (Sat -> Tue on visibilitychange) paints FRIDAY for a
  frame in both engines before the held place is read back.
- The brief's own case (ACL Sat 3 PM) is green on old code today: Friday is
  folded, the first block IS Saturday. Kept as the control.

### 2. Fixed (commit 6a623e3)
- `wall.js wireScrollspy(containers, root, { was })`: the tab lit at wiring
  is the day the rebuilt row was showing (`was`, read by app.js renderDayNav
  before it removes the tabs), with no glide — or, on a fresh open, the first
  block, which is never painted. The real claim is a MICROTASK: it runs after
  the task that drew the wall has also placed it (maybeOpenOnDay /
  keepWallPlace are synchronous after repaintWall in every caller I found:
  boot, closeSettings, recomputePast, the fold's finish, the view switch) and
  before any frame. Geometry reader shared (`dayAtGeometry`); a disposed spy
  never claims; the next-frame re-read at scrollY > 0 stays (Codex r4).
- Row motion: a fresh row (no `was`) and an unchanged day rest with 'auto';
  only a real change of day glides. Before, the open glided the row in from
  its start (probes: row 0 -> 97 on an ACL Saturday, 168 -> 185 -> 120 ->
  361 on the 11:30 PM open); now the first painted frame is at rest (361).
  That is a visible change at open — a walker should look at it (design
  call: I think a row nobody has seen yet should just be where it rests).
- Unit tests: wall-filters' two spy tests await the microtask; new cases for
  `was` (shown until the claim) and a disposed spy.
- Browser: tests/browser/day-row-first-paint.test.mjs 6/6 green on the fix
  (4 red on main: the 11:30 PM open and the day turn, both engines).

## Gate (2026-09-29, on the branch head after 6a623e3)
- `npm test`: 1366 tests, 1363 pass, 1 skipped, 1 fail = the service-worker
  stamp (left for the coordinator, as briefed).
- `TZ=Asia/Tokyo npm test`: same, 1363 / 1 skipped / stamp only.
- `NIGHT_CLOCK=2026-09-30T02:30:00Z npm test` (the npm script imports the
  night-clock helper itself): same, 1363 / 1 skipped / stamp only.
- `node scripts/validate-festivals.mjs`: 0 errors, 2 warnings (both
  pre-existing: Flight by Nothing with no set; Tomorrowland's empty lineup).
- Browser, Chromium + WebKit: day-row-first-paint, now-jump, people-menu,
  shell-contract, heads-contract = 110/110; plan-acl, plan-share,
  plan-stop-ends, list-view = 73/73; with LATE_ANIMATIONS_MS=800
  day-row-first-paint, now-jump, people-menu = 92/92.

## Findings for the coordinator (outside my lane)
1. DATA, needed for item 1 to help ACL: add `"close": "10 PM"` to
   `dayMeta.Friday`, `dayMeta.Saturday`, `dayMeta.Sunday` in
   data/festivals/acl-2026.json (source already in the file's meta note:
   posters "12:45 PM to 10 PM"; CultureMap 2026-08-17, the AmEx headliner
   finishes at 10 PM). The validator accepts it (tested). Goldens that will
   move when it lands: tests/plan-acl.test.mjs (Skrillex / Charli xcx /
   Lorde / RUFUS / The xx / Twenty One Pilots stops and forks run to 10 PM;
   "SOME Charli xcx American Express 9:30 PM" becomes a different split) and
   possibly the browser plan-acl Share goldens — rerun with PLAN_ACL_PRINT=1.
   Also re-check no Late-night guess (guess-run-times) reads a grid close.
2. The zoom still says a headliner's time as printed ("8:15 PM"); it could
   say "8:15 PM – ~10 PM" like a room with a guessed close. Product call.
3. The open no longer glides the day row in from its start: the first paint
   is at rest. A walker should look at it on a phone.
