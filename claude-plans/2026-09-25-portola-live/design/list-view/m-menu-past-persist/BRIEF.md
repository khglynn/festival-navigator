# The Show menu's View + Past, where they persist, and the past fold

**Status:** designed and rendered 2026-09-26 ~4 AM PT. Nothing built. 23 frames at 2x from
the real app (design-app main at v95 with v93's shell laid over it from commit `e3c20d5`,
the Show menu as it ships in v96), five contact sheets, five questions at the bottom.
PNGs are git-ignored, so they live on this Mac only.

**Look at these first:**

1. `sheet-1-menu-390.png`: the menu closed, variant A, variant B (recommended), and B with List chosen.
2. `sheet-3-past-board.png`: the top of the wall and the Portola grid at 5:40 PM Saturday,
   today versus past hidden, then the reveal half-way and done.
3. `sheet-5-edges.png`: 6 AM Sunday (the 5 AM rollover, with Aftershock still on), Sunday
   1:50 PM, and a future day with nothing hidden.

`sheet-2-menu-1280.png` shows desktop. `sheet-4-past-list.png` shows the cut in a list (the
Folsom room, which already is a list).

## Kevin's ask

"our menu that holds the locations 'show' options gets a few more things — view as list vs
board (share and reload saves that selection). Hide vs show stuff that's past — like a
scroll to the top cuts off with a gradient not a long way back."

## 1. The menu

### Recommended: B, "Earlier is one more thing to show"

```
SHOW
✓ Portola
✓ Afters
✓ Folsom
  Earlier          ← unchecked = the past is folded (the default)
──────────────
▥ Board   ≡ List   ← one row, two choices, the chosen one in brand
──────────────
⚙ Settings  ›
```

1. **Why B works.** The menu is already a list of things you can show, with checks. The
   past becomes one more of them: "Show ✓ Earlier" reads as it sounds, and it adds no new
   kind of control. Everything above the first line is *what* is on the wall; the row
   below it is *how* the wall is laid out.
2. **The word is "Earlier".** It is the same word the fold's own line uses on the wall
   ("EARLIER · 13 SETS"), so the menu and the wall name the state the same way.
3. **The View row.** It holds two bare glyph-and-word buttons, `▥ Board` and `≡ List`,
   starting in the check column so the words line up with the rooms above. The chosen
   one is `rgb(var(--brand))`, which is how a checked room's text already looks. The
   other is `--text-secondary`. There is no pill, box or segmented track.
   1. The glyphs are 12px, viewBox 0 0 12 12, stroke `currentColor` at 1.4, round caps.
      The same family as v93's gear.
   2. Board is three vertical strokes of different lengths (stage columns):
      `M1.5 1.5v9M6 1.5v5M10.5 1.5v7`. List is three horizontal lines:
      `M1.5 2.5h9M1.5 6h9M1.5 9.5h9`.
   3. Each choice is a `<button role="option" aria-selected>` inside
      `<li role="group" aria-label="View">`, so each one gets the 44px floor from being a
      button.
