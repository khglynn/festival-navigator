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
  frames D0/D1, docks.png). Baseline walk of the v92 dock next.
