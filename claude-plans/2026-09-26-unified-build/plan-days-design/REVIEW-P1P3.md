# Independent review of P1–P3, on 60107d2 (2026-09-27, 1–2 AM)

Four Opus reviewers each read the diff from main (b17675b) to 60107d2 through one
lens: the Share and the shelf, the model, the repo's laws and motion, and the tests.
They read a snapshot and ran unit tests and jsdom probes, but no browser suites. An
Opus skeptic per lens then tried to refute each finding. Eleven held up and one was
rejected. The workflow run is `wf_5982a3a5-371`; its journal holds every agent's full
return.

The review also checked what did not break, and that came back clean. The Share's
hardening is intact: the forced repaint, `drawn`, the held guard,
`holdForShare`/`dropShares`, pagehide, and `afterArrival` plus `stint`. There is no
new `--fest`, and every new tappable thing is a button. The unit suites pass under
CI's three passes. Mutation runs showed that the unit tests catch the menu row, the
bar and the drop-in rules.

## One mechanism, three holes: `fitTail` (plan-shelf.js, around 345–361)

`fitTail` makes room for the last day to reach the top by writing
`padding-bottom` on the list. It first clears that padding, then forces a layout
(getComputedStyle, getBoundingClientRect), then writes it back. Three reviewers found
the first hole on their own.

1. **important:** the scroll clamps while the reader is parked on the last day. Say
   Sunday is at the top, which is only possible thanks to the padding. Then any redraw
   runs fitTail's clear-and-measure: a crew-mate's pick, a stop boundary ticking over,
   a row tap, a refit, the glide, or the Share's own forced repaint. That shrinks the
   scroll range, both engines clamp `scrollTop`, and the padding comes back without
   the scroll. The head turns back to Saturday. Because `sharePlan` reads `topNight`
   after its forced repaint, a Share tapped with Sunday at the top can send Saturday.
   ACL meets this every day: its last head is always Sun Oct 11.
2. **important:** `showGrown` (around 992) takes `floor = list bottom − paddingBottom`.
   With fitTail's padding in place, the floor sits hundreds of px above the visible
   bottom. A card that fits reads as cut off, the window grows, and the list scrolls,
   so the tapped row moves under the finger. That breaks storyboard 8, which plan-drag
   pins, but only on Portola cases, where the padding is 0.
3. **important:** on the phone the shelf is content-sized (v3.css around 2101, a
   max-height only). When the open plan is shorter than the cap, `need` equals `at`,
   so fitTail adds `at` px of blank space under the last row. The last day still can't
   reach the top, and the open and close motions jump by the padding.

**Suggested shape (the builder decides):** replace the clear-and-measure with one
mechanism that never clears a scroll range under a reader. For example, a spacer
element at the list's end, sized from measurements that exclude it, and only while
the list really scrolls (it is at the shelf's cap). The floor in `showGrown` then
reads only the base padding. For a plan that fits without scrolling, check what
DESIGN.md B intends: whether the shelf grows so a later day can reach the top, or the
later day's Share lives elsewhere. If the design doesn't settle it, bring it back as a
question. Write red-first browser tests on ACL W2 Saturday first:

- Sunday at the top survives a repaint (a new minute plus visibilitychange, as the
  carry-on test does) and a Sunday row tap.
- A Share tapped with Sunday at the top sends Sunday.
- A lower Saturday row whose card fits does not move when tapped.
- A short plan opens and closes with no gap and no jump.

## The model (plan.js, plan-rows.js, app.js)

4. **important:** a night whose only pick is a drop-in reads "Never together — no
   stop" (or "Scattered all day"), right under a Despacio line that says they're all
   there. It does this even for a highlight of one person. plan.js `night()` (around
   596–602) sets `why = 'scattered'` whenever there is no stop and any shown place has
   a pick, and rule 9 never lets a drop-in be a stop. app.js (around 1374) then prints
   the scattered words. Give a drop-in-only night its own reason, or none beside its
   line.
5. **minor:** a must on a drop-in at another venue can pull a person off the grounds
   for good. A synthetic day showed it: Early at 4 PM and Late at 10 PM on the grounds,
   and a must on a drop-in Lounge at another venue from 6 to 11 PM. The plan keeps
   only Early and loses Late. Without the must, Late comes back. This is your P1
   doubt 5 with a failing case. Rule 9 says a drop-in never holds a body, so its pull
   should not either.
6. **minor:** the repaint key (plan-shelf `signature()`, around 291, and `rowsKey`)
   keys a drop-in line only by kind, from, to and count. `dropInRow` changes its words
   once `nowMin >= d.from`, and `dayRows` folds it once it is over. A tick that changes
   only that state returns early at `next === sig`, so the line's words and its fold
   stay stale until something else repaints.

## Motion and access

7. **minor:** on the laptop the head never turns over. `paintHead` animates `.wd` and
   `.sub` inside `headEl`, which is `display: none` above 720 (v3.css around 2177). The
   visible corner head is rebuilt from clones every paint, so it swaps in place.
8. **minor:** closing the plan from a later day swaps the list and the head back to
   today in the close's first frame. `settleTo(0)` runs `settleState()`
   (`scrollTop = 0`, `paintHead(route.id)`) before the close animation starts, so the
   130 ms fade shows today, not the day being closed.
9. **minor:** the Share's words sit in a `aria-live="polite"` region, and `paintHead`
   rewrites its `textContent` on every draw and every day crossing, even when the
   words are unchanged. Screen readers re-announce the button as the list scrolls.
   Write only on change, or keep the live region for Share results only, as main did.
10. **minor:** the Share's icon vanishes in place when the day at the top has nothing
    to send. `.plan-share:disabled svg { display: none }`, with no transition (v3.css
    around 2135). Scrolling onto a bare day pops the icon and shrinks the pill in one
    frame.

## Test cost

11. **minor:** the Share sweep in plan-text is 4–7x slower than main's: 126–205 s
    against 29 s. Each key now builds the whole multi-day `planDays` DOM, then filters
    to one night. CI runs npm test three times with no timeout, so this costs minutes,
    not failures. Draw only the night under test, or cache the later nights per plan,
    since they don't depend on `nowMin`.

## Rejected

- The carry-on test polls against a native smooth scroll. The design weakness is real,
  but the work between polls is milliseconds against a ~350 ms glide, and it has passed
  in both engines at 0 and at 700. Leave it; watch it on CI.