4. **Behaviour** (all of v93's stays: the menu stays up, four ways out, the `menu:` layer):
   1. Tapping Earlier turns its check at once, and the wall folds or reveals behind the
      menu (§3 motion). It is the same flow as tapping a room.
   2. Tapping Board or List switches the view behind the menu and the menu stays up. The
      page keeps its place **by time**: whatever day, room and time band is at the top of
      the screen before the switch is at the same height after it. On a live day with
      nothing else to anchor to, it lands on NOW.
   3. Motion for the switch: the old wall fades out quick and plain (OUT_MS, EASE_LEAVE),
      and the new one arrives with the beat that `unfoldAll` already uses (opacity 0 and
      +6px to rest, CASCADE_MS, EASE_ARRIVE, stagger per day block). Cards do not morph
      from one layout to the other, because that would force a layout the whole wall has
      to redo. Reduce Motion and Low Power switch instantly with the place still held.
5. **Closed state:** nothing new on the fest name. The wall shows the state itself (the
   Earlier lines, or the list).
6. **A room head tap** still folds that room on every day, unchanged.

### Alternative: A, "two rows of words"

This is Kevin's wording taken literally: `VIEW  Board  List` and `PAST  Show  Hide`, each
row name in the menu's micro-label style, the chosen word in brand. It is clear, but it
adds two more labels under "SHOW" and makes "hide" something you choose rather than
something you uncheck. Frames: `frames/menu-rows-390.png`, `frames/menu-rows-1280.png`.

## 2. Persistence (exactly)

| Setting | Stored where | Scope | Default | Travels in a share link? | Crew document? |
|---|---|---|---|---|---|
| Rooms (exists, v92) | `fn_fold_v1_<fid>` localStorage | this phone, this festival | all shown | yes, `&show=fest,afters` | never |
| **View** | `fn_view_v1_<fid>` = `"list"` (key absent = board) | this phone, this festival | board | **yes, `&view=list`** | never |
| **Earlier (past)** | `fn_past_v1_<fid>` = `"show"` (key absent = folded) | this phone, this festival | **folded** | **no** | never |
| A door's reveal (§3) | page memory only | one room on one date (`<iso>\|<room>`), or the day line | closed | no | never |

1. **Code.** `filters.js` gets `loadView/saveView/loadPast/savePast` built exactly like
   `loadFolded/saveFolded`. Memory is the truth for the life of the page and localStorage is
   the copy. `memoryWins` applies when a write is refused, and every storage touch is inside
   a try (CLAUDE.md: storage getters can throw). An absent key means the default, so
   choosing the default removes the key, the same as the fold.
2. **Reload.** After entry the URL is only `/#g=<token>` (enterApp's replaceState), so a
   reload finds its view in storage. Board or list and Earlier come back exactly as they
   were. A door's reveal does not come back: a reload folds the past again, because a
   reveal was a moment, not a choice.
3. **Why per festival, not global:** a view is a view *of a festival* (the share link is
   per festival, and so is the fold). Someone can keep Portola as a list while it is live
   and still plan ACL on its board.
4. **Why per phone, not per crew:** two crews at the same festival on one phone see the
   same wall the same way. It is a viewer's setting and the crew never sees it (the
   mute/hide law, CLAUDE.md).
5. **The share link.** `crew.crewLink(token, fid, me, show, view)` appends `&view=list`
   after `&show=` only when the sharer is on List (Board is the default and sends nothing,
   the same rule as `show`). It goes last, so every older parser still reads the parts
   before it. An old build ignores it. Parse it with
   `viewFromHash(): /[#&]view=(list|board)(?:&|$)/`, captured at boot beside
   `showFromHash` (before replaceState strips the hash).
6. **Past never travels.** It depends on the receiver's clock (a link sent at 5 PM and
   opened at 11 PM has different "past"), and folded is already the right default for
   everyone.
7. **A friend opening a shared link for the first time:**
   1. The rooms and the view the sharer had are applied once, and only on a phone that has
      never shown this festival (`festShownBefore`) and has no setting of its own for that
      part.
   2. `seedShowOnce` becomes `seedViewOnce(fid, { show, view })`: each part is applied
      only if its own key is unset, then one marker (`fn_fold_seeded_v1_<fid>`, reused)
      records that the link was applied.
   3. The seed is written before the first paint, so nothing re-lays out in front of them.
      They also open with the past folded (the default), so at 5:40 PM they land on what
      is on now.
8. **A friend who already had the festival:** keeps their own view. A link never moves it
   (the v92 rule).
9. **The share line** (`inviteViewLine`):
   1. Rooms and view: "Opens on Portola + Afters, as a list — what you're showing now."
   2. View only: "Opens as a list — what you're showing now."
   3. Board with every room showing: no line.
10. **Never written to the crew document:** view, past, folds and reveals. None of the
    menu's rows has a write path. A test should assert that toggling View or Earlier
    never calls `sync.scheduleSync` and never touches `state.crewDoc`.

## 3. The past

### What counts as over (one rule, the NOW ring's own window)

Every card already carries its window on its **own night's** clock: `data-now-from` and
`data-now-to` on grid cells, stack cards and time-list cards. For each host (a grid, a
stack grid, a time list):

- `clock = festivalClock(now, host.tz)`, `at = nightMinutes(host.iso, clock)`,
  `days = clock.iso − host.iso` (whole days).
- **A card is over** when `days ≥ 2`; or when it has a window and `at ≥ nowTo`. If
  `days < 0` or `at` is null, it is not over.
  - A set with no printed end is covered by the same window: +60 min on the grid; in a
    stack, until the next act starts, else the room's close, else +60; in a by-time list,
    the printed end, else the stack rule.
  - Put simply, **a card is over exactly when its NOW ring can never light again.**
