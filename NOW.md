# NOW — festival-navigator

**last-updated: 2026-09-26 3:30 PM PT (v102 live) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v102, from `main`** (PR #61, merged 2026-09-26 2:56 PM PT) on fest /
  festival / crew.kevinhg.com — `ops/prod-smoke.mjs` PASS (festival-nav-v102 /
  d64fb64b). Today's releases, oldest first: v97 the List view · the ACL Late
  nights times (#56, data) · v98 a phone tap opens the notes shelf · v99 the
  people menu and the Invite sheet · v100 the laptop wall's left edge · v101
  Our picks (the crew's picks for today above the dock, one NOW) · v102 the
  Spotify playlist names ("Portola peeps’ picks" / "Portola me"). What each
  carries, how it was checked and its rollback target: the LEDGER.
- **Alerts:** PostHog → Slack for a new error and one that came back
  (`ops/posthog/`), each saying what the error means in plain words.

## In flight (Portola live ops, Sat Sep 26)

One coordinator session releases; rules in
`claude-plans/2026-09-25-portola-live/RUNBOOK.md`, calls and reviews in the
LEDGER beside it, the build's cursor in
`claude-plans/2026-09-26-unified-build/NOW.md`. A release ships on CI green
(both jobs, Linux WebKit included) + a Sol 6 review + an independent
real-input walk where the UI changes + prod smoke.

1. **v103** (`live/v103`, Opus builder, `V103-BRIEF.md` in the arc folder):
   NOW becomes the first item of the day row and stays there across days;
   highlighting people in the List filters it to their picks (the Board keeps
   highlighting); the crew playlist gets top songs for every picked artist
   (the search backs off when Spotify rate-limits, and says how many artists
   got none — before, any search error quietly left only Kevin's liked songs).
2. **Share for Our picks** (`live/share`, the sibling session): a text share
   (up to five picks, then "Full rundown:" and a link that opens Our picks),
   an ✕ on the welcome card, "Share the crew link" in the Show menu. The
   sibling hands over a head gated on CI too; the coordinator stamps above
   main and releases.
3. **The Folsom + afters map**: CSVs per night and type in
   `claude-plans/2026-09-25-portola-live/maps/` (130 pins, time bands); a
   private Google My Map in Kevin's account is being built from them.

## Open with Kevin

- Pinned notes shown on the wall (a pinned festival or day note as the room
  head's whisper): offered, no answer yet.
- Import: a second door in the just-joined welcome, and Portola-only — his
  "all those changes seem chill" probably covers it; confirm, then build.
- The crew playlist: what he saw after v103's fix.
- Small call with a default: How it works dropped "White stroke = you" (you
  are never in the crew corner now).
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries.

## Next, after the live lane

0. Follow-ups: the LEDGER's list (1–25), the U0 nets first.
1. ACL before Oct 2: the Zilker headliners' ends (a code rule — they print
   only a start), the dock's FRI flash on open.
2. After Portola: self-recovery when a phone boots stale cached modules
   beside new ones (seen again today: `roomOf` not found, 11:00 AM); a guard
   against a sync push to the wrong crew.
3. Data-only pushes as drops land (standing OK: validator + freeze + tests).
4. After Oct 11: the merged wall for two crews at one fest, add-a-show
   (`claude-plans/2026-09-02-add-a-show.md`), the staging site (fix or
   retire), email Ray (raypp2) about Discover — check whether the 2026-09-01
   draft went out.

## Banked, not built

- Tabs (2027): Discover, Our picks, and a reference tab for the grounds map,
  a venue map (the My Maps layers, done properly) and everyone's notes.
- City seasons: leave out artists who come only as part of a festival;
  combine cities or "within X hours". List view swipes (ratings left, notes
  right). The schedule-drop watcher
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
