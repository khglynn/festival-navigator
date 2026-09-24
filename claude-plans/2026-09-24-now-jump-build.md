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
  `main` after the v86 ship (e907f68, merged in), pushed to origin. No
  production rows made: every crew in the tests and probes is routed.
- Tests first: `tests/now-jump.test.mjs` (jsdom, the festival clock pinned)
  and `tests/browser/now-jump.test.mjs` (Chromium, `page.clock` pinned to
  Saturday 10:30 PM PDT at Portola) went in red at 5deed4e.
- The build is v87 (`node scripts/sw-stamp.mjs`, a bump — see call 10).

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
     the dock) — the day-of open's own landing — while the clock is inside
     the grid's hours. Past them (Pier 80 closed, the afters running): the
     first NOW-marked card in wall order;
   - a highlight: that person's live pick, highest level first (must), then
     the most recent start. A grid cell brings the line: the line lands a third
     of the way down, moved only as far as it takes to get the card's top on
     screen and never so far the line leaves — unless the set is too tall
     for both, when the line keeps its third; the grid scrolls sideways to
     centre the card's column if it is off screen. A stack card lands a
     quarter of the way down, its venue's head above it. The card gives one
     pulse (twice, transform only, at most ~12px of growth; none under
     Reduce Motion or Low Power). Nothing of theirs live: as with no
     highlight, no pulse, and one quiet line on the toast — "Nothing of
     Kat's is on right now — here's what is." 

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
3. **Level, then the most recent start.** A must (4) beats a 3 anywhere on
   the wall; a tie goes to the set that started most recently. The first
   build gave it to the earliest start; the review pointed out that favours
   a room marked live from doors to close, or a set half over, and the
   coordinator made the call: "where is Ross right now" is the set that just
   began. Two people highlighted: the best live pick of either.
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
   dot in a faint ring (`fitNowTab`), and the row gets 51px, the day whole.
   Measured in the full form every time, so the answer never feeds on
   itself; re-measured on resize and when a late font lands. The compact
   dot's hit area takes the gap on its right, not its left (the avatar's
   reach is there).
   **Revised after the review:** the first threshold (widest tab + 24px)
   left one lone day at Portola 320 and ACL 375. A neighbour only shows
   once the room beside the centred day clears the 24px gap between tabs
   AND the 18px edge fade, so NOW keeps its word while the row holds
   widest + 2 × (gap + fade), both read from the row's CSS (`--row-fade` is
   now the token the fade itself uses). The review suggested widest +
   2 × 18 + 12; that is 24px a side — exactly the gap — so it still leaves
   Portola 320 with its word and 4px of the other days. Measured (Chromium,
   touch, NOW live; ACL on Sat Oct 3, a middle day — the first or last day
   has all the slack on one side). "Other days" is how many px of them sit
   inside the row, fades included:

   | fest | width | NOW | with the word | with the dot |
   |---|---|---|---|---|
   | Portola | 430 | word | 198px row · 3 days whole · 88px of others | 222px · 4 whole · 106px |
   | Portola | 390 | word | 158px · 1 whole + 2 glimpsed · 68px | 182px · 3 whole · 72px |
   | Portola | 375 | word | 143px · 1 whole + 2 glimpsed · 59px | 167px · 2 whole · 68px |
   | Portola | 320 | dot | 88px · 1 whole · 4px | 112px · 1 whole + 2 glimpsed · 28px |
   | ACL | 430 | word | 137px · 1 whole + 2 glimpsed · 46px | 161px · 70px |
   | ACL | 390 | dot | 97px · 1 whole · 6px | 121px · 1 whole + 2 glimpsed · 30px |
   | ACL | 375 | dot | 82px · 1 whole · 0px | 106px · 1 whole + 2 glimpsed · 15px |
   | ACL | 320 | dot | 27px · today 0% clear | 51px · today 35% clear, no others |

   ACL at 320 is short of room with or without NOW: its dock name ("ACL
   MUSIC FESTIVAL '26") takes 152px, and even beside the dot the edge fades
   dim part of the day you are in. The fix for that is the name (a shorter
   dock label for long names), which is Kevin's call, not NOW's.
8. **How it works: no row.** Kevin's standing call is that the now line and
   the now mark need no lesson; `NOW` says what it does. If "highlight, then
   NOW" wants teaching, it is half a sentence on row 1 — his copy, his call.
9. **The pulse: twice, and at once when you are already there.** Two beats
   of scale 1.06 (460 ms each) read as "here" where one reads as a flicker;
   it starts when the glide ends (`scrollend`, or 750 ms where the engine
   has none — WebKit), and straight away when a tap finds the page already
   in place, because then the pulse is the whole answer.
10. **v87, not `--keep`.** The brief said `--keep`, but v86 shipped while
   this was in build (PR #24, merged 2026-09-24) and `--keep` is for an
   unreleased version: new JS under the live version number is exactly the
   shell existing installs never fetch (the v43 lesson the stamp exists
   for). `main`'s NOW.md already names this build v87. Later changes on
   the branch re-stamp with `--keep`, since v87 is not out yet.

## Checked

- `tests/now-jump.test.mjs`: 11 (the line; Ross → Milli Meng in SAT AFTERS;
  Nhu → Soulwax on the grid with its line; two people and a level tie to
  the most recent start; nothing of theirs live, and match true / false /
  null; the grid closed; just past the close and before doors; nothing
  live at all and a lineup fest; the ticker alone; past midnight still
  Saturday's afters). `tests/now-line.test.mjs` gained the line's width
  contract. Also run under `TZ=Asia/Tokyo`.
- `tests/browser/now-jump.test.mjs`: 27 — at 390 (touch) and 1280 in
  Chromium, and at 390 in WebKit where it is installed (it is here; CI
  installs Chromium only, so those three skip there): NOW sits before the
  days, is not a day, has its dot; a tap puts the line between the stage
  strip and the dock; Ross → his afters card whole under the chrome; Nhu →
  the line AND Soulwax's cell in view together, the card crossing the line,
  its column on screen; a second tap on Ross moves nothing and pulses at
  once. Reduce Motion: lands at once, no pulse, the dot still. Saturday 9
  AM: no NOW. 320: no overlap. Portola at
  390 and 320, ACL at 390: full NOW; ACL at 320: dot only; the day you are
  in whole in the row every time (the dock table below replaced these
  cases). The landings wait for the glide to come to rest, not a fixed
  sleep: a 1.1 s sleep flaked once under the full suite's load; with the
  wait, 8 copies run in parallel passed 128/128. Since then: the line
  across every column (right end at 390 and 430; Kat's third column), the
  review's six (below), and the dock at 430/390/375/320 for Portola and
  ACL.
- Whole suites at the final v87 stamp (bcc05784): `npm test` 796 (795
  pass, 1 skipped), also under `TZ=Asia/Tokyo`; `npm run test:browser`
  122/122 with WebKit installed. One full run in four had a single failure
  in `tests/browser/zoom-chips-burst.test.mjs` ("clear, then re-pick 40ms /
  80ms later … there is a ×1 chip"): a timing test in the zoom's who-row,
  not NOW's code; it passed 7 of 7 alone and the next full run was 122/122.
  It flakes under local load, which this file's 27 browser cases add to.
- Probed, not asserted: a lineup fest (Seismic 9.0, EDC Orlando) never shows
  NOW; ACL's Sep 29 Late nights (doors-only, no times) has no NOW mark, so no
  NOW — a data fact, not a bug; ACL Oct 10 at 11 PM (grid closed) shows NOW
  and lands on Fcukers at Devil May Care.
- Screenshots (fixed clock, Sat 10:30 PM PDT) at 390 and 1280: before the
  tap, the line landing, Ross, Nhu; the dock on Portola, ACL, a lineup fest
  (kept outside the repo, in the session's scratchpad `now-jump-shots/`).

## Kevin's look (localhost, 2026-09-24): "It looks good"

It found the now line stopping partway across the grid (430 wide, Sat
10:30 PM: scrolled to Warehouse / Ship Tent, no line). The line is
`left: 0; right: 0` of its `.times-grid`, and that box was only
`min-width: 100%` of the scroller while the fixed `var(--col-w)` tracks
overflowed it — so the line spanned the first screen, not the columns. v86
has it too; it also cut through the middle of Nhu's Soulwax in this log's
own 390 screenshot, which the first browser test (vertical crossing only)
did not catch.

- **Fix: a day grid's box is its tracks** (`width: max-content` on
  `.times-wrap:not(.stage-strip) > .times-scroll > .times-grid`;
  `min-width: 100%` still fills a window wider than the columns). Chosen over
  setting the line's width from `scrollWidth` in `positionNowLines`: nothing
  to re-measure on resize, a late font or a repaint, and the minute ticker
  stays free of layout reads. The strip's row keeps its own box — its follow
  reads the lead's scroll range (`--strip-max`), identical either way.
- **Probed** at scroll 0 / middle / end, Portola 390, 430, 1280, ACL 390,
  Electric Forest 390, Chromium and WebKit: grid width = track sum on a
  phone (906px at 390), the scroll range unchanged (584px at 390), stage
  heads 0px off their columns, the rail's clock label 0px off the line.
  Lane-split cells size in percentages of their grid area, not the box; no
  shipped fest has one now, and the meter contract's three-lane fest passes.
- **Tests:** jsdom — the line's grid is matched by a `width: max-content`
  rule, every track is `var(--col-w)`, the strip's row is not matched.
  Browser — at 390 and 430 scrolled to the right end the line crosses the
  last column and the whole visible width; NOW to Kat's Prospa (third
  column) and to Nhu's Soulwax shows the line right across the card. All
  five went red before the fix.
- The other thing Kevin's look found (a desktop hover zoom near the bottom
  covering the dock) is `card-facts.js`, fixed on its own branch.

## The independent review (Opus, 2026-09-24, on 17c6860)

Clean on timezones, the 5 AM rollover, cancelled acts, hidden rooms,
search, lineup fests, the active-tab state, the ResizeObserver, timers,
Low Power / Reduce Motion, accessibility and the service worker. Findings,
each fixed as its own commit with its test:

| # | Finding | Fix | Test |
|---|---|---|---|
| 1 | Highlighted and nothing of theirs on: NOW pulsed a dimmed stranger's card (Sat 11:45 PM, Kevin: Parcels) | `nowLanding` returns `match`; no match = no pulse + "Nothing of Kat's is on right now — here's what is." on the app's toast (`yours` for you) | jsdom match true/false/null; browser Kat and Kevin at 11:45 |
| 2 | 11:00–11:30 PM the line sits pinned to the bottom of a closed grid while the afters are on | the line answers only inside the grid's rows; past them the marks win; before doors the line still does | jsdom 10 and 25 min past the close; 20 min before doors |
| 3 | Level ties went to the earliest start (a room live since doors beat the set that just began) | ties go to the most recent start; MODEL-V4 §3d says so | jsdom Prospa 9:45 vs Galen 10:30 → Galen |
| 4 | The dock kept NOW's word with one lone day showing (Portola 320, ACL 375) | NOW keeps its word while the row holds widest + 2 × (gap + fade); `--row-fade` shared by the mask and the rule | browser table cases at 430/390/375/320 |
| 5 | The pulse could return before removing its scrollend listener (a leak per repaint mid-glide) | cleanup first; re-find the card via `cardFor` and pulse that | browser: card swapped mid-glide, clone pulses, listener count unchanged (CDP) |
| 6 | A tall pick on a small phone pinned the line above the dock (Despacio, 320x568, 9:15 PM) | chase the card's top only while the line stays within two-thirds; the pulse grows ≤ ~12px | browser: the line at a third, ≤ 13px of growth |

Where I differed from the brief: finding 4's suggested threshold (widest +
2 × 18 + 12) is 24px a side — exactly the gap between tabs — so it still
kept NOW's word at Portola 320 with 4px of the other days; counting the
gap and the fade gives the result the finding asked for (call 7's table).
Not mine: the desktop mis-pick (a hover zoom over the rail after the jump,
where a second NOW click picks the card under it) is `card-facts.js`, on
the zoom agent's branch. Not now: ACL grid headliners with only a start
time stop being live after 60 minutes — ACL data prep, before Oct 2.

## Open

- Kevin's "ship v87" once the PR's CI is green.
- If NOW reads as clutter in the dock: call 1's fallback.
- Desktop, a mouse, NOW clicked from the very top of the page: the jump
  sticks the rail to the top and leaves the resting pointer over the wall,
  so hover grows whatever card is now under it, and that zoom blooms over
  the rail (z 36 over 25), covering NOW; the review showed a second click
  then picks the card underneath. The fix is the zoom's (`card-facts.js`),
  on its own branch.
- ACL at 320: its dock name takes 152px, so even beside NOW's dot the edge
  fades dim part of the day you are in. A shorter dock label for long
  names would fix it — Kevin's call, not NOW's.