- **A card with no window** (untimed on a timed night, Time TBA, cancelled) is over only
  when its **night** is.
- **A night is over** when `days ≥ 2`, or when `days ≥ 1` and every card on it that has a
  window is over. This is what handles the 5 AM rollover. At 6 AM Sunday the Saturday
  Portola grid (closed at 10 PM) and Saturday Afters are over, but Saturday Folsom is not,
  because Aftershock (3–10 AM) is still on. Frame: `rollover-6am-b-390.png`.
- **A room is over** when every card in it is over. **A day is over** when every room in it
  is over.

### Where the cut sits

- **Board, stage grid on a clock:**
  1. `cut = floorToHour(min(max(E, at − 90), at))`, where E is the earliest start among sets
     that are not over, ignoring tall sets (3 hours or more, the grid's own `tall`). Without
     that exclusion, Despacio's 2:45–9:45 PM set would keep the whole afternoon open.
  2. The cut is never more than 90 minutes above now, never below now (so the now line
     always shows), and always on an hour (so the rail starts on a label).
  3. If the cut is under two rows (30 minutes) there is no cut.
  4. At 5:40 PM Saturday the grid starts at 4 PM instead of 1 PM. That is 13 sets folded
     (`cut-grid-390.png`).
  5. Build: the grid's `.times-wrap` goes inside a wrapper with
     `overflow: clip; display: flow-root`. The `flow-root` matters: `overflow: clip`
     creates no block formatting context, so without it the negative margin collapses
     straight through, which the first frames showed. The wrap gets
     `margin-top: -(cutPx − 44px)`, so 44px of the grid above the cut still show. Those
     44px are masked with
     `linear-gradient(transparent 0, .18 at 20px, .6 at 38px, #000 44px)`.
  6. The sticky stage strip stays above everything, and the Earlier line sits between the
     strip and the faded rows.
  7. **A set the cut crosses keeps its words in view.** Its text moves by transform to the
     middle of the part that shows, or to just under the cut for a tall set. The card
     itself does not move. Despacio at 1280 shows this: `cut-grid-1280.png`.
- **Board, venue stacks:** in each column, the finished acts fold into the top of that
  column with a 28px peek. The room's Earlier line sits above the stacks. (Specified but
  not rendered with a half-over example: tonight's afters are either all on or all over at
  the times rendered.)
- **List (by-time):**
  1. Cards that are over leave their bands, keeping their order, and go into one fold at
     the top of the list. A band left empty goes too.
  2. The peek is **the last row that is over, whole and faded** (mask from transparent to
     .5), so you can read what just ended ("MILKED 1–4 PM"). Card bottoms alone read as
     broken boxes, which is what the first cut showed.
  3. Once opened, the cards go back into their bands.
  4. Frames: `cut-list-390.png`, `cut-list-open-390.png`.
- **A whole room over on a day that is not:** the room head stays (it is the note door)
  with one line under it, "ALL 32 SETS OVER ⌄", and no peek (`rollover-6am-390.png`).
- **Whole days over:** one line at the very top of the wall, "EARLIER · THU · FRI · 48 ⌄",
  with no peek. A lone card bottom looked like a stray box. This is where "a scroll to the
  top" now ends: three short lines above SAT PORTOLA instead of about 3,600px of Thursday
  and Friday (`top-after-390.png` against `top-before-390.png`).
- **A future day, or today before doors:** nothing is folded and there are no lines
  (`future-fri-390.png`).

### The line (the door)

- The line is the app's section micro-label: 10px, weight 800, `--track-label`,
  uppercase, `--text-secondary`. It reads "EARLIER · 13 SETS" with the app's caret (⌄ while
  folded, ⌃ once open), followed by the band heads' hairline rule. It is a bare
  `<button aria-expanded>` with no chip, 44px tall, spanning the column.
- The noun is "sets" for the festival room and stacks and "parties" for a by-time
  section. See question 5.
- **A tap reveals that room's past on that date only, for the life of the page** (memory,
  key `<iso>|<room>`). It does not flip the menu's Earlier setting. The room fold can
  share one state with its menu row because both act on every day. A door acts on one
  room on one date, and flipping the global setting from it would unfold every day's past,
  which is the "long way back" Kevin asked to get rid of.
