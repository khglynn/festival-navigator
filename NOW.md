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

- **The pre-Portola fix round (2026-09-16).** A Codex review and a team of
  reviewers found real defects in #16. Four builders fix them on local
  branches cut from `events-ui`: fix/shell, fix/wall, fix/data-tooling,
  fix/docs. A festival-data refresh runs beside them on data-refresh-0916.
  **Nothing is pushed.**

## Next, in order

1. Merge the fix branches into `events-ui`; run `scripts/sw-stamp.mjs` once.
2. Codex re-reviews the result.
3. A real-browser walk with real pointer input, at desktop and phone sizes.
4. Kevin's one look, on a fresh unique preview URL (never the branch alias,
   which keeps a stale service worker).
5. On Kevin's yes: merge #16 (that is the production promote), close #15.
   Target Sep 20–21, before Portola Week afters start Thu Sep 24.
6. ACL set times go in as data-only updates.
7. After Oct 11, the simplification arc: one pointer-position close rule for
   the zoom, one timetable builder, one event-format reader, app.js and
   settings.js split, then add-a-show with a design pass first
   (`claude-plans/2026-09-02-add-a-show.md`).

Calendar: Portola Sep 26–27, afters
from Sep 24 · ACL Oct 2–4 and 9–11 · EDC Orlando Nov 6–8 · Seismic Nov 13–15.

## Waiting on Kevin

- Ship the service-worker fix a day ahead of the rest?
- A standing OK for data-only pushes (festival JSON, no app code)?
- Delete 18 stale branches and 6 worktrees? Two old `origin/claude/…`
  branches hold unique December 2025 docs; glance before deleting.
- July loose ends, never closed:
  - the crew token that leaked into this public repo on 2026-07-09: rotate?
  - a client secret seen in a screenshot: rotate?
  - an unused Vercel Blob write token: delete? (A July 13 note says it was
    removed; check Vercel.)
  - stage.fest.kevinhg.com still serves v35: the festival-navigator-staging
    Vercel project has cancelled every build since 2026-08-10 through the
    Ignored Build Step in its project settings, not vercel.json (checked
    live 2026-09-16). It shares the production database: fix it or retire it?
- Smaller: was the Ray email draft sent (Gmail thread "Forked
  festival-navigator")?

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
