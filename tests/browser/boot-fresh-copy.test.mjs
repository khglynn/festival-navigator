// A worker whose own copy of the app cannot link (v116, LEDGER follow-up 17).
// Every error this app has ever reported was deploy skew: a module of one
// build beside a module of another, "Importing binding name … is not found".
// v107's watchdog gave a page the worker serves ONE automatic second try —
// but that try is served from the same worker cache, so when the snapshot
// itself holds the mismatched files the second try fails exactly like the
// first, the panel blamed the signal, and Try again repeated it forever.
//
// Now the second failure throws this build's copy away (the festival-nav-v*
// app caches — never the festival data cache, and never the worker: WebKit
// empties all of Cache Storage once a registration is gone) and reloads once,
// every file from the network. Never twice in a row: a build that cannot link
// even from the network gets one fresh copy, then the panel, worded for what
// it is. And a phone with no way to fetch a fresh copy keeps the copy it has.
//
// Both engines with a real worker — iPhones are WebKit. The server changes
// the files (tests/helpers/build-server.mjs), not Playwright routes, which
// cannot reach a worker's own requests in WebKit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveBuild } from '../helpers/build-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER, waitForAsync } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = /const CACHE_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8'))[1];
const server = await serveBuild(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => {
  if (chromium) await chromium.close();
  if (webkit) await webkit.close();
  await server.close();
});

const DEEP = '/js/v3/foot.js'; // imported by app.js with named bindings: a copy without them cannot link
const STALE = 'export const stale = true;\n';
const DATA = 'festival-nav-data-v1';
const KEPT = '/data/festivals/kept-sentinel.json'; // a festival this phone holds for a field with no signal

const visible = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  return !!el && el.style.display !== 'none' && el.getClientRects().length > 0;
}, id);
const landed = (page) => page.waitForFunction(() => window.__fnAppRan === true
  && document.getElementById('screen-landing').style.display !== 'none', null, { timeout: 30000 });

// A phone that opened the app once (the worker installed, the app ran), then
// whose worker copy went bad: one module in this build's snapshot that cannot
// link to the rest — the shape an install straddling two deploys leaves.
async function installedThenBroken(engine) {
  server.overlay.clear();
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let navs = 0;
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs += 1; });
  await page.goto(`${server.origin}/`, { waitUntil: 'load' });
  await landed(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  await page.evaluate(async ([cache, data, kept, deep, stale]) => {
    const d = await caches.open(data);
    await d.put(kept, new Response('{"kept":true}', { headers: { 'content-type': 'application/json' } }));
    const c = await caches.open(cache);
    await c.put(deep, new Response(stale, { headers: { 'content-type': 'text/javascript; charset=utf-8' } }));
  }, [CACHE, DATA, KEPT, DEEP, STALE]);
  // A real document load later (hop via about:blank: a hash-only navigation
  // keeps the module map).
  await page.goto('about:blank');
  navs = 0;
  return { ctx, page, navs: () => navs };
}

const snapshotDeep = (page) => page.evaluate(async ([cache, deep]) => {
  const c = await caches.open(cache);
  const hit = await c.match(deep);
  return hit ? hit.text() : null;
}, [CACHE, DEEP]);

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const skip = engine ? false : NO_BROWSER;

  test(`${name}, real worker: a copy that cannot link is thrown away and the app opens from the network — the festival data kept`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await landed(page);
      // The open (the bad copy), the second try (the same bad copy), the fresh
      // copy from the network. Never more.
      assert.equal(navs(), 3, `${navs()} loads`);
      assert.ok(!(await visible(page, 'screen-error')), 'no Try again panel over the running app');
      assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the same worker still serves the page');
      assert.ok(await page.evaluate(async ([data, kept]) => !!(await (await caches.open(data)).match(kept)), [DATA, KEPT]),
        'the festival data cache is never touched');
      // The worker fetched what its emptied cache no longer held, and kept it:
      // the real module now, never the copy that could not link.
      await waitForAsync(page, async ([cache, deep]) => !!(await (await caches.open(cache)).match(deep)), [CACHE, DEEP],
        { timeout: 10000, what: 'the module, fetched again' });
      assert.notEqual(await snapshotDeep(page), STALE, 'the cache holds the real module');
      await page.waitForTimeout(1500);
      assert.equal(navs(), 3, 'and nothing reloads it again');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a build that cannot link even from the network — one fresh copy, then the panel says so, never a loop`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    // The server itself now serves the broken file (a bad release): to the
    // page and to the worker's next install alike.
    server.overlay.set(DEEP, { body: STALE });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      // The fresh copy's own load fails the same way, and gets no second one.
      await waitForAsync(page, () => document.getElementById('screen-error').style.display !== 'none' && performance.getEntriesByType('navigation')[0].type === 'reload'
        && !!sessionStorage.getItem('fn_fresh_copy_at'), null, { timeout: 30000, what: 'the panel after the fresh copy' });
      const settled = navs();
      await page.waitForTimeout(5000);
      assert.equal(navs(), settled, 'no further loads: never a loop');
      assert.equal(settled, 3, `${settled} loads: the open, the second try, one fresh copy`);
      const words = await page.textContent('#error-msg');
      assert.match(words, /didn’t finish loading/);
      assert.doesNotMatch(words, /weak signal/, 'a copy that cannot link is not the signal’s fault');
      assert.match(words, /our side/);
      assert.ok(await visible(page, 'error-retry'), 'Try again is there');
      assert.ok(await page.evaluate(async ([data, kept]) => !!(await (await caches.open(data)).match(kept)), [DATA, KEPT]),
        'the festival data cache is never touched');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: no way to fetch a fresh copy — the copy stays, and the panel says it needs signal`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    // navigator.onLine says yes, the network says nothing (lie-fi): the check
    // before anything is thrown away fails.
    server.overlay.set('HEAD /', 'drop');
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none', null, { timeout: 30000 });
      await page.waitForTimeout(2000);
      assert.equal(navs(), 2, 'the open and the second try; nothing thrown away, no reload into a dead network');
      assert.equal(await snapshotDeep(page), STALE, 'this build’s copy is still there (the worker serves it)');
      assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the worker is kept');
      const words = await page.textContent('#error-msg');
      assert.match(words, /didn’t finish loading/);
      assert.match(words, /signal/);
      assert.doesNotMatch(words, /weak signal/);
    } finally { await ctx.close(); }
  });
}
