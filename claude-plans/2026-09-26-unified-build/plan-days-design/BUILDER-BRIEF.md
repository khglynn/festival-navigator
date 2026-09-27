# Builder brief — Our picks across the days, phases P1–P3 (2026-09-26 night)

You are a careful senior engineer and designer on festival-navigator, the app Kevin's
friends are using at Portola this weekend and will use at ACL next week. You build on
branch `live/plan-days-design` in the worktree
`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/plan-days`
(run every command there, never in the root checkout or another worktree). You may
commit and push that branch; you may not touch main, other branches, stamps, PRs or
merges. Start no agents or teammates of your own: your handback is forced before a
named teammate could report, so anything you need, you do.

The lead (the session that sent you) orchestrates, reviews each phase and runs the gate.
You own the build of P1–P3 in `BUILD.md`; the lead may hand you P4–P5 after.

## Read first, in this order

1. `CLAUDE.md` (the repo's laws, especially the fest accent's four places, the 44px floor
   on `button`, the motion canon, frozen pick keys, notes as keyed objects, the public
   repo, the SW, browser-history ownership, and both browser input traps).
2. `claude-plans/2026-09-26-unified-build/plan-days-design/BUILD.md` (the phases, the
   gate, the base, and the log you will extend).
3. `DESIGN.md` beside it, in full. Its sections A, B, C and "What changes in code" are
   the spec. The questions at its end are settled: every default, and for C3/C6, two
   together for 2–4 highlighted people, `barFor(n)` from five.
4. `BRIEF.md` beside it, for the design round's intent, and `review.html` if you want
   to see the frames Kevin approved.

## Why this build exists

1. Kevin's crew's Saturday lost six real sets once seven people picked Despacio, an
   all-day room. The plan kept seating people there. A drop-in room has to yield
   (rule 9).
2. The open plan showed one night, so on a Saturday nobody could see or share Sunday.
   For ACL, with Late nights running Sep 29 to Oct 10, that is most of the festival.
3. Opening a menu closed the plan, and a highlight only dimmed rows. So "what's our
   plan, just the three of us?" had no answer.

The prototype on this branch already does most of this. It was built as a design
rig, with switches for rejected alternatives and three unit tests left red on
purpose. Your job is to make it the product: one path, tested red-first, and every
edge case as designed.

## What exists, and exemplars

- `js/v3/plan.js` (rules 9–10, `barForGroup`), `js/v3/plan-rows.js` (`planDays`,
  `dayRows`, `planText`, `rowsKey`), `js/v3/plan-shelf.js` (`paintHead`, `nightAtTop`,
  `fitTail`, the per-day Share), and `js/v3/app.js` (`planAnswer`, `dayOf`,
  `emptyWords`, `who`).
- The Share's hardening from main must survive every change you make. `sharePlan`
  repaints at the tap's minute (`forced`) and reads only `drawn`. A tap under a held
  paint sends nothing. `holdForShare`/`dropShares` mark the body. `afterArrival` and
  `stint` make a plan link open only on the wall it landed on. Read
  `claude-plans/2026-09-26-unified-build/SHARE-BUILD.md` items 13–20 for why: each was a
  real bug Sol found.
- Exemplar tests: `tests/plan-text.test.mjs` (model goldens with the made-up nine,
  `tests/fixtures/plan-crew-nine.json`), `tests/browser/plan-share.test.mjs` (a real
  browser with `/api` answered in the page and `holdArrival` for motion ordering), and
  `tests/browser/plan-drag.test.mjs` (`openPhone`, `motionDone`, fonts). The rigs
  `crew-despacio.mjs`, `crew-acl.mjs` and `print-route.mjs` in the design folder print
  routes for the crews in DESIGN.md.
- `origin/live/v103` is v104, landing on main Monday. Its `passesPeople`, day row and
  highlight menu are the seams P3 meets. Read them there, and build so that the merge
  is small.

## Rules that bite

1. Red first. Every behaviour change gets a test that fails on the code before it,
   and you say so in the log with the failure line.
2. Bank as you go. Before your first edit, add a "P1 (in progress)" line to BUILD.md's
   log, then grow it. Commit WIP on the branch at every green step, with
   scope-prefixed messages (`plan:`, `test:`, `docs:`), never "wip". Scan before
   every commit:
   `! git diff --cached | grep -qE '#g=[A-Za-z0-9_-]{16,}' && git commit …`.
   Build test tokens from variables, never literals. End each message with:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
   `Claude-Session: https://claude.ai/code/session_01SDyAPRJqh1hbG9viUb2qKA`. Push after
   each commit.
3. Never load a real crew link, never touch production or a preview with a real crew,
   and never write the database.
4. Run browser suites one at a time (`BROWSER_TEST_REQUIRED=1 node --test <file>`), at 0
   and at `LATE_ANIMATIONS_MS=700`. The machine is shared, so if one unrelated test
   fails under load, run it alone before believing it. The tap-shelf composer test has
   a known ~1% CI flake: its text stops after a space. Re-run it; don't debug it.
5. Motion follows the canon in CLAUDE.md: nothing pops, and it is instant under Reduce
   Motion or Low Power (`canAnimate`). A new layer that Back must close joins
   `js/v3/router.js`. A menu takes no history entry.
6. Don't stamp (`scripts/sw-stamp.mjs`). The coordinator does it at release.
7. `node_modules` in this worktree is a symlink to the plan worktree's install. Leave
   it alone.

## Done, per phase

`npm test` is green except the SW stamp. Every browser suite that touches the plan
(`plan-share`, `plan-drag`, and any you add) is green at 0 and at 700. BUILD.md's log
has the phase with its commits, its red-first evidence, and anything you doubt. Then
stop, and send the lead a short handback. In your final message, list what changed,
the head SHA, the test lines, and your doubts: what you're unsure of and what you
decided that the design didn't cover. Ask about a product call Kevin hasn't made,
rather than guessing. P2's link-for-a-later-night default is already in BUILD.md.
