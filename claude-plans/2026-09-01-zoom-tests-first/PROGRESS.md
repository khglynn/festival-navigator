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
