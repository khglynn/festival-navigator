# NOW — festival-navigator

**last-updated: 2026-09-26 2:20 AM PT (v95 live; v93 in flight as v96) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v95, from `main`** (PR #49, merged 2026-09-26 2:12 AM PT) on fest /
  festival / crew.kevinhg.com — `ops/prod-smoke.mjs` PASS (festival-nav-v95 /
  376ec98a). Tonight's releases, in order: v92 (1:26 AM — a guest's first
  open: wall first, join shelf, the − · note · + zoom row), v94 (1:44 AM —
  Folsom weekend by time, every verified party, NOW to each party's own
  end), v95 (2:12 AM — ticket doors say the price, never the seller). What
  each carries and how it was checked: the LEDGER below.
- **Alerts:** PostHog → Slack for a new error and one that came back
  (`ops/posthog/`), each saying what the error means in plain words.

## In flight (Portola live ops, 2026-09-26)

One session runs this lane (city seasons is paused on its branches — leave
them). Rules: `claude-plans/2026-09-25-portola-live/RUNBOOK.md`. Kevin's
calls, releases and reviews: the LEDGER beside it — read "Kevin's calls"
first. A release ships on CI green + a Sol 6 review + a real-browser walk +
prod smoke.

1. **v93 → ships as build v96** (`live/v93`, main merged in): NOW as a tab
   in the day row, the Show menu staying open across ticks (a tick keeps
   your place), "+ Invite someone", the caret and gear. Its menu's own
   history entry is the last open problem (Sol found Back holes twice);
   fallback if it can't be made airtight: the menu closes on each tick as
   before, and the multi-toggle menu moves to the unified build.
2. Then the unified build (`claude-plans/2026-09-26-unified-build/PLAN.md` +
   REVIEW-1.md + the calls at its top), ordered by build quality.

## Open with Kevin

- Small call with a default: How it works dropped "White stroke = you" (you
  are never in the crew corner now).
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries, so
  that is Kevin's call.

## Next, after the live lane

0. Tonight's non-blocking follow-ups: the LEDGER's "Follow-ups found
   tonight" (a hold lost to the first-boot repaint, reports with no build,
   test hold helpers).
1. ACL prep before Oct 2: headliner end times (its closers print only a
   start, so the grid draws them 60 min and NOW stops counting them live
   early — add ends, or run a stage's last endless set to the day's close),
   and the dock's FRI flash on open (ACL lights FRI for about a second before
   finding SAT).
2. After Portola: self-recovery when a phone boots a months-old cached module
   beside new ones (one iPhone, `js/time.js`, SyntaxError, 3:47 PM Sep 25) —
   update-machinery work; and a guard against a sync push to the wrong crew.
3. Data-only pushes as drops land (standing OK: validator + freeze + tests).
   ACL Oct 2–4 and 9–11.
4. After Oct 11: the merged wall for two crews at one fest, add-a-show
   (`claude-plans/2026-09-02-add-a-show.md`), the staging site (fix or
   retire), the Ray draft.

## Banked, not built

- The schedule-drop watcher:
  `claude-plans/2026-08-27-schedule-drop-watcher-future-build.md`.
- An AI festival import graded by an eval against the festivals we ship.
- A sticky member-chip row · duplicate person rows for Portola crew members
  (an idempotent claim fixes it) · the deferred sync and merge hardening list
  in DEVLOG 2026-08-23 · day-to-day grid scroll mirroring only on scroll end
  (needs Kevin's yes).

## Where the rest lives

- Rules: CLAUDE.md. History: DEVLOG.md (search it; do not read it whole).
  Specs and plans: `claude-plans/README.md`.
- Backups taken 2026-09-23 before any delete: Neon branch
  `backup-2026-09-23-prefest` and JSON exports outside the repo.
- NOW before 2026-09-16:
  `claude-plans/archive/2026/now-history-2026-07-07-to-2026-09-02.md`.
