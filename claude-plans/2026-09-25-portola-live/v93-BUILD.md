# v93 — NOW beside the live day, "+ Add someone", a solid +3 ring (build log)

Started 2026-09-25 ~10:15 PM PT. Branch `live/v93`, worktree
`.claude/worktrees/v93`, based on v92's pushed head (abe7205) so it rebases
cleanly onto the final v92. Builder: an Opus teammate.

## Why

Kevin approved these on the review page (round 3/4 defaults, 2026-09-25):
the dock's NOW is pinned to the left, which pushes THU off at 390 and at 320
shrinks NOW to a dot and the days to slivers ("RI | SAT | S"); he called the
dot "a bit too clever" and asked for clean solutions. Design:
`claude-plans/2026-09-25-portola-live/design/ours-r2/BRIEF.md` (in the
portola-live worktree: /Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live/claude-plans/2026-09-25-portola-live/design/ours-r2/),
section "The dock: D1 / D2", frames `frames/D0-*.png`, `frames/D1-*.png`.

## The three items

1. **D1 — NOW joins the day row.** While something is live, NOW is a tab in
   the scrolling day row right after the live day (`SAT · NOW`), brand violet
   with the live dot (never the festival accent — CLAUDE.md's four places).
   The row keeps that pair in view and never leaves a sliver at either edge:
   390 shows `FRI SAT NOW SUN`, 320 shows `SAT NOW`; nothing is pinned; the
   fest name never gives way. Motion: NOW fades in from 6px left while the
   tabs after it slide right (the existing tab FLIP); the row glides to
   centre the pair; when nothing is live NOW leaves quick and the next day
   slides back. `fitNowTab`'s dot and squeeze retire. The NOW jump's
   behaviour (stops, cycle, highlight, stack-row slide from v91) is unchanged
   — only where its tab lives. Desktop: the same row.
2. **"+ Add someone"** replaces "+ Add" in the people row (the words Settings
   already uses), so the plus says what it does. Check the row at 390 with six
   people and at 320.
3. **The +3 overflow on a card's crew corner gets a solid ring** instead of a
   dashed one, so dashed only ever means "add". Check the corner fit rules in
   `js/v3/aura.js` (GIVE_WAY) still hold.

## How to work

Same rules as v90–v92 (only this worktree; commit and push as you go on
`live/v93`, a preview only; no PR/merge/stamp; no crew-data, sync, merge,
artist-name or update-machinery changes; never load production with a crew
link or write to the production database; one suite and one browser at a
time). Tests: the dock/NOW unit and browser tests that pinned the old dot
behaviour change to pin D1 (name them in the Log); walk the dock at 320, 390,
430 and 1280 with something live and nothing live, a NOW tap, and a day
switch; screenshots into `v93-shots/`. One full `npm test` at the end.

## Log

- 22:25 PT — started. Read the brief, CLAUDE.md, the design (BRIEF.md "The dock: D1 / D2",
  frames D0/D1, docks.png). Baseline walk of the v92 dock: 320 = ringed dot + "RI | SAT | S";
  430 = a "HU" sliver of THU at the left edge.
- **D1 built** (cde8607, 3fc74f5). NOW is a tab in the day row after the day a tap would land
  on, in the dock and the rail; parked hidden just outside the row when nothing is live, and
  lifted out/put back around every rebuild (each repaint keeps the row's scroll, so a friend's
  pick on the poll moves nothing). Where a row rests is one pure rule, `wall.js restingLeft`:
  the day you are in whole > NOW whole > its day whole > those clear of the edge fades > no
  sliver at an edge (a tab past an edge shows <= 6px or is cut <= 6px) > closest to centring.
  Results (Portola, Chromium, 2x): 320 `SAT NOW` exactly; 375 `FRI SAT NOW`; 390 `FRI SAT NOW
  SUN` (the frame); 430 all five (see next); Sun live NOW is the last tab (`SAT SUN NOW` at 390);
  Thu live `THU NOW FRI SAT` (a day with no festival room); ACL 375/390 `SAT 3 NOW`.
  `fitNowTab`, `.now-tab.compact`, `.dock.squeezed` retired; the fest name never gives way.
- **A row that nearly fits, fits** (`fitDayRowGap`): its gaps tighten from `--gap` 24px down to
  `--gap-min` 16px before it scrolls. Portola's five at 430 (26px over) and four days at 375
  (16px over, nothing live) now show whole instead of a THU fragment. Measured against the real
  scroll range (the last tab's 2px touch reach counts).
- Found by measuring, fixed: (1) tab offsets are whole px while the range rounds, so NOW after
  SUN read 0.5px "not whole" and hid — 1px slack; (2) NOW's arrival transform shrank
  `scrollWidth` 2px mid-rest — the range is read from layout, and a zero-width end mark holds
  it while tabs slide; (3) a stale "overflowing" after a slide — edges marked from layout.
- **Motion**, filmed at 0.1x (CDP playback rate): NOW fades in 6px from the left in its own
  place a beat after the tabs start (first cut rode with SAT and started on top of SUN); the
  tabs FLIP from old screen place to new (instant re-rest + transforms, so each tab moves once);
  leaving, NOW fades quick and plain, then the room closes up crisp (EASE_SURFACE); the edge
  fades hold through the slide (`holdDayRowEdges`) so THU comes back out of a fade, not a hard
  cut. Reduce Motion: instant, 0 animations on the row.
- **+ Add someone / solid +n** (fbb7eb0). How it works row 2 draws and names the same chip
  (Kevin's sentence kept, label updated; MODEL-V4 §3a.4 + docs-truth pin follow). The welcome
  card's +n more is solid too. Chip is `white-space: nowrap`.
- **Show menu (coordinator, from Kevin)** (96c8593): stays up across toggles; closes on a tap
  outside (swallowed — never picks the card under it), Escape, the fest name again, Back; a
  router `menu:` layer, so history ends as it found it and Settings takes the entry over.
  Gear = the header's path at 12px in the check column, --text-secondary. Row :hover only
  under `(hover: hover)` (a finger left the tapped row grey). No hide-everything guard exists
  in the menu today; hiding all rooms shows the wall's notice — unchanged.
- Tests so far: `restingLeft` exercised through `tests/wall-filters.test.mjs` (its mocked row
  made consistent), `tests/router.test.mjs` +2 (menu layer), `tests/shell-v4.test.mjs` (menu
  stays up; four ways out + history; outside tap reaches no card; Settings takes the entry;
  the gear). Next: pure `restingLeft` cases, the browser NOW tests that pinned the dot.
