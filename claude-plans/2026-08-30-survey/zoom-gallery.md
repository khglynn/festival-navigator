# Zoom gallery — `gallery.html` "THE ZOOM" section

**Task:** add a section at the TOP of `gallery.html` (own file only — `js/`,
`assets/`, `data/`, `tests/` belong to other agents) rendering the REAL card
+ REAL zoom (`renderCard` from `wall.js`, `zoomCard`/`wireCardZoom`/
`wireCardFocusZoom`/`refreshZoom`/`dismissZoom` from `card-facts.js`), wired
exactly like `app.js` (ctx.wireZoom, ctx.onPeek, ctx.onTap → pick cycle →
refreshCard → refreshZoom; document pointerdown-outside + Escape →
dismissZoom), across 16 labelled states, with a Low-power and a Slow-motion
×4 toolbar toggle. No crew/network — seed a fake fest + crew doc the way
`tests/zoom-overlay.test.mjs` and `tests/notes-round.test.mjs` do
(`FESTIVALS`/`FESTIVAL_INDEX.push`, `state.activateCrew(token, doc, fid)`).

## Read before editing
- `js/v3/app.js` L1-140 — the real ctx shape and zoom wiring app.js uses.
- `js/v3/card-facts.js` — zoomCard/wireCardZoom/wireCardFocusZoom/
  refreshZoom/dismissZoom/zoomContains API; `factsFor` is the one model.
- `js/v3/wall.js` — `renderCard`/`refreshCard` signatures, opts shape
  (`cell`, `time`, `tag`, `occ`).
- `js/v3/model.js` — `picksFor`, `nextTapLevel` (1→2→3→4(must)→0),
  `makeNoteId`, note storage shape.
- `js/state.js` — `activateCrew`, `recordSelection` (uses module-level
  `activeFestivalId`), `recordNote`, `recordAffinity`, `affinityLookup`
  (case-insensitive, keyed to ONE person — the viewer).
- `js/v3/aura.js` — `whoCorner` caps at 2 musts + 2 picks shown, ghost `+n`
  kicks in only at 5+ pickers.
- `js/v3/palette.js` — `BOARD` (24 colors), `hslOf`/`strokeOf`.
- `tests/zoom-overlay.test.mjs`, `tests/notes-round.test.mjs` — the seeding
  pattern to copy verbatim (push into `FESTIVAL_INDEX`, set `FESTIVALS[fid]`,
  `state.activateCrew(TOKEN, doc, FID)`).
- `assets/v3.css` — `.card`/`.card.cell`/`.card.timed`/`.wall-grid`/
  `#zoom-layer`/`.zoom-card`/`.z-surface` — no low-power CSS rule exists;
  `document.body.classList.toggle('low-power', ...)` is a no-op visually,
  matches app.js exactly (ctx.lowPower flag is what actually gates
  animation via `canAnimate`).

## Plan
Fake fest `gallery-zoom-fest`, 5 people (Kevin=You colorIndex 0, Drew 1,
Kat 2, Nhu 3, Pegah 4 — Kevin/Kat share a first initial on purpose, exercises
aura.js's 2-letter disambiguation). ctx.meName = 'Kevin' hardcoded (no need
for crew.me()). 16 states, each a real `renderCard(...)` call with a
purpose-built `occ`/opts, grouped under `.g-label` captions inside
`.wall-grid`s. States 15/16 need explicit edge placement (viewport left/
right full-width row; literal top of `<body>` and literal end of `<body>`).
handleTap mirrors app.js's tap cycle (state.recordSelection → picksFor →
refreshCard → refreshZoom-if-zoomed), scoped by unique artist name per card
so no cross-contamination between states.

## Log
- Wrote the section: 16 labelled states (`.zoom-row` groups + a
  `.zoom-edge-row` for #15), toolbar (low-power / slow-mo ×4), top/bottom
  page probes for #16, seeded via `state.activateCrew` exactly like the
  tests, cleared `localStorage` for the fake token first so reloads are
  deterministic.
- Playwright's own `browser_take_screenshot` timed out (5s) on EVERY page,
  including the unmodified `gallery.html` from `git show HEAD` served
  standalone — confirmed pre-existing/environmental, not caused by this
  change. Fell back to `chrome-devtools-mcp`'s screenshot/evaluate tools for
  the whole visual walk.
- Bug found + fixed: `.zoom-row` used `align-items: flex-end`, which
  misaligned the per-card caption of the 10/11 (short-cell vs tall-cell)
  pair since they have very different heights — flex-end pushes the shorter
  item's caption down to bottom-align. Changed to `flex-start` (also on
  `.zoom-edge-row`).
- Bug found + fixed: state 12's per-card caption duplicated the group
  `.g-label` almost verbatim ("an afters/event card" vs "an event/afters
  card") — reworded to add real info ("Thursday night, no grid day").
- **Real bug, caught live in-browser**: a click on the grown card did
  NOTHING — pills never changed. Root cause: `state.recordSelection` only
  queues the pick into `pendingChanges`; it never touches `crewDoc`. app.js's
  real `handleTap` (read past line 140 to find this — the brief only quoted
  up to 140) mirrors the write into `crewDoc.festivals[fid].selections`
  itself via a local `applyLocalPick` helper, which is what makes
  `picksFor`/the immediate render see it. My first pass skipped that mirror.
  Fixed by inlining the same mirror-write inside `handleTap`. Verified after
  the fix: click on the grown "Certified Must" card cycled MUST → cleared
  (pill disappeared), matching `nextTapLevel(4) === 0`.
- Verified via real hover (chrome-devtools-mcp `hover`, not `element.click`)
  and real click: the grown card renders anchored on the resting card,
  correct facts (name/sub/pills/chips), and after the fix, a tap on it
  cycles the pick live.
- Console: 0 errors on every check. One pre-existing Chrome "issue" lint
  (the demo composer `<input placeholder="Add a note…">` in the OLD sheet
  section has no id/name) — not introduced by this change, not touched.
- Zero-visual-tell state 12 caption duplication and 10/11 alignment both
  confirmed fixed via re-screenshot after edits.

## Done
- File touched: `gallery.html` only (294-line pure addition, `git diff --stat`
  confirms 0 removals, nothing else in the repo touched).
- Screenshots: `screenshots/gallery-zoom-resting.png`,
  `screenshots/gallery-zoom-grown.png` (both via chrome-devtools-mcp's
  `take_screenshot` + `filePath`, since Playwright's own screenshot tool
  times out on this machine — reproduced on the unmodified original file
  too, so it's environmental).
- Console: 0 errors/warnings across the whole session, every reload, before
  and after every interaction tested.
- Verified live in a real browser (real `hover`, real `click`, real
  `Escape`/outside-`pointerdown`): grow-on-hover, pick-cycle-on-click (after
  the crewDoc-mirror fix), Escape dismiss, outside-click dismiss, the
  right-edge placement clamp (`vw - 8 - width` math confirmed exactly),
  Low-power toggle (flips `ctx.lowPower` + body class), Slow-motion ×4
  (confirmed 45 running animations all at `playbackRate: 0.25`), and
  determinism (a fresh reload after heavy interactive testing snapped back
  to the seeded states via the localStorage wipe).
- One doubt worth flagging to Kevin: state 13's name ("Boiler Room B2B2B2B:
  …") wraps to 5 lines, not literally "two" — still exercises the wrap
  correctly (arguably a stronger stress test), but if he wants exactly two
  lines, shorten the name.
