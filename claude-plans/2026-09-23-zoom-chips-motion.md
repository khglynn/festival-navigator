# The who-chips, in motion — storyboard (2026-09-23)

Kevin, on the real build: "When you click to increase your vote — and it's
just you in the chip — it disappears and reappears … If you up your rating
and it means your chip shifts to the left or right or splits out, that's an
op for some cool bad ass animation of sliding over and/or all splitting cell
style — one chip becoming two — or merging together … you'd morph into and
out of your left and right friend's rankings as you tap and your colors would
merge and separate all like bloop bloop."

Written BEFORE the code (the 2026-08-30 lesson: motion is designed, not
patched). Built from `js/v3/motion.js`'s own numbers; nothing new is timed.

## The law, applied

One rendering of every fact (`2026-08-30-zoom-storyboard.md`). A name is a
fact, a level is a fact; a chip's FILL is not (it is a background). So:

- **Names move as themselves.** The refresh rebuilds the grown block, so the
  new row holds the only live node for each person; it is FLIPped from where
  that person's name stood a moment ago. A name that stops being shown (you
  cleared your pick; a friend folded into "+n") is its OLD node, taken back
  out of the discarded row and parked where it stood, leaving — and there is
  then no new node for it. Never two nodes for one person at once.
- **Chips are keyed by level**, names by person, "+n" by level.
- **Only the fill crossfades**: the old blend, as a layer over the new one,
  thins away. The chip's WIDTH change is the fill layer's `scaleX`; the chip
  itself only translates, so the names inside are never stretched.
- **Transforms and opacity only.** Low Power and reduced motion: no snapshot
  is taken and the new row simply stands.
- **Contained**: `js/v3/who-motion.js` owns the who-row's reconciliation;
  `refreshZoomInner` only hands it a before-snapshot and collects its
  animations (so the next refresh cancels them with everything else). The
  bloom, the way out, hover and long-press are untouched.

## The vocabulary (R = REFRESH_MS 300, G = GROW_MS 240, O = OUT_MS 130,
## C = CASCADE_MS 170, EA = EASE_ARRIVE — the 4% overshoot, EL = EASE_LEAVE,
## ES = EASE_SURFACE)

| piece | gesture | time | easing |
|---|---|---|---|
| a chip that stays (or is carried) | translate from its old centre | 0→R | EA |
| its fill, if its width changed | `scaleX(old/new)` → 1 | 0→R | EA |
| its fill, if its people changed | old fill layer over the new, opacity 1→0 | 0→0.8R | ES |
| a chip someone JOINED or LEFT | the **bloop**: fill `scaleY` .92 → 1.05 at 60% → 1, riding the width change | 0→R | ES |
| a name that stayed | translate from its old spot, minus its chip's own translate (they compound) | 0→R | EA |
| your name crossing to another chip | the same FLIP, plus a **bud**: your colour under the name, opacity 0 → .85 (20%) → .85 (65%) → 0 | 0→R | ES |
| a chip born from a split | translate from your old name's centre + fill `scaleX(nameW/chipW)` → 1 + the bloop | 0→R | EA / ES |
| a chip born from nothing (first pick) | the zoom's own arrival: scale .55 → 1, opacity 0 → 1 | 50→R+110 | EA |
| a name that arrives (you join a chip from nothing) | scale .3 → 1, opacity 0 → 1 | 50→R+50 | EA |
| a chip that dies into another (merge) | its old node, emptied of names, parked where it stood: translate toward the chip it joins, `scaleX` .4, opacity → 0 | 0→R·0.8 | ES |
| a chip that dies in place (clear) | its old node, parked: scale .6, opacity → 0 | 0→O | EL |
| a name that leaves (clear, folds into +n) | its old node, parked: scale .7, opacity → 0 | 0→O | EL |
| a level glyph gaining a bar | the new bar `scaleY` 0 → 1 from its foot | 40→R+40 | EA |
| bars → MUST (carried) | old bars parked and fading 0→O EL; the word rises 4px, opacity 0 → 1 | 60→60+G | EA |

## The cases

1. **Alone → alone** (you only, ×2 → ×3, nobody at ×3). The chip is CARRIED:
   the old ×2 chip and the new ×3 chip are one object. It translates if its
   slot moved; its fill re-mixes from the ×2 glow to the ×3 glow (solo fills
   follow the aura's level brightness now, so the glow really deepens); the
   third bar rises from its foot; the bloop pops once. At MUST the bars step
   out and the word rises in. No dissolve, no regrow.
2. **Split** (you and Pegah at ×2 → you ×3, nobody at ×3). Cell division:
   Pegah's chip contracts around Pegah (fill `scaleX`, the blend re-mixes to
   Pegah's own colour, Pegah's name slides into the lead); the new ×3 chip
   pinches off from exactly where your name was — its fill starts as narrow
   as your name and stretches to its full width with the bloop — and slides
   to its slot carrying your name.
3. **Merge** (you alone at ×2 → ×3 where Drew is). Your ×2 chip flows into
   Drew's: the old chip body slides toward Drew's chip, narrowing and fading;
   your name travels with a bud of your colour and slots in; Drew's chip
   widens with the bloop and its fill re-mixes from Drew's colour to the
   blend of both; Drew's name slides aside to make room.
4. **Split + merge** (you and Pegah at ×2 → ×3 where Drew is). Both chips
   stay: Pegah's contracts and re-mixes, Drew's widens and re-mixes, both
   bloop; your name buds off one and fuses into the other in one move.
5. **First pick** (nothing → ×1). Nobody at ×1: a chip grows in where the
   row makes room for it (the zoom's own arrival). Someone at ×1: their chip
   widens, re-mixes and bloops; your name grows in at the lead.
6. **Clear** (MUST → nothing). Alone at MUST: the chip shrinks away where it
   stood, quick and plain, and its neighbours close the gap. Shared: the chip
   contracts and re-mixes; your name shrinks away where it stood.
7. **"+n"**: a name that folds into "+n" leaves like a cleared name; one that
   unfolds arrives like a joining name; the "+n" itself slides by level (its
   count changes in place).

## Rapid taps

Every refresh first cancels the previous one's animations (existing
`refreshZoomInner` behaviour); parked nodes, fill layers and buds remove
themselves on finish OR cancel, and all live inside the zoom card, which the
next rebuild replaces wholesale. So tap-tap-tap starts each move from the
settled layout of the last state, like every other part of the zoom, and can
never strand a half-moved name, a leftover layer or a ghost chip.

## Watch list (before any report)

Chromium, gallery.html, slow motion ×4 and full speed, each case several
times, stepping `document.getAnimations()` currentTime at 0 / 25 / 50 / 75 /
100% for a frame-by-frame; the same row on WebKit if Playwright's runs; then
rapid taps (4 taps inside 300ms) and Low Power.
