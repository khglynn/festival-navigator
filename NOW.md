# NOW — festival-navigator

**last-updated: 2026-09-26 6:50 AM PT (v97 live) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v97, from `main`** (PR #54, merged 2026-09-26 6:42 AM PT) on fest /
  festival / crew.kevinhg.com — `ops/prod-smoke.mjs` PASS (festival-nav-v97 /
  07ca84c4): the List view (Board · List in the Show menu, per phone per
  festival, `&view=list` in a link and in the address), the past folded
  behind EARLIER, and the menu bar `dot · FEST '26 · ☰`. v96 (5:36 AM) brought
  NOW into the day row, the menu popover, Invite someone, the Portola-app
  import and link previews. What each release carries and how it was checked:
  the LEDGER.
- **Alerts:** PostHog → Slack for a new error and one that came back
  (`ops/posthog/`), each saying what the error means in plain words.

## In flight (Portola live ops + the unified build, 2026-09-26)

One coordinator session releases; rules in
`claude-plans/2026-09-25-portola-live/RUNBOOK.md`, calls and reviews in the
LEDGER beside it, the build's cursor in
`claude-plans/2026-09-26-unified-build/NOW.md`. A release ships on CI green
+ a Sol 6 review + an independent real-browser walk + prod smoke.

1. **The tap change** (`live/tap`): a phone tap opens the notes shelf with
   full controls; desktop keeps hover. Sol's review round in progress
   (VoiceOver's double-tap, the composer over the iOS keyboard). Ships ALONE,
   only after Kevin tries it on his iPhone from a preview link.
2. **People menu + Invite sheet** (`live/people`, building): the avatar opens
   a Highlight menu, the twin of Show; one Invite sheet with the crew link first.
3. **Our plan** (`live/plan`, a sibling session): the peek above the dock and
   the day plan; it hands a gated head to the coordinator to release.
4. **ACL prep** (`data/acl-prep`): Late nights times (doors only today) from
   printed pages and the venue registry, never a guess later than the show.

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
