# Tests and the clock

The app is a festival clock. What the wall draws depends on the hour: a night that is
over folds behind the Earlier line and its cards leave the page, NOW and the now line
show only while something is live, and a festival day turns at 5 AM. A test on the
machine's clock therefore tests whatever hour it happens to run at. At 10 AM PDT on
2026-09-27, when Portola's Saturday night ended, 62 unit tests and 3 browser tests went
red on every branch without a line of the app changing.

So **no test runs on the machine's clock by accident.**

1. **The unit suite** (`npm test`) runs at `TEST_CLOCK`, Saturday 2026-09-19 at 9 AM in
   San Francisco: a week before Portola, with nothing live and every festival whole
   (`tests/helpers/test-clock.mjs`). The script loads `tests/helpers/night-clock.mjs`
   into each test file's process.
   a. `NIGHT_CLOCK=<ISO instant> npm test` runs it at another moment. CI runs it once
      more at Portola's Saturday, 9:30 PM PT, so the live path is tested on every push.
   b. `NIGHT_CLOCK=machine npm test` runs it on the machine's clock, to look at today on
      purpose.
   c. A file run on its own (`node --test tests/x.test.mjs`) is on the machine's clock.
      Run it the way the script does, with
      `node --import ./tests/helpers/night-clock.mjs --test tests/x.test.mjs`.
2. **The browser suite** (`npm run test:browser`) starts every page at `TEST_CLOCK`. The
   harness (`tests/helpers/browser.mjs`) makes every context, and each one's first init
   script moves Date alone; frames and timers are the engine's. A test that needs
   another moment names it, with `page.clock` or with `shiftDate` as an init script
   when Playwright's clock would hold its animation frames. Its clock wins over the
   default, and `tests/browser/clock-harness.test.mjs` proves that in both engines.
3. **The one exception is `tests/browser/machine-clock-smoke.test.mjs`.** It boots each
   live festival on the machine's clock, because nothing else in the suite tests
   today. It asserts only what is true at any hour: no page error, cards on the wall,
   and one lit day tab that is a day on the wall. It never names a card or a day,
   because a named card is what goes red by the hour. The same rules run pinned at
   every kind of hour the live festivals have, so the smoke can't flake by the hour.
   When the smoke goes red, something really breaks at that hour.

`tests/test-clocks.test.mjs` keeps this true. It fails when the script loses the pin,
when a CI step runs the unit suite around it, when a browser test launches its own
browser, or when any file but the smoke takes the machine's clock.
