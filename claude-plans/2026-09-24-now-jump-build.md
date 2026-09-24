# NOW, the jump to what is playing — build log (2026-09-24)

The ask (Kevin, 2026-09-24): "for the now line can we please add a option to
the left of the days that's like 'now' or maybe today is lightly
stylistically highlighted inline with our styles and if you tap it goes to
now. a use case I'm thinking about is like 'where is ross likely right now'
and in my mind that'd be tapping ross on the top to highlight him and then
clicking something in the scroll to time bar." Then: "the line and highlight
combo" — land so the now line and the highlighted card are seen together.

The rules as built are MODEL-V4 §3d. This log is how they got there.

## Where things stand

- Branch `feat/now-jump` (worktree agent-a13bbdee821d361d6), on top of
  `main` after the v86 ship (e907f68). Not pushed.
- Tests first: `tests/now-jump.test.mjs` (jsdom, the festival clock pinned)
  and `tests/browser/now-jump.test.mjs` (Chromium, `page.clock` pinned to
  Saturday 10:30 PM PDT at Portola) went in red at 5deed4e.
- The build is v87 (`node scripts/sw-stamp.mjs`, a bump — see call 9).

## What it does

1. A `NOW` button before the day tabs in the dock (phone) and the rail
   (desktop): the day tabs' own type and size in `--brand`, with a live dot
   that breathes (still under Reduce Motion and Low Power — the motion kill
   rules do that). `index.html` holds both; `app.js paintNowTabs` shows them.
2. It is there only while something is live on the wall you are looking at:
   a now line on a grid or a NOW mark on a stack. The minute ticker
   (`tickClock`) and every day-nav render repaint it; it fades in with the
   beat and out quick and plain, and the day tabs beside it slide.
3. A tap (`app.js jumpToNow`, `wall.js nowLanding`):
   - no highlight: the now line, a third of the way down the part of the
     window you can see (under the rail and the pinned stage strip, above
     the dock) — the day-of open's own landing. No line (Pier 80 closed, the
     afters running): the first NOW-marked card in wall order;
   - a highlight: that person's live pick, highest level first (must), then
     the earliest start. A grid cell brings the line: the line lands a third
     of the way down, moved only as far as it takes to get the card's top on
     screen and never so far the line leaves; the grid scrolls sideways to
     centre the card's column if it is off screen. A stack card lands a
     quarter of the way down, its venue's head above it. The card gives one
     pulse (scale 1.06, twice, transform only; none under Reduce Motion or
     Low Power). Nothing of theirs live: as with no highlight.

## Calls I made

1. **A separate button, outside the tab rows.** NOW is `#dock-now` /
   `#rail-now`, a sibling of `#dock-days` / `#rail-days`, not a tab inside
   them: it never scrolls away with an overflowing row, and the scrollspy
   (which reads `.day-tab` in those rows) can never light it. Kevin's other
   idea — today's tab lightly marked, and a tap on it going to now — costs no
   room, but it makes one tap mean two things; it is the fallback if NOW
   reads as clutter.
2. **Grid cells carry their real now window** (`data-now-from/to`: start to
   the published end, or start + 60 when there is none — not the 30-minute
   display floor). The stack cards already did; the grid had only its line.
3. **Level, then start.** A must (4) beats a 3 anywhere on the wall; a tie
   goes to the set that started first. Two people highlighted: the best
   live pick of either.
4. **The line a third of the way down, not at the jump offset.** At the
   offset the line would sit on the stage strip with only the next hour
   below it; a third down shows what is crossing it (playing) and what is
   next.
5. **The days slide tab by tab.** The dock centres a row that fits, so its
   tabs move by half the room NOW takes; sliding the row as a whole would
   jump before it glided.
6. **The tab row re-reads its edges when its width changes**
   (`wireScrollspy`, a ResizeObserver): before, only a window resize did,
   and NOW changes the row's width with the window standing still. A row
   that has just begun to overflow keeps the day you are in on screen.
7. **Room on a phone.** Measured with NOW showing (Chromium, Inter, touch):
   Portola's four tabs need 216px; the row gets 158 at 390, 143 at 375, 88
   at 320. It already scrolled before NOW — 213 of 216 at 390 — so NOW does
   not create the scroll, it deepens it: at 390 you see three of the four
   days, the day you are in centred, the edges fading. That stays. What
   does not: a long fest name on a 320 dock (an iPhone on Display Zoom) —
   ACL's row would be 27px, narrower than one tab. There NOW keeps only its
   dot in a faint ring (`fitNowTab`: when the row cannot hold its widest
   tab plus 24px), and the row gets 51px, the day whole. Measured in the
   full form every time, so the answer never feeds on itself; re-measured on
   resize and when a late font lands. The compact dot's hit area takes the
   gap on its right, not its left (the avatar's reach is there).
8. **How it works: no row.** Kevin's standing call is that the now line and
   the now mark need no lesson; `NOW` says what it does. If "highlight, then
   NOW" wants teaching, it is half a sentence on row 1 — his copy, his call.
9. **v87, not `--keep`.** The brief said `--keep`, but v86 shipped while
   this was in build (PR #24, merged 2026-09-24) and `--keep` is for an
   unreleased version: new JS under the live version number is exactly the
   shell existing installs never fetch (the v43 lesson the stamp exists
   for). `main`'s NOW.md already names this build v87.

## Checked

- `tests/now-jump.test.mjs`: 9 (the line; Ross → Milli Meng in SAT AFTERS;
  Nhu → Soulwax on the grid with its line; two people and a level tie;
  nothing of theirs live; the grid closed; nothing live at all and a lineup
  fest; the ticker alone; past midnight still Saturday's afters). Also run
  under `TZ=Asia/Tokyo`.
- `tests/browser/now-jump.test.mjs`: 12 — at 390 (touch) and 1280: NOW sits
  before the days, is not a day, has its dot; a tap puts the line between
  the stage strip and the dock; Ross → his afters card whole under the
  chrome; Nhu → the line AND Soulwax's cell in view together, the card
  crossing the line, its column on screen. Saturday 9 AM: no NOW. 320: no
  overlap. Portola at 390 and 320, ACL at 390: full NOW; ACL at 320: dot
  only; the day you are in whole in the row every time.
- Probed, not asserted: a lineup fest (Seismic 9.0, EDC Orlando) never shows
  NOW; ACL's Sep 29 Late nights (doors-only, no times) has no NOW mark, so no
  NOW — a data fact, not a bug; ACL Oct 10 at 11 PM (grid closed) shows NOW
  and lands on Fcukers at Devil May Care.
- Screenshots (fixed clock, Sat 10:30 PM PDT) at 390 and 1280: before the
  tap, the line landing, Ross, Nhu; the dock on Portola, ACL, a lineup fest.

## Open

- Kevin's look on localhost, then the ship.
- If NOW reads as clutter in the dock: call 1's fallback.
