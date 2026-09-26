# The wall's left edge — build log

*Builder's log beside `ALIGN-BRIEF.md`. Started 2026-09-26 PT on `live/align`
(off main at `31772f8`: v97 + the ACL data release). Newest state at the top of
"Where it stands"; calls below it. If this session dies, this file and the
branch are the handoff.*

## Where it stands

- [x] read the brief, Kevin's four screenshots, v3.css (room heads, the clock,
      the stacks, by-time, the List, the past line), wall.js (venueGroups,
      timeGroups, renderComposed, the past line), clock-stacks.test.mjs
- [ ] before frames (Board + List; Portola Sat: Folsom by time, the grid, the
      Afters stacks, Earlier open; an ACL day; 1280 / 900 / 390 / 320)
- [ ] the edge (CSS) + the wall.js touch
- [ ] after frames, looked at; the EARLIER call framed both ways
- [ ] gate: npm test (UTC, Tokyo, night clock), test:browser, CI on the final head

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
  left" — the cards gain the difference.
- The stacks and bands take the clock's track gap from 720 up (one track:
  `--col-w` wide, `--clock-gap` apart), so column n sits under column n on any
  day, clock or not.
- Removed: `.venue-grid[data-clock="room"]`, `.venue-grid[data-clock="day"]`,
  `.time-list[data-clock]` (+ the time list's `data-clock` in wall.js, which
  only that rule read).

Size: CSS plus a two-line wall.js removal and the CSS-shape test rewritten.
Phones (<720) keep their v91 rule (see call 2).

## Calls

(filled in as they are made)
