# Phase 1 build log — List view + the menu bar

*Builder's log beside `LIST-BRIEF.md`. Started 2026-09-26 PT on `live/list`
(off `live/v93` + main's docs). Newest state at the top of "Where it stands";
calls and arguments below it. If this session dies, this file and the branch
are the handoff.*

## Where it stands

- [x] read the brief, the riff (d), m's persistence/over spec, a's rooms; looked
      at the approved frames (sheet-1, sheet-2, earlier-top-390, flow-sat-long-390)
- [x] A. persistence: view per phone per festival, `&view=list` seeded once, no sync — `c5e436b`
- [x] B. the List: every room by time, full-width rows, hour/night ladders, 560 column — `9a07232`
- [x] C. the menu bar: dot · NAME · ☰, the menu's Board · List row, the switch motion — `d292959`
- [ ] D. the past: the room fold (List), the days line (both views), recompute on resume
- [ ] E. browser tests + frames (390 / 320 / 1280) + a real-input walk
- [ ] F. docs that must move with the code (docs-truth), three clocks + browser suite

## The build, in one screen

1. **View** is `ctx.view` (`'board' | 'list'`), read in `refreshCtx` from
   `filters.js loadView(fid)` (memory-first, `fn_view_v1_<fid>`, absent =
   board). The menu's Board · List row writes it; nothing else does. A share
   link carries `&view=list` (last, after `&show=`), seeded once on a phone
   that has never shown the festival, beside the rooms (`seedViewOnce`).
2. **The List** is `wall.js renderComposed` choosing the by-time body for every
   room when `ctx.view === 'list'`: the festival room's grid sets become
   entries (stage short as their place, the grid's own occurrence and now
   window), sections and Late nights go through `timeGroups` too. Cards render
   as `.card.row` (one DOM, one grid layout): name, then `time · PLACE`, the
   corners as one cluster on the right edge.
3. **The past** is a pass at the end of the render over what was drawn: each
   card's own window (`data-now-from/to` on its host's night) against a
   FROZEN clock (`ctx.pastAt`) — so a set that ends while you read never
   vanishes under your thumb; the fold recomputes at boot, on resume and when
   the festival day turns. Over cards are removed (the DOM is what you see);
   the room's line says how many. Whole days over leave behind one line at the
   top of the wall.
4. **The menu bar**: `dot · FEST '26 · ☰` in the dock and the rail; the menu
   is v93's popover (history untouched) with a View row.

## Product calls (each small enough to make; each can be reversed in one place)

1. **AFTERS reads on hours in the List** (the brief), though the riff's long
   frame drew it on the night ladder (9 PM · 10 PM · LATE). The frame's LATE
   band held 11 sets from 11:30 PM to 1:30 AM — a run of back-to-back sets is
   a set-times list, and "what's on at midnight" is the question; hours answer
   it. The rule is by shape, never by count: a section that DECLARES
   `layout: "by-time"` (Folsom) keeps its word ladder — what friends liked —
   and every other room in the List (the festival's grid, Afters, ACL's Late
   nights) reads on hours, with After-hours from 2 AM and Time TBA last.
2. **Board keeps its rooms whole; only the days line folds there.** m's grid
   cut (negative margin + mask under a sticky strip, a now line, a scroll-synced
   rail) is the risky half, on the morning of Portola's Sunday — not shipped.
   The whole-days line ("EARLIER · THU · FRI") is the same code in both views
   and removes the long way back (≈3,600px of Thursday and Friday), so Board
   gets it. (Stated plainly per the brief: Board's in-room fold is not built.)
3. **The List's rows are the same card**, laid out on a grid (`.card.row`):
   the corners stay the card's own children, in the flow instead of pinned —
   so the fit engine, the level motion and refreshCard work unchanged. A bug
   found on the first frame and fixed: `position: relative` kept the pinned
   corners' `left/right/bottom`, the clusters overlapped by 4px, and the fit's
   read-back gave every mark away (`inset: auto`).
4. **A name is never cut short.** "Every row one height" holds for every
   one-line name; a long one (Folsom's party names at 320 with people on the
   row) takes a second line and only that row grows. Truncating an artist's
   name in a list you read is worse than one taller row.
5. **A place that only repeats something says nothing**: Despacio on the
   Despacio stage, and the festival's own site ("Pier 80") under the
   festival's own head for a billed name with no set yet.
6. **A run member's time says its start** ("~10:30 PM", not "~10:30 PM – 3 AM"):
   the close is the room's, not the set's (round five, direction a's
   finding 1). Folsom parties are never runs, so Board is unchanged.
7. **The share toast**: rooms seeded → "Opened on Folsom, as a list." with
   Show all (which brings the rooms back, not the view); the List alone →
   "Opened as a list." with no door on the toast — the fest name's menu is
   the door to Board, and a second door would be a second control for one
   state. `&view=board` seeds nothing (it is the default).
8. **The menu's parts appear only where they choose something**: the room
   checks where there are two or more rooms, the view row where the fest has
   a clock (`listOffered`: a lineup fest has no times to list by). A
   one-room fest with a clock gets a menu of just Board · List and Settings
   (no "Show" label over nothing).
9. **How it works keeps Kevin's pinned words** ("Show or hide parts of the
   week. / Tap the fest name.") and redraws its picture as the new bar
   (dot · ACL '26 · three lines). Suggested for Kevin, not shipped: "Show or
   hide parts of the week, as a board or a list."
10. **The switch holds the place by time**: a List row carries its grid
    cell's occurrence, so the card at the top is the same card in both views;
    else the set in the same room that starts nearest (at or after first).
    The old wall fades (OUT_MS), the rooms in view arrive with the fold's
    beat (CASCADE_MS, STAGGER_MS). No FLIP.
11. **The line glyphs live in `tools.js GLYPHS`** beside the gear; index.html
    draws the menu glyph statically (the shell paints before modules run) and
    a test holds the two paths equal.
12. **The service-worker stamp test is red on this branch by instruction**
    (the coordinator stamps at release); every other test is green.
