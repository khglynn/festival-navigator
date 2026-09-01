# The zoom, storyboarded — "the bloom" (2026-08-30, post-compaction rebuild)

## Why the old one could never be fixed

The v53–v58 zoom ran a **shared-element morph between two DOM trees**: it
measured the resting card's pieces (name, time, marks, chips — rects plus
eight computed font properties each), pinned *clones* of them inside the
overlay, and crossfaded each clone against its grown twin mid-flight
(`hop`, `dissolve`, `frame0Twin`, `z-rest`). Every complaint traces there:

- **Double-printed times** — a clone of "4:45 PM" and the grown
  "4:45 – 6:00 PM · Sat" are two renderings of one fact, both in flight;
  any timing skew shows both. The "complementary crossfade" patch tuned
  the window; it could not close it.
- **Alignment jitter** — clone positions came from wall-space rects with
  ±1px fudges; sub-pixel disagreement between two copies of the same text
  reads as a smear.
- **Four motion vocabularies** (hop, rise, slideIn, dissolve) patched in
  at different hours of the evening — no single gesture.
- The machinery to hide the seams (frame-0 twin, exit-ghost set,
  arm-after-lift interplay) each added state and windows.

**The law of the rebuild: one rendering of every fact, ever.** The overlay
measures exactly ONE thing about the resting card — its box. Nothing inside
it is measured, cloned, or crossfaded.

## What carries the "same object" illusion instead

The overlay wears the **same aura background string** as the resting card
and grows **from the resting card's centre** (true transform-origin, even
when the box is clamped at a viewport edge). Colour + origin is what the
eye actually uses to read "that card grew"; glyph registration never was.

## Timeline IN (~320ms end to end)

| t | what | how |
|---|------|-----|
| 0 | resting card's *content* fades out (wash stays — no hole in the wall) | CSS `.zoom-source > *` transition, 90ms |
| 0→90 | overlay materialises | slot opacity 0→1, ease-out |
| 0→240 | overlay grows k→1 from the resting centre | slot scale, EASE_ARRIVE (≈4% overshoot); k = restingH/grownH clamped [.7,.95] |
| 50 | WHEN rises 6px | 170ms, EASE_ARRIVE |
| 85 | WHERE rises 6px | same gesture |
| 120… | people pills slide in from the RIGHT (14px), 28ms apart | their corner: the colour marks live lower-right |
| 120/150 | notes chip, then Spotify, slide in from the LEFT (−14px) | their corner: the little numbers live lower-left |

The name never animates on its own — it IS the card, it rides the scale.
One easing in (`EASE_ARRIVE`), one out (`EASE_LEAVE`). Shadow rides the
slot's opacity plus the existing `.shown` transition.

## Timeline OUT (130ms, quick and plain)

Slot opacity 1→0 and scale 1→(partway back to k), EASE_LEAVE; the resting
content fades back through the same CSS transition. No interior
choreography on the way out.

## Unchanged on purpose

- `refreshZoom` (pick-while-zoomed FLIP) — it measures only *inside* the
  overlay, so it was never part of the disease; Kevin liked the pill dance.
- All interaction wiring: hover intent + grace, hold-arm-after-lift,
  scroll/Escape dismiss, dismissedEl, keyboard route, exit-slot sweep.
- Low Power / reduced-motion: instant, and the CSS content-fade is
  disabled under both (no transition is part of the promise).

## Deleted

`frame0Twin`, `restingPieces`, `FONT_PROPS`, `measure`, `cloneAt`, `hop`,
`dissolve`, the out-twin, `.z-rest`/frame-0 CSS. ~180 lines of seam-hiding.

## Verification before the ONE push

node suite green → gallery.html slow-mo ×4 watched frame by frame in a
real browser (grow, shrink, skim across three cards, pick-while-zoomed,
low-power) → sw-stamp → single commit.
