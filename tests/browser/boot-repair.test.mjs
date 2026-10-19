// A worker whose own copy of the app cannot link (v116, LEDGER follow-up 17).
// Every error this app has ever reported was deploy skew: a module of one
// build beside a module of another, "Importing binding name … is not found".
// v107's watchdog gave a page the worker serves ONE automatic second try —
// but that try is served from the same worker cache, so when the snapshot
// itself holds the mismatched files the second try fails exactly like the
// first, the panel blamed the signal, and Try again repeated it forever.
//
// Now the second failure asks the worker to REPAIR its copy
// (service-worker.js repair): fetch its whole install list again, prove it is
// this build's own — the page's fn-build first, then ASSET_STAMP over every
// file — and only then write it over the old copy; the page reloads only on
// "repaired". Anything else writes nothing and shows the panel: the network
// serving another release, a set that does not prove out, a file that does
// not arrive, a network that hangs past the worker's deadline, a worker too
// old to know the ask. Never twice in a row: a build that cannot link even
// repaired gets one repair, then the panel. Never the festival data cache,
// never another build's cache, never while a new build is on its way, and
// under Stay offline only the person's own Try again repairs. (Review round
// 3: this replaced "drop the code, reload, refill later", which three rounds
// of patches had not stopped letting two builds into one cache.)
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
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveBuild } from '../helpers/build-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER, waitForAsync } from '../helpers/browser.mjs';
import { appCoreFiles, assetStamp } from '../../scripts/sw-stamp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SW = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
const CACHE = /const CACHE_VERSION = '([^']+)'/.exec(SW)[1];
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
// What the page itself never fetches and the repair always does: the page
// navigates to '/', never to /index.html.
const REPAIR_SIGN = 'GET /index.html';

// This tree's worker with some of its text swapped (each swap must land).
function workerWith(...swaps) {
  let src = SW;
  for (const [from, to] of swaps) {
    const next = src.replace(from, to);
    assert.notEqual(next, src, `not vacuous: ${String(from).slice(0, 60)} is in the worker`);
    src = next;
  }
  return src;
}

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
// Every document counts its own calls to reg.update() (window.__updates): the
// browser's own update checks never call it, so the count is the page's.
async function installedThenBroken(engine, { worker = null, settings = null } = {}) {
  server.release();
  server.overlay.clear();
  server.setDown(false);
  if (worker) server.overlay.set('/service-worker.js', { body: worker });
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 } });
  if (settings) await ctx.addInitScript((v) => { localStorage.setItem('fn_settings_v1', v); }, JSON.stringify(settings));
  await ctx.addInitScript(() => {
    window.__updates = 0;
    const R = window.ServiceWorkerRegistration;
    if (!R) return;
    const update = R.prototype.update;
    R.prototype.update = function () { window.__updates += 1; return update.call(this); };
  });
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
  server.log.length = 0;
  return { ctx, page, navs: () => navs };
}

const cached = (page, p, cache = CACHE) => page.evaluate(async ([c, q]) => !!(await (await caches.open(c)).match(q)), [cache, p]);
const cachedText = (page, p, cache = CACHE) => page.evaluate(async ([c, q]) => {
  const hit = await (await caches.open(c)).match(q);
  return hit ? hit.text() : null;
}, [cache, p]);
const snapshotDeep = (page) => cachedText(page, DEEP);
const dataKept = (page) => page.evaluate(async ([data, kept]) => !!(await (await caches.open(data)).match(kept)), [DATA, KEPT]);
const repaired = (page) => page.evaluate(() => sessionStorage.getItem('fn_repaired_at'));
// Opened again with no network at all: a real document load from the worker.
async function reopenOffline(page) {
  await page.goto('about:blank');
  server.setDown(true);
  try {
    await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
    await landed(page);
  } finally { server.setDown(false); }
}
const panelUp = (page, timeout = 30000) => page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none'
  && performance.getEntriesByType('navigation')[0].type === 'reload', null, { timeout });
