# One-line heads — build log (2026-09-23)

Running log for `claude-plans/2026-09-23-one-line-heads.md`. If this lane
dies, the next agent reads the spec, then this, then `git log` on the branch.

## Where things stand

- Branch: `worktree-agent-a13bbdee821d361d6` (a worktree of festival-navigator).
- Baseline before any change: `npm test` 613 tests, 612 pass, 1 skipped;
  `npm run test:browser` 19/19.
- Environment note: the MAIN checkout's shared `node_modules` has jsdom
  29.1.1 while the lockfile says 30.0.1 — with it, three
  `tests/strip-follow.test.mjs` cases fail before any change. This worktree
  runs its own `npm ci` install (gitignored) instead of the usual symlink.

## Decisions

1. **Structure: a day wrapper.** Every tab lands on a `.day-block[data-day]`
   (plus `data-iso` on a dated day): one per day on the composed wall, one
   per dated/undated extra tab (Late nights), and one per answered day in a
   search list and a lineup fest's by-day list. `DAY_ANCHOR` is that one
   selector. A day is a block of rooms; the fold moves a day as one element;
   the first head is whatever room renders first — decided by the render.
   The flat list with a `data-day` on the first head was the smaller diff,
   but it keeps the sibling walk (`dayBlocksOf`) and makes the anchor move
   between heads when a room is hidden.
2. **One head component: `.room-head`** inside every `.room`, replacing the
   composed wall's `.day-rule`, `.sec-head` (and its `.tab` variant) and
   `.date-rule`. Anatomy: `.name` (`.wd` weekday + a space + the room label,
   one ellipsizing line) · `.sub` · `.line`.
3. **`.day-rule` survives only as the LIST header** (a search's answers per
   day, a lineup fest's by-day list, and the pseudo-headers THE LINEUP /
   EVERYTHING ELSE / NOTES · FEST). It no longer carries `data-day` (the
   block does) and is never a door (its `onOpen` branch was dead).
4. **The date without its weekday comes from the model** (`day.when` in
   events.js, beside the existing `day.sub`), never by string surgery.

