# Test clocks (fix/test-clocks, 2026-09-27)

A branch off main (250bc45) to ride v104 beside fix/composer-focus. The builder of
the plan-days round found it; the lead confirmed it on main at 10:44 AM PDT.

## What broke

From 10:00 AM PDT on Portola Sunday (2026-09-27) the suites went red on the machine's
clock, on every branch, main included. Aftershock (Folsom, Saturday night, 3 AM - 10
AM) is Saturday's last window. Once it ends the wall judges Saturday over and folds
it behind the Earlier line (wall.js foldPast), so Saturday's cards and heads leave the
DOM, and every test that boots Portola on the machine's clock and reaches for one
reads null. It clears at 5 AM Monday: Sunday's last window (Real Bad 37) ends, and a
festival over end to end folds nothing (a probe: Tove Lo gone at 4:55 AM Monday, back
at 5:05). ACL's weekends would do the same to anything left on the machine's clock.

## Reds before any change (main 250bc45, inside the window)

1. `npm test` at 10:50 AM: 1262 tests, 1198 pass, 62 fail, in 11 files: tap-shelf 23,
   first-open-guest 13, zoom-door-row 8, first-open-guest-doors 8,
   first-open-joins-hold 3, warm-open-shared-file 2, warm-open-custom 2, and one each
   in warm-open, offline-add-casing, first-open-tap-welcome, first-open-shelf-close.
   Pinned at 9:50 AM (NIGHT_CLOCK) the first four files pass; at 10:05 AM they fail
   23, 13, 8 and 1. The whole suite pinned a week before (2026-09-19T16:00:00Z) is
   green.
2. Browser, at 0, one suite at a time (on the plan-days build, whose tests are main's
   in these files): tap-shelf's "keyboard: Tab never walks out of the shelf" in both
   engines (`page.evaluate: TypeError: null is not an object (evaluating
   'el.scrollIntoView')`; it boots on the machine's clock on purpose, because
   Playwright's fixed clock holds requestAnimationFrame), and heads-contract's long
   name and "Portola hidden" tests (openPhone pinned a clock only when asked). The
   same Tab test fails on a main snapshot.

## Plan (the lead's brief)

1. Unit: `npm test` pins a pre-festival moment by default; NIGHT_CLOCK overrides it;
   CI's live-night step keeps its own pin.
2. Browser: the verified patch (the Tab test, heads' openPhone), then every boot on
   the machine's clock gets a pin, by a harness default if it composes with
   page.clock (with evidence), else per test.
3. One real-clock smoke that asserts only what is true at any hour, named in a doc
   as the only real-clock test.
4. A unit test that fails when a new test could boot on the machine's clock.

## Log
