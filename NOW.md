# NOW — festival-navigator

**last-updated: 2026-09-17 (shipped) · mode: live**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v85, from `main`** (PR #19, merged 2026-09-17 ~09:58 CT) on fest / festival /
  crew.kevinhg.com — the wall simplified (MODEL-V4), the refreshed festival
  data, the fix round, Kevin's two rounds of notes. Confirmed on all three
  hosts by `curl -s https://fest.kevinhg.com/service-worker.js | grep
  CACHE_VERSION` (v85, ASSET_STAMP cf2557a1).
- v80 shipped an hour earlier (PR #18, the offline-cache fix alone) so phones
  had it first. #16 shows as merged (its commits landed through #19); #15 is
  closed unmerged on purpose.
- Spec of record: `claude-plans/2026-09-16-wall-v4/MODEL-V4.md` (§3b holds
  the ship-round notes). The fix-round read-back page:
  https://claude.ai/artifact/DM2eNDCPjk5D5WJsNNHZXM

## Happening now

- **Shipped. Nothing is in flight.** The session worktrees under the
  scratchpad (`wt-int`, `wt-ship`, …) and the local `polish/*` branches are
  dead; a fresh session works on `main`.
- Two things the ship round surfaced and left alone, for the record:
  (1) in Playwright-WebKit with touch, after a tap on a show-menu row the
  popover closes over a card and WebKit synthesises `pointerenter` with
  `pointerType 'mouse'`, so `card-facts.js` arms a hover zoom over the dock.
  Reproduced on the pre-round build too; Kevin's real-phone checks never
  showed it. Candidate guard: arm hover intent only under `(hover: hover)`.
  Not touched before the ship — the zoom's arming logic is the one place
  where "small fix" has bitten three times. (2) The sticky stage strip is
  32px on phones now, like desktop — its 44px coarse-pointer row existed
  only because stage heads were tap targets, and they no longer are.

## Next, in order

1. **Kevin walks production on his phone once** (a real document load — a
   tab that already had v84 keeps the old module map until it reloads).
2. Posted afters set times and any ACL drop go in as **data-only pushes**
   (validator + freeze + tests first; standing OK). Portola Week afters start
   Thu Sep 24; Portola Sep 26–27; ACL Oct 2–4 and 9–11.
3. Loose ends with their own calls: the staging site (fix or retire), the
   Ray draft, sort options in the show menu (hg-pen), the show-menu keyboard
   follow-up, the `(hover: hover)` guard above, a masonry-style stack layout
   so a short stack beside a tall one leaves less air.
4. After Oct 11, the simplification arc: one pointer-position close rule for
   the zoom, app.js and settings.js split, then add-a-show with a design
   pass first (`claude-plans/2026-09-02-add-a-show.md`).

Calendar: Portola Sep 26–27, afters from Sep 24 · ACL Oct 2–4 and 9–11 ·
EDC Orlando Nov 6–8 · Seismic Nov 13–15.

## Waiting on Kevin

- stage.fest.kevinhg.com: the festival-navigator-staging Vercel project has
  cancelled every build since 2026-08-10 through the Ignored Build Step in
  its project settings (checked live 2026-09-16) and shares the production
  database. Proposed: point it at `main` and remove the cancel, so it becomes
  the stable phone-test URL. Fix or retire?
- The Ray email: an unsent draft sits in the "Forked festival-navigator"
  thread (hello@kevinhg.com, dated 2026-09-01); the GitHub issue comment did
  go out. Refresh the wording and send?

Decided 2026-09-16/17: data-only pushes have a standing OK (validator +
freeze + tests first) · stale branches and worktrees go · crew tokens are
not sensitive to Kevin · the unused Vercel Blob token can go when we're next
in Vercel · Lost Lands dropped · highlighting picks dims, never filters ·
stage solo is cut · a hidden part renders nothing and an empty day has no
tab · the show menu hides ACL by weekend.

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
