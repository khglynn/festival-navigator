// The harness's guard on waitForFunction (2026-10-04). Playwright calls a
// waitForFunction predicate synchronously and stops at its first truthy
// result, and a Promise is truthy, so an async predicate ends the "wait" on
// its first poll whatever the page holds (people-menu's QR record, CI run
// 37218538542). Every page from tests/helpers/browser.mjs now runs the
// predicate inside a wrapper that throws on a Promise, in every shape a
// source scan cannot see — a named function, a Promise-returning API — while
// an ordinary predicate keeps working exactly as before: its argument, its
// polling, its timeout. This is the evidence, in both engines, on a bare page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, launchWebkit, NO_BROWSER, PROMISE_IN_WAIT } from '../helpers/browser.mjs';

const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { await chromium?.close(); await webkit?.close(); });
const ENGINES = [['Chromium', chromium], ['WebKit', webkit]];
const refused = (p) => assert.rejects(p, (e) => e.message.includes(PROMISE_IN_WAIT));

async function bare(ctx) {
  await ctx.route('http://waits.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><p>one</p>' }));
  const page = await ctx.newPage();
  await page.goto('http://waits.test/');
  return page;
}

for (const [name, browser] of ENGINES) {
  const skip = browser ? false : NO_BROWSER;

  test(`${name}: a waitForFunction handed a Promise fails at once and says why, in every shape`, { skip }, async () => {
    const ctx = await browser.newContext();
    try {
      const page = await bare(ctx);
      const t0 = Date.now();
      await refused(page.waitForFunction(async () => false, null, { timeout: 3000 }));
      await refused(page.waitForFunction(() => Promise.resolve(true), null, { timeout: 3000 }));
      await refused(page.waitForFunction(() => document.fonts.ready, null, { timeout: 3000 })); // a Promise from an API, no async in sight
      function named() { return new Promise((r) => setTimeout(() => r(true), 10)); }
      await refused(page.waitForFunction(named, null, { timeout: 3000 }));
      assert.ok(Date.now() - t0 < 2500, `refused at once, not by a timeout: ${Date.now() - t0}ms`);
    } finally { await ctx.close(); }
  });

  test(`${name}: an ordinary predicate still waits — its argument, its polling, its value, its timeout`, { skip }, async () => {
    const ctx = await browser.newContext();
    try {
      const page = await bare(ctx);
      await page.evaluate(() => setTimeout(() => document.body.append(Object.assign(document.createElement('p'), { textContent: 'two' })), 300));
      const t0 = Date.now();
      const h = await page.waitForFunction((n) => document.querySelectorAll('p').length >= n && document.querySelectorAll('p').length, 2, { timeout: 5000 });
      assert.equal(await h.jsonValue(), 2, 'the predicate’s own value comes back');
      assert.ok(Date.now() - t0 >= 250, `it waited for the page: ${Date.now() - t0}ms`);
      await assert.rejects(page.waitForFunction(() => false, null, { timeout: 400 }), /Timeout 400ms exceeded/);
      await page.waitForFunction(() => document.title === '' || true, null, { timeout: 2000, polling: 50 });
      await page.waitForFunction('document.querySelectorAll("p").length === 2', null, { timeout: 2000 });
    } finally { await ctx.close(); }
  });

  test(`${name}: browser.newPage and a popup are guarded too`, { skip }, async () => {
    const page = await browser.newPage();
    try {
      await refused(page.waitForFunction(async () => true, null, { timeout: 3000 }));
      await page.setContent('<a href="about:blank" target="_blank">open</a>');
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('a')]);
      await refused(popup.waitForFunction(async () => true, null, { timeout: 3000 }));
    } finally { await page.close(); }
  });
}
