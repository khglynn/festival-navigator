# v104 walk log — independent, real input (2026-09-26)

Run against `live/v103` head `bfcf621` (worktree `.claude/worktrees/v103`), using
the builder's rig (`v103-rig.mjs`) as the base. Never production, never a real
crew link — two invented crews (`design`, `sparse`), every write refused and
counted, every other host aborted, the service worker blocked. Walk script:
`v104-walk.mjs` (beside this file). Screenshots (FAIL/UNSURE only) in
`v103-shots/walk-*.png` (git-ignored).

*A first pass caught two bugs in this walk script itself before they became
false findings, fixed before the results below: the "tap NOW jumps the wall"
check used the phone's `#dock` as the floor for the desktop rail too (it's
`display:none` there, so the check always failed at 1280 — fixed to use the
viewport when the dock isn't shown); the swipe distance was a fixed 140px,
which under-swiped at 320 (needed ~132px plus slack, and a touch-drag's
effective scroll trails the finger a little) — fixed to swipe the row's own
`scrollLeft` plus margin. Item 3 also originally compared the List's
already-past-folded row count (25) against the Board's un-folded count (32)
for the "same" room — not a real mismatch, since the List folds expired sets
behind EARLIER and the Board never does (CLAUDE.md); fixed to compare Board
against itself (highlighted vs cleared).*

Results appended below as each check finishes.

## 1. NOW in the day row — PASS
Chromium 1280/390/320 + WebKit 390/320: NOW is the row's first item and stays first (idx 0) across SUN/SAT; whole on the rail, and at 390/320 the active day (SAT) stays whole while NOW rests past the edge; a real finger swipe brings it fully into view; a tap lands the now line between the strip and the dock on every width/engine.

## 2. NOW when Our picks' peek carries it — PASS
Chromium + WebKit 390, design crew, Sat 10:30 PM: with nobody highlighted the peek carries NOW ("OUR PICKS ... NOW") and the day row's own NOW stays hidden (one-NOW rule holds); highlighting Ben returns NOW to the day row and the peek's tag steps to NEXT.

## 3. List + highlight — PASS
Chromium 390 (info): unfiltered 25 rows/"Earlier · 7 sets", Ben-only 7 rows/"Earlier · 1 set", Ben+Cy 10 rows, Board dims 24/32. WebKit 390 (info): unfiltered 25 rows/"Earlier · 7 sets", Ben-only 7 rows/"Earlier · 1 set", Ben+Cy 10 rows, Board dims 24/32.

## 4. Pick while filtered to yourself — PASS
un-pick dimmed in place (present:true, dim:true, moved:0.0px), a real crew write was attempted and refused (2 write(s): POST /api/person, POST /api/crew), and the row left the List on the next repaint (highlight cleared+re-set): present after = false.

## 5. Our picks open + highlight, both orders, 390 & 1280 — PASS
390 highlight-then-plan: rows stayed 7/7/7 through open->Escape->Escape, plan state after first Escape "peek". 1280 highlight-then-plan: rows stayed 7/7/7 through open->Escape->Escape, plan state after first Escape "peek". 390 plan-then-highlight: opened "open", dropped to "peek" once Highlight opened, filtered rows stayed 7/7 across Escape. 1280 plan-then-highlight: opened "open", dropped to "peek" once Highlight opened, filtered rows stayed 7/7 across Escape.

## 6. ACL Late nights under a highlight — PASS
Chromium: 10 Late-nights date-rooms, 10 read "nothing Ross picked" once Ross is highlighted (nowHidden before=false, after=true). WebKit: 10 Late-nights date-rooms, 10 read "nothing Ross picked" once Ross is highlighted (nowHidden before=false, after=true). This matches the build log's banked call 2f (one quiet line per date, not collapsed) — expected, not a bug.

## 7. Reduce Motion — PASS
Reduce Motion on; List filter to Ben landed (25 -> 7 rows) within 150ms, no page errors.

## 8. Rig write counters — PASS
fresh boot alone: 19 write(s) (POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/crew, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person) — a pre-existing per-boot write, not caused by any interaction below. after switching views, highlighting/adding/clearing three people and opening+closing Our picks: still 19 writes — no new write from any of it. Item 4's deliberate un-pick (a real crew-data change, reported separately) produced 2 refused write(s): POST /api/person, POST /api/crew — expected and correct, not a violation. Total refused writes across the whole walk (every openApp() re-triggers the boot write above): 19 (POST /api/person, POST /api/crew).

## Spotify — v103-spotify-walk.mjs

Ran offline (no network egress needed — the walk answers api.spotify.com from memory). Output:

```
make: ✓ “Portola peeps’ picks” — 4 tracks. 39 artists had no songs found — try Add new picks again later. Open in Spotify ↗
crew playlists after make: ["portola-2026"]
add: Added 117 tracks to the crew playlist.
errors: [] searched: 41 items: 121
```


## Final table

| # | Result | Note |
|---|---|---|
| 1 | PASS | Chromium 1280/390/320 + WebKit 390/320: NOW is the row's first item and stays first (idx 0) across SUN/SAT; whole on the rail, and at 390/320 the active day (SAT) stays whole while NOW rests past the edge; a real finger swipe brings it fully into view; a tap lands the now line between the strip and  |
| 2 | PASS | Chromium + WebKit 390, design crew, Sat 10:30 PM: with nobody highlighted the peek carries NOW ("OUR PICKS ... NOW") and the day row's own NOW stays hidden (one-NOW rule holds); highlighting Ben returns NOW to the day row and the peek's tag steps to NEXT. |
| 3 | PASS | Chromium 390 (info): unfiltered 25 rows/"Earlier · 7 sets", Ben-only 7 rows/"Earlier · 1 set", Ben+Cy 10 rows, Board dims 24/32. WebKit 390 (info): unfiltered 25 rows/"Earlier · 7 sets", Ben-only 7 rows/"Earlier · 1 set", Ben+Cy 10 rows, Board dims 24/32. |
| 4 | PASS | un-pick dimmed in place (present:true, dim:true, moved:0.0px), a real crew write was attempted and refused (2 write(s): POST /api/person, POST /api/crew), and the row left the List on the next repaint (highlight cleared+re-set): present after = false. |
| 5 | PASS | 390 highlight-then-plan: rows stayed 7/7/7 through open->Escape->Escape, plan state after first Escape "peek". 1280 highlight-then-plan: rows stayed 7/7/7 through open->Escape->Escape, plan state after first Escape "peek". 390 plan-then-highlight: opened "open", dropped to "peek" once Highlight open |
| 6 | PASS | Chromium: 10 Late-nights date-rooms, 10 read "nothing Ross picked" once Ross is highlighted (nowHidden before=false, after=true). WebKit: 10 Late-nights date-rooms, 10 read "nothing Ross picked" once Ross is highlighted (nowHidden before=false, after=true). This matches the build log's banked call 2 |
| 7 | PASS | Reduce Motion on; List filter to Ben landed (25 -> 7 rows) within 150ms, no page errors. |
| 8 | PASS | fresh boot alone: 19 write(s) (POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/person, POST /api/crew, POST /api/person, POST /api/person, POST /api/person, POST /api/person, P |

**Rig write counter (final): 19** — POST /api/person, POST /api/crew

