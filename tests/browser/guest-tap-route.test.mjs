// A guest's finger on the real app, in a real engine (v92 — the code map,
// 2026-09-26: the guest tap route was pinned only in jsdom). An iPhone
// profile (touch, mobile viewport): a tap on a card opens its zoom and picks
// nothing; the zoom's + asks on the join shelf, naming the artist; a tap on
// another card while a zoom is open only closes it; and a flick that starts
// on a card does not cost the next tap on a day tab. Nothing is written.
//
// WebKit is the engine that matters (iPhones): Playwright's WebKit touch tap
// sends pointerdown/pointerup as TOUCH and the click after them as MOUSE —
// the same shape as a real iPhone, checked 2026-09-26 — so it runs there
// whenever WebKit is installed. CI installs Chromium only, so the same walk
// runs in Chromium with touch as well (its taps are touch-type too).
// The app boots for real against a made-up crew; /api never leaves the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
let devices = {};
try {
  const pw = await import('playwright');
  devices = pw.devices;
  webkit = await pw.webkit.launch({ headless: true });
} catch { /* not installed: that engine skips */ }
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
  await ctx.route('**/api/crew**', (r) => {
    if (r.request().method() !== 'GET') writes.push(r.request().url());
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) });
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
// Another card, uncovered by the zoom, to tap while one is open.
const otherCard = (page, not) => page.evaluate((n) => {
  for (const c of document.querySelectorAll('#wall-root .card[data-artist]')) {
    if (c.dataset.artist === n) continue;
    const r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + Math.min(20, r.height / 2);
    if (y < 80 || y > innerHeight - 90 || x < 4 || x > innerWidth - 4) continue;
    if (document.elementFromPoint(x, y)?.closest('.card') === c) return { x: Math.round(x), y: Math.round(y), artist: c.dataset.artist };
  }
  return null;
}, not);
const zoomUp = (page) => page.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown').length);
const level = (page, artist) => page.evaluate(async (a) => {
  const st = await import('/js/state.js');
  return JSON.stringify(st.crewDoc.festivals['portola-2026'].selections[a] || {});
}, artist);

for (const [name, get] of [['WebKit (iPhone)', () => webkit], ['Chromium (touch)', () => chromium]]) {
  test(`${name}: a guest's tap opens the card and picks nothing; + asks on the shelf; a tap on another card only closes; a flick never costs the next tap`, {
    skip: get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER),
  }, async () => {
    const { ctx, page, errors, writes } = await guestPhone(get());
    try {
      const before = await level(page, 'Tove Lo');
      const at = await cardAt(page, 'Tove Lo');
      await page.touchscreen.tap(at.x, at.y);
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
      await sleep(600);
      assert.equal(await level(page, 'Tove Lo'), before, 'the tap opened the card and picked nothing');
      assert.equal(await page.locator('.join-shelf').count(), 0, 'and asked nothing yet');
      assert.deepEqual(await page.locator('#zoom-layer .zoom-slot.shown .f-step-row > *').allTextContents(), ['−', '+ note', '+']);

      const plus = await page.locator('#zoom-layer .zoom-slot.shown .f-step.plus').boundingBox();
      await page.touchscreen.tap(plus.x + plus.width / 2, plus.y + plus.height / 2);
      await page.waitForSelector('.join-shelf', { timeout: 4000 });
      await sleep(500);
      assert.equal(await page.locator('.join-shelf .js-line').textContent(), 'Pick Tove Lo as…');
      assert.equal(await zoomUp(page), 0, 'the zoom went back into its card');
      const look = await page.locator('.join-shelf .js-look').boundingBox();
      await page.touchscreen.tap(look.x + look.width / 2, look.y + look.height / 2);
      await sleep(600);
      assert.equal(await page.locator('.join-shelf').count(), 0, 'Look around took the shelf down');

      // A tap on another card while a zoom is open only closes it.
      const again = await cardAt(page, 'Tove Lo');
      await page.touchscreen.tap(again.x, again.y);
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
      await sleep(600);
      const other = await otherCard(page, 'Tove Lo');
      assert.ok(other, 'another card on screen, clear of the zoom');
      const otherBefore = await level(page, other.artist);
      await page.touchscreen.tap(other.x, other.y);
      await sleep(700);
      assert.equal(await zoomUp(page), 0, `the tap on ${other.artist} closed the zoom`);
      assert.equal(await page.locator('.join-shelf').count(), 0, 'and asked nothing');
      assert.equal(await level(page, other.artist), otherBefore, 'and picked nothing');

      // A flick that starts on a card while a zoom is open, then a quick tap
      // on a day tab: the tab still gets its tap (the close-tap's swallow is
      // the flick's own, and only ever eats a click on a card).
      const t2 = await cardAt(page, 'Tove Lo');
      await page.touchscreen.tap(t2.x, t2.y);
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
      await sleep(600);
      const o2 = await otherCard(page, 'Tove Lo');
      const cdp = get() === chromium ? await ctx.newCDPSession(page) : null;
      if (cdp) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: o2.x, y: o2.y }] });
        for (let i = 1; i <= 6; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: o2.x, y: o2.y - i * 25 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        // WebKit has no drag input here: the same press, then the pointercancel a scroll sends.
        await page.evaluate(({ x, y }) => {
          const t = document.elementFromPoint(x, y);
          t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: x, clientY: y }));
          t.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch' }));
        }, o2);
      }
      await sleep(80);
      // A dock control that is itself under its centre: a day tab, or NOW.
      // (The dock's days scroll, so one can sit under NOW; and while the row
      // is still gliding to centre its active day, WebKit takes a tap on it
      // as the finger stopping that scroll — as an iPhone does — so a day tab
      // is only chosen once it is the thing under its own centre.)
      const tabs = await page.evaluate(() => [...document.querySelectorAll('#dock .day-tab:not(.active), #dock .now-tab')]
        .map((b) => { const r = b.getBoundingClientRect(); return { b, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: b.textContent.trim() }; })
        .filter((t) => t.b.getBoundingClientRect().width && document.elementFromPoint(t.x, t.y) === t.b)
        .map(({ x, y, text }) => ({ x, y, text })));
      assert.ok(tabs.length, 'a dock control to tap');
      // Its own click handler hears the tap (a swallowed click never reaches
      // it: the swallow stops it at the document, capture phase).
      await page.evaluate(() => {
        window.__tabTapped = null;
        for (const b of document.querySelectorAll('#dock .day-tab, #dock .now-tab')) b.addEventListener('click', () => { window.__tabTapped = b.textContent.trim(); });
      });
      await page.touchscreen.tap(tabs[0].x, tabs[0].y);
      await sleep(300);
      assert.equal(await page.evaluate(() => window.__tabTapped), tabs[0].text, `the quick tap on ${tabs[0].text} landed`);

      assert.deepEqual(writes, [], 'a guest sends nothing');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// The two the independent walk of b29aac0 caught, with real input: a REAL
