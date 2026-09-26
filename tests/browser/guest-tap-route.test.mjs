// A guest's finger on the real app, in a real engine (v92 — the code map,
// 2026-09-26: the guest tap route was pinned only in jsdom; the tap change,
// 2026-09-26: a finger's tap opens the card's SHELF, a guest's included). An
// iPhone profile (touch, mobile viewport): a tap on a card opens its shelf and
// picks nothing; the shelf's + asks on the join shelf, naming the artist, in
// the notes shelf's place and on its history entry; "Look around" lands on the
// wall; a tap on the dimmed wall closes a shelf and opens nothing under it.
// Nothing is written.
//
// WebKit is the engine that matters (iPhones): Playwright's WebKit touch tap
// sends pointerdown/pointerup as TOUCH and the click after them as MOUSE —
// the same shape as a real iPhone, checked 2026-09-26 — and CI installs it
// (U0). The same walk runs in Chromium with touch as well.
// (The v92 close-tap swallow and its flick-then-tab case are gone: a finger
// grows no zoom any more, so there is no close-tap to swallow.)
// The app boots for real against a made-up crew; /api never leaves the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER } from '../helpers/browser.mjs';
import { deepMerge } from '../../js/merge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
let devices = {};
devices = (await import('playwright')).devices;
webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

const FID = 'portola-2026';

async function guestPhone(engine) {
  const CREW = randomBytes(20).toString('base64url'); // a made-up crew, never a real link
  const profile = devices['iPhone 13'] || { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
  const opts = { ...profile, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' };
  if (engine === chromium) delete opts.defaultBrowserType;
  const ctx = await engine.newContext(opts);
  await ctx.addInitScript(() => { localStorage.setItem('fn_welcome_v1', '1'); });
  const doc = {
    v: 4, meta: { name: 'Tap Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
    festivals: { [FID]: { selections: { 'Tove Lo': { Maya: 4 }, Fcukers: { Kevin: 2 } } } },
  };
  const writes = [];
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  // The crew answers like the real one: a write is merged in and the merged
  // doc comes back (a fixed doc would erase a join's pick on its own echo).
  let crewDoc = doc;
  await ctx.route('**/api/crew**', (r) => {
    if (r.request().method() !== 'GET') {
      writes.push(r.request().url());
      try { crewDoc = deepMerge(crewDoc, JSON.parse(r.request().postData() || '{}').data || {}); } catch { /* not JSON */ }
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(crewDoc) });
  });
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-09-26T15:15:00-07:00'));
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await sleep(400);
  return { ctx, page, errors, writes };
}

// The centre of a card that is wholly on screen and on top there.
const cardAt = (page, artist) => page.evaluate((a) => {
  const el = document.querySelector(`#wall-root .card[data-artist="${a}"]`);
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 30)) };
}, artist);
const zoomUp = (page) => page.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown').length);
const notesUp = (page) => page.evaluate(() => { const n = document.getElementById('artist-sheet'); return !!n && !n.classList.contains('join-shelf'); });
const level = (page, artist) => page.evaluate(async (a) => {
  const st = await import('/js/state.js');
  return JSON.stringify(st.crewDoc.festivals['portola-2026'].selections[a] || {});
}, artist);
const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const tap = (page, p) => page.touchscreen.tap(Math.round(p.x), Math.round(p.y));
async function openShelf(page, artist) {
  await tap(page, await cardAt(page, artist));
  await page.waitForFunction(() => { const n = document.getElementById('artist-sheet'); return !!n && !n.classList.contains('join-shelf'); }, null, { timeout: 4000 });
  await sleep(500);
}

