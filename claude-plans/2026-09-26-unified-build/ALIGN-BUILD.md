# The wall's left edge — build log

*Builder's log beside `ALIGN-BRIEF.md`. Started 2026-09-26 PT on `live/align`
(off main at `31772f8`: v97 + the ACL data release). Newest state at the top of
"Where it stands"; calls below it. If this session dies, this file and the
branch are the handoff.*

## Where it stands

- [x] read the brief, Kevin's four screenshots, v3.css (room heads, the clock,
      the stacks, by-time, the List, the past line), wall.js (venueGroups,
      timeGroups, renderComposed, the past line), clock-stacks.test.mjs
- [x] before frames — `bc73ab6` (log), rig `align-frames.mjs`
- [x] the edge (CSS) + the wall.js touch + the tests rewritten to the new
      law — `16981ff` (the EARLIER centring rode in the same commit)
- [x] after frames, looked at; the EARLIER call framed both ways (call 3)
- [x] gate, local, on `c8d30d5`'s code: `npm test` at UTC, TZ=Asia/Tokyo and the night
      clock (2026-09-27T04:30Z) — 1137 tests, 1135 pass, the one fail the service-worker
      stamp (not stamped, by instruction) in all three; `npm run test:browser` 237/237
- [x] CI on `aa3f24c` (run 36261551665): `browser` green; `checks` 1135/1137, the one
      fail the stamp. This log line is the only change after it (docs), and its own
      run is reported in the hand-off.
- Not done, by instruction: no stamp, no PR, no review agent. Next for the
  coordinator: an independent review of `16981ff`, then stamp + PR with the
  other releases in their order.

## What is there today (why the edge jumps)

The Board has no left edge of its own. Each presentation decides its own
offset, and four special cases exist:

1. the clock (`.times-wrap`): hour rail 40px at the shell's edge, cards past it;
2. `.venue-grid[data-clock="room"]` — the clock's own leftovers step in by the
   rail, every width;
3. `.venue-grid[data-clock="day"]` and `.time-list[data-clock]` — other rooms
   on a clock day step in from 720 up (on a phone, stacks carry the rail as
   lead space in `.stack-scroll`, v91);
4. everything else — room heads, the EARLIER line, band heads, every room on a
   day with no clock (Portola Thu/Fri, ACL Late nights) — sits at the shell's
   edge.

So a room head is never over its cards, and the cards jump 40px right the
moment a clock begins (Kevin's frames 0–2).

## The plan (sized before code)

One edge, one rule, on the Board from 720 up:

- `--wall-edge` (new token, v3-tokens.css): how far in from the shell's content
  edge the wall starts. `#wall-root` on the Board is padded by it — every room
  head, stage/venue head, card column, band head, whisper and the EARLIER line
  starts there, whatever the presentation.
- `--hour-rail-w` stays the gutter (the times' column). The clock's wrap puts
  its rail LEFT of the edge, and the edge is smaller than the rail, so the
  times hang into the shell's side padding: that is the "scootch the times
  left" — the cards gain the difference. *(Superseded before building by
  call 1: the edge equals the gutter, nothing hangs.)*
- The stacks and bands take the clock's track gap from 720 up (one track:
  `--col-w` wide, `--clock-gap` apart), so column n sits under column n on any
  day, clock or not.
- Removed: `.venue-grid[data-clock="room"]`, `.venue-grid[data-clock="day"]`,
  `.time-list[data-clock]` (+ the time list's `data-clock` in wall.js, which
  only that rule read).

Size: CSS plus a two-line wall.js removal and the CSS-shape test rewritten.
Phones (<720) keep their v91 rule (see call 2).

## What it really was (size)

CSS plus a four-line wall.js removal, as sized. Net code: the three
per-presentation offset rules and the time list's `data-clock` gone; added one
padding rule, one one-track gap rule, the clock's margin reaching back past the
edge (a changed line, not a new one), the hour label's `nowrap`, and the
EARLIER line's second hairline (call 3). Most added lines are comments saying
why. Tests: the CSS-shape test rewritten to the new law (clock-stacks), two
by-time asserts, and the desktop half of `tests/browser/stack-row.test.mjs`
rewritten to measure the one edge at 1280 and 900 in a real browser — red
with `--wall-edge: 0px`, green with it.

