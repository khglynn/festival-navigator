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

## Left

- gallery.html (static head sample, the events-wall copy), docs
  (CLAUDE.md notes bullet, MODEL-V4 pointer section, add-a-festival,
  the validator's day-label warning text, notes.js comments).
- A WebKit scrollspy walk (local only; CI has Chromium alone).
- Final screenshots at 390 and 1280.