5. **Dated section heads carry the room's own sub too** (`TUE LATE NIGHTS
   Sep 29 · around Austin`): the spec's rule ("the date, then the room's own
   sub") applied uniformly; its example omitted the sub. Easy to drop if
   Kevin finds the repeat noisy (`renderExtra`, one argument).
6. **Two polish details from the 390 walk**: an empty sub is `display:none`
   (it cost a second gap before the hairline), and the hairline fades in
   over 12px (a 4px stub after a long head read as a dot).
7. **Search folds**: a search's day answers are day blocks too, so the fold
   still animates a day leaving while a query is on.

## Done

- `3158325` spec copied in · `69e83cf` this log.
- `cccddba` tests first: the new truth in 12 unit test files (red on purpose).
- `053273d` the build: events.js `day.when` + `weekdayOfIso`; wall.js
  `dayBlock` / `roomHead` / `listHead` / `dateDoor`, renderComposed and
  renderExtra rewritten, search and lineup lists in day blocks,
  `DAY_ANCHOR = '.day-block[data-day]'`, scrollToNowLine on the block;
  app.js fold (`dayBlocksOf` filter, `foldBlocksOf` no double motion,
  `planDayKeys` includes dated tabs, `landOnDay`); v3.css heads.
- `3a938ac` polish + `tests/browser/heads-contract.test.mjs` (5 cases).
- Suites: `npm test` 613 tests, 612 pass + 1 skipped EXCEPT the service-
  worker stamp test (red by design: no `sw-stamp.mjs` in this lane).
  `npm run test:browser` 24/24.
- Screenshots: scratchpad `heads-shots/` (see the final report).

- `993155f` docs + gallery: CLAUDE.md notes bullet, MODEL-V4 §3c (+ pointers
  in §1.3, §2, §3a.3), add-a-festival, v3-inventory, claude-plans/README,
  the validator's day-label warning, notes.js / tools.js comments; the
  gallery's static head sample shows the three head states.
- `e5d5bbd` tidy (anchorFor, events.js comments, the --fs-day comment).
- `4d0da48` merged main 724fbc0 (PR #23, data only). No test in this area
  pinned the old data; nothing needed fixing.
- After the merge: `npm test` 614 tests, 612 pass, 1 skipped, 1 fail — the
  service-worker stamp test, red by design until the integrator runs
  `node scripts/sw-stamp.mjs` on a clean tree (computed stamp 9e31953e vs the
  shipped cf2557a1 before the merge). `npm run test:browser` 24/24.
- A local WebKit walk (scratchpad `webkit-walk.mjs`, iPhone-sized, touch):
  all 11 tab landings (Portola 4, ACL 7) put the day's first head exactly at
  --jump-offset, and a full scroll of each fest lit the right tab at every
  stop (13 + 22 stops, 0 mismatches).

## Round 2 (same day): three follow-ups from the coordinator

1. `ca00dcc` **The strip rides its grid's timeline under Reduce Motion and
   Low power too.** Kevin's phone note ("stuttered delayed slide for section
   above") — the 09-02 fix only covered motion-on phones. `followStrip`
   takes the timeline wherever the engine has `ScrollTimeline`; the follow's
   animation moved from inline style into v3.css as the one rule that
   out-ranks the two kill rules, with the timeline's name in `--strip-tl`
   (the kill shorthand resets `animation-timeline`). `.rides` gates the rule
   so an engine without timelines never gets a parked row. The route is
   written on the strip (`data-follow`). Day-to-day scroll mirroring is
   untouched (needs Kevin's yes). Verified: jsdom, the Chromium contract
   (computed `strip-follow` on the grid's own timeline under Low Power and
   emulated Reduce Motion, names over columns, every other animation still
   killed), and a local WebKit run (timeline + aligned in all three modes).
2. `c3a5074` **Diagnostics** gains `reducedMotion`, `lowPower`, `stripRoute`
   ('timeline' | 'transform' | 'none') and `stripAnimation` (the engine's
   computed animation-name for the follow, so a frozen follow reads 'none').
   Browser contract boots Portola with and without Reduce Motion and reads
   the paste back.
3. `30e8b60` **A Late nights date counts as today** for the day-of open when
   no day block is today: dated rooms carry `data-iso`, `scrollToNowLine`
   falls back to them. Oct 3 (grid + late nights) still opens on the grid
   day; hidden Late nights and a night with no show give nothing.

Suites after round 2: `npm test` 618 tests, 616 pass, 1 skipped, 1 fail
(the SW stamp, by design). One full run also failed
`sw-data-network-first` "navigations: a redirect or the 404 page…" once;
it passed alone 3/3 and in the next full run — a load-timing flake in a
file this lane never touched. `npm run test:browser` 26/26.

## Round 3 (same day): everything hidden

Built on integrate/prefest-0923 at `a7b4885` (a fast-forward: it already
held rounds 1–2; baseline there `npm test` 716 tests, 715 pass, 1 skipped,
0 fail — v86 stamped).

- `06a90e0` tests first, `6e05028` the build, `cf5d11f` the browser case.
- With the visible week empty (no day, no tab off the end, nothing
  day-less) the wall shows `.wall-empty`: "Everything's hidden." then "Tap
  PORTOLA '26 below to bring parts back." (under 720px, the dock) or "Click
  … up top …" (720+, the rail). The name comes from `festLinkLabel`, which
  the dock and rail now use too. Quiet copy, no box, no button,
  `role="status"`. A search with everything hidden says the same instead of
  "No artists match".
- Motion: the notice arrives with the beat after the last day leaves, and
  leaves first (quick and plain) when a room comes back; with nothing to
  land on, the page goes to the top.
- Added: a fest with ONE room has no show menu, so `wallPlanFor` treats
  every fold key as inert there (`roomsIn`, shared with `roomsOf`) —
  otherwise a stale key could blank it with no switch, and the notice would
  point at a door that isn't there.
- Checked: Chromium 390 + 1280 (Portola, ACL with both weekends and Late
  nights hidden) and WebKit iPhone 15 through the real menu (hide all
  three → notice; Afters back → notice gone, THU–SUN tabs back).
  Screenshots: scratchpad `heads-shots/everything-hidden-*.png`.
- Suites: `npm test` 720 tests, 718 pass, 1 skipped, 1 fail (the SW stamp,
  red again because v3.css and the JS changed after v86). Browser 27/27.

## Left for the integrator

- Stamp the service worker once, on a clean tree, then the preview walk and
  Kevin's yes.
- FYI, not this change: a very long festival name (tested with a made-up
  "Tomorrowland Winter Wonderland Weekender") makes the phone dock's fest
  link wide enough to cover the day tabs — a Playwright tap on SAT was
  intercepted by the dock. No shipped fest is that long; the heads
  themselves handle it (the sub goes, the name ellipsizes).
