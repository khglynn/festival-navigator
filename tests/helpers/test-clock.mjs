// The moment every test believes it is, unless it names its own (2026-09-27).
//
// The app is a festival clock: what the wall draws depends on the hour. A
// night that is over folds behind the Earlier line and its cards leave the
// DOM, NOW and the now line render only while something is live, and a
// festival day turns at 5 AM. So a test on the machine's clock tests whatever
// hour it happens to run at. On 2026-09-27 at 10 AM PDT, when Portola's
// Saturday night ended, 62 unit tests and 3 browser tests went red on every
// branch; on 2026-09-24 at 11:42 PM, 48 went red on a live night that daytime
// CI had never reached. Neither was a bug in the app.
//
// TEST_CLOCK is Saturday 2026-09-19, 9 AM in San Francisco: a week before
// Portola and before ACL's late nights, so every festival reads whole and
// nothing is live. A test that needs another moment names it (page.clock, a
// mock timer, or shiftDate below); NIGHT_CLOCK runs the unit suite at a live
// night (CI does, every push). tests/README.md has the whole picture.
export const TEST_CLOCK = '2026-09-19T16:00:00Z';

// Make `Date` believe it is `at` (epoch ms), with time still moving: `new
// Date()` and `Date.now()` read real time plus the offset, `new Date(x)` is
// untouched, Date.prototype is the real one, and timers, performance.now()
// and requestAnimationFrame are the engine's own. Self-contained on purpose:
// Node calls it (night-clock.mjs), and the browser harness hands the same
// function to a page as an init script (browser.mjs pinByDefault), so it may
// reference nothing outside its own body. Layered over another shift, it
// still lands on `at`: the offset is taken from whatever Date is current.
export function shiftDate(at) {
  const RealDate = globalThis.Date;
  const offset = at - RealDate.now();
  const shiftedNow = () => RealDate.now() + offset;
  function ShiftedDate(...args) {
    if (!new.target) return new RealDate(shiftedNow()).toString();
    const nt = new.target === ShiftedDate ? RealDate : new.target;
    return Reflect.construct(RealDate, args.length === 0 ? [shiftedNow()] : args, nt);
  }
  Object.setPrototypeOf(ShiftedDate, RealDate); // parse, UTC
  Object.defineProperty(ShiftedDate, 'prototype', { value: RealDate.prototype, writable: false });
  Object.defineProperty(ShiftedDate, 'now', { value: shiftedNow, writable: true, configurable: true });
  Object.defineProperty(ShiftedDate, 'name', { value: 'Date' });
  globalThis.Date = ShiftedDate;
}
