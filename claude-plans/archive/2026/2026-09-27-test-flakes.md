# Three CI-only browser flakes after v105 (banked 2026-09-28, 2 AM PT)

LEDGER follow-up 35. Two test-only branches off main at 697e22c (v105, so they already carry
v104's pinned test clocks): `fix/zoom-still-hand-glide` (9063cc7) and `fix/list-hold-minus`
(e53b536). Both went red on CI, and main's own run after v105 (36347630741) is red on the
first flake too. Nothing here is known to hurt anyone on a phone; all three flakes are on the
laptop layout, and two of them only in Linux WebKit.

## 1. zoom-still-hand, WebKit: the click on NOW doesn't glide

- **Seen:** v105's PR run 36344794921 (both WebKit glide tests), main's run 36347630741
  ("after the glide the still pointer is over a card (null)"). Chromium always passes.
- **First theory, half right:** the Ross highlight brings NOW into the rail's row and slides
  the days (v104); a fixed 400 ms beat measured NOW mid-slide. `LATE_ANIMATIONS_MS=800`
  reproduces that locally (red 2/2, NOW at x 144 against its resting 165), and the branch's
  fix (wait for `motionDone` on `#day-rail`, aim at NOW by measurement, assert a glide) turns
  it green 6/6 locally at 0, 800 and 1500 ms.
- **But CI on the branch** (run 36346815047) still failed: "not vacuous: the click on NOW
  glided the page (scrollY 0 to 0)". The click came after the rail's motion ended and landed
  on NOW's measured box, and the page did not move. So on CI's WebKit the NOW click itself
  sometimes does nothing: an ignored click, NOW not live at that moment, or a glide that
  starts later than `sleep(200)` + ten still frames.
- **Next:** log NOW's `hidden`/`dataset.leaving`, `elementFromPoint` at the aim point, and
  the click handler's entry in a copy of the test, then run it on CI on a throwaway branch
  (the composer probe's method: tag `back-pocket/composer-probe`).

## 2. list-view "room above to hold by", Chromium: Robyn's zoom goes while Robyn is picked

- **Seen:** 332a023's attempt 2 (run 36344505362): the old four blind clicks sat 30 s on a
  zoom that had gone. The branch replaces them with steps that stop once the card reads
  un-picked, asserting the zoom stands while it doesn't.
- **CI on the branch** (run 36347015035): "Robyn is still picked, the pointer on it, and its
  zoom stands with its − (step 3)". After two clicks on the −, Robyn had not reached
  un-picked, and at the third its zoom was gone. Locally it steps to un-picked every time
  (20/20 twice; 8 more runs at 800 ms late animations and 4x CPU).
- **Read it as:** either a real laptop-List quirk (Tricky leaving re-renders the room, swaps
  Robyn's card, and the still-hand rule won't regrow a card the mouse never moved onto), or
  the − stepping more levels than the test assumes (the test's own comments disagree:
  "must → nothing" for Robyn, "2 → 3 → must → nothing" for Tricky). Check the level after
  each click first; it's cheap and it separates the two.

## 3. Welcome card, WebKit 1280 (once)

- "the welcome card waits in the corner card's own box, and the plan rises in the same place
  when it goes": `page.waitForSelector` 5 s timeout, on the still-hand branch's run. Seen
  once; read it by name if it repeats.

## Picking this up

Merge origin/main into each branch (merge, never rebase) and re-run CI. If a branch goes
green twice, merge it: test-only, so no stamp is needed. If it's still red, the next step for
each flake is above. The coordinator's note that the branches predate the clock pinning is
wrong: both start at 697e22c.
