# Phase 1 — List view + the menu bar (build brief, 2026-09-26 ~4:15 AM PT)

Kevin, from Portola, after friends liked the Folsom by-time view ("easy breezy
scrolling"): the Show menu gets view as list vs board (share and reload keep it),
the past folds away instead of "a long way back", and a design for the list. Round
five drew it; he approved every default (review page decisions, 2026-09-26 ~3:30–
3:47 AM PT). This phase builds exactly that. Shipped before Portola's Sunday if the
gate is clean; otherwise it ships when it is.

## What to build (read the designs — they are the spec)

Design docs, in this worktree: `claude-plans/2026-09-25-portola-live/design/list-view/`
— `BRIEF.md` (round brief, laws, taste), `d-full-width/BRIEF.md` + its sheets and
frames (**the approved list and dock**), `m-menu-past-persist/BRIEF.md` (**the
persistence and "over" rules**), `a-rooms-by-time/BRIEF.md` (the room/band structure
the list keeps). Where the riff (d) and the earlier spec (m) disagree, the riff and
Kevin's notes win.

1. **List view.** In List, every room keeps its one-line head (note doors unchanged)
   and becomes one reading flow of FULL-WIDTH cards, one per row: name left, "time ·
   STAGE" on one line under it (Portola stages in small tracked caps: PIER / SHIP
   TENT; Folsom/Afters venues in normal case), the people on the right edge (your
   meter, then the crew's marks), every row one height. Hour bands for stage-grid
   rooms and for AFTERS; Folsom keeps its word bands. The card is still the app's
   card: aura, grain, NOW ring, zoom (hold/hover), the − · note · + row, notes. On a
   laptop: one centred column, 560px, with room heads, the Earlier line and the band
   heads over the same column. Board is today's wall, untouched.
2. **The past folds by default** (both Board and List? — the approved design is for
   List; decide for Board from m's spec and say which you did; if Board's grid cut
   is risky, ship List's fold and leave Board as today, stated plainly): each room
   opens behind one quiet "EARLIER · N SETS ⌄" line; tapped, the past returns and the
   same line reads "HIDE EARLIER ⌃". Whole days that are over sit behind one line at
   the top. No menu option; an opened fold isn't remembered after a reload. "Over" =
   a set whose ring can never light again (the app's nightMinutes rule — an
   after-hours party across 5 AM is not over). Recompute on resume (a phone coming
   back from the lock screen, visibilitychange → visible when nothing is busy),
   holding the place by time.
3. **The menu bar.** Dock and rail read: sync dot · FEST NAME '26 · ☰ (the three-line
   icon replaces v93's caret; same style as the Board · List glyphs; the app's
   --brand while the menu is open, never --fest). Keep "PORTOLA '26" (Kevin: keep —
   the day row scrolls). The icon's grey as drawn.
4. **The menu:** the room checks, a divider, one Board · List glyph row (the chosen
   one in --brand), a divider, Settings (with the gear). No Earlier row. It is v93's
   popover (stays open across ticks, no history entry) — don't touch its history
   behaviour.
5. **Persistence** (m's table): View is per phone per festival in localStorage
   (every storage touch in a try, memory-first), `&view=list` travels in a share link
   and is seeded once, never written to the crew document (a test asserts no sync
   call). The past fold never travels.
6. **Board ↔ List motion:** the old wall fades out quick and plain, the place is held
   by TIME (the card or band at the top), the new wall rises with the existing
   cascade. No 60-card FLIP (the motion law: never a layout the whole wall redoes).
   Reduce Motion / Low Power: instant.
7. **NOW in the list:** the NOW ring and the NOW jump work; consider the production
   now line inside a time list if it reads cleanly (round five's critic suggested
   it); rings may be heavy in a dense band — judge on the frames.

## Laws and traps (CLAUDE.md — read it)

The fest accent in exactly four places; one card column token (--col-w) — a
full-width row is a new width, so define it once, as a token, and say why; 44px
floor on buttons; storage getters in a try; WebIDL receivers; the SW stamp only at
release (don't stamp); pick keys untouched; note targets untouched; no crew-doc keys;
a real-browser check with real input before you call it done (a hold waits for the
zoom under page.clock; a CDP flick ends with no fling before a quick tap — see
tests/browser/guest-tap-route.test.mjs and zoom-chips-burst.test.mjs).

## Done means

- The List and the fold and the menu bar exactly as the approved frames, at 390, 320
  and 1280, on Portola Sat/Sun (grid → list), AFTERS, FOLSOM (by-time), and ACL
  (a grid day and a Late nights date) — frames for each into `list-shots/`
  (git-ignored), looked at.
- Unit tests: the view choice and its persistence/seeding, "over" across the 5 AM
  rollover, the fold's counts, the Board/List switch keeping the place, no sync call.
- Browser tests (Chromium + WebKit locally): switch view and back keeps the place;
  the fold opens/closes and flips its words; the menu's glyph row; the dock's icon
  and dot; NOW lands in the list.
- `npm test` in UTC, TZ=Asia/Tokyo and the night clock; `npm run test:browser`.
- Commit on `live/list` as you go (scope-prefixed, no "wip"), push after each commit,
  scan every diff for a crew token (`#g=` + a long token) with && before committing,
  keep `LIST-BUILD.md` beside this brief as your log. Don't stamp, don't open a PR —
  the coordinator releases it. Report: SHAs, tests, frame paths, every product call
  you made.
