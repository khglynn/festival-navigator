# D — Full-width rows (a riff on round five)

*2026-09-26 PT. A riff, not a round: Kevin's three notes on round five, drawn
on the production app (design-app at v95, with v93's shell served from git
objects at `e3c20d5`), reusing a-rooms-by-time's served-byte patches
(`patch.mjs`, copied) and m-menu-past-persist's overlay rig. The app worktree
was never edited; no crew link, no production; every write refused (13
`POST /api/person` boot pings, all 503 — `rig-report.txt`). Clock pinned to
Saturday 4:15 PM at Pier 80.*

## The idea in one line

One card per row, the full width of the column, with every word hanging from
the card's left edge (name, then time · STAGE) and the people on its right
edge (your meter, then the crew's marks). It reads like the official app's
single flow, and it is still this app's card: aura, grain, NOW ring, zoom.

## Kevin's notes (verbatim)

1. List: "ya but show me full width cards as a quick riff. I think people find
   it easier to read a single flow with the text left and right justified the
   same."
2. Menu: "I like the icon ones [Board · List with glyphs] … Let's put an icon
   to the right of fest name that's a 3 line hamburger menu icon and then move
   the dot to the left. That's a clear 'this opens a menu' affordance."
3. Past: "just default to hide with this little expand option that flips into
   a hide option. love." So there is no Earlier row in the menu.

Also decided: the past is hidden by default. The Portola stage is in small
caps (PIER / SHIP TENT). The hour pin ("Sunday at 2") is punted and not drawn
here.

## Look at these

1. `sheet-1-list-phone.png`: the pick (one flow), the alternative (two
   edges), Earlier tapped open, and 320.
2. `sheet-2-menu-laptop.png`: the menu open at 390, 1280 whole, 1280 with the
   column and the menu, and a 1:1 close-up of the dock closed and open.

Frames are in `frames/`. There are 13, each looked at:
`flow-sat-now-390`, `flow-sat-top-390`, `flow-sat-now-320`,
`flow-sat-long-390` (all of Saturday, stitched), `edges-sat-now-390`,
`edges-sat-long-390`, `flow-sat-1280`, `earlier-top-390` (the top of the
wall), `earlier-open-390`, `earlier-open-top-390`, `earlier-open-1280`,
`menu-open-390`, `menu-open-1280`.

## A. The row: the alignment choice

**Pick: "one flow".** All text is left-aligned from one edge, and the people
sit on the right edge.

```
Tricky                                        ▯▯ +1
3:30 – 4:30 PM · CRANE
```

1. **Why this reading of "left and right justified the same".** Every card's
   text starts at the same x, so the eye runs straight down the names, the
   way it does in the official app. Centred text, as on today's two-up card,
   gives every name a different left edge. The right edge is where the people
   live, so a glance down the right side answers "who's going" without
   reading any names.
2. **One line of meta.** The time and stage sit on one line under the name
   (11px `--fs-micro`; the stage is in 9px tracked capitals). The row is 55px
   on a phone, the same for every card. That matters in a list you scroll: an
   even rhythm is what reads as "breezy".
3. **The corners become one cluster.** Your meter comes first, then the crew
   marks: the corners' own order (you, then everyone else), placed on the
   right edge and centred on the row. With 300+px of width, the give-way
   dance a two-up card needs never happens.
4. **Still the card.** The aura gradient spreads across the whole row and
   looks better wide than it does in a 176px box. The NOW ring, the grain, the
   zoom and the − · note · + row are untouched. It is the same DOM with a
   different layout (the prototype only groups `.time`+`.place` and the two
   corners into wrappers).
5. **Alternative: "two edges"** (`edges-*.png`). The name is left and the
   time right on line one; the stage is left and the people right on line
   two. It is literally justified both ways, and it makes a clean time column
   down the right. I argue against it because:
   1. Rows with people are taller than rows without (50 vs 66px), so the
      rhythm stutters.
   2. The time and the crew marks compete for the same corner.
   3. A card with no stage (Despacio) leaves a hole on the left.

**Laptop (1280).** One column, centred, **560px wide** (about a phone and a
half), with the room head, the Earlier line and the band heads all standing
over the same column. A row is a line you read, and at 1200px the name and its
people would sit a whole screen apart. The empty sides are the intended cost.

**Portola vs Folsom places.** The stage is in capitals only in the festival
room ("a room inside Pier 80"). Folsom and Afters venues stay in normal case
("SVN West", "The Great Northern"). See `flow-sat-long-390.png`.

## B. The past: one line, where the morning was

1. **Folded, the default.** Each room with anything over starts with one
   quiet line: "EARLIER · 7 SETS ⌄" (the section micro-label, a caret, the
   band heads' hairline). Everything over is gone, and so is any band it
   leaves empty. At 4:15 PM the 1 PM band is gone, and 2 PM shows only
   Despacio, which is still playing.
2. **Tapped.** The past goes back into its bands, and the same line, in the
   same spot, now reads "HIDE EARLIER ⌃" (`earlier-open-*.png`).
3. **Motion (prototype):**
   1. The row you were reading holds still.
   2. The past cards arrive with the beat (opacity plus −8px, `CASCADE_MS`,
      staggered 30ms outward from the line).
   3. The page glides up to show the last of the past (at most 45% of the
      screen).
   4. The line's words cross-fade and the caret turns. Folding back is quick
      and plain.
4. **Whole days over.** Thu and Fri on a Saturday sit behind one line at the
   top of the wall, "EARLIER · THU · FRI" (`earlier-top-390.png`), which
   flips the same way. This is m-menu-past-persist's rule.
5. **Nothing in the menu.** A reveal lives for the page and is never stored.
6. **"Over" rule.** A card is over when its NOW ring can never light again
   (m-menu-past-persist §3). Nouns: "sets" in Portola and Afters, "parties" in
   Folsom.

## C. The fest name: dot left, three lines right

- **Order.** Sync dot · PORTOLA '26 · ≡. The three lines replace v93's caret.
  They are 13px, drawn in the same family as the Board · List glyphs (12-unit
  viewBox, 1.4 stroke, round caps), in the body colour at .72.
- **Open state.** The lines turn `--brand` while the menu is open, which is
  the menu's own "selected" colour. It is never `--fest`: the fest name keeps
  the accent and the glyph is chrome. It is part of the button and has no hit
  target of its own.
- **The menu.** The room checks, then a line, then the Board · List glyph row
  (List in brand), then a line, then Settings. There is no Earlier row.
- **Desktop.** The rail uses the same order, and the menu opens downward.
- **Cost.** The fest button grows by about 14px (the glyph plus its gap, less
  the caret it replaces), so the dock's day row has 14px less room. At 390,
  SUN now sits fully behind the day row's scroll fade, where before it was
  half visible. At 320 only SAT and NOW show (the row already scrolled
  there). The day row is a scroller, so nothing breaks, but it is the one
  real price.

## Questions for Kevin

1. **The row:** one flow (text left, people right) or two edges (time on the
   right)?
2. **Laptop width:** is 560px centred right, or should a row stretch to the
   shell's content width (about 1080px)?
3. **The glyph's grey:** the three lines are in body colour at .72, a touch
   brighter than the old caret, so they read as a control. Brighter, or the
   same grey as the day tabs?
4. **Dock squeeze:** OK that SUN slips behind the day row's fade at 390? If
   not, the fix is to drop the year from the dock's fest name ("PORTOLA",
   which saves about 20px).

## How to re-render

`APP=<design-app worktree> node frames.mjs [id-prefix …]`. Then:

```
python3 sheet.py sheet-1-list-phone.png "A. Full-width, one flow (pick)" frames/flow-sat-now-390.png@0.5 "A-alt. Two edges" frames/edges-sat-now-390.png@0.5 "B. Earlier, tapped open" frames/earlier-open-390.png@0.5 "320" frames/flow-sat-now-320.png@0.6
```

`sheet-2` is the same tool with a column crop,
`"frames/menu-open-1280.png@0.5[0:860:340:860]"`, and the dock strip
`"…@1.0[-50:50]"` stacked under it.

Files:
- `rig.mjs`: the server (v93 overlay plus patches, `/api` from memory,
  writes refused).
- `patch.mjs`: a-rooms-by-time's hooks.
- `proto.mjs` / `proto.css`: the row, the fold, the glyph and the menu row.
- `frames.mjs`: frames plus measurements into `rig-report.txt`.
- `sheet.py`.

## Status

- [x] rig (a's patches + m's v93 overlay) boots, 0 page errors
- [x] full-width card, pick + one alternative, 390 / 320 / 1280
- [x] Earlier fold, folded + opened (real taps), plus whole days
- [x] dock / rail glyph, closed + open, 390 + 1280
- [x] frames looked at, 2 sheets