- The days line reveals every folded day at once.

### NOW, the NOW jump, the day row, search

1. The now line is always below the cut, by construction.
2. A NOW tap lands exactly as today (`nowLanding`, `nowStops`). With the past folded, it
   lands near the top of the room.
3. Cards inside a closed fold are never NOW stops. They are all over, so none of them can
   be live. A set the cut crosses is outside the fold and stays a stop.
4. The day-of open scroll is unchanged.
5. **Day row:** the tabs of days that are over stay in the row (it is navigation, and the
   v93 layout rules hold). Tapping one reveals the days line and lands on that day. The
   scrollspy treats the closed days line as part of the first day that is still open, so
   SAT stays lit at the top of the page.
6. **Search ignores the fold.** A query finds past sets too, because it is a question
   about the lineup, not about now.
7. The people highlight never counts or lands on folded cards.
8. **When the fold recomputes:** at boot, when Earlier is toggled, on a NOW or day-tab
   jump, and when the festival day changes. It does not recompute on the one-minute ticker
   or the 25-second poll's repaint, which keep the set of folded cards they had. A set that
   ends while you are reading never vanishes under your thumb, and it folds at the next
   jump or open.

### Motion

- **Reveal** (a door tap, or Earlier ✓ in the menu):
  1. The page holds its place. The first row that is not over stays at the same screen
     height (`takeWallPlace/keepWallPlace`, instant geometry plus scroll compensation).
  2. The fold opens above that row, and the gradient lifts: a page-coloured overlay goes
     from opacity 1 to 0 over 200ms. Animate opacity only, never the mask.
  3. The revealed rows arrive with the beat: opacity .35→1 and translateY(−6px)→0, CASCADE_MS,
     EASE_ARRIVE, staggered 30ms per row starting nearest the cut and moving outward.
  4. The page then glides up by min(revealed height, 45% of the viewport), so the last
     hour of the past visibly comes down into view.
  5. The caret turns (120ms).
  6. Mid-motion frames: `cut-grid-mid-390.png`, `cut-list-mid-390.png`.
- **Fold** (the ⌃ line, or unchecking Earlier), quick and plain:
  1. The past fades to 0 (OUT_MS, EASE_LEAVE).
  2. The room closes up while the first row that is not over holds still, so nothing on
     screen jumps.
  3. The gradient fades back in.
- **Reduce Motion or Low Power:** instant, with the same place held.
- A reveal marks the page busy while it runs (the index.html rule), so a new build's reload
  cannot land in the middle of it.

## How the frames were made

- `rig.mjs` runs a local server over the read-only design-app worktree, with every app
  file that differs on v93 (`V93=e3c20d5`) served straight from git objects. Nothing was
  checked out and nothing was written in either worktree.
  1. `/api` is answered from memory with `../../people-shelf/crew.mjs` (nine made-up
     people).
  2. Every write was refused and counted (23 `POST /api/person` boot pings, all answered
     503).
  3. `/fn-i` was swallowed, and every request that did not go to this server was aborted.
  4. The service worker was stubbed and the clock pinned with `page.clock`.
- `proto.mjs` and `proto.css` are layered on top of the running app. They import the
  app's own `festivalClock` and `nightMinutes`, so the rule in the frames is the rule a
  builder would write.
- `frames.mjs [id-prefix]` renders. Sheets were built with `../../people-shelf/sheet.py`.
- Known prototype limits: the prototype sets the lit day tab itself (a real scrollspy
  would skip the fold), and 320px was not rendered. The View row measures about 170px,
  which fits inside the menu's 168px minimum plus padding, but it is not checked on a
  320px phone.

## Questions for Kevin

1. Menu **B** ("Earlier" as a check row, plus one Board | List glyph row) or **A** ("View:
   Board List / Past: Show Hide" as words)?
2. Should the past be **folded by default for everyone**, including phones already open
   today? I recommend yes. It is the whole point, and one tap brings it back.
3. Should a tap on the line **reveal only that room** for this visit (recommended), or flip
   the menu's Earlier setting for every day?
4. Should List travel in a share link (`&view=list`, recommended) while the past never
   does?
5. Should the line name the thing ("13 SETS", "3 PARTIES") or show a bare count
   ("EARLIER · 13")?
