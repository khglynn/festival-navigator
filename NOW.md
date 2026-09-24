# NOW — festival-navigator

**last-updated: 2026-09-23 (pre-Portola round) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v85 app, from `main`** (PR #19, 2026-09-17) on fest / festival /
  crew.kevinhg.com.
- **Data refreshed 2026-09-23** (PR #23, merged under the standing data-only
  OK): the two Portola Week nights added on Sep 17 (Fri The Midway: The Hellp
  & Bassvictim; Sat 888 Garage: Boys Noize), 21 billed openers, Sat Regency's
  9:15 PM start, Folsom's Magnitude close (4 AM), ACL Fest Nights per the
  official 9.21 graphic (Paloma Morphy postponed, Stubb's Indoors split, six
  additions). The validator keys a night-section act by its night, so one act
  on two nights is two shows.

## Happening now

- **v86 waits for Kevin's walk and yes**: draft PR #24, branch
  `integrate/prefest-0923`. Promote = merge #24 (production is Kevin's call).
  The read-back page with the preview link and a 10-minute phone walk is the
  "Portola Weekend Release" artifact (kevin.hq@tecovas.com login).
- What v86 carries, each with its spec or build log in `claude-plans/`:
  1. One line per room (`SAT PORTOLA`, `SAT AFTERS`, `TUE LATE NIGHTS`),
     `.day-block` per day — `claude-plans/2026-09-23-one-line-heads.md`.
  2. Cancelled acts (`artists[].cancelled`), Skepta off Portola Saturday, the
     Crane Stage per the v2 flyer — `claude-plans/2026-09-23-cancelled-acts-build.md`.
  3. Your level meter chip (lower left, your colour, 1–3 bars then MUST); the
     crew corner never counts you; the fit measures what rendered —
     `claude-plans/2026-09-23-meter-build.md`.
  4. The strict warm open (a phone with the exact wall cached paints in
     ~1.6 s on a hanging network, was ~16 s), recognize-you, bring-your-picks,
     Spotify progress, sync-dot honesty, shorter share copy —
     `claude-plans/2026-09-23-crew-join-build.md`.
  5. The strip rides its timeline under Reduce Motion / Low power; Diagnostics
     shows the route; a Late nights date counts as today; the everything-hidden
     notice; the WebKit tap-ghost zoom fix in `js/v3/card-facts.js`.
- Checked: 760 unit tests (two timezones), the browser suite in CI (Linux
  Chromium) and locally (+ WebKit), four Codex rounds (all findings fixed;
  Codex is out of credits until Sep 29), three real-engine walks. Not yet on a
  physical iPhone — Kevin's walk is that check.

## Open with Kevin

- The zoom's "everyone's level" is BUILT on branch `feat/zoom-chips` (not
  pushed, not in #24): one blended chip per level, the card's aura mixed from
  its people, the meter's glyph, first names — Kevin liked it on a local check.
  Its motion (carry, split, merge, both, first pick, clear) is in, watched
  frame by frame in Chromium and WebKit, with the reviewer's fixes;
  storyboard `claude-plans/2026-09-23-zoom-chips-motion.md`, build log
  `claude-plans/2026-09-23-zoom-chips-build.md`. Next: Kevin's look
  (gallery.html row 19 has a button per case, plus Slow motion ×4). Canvas:
  https://claude.ai/artifact/ShW4NLwgdtqMQxnAu43Pbh
- Small calls with defaults: a half-width 30-min cell hides its start time once
  picked (ACL both-weekends view only); How it works dropped "White stroke =
  you".
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries, so
  that is Kevin's call.

## Next, in order

1. Kevin walks the v86 preview; merge #24 on his yes; delete the walk's
   throwaway crew.
2. Data-only pushes as drops land (standing OK: validator + freeze + tests).
   Portola Sep 26–27 (afters from Sep 24); ACL Oct 2–4 and 9–11.
3. The who-chips branch: Kevin's look, then his call on shipping it before
   or after the weekend. After Oct 11: the merged wall for two crews
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
