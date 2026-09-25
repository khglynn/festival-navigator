# NOW — festival-navigator

**last-updated: 2026-09-25 (v87 live) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v87, from `main`** (PR #26, merged 2026-09-24 11:57 PM PT) on fest /
  festival / crew.kevinhg.com — confirmed on all three hosts at 12:00 AM PT
  Fri 2026-09-25 by `curl -s https://fest.kevinhg.com/service-worker.js |
  grep CACHE_VERSION` (festival-nav-v87, ASSET_STAMP 63f88365).
- **Data** (merged under the standing data-only OK): the 2026-09-23 re-read
  (PR #23 — the two Portola Week nights added Sep 17, 21 billed openers, ACL
  Fest Nights per the 9.21 graphic); Thu Club Six's three openers as a
  guessed run (2026-09-24, PR #27); Sun Midway's S.I.M / Espurr / New
  Nostalgia on the bill, untimed (2026-09-25). Every opener in the official
  Portola Week feed is now on the wall.

## Happening now

- What v87 carries: the NOW jump — a NOW tab before the day tabs while
  something is live; taps go down the page stop by stop and wrap; with a
  person highlighted, only their live picks (MODEL-V4 §3d) —
  `claude-plans/2026-09-24-now-jump-build.md`; the full-width now line; the
  zoom that clears the sticky rail and stage strip as well as the dock —
  `claude-plans/2026-09-24-zoom-chrome-build.md`; and an untimed act in a
  timed room is never lit as playing.
- **v88 in build: error capture to PostHog**, branch `feat/error-capture`;
  cut line Fri Sep 25 noon CT.
- Event-page and ticket links: the city-seasons session is building them,
  for v88 or v89.
- What v86 carries, each with its spec or build log in `claude-plans/`:
  1. One line per room (`SAT PORTOLA`, `SAT AFTERS`, `TUE LATE NIGHTS`),
     `.day-block` per day — `claude-plans/2026-09-23-one-line-heads.md`.
  2. Cancelled acts (`artists[].cancelled`), Skepta off Portola Saturday —
     `claude-plans/2026-09-23-cancelled-acts-build.md`.
  3. Your level meter chip (lower left, 1–3 bars then MUST); the crew corner
     never counts you; the fit measures what rendered —
     `claude-plans/2026-09-23-meter-build.md`.
  4. The zoom's who-row as blended level chips with first names, and their
     split / merge / carry motion — `claude-plans/2026-09-23-zoom-chips-build.md`,
     `claude-plans/2026-09-23-zoom-chips-motion.md`.
  5. The strict warm open (~1.6 s on a hanging network, was ~16 s),
     recognize-you, bring-your-picks, Spotify progress, sync-dot honesty,
     shorter share copy — `claude-plans/2026-09-23-crew-join-build.md`.
  6. The strip rides its timeline under Reduce Motion / Low power; a Late
     nights date counts as today; the everything-hidden notice; the WebKit
     tap-ghost zoom fix.
- v86 was checked before ship: 783 unit tests (two timezones), 95 browser
  tests in CI (the meter and zoom-chip contracts on every shipped fest), four
  Codex rounds plus Opus reviews once Codex ran out of credits (until Sep
  29), five real-engine walks, Kevin's own look on a local build. Not on a
  physical iPhone before ship.

## Open with Kevin

- All Portola Week openers are in (nothing held back): Thu Club Six's
  three (PR #27) and Sun Midway's S.I.M / Espurr / New Nostalgia, the Midway
  three untimed so the four named sets keep their guesses (2026-09-25).
- Vercel Web Analytics: the page carries the insights tag, but analytics is
  not enabled on the project — enable it, or remove the tag.
- Small call with a default: How it works dropped "White stroke = you" (you
  are never in the crew corner now). (A half-width 30-min cell hiding its
  start time once picked cannot happen in any shipped fest: ACL renders each
  weekend as its own day, so it has no lane-split cells — checked 2026-09-24.)
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries, so
  that is Kevin's call.

## Next, in order

1. v88 or v89 before ACL (Oct 2), and ACL prep: headliner end times (its
   closers print only a start, so the grid draws them 60 min and NOW stops
   counting them live early — add ends, or run a stage's last endless set to
   the day's close), and the dock's FRI flash on open (ACL lights FRI for
   about a second before finding SAT).
2. Data-only pushes as drops land (standing OK: validator + freeze + tests).
   Portola Sep 26–27 (afters from Sep 24); ACL Oct 2–4 and 9–11.
3. After Oct 11: the merged wall for two crews
   at one fest, add-a-show (`claude-plans/2026-09-02-add-a-show.md`), the
   staging site (fix or retire), the Ray draft.

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
