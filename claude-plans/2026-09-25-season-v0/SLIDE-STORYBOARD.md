# The season slide — storyboard (2026-09-25)

Kevin: "little chevron style to the left and right of our months list … And
then we can just slide over into the next season. That would be sick with a
nice little transition." A page turn: what you are reading leaves the way it
is going, the next season arrives from where it is coming from. Written
before building (memory: motion-is-designed-not-patched).

## The pieces

| piece | element | what it does |
|---|---|---|
| W | `#wall-root` (the season's cards) | the page that turns |
| T | `#dock-days`, `#rail-days` (the month tabs) | turn with the page, a beat behind |
| N | `#fest-name`, `#fest-year`, `#fest-sub`, the dock and rail fest names | the name crosses over |
| C | the chevrons | stay put: they are the hinge, never move |
| A | `--fest` (the accent) | changes at the one frame nothing wearing it is visible |

## Next (›) — mirror everything for previous (‹)

| t (ms) | W | T | N |
|---|---|---|---|
| 0 | tap; the next file is already in memory (neighbours prefetch after every season paint) | | |
| 0 → 130 (OUT_MS, EASE_LEAVE) | x 0 → −28px, opacity 1 → 0 | x 0 → −16px, opacity 1 → 0 | x 0 → −8px, opacity 1 → 0 |
| 130 | **the swap**, one task, nothing visible: set the season, the accent, repaint, land the scroll | | |
| 130 → 410 (GROW_MS + 40, EASE_ARRIVE: the 4% overshoot) | x +36px → 0, opacity 0 → 1 | from 160: x +20px → 0, opacity 0 → 1 (CASCADE_MS + 60) | from 190: x +8px → 0, opacity 0 → 1 (CASCADE_MS) |

- Out is quick and plain (130 ms, no flourish); in has a little life (the
  overshoot, and T and N a beat apart after W, so the new season settles in
  layers). About 410 ms end to end.
- Transforms and opacity only. The repaint happens while W is invisible, so
  no frame shows a half-drawn wall; the OUT animations hold their last frame
  (fill forwards) until the IN ones exist, then are cancelled.
- A chevron that gains a destination (arriving at Winter, ‹ now leads to
  Fall) fades in over CASCADE_MS; one that loses it (arriving at Summer, ›)
  goes quick and plain. Its space never changes (visibility, not display).

## Where the new season lands

The open's own rule (app.js maybeOpenOnDay): its first month block, which is
today for the season in progress, its first month for one ahead, its start
for one that is over — under YOURS when YOURS is there. One exception, so a
turn from the top of the page stays a turn: standing at the top (the header
on screen), the new season shows from its top too (its header and YOURS);
nothing jumps under the reader.

## Taps

- A tap during a slide is remembered (the last one wins) and runs when this
  one lands: two quick › taps land cleanly on the season two over, through
  two whole turns. Never a half-drawn wall.
- Reduce Motion and Low Power: the swap alone, instantly.
- The file not in memory (the prefetch lost to a bad network): wait for it
  first, with nothing moving; offline, the toast the festival switch says.
