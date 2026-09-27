// The browser the real-input tests drive: Playwright's bundled Chromium, or
// Chrome (channel) as a fallback. CI sets BROWSER_TEST_REQUIRED, and there a
// missing browser is a failure; locally it is a skip, with the reason.
import { TEST_CLOCK, shiftDate } from './test-clock.mjs';

export const REQUIRED = !!process.env.BROWSER_TEST_REQUIRED;

// Every page a browser test opens believes it is TEST_CLOCK, a week before
// Portola, unless the test names its own moment (2026-09-27). The app is a
// festival clock: before this, a test that set no clock booted the wall at
// whatever hour the suite ran, and at 10 AM PDT on Portola Sunday three went
// red on every branch (Saturday's night had ended, the wall folded Saturday
// away, and its cards left the DOM); a gallery card rendered with no `now`
// read the machine's clock the same way. So each context this harness makes
// starts with shiftDate as its first init script: only Date moves, time keeps
// running, and frames and timers are the engine's. Every clock a test sets
// wins over it: page.clock (fixed before load, re-pinned after, installed and
// run), and a test's own shiftDate (tests/browser/clock-harness.test.mjs
// holds all of it, in both engines). `browser.newPage()` makes its context
// through newContext, so it is pinned too.
const machineContext = new WeakMap(); // browser → its own newContext, unpinned
export function pinByDefault(browser) {
  if (!browser) return browser;
  const newContext = browser.newContext.bind(browser);
  machineContext.set(browser, newContext);
  browser.newContext = async (options) => {
    const ctx = await newContext(options);
    await ctx.addInitScript(shiftDate, Date.parse(TEST_CLOCK));
    return ctx;
  };
  return browser;
}

// The one way out: a context on the machine's clock, for a test that is about
// today on purpose (tests/browser/machine-clock-smoke.test.mjs, and nothing
// else — tests/test-clocks.test.mjs holds the list). It wants a reason.
export async function onMachineClock(browser, options, why) {
  if (typeof why !== 'string' || !why.trim()) throw new Error('onMachineClock: say why this test must run on the machine\u2019s clock');
  const newContext = machineContext.get(browser);
  if (!newContext) throw new Error('onMachineClock: pass a browser from launchBrowser or launchWebkit');
  return newContext(options);
}

export async function launchBrowser() {
  const { chromium } = await import('playwright');
  try { return pinByDefault(await chromium.launch({ headless: true })); } catch (e) {
    try { return pinByDefault(await chromium.launch({ channel: 'chrome', headless: true })); } catch {
      if (REQUIRED) throw e;
      return null;
    }
  }
}

export const NO_BROWSER = 'no browser available (npx playwright install chromium, or install Chrome)';

// Wait until nothing under `within` (the whole document by default) is still
// moving: every finite animation on the document's clock — Web Animations and
// CSS alike — has run out. Measure a place only once it has stopped. A loaded
// CI runner starts an arrival late: on Linux WebKit a room sat at its 6px
// start and a shelf's step row at its 8px start well after a fixed sleep
// (runs 36247465311 and 36247441879, 2026-09-26), where a Mac is long done.
// Scroll-driven animations (the strip's follow) and endless ones never finish
// and are not motion to wait for.
export async function motionDone(page, { within = null, timeout = 6000 } = {}) {
  await page.waitForFunction((sel) => {
    const root = sel ? document.querySelector(sel) : null;
    if (sel && !root) return true;
    const list = root ? root.getAnimations({ subtree: true }) : document.getAnimations();
    return !list.some((a) => a.timeline === document.timeline
      && (a.playState === 'running' || a.pending)
      && Number.isFinite(a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity));
  }, within, { timeout, polling: 'raf' });
}

// The page's fonts in, and one whole frame run between two animation-frame
// callbacks: the page as a person sees it. A web font's arrival resizes boxes,
// and the ResizeObservers that answer it (Our plan's refit) run in the next
// frame, after its animation-frame callbacks and before it paints. A read in
// between (a test's evaluate) forces the new face's layout early and finds the
// old answer on it. While nothing moves, no frame paints that state. A loaded
// runner draws frames late, so that window is wide there: the peek read 23px
// above the dock on CI (run 36270686657). A Mac reading in a tight loop as
// the font landed caught the same numbers, while an observer inside the frame
// saw the row on the dock every time (2026-09-26). (A font landing during the
// plan's arrival is a different case: the refit waits for the motion, and that
// frame is painted. It is banked for the Share build.)
export async function fontsIn(page) {
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => {
    requestAnimationFrame(() => requestAnimationFrame(() => done()));
  })));
}

