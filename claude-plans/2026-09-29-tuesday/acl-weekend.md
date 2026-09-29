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
