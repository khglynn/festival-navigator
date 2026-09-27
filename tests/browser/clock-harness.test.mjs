// The browser harness's clock (2026-09-27). Every page a browser test opens
// believes it is TEST_CLOCK, a week before Portola, unless the test names its
// own moment (tests/helpers/browser.mjs pinByDefault). Before that, a test
// that set no clock booted the app at whatever hour the suite ran, and at 10
// AM PDT on Portola Sunday three went red on every branch: Saturday's night
// had ended, the wall folded Saturday away, and its cards left the DOM.
//
// A default is only safe if it gives way to every clock a test sets, so this
// is the evidence, in both engines, on a bare page (no app): the default
// moves with time and holds no frames; Playwright's fixed clock, a re-pin
// after load and an installed clock all win over it; a test's own Date shift
// lands on its moment; a navigation and a second page keep it; and the one
// named way out (onMachineClock) is the machine's clock and wants a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, launchWebkit, onMachineClock, NO_BROWSER } from '../helpers/browser.mjs';
import { TEST_CLOCK, shiftDate } from '../helpers/test-clock.mjs';

const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { await chromium?.close(); await webkit?.close(); });
const ENGINES = [['Chromium', chromium], ['WebKit', webkit]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PIN = Date.parse(TEST_CLOCK);
const SAT_915 = Date.parse('2026-09-26T21:15:00-07:00');
const SUN_1005 = Date.parse('2026-09-27T10:05:00-07:00');
const near = (a, b, what, within = 60_000) => assert.ok(Math.abs(a - b) < within, `${what}: ${new Date(a).toISOString()}, not ${new Date(b).toISOString()}`);

// A bare page on a made-up origin, served by the context: no app, no server.
async function bare(ctx) {
  await ctx.route('http://clock.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><p>clock</p>' }));
  const page = await ctx.newPage();
  return page;
}
const pageNow = (page) => page.evaluate(() => Date.now());
const pageIso = (page) => page.evaluate(() => new Date().toISOString());

for (const [name, browser] of ENGINES) {
  const skip = browser ? false : NO_BROWSER;

  test(`${name}: a page with no clock of its own is on TEST_CLOCK, moving, with frames and timers the engine's`, { skip }, async () => {
    const ctx = await browser.newContext();
    try {
      const page = await bare(ctx);
      await page.goto('http://clock.test/');
      const a = await pageNow(page);
      near(a, PIN, 'the default');
      await sleep(300);
      const b = await pageNow(page);
      assert.ok(b - a >= 200 && b - a < 5000, `time moves on the default (${b - a}ms in 300ms)`);
      near(Date.parse(await pageIso(page)), PIN, 'new Date() agrees');
      const ran = await page.evaluate(() => Promise.race([
        Promise.all([new Promise((r) => requestAnimationFrame(() => r('frame'))), new Promise((r) => setTimeout(() => r('timer'), 50))]).then(() => true),
        new Promise((r) => setTimeout(() => r(false), 2000)),
      ]));
      assert.equal(ran, true, 'a frame and a timer both run: nothing is held');
      await page.goto('http://clock.test/again');
      near(await pageNow(page), PIN, 'a navigation keeps it');
      const second = await ctx.newPage();
      await second.goto('http://clock.test/second');
      near(await pageNow(second), PIN, 'a second page keeps it');
      assert.equal(await page.evaluate(() => new Date(0) instanceof Date && Date.name === 'Date' && typeof Date.UTC === 'function'), true, 'Date is still a Date');
    } finally {
      await ctx.close();
    }
  });

  test(`${name}: Playwright's clock wins over the default — a fixed time before load, a re-pin after it, an installed clock`, { skip }, async () => {
    const ctx = await browser.newContext();
    try {
      const page = await bare(ctx);
      await page.clock.setFixedTime(new Date(SAT_915));
      await page.goto('http://clock.test/');
      assert.equal(await pageNow(page), SAT_915, 'setFixedTime before load');
      assert.equal(await pageIso(page), new Date(SAT_915).toISOString());
      await page.clock.setFixedTime(new Date(SUN_1005));
      assert.equal(await pageNow(page), SUN_1005, 'a re-pin after load');
    } finally {
      await ctx.close();
    }
    const ctx2 = await browser.newContext();
    try {
      const page = await bare(ctx2);
      await page.goto('http://clock.test/');
      near(await pageNow(page), PIN, 'booted on the default');
      await page.clock.setFixedTime(new Date(SAT_915));
      assert.equal(await pageNow(page), SAT_915, 'a fixed time set on a page already running the default');
    } finally {
      await ctx2.close();
    }
    const ctx3 = await browser.newContext();
    try {
      const page = await bare(ctx3);
      await page.clock.install({ time: new Date(SAT_915) });
      await page.goto('http://clock.test/');
      await page.clock.pauseAt(new Date(SAT_915 + 1000));
      await page.clock.runFor(60_000);
      assert.equal(await pageNow(page), SAT_915 + 61_000, 'an installed clock, paused and run');
    } finally {
      await ctx3.close();
    }
  });

  test(`${name}: a test's own Date shift, over the default, lands on its moment (tap-shelf's keyboard test)`, { skip }, async () => {
    const ctx = await browser.newContext();
    try {
      await ctx.addInitScript(shiftDate, SAT_915);
      const page = await bare(ctx);
      await page.goto('http://clock.test/');
      near(await pageNow(page), SAT_915, 'the test’s own moment', 5000);
    } finally {
      await ctx.close();
    }
  });

  test(`${name}: onMachineClock is the machine's clock, and only with a reason`, { skip }, async () => {
    await assert.rejects(() => onMachineClock(browser, {}), /say why/, 'no reason, no machine clock');
    const ctx = await onMachineClock(browser, {}, 'this test proves the way out works');
    try {
      const page = await bare(ctx);
      await page.goto('http://clock.test/');
      near(await pageNow(page), Date.now(), 'the machine’s clock', 10_000);
    } finally {
      await ctx.close();
    }
  });
}
