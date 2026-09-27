# P4 prep: where a stop ends, measured (2026-09-26 night)

Prep for BUILD.md's P4, done by the lead while the builder is on P1–P3. The rig is
`stop-ends.mjs` beside this. The two fixes below were tried on a scratch copy of the
model at 373daa4; nothing in `js/` changed.

## What the rig found

1. **The made-up nine meet it once.** At Portola on Sunday, Zara Larsson ends at 8:05
   and her stop runs to 8:15, because the Warehouse's ten-minute Tiësto blip folds into
   it. So at 8:05 and 8:10, the peek says NOW for her. The ACL nine never meet it.
2. **Made-up crews meet it far more often.** Across 40 seeded crews per row:

   | Crews | Stops | Carried past their act | Minutes | Crews that meet it |
   |---|---|---|---|---|
   | Portola ×5 | 466 | 14 | 120 | 9 of 40 |
   | Portola ×9 | 1121 | 65 | 565 | 31 of 40 |
   | Portola ×15 | 1302 | 96 | 865 | 34 of 40 |
   | ACL ×5 | 2110 | 1 | 10 | 1 of 40 |
   | ACL ×9 | 3741 | 16 | 135 | 12 of 40 |
   | ACL ×15 | 3947 | 23 | 185 | 15 of 40 |

   Seeded crews pick more evenly than real ones, so these are an upper bound. The
   shape still holds: a carry is about nine minutes, and most crews of nine or more
   meet one. The drop-in rule (A) doesn't change these counts: they are identical with
   it switched off.
3. **No fork outlives its stop today** (0 across all 240 crews). Forks are built from
   the stop's own slices. Sol's two holes came from capping the stop *after* a blip had
   folded in, so the forks still counted the blip's slices.

## Two fixes, tried

Both change only the blip fold in `routeOf`. A blip folds into the stop before it only
while that stop's place is still playing through the blip: for a set or party, its
act's end (what `tillOf` reads); for a room, its end. When it isn't playing, the two
fixes differ:

1. **Changeover.** The blip becomes nothing, so the gap is walking time and the peek
   says NEXT. The carries go to 0 and a few stops disappear (Portola ×5 goes from 466
   to 463). But the Share's shipped golden "Sunday 8:10 PM" breaks. Today it says
   `Warehouse for Tiësto @ now till 8:15pm`, and that line is true: the crew is at
   Tiësto. Under a changeover, nothing on screen says so.
2. **The blip stands as a short stop of its own.** The carries go to 0. Stops grow by
   under 1% at ACL and 3–7% at Portola, and every added stop is a real crowd at the bar at a shown place. The Share's
   8:10 golden passes untouched, so the peek now agrees with what the shipped Share
   already sends.

**Recommendation: the blip stands.** It fixes acceptance test 1 structurally: a stop
can no longer outlive its act, so `s.to <= tillOf(s)` for every set. It keeps tests 2
and 4 as they are, because forks still come from the stop's own slices. And it moves
none of the Share's lines. The cost is a short row now and then, such as "Warehouse ·
Tiësto · 8:05–8:15". Judge that in the frames and on the walk. If it reads as noise,
the fallback is the changeover, together with rewording the Share's 8:10 golden.

On the scratch copy, the tests that turn red with "stand" are the goldens (both
Portola goldens, since Zara's stop now ends at 8:05 and a Tiësto stop follows) and
`route: a stop under 15 minutes folds into the stop before it`. That test's rule gains
"while that stop's act still plays". The Share sweep stays green.

## Before changing it: everything that reads a stop's end

These are the readers listed in DESIGN.md, each re-checked against "stand":

1. `atOn`'s NOW, the peek (`current` by `s.to`): it now ends with the act.
2. `planAt`'s "last night is still going" (`i.to > m`): unchanged in meaning.
3. `forkFor`'s overlap on the stop's interval: forks come from the stop's own slices.
4. The NOW row's till (`tillOf`): for a set, the till and the stop's end now agree.
5. The Earlier fold (`overAt`): it folds at the stop's end, which is the act's end.
6. The Share's "still to come" (`endOf`): it reads each act's end, as before.
7. The shelf's repaint key (`rowsKey`): a new stop is a new key, so it repaints.
8. The one-NOW rule: the dock's NOW tab steps aside while the peek says NOW. A standing
   blip is a NOW, so the dock steps aside for its ten minutes, as it does for any stop.

Acceptance test 5 (the dock's NOW and the peek's NOW never show together) is a UI test.
It belongs in the browser suite, not the model sweep.
