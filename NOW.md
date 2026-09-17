# NOW — festival-navigator

**last-updated: 2026-09-17 · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v73, from `main`** (PR #14, merged 2026-09-01) on fest / festival /
  crew.kevinhg.com.
- `main` has had two non-app changes since: actions/checkout v7 (PR #2,
  2026-09-10) and the shared Dependabot auto-merge enrollment (PR #17,
  2026-09-13).

## The release branch

- **`events-ui`, draft PR #16** (head e9a30bb, SW v78, 2026-09-02). It holds
  the day-first club nights (every venue-night is one room played as a run,
  with guessed times marked ~), the venue registry
  (`data/venues/index.json`, `scripts/guess-run-times.mjs`), the zoom
  hardening (a real-browser hover contract in CI), Kevin's 2026-09-02 phone
  notes, and the new-build refresh (an open tab picks up a new build).
- **PR #15 (`events-data`) is superseded.** #16 carries its data, corrected.
  Close #15 unmerged once #16 lands; merging it would bring back the old
  running order.
- Spec: `claude-plans/2026-08-31-events-canvas/MODEL-V3.md`. Build log:
  `claude-plans/2026-09-01-events-build/PROGRESS.md`.

## Happening now

- **The release is built and waiting for Kevin's last look (2026-09-17, late).**
  Branch `integration-0916` (head 06639eb, SW v84) carries everything since
  v73: the pre-Portola fix round (shell, wall, data tooling, docs), the
  festival-data refresh (Portola afters re-timed from venue pages, ACL set
  times for both weekends, four ACL names dropped from newer official bills,
  ACL Fest Nights as its own tab, Lost Lands removed), the wall redesign
  (MODEL-V4: stage columns only where a festival publishes a grid, venue
  stacks in play order everywhere else, days are the days, the show menu on
  the fest name, NOW marks on stacks), a Codex ship-readiness round, two
  real-browser walks (Chromium + WebKit), the polish pass, and Kevin's own
  round (§3a: one column width, no header fold, notes written where you
  are, How it works grouped like the screen). 600 tests green, browser
  suite 19/19, validator clean. Pushed; the preview and CI are building.
- `sw-first` off `main` carries only the offline-cache fix (SW v80) so it
  can ship a day ahead; its preview
  festival-navigator-o4kfu0igq-kevinhg.vercel.app is CI green.
- Open taste calls for Kevin's look, none blocking: at phone width the
  grid now shows just under two columns (the second card clips at the
  edge — the price of one width, and it says "scroll"); on desktop the
  grid no longer fills the window (~300px of air on the right); a Sunday
  night carries a NOW ring per room; the festival's own room header and a
  hidden room's header are not note doors (the day rule above is).

**Resume from here (if the session that ran this dies):** the worktrees live
under the session scratchpad (`wt-int` = this branch, `wt-v4-*` = the
lanes, `nm-events-ui/node_modules` = packages matching the branch lockfile);
a fresh session re-creates them with `git worktree add` from the branches
above. The lane reports bank to `<scratchpad>/build/<lane>.md`. Kevin's
words and the reviews behind the spec are in the read-back page below and
in this file's history.

## Next, in order

1. **Kevin's last look** at the v84 preview (phone first: the venue-link
   tap after a long press, a note written from a day rule and from a
   section header, the show menu, How it works). His round is integrated;
   anything he flags is a small follow-up on this branch, not a new lane.
2. **Ship, on Kevin's yes in chat, in two steps** (the repo's ruleset wants
   a PR + green CI; no approving review exists for a one-person repo):
   a. `sw-first` → `main` (the offline-cache fix alone, SW v80): open the
      PR, CI green, merge with a merge commit; confirm
      `curl -s https://fest.kevinhg.com/service-worker.js | grep CACHE_VERSION`
      says v80. Phones pick it up on their next focus.
   b. `integration-0916` → `main` (the release): open the PR, CI green,
      merge; confirm production serves the release's CACHE_VERSION; then
      close PR #16 and PR #15 as superseded, with a comment naming the PR
      that shipped. Target Sep 20–21, before Portola Week afters (Thu Sep 24).
3. After the promote: Kevin walks production on his phone once; posted
   afters set times and any ACL drop go in as data-only pushes (validator +
   freeze + tests first).
4. Loose ends with their own calls: the staging site (fix or retire), the
   Ray draft, sort options in the show menu (hg-pen), the show-menu
   keyboard follow-up, a masonry-style stack layout so a short stack beside
   a tall one leaves less air.
5. After Oct 11, the simplification arc: one pointer-position close rule for
   the zoom, app.js and settings.js split, then add-a-show with a design
   pass first (`claude-plans/2026-09-02-add-a-show.md`).

Calendar: Portola Sep 26–27, afters
from Sep 24 · ACL Oct 2–4 and 9–11 · EDC Orlando Nov 6–8 · Seismic Nov 13–15.

## Waiting on Kevin

- The yes to ship (step 2 above), after his look at the v84 preview.
- stage.fest.kevinhg.com: the festival-navigator-staging Vercel project has
  cancelled every build since 2026-08-10 through the Ignored Build Step in
  its project settings (checked live 2026-09-16) and shares the production
  database. Proposed: point it at the release branch and remove the cancel,
  so it becomes the stable phone-test URL. Fix or retire?
- The Ray email: an unsent draft sits in the "Forked festival-navigator"
  thread (hello@kevinhg.com, dated 2026-09-01); the GitHub issue comment did
  go out. Refresh the wording and send?

Decided 2026-09-16: data-only pushes have a standing OK (validator + freeze
+ tests first) · 18 stale branches and 6 worktrees deleted (the deck commit
is tagged `back-pocket/deck-panel`) · crew tokens are not sensitive to Kevin
· the unused Vercel Blob token can go when we're next in Vercel · Lost Lands
dropped · the offline-cache fix ships first, after the mobile walk.

## Banked, not built

- The schedule-drop watcher:
  `claude-plans/2026-08-27-schedule-drop-watcher-future-build.md`.
- An AI festival import graded by an eval against the festivals we already
  ship (the 2026-08-31 section of the NOW archive below).
- A sticky member-chip row · duplicate person rows for three members of the
  Portola crew (an idempotent claim fixes it) · the deferred sync and merge
  hardening list in DEVLOG 2026-08-23.

## Where the rest lives

- Rules: CLAUDE.md. History: DEVLOG.md (search it; do not read it whole).
  Specs and plans: `claude-plans/README.md`.
- NOW before 2026-09-16:
  `claude-plans/archive/2026/now-history-2026-07-07-to-2026-09-02.md`.
- The fix round's read-back page:
  https://claude.ai/artifact/DM2eNDCPjk5D5WJsNNHZXM
