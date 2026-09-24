# The zoom's who-chips — build log (2026-09-23)

**What:** the zoom's people row becomes ONE chip per level anyone chose —
MUST, then three bars, two, one — loudest first, in one wrapping row. Kevin,
2026-09-23: "cool blended chips if multiple people have the same vote … in a
wrapping row rather than a stack", then, choosing between the canvas takes,
"aura and names (combo of 1 and 3). best mix of style and clarity". The
design rounds that led here: `2026-09-23-rating-canvas/` (round 4 is the
chips; take 1 = the aura fill, take 3 = the names).

**Branch:** `feat/zoom-chips`, from the v86 release candidate `f5b5907`.
Unreleased; v86 waits on Kevin's walk.

## The design, as built

- **One chip per level**, `[4, 3, 2, 1]`, only levels someone chose.
  `card-facts.js whoChips(people)` is the pure grouping (tested on its own);
  `whoPills(facts)` draws it. Same builder for the zoom and the notes sheet
  header (grownBlock is shared), so the sheet gets the chips too.
- **Fill:** the card's own aura layers for the people at that level
  (`aura.js auraLayers`, extracted from `auraBackground`, which is now those
  layers over the card base — byte-identical output) over a scrim of `--page`
  at .28. One person alone at a level is just their colour (`hslOf(c, .6)`,
  the value Kevin approved on the canvas). Never `--fest`, never `--brand`.
- **Level:** the card meter's own glyph — the same `.bars/.bar.on` and the
  same Anton `MUST`, one set of CSS shared with `.chip-meter` (`.f-pill .bars`
  sits in the same rules), `aria-hidden`.
- **People:** first names (the first word of a member name), `You` first
  when you are in it, then the others in picking order. At most two names,
  then `+n`.
- **You:** the chip you are in wears `.you` = the white edge (the app's mark
  for you everywhere); your name leads it at 800.
- **Accessibility:** the row is `role=list`, each chip `role=listitem` with
  an aria-label that names everyone in the app's level words —
  `Must: Gus, Hal and Lou`, `Picked ×2: You and Jo` (parse.js
  LEVEL_LABELS_V4). Glyph and visible names are `aria-hidden`.

## The width rule (the call the brief asked for)

Stress case: a crew of 15 with 13 in, at 390. The zoom is 216–360px wide
(`sizeSlot`), so the who-row gets at most ~332px after the card's padding.

- **Two names, then `+n`**, regardless of how many fit. A count that
  changes with the viewport would make the same chip say different things on
  two phones; a fixed rule reads the same everywhere, and the aria-label
  carries everyone.
- **A name never wraps** (`white-space: nowrap`), and each name is capped at
  `7em` with an ellipsis, so one long name cannot push its chip past the row.
- **A chip never outgrows the row** (`max-width: 100%`, `flex: none`): at
  worst its names ellipsize; the glyph and `+n` never shrink.
- Four chips at 15 wrap to two lines of two; each chip is ~110–125px.

## What changed

- `js/v3/aura.js`: `auraLayers()` exported; `auraBackground()` uses it.
- `js/v3/card-facts.js`: `whoChips()` + new `whoPills()`; `partKey` matches a
  who-chip by `data-level` (was: the pill's first text); the MUST-badge fade
  in the refresh is gone (there is no badge — joining the MUST chip is a
  slide of a chip that was already there).
- `assets/v3.css`: `.f-pill` restyled as the chip; `.f-names/.f-nm/.f-sep/
  .f-more`; the meter's `.bars`/`.must` rules shared with `.f-pill`.
- Tests: new `tests/zoom-chips.test.mjs`; the per-person pill assertions in
  `zoom-overlay`, `zoom-motion`, `notes-round`, `events-wall` and the browser
  `hover-contract` now check chips (levels, labels, `.you`); the zoom-motion
  badge test became "a level that just appeared grows in; a chip that was
  already there slides, never re-arrives". `gallery.html`'s static sheet mock
  draws chips.

## Motion (what ships, what waits)

Ships: the zoom's existing bloom finds the chips as it found the pills (they
keep `.f-pill`), and its existing refresh matches a chip by level — so a
chip that stays slides, a new level grows in with the usual overshoot.

**Follow-up, after the weekend:** the travelling initial and the re-mix —
your name slides out of the chip you left into the one you joined, a chip's
blend crossfades when its people change, an emptied chip dissolves instead
of vanishing, and a chip you are alone in is carried across ("turns up")
rather than vanishing and regrowing. Built and walked on the canvas (round
4); it needs the old row measured BEFORE refreshZoomInner replaces the grown
block, and it lives in the zoom's refresh code, where small fixes have bitten
three times.

## Log

- Baseline on `f5b5907`: `npm test` 761 (760 pass, 1 skipped);
  `npm run test:browser` 36 pass.
- Tests first: `tests/zoom-chips.test.mjs` (10 tests) red, then green.
- Trap from the canvas, honoured: `aura.initialFor` compares by identity —
  whoChips does not use initials, so it never meets it.
- The six files that asserted per-person pills now assert chips; the
  zoom-motion MUST-badge test became its chip equivalent (joining an existing
  level's chip slides it, never re-arrives it; only a new level grows in).
- New `tests/browser/zoom-chips-contract.test.mjs`: crew of 15, 390, real
  touch hold, one absurdly long name — one line per chip, none past its row,
  glyph and "+n" always shown, the long name ellipsized, the label complete.
  Mutation-checked (dropping the 7em name cap turns it red).
- Real-app screenshots (index.html on Portola, crews of 7 and 15, /api mocked
  in the page): scratchpad `chips-shots/` — zoom at 390 (touch hold) and 1280
  (hover), five stress cases, plus the notes sheet header. No page errors.
- `npm test` 771 (769 + 1 skipped; the only red was the SW stamp, fixed by
  the stamp commit); `npm run test:browser` 37/37.
