# Our plan — the UI spec (phone peek + day plan, laptop corner + panel)

Written 2026-09-26 ~6:10 AM PT on live/plan (List merged, ba7c4c7). The model is `js/v3/plan.js`
(brief: `BRIEF-plan-model.md`); this is everything drawn on top of it. Approved look: round three
(`claude-plans/2026-09-25-portola-live/design/ours-r2/`, frames `Q-*` and `DT-*`, grid and styles
in `map-design-model-port.md` §3). Where this spec picks a default Kevin hasn't seen, it is
marked **[review]** and goes on the review page.

## 1. One rendering, two windows

The motion law that came out of the zoom rebuild (2026-08-30): a morph may measure a box and
nothing inside it — every fact is rendered once. So the peek is not a second copy of a row. It
is a **window onto the day plan**:

1. One element, `#plan` (`js/v3/plan-shelf.js`), mounted in `#screen-app` just before `#dock`:
   `[grabber] [head] [rows]`. It is always laid out at its open height `H`
   (content height, capped at the viewport minus the dock minus 56px, so the wall shows above it).
2. **Peek** = the same element translated down so only `grabber + the tagged row` shows above the
   dock: `translateY(H − peekH)` on the element, and the head + rows shifted up by the tagged row's
   offset so that row sits right under the grabber. The dock (z30, opaque) paints over the part
   below; `#plan` is z29. The head is at opacity 0 in the peek.
3. **Open** = no transforms. Dragging interpolates both transforms and the head's opacity with one
   number `p` (0 peek, 1 open). All of it is transforms and opacity on one fixed element — the
   wall never re-lays out while it moves.
4. On a laptop the same rows render in the corner card and the panel (§6), again as one element
   whose closed state is a window.

## 2. The row (all four surfaces)

Four columns `16px | 1fr | 72px | 48px`, gap 10 (≤359px: `16 | 1fr | 64 | 44`, gap 8), baseline
aligned; tokens `--plan-nw/--plan-ww/--plan-cw/--plan-gap` in v3-tokens.css.

1. Node (col 1): most = 16px aura disc from the card's own facts (`factsFor(act, ctx, occ)`),
   some = 10px ring, or/earlier = 7px ring; live adds the glow; a 2px brand rail joins the nodes.
2. What (col 2): a set → the artist, a room → the venue (its headliners on the second line);
   the second line is the place (+ " · also …" in the open plan only). Artist size: most 17/800,
   some 14.5/700. One second-line style, 12px/600 secondary.
3. When (col 3): NOW pill + "till h:mm" (a set's own end, a room's stop end — `tillOf`); NEXT pill
   + start; every other row its start, quiet. `quietClock` ("9 PM", "9:40 PM"). The column is
   right-aligned and may spill left into the gap (measured at 320 before shipping).
4. Count (col 4): Anton digit + "of us". The NOW row's count is the count at this minute;
   every other row's is its peak.
5. Faces: on MOST rows in the open plan only (you first), never in the peek or corner.
6. A fork row ("or Kettama · Warehouse 3") at most one per stop (`forkFor`), scattered rows
   ("Scattered till 12:30 AM"), and the past: one past stop is a faded row; two or more fold
   into `EARLIER · N STOPS ⌄` (the List's grammar), which opens in place (rows arrive,
   STAGGER_MS apart).
7. Colour: `--brand` only. Never `--fest`.

## 3. When the phone peek shows

1. There is a plan (≥3 pickers, a clock) and a plan day: tonight's night while it has a stop to
   come or live; after tonight's last stop, **tomorrow's** first stop with its weekday in the time
   slot ("NEXT · SUN 1:40 PM"); nothing further ahead, so no peek on the days before a festival
   **[review]**.
2. Not while a search is on (`ctx.query` non-empty — the search wall has no clock, like NOW), and
   not while the search field has focus (the dock hides then too).
3. It waits for the welcome card and the bring offer: while either is up, no peek; when it leaves,
   the peek rises **[review]**.
4. A guest sees the crew's plan with no "you".
5. The highlight (people filter) does not change it; with a highlight on, the NOW tab stays as
   today ("Ross's now") — PLAN Q4c.

## 4. The one-NOW rule

In `paintNowTabs`, per door: the phone door's NOW leaves while the peek (or open plan) shows a NOW
row and no highlight is on; the rail door keeps NOW until the laptop card shows a NOW row. A live
set that is not a plan stop keeps the tab beside a NEXT peek (PLAN Q4a). The peek paints first in
the same pass, with the same `date`, so the tab never flickers.

## 5. The phone storyboard (every element: from where, when, how long, which curve)

Constants from `js/v3/motion.js`. Under Reduce Motion or Low Power every settle is instant; the
finger-follow stays (direct manipulation).

