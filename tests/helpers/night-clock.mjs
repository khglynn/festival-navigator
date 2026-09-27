// The unit suite's clock (2026-09-25; the default since 2026-09-27). The
// shell tests boot the real app, and what they exercise depends on the hour,
// so every run of the suite names the hour. `npm test` loads this file into
// each test file's own process (`node --import`, which node --test hands to
// every child), and it has two jobs:
//
// 1. By default, TEST_CLOCK (tests/helpers/test-clock.mjs): a week before
//    Portola, nothing live, every festival whole. Before this was the
//    default, the suite ran on the machine's clock and went red whenever a
//    real festival moved under it — 62 tests at 10 AM PDT on 2026-09-27, when
//    Portola's Saturday night ended and the wall folded Saturday away.
// 2. NIGHT_CLOCK=<ISO instant>: a live night. NOW, the now line and the live
//    cards only render while something is live, and on 2026-09-24 at 11:42
//    PM PT a bare getComputedStyle in the NOW path failed 48 tests that
//    daytime CI had never reached. CI runs the suite once more at Portola's
//    Saturday, 9:30 PM PT, on every push (.github/workflows/ci.yml).
//
// NIGHT_CLOCK=machine runs on the machine's clock, to look at today on
// purpose. Only Date moves (shiftDate): time keeps running, and timers and
// performance.now() are the real ones. A test that pins its own clock
// (mock.timers, or swapping globalThis.Date) still wins. A file run on its
// own (`node --test tests/x.test.mjs`) is on the machine's clock unless it is
// run the same way: `node --import ./tests/helpers/night-clock.mjs --test …`.
import { TEST_CLOCK, shiftDate } from './test-clock.mjs';

const asked = process.env.NIGHT_CLOCK;
if (asked !== 'machine') {
  const target = asked || TEST_CLOCK;
  const at = Date.parse(target);
  if (Number.isNaN(at)) throw new Error(`night-clock: NIGHT_CLOCK is not a date: ${target}`);
  shiftDate(at);
}
