# Sol (Codex gpt-6-sol, high) on af238e9 — 2026-09-27, 10:49 AM PT

The final targeted check of the round after `SOL-R2.md` (run `cx-20260927-104637-91263-b22d45`; read-only, no browser suites while the builder drove browsers). It ran the unit suite pinned twice, a week before the festival and on the live Saturday night, because the machine's clock turns about 62 unit tests red from 10 AM on Portola Sunday (see `CLOCKS.md` on `fix/test-clocks`).

**The lead's check before passing it on:**

1. **Nothing blocks.**
2. **The IMPORTANT holds.** 8f76795 moved the Earlier line across the time and count columns, but its words still inherit `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` from `.plan-what .nm` (v3.css ~2002). Three nights that are not consecutive keep all three labels. With long labels (a Late nights date, then weekend days) plus a stop count, the line is wider than its span at 320px, and at 390 too:
   a. Estimated: "EARLIER · SEP 29 · OCT 1 · FRI 2 · 3 STOPS" is about 315px of 10.5px small capitals, against about 230px available at 320.
   b. So "never cut" held for the cases the round tested (Portola's Thu–Sat, ACL's spans), not for every three-label line.
   c. The fix is to let the Earlier line wrap (`white-space: normal; overflow: visible`), keeping the chevron's room. Red first, at 320, on that worst case.
3. **The NIT holds.** ca12ba2's guard asserts that every row names *a* night, not the *right* one. Rows mistagged with the previous night would pass it. It should assert the expected night for rows on both sides of a day boundary.

Both go to the builder after `fix/test-clocks`.

---

**BLOCKER:** None.

**IMPORTANT** — [assets/v3.css:2025](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/gate-plandays/assets/v3.css:2025): The Earlier line still inherits `white-space: nowrap`, hidden overflow, and ellipsis from `.plan-what .nm`. At 320px, ACL’s three nonconsecutive earlier dates can produce “Sep 29 · Oct 1 · Oct 2” plus a folded-stop count; the text cannot wrap and may be cut. Let `.plan-row.earlier .nm` wrap, keep space for the chevron, and test that gap case at 320px.

**NIT** — [tests/plan-text.test.mjs:366](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/gate-plandays/tests/plan-text.test.mjs:366): The new guard checks that each row has *a* `data-night`. It would pass if Sunday’s rows were all mistakenly tagged Saturday, causing the head or Share to name the wrong night. Assert the expected night for representative rows across the day boundary.

The close-state callers and interruption paths show no further finding. The date comparison uses consecutive calendar dates, including across months; single nights, two nights, and dated Late nights retain their labels. Both requested pinned unit runs: **1,292 passed, one failed, one skipped, one todo**. The sole failure was the expected unstamped service worker asset check. Browser suites were not run; tracked files are clean.