for (const [name, get] of [['WebKit (iPhone)', () => webkit], ['Chromium (touch)', () => chromium]]) {
  test(`${name}: a guest's tap opens the card's shelf and picks nothing; its + asks in the shelf's place; Look around lands on the wall; the dimmed wall closes a shelf`, {
    skip: get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER),
  }, async () => {
    const { ctx, page, errors, writes } = await guestPhone(get());
    try {
      const before = await level(page, 'Tove Lo');
      await openShelf(page, 'Tove Lo');
      assert.equal(await level(page, 'Tove Lo'), before, 'the tap opened the card and picked nothing');
      assert.equal(await zoomUp(page), 0, 'no zoom');
      assert.equal(await page.locator('.join-shelf').count(), 0, 'and asked nothing yet');
      assert.deepEqual(await page.locator('#artist-sheet .sheet-card .f-step-row > *').evaluateAll((ns) => ns.map((n) => n.className.split(' ')[0])),
        ['f-step', 'f-meter', 'f-step'], '− · a hollow meter · +');

      await tap(page, centre(await page.locator('#artist-sheet .sheet-card .f-step.plus').boundingBox()));
      await page.waitForSelector('.join-shelf', { timeout: 4000 });
      await sleep(500);
      assert.equal(await page.locator('.join-shelf .js-line').textContent(), 'Pick Tove Lo as…');
      assert.equal(await notesUp(page), false, 'the notes shelf gave way');
      assert.equal(await page.evaluate(() => history.state && history.state.joinShelf), true, 'on the notes shelf’s own entry');
      await tap(page, centre(await page.locator('.join-shelf .js-look').boundingBox()));
      await sleep(700);
      assert.equal(await page.locator('.join-shelf').count(), 0, 'Look around took the shelf down');
      assert.equal(await notesUp(page), false, 'and landed on the wall');
      assert.equal(await page.evaluate(() => ((history.state && history.state.layers) || []).length), 0, 'no sheet left in the history under it');

      // A tap on the dimmed wall closes a shelf and opens nothing under it.
      await openShelf(page, 'Tove Lo');
      await tap(page, { x: 195, y: 40 });
      await sleep(700);
      assert.equal(await notesUp(page), false, 'closed');
      assert.equal(await zoomUp(page), 0, 'nothing grew');
      assert.equal(await page.locator('.join-shelf').count(), 0, 'and nothing asked');

      assert.deepEqual(writes, [], 'a guest sends nothing');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// The two the independent walk of b29aac0 caught, with real input: a REAL
// Escape key over the join shelf must leave nothing behind it (no notes shelf,
// no zoom regrown on the card), and a guest who joins from the shelf's + gets
// the just-joined welcome once, with the pick they tapped for landing at 1.
for (const [name, get] of [['WebKit (iPhone)', () => webkit], ['Chromium (touch)', () => chromium]]) {
  test(`${name}: a real Escape over the join shelf leaves nothing behind; joining from the shelf's + brings the just-joined welcome and the pick`, {
    skip: get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER),
  }, async () => {
    const { ctx, page, errors } = await guestPhone(get());
    try {
      await openShelf(page, 'Tove Lo');
      await tap(page, centre(await page.locator('#artist-sheet .sheet-card .f-step.plus').boundingBox()));
      await page.waitForSelector('.join-shelf', { timeout: 4000 });
      await sleep(600);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.join-shelf'), null, { timeout: 4000 });
      await sleep(400); // a regrown zoom used to appear within 50 ms
      assert.equal(await zoomUp(page), 0, 'no zoom grew over the card');
      assert.equal(await notesUp(page), false, 'and no notes shelf came back');

      // Now join from the shelf's +, under a new name.
      await openShelf(page, 'Tove Lo');
      await tap(page, centre(await page.locator('#artist-sheet .sheet-card .f-step.plus').boundingBox()));
      await page.waitForSelector('.join-shelf', { timeout: 4000 });
      await sleep(500);
      await tap(page, centre(await page.locator('.join-shelf .js-field').boundingBox()));
      await page.keyboard.type('Ana');
      await tap(page, centre(await page.locator('.join-shelf .js-go').boundingBox()));
      await page.waitForSelector('#welcome-card', { timeout: 10000 });
      await page.waitForFunction(() => document.getElementById('dock-you')?.textContent === 'A', null, { timeout: 5000 });
      await page.waitForFunction(async () => ((await import('/js/state.js')).crewDoc.festivals['portola-2026'].selections['Tove Lo'] || {}).Ana === 1, null, { timeout: 5000 });
      await sleep(600);
      assert.match(await page.locator('#welcome-card .bring-sub').textContent(), /Tap any artist, then \+ to add yours/, 'the just-joined welcome, in a member’s words');
      assert.deepEqual(await page.locator('#welcome-card .bring-actions button').allTextContents(), ['Got it']);
      assert.equal(await page.locator('#dock-you').textContent(), 'A', 'Ana is in');
      assert.deepEqual(JSON.parse(await level(page, 'Tove Lo')), { Maya: 4, Ana: 1 }, 'and Tove Lo is her first pick');
      assert.equal(await notesUp(page), false, 'on the wall, where she was');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