// A Mac stand-in for that loaded runner (2026-09-26): every Web Animation the
// page starts holds its first frame for `ms` before it runs, the way Linux
// WebKit on CI left Our picks' panel at its corner-card start 700ms after a
// click (runs 36266741642 and 36266745098). It keeps the animation `running`
// (its start is only moved later, with a backwards fill holding the first
// frame), so the app and motionDone see what they would see there. Set
// LATE_ANIMATIONS_MS to run a suite this way: a test that measures after a
// fixed beat fails here as it would on CI; one that waits for the motion
// passes.
export const LATE_MS = Number(process.env.LATE_ANIMATIONS_MS) || 0;
export async function lateStarts(ctx, ms = LATE_MS) {
  if (!ms) return;
  await ctx.addInitScript((lag) => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function lateAnimate(...args) {
      const a = animate.apply(this, args);
      try {
        const fill = a.effect.getTiming().fill;
        a.effect.updateTiming({ fill: fill === 'forwards' || fill === 'both' ? 'both' : 'backwards' });
        a.startTime = document.timeline.currentTime + lag;
      } catch { /* an animation this cannot move runs as it would */ }
      return a;
    };
  }, ms);
}

// Playwright's WebKit — the engine iPhones run. CI installs it (U0 of the
// unified build, 2026-09-26: before, every WebKit case skipped itself on Linux
// and ran only on one Mac), so under BROWSER_TEST_REQUIRED a missing WebKit is
// a failure, never a quiet skip. Locally it is null, and those cases skip
// with the reason. (Linux WebKit is not iOS Safari: a case that diverges gets a
// named, dated reason in its test, never a silent skip.)
export async function launchWebkit() {
  try {
    const { webkit } = await import('playwright');
    return pinByDefault(await webkit.launch({ headless: true }));
  } catch (e) {
    if (REQUIRED) throw e;
    return null;
  }
}

// NOW is the day row's FIRST item (v103), and on a phone it can rest past the
// row's left edge — where a person swipes the row to its start before tapping
// it (tests/browser/now-jump.test.mjs proves that swipe with real touches).
// For the tests whose subject is what a tap on NOW does, this is that swipe's
// stand-in: the row to its start, then wait until NOW is whole and the row is
// still, so the tap that follows lands on NOW and not where it was a frame
// ago (Linux WebKit's taps missed it, v103's first CI runs). The app can
// bring the row back to rest after that first scroll — a highlight's pill
// arriving refits and re-rests the row (CI caught exactly that once this
// helper stopped hiding its timeout) — so, as a person would swipe again,
// a row that has come to rest with NOW still cut is taken back to its start.
// When NOW never comes whole and still it FAILS, with where NOW and the row
// are — it used to swallow its timeout and let the tap go ahead, which moved
// the failure somewhere with no clue in it (Sol's review of v103).
export async function nowInView(page, door = 'dock', { timeout = 8000 } = {}) {
  await page.evaluate((d) => {
    const row = document.getElementById(`${d}-days`);
    const now = document.getElementById(`${d}-now`);
    if (!row || !now || now.hidden) return;
    const r = row.getBoundingClientRect();
    const b = now.getBoundingClientRect();
    if (b.left < r.left - 0.5 || b.right > r.right + 0.5) row.scrollTo({ left: 0, behavior: 'auto' });
  }, door);
  try {
    await page.waitForFunction((d) => {
      const row = document.getElementById(`${d}-days`);
      const now = document.getElementById(`${d}-now`);
      if (!row || !now || now.hidden) return true;
      const r = row.getBoundingClientRect();
      const b = now.getBoundingClientRect();
      const w = window.__nowStill || (window.__nowStill = { left: NaN, n: 0 });
      if (row.scrollLeft !== w.left) { w.left = row.scrollLeft; w.n = 0; return false; }
      w.n += 1;
      if (w.n < 3) return false;
      if (b.left >= r.left - 0.5 && b.right <= r.right + 0.5) return true;
      row.scrollTo({ left: 0, behavior: 'auto' }); // at rest with NOW cut: swipe again
      w.n = 0;
      return false;
    }, door, { timeout, polling: 50 });
  } catch (e) {
    const at = await page.evaluate((d) => {
      const row = document.getElementById(`${d}-days`);
      const now = document.getElementById(`${d}-now`);
      const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { left: Math.round(b.left * 10) / 10, right: Math.round(b.right * 10) / 10 }; };
      return { now: box(now), row: row && { ...box(row), scrollLeft: row.scrollLeft, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth } };
    }, door).catch(() => null);
    throw new Error(`nowInView(${door}): NOW never came whole and still in ${timeout} ms — ${JSON.stringify(at)} (${e.message.split('\n')[0]})`);
  } finally {
    await page.evaluate(() => { delete window.__nowStill; }).catch(() => {});
  }
}
