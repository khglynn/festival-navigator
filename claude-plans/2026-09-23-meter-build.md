# Your meter on the card — build log (2026-09-23)

Branch `feat/meter`, based on `integrate/prefest-0923`. The running log of
the build; the newest entry is at the bottom.

## The ask

A friend (via Kevin): "I want to scroll through my picks and see what I
rated them, to decide if I want to go up or down." Until now your level
lived only in the aura's brightness and in the crew corner (a tick for a
pick, a letter for a must), where a busy card could fold you into "+n" and
you vanished from your own pick.

Kevin picked the meter from the rating canvas (round 2, direction 2, the
left placement; its canvas name is never shown in the app):

1. A chip in the lower-left corner on every card you picked, drawn on the
   Spotify pill's pattern: three bars, lit one per level (1, 2, 3); at 4 the
   word MUST in the display face. Your colour, your white edge. Never
   `--brand` (it read as a second notes chip beside the violet notes pill)
   and never `--fest`.
2. The crew corner shows everyone else only, so its "+n" counts others.
3. It fits the smallest card and a crowded card at phone width, and when a
   card runs out of room, things give way in a defined order.
4. How it works teaches it (rows 3 and 4, Kevin's voice).
5. A screen reader hears your level once.

Reference (a prototype, not production code): the round-2 canvas's
`mineChip('loud')` and its `.mine-chip` / `.bars` rules.

## Log

- Read CLAUDE.md, NOW.md, aura.js, palette.js, motion.js, wall.js
  renderCard/refreshCard, card-facts.js factsFor, settings.js How it works,
  v3.css corners and the 44px floor, gallery.html, the canvas notes and
  reference. Baseline: `npm test` 693 pass / 1 skip; `npm run test:browser`
  26 pass.
