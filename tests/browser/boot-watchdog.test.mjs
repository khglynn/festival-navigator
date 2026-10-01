// The black page, in a real browser (2026-10-01). A file of app.js's graph
// that never arrives — one lost on a weak signal, on a first visit nothing is
// cached yet — or arrives and cannot link to the rest (a stale copy beside
// new ones) leaves app.js unrun: before v107, a dark page with nothing to tap
// (PostHog: "App code didn't load", an Android first open; the Sep 25-26
// "Importing binding name" errors on iPhones). index.html's watchdog now
// gives the person a way forward: the error screen with Try again (an
// automatic second try only where the worker serves the page), a "still
// loading" screen when a file hangs — never a loop, never on a healthy open.
//
// Both engines with the worker blocked (the first-visit case: nothing serves
// from a cache). Then Chromium with a real worker: the worker's first claim
// reloads a page whose app never started, and a first visit's festival is
// kept for the next open without signal.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => {
  if (chromium) await chromium.close();
  if (webkit) await webkit.close();
  await server.close();
});

const DEEP = '/js/v3/foot.js'; // imported by app.js: any file of the graph will do
const visible = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  return !!el && el.style.display !== 'none' && el.getClientRects().length > 0;
}, id);

async function open(engine, routeDeep, waitUntil = 'load') {
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  // A blocked worker's register() resolves to nothing; the glue's update
  // checks want a registration to call.
  await ctx.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
  });
  const page = await ctx.newPage();
  let navs = 0;
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs += 1; }); // document loads, an aborted one too (framenavigated also counts replaceState)
  if (routeDeep) await page.route(`**${DEEP}`, routeDeep);
  await page.goto(`${server.origin}/`, { waitUntil });
  return { ctx, page, navs: () => navs };
}

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const skip = engine ? false : NO_BROWSER;

  test(`${name}: a healthy open is untouched — no second try, the landing`, { skip }, async () => {
    const { ctx, page, navs } = await open(engine, null);
    try {
      await page.waitForFunction(() => document.getElementById('screen-landing').style.display !== 'none', null, { timeout: 8000 });
      await page.waitForTimeout(800);
      assert.equal(navs(), 1, 'one load, no reload');
      assert.ok(!(await page.evaluate(() => window.__fnAppFailed)), 'the watchdog never fired');
      assert.equal(await page.evaluate(() => window.__fnAppRan), true);
    } finally { await ctx.close(); }
  });

  test(`${name}: an OLDER app that never says it ran is left alone past the 10 s net`, { skip }, async () => {
    // A returning phone's first open after a release: this page, the old
    // worker's cached app.js (no __fnAppRan). It loads fine and runs; the net
    // must not cover it (v107 review).
    const ctx = await engine.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    });
    const page = await ctx.newPage();
    await page.route('**/js/v3/app.js', (route) => route.fulfill({
      status: 200, contentType: 'text/javascript; charset=utf-8',
      body: "document.getElementById('screen-landing').style.display = '';\n",
    }));
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'load' });
      await page.waitForTimeout(11000);
      assert.ok(await visible(page, 'screen-landing'), 'the old app\u2019s screen');
      assert.ok(!(await visible(page, 'screen-error')), 'no "still loading" over a running app');
    } finally { await ctx.close(); }
  });

  test(`${name}: a first visit that loses a file shows Try again at once — and Try again opens it`, { skip }, async () => {
    // No worker serves this page yet, so it never reloads by itself: on a
    // dead network a reload could swap this page for the browser's own error
    // page (Sol's review, 2026-10-01). The person's tap is the second try.
    let failures = 0;
    const { ctx, page, navs } = await open(engine, (route) => {
      if (failures === 0) { failures += 1; return route.abort('failed'); }
      return route.continue();
    });
    try {
      await page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none', null, { timeout: 10000 });
      assert.equal(navs(), 1, 'no automatic reload of a page no worker serves');
      assert.ok(!(await visible(page, 'error-home')), 'Your crews needs the app that did not load: hidden');
      assert.match(await page.textContent('#error-msg'), /didn’t finish loading/);
      await page.click('#error-retry'); // real input: the person's own second try
      await page.waitForFunction(() => document.getElementById('screen-landing').style.display !== 'none', null, { timeout: 10000 });
      assert.equal(failures, 1);
      assert.equal(navs(), 2);
    } finally { await ctx.close(); }
  });

  test(`${name}: a file that never arrives — Try again, and never a loop`, { skip }, async () => {
    const { ctx, page, navs } = await open(engine, (route) => route.abort('failed'));
    try {
      await page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none', null, { timeout: 10000 });
      await page.waitForTimeout(1500);
      assert.equal(navs(), 1, 'no reload by itself');
      assert.ok(await visible(page, 'error-retry'), 'Try again is on screen');
    } finally { await ctx.close(); }
  });

  test(`${name}: a stale file that cannot link — Try again, never a loop`, { skip }, async () => {
    // What an old copy beside new ones looks like: the file is there, its
    // exports are not (the "Importing binding name … is not found" family).
    const { ctx, page, navs } = await open(engine, (route) => route.fulfill({
      status: 200, contentType: 'text/javascript; charset=utf-8', body: 'export const stale = true;\n',
    }));
    try {
      await page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none', null, { timeout: 10000 });
      await page.waitForTimeout(1500);
      assert.equal(navs(), 1);
      assert.ok(await visible(page, 'error-retry'));
    } finally { await ctx.close(); }
  });

  test(`${name}: a file that hangs — "still loading" at 10 s, and the app takes over when it arrives`, { skip }, async () => {
    let release = null;
    // A hung module holds the page's load event too: wait only for the commit.
    const { ctx, page, navs } = await open(engine, (route) => { release = () => route.continue(); }, 'commit');
    try {
      await page.waitForFunction(() => document.getElementById('screen-error').style.display !== 'none', null, { timeout: 16000 });
      assert.match(await page.textContent('#error-msg'), /Still loading/);
      assert.ok(await visible(page, 'error-retry'));
      assert.equal(navs(), 1);
      release(); // the slow file arrives after all
      await page.waitForFunction(() => document.getElementById('screen-landing').style.display !== 'none', null, { timeout: 10000 });
      assert.ok(!(await visible(page, 'screen-error')), 'the app took the screen over');
    } finally { await ctx.close(); }
  });
}

