# Our plan — build log (sibling session "Our plan build", started 2026-09-26 ~4:40 AM PT)

Branch `live/plan` (worktree `.claude/worktrees/plan`), based on `live/list` @ aba41c3
(v93 underneath: NOW tab in the day row, the Show menu popover). Handoff:
`OUR-PLAN-HANDOFF.md` beside this file. Coordinator session: festival-navigator-81 —
it merges, stamps, opens the PR and runs the prod smoke. This session never does.

## What "done" means here

Kevin's call #5 (LEDGER): a peek row just above the dock (artist big, place under it;
NOW/NEXT with its time just left of the count; one second-line size) that drags up into
the whole day plan in the same rows (quiet times, bigger artist names); on a laptop a
corner card with an Open button that grows into a 400px right panel, the wall still
usable; one NOW once it exists; an artist who plays twice counts at both places; hidden
rooms stay hidden; the bar is max(3, ceil(pickers/4)). No "Tell a friend".

Gate before handing to the coordinator: `npm test` at UTC, Asia/Tokyo and the night
clock; `npm run test:browser` (Chromium + WebKit locally); a Sol 6 review with real
findings fixed; an independent Sonnet walker with real input.

## Steps (each one a commit on live/plan, pushed)

0. This log.
1. Fresh map of the current head (the maps in this folder describe plan-base abe7205;
   v93 and the List build have moved app.js / wall.js since) — `our-plan/map-*.md`.
2. U6: `week.js` lifted out of wall.js (re-exported), `liveWindowOf` in its own commit,
   `plan.js` ported from `design/ours-r2/ours-model.mjs` with the four ACL fixes.
3. Design pass for the undrawn states (frames rendered by the production app) → a
   review page of this session's own with tap-answerable decisions.
4. The floor line the peek needs (`--foot-h`), the peek, the drag into the day plan.
5. The laptop corner card and 400px panel.
6. Gate, then SendMessage the coordinator with the head SHA, results and frame paths.

## Log

- 2026-09-26 ~4:40 AM PT — read the handoff, PLAN.md (§2.5–2.7, U4, U6–U8, §4, §6),
  REVIEW-1, map-plan-now-dock, the round-three BRIEF and its frames, the LEDGER's calls,
  the review page's `ours-*` / `r5*` decisions (there are no `r4-*` rows in the
  collection; round four's answers are the LEDGER's calls #1–#5).
