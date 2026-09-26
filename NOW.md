# NOW — festival-navigator

**last-updated: 2026-09-25 (v89 live) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v89, from `main`** (PR #33, merged 2026-09-25 2:50 PM PT) on fest /
  festival / crew.kevinhg.com — confirmed on all three hosts at 2:52 PM PT
  (festival-nav-v89, ASSET_STAMP 4ad32b2f). The first release shipped under
  Kevin's standing rule: CI green plus a clean independent review, no ask
  (CLAUDE.md, "Deploy is gated"). v88 (release PR #31) went out at 1:20 PM.
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
- What v88 carries: event-page and ticket doors in the zoom for every
  afters, Folsom and Late-nights show ("Event pages and tickets" in
  `docs/add-a-festival.md`); the app reporting its own errors to the PostHog
  project "Festival Navigator" (627900) through `js/errlog.js`, crew links
  and notes scrubbed, a Settings switch —
  `claude-plans/2026-09-24-analytics/BUILD.md` (design, Eachie audit and the
  shared Slack message design beside it); no zoom-on-focus on iPhone (iOS
  alone gets `maximum-scale=1`), no double-tap zoom, the search box shaped
  like a text field (Kevin, live at Portola). Walked in a real browser; the
  walk's one bug (a door tapped in the settle beat closed the zoom) is fixed.
  Kevin checked it live: no zoom anywhere when typing.
- What v89 carries (Kevin's v88 feedback, 2026-09-25): the zoom's notes chip
  opens on the first tap on iPhone (Safari's unfocused button had sent focus
  nowhere and closed the zoom — diagnosed from his phone's own PostHog
  reports); holding a note reveals its actions instead of selecting text on
  touch (so note text can't be copied on a phone — offered back on a second
  hold if Kevin wants it); no undo toast when a must clears; error kinds read
  as words in PostHog.
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
- Small call with a default: How it works dropped "White stroke = you" (you
  are never in the crew corner now). (A half-width 30-min cell hiding its
  start time once picked cannot happen in any shipped fest: ACL renders each
  weekend as its own day, so it has no lane-split cells — checked 2026-09-24.)
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries, so
  that is Kevin's call.

## Next, in order

1. Portola live ops (from 2026-09-25 evening): one session ships friends'
   feedback while Kevin is on his phone, by
   `claude-plans/2026-09-25-portola-live/RUNBOOK.md` (lanes, ship, undo, red
   lines); items, releases and the Codex model comparison are in the
   LEDGER beside it. Round 1: v90 (stack alignment, taller notes button, a
   get-latest control) in build; OURS and first-open designs out for Kevin's
   review; Folsom-weekend events being researched.
2. ACL prep before Oct 2: headliner end times (its closers print only a
   start, so the grid draws them 60 min and NOW stops counting them live
   early — add ends, or run a stage's last endless set to the day's close),
   and the dock's FRI flash on open (ACL lights FRI for about a second before
   finding SAT).
3. Install the app's PostHog → Slack alerts (a new error, an error that came
   back) from `ops/posthog/` — not installed yet. Slack is connected to
   project 627900 (2026-09-25) and Kevin's four calls are recorded in that
   folder's README; a Pen card tracks it.
4. Data-only pushes as drops land (standing OK: validator + freeze + tests).
   Portola Sep 26–27 (afters from Sep 24); ACL Oct 2–4 and 9–11.
5. After Oct 11: the merged wall for two crews
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
