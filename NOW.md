# NOW — festival-navigator

**last-updated: 2026-09-24 (v86 live; v87 in review) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v86, from `main`** (PR #24, merged 2026-09-24 ~01:40 CT) on fest /
  festival / crew.kevinhg.com — confirmed on all three hosts by `curl -s
  https://fest.kevinhg.com/service-worker.js | grep CACHE_VERSION` (v86,
  ASSET_STAMP cac7172f).
- **Data refreshed 2026-09-23** (PR #23, merged under the standing data-only
  OK): the two Portola Week nights added on Sep 17 (Fri The Midway: The Hellp
  & Bassvictim; Sat 888 Garage: Boys Noize), 21 billed openers, Sat Regency's
  9:15 PM start, Folsom's Magnitude close (4 AM), ACL Fest Nights per the
  official 9.21 graphic. Re-checked against the official feed 2026-09-24: same
  20 events; the two held-back items are under Open with Kevin.

## Happening now

- **v87 in review: the NOW jump**, branch `feat/now-jump` (pushed): a NOW
  tab before the day tabs, shown only while something is live; tap lands on
  the now line (or the first NOW card after Pier 80 closes); with a person
  highlighted it lands on their live pick with the now line in view —
  "where is Ross right now" in two taps. Rules: MODEL-V4 §3d; log:
  `claude-plans/2026-09-24-now-jump-build.md`. Kevin looked at it on
  localhost on 2026-09-24: "It looks good". His look found two things, both
  fixed before ship: the now line stopped at the first screen's width
  instead of crossing every stage column (v86 has this too; fixed on the
  branch), and on desktop a hover zoom near the bottom could cover the dock
  (being fixed on the fix/zoom-dock branch; it goes into v87 only if it
  lands clean). An independent Opus review found six more (a pulse on a
  stranger's card when a highlighted friend has nothing on, the afters just
  after close, level ties, the dock's glimpse, a listener leak, a tall set
  on a small phone): all fixed on the branch, each with its test. 796 unit
  tests, 122 browser (Chromium + WebKit locally).
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
- Checked before ship: 783 unit tests (two timezones), 95 browser tests in CI
  (the meter and zoom-chip contracts on every shipped fest), four Codex rounds
  plus Opus reviews once Codex ran out of credits (until Sep 29), five
  real-engine walks, Kevin's own look on a local build. Not on a physical
  iPhone before ship.

## Open with Kevin

- Held back from the Portola afters, waiting on Kevin: the Thu Club Six
  openers and Sun Midway's S.I.M / Espurr / New Nostalgia, which the official
  feed lists. One data-only push once he says yes.
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

1. v87: the now-line width fix, the zoom/dock fix if it lands clean, and
   the review's findings; then a PR from `feat/now-jump` to main, CI green,
   and Kevin's "ship v87" before Sat Sep 26.
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
