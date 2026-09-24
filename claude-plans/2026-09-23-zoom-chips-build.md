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
  at .28. One person alone at a level is their colour at the aura's own
  brightness for that level (.45 / .6 / .72 / .85 for ×1 / ×2 / ×3 / MUST) —
  changed in the motion pass from a flat .6 (the value on the canvas), so a
  chip you carry up really deepens. Never `--fest`, never `--brand`.
- The fill and the white edge are ONE absolutely-placed layer (`.f-fill`)
  under the chip's content, not the chip's own background: a width change is
  then that layer's scale and never stretches a name, and a re-mix is a second
  layer inside it thinning away.
- **Level:** the card meter's own glyph — the same `.bars/.bar.on` and the
  same Anton `MUST`, one set of CSS shared with `.chip-meter` (`.f-pill .bars`
  sits in the same rules), `aria-hidden`.
- **People:** first names (the first word of a member name — or the whole
  name when another active member shares that first word, compared by name,
  so two Drews read "Drew Lee" and "Drew Park", never "Drew · Drew"), `You`
  first when you are in it, then the others ALPHABETICALLY. Not picking
  order: the crew doc lives in a jsonb column and Postgres stores an object's
  keys shortest-first, so "picking order" was really key-length order and
  shuffled between a save and a reload. At most two names, then `+n`.
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

## Motion — built (second pass, same day)

Kevin on the first build: "Yay it looks so good!", then: the chip you are
alone in "disappears and reappears … we can do something smoother", and a
chip that splits or merges is "an op for some cool bad ass animation …
splitting cell style … bloop bloop".

Storyboard first: `2026-09-23-zoom-chips-motion.md` (the law applied, the
vocabulary, the seven cases, the rapid-tap rule). Then one module,
`js/v3/who-motion.js`: `refreshZoomInner` hands it a snapshot taken before
the rebuild and collects its animations with its own, so the next pick
cancels them together. Nothing else in the zoom changed except one line in
`place()` (below). Chips are keyed by level, names by person, "+n" by level;
names move as themselves; the only crossfade is a chip's fill.

What watching it in a real engine changed (all against the storyboard,
frame by frame — details in the storyboard's "Watched" section):

1. The new row is measured before the first animation starts — a FLIP's
   first frame applies at once, so a name measured after its chip began to
   slide read as already home and never travelled.
2. Parked leavers were IN FLOW: `.zoom-card > :not(.z-surface)` outweighed
   `.f-parked`, a parked chip grew the card, and the whole zoom jumped 6px at
   the tap. Now scoped rules, after it, win; `box-sizing: border-box` so a
   parked name is exactly its old box.
3. A leaver now parks INSIDE the chip it left when that chip lives on, so it
   rides the chip's slide (a name folding into "+n" used to hang in the air
   where the chip had been) and keeps the chip's type. Only a leaver whose
   chip is gone parks in the card, in a bare `.f-pill` host.
4. The level glyph slides with its chip's edge (it used to sit outside the
   still-narrow fill for the first frames).
5. The chip a crossing name lands in rides above its neighbours until it
   lands; you pass in front of a chip-mate you cross.
6. A later query of the row took a parked "+n" for a live one and flew it
   73px; the live names and "+n"s are now listed once, before any parking.

**`place()` (card-facts.js), the one touch outside the who-row:** it centred
the overlay with its on-screen box, which the bloom scales — so `follow()`,
re-placing on a scroll mid-bloom, centred it wrong, and the edge clamp let
it finish 2-3px off a 320 screen on about half the runs. It now uses the
overlay's layout size (`offsetWidth`, falling back to the box in jsdom).
Pre-existing since the bloom (2026-09-01); found by the new 320 contract.

## The review round (independent reviewer on the chips commit)

1. Descenders clipped and a hard dark box around each name (the `.f-names`/
   `.f-nm` clips at line-height 1 cut the glyphs and the halo): both clip
   boxes are padded out and pulled back by the same amount. Browser contract:
   every name's glyph box sits inside both clips with 2px to spare, in the
   zoom and the notes sheet header.
2. "Drew · Drew": full name when another active member shares the first
   word, compared by name.
3. `names.at(-1)` (Safari < 15.4): `names[names.length - 1]`.
4. A busy zoom lost ~48px at 320: `sizeSlot` caps the width at the viewport
   less 8px a side, never below the resting card; browser contract at 320,
   including a re-place mid-bloom (which found the `place()` bug above).
5. Light-hue chips: the text halo holds white on the lightest blends (amber,
   lime, aqua checked in screenshots); the wrong name-order comment is fixed.
6. The solo vanish/regrow: motion case 1 (carried).

## The second review round (independent Opus review of the motion, 2026-09-24)

Nothing blocked: ten-tap bursts at 40–260ms in Chromium and WebKit at 390
and 320 never showed a name twice or left anything behind. Two glitches,
both confirmed in both engines, and a test gap:

1. **Clear, then a quick re-pick flew from the wrong chip.** At MUST beside
   Nhu, clear, re-pick within ~130ms: the ×1 chip shot ~180px out of Nhu's
   chip. A browser reports a cancelled animation on the next frame, so the
   clear's parked name was still in the row the re-pick's snapshot read.
   Fixed twice over: `whoSettle()` takes every leftover down right after the
   refresh cancels, and `whoSnapshot()` reads only the row's own pieces. The
   jsdom stub's `cancel()` now reports late too — which turned an existing
   zoom-motion test red with exactly this bug, the proof the old stub hid it.
2. **A cut-off name showed in full while sliding.** `.f-nm.f-travel` lifted
   the name's own clip; now it keeps it, and the bud sits inside the name's
   padding so it never needed the lift.
3. **The gap:** `tests/browser/zoom-chips-burst.test.mjs` — real taps 40–90ms
   apart, sampled every frame; clear-then-re-pick at 0/40/80ms; a cut-off
   name mid-move. Each new check fails on the code before this round.

Watched both fixes in slow motion in Chromium and WebKit (frame strips in
the session scratchpad, `chips-shots/review2/`): the ×1 chip grows in at its
own place; "Bartholome…" stays cut off the whole way across.

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
- Motion pass: `tests/zoom-chips-motion.test.mjs` (8 tests: carry, split,
  merge, both, first pick, clear, rapid taps, Low Power / reduced motion) on
  a fake box layout — which nodes move where, what is parked and when it
  goes, and never two nodes for one person. It could not see any of the six
  bugs above (jsdom has no transforms and no cascade); the browser contract
  now holds them: a real tap walk (carry → merge → both → clear → first) in
  which, at each pick's first frame, every name, chip, glyph, "+n" and the
  title stand exactly where they stood, leavers are out of flow in the
  chip's type, and nothing is left afterwards. Each new browser check was
  mutation-checked (the old CSS, the old measuring order, the old cap, the
  old `place()` each turn it red).
- Watched on `gallery.html` (row 19, a button per case, slow-mo toggle) in
  Chromium and WebKit: frame strips stepped through
  `document.getAnimations()`, full-speed runs, and an 8-tap burst (never two
  renderings of one person; nothing stranded).
