// The browser the real-input tests drive: Playwright's bundled Chromium, or
// Chrome (channel) as a fallback. CI sets BROWSER_TEST_REQUIRED, and there a
// missing browser is a failure; locally it is a skip, with the reason.
export const REQUIRED = !!process.env.BROWSER_TEST_REQUIRED;

export async function launchBrowser() {
  const { chromium } = await import('playwright');
  try { return await chromium.launch({ headless: true }); } catch (e) {
    try { return await chromium.launch({ channel: 'chrome', headless: true }); } catch {
      if (REQUIRED) throw e;
      return null;
    }
  }
}

export const NO_BROWSER = 'no browser available (npx playwright install chromium, or install Chrome)';

// Playwright's WebKit — the engine iPhones run. CI installs it (U0 of the
// unified build, 2026-09-26: before, every WebKit case skipped itself on Linux
// and ran only on one Mac), so under BROWSER_TEST_REQUIRED a missing WebKit is
// a failure, never a quiet skip. Locally it is null, and those cases skip
// with the reason. (Linux WebKit is not iOS Safari: a case that diverges gets a
// named, dated reason in its test, never a silent skip.)
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

export async function launchWebkit() {
  try {
    const { webkit } = await import('playwright');
    return await webkit.launch({ headless: true });
  } catch (e) {
    if (REQUIRED) throw e;
    return null;
  }
}