## Calls

1. **The edge equals the gutter; nothing hangs.** First plan: the edge a bit
   smaller than the 40px rail, so the times hang into the shell's side
   padding and the cards gain the difference. Measured before building: the
   NOW pill on the rail ("10:45 PM", 52px) already reaches 2px from the window
   at 720 and past it on a phone, so any hang clips it on a narrow laptop. So
   `--wall-edge` = `--hour-rail-w` from 720 up, and the "scootch" is inside
   the gutter: hour marks 10px off the cards instead of 6 (and `nowrap`, since
   the label box is now only 2px wider than "10 PM" in Inter on a Mac and
   Linux/iOS draw Inter wider). The widest mark ("10 PM") now starts ~2px in
   from the shell's edge — in line with the header's chips and day tabs above
   it. The grid's cards do not move; everything else moves right 40px.
2. **Phones keep the v91 rule** (`--wall-edge: 0px` below 720). The shell
   holds exactly two `--col-w` columns; stepping every room in by the gutter
   would need narrower cards on every phone (178 → 158 at 390, 143 → 123 at
   320) and would retire the v91 sideways row and its NOW slide (app.js +
   wall.js + three test files) — well past "CSS plus a small wall.js touch",
   mid-festival, on the phones people are using. The phone gets the same
   hour-mark nudge (4px left). If Kevin wants the phone on one edge too, that
   is its own release with a card-width call attached.
3. **EARLIER: centred in its rule from 720 up** (framed both ways:
   `list-shots/align-centred/cmp-*.png`). On the one edge, "EARLIER · THU ·
   FRI" stood flush over SAT PORTOLA and read as a second room head, and in
   the List three labels stacked on one x (SAT PORTOLA / EARLIER · 7 SETS /
   2 PM). Centred it reads as a fold in the wall, not a heading, and its
   rule still starts on the edge. One component, one rule: the days line and
   the List's room lines both. Phones keep it left, as Kevin approved it (his
   note was "on desktop"; a phone's line is nearly all words anyway).
4. **Band heads are headings on the edge, not times in the gutter.** The
   brief put "10 PM" / "LATE" in the gutter. The ladder also says DAYTIME,
   EVENING, AFTER-HOURS and TIME TBA (53–83px at 10px/800 tracked); a gutter
   that holds them costs every card on the wall that width. They sit on the
   edge with their hairline, like the room heads above them, and in the List
   they already do.
5. **One track from 720 up.** Removing the clock cases would have left a day
   with no clock at `--col-gap` (7px) and a clock day at `--clock-gap` (4px),
   so Friday's Folsom columns drifted 3/6/9px off Saturday's grid right
   under it. Every card column now takes the clock's gap from 720 up; column
   n sits under column n on every day. (The rule has to follow `.band-grid`'s
   own — its `gap` shorthand resets it; the first frames showed exactly that.)
6. **The Board's search and a lineup-only fest are on the edge too.** One
   rule on `#wall-root`, so typing a search does not shift the wall 40px left
   and back. Their gutter is empty; that is the cost of "always".

## Frames

Rig: `align-frames.mjs` beside this (the Phase 1 rig: a local server, /api
from memory with a made-up crew, the service worker blocked, every write
refused). Board: top, Earlier open (Fri Folsom into SAT PORTOLA), the days
line open at the top, the grid's end into SAT AFTERS, SAT FOLSOM by time,
ACL's Saturday grid, an ACL Late nights day. List: top, SAT AFTERS, SAT
FOLSOM, ACL Saturday. Each at 1280 / 900 / 390 / 320. In `list-shots/`
(git-ignored): `align-before/`, `align-after/`, `align-pairs/` (before |
after side by side), `align-centred/` (the EARLIER variant).

Measured on every frame's page (Board, 1280/900/720): room heads, the EARLIER
line, stage/venue heads, stack and band columns, band heads and the clock's
first column all at shell + 40; column 2 of every stack and band equals the
clock's column 2; no page overflow. Phones and the List unchanged but for
the hour marks.
