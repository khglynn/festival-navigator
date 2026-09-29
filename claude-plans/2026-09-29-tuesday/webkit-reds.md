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
