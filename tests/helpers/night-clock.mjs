// A festival night for the unit suite (2026-09-25). The shell tests boot the
// real app on the machine's clock, and what they exercise depends on the hour:
// NOW, the now line and the live cards only render while something is live.
// On 2026-09-24 at 11:42 PM PT, 48 of them failed on a live Portola night
// (a bare getComputedStyle in the NOW path) that daytime CI had never reached.
//
// Loaded with NIGHT_CLOCK=<ISO instant> NODE_OPTIONS="--import ./tests/helpers/night-clock.mjs",
// it makes each test process believe it is that instant, so CI runs the live
// path on every push instead of only when a push happens at night. NODE_OPTIONS
// reaches every file's own process. It offsets Date and nothing else: `new
// Date()` and `Date.now()` read real time plus the offset (time keeps moving),
// `new Date(x)` is untouched, Date.prototype is the real one, and timers and
// performance.now() are the real ones. A test that pins its own clock
// (mock.timers, or swapping globalThis.Date) still wins.
const target = process.env.NIGHT_CLOCK;
if (target) {
  const RealDate = globalThis.Date;
  const at = RealDate.parse(target);
  if (Number.isNaN(at)) throw new Error(`night-clock: NIGHT_CLOCK is not a date: ${target}`);
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
