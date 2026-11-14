# Writing and chasing the browser tests

*Moved here from the root `AGENTS.md` on 2026-11-13, word for word, to keep the root under the ~24 KB its own rule sets (Codex reads at most 32 KiB). The root's laws still hold here. Paths are from the repo root.*

- **A CDP touch flick leaves a fling**, so a quick tap after it only stops
  the coast (Chromium on Linux drops that click): end the drag with the
  finger still, as `tests/browser/guest-tap-route.test.mjs` does. To chase
  a CI-only flake, log every input in a copy of the test, throttle the CPU
  (CDP `Emulation.setCPUThrottlingRate`) and bisect across builds on a
  quiet machine; another agent's browser run alongside gave false results.
- **"Nothing is moving" is not "at rest."** The app settles things in an
  animation's `finished`/`onfinish` and in page timers: a step lands and
  takes `.stepping` off, a closing menu stops eating taps, a sheet leaves
  the page. A busy runner delivers both late, so a test that reads after
  `motionDone` or a fixed sleep reads in between. Wait for the state the
  app sets at rest, never a beat. `lateStarts` in `tests/helpers/browser.mjs`
  reproduces both on any machine: `LATE_ANIMATIONS_MS=700`, and
  `LATE_FINISH_MS=200` (from about 350, stepSwapper's own backstop lands
  first). And `page.waitForFunction` never waits on an async check (a
  Promise is truthy): use `waitForAsync`. The suite fails on an async
  predicate there.
