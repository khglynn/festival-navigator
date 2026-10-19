# Zoom: tests first, then the tidy — progress log

**Branch:** `zoom-tests-first`, cut from `notes-desktop-round` (e556446). Lands
after PR #13.

**The brief:** move the hover/zoom code's confidence off Kevin's browser and
onto tests, then apply ONLY the four extractions the 2026-09-01 adversarial
review proved safe. Review:
`claude-plans/2026-09-01-zoom-simplification-review.md`.

**Resume rule:** every step appends a dated line to the log below. If the last
line is a Phase-1 step, no production code has been touched yet and Phase 2 has
not started. Never start Phase 2 on a red suite.

## Baseline

- Suite before any change: **317 tests, 316 pass, 0 fail, 1 skip** (`npm test`),
  working tree clean at e556446.
- The jsdom-pinnable gaps come from the review's 40-row coverage table (the rows
  marked NONE).

## Deliberately NOT written — real-browser-only

Two of the review's nineteen unpinned layers cannot be pinned honestly in Node,
and this pass leaves them alone rather than faking them:

1. **`nextFocusableAfter`'s destination** (card-facts.js 839-844). jsdom reports
   `offsetParent === null` for every element, so the visibility filter always
   empties the candidate list and the function always returns null. The tests
   here pin the CLOSE half of "Tab moves on" (the zoom goes away); where focus
   lands needs a real layout.
2. **`wireCardFocusZoom`'s `:focus-visible` gate** (card-facts.js 887-900).
   jsdom answers `matches(':focus-visible')` false, so the keyboard-grow route
   is dead code in the whole suite. The only way to "pin" it in Node is to stub
   `el.matches`, which stubs away the mechanism under test — the browsers' own
   keyboard-vs-pointer judgement IS the thing.

## Remaining gate

A **real-browser walk** (Sonnet teammate, real pointer input, never
`element.click()`) is still owed before any promote, and this session did not
run one. The Tab route and the `:focus-visible` gate are the two places where
the browser is the only witness.

