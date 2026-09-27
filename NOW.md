# NOW — festival-navigator

**last-updated: 2026-09-26 10:30 PM PT (v103 live) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v103, from `main`** (PR #64, merged 2026-09-26 10:18 PM PT) on fest /
  festival / crew.kevinhg.com — `ops/prod-smoke.mjs` PASS (festival-nav-v103 /
  9182c367): the Share for Our picks (up to five lines read from the rows the
  open plan just drew, a link that opens that night's plan, the welcome ✕,
  "Share the crew link" in the Show menu). Earlier on Sep 26: v97 List ·
  data #56 ACL Late nights times · v98 a phone tap opens the notes shelf ·
  v99 people menu + Invite · v100 laptop left edge · v101 Our picks · v102
  playlist names · data #63 nine more ticket prices. Rows, reviews, rollback
  targets: the LEDGER.
- **Alerts:** PostHog → Slack for a new error and one that came back
  (`ops/posthog/`), each saying what the error means in plain words.

## In flight

One coordinator session releases; rules in
`claude-plans/2026-09-25-portola-live/RUNBOOK.md`, calls and reviews in the
LEDGER beside it, the build's cursor in
`claude-plans/2026-09-26-unified-build/NOW.md`. A release ships on CI green
(both jobs, Linux WebKit included) + a Sol 6 review + an independent
real-input walk where the UI changes + prod smoke.

1. **v104, built and gated, ships Monday Sep 28** (`live/v103`): NOW first in
   the day row, the List filters by highlight, the crew playlist's top songs
   (Spotify rate limits honoured, a write never repeated blind). Held so NOW
   doesn't move on friends' phones on Portola's last day (Kevin agreed).
2. **Our picks across days** (`live/plan-days-design`, the sibling session):
   Despacio as a drop-in room, the plan through later days, menus over the
   open plan with a highlight that filters — Kevin approved every default;
   aimed at ACL Late nights (Tue Sep 29).

## Open with Kevin

- Ray: the Sep 1 reply is still in Gmail drafts — send it now, or fold it
  into one email after ACL (its Pen card asks; the draft still says Discover
  "after ACL", now 2027).
- Pinned notes shown on the wall (a pinned festival or day note as the room
  head's whisper): offered, no answer yet.
- Import: a second door in the just-joined welcome, and Portola-only — his
  "all those changes seem chill" probably covers it; confirm, then build.
- Small call with a default: How it works dropped "White stroke = you" (you
  are never in the crew corner now).
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries.

## Next, after the live lane

0. Follow-ups: the LEDGER's list (1–33), the U0 nets first.
1. ACL before Oct 2: the Zilker headliners' ends (a code rule — they print
   only a start), the dock's FRI flash on open.
2. After Portola: self-recovery when a phone boots stale cached modules
   beside new ones (seen again today: `roomOf` not found, 11:00 AM); a guard
   against a sync push to the wrong crew.
3. Data-only pushes as drops land (standing OK: validator + freeze + tests).
4. After Oct 11: the merged wall for two crews at one fest, add-a-show
   (`claude-plans/2026-09-02-add-a-show.md`), the staging site (fix or
   retire), email Ray (raypp2) — the Sep 1 draft never went out (Pen card).

## Banked, not built

- In Kevin's Pen (2026-09-26): the 2027 tabs (Discover, Our picks, a
  reference tab with the grounds and venue maps and everyone's notes); city
  seasons leaving out festival-only artists, and combining cities; list-view
  swipes; the in-app venue map; emailing Ray. The schedule-drop watcher
  (`claude-plans/2026-08-27-schedule-drop-watcher-future-build.md`). An AI
  festival import graded by an eval.
- A sticky member-chip row · duplicate person rows for Portola crew members
  (an idempotent claim fixes it) · the deferred sync and merge hardening list
  in DEVLOG 2026-08-23 · day-to-day grid scroll mirroring only on scroll end
  (needs Kevin's yes).

## Where the rest lives

- Rules: CLAUDE.md. History: DEVLOG.md (search it; do not read it whole).
  Specs and plans: `claude-plans/README.md`.
- Backups: Neon branches `backup-2026-09-23-prefest` and
  `backup-2026-09-26-pre-v101`, JSON exports outside the repo.
- NOW before 2026-09-16:
  `claude-plans/archive/2026/now-history-2026-07-07-to-2026-09-02.md`.
