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

## Done

- (filled as commits land)

## Left

- (filled as work proceeds)