## Log
- **2026-09-01** — branch `zoom-tests-first` cut from `notes-desktop-round`; baseline 317/316/0/1 recorded; PROGRESS opened. No code touched.
- **2026-09-01** — Phase 1 file 1: `tests/zoom-keyboard.test.mjs`, **10 tests**, green on current code. Rig extracted to `tests/helpers/zoom-rig.mjs`. Mutation-checked: silencing wireSource → 4 red; dropping the overlay Shift+Tab branch → 1; dropping its focusout relatedTarget guard → 2; the skeptic's early-bound-cleanup leak trap → 1 (that one was 14/14 green against the old suite). Commit 4a9cd79.
- **2026-09-01** — Phase 1 file 2: `tests/zoom-hover-grace.test.mjs`, **13 tests**, green. Covers the overlay grace (leave/enter/relatedTarget/pointerType/source), hover intent and its cancel, the dismissed mark, the overlay-over-the-card guard, and the 2026-08-31 Codex gate (instant restore under a moved-away mouse) — which had never once EXECUTED in Node. Seven mutations, seven red, including the refuted leave+belt merge (it flips the close journal's label, exactly as the review predicted).
- **2026-09-01** — Phase 1 file 3: `tests/zoom-airbag.test.mjs`, **11 tests**, green. Airbag on refresh AND shrink (only `zoomCard`'s was tested before), the close journal and its one-second press window, the zoom-layer rebuild/adopt, the same-card early return, and the exit's ghost belt (finish/cancel/timeout). Eleven mutations run, ten red; the one that stayed green is honest — `zoomBail`'s `exitingSlots` sweep is genuinely redundant with its layer sweep for that scenario, and removing the layer sweep DOES turn two tests red, so the assertion is not vacuous.
- **2026-09-01** — Phase 1 file 4: `tests/zoom-motion.test.mjs`, **8 tests**, green. The animated paths CI had never entered: the bloom cascade's order and corners, the clamped starting scale and true transform-origin, the canAnimate gate (Low Power + reduced motion), the whole animated refresh block (old-wash unclip, FLIP survivors, arrivals, the MUST badge fade), the compositor budget with clipPath confined to the surfaces, and the deliberate asymmetry where an ANIMATED exit leaves the interior cascade running while an instant one cancels it. Needed a fake layout as well as a recording `Element.animate`: with jsdom's all-zero rects a survivor hits neither branch of the refresh loop, so the FLIP half is unreachable. Fifteen mutations, fifteen red (two only after I tightened assertions that could run on an empty group — the first pass had a vacuous stagger check and a scenario with no survivor to slide).
- **2026-09-01** — Phase 1 file 5: `tests/zoom-geometry.test.mjs`, **10 tests**, green. The clamp arithmetic, the NaN fallback and the size floors were all inert in Node (all-zero rects); now stubbed and pinned, including the design law that only the LEFT/RIGHT edges push the box and the top may go negative. Plus the four unpinned inner guards of the scroll-follow (off-screen close, zero-size viewport transient, card-left-the-DOM, resize) and the capture phase that hears an inner scroller. Twelve mutations, twelve red — the capture-phase one only after adding a scroll dispatched on an inner element with `bubbles:false`; a scroll dispatched on `window` reaches bubble listeners too and proved nothing.
- **2026-09-01** — Phase 1 file 6: `tests/zoom-app-glue.test.mjs`, **6 tests**, green. Runs the REAL `js/v3/app.js` against the real `index.html` rather than re-implementing its glue in a ctx stub, which is what every other zoom test does. Pins the capture-phase outside-press (and that it does NOT poison the card — the Codex gate of 2026-08-31), Escape closing exactly one layer and eating the keypress, Escape DOES mark the card, and the occurrence-matched restore. Eight mutations, eight red (three only after fixes: two assertions fired before the intent dwell, and the capture-phase claim needed a `stopPropagation` shield to mean anything).

### Phase 1 complete

| File | Tests | Layers it closes |
|---|---|---|
| `tests/zoom-keyboard.test.mjs` | 10 | Tab route (both nodes), refreshZoom's re-wire, overlay focusout, listener leak |
| `tests/zoom-hover-grace.test.mjs` | 13 | overlay enter/leave grace, hover intent, dismissedEl, the 2026-08-31 instant-restore gate |
| `tests/zoom-airbag.test.mjs` | 11 | airbag on refresh + shrink, close journal, layer rebuild, same-card return, ghost belt |
| `tests/zoom-motion.test.mjs` | 8 | cascade shape, canAnimate gate, animated refresh block, in-flight cancel vs leave-running |
| `tests/zoom-geometry.test.mjs` | 10 | place/sizeSlot/originFor/scaleFor/insetFor, the four follow guards |
| `tests/zoom-app-glue.test.mjs` | 6 | app.js's real pointerdown + Escape handlers, occ-matched restore |

**58 new tests. Suite 317 -> 375 (374 pass, 0 fail, 1 env skip).** Not one
production byte changed in Phase 1 — `git diff` over `js/`, `assets/` and
`index.html` was empty at the end of it.

Every file was mutation-checked, not merely watched to pass: 61 mutations
applied to `js/v3/card-facts.js` and `js/v3/app.js` one at a time, each
reverted from a pristine copy. Eight initially failed to turn anything red and
every one of them was a defect in MY test, fixed and re-run:

- three assertions fired before the 300 ms hover-intent dwell could arm, so
  both branches looked identical;
- a stagger assertion looped over a group with one member;
- a compositor-budget check ran a scenario with no survivor to slide;
- a capture-phase claim dispatched its event on `window`, where a bubble
  listener hears it too;
- likewise for `scroll`, until it came from an inner element with
  `bubbles: false`;
- and the outside-press "does not poison" case re-grew the card with a direct
  `zoomCard`, which never consults the dismissed mark.

Two mutations still pass and that is honest, not a hole: `zoomBail`'s
`exitingSlots` sweep is genuinely redundant with its layer sweep for the ghost
scenario (removing the LAYER sweep turns two tests red, so nothing is vacuous).

One pin is deliberately indirect: `insetFor` is module-private, so it is
observed through the clipPath keyframes of its only caller rather than by
exporting it.

## Phase 2 — the four extractions the review cleared

Applied in order, each its own commit, with every behavioural test green
between. The service-worker stamp gate was knowingly red across all four and
cleared in its own final commit (card-facts.js is APP_CORE; stamping four times
would churn CACHE_VERSION and force four full app-shell re-downloads for one
pass).

| # | Commit | What |
|---|---|---|
| a | `d42be6b` | `underMouse()` for the two elementFromPoint probes |
| b | `d5d8a52` | `REFRESH_PART_SEL` for the selector written twice |
| c | `0588481` | the Tab handoff folds into one delegated keydown; `unwireSource` deleted |
| d | `885b24f` | Codex's `isInsideZoom(z, node)` and `isOwnControl(target)` |
| — | `f8f97e9` | `node scripts/sw-stamp.mjs` on a clean tree — v71 to v72 |

Every condition the review's skeptics attached was honoured:

- `document.elementFromPoint(...)` stays a **member expression**. The detached
  receiver variant is 14/14 green in Node and throws "Illegal invocation" in
  every browser, and that throw lands in an rAF the airbag does not wrap.
- `lastMouse` is tested first inside `underMouse`, so a touch device never pays
  for a layout-forcing hit test once per card per repaint.
- The constant is named **`REFRESH_PART_SEL`**, not `PART_SEL`, and its comment
  says the bloom's set is deliberately different — a general name next to the
  cascade invites "fixing" it, which would translate `.f-name` against a stated
  design law with the bloom test staying green.
- The Tab fold keeps the capture phase and documents the one cost: a future
  global keyboard layer would lose Tab to a standing zoom.
- Every dated why-comment travelled with its code. Counted: 27 dated references
  before, 28 after (the new one is the WebIDL-receiver rule, 2026-08-27).

Each extraction was re-mutated AFTER it landed, against the new shape: 7 for
the Tab fold, 9 for the predicates. All bite. One of the nine found a hole in
my own coverage rather than in the code — nothing asserted that the movement
belt counts the RESTING CARD as inside, only the overlay — and that test was
added before the commit landed.

### Deliberately NOT touched

Everything on the review's refuted list and its "looks duplicated but is not"
list, verified by reading the final diff: the grace timer (leave clears-then-sets,
the belt sets-if-idle — merging them re-labels the one-day-old close journal),
the touch arm block's three lift paths, BOTH focusout handlers (still two
per-node listeners; only the predicate inside them is shared), the pointermove
belt, and the wrapper trio `zoomCard`/`refreshZoom`/`unzoom` with their three
separate try/catches.

## Final state

- **Suite: 376 tests, 375 pass, 0 fail, 1 env skip.** Green under `TZ=Asia/Tokyo`
  too, which is what CI runs second. `node scripts/validate-festivals.mjs`:
  0 errors, 1 pre-existing warning (an announced festival with no lineup yet).
- Net production change: 4 files' worth of behaviour unchanged, roughly 25
  lines lighter, one lifecycle gone.

## The gate that is still open

**A real-browser walk has NOT been run and this branch must not be promoted
without one.** It is a separate teammate's job (Sonnet, real pointer input,
never `element.click()`), and three things specifically need it:

1. **The Tab route in Chrome AND Safari.** Everything here is synthetic
   `dispatchEvent`, the exact evidence class CLAUDE.md distrusts, and the fold
   to a capture-phase document listener is a real ordering change.
2. **Where Tab-moves-on lands.** `nextFocusableAfter` is unpinnable in Node.
   A pre-existing wart to look at while there: it lands on the resting card's
   own `button.chip-notes`, which is `opacity: 0` while `.zoom-source` is on
   (assets/v3.css:786) — invisible in jsdom because `offsetParent` is always null.
3. **The `:focus-visible` gate** — Tab to a card grows it, clicking one does not.
   jsdom answers false, so that route is dead code in the entire suite.
- **2026-09-01** — Phase 2 complete; stamp committed; suite green. Remaining gate: the real-browser walk.
