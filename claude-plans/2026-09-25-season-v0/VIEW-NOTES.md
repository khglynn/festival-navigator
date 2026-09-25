# Season view — builder's notes (2026-09-25)

Branch `seasons/view` (worktree `.claude/worktrees/season-view`), cut from
`seasons/austin-v0` at 4c4f7f1. Brief: `VIEW-BRIEF.md` beside this file.
A restart picks up from here and the last commit.

## Status (bank)

- [x] Read the brief, PLAN, CLAUDE.md laws, the memories, the 09-24 canvas
- [x] Baseline: `npm test` 884 pass / 1 skip (42 s, concurrency 3)
- [ ] Model (events.js, pure): months from today, weeks, YOURS
- [ ] Wall (wall.js): the season path, search, tabs
- [ ] Shell (app.js): open on today, YOURS arrival, keep place, sort hidden
- [ ] Unit tests (pinned clock) + browser contract for the season
- [ ] Real-browser walk at 390 and 1280
- [ ] Push, preview URL, throwaway crew

## Decisions (and why)

1. **The season shows from today on.** Past months drop off (brief), and so do
   past days of the current month: every card on the season wall is a show you
   can still go to. With past days kept, the OCT tab would land on Oct 1 all
   month long and a late-October open would scroll past 150 finished shows.
   The file keeps every past show (names never disappear); only the view
   hides them. A month shows while it has a show dated today or later.
2. **Week heads, one line each** (`OCT 5 – 11`, sub `THIS WEEK` / `NEXT WEEK`):
   Kevin allowed "by weekend" dividers if they earn their place; in a
   178-show October they are the only landmarks. A week is Monday to Sunday,
   clamped to its month (so a week never names another tab's dates).
3. **The card says the date** (`Fri · Sep 25`, plus the start time when the
   show has one). Doors, the location and the links are in the zoom.
4. **YOURS is one list**, soonest first (the canvas's measured
   recommendation: 1,090px vs 3,950px as night rooms).

## Checked (where, at which widths)

(filled in as the walks happen)

## Weakest

(filled in)

## For Kevin

(filled in)
