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
// And a recovery leaves a WHOLE copy (v116 review): the page shell stays
// through it, the worker fetches its install list again once the app runs,
// and the phone opens offline afterwards — the fresh copy once left it
// opening nowhere offline until the next release. Only the controlling
// worker's own cache is touched (never a newer worker's, never one an older
// activate kept for festival data), never while a new build is on its way,
// and never by a worker that will not say which build it is. Under Stay
// offline only the person's own Try again fetches.
//
// "Offline" here is the server hanging up (setDown), not Playwright's
// setOffline: WebKit's setOffline cannot test a worker's offline navigation
// at all (a healthy install fails it too, v116 review), and a server that
// stops answering is the same dead network to every engine and worker.
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
// `worker`: the worker script this phone installs (default: the tree's).
// `settings`: this phone's fn_settings_v1 (Stay offline).
async function installedThenBroken(engine, { worker = null, settings = null } = {}) {
  server.overlay.clear();
  server.setDown(false);
  if (worker) server.overlay.set('/service-worker.js', { body: worker });
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 } });
  if (settings) await ctx.addInitScript((v) => { localStorage.setItem('fn_settings_v1', v); }, JSON.stringify(settings));
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

const cached = (page, p, cache = CACHE) => page.evaluate(async ([c, q]) => !!(await (await caches.open(c)).match(q)), [cache, p]);
// The worker made its copy whole again: the page itself and the file only an
// install fetches (the Invite QR, imported on demand) are back.
const refilled = (page) => waitForAsync(page, async (cache) => {
  const c = await caches.open(cache);
  return !!(await c.match('/')) && !!(await c.match('/js/v3/qr.js'));
}, CACHE, { timeout: 20000, what: 'the copy whole again (the page and the QR module)' });
// Opened again with no network at all: a real document load from the worker.
async function reopenOffline(page) {
  await page.goto('about:blank');
  server.setDown(true);
  try {
    await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
    await landed(page);
  } finally { server.setDown(false); }
}
const panelUp = (page) => page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none'
  && performance.getEntriesByType('navigation')[0].type === 'reload', null, { timeout: 30000 });

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
      // A whole copy again, and the phone opens with no signal at all.
      await refilled(page);
      await reopenOffline(page);
      assert.ok(!(await visible(page, 'screen-error')), 'offline, the app opens: no Try again');
      assert.ok(await page.evaluate(async ([data, kept]) => !!(await (await caches.open(data)).match(kept)), [DATA, KEPT]),
        'and the festival data is still there');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: the network dies right after the check — the page still opens, and says the signal is weak`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    server.overlay.set('HEAD /', 'last'); // the check is answered; nothing after it is
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      // This page, from the shell the fresh copy kept, never the browser's
      // own error page. Its code cannot arrive: Chromium fails those requests
      // at once (the weak-signal words), WebKit leaves them hanging until the
      // 10 s net (its still-loading words). Both say what it is: the signal.
      await waitForAsync(page, () => {
        const el = document.getElementById('screen-error');
        return !!el && el.style.display !== 'none' && performance.getEntriesByType('navigation')[0].type === 'reload'
          && !!sessionStorage.getItem('fn_fresh_copy_at');
      }, null, { timeout: 30000, every: 250, what: 'the panel on the fresh copy\'s load' });
      assert.equal(navs(), 3, 'the open, the second try, the fresh copy');
      const words = await page.textContent('#error-msg');
      assert.match(words, /weak/, `the signal it is, not our side: ${words}`);
      assert.doesNotMatch(words, /our side/);
      assert.ok(await visible(page, 'error-retry'), 'Try again is there');
      assert.ok(await cached(page, '/'), 'the page was kept through the fresh copy');
      assert.ok(await cached(page, '/assets/v3.css'), 'and its styles');
      assert.ok(!(await cached(page, '/js/v3/app.js')), 'not vacuous: its code went');
      assert.ok(await page.evaluate(async ([data, kept]) => !!(await (await caches.open(data)).match(kept)), [DATA, KEPT]),
        'the festival data cache is never touched');
      // Signal back: Try again opens the app.
      server.setDown(false);
      server.overlay.clear();
      const box = await page.locator('#error-retry').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await landed(page);
    } finally { server.setDown(false); await ctx.close(); }
  });

  // Chromium only: Playwright's WebKit drops what a page writes into a cache
  // the page itself created as soon as that page navigates (measured: a
  // planted cache went from 1 entry to 0 across a hop to a page with no app
  // at all), so the two caches cannot be planted there. What this proves —
  // which cache names the page touches — is the same code in every engine.
  test(`${name}, real worker: only the worker's own cache — a newer worker's and one kept for its festival data stay`, { skip: skip || (name === 'webkit' ? 'Playwright WebKit drops a page-created cache\'s entries on navigation (comment above)' : false) }, async () => {
    const { ctx, page } = await installedThenBroken(engine);
    const NEWER = 'festival-nav-v99999';
    const KEPT_OLD = 'festival-nav-v36';
    await page.goto(`${server.origin}/404.html`); // same origin, no app: plant the two caches
    await page.evaluate(async ([newer, old]) => {
      await (await caches.open(newer)).put('/js/v3/app.js', new Response('newer build'));
      await (await caches.open(old)).put('/data/festivals/legacy-fest.json', new Response('{"legacy":true}'));
    }, [NEWER, KEPT_OLD]);
    await page.goto('about:blank');
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await landed(page);
      assert.notEqual(await snapshotDeep(page), STALE, 'not vacuous: the fresh copy ran');
      const keys = await page.evaluate(() => caches.keys());
      assert.ok(keys.includes(NEWER), `a newer worker's cache is not this copy's to throw away (${keys})`);
      assert.ok(await cached(page, '/js/v3/app.js', NEWER), 'and it is whole');
      assert.ok(await cached(page, '/data/festivals/legacy-fest.json', KEPT_OLD), 'the cache kept for festival data keeps it');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a worker that will not say which build it is — nothing thrown away`, { skip }, async () => {
    const tree = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
    const mute = tree.replace("d.fn !== 'build?'", "d.fn !== 'never asked'");
    assert.notEqual(mute, tree, 'not vacuous: the worker no longer answers');
    const { ctx, page, navs } = await installedThenBroken(engine, { worker: mute });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page);
      await page.waitForTimeout(2500);
      assert.equal(navs(), 2, 'the open and the second try; no fresh copy');
      assert.equal(await snapshotDeep(page), STALE, 'the copy is where it was');
      assert.match(await page.textContent('#error-msg'), /our side/);
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a new build installing — no fresh copy: its own install replaces this copy`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    // The next build's worker, whose install is still going (here it never ends).
    const next = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8')
      .replace(/const CACHE_VERSION = 'festival-nav-v(\d+)'/, (m, n) => `const CACHE_VERSION = 'festival-nav-v${Number(n) + 1}'`)
      .replace("self.addEventListener('install', (event) => {", "self.addEventListener('install', (event) => { event.waitUntil(new Promise(() => {}));");
    server.overlay.set('/service-worker.js', { body: next });
    // Its install under way before the app opens (from a page with no app:
    // the browser's own check after a navigation runs when it likes).
    await page.goto(`${server.origin}/404.html`);
    await waitForAsync(page, async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg.installing) reg.update().catch(() => {}); // not awaited: it settles when the install does, and this one never does
      return !!reg.installing;
    }, null, { timeout: 20000, every: 500, what: 'the next worker installing' });
    await page.goto('about:blank');
    const hop = navs(); // the page above
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page);
      assert.ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).installing), 'not vacuous: the next worker is installing');
      await page.waitForTimeout(2500);
      assert.equal(navs() - hop, 2, 'the open and the second try; no fresh copy');
      assert.equal(await snapshotDeep(page), STALE, 'this copy is left for the new worker to replace');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: Stay offline — nothing fetched on its own, the person's Try again is their yes, and the copy comes back whole`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine, { settings: { stayOffline: true } });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none', null, { timeout: 30000 });
      await page.waitForTimeout(2000);
      assert.equal(navs(), 1, 'Stay offline: no automatic try');
      assert.equal(await snapshotDeep(page), STALE, 'the copy is kept');
      // The person taps Try again: one fresh copy, and the app opens.
      const box = await page.locator('#error-retry').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await landed(page);
      assert.equal(navs(), 3, 'their Try again, then one fresh copy');
      assert.notEqual(await snapshotDeep(page), STALE, 'the real module now');
      await refilled(page);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('fn_fetch_once')), null, 'the yes was spent, not kept');
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
