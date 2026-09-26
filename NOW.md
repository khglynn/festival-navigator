# NOW — festival-navigator

**last-updated: 2026-09-26 12:40 AM PT (v91 live; v92–v94 in flight) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v91, from `main`** (PR #42, merged 2026-09-25 7:59 PM PT) on fest /
  festival / crew.kevinhg.com — `ops/prod-smoke.mjs` PASS at 8:01 PM
  (festival-nav-v91, ASSET_STAMP c01adb1c). What v87–v91 carry, and how the
  live lane ships: DEVLOG.md, 2026-09-24 → 26.
- **Alerts:** PostHog → Slack for a new error and one that came back (#45,
  #46; `ops/posthog/`), each saying what the error means in plain words.
- **Data:** every Portola Week opener in the official feed; Folsom so far is
  MÜLL, Big Muscle, Aftershock (PR #40) plus the parties that were already in.

## In flight (Portola live ops, 2026-09-26)

One session runs this lane (Kevin closed the others; city seasons is paused on
its branches — leave them). Rules: `claude-plans/2026-09-25-portola-live/RUNBOOK.md`.
Kevin's calls, releases and reviews: the LEDGER beside it — read "Kevin's
calls" first. Each release ships on CI green + a Sol 6 review + a real-browser
walk + prod smoke, in this order:

1. **v92** (`live/v92`, PR #43): a guest lands on the wall with a welcome
   card; joining is a shelf; the zoom's bare − · note · + row for everyone;
   zoom text never breaks inside an item. Last fixes in, then re-stamp, re-gate,
   merge.
2. **v93** (`live/v93`): NOW as a tab beside the live day, + Add someone, a
   solid ring on the +n overflow, the Show menu stays open, a gear on
   Settings, a caret after the fest name. Built on an older base; rebase onto
   main after v92 using the five hunks in its build log's "Rebasing onto v92".
3. **v94** (`live/v94` + `data/folsom-all`): Folsom by time (declared in the
   data) and every verified Folsom-weekend party.
4. **Ticket prices** (`data/tix-prices`): doors read `Tix` / `Tix $69` /
   `Info`, never the seller; a one-time price and sold-out check for Portola
   Sat/Sun and ACL Late nights. Rides the first release after it lands.

Then the unified build (`claude-plans/2026-09-26-unified-build/PLAN.md` +
REVIEW-1.md + the calls added at its top): ordered by build quality, not the
calendar.

## Open with Kevin

- Small call with a default: How it works dropped "White stroke = you" (you
  are never in the crew corner now).
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries, so
  that is Kevin's call.

## Next, after the live lane

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