// ---- a real worker (Chromium) -------------------------------------------------
const skipSw = chromium ? false : NO_BROWSER;
const TOKEN = 'watchdogfirstvisit_01234'; // made up: never a real crew link
const DOC = {
  v: 4, meta: { name: 'Watchdog Crew', inviteFestId: 'acl-2026' }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { 'acl-2026': { selections: {} } },
};

async function crewApi(ctx, { dead = () => false } = {}) {
  // The context's routes also see the worker's own requests.
  await ctx.route('**/api/**', (route) => {
    if (dead()) return route.abort('failed');
    const u = route.request().url();
    if (u.includes('/api/crew')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DOC) });
    if (u.includes('/api/festival-add')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"festivals":[]}' });
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
}

test('chromium, real worker: a first open whose app never started is reloaded when the worker claims it', { skip: skipSw }, async () => {
  const ctx = await chromium.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let navs = 0;
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs += 1; }); // document loads, an aborted one too (framenavigated also counts replaceState)
  // The PAGE never gets this file (both its tries fail); the worker's install
  // fetches it fine — so once the worker claims, its snapshot opens the app.
  await page.route(`**${DEEP}`, (route) => route.abort('failed'));
  try {
    await page.goto(`${server.origin}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('screen-landing').style.display !== 'none', null, { timeout: 20000 });
    // The load, then the claim's reload from the worker's snapshot. Never more.
    assert.equal(navs, 2, `${navs} loads`);
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'served by the worker now');
  } finally { await ctx.close(); }
});

test('chromium, real worker: a first visit keeps its festival, and the next open without signal shows it', { skip: skipSw }, async () => {
  const ctx = await chromium.newContext({ viewport: { width: 390, height: 844 } });
  let dead = false;
  await crewApi(ctx, { dead: () => dead });
  await ctx.route('**/data/festivals/*-20*.json', (route) => (dead ? route.abort('failed') : route.continue()));
  const page = await ctx.newPage();
  let navs = 0;
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs += 1; }); // document loads, an aborted one too (framenavigated also counts replaceState)
  try {
    await page.goto(`${server.origin}/#g=${TOKEN}&f=acl-2026`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('screen-app').style.display !== 'none', null, { timeout: 15000 });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
    // Before v107 this stayed empty until a SECOND good open: the first fetch
    // left before the worker controlled the page.
    await page.waitForFunction(async () => {
      const c = await caches.open('festival-nav-data-v1');
      return !!(await c.match('/data/festivals/acl-2026.json'));
    }, null, { timeout: 15000, polling: 250 });
    assert.equal(navs, 1, 'the worker\u2019s first claim does not reload a page whose app started');

    // No signal now. A real document load (hop via about:blank: a hash-only
    // navigation would keep the module map), on the bare address.
    dead = true;
    await page.goto('about:blank');
    await page.goto(`${server.origin}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => ['screen-app', 'screen-error'].some((id) => document.getElementById(id).style.display !== 'none'), null, { timeout: 20000 });
    assert.ok(await visible(page, 'screen-app'), 'the ACL wall, from the copy the first visit kept');
    assert.match(await page.title(), /ACL/);
  } finally { await ctx.close(); }
});

test('chromium, real worker: a slow first open that does start is not reloaded when the worker claims it', { skip: skipSw }, async () => {
  // The app arrives after the 10 s net (its page copy of one file held 11 s),
  // the worker after that (its script held 13 s): the claim must leave the
  // running app alone (v107 review).
  const ctx = await chromium.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let navs = 0;
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs += 1; });
  let slowed = 0;
  await page.route(`**${DEEP}`, async (route) => {
    if (slowed++ === 0) await new Promise((r) => setTimeout(r, 11000));
    return route.continue();
  });
  let swSlowed = 0;
  await ctx.route('**/service-worker.js', async (route) => {
    if (swSlowed++ === 0) await new Promise((r) => setTimeout(r, 13000));
    return route.continue();
  });
  try {
    await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__fnAppRan === true, null, { timeout: 20000 });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    assert.equal(navs, 1, `a page whose app started was not reloaded (${navs} loads)`);
    assert.ok(await visible(page, 'screen-landing'));
  } finally { await ctx.close(); }
});