const tap = async (page, sel) => {
  const box = await page.locator(sel).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const skip = engine ? false : NO_BROWSER;

  test(`${name}, real worker: a copy that cannot link is repaired — proved this build's, then reloaded — and opens offline after`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await landed(page);
      // The open (the bad copy), the second try (the same bad copy), the
      // repaired reload. Never more.
      assert.equal(navs(), 3, `${navs()} loads`);
      assert.ok(server.log.includes(REPAIR_SIGN), 'not vacuous: the worker fetched its install list');
      assert.ok(!(await visible(page, 'screen-error')), 'no Try again panel over the running app');
      assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the same worker still serves the page');
      assert.equal(await snapshotDeep(page), fs.readFileSync(path.join(ROOT, DEEP), 'utf8'), 'the cache holds the real module');
      assert.ok(await cached(page, '/') && await cached(page, '/js/v3/qr.js'), 'and a whole copy: the page, the file only an install fetches');
      assert.ok(await repaired(page), 'the loop guard is set');
      assert.ok(await dataKept(page), 'the festival data cache is never touched');
      await page.waitForTimeout(1500);
      assert.equal(navs(), 3, 'and nothing reloads it again');
      // The next open with no signal at all.
      await reopenOffline(page);
      assert.ok(!(await visible(page, 'screen-error')), 'offline, the app opens: no Try again');
      assert.ok(await dataKept(page), 'and the festival data is still there');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: the network serves a NEWER build — nothing more fetched, nothing written, the browser asked for its worker, the panel`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    const n = Number(CACHE.replace('festival-nav-v', ''));
    const newer = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/(<meta name="fn-build" content=")v\d+(">)/, `$1v${n + 1}$2`);
    server.overlay.set('/', { body: newer, type: 'text/html; charset=utf-8' });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page);
      await page.waitForTimeout(1500);
      assert.equal(navs(), 2, 'the open and the second try; no reload after the answer');
      assert.match(await page.textContent('#error-msg'), /our side/);
      assert.equal(await snapshotDeep(page), STALE, 'nothing written into this build\'s cache');
      assert.ok(!server.log.includes(REPAIR_SIGN), `only the page was fetched, not the install list: ${server.log.filter((l) => !l.includes('/api/'))}`);
      assert.equal(await page.evaluate(() => window.__updates), 1, 'the page asked the browser for the newer worker');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a set that does not prove out (one file of another deploy) — nothing written, the panel`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    const util = fs.readFileSync(path.join(ROOT, 'js/util.js'), 'utf8');
    server.overlay.set('/js/util.js', { body: `${util}\n// another deploy\n` });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page);
      assert.ok(server.log.includes('GET /js/util.js'), 'not vacuous: the worker fetched the odd file');
      await page.waitForTimeout(1500);
      assert.equal(navs(), 2, 'the open and the second try; no reload');
      assert.match(await page.textContent('#error-msg'), /our side/);
      assert.equal(await snapshotDeep(page), STALE, 'nothing written');
      assert.equal(await cachedText(page, '/js/util.js'), util, 'not even the files that did match');
      assert.equal(await repaired(page), null);
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a network that hangs — the worker's deadline ends it on the panel, and nothing lands late`, { skip }, async () => {
    const quick = workerWith(['const REPAIR_MS = 20000;', 'const REPAIR_MS = 3000;']);
    const { ctx, page, navs } = await installedThenBroken(engine, { worker: quick });
    const FONT = '/assets/fonts/inter-var-latin.woff2';
    server.overlay.set(FONT, 'hang');
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page);
      assert.ok(server.log.includes(`GET ${FONT}`), 'not vacuous: the worker asked for the file that hangs');
      // "needs signal" is the worker's own "timeout" answer; a page that gave
      // up waiting on its own would say "our side".
      const words = await page.textContent('#error-msg');
      assert.match(words, /needs a fresh copy/, words);
      // The network wakes up: the held request gets its real answer, late.
      server.release();
      await page.waitForTimeout(3000);
      assert.equal(await snapshotDeep(page), STALE, 'nothing written, then or now');
      assert.equal(await repaired(page), null);
      assert.equal(navs(), 2, 'and no reload');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a file that does not arrive — nothing written, the panel says it needs signal, and Try again with signal repairs`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    server.overlay.set('/js/v3/qr.js', 'drop');
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page);
      await page.waitForTimeout(1000);
      assert.equal(navs(), 2, 'the open and the second try; nothing reloads into a dead network');
      const words = await page.textContent('#error-msg');
      assert.match(words, /needs a fresh copy/, words);
      assert.doesNotMatch(words, /weak signal/, 'a copy that cannot link is not only the signal’s fault');
      assert.equal(await snapshotDeep(page), STALE, 'this build’s copy is where it was');
      assert.ok(await cached(page, '/js/v3/qr.js'), 'and nothing taken out of it');
      // Signal back: their Try again repairs, and the app opens.
      server.overlay.clear();
      await tap(page, '#error-retry');
      await landed(page);
      assert.equal(navs(), 4, 'their Try again, then the repaired reload');
      assert.notEqual(await snapshotDeep(page), STALE, 'the real module now');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: Stay offline — nothing fetched on its own, the person's Try again is their yes, and it repairs`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine, { settings: { stayOffline: true } });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none', null, { timeout: 30000 });
      await page.waitForTimeout(2000);
      assert.equal(navs(), 1, 'Stay offline: no automatic try');
      assert.ok(!server.log.includes(REPAIR_SIGN), 'and no repair');
      assert.equal(await snapshotDeep(page), STALE, 'the copy is kept');
      assert.match(await page.textContent('#error-msg'), /needs signal/);
      await tap(page, '#error-retry');
      await landed(page);
      assert.equal(navs(), 3, 'their Try again, then the repaired reload');
      assert.notEqual(await snapshotDeep(page), STALE, 'the real module now');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('fn_fetch_once')), null, 'the yes was spent, not kept');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a build that cannot link even repaired — one repair, then the panel says so, never a loop`, { skip }, async () => {
    // The server itself serves the broken file — a bad release — and this
    // worker's stamp says that set IS its build, so the repair proves out.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-bad-release-'));
    let badStamp;
    try {
      for (const f of appCoreFiles(SW)) {
        fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
        fs.writeFileSync(path.join(dir, f), f === DEEP ? STALE : fs.readFileSync(path.join(ROOT, f)));
      }
      badStamp = assetStamp(SW, dir);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    const bad = workerWith([/const ASSET_STAMP = '[0-9a-f]{8}'/, `const ASSET_STAMP = '${badStamp}'`]);
    const { ctx, page, navs } = await installedThenBroken(engine, { worker: bad });
    server.overlay.set(DEEP, { body: STALE });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await waitForAsync(page, () => document.getElementById('screen-error').style.display !== 'none' && performance.getEntriesByType('navigation')[0].type === 'reload'
        && !!sessionStorage.getItem('fn_repaired_at'), null, { timeout: 30000, what: 'the panel after the repair' });
      const settled = navs();
      await page.waitForTimeout(5000);
      assert.equal(navs(), settled, 'no further loads: never a loop');
      assert.equal(settled, 3, `${settled} loads: the open, the second try, one repaired reload`);
      const words = await page.textContent('#error-msg');
      assert.match(words, /didn’t finish loading/);
      assert.doesNotMatch(words, /weak signal/, 'a copy that cannot link is not the signal’s fault');
      assert.match(words, /our side/);
      assert.ok(await visible(page, 'error-retry'), 'Try again is there');
      assert.ok(await dataKept(page), 'the festival data cache is never touched');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a worker from before the repair (v115's message handler) ignores the ask — nothing written, the panel in moments`, { skip }, async () => {
    // v115's handler, verbatim (service-worker.js on main at 084c29f): it
    // answers 'build?' and nothing else.
    const v115 = workerWith([/self\.addEventListener\('message', \(event\) => \{[\s\S]*?\n\}\);\n/, `self.addEventListener('message', (event) => {
  const d = event.data;
  if (!d || d.fn !== 'build?' || !event.source) return;
  try { event.source.postMessage({ fnBuild: CACHE_VERSION, fnStamp: ASSET_STAMP }); } catch { /* the page is gone */ }
});
`]);
    assert.ok(!v115.includes("'repair'"), 'not vacuous: the worker no longer knows the ask');
    const { ctx, page, navs } = await installedThenBroken(engine, { worker: v115 });
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page, 20000); // its three seconds to say "started", not the 25 s backstop
      await page.waitForTimeout(1500);
      assert.equal(navs(), 2, 'the open and the second try; no repair, no reload');
      assert.ok(!server.log.includes(REPAIR_SIGN));
      assert.equal(await snapshotDeep(page), STALE, 'the copy is where it was');
      assert.match(await page.textContent('#error-msg'), /our side/);
      assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'and the worker still serves');
    } finally { await ctx.close(); }
  });

  test(`${name}, real worker: a new build installing — no repair: its own install replaces this copy`, { skip }, async () => {
    const { ctx, page, navs } = await installedThenBroken(engine);
    // The next build's worker, whose install is still going (here it never ends).
    const next = workerWith(
      [/const CACHE_VERSION = 'festival-nav-v(\d+)'/, (m, n) => `const CACHE_VERSION = 'festival-nav-v${Number(n) + 1}'`],
      ["self.addEventListener('install', (event) => {", "self.addEventListener('install', (event) => { event.waitUntil(new Promise(() => {}));"],
    );
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
    server.log.length = 0;
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await panelUp(page);
      assert.ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).installing), 'not vacuous: the next worker is installing');
      await page.waitForTimeout(2500);
      assert.equal(navs() - hop, 2, 'the open and the second try; no repair');
      assert.ok(!server.log.includes(REPAIR_SIGN), 'nothing fetched for this copy');
      assert.equal(await snapshotDeep(page), STALE, 'this copy is left for the new worker to replace');
    } finally { await ctx.close(); }
  });

  // Chromium only: Playwright's WebKit drops what a page writes into a cache
  // the page itself created as soon as that page navigates (measured: a
  // planted cache went from 1 entry to 0 across a hop to a page with no app
  // at all), so the two caches cannot be planted there. What this proves —
  // which caches the repair writes — is the worker's own code in every engine.
  test(`${name}, real worker: only the worker's own cache — a newer worker's and one kept for its festival data stay as they were`, { skip: skip || (name === 'webkit' ? 'Playwright WebKit drops a page-created cache\'s entries on navigation (comment above)' : false) }, async () => {
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
      assert.notEqual(await snapshotDeep(page), STALE, 'not vacuous: the repair ran');
      assert.equal(await cachedText(page, '/js/v3/app.js', NEWER), 'newer build', 'a newer worker\'s cache is not this repair\'s to write');
      assert.equal(await page.evaluate(async (n) => (await (await caches.open(n)).keys()).length, NEWER), 1);
      assert.ok(await cached(page, '/data/festivals/legacy-fest.json', KEPT_OLD), 'the cache kept for festival data keeps it');
      assert.equal(await page.evaluate(async (n) => (await (await caches.open(n)).keys()).length, KEPT_OLD), 1, 'and gains nothing');
    } finally { await ctx.close(); }
  });
}
