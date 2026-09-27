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

1. **The unit suite pins by default (8a32429).** `npm test` is now `node --import
   ./tests/helpers/night-clock.mjs --test tests/*.test.mjs`. node --test hands
   `--import` to every file's own process: a probe printed the import running once in
   each child, and still once when NODE_OPTIONS carried it too. So the plain and Tokyo
   CI steps take the default through the script, and local runs agree with CI. The
   night step keeps `NIGHT_CLOCK` and drops its NODE_OPTIONS. `NIGHT_CLOCK=machine` is
   the named way out. shiftDate moved to `tests/helpers/test-clock.mjs`, self-contained,
   so Node and a page share one implementation.
   a. At 10:52-10:54 AM, inside the window: `npm test` 1262, 0 fail; with CI's night pin,
      0 fail; TZ=Asia/Tokyo, 0 fail; `NIGHT_CLOCK=machine`, the same 62 reds.
   b. Why a script and not a CI env default: the script is the one place both a laptop
      and CI start the suite, so one line covers both. An env default in CI alone would
      leave local runs on the machine's clock, which is exactly where this was found.
   c. What it doesn't reach: a file run on its own (`node --test tests/x.test.mjs`), and
      a child process a test spawns (the validator, in data-guards and
      portola-events). Neither is on the clock's path: the validator reads no clock.
      tests/README.md says how to run one file pinned.
2. **The Tab test and heads-contract's phone (c00ac12).** The verified patch, except
   that the Tab test uses the shared shiftDate. Red at 10:55 AM, green at 10:56:
   tap-shelf 31/31 and heads-contract 7/7.
3. **A harness default, with its evidence.** `tests/helpers/browser.mjs` pinByDefault
   wraps every browser launchBrowser and launchWebkit return. Its newContext adds
   shiftDate(TEST_CLOCK) as each context's first init script, and browser.newPage goes
   through newContext (Playwright's client). `tests/browser/clock-harness.test.mjs`
   proves it composes, in both engines, on a bare page:
   a. the default moves with time, and frames and timers run;
   b. Playwright's fixed clock before load, a re-pin after load, and a fixed time set
      on a page already on the default all win;
   c. an installed clock, paused and run, lands exactly;
   d. a test's own shiftDate on top lands on its moment;
   e. a navigation and a second page keep the default;
   f. `onMachineClock` is the machine's clock and wants a reason.
   Red on the old harness (with only the way-out stub staged): 4 of 8, in both
   engines ("the default: 2026-09-27T17:59:59Z, not 2026-09-19T16:00:00Z"; "booted on
   the default: …"). shell-contract launched its own Chromium and booted the wall
   unpinned in 8 places; it now takes the harness's browser, 11/11. gallery.html's
   main ctx carries `now: null`, so its wall paths fall back to `new Date()` (wall.js,
   `ctx.now || new Date()`). The default reaches them without touching the gallery.
4. **The one real-clock smoke, the tests' README, and the guard (d3afadb).**
   `tests/browser/machine-clock-smoke.test.mjs` boots each scheduled festival in the
   catalog on a phone, on the machine's clock, in both engines. It asserts only that
   there is no page error, the wall has cards, and exactly one lit day tab is a day on
   the wall. The same boot runs with Date pinned at 13 kinds of hour and passes at
   each. What it saw is the proof that these rules don't depend on the hour: Portola's
   lit tab went Saturday, Thursday, Friday, Sunday; its blocks went from four to one;
   ACL went from 249 cards to 31 on its last night, with Late nights lit between the
   weekends. `tests/README.md` says nothing else runs on the machine's clock, and why.
   `tests/test-clocks.test.mjs` fails on any of these: the script loses its pin; a CI
   step runs `node --test` bare; a browser test or helper launches its own browser; a
   harness launch skips pinByDefault; a file other than the smoke calls onMachineClock
   (clock-harness may, and boots no app); the README stops naming the smoke. Red first
   on main (shell-contract's own launch; no allowed files), and with two scratch files
   on the branch (a direct launch that boots the app, and a stray onMachineClock), both
   named; green with the scratch trashed.
5. **CI shows the same order.** b3281e3 (docs only, so main's tests; run 36338475568):
   checks red with 1262 tests, 62 fail, and browser red, 4 fail (the Tab test in both
   engines, heads' two). 8a32429 (the unit pin; run 36338726461): checks green, browser
   the same 4. c00ac12 (the browser pins; run 36338900333): both green. The unit
   suite's three runs each had 1266 tests, 0 fail; the browser job had 378, 0 fail, 3
   skipped.