| # | Moment | What moves | From → to | Start | Duration / curve |
|---|---|---|---|---|---|
| 1 | Peek arrives (first plan of the day, or a companion left) | `#plan` | fully behind the dock → peek position | 0 | GROW_MS, EASE_ARRIVE |
| 2 | The tagged stop changes (tick: Tove Lo → Robyn) | the rows inside the window | old row's offset → new row's offset (the list scrolls by in the window) | 0 | REFRESH_MS, EASE_SURFACE |
| 3 | NEXT becomes NOW on the same row | the pill and the time | crossfade in place | 0 | REFRESH_MS, EASE_SURFACE |
| 4 | Drag up | `#plan` ty, rows' shift, head opacity | follow the finger, `p = dy / (H − peekH)` | pointermove | none (inline transform) |
| 5 | Release past a third, or a tap | same three | current `p` → 1 | 0 | GROW_MS, EASE_ARRIVE |
| 6 | Release short of a third | same three | current `p` → 0 | 0 | OUT_MS, EASE_LEAVE |
| 7 | Open lands on a NOW row | its card blooms under it (`sheetCard`), the rows below make room | height 0 → natural (FLIP of the rows below) | after 5 ends | GROW_MS, EASE_ARRIVE; the card's lines CASCADE_MS, STAGGER_MS apart |
| 8 | A row tap in the open plan | that row's card grows; rows below make room; tap again folds it | as 7 | 0 | as 7 / OUT_MS out |
| 9 | Close (drag down, ✕, Escape, the fest name) | 6 from the current `p`; a grown card stays grown below the window and is there when it opens again (built 2026-09-26: folding it first was a second motion for nothing a person can see) | open → peek | 0 | OUT_MS, EASE_LEAVE |
| 10 | Peek leaves (no plan day, search, a companion arrives) | `#plan` | peek → behind the dock | 0 | OUT_MS, EASE_LEAVE; a safety timer hides it if the animation never ends |

A drag in progress marks the page busy (the Show menu's rule: take the slot only if free, give it
back only if it is ours, and the minute tick sweeps a leftover). An open plan does not.

## 6. The laptop (≥720)

1. **Corner card**: fixed, right 20, bottom 20, 380px wide, one `<button>`: the line
   `OUR PLAN · SAT · 9 OF US` with "Open ⌃" drawn as a span, a hairline, then the tagged row.
   Hover lifts it 2px with a brand edge.
2. **Open**: the card grows into a 400px panel from under the rail to the bottom, no backdrop,
   "Close ⌄", Escape closes. One element again: the panel is laid out at full size and starts
   clipped to the card's box with the rows shifted so the tagged row sits where it was in the card
   (clip-path inset, GROW_MS EASE_ARRIVE; closing reverses on OUT_MS EASE_LEAVE). The head is the
   one piece whose words differ between the two (`OUR PLAN · SAT · 9 OF US` vs
   `SAT OUR PLAN · SEP 26 · 9 OF US PICKING`); it rides the growing top edge and its words
   crossfade **[review: or keep one head in both]**. *Built 2026-09-26 as the cross-fade, in
   the head line itself (a grid cell holding both), with the pill Open ⌃ / Close ⌄ beside it.
   The card's box is the panel's, centred (10px off each side) and the panel drawn 10px left
   of the edge, so the rows never reflow as it grows. Edge and shadow are drop-shadow filters
   on a frame around #plan (a parent's filter follows a child's clip). No drag on a laptop;
   a click anywhere on the card opens it.*
3. The panel's top tracks the rail's real box (the rail sits under the header until it pins).
4. The wall stays usable: the panel covers the right 300px at 1280 (the grid scrolls under it);
   a zoom's `place()` gets a right bound at the panel's left edge **[review]**.
5. The corner card waits for the welcome card (bottom-centre, it collides below ~1240px wide);
   the Spotify scan pill moves above the corner card.

## 7. No history entry, and what Back does

Neither the peek nor the open plan takes a history entry (the v93 lesson: the Show menu's own
entry took four review rounds and was cut). They close by drag, ✕ / Close ⌄, Escape (after any
open modal sheet), a tap on the fest name, or another screen; the open state is gone on
pagehide, boot and crew switch. **Back does what it does from the wall today — it leaves the
wall**: the wall's history entry is the crew link itself (app.js 3204), so Back goes to wherever
the link was opened from; on Android it closes the app; opened from Messages on an iPhone there is
usually nothing behind it. The review page says this in those words.

## 8. The floor everyone reads

1. `footTop()` (exported from a small shared module) = the top of the bottom chrome: the lower of
   `#dock`'s top and `#plan`'s visible top, each only while displayed. `seenBand` (app.js) and the
   zoom's `dockTop` (card-facts.js) read it; so do the three browser suites that re-derive the
   floor inline (zoom-chrome-contract, stack-row, now-jump).
2. `--foot-h` on `:root` = viewport bottom minus `footTop()` at rest (peek, never mid-drag; the
   open plan covers the wall and is not a floor for the page's padding). One writer, called after
   every plan paint, on search focus/blur, on resize and on the late font. Readers: `.shell`'s
   bottom padding, the toast, the welcome card / offer, the spot pill (replacing 84/64/64/70).

## 9. Invalidation

`refreshCtx()` sets `planDirty`; `paintPlan(date)` rebuilds the model only when dirty and is
called from `renderDayNav` (every repaint and search keystroke), the end of `refreshArtistCards`
(a tap or a zoom step — they never repaint the wall), `tickClock`, and `jumpToNow`'s empty branch.
It paints the peek, then runs `paintNowTabs` with the same date.