// Escape key over the shelf a zoom's + opened must not regrow that zoom (the
// focus handed back to the card used to read as keyboard navigation), and a
// guest who joins from the shelf gets the just-joined welcome once — it
// never showed, because the guest card had been read before the join landed.
for (const [name, get] of [['WebKit (iPhone)', () => webkit], ['Chromium (touch)', () => chromium]]) {
  test(`${name}: a real Escape over the shelf leaves no zoom behind; joining from the shelf brings the just-joined welcome`, {
    skip: get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER),
  }, async () => {
    const { ctx, page, errors } = await guestPhone(get());
    try {
      const at = await cardAt(page, 'Tove Lo');
      await page.touchscreen.tap(at.x, at.y);
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
      await sleep(600);
      let plus = await page.locator('#zoom-layer .zoom-slot.shown .f-step.plus').boundingBox();
      await page.touchscreen.tap(plus.x + plus.width / 2, plus.y + plus.height / 2);
      await page.waitForSelector('.join-shelf', { timeout: 4000 });
      await sleep(600); // the zoom has gone back into its card
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.join-shelf'), null, { timeout: 4000 });
      await sleep(400); // the regrown zoom used to appear within 50 ms
      assert.equal(await zoomUp(page), 0, 'no zoom grew back over the card');

      // Now join from the shelf, under a new name.
      const again = await cardAt(page, 'Tove Lo');
      await page.touchscreen.tap(again.x, again.y);
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
      await sleep(600);
      plus = await page.locator('#zoom-layer .zoom-slot.shown .f-step.plus').boundingBox();
      await page.touchscreen.tap(plus.x + plus.width / 2, plus.y + plus.height / 2);
      await page.waitForSelector('.join-shelf', { timeout: 4000 });
      await sleep(500);
      const field = await page.locator('.join-shelf .js-field').boundingBox();
      await page.touchscreen.tap(field.x + field.width / 2, field.y + field.height / 2);
      await page.keyboard.type('Ana');
      const go = await page.locator('.join-shelf .js-go').boundingBox();
      await page.touchscreen.tap(go.x + go.width / 2, go.y + go.height / 2);
      await page.waitForSelector('#welcome-card', { timeout: 10000 });
      await page.waitForFunction(() => document.getElementById('dock-you')?.textContent === 'A', null, { timeout: 5000 });
      await page.waitForFunction(async () => ((await import('/js/state.js')).crewDoc.festivals['portola-2026'].selections['Tove Lo'] || {}).Ana === 1, null, { timeout: 5000 });
      await sleep(600);
      assert.match(await page.locator('#welcome-card .bring-sub').textContent(), /Tap any artist to add yours/, 'the just-joined welcome, in a member’s words');
      assert.deepEqual(await page.locator('#welcome-card .bring-actions button').allTextContents(), ['Got it']);
      assert.equal(await page.locator('#dock-you').textContent(), 'A', 'Ana is in');
      assert.equal(await level(page, 'Tove Lo'), JSON.stringify({ Maya: 4, Ana: 1 }), 'and Tove Lo is her first pick');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
