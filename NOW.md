# NOW — festival-navigator

**last-updated: 2026-09-16 · mode: live**

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

- **The pre-Portola fix round is integrated (2026-09-16, local).** Branch
  `integration-0916` off `events-ui`: the four fix lanes (shell, wall,
  data-tooling, docs), the festival-data refresh (Portola afters re-timed
  from venue pages, ACL set times for both weekends, four ACL names dropped
  from newer official bills), Lost Lands removed (Kevin's call), SW v79,
  527 tests green. `sw-first` off `main` carries only the offline-cache fix
  (v80) so it can ship a day ahead. **Nothing is pushed.**
- **The wall redesign is drawn, awaiting Kevin's pick:** MODEL-V4
  (`claude-plans/2026-09-16-wall-v4/MODEL-V4.md`), canvas
  https://claude.ai/artifact/NELYG7pzVaS5dUKznoCSUD. One rule: stage
  columns only where a festival publishes a grid; venue stacks in play order
  everywhere else; days are the days; sections fold; three note doors.
- A WebKit iPhone walk of the integrated build is running (the venue link
  inside a long-pressed card, Low Power, the new-build strip, cold boot).

## Next, in order

1. Kevin picks a direction on the canvas; MODEL-V4 builds in four lanes off
   `integration-0916` (Thu–Fri), then integrate, stamp once, Codex round.
2. A real-browser walk (Chromium + WebKit iPhone) with real pointer input.
3. Kevin's one look, on a fresh unique preview URL (never the branch alias,
   which keeps a stale service worker).
4. On Kevin's yes: ship `sw-first` to main first, then merge the release
   (that is the production promote), close #15. Target Sep 20–21, before
   Portola Week afters start Thu Sep 24.
5. ACL Fest Nights and set-time drops go in as data-only updates.
6. After Oct 11, the simplification arc: one pointer-position close rule for
   the zoom, app.js and settings.js split, then add-a-show with a design
   pass first (`claude-plans/2026-09-02-add-a-show.md`).

Calendar: Portola Sep 26–27, afters
from Sep 24 · ACL Oct 2–4 and 9–11 · EDC Orlando Nov 6–8 · Seismic Nov 13–15.

## Waiting on Kevin

- The direction pick on the canvas (A = MODEL-V4, B = today's build, C = a
  flat list), and his notes.
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
