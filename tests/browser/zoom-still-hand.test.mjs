// Content moving under a still mouse is not the hand arriving (2026-09-24),
// in a real engine with real input.
//
// The v87 review's repro, Chromium 1280×800, mouse, Saturday 10:30 PM PDT,
// Ross highlighted: click NOW in the rail. The page glides down and the rail
// sticks at the top, so the resting pointer is now over the wall. The engine
// reports the card that slid under it with boundary events at the pointer's
// own pixel (WebKit adds a pointermove there too); hover intent believed
// them, Skepta's zoom bloomed over the rail and covered NOW, and a second
// click on NOW picked Skepta — a write to the crew doc, on a cancelled act.
// A wheel or a trackpad does the same without any click.
//
// The rule (card-facts.js `handCard`): an entry at the pixel the mouse last
// moved to grows only the card the hand was already on; any other card waits
// for the hand to actually move, and then grows as usual. (Since 2026-09-24
// a zoom also clears the sticky rail and strip — the chrome contract — but
// this rule is what keeps content sliding under a still mouse from growing
// anything at all.) The jsdom twin is tests/zoom-still-hand.test.mjs.
//
// Chromium always; WebKit too where Playwright's WebKit is installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FID = 'portola-2026';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveStatic(ROOT);
const browser = await launchBrowser();
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: those cases skip */ }
test.after(async () => { if (browser) await browser.close(); if (webkit) await webkit.close(); await server.close(); });
const skipWebkit = webkit ? false : 'Playwright WebKit is not installed (npx playwright install webkit)';
const ENGINES = [[browser, '', browser ? false : NO_BROWSER], [webkit, 'WebKit: ', skipWebkit]];

const SEL = { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Prospa: { Nhu: 2 } };
const doc = () => ({
  v: 4, meta: { name: 'Hand', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 } },
  festivals: { [FID]: { selections: SEL } },
});

async function openWall(engine, at) {
  const ctx = await engine.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const TOKEN = 'stillhandcontract_012345'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Hand' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN, FID]);
  const body = JSON.stringify(doc());
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.setFixedTime(new Date(at));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(400);
  return { ctx, page };
}

const zoomState = (page) => page.evaluate(() => {
  const shown = document.querySelector('#zoom-layer .zoom-slot.shown');
  const src = document.querySelector('#wall-root .card.zoom-source');
  return { open: !!shown, card: shown && src ? src.dataset.artist : null };
});
// The card under a point — through a zoom standing there, which stands for its card.
const cardUnder = (page, x, y) => page.evaluate(([px, py]) => {
  const e = document.elementFromPoint(px, py);
  if (e && e.closest('#zoom-layer')) { const src = document.querySelector('#wall-root .card.zoom-source'); return src ? src.dataset.artist : null; }
  const c = e && e.closest('.card[data-artist]');
  return c ? c.dataset.artist : null;
}, [x, y]);

// Wait on state, never a fixed delay (a loaded laptop runs every timer late,
// 2026-09-24): the page has stopped scrolling when scrollY holds still for
// ten frames in a row.
const scrollSettled = (page) => page.evaluate(() => new Promise((res) => {
  let last = -1, still = 0;
  const tick = () => {
    if (window.scrollY === last) still++; else { still = 0; last = window.scrollY; }
    if (still >= 10) res(window.scrollY); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
// A negative ("nothing grew") needs a window: the hover intent's delay and a
// margin, measured from when the page settled.
const INTENT_WINDOW = 200 + 400;
const zoomGone = (page) => page.waitForFunction(() => !document.querySelector('#zoom-layer .zoom-slot.shown'), null, { timeout: 5000 });
const railNow = (page) => page.evaluate(() => { const r = document.getElementById('rail-now').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
const labelOf = (page, a) => page.evaluate((x) => { const c = [...document.querySelectorAll('#wall-root .card')].find((el) => el.dataset.artist === x); return c && c.getAttribute('aria-label'); }, a);

// The glide: NOW clicked with the mouse, the page settling under it.
async function glide(page) {
  await page.locator('#person-chips .person-chip', { hasText: 'Ross' }).first().click();
  await sleep(400);
  const now = await railNow(page);
  await page.mouse.click(now.x, now.y);
  await sleep(200); // let the glide begin
  await scrollSettled(page);
  return now;
}

for (const [engine, name, skip] of ENGINES) {
  test(`${name}NOW glides the wall under a still mouse: nothing grows, and the second click on NOW picks nothing`, { skip }, async () => {
    const { ctx, page } = await openWall(engine, '2026-09-26T22:30:00-07:00');
    try {
      const now = await glide(page);
      await sleep(INTENT_WINDOW);
      const under = await cardUnder(page, now.x, now.y);
      assert.ok(under, `not vacuous: after the glide the still pointer is over a card (${under})`);
      const z = await zoomState(page);
      assert.equal(z.open, false, `the card that slid under the still pointer (${under}) did not grow: ${JSON.stringify(z)}`);
      // The hand goes back up to NOW (the rail is stuck at the top now) and clicks it again.
      const again = await railNow(page);
      const before = await labelOf(page, under);
      await page.mouse.move(again.x, again.y, { steps: 6 });
      await page.mouse.click(again.x, again.y);
      await zoomGone(page);
      assert.match(await labelOf(page, 'Skepta') || '', / — not picked/, 'Skepta is still unpicked');
      assert.equal(await labelOf(page, under), before, `nor did the second click pick the card under the pointer (${under})`);
    } finally {
      await ctx.close();
    }
  });

  // The same walk with a slow hand: the way up to NOW dwells on the card under
  // it for longer than the hover intent, so that card's zoom rightly grows.
  // Before the zoom cleared the sticky chrome it grew over the rail and ate
  // the click aimed at NOW as a pick of Skepta, a cancelled act — 3 of 3 at
  // 70ms a step on the build before the ceiling, and 5 to 9 of 24 when six
  // copies of the test above ran at once, where a loaded driver made the same
  // slow pass (2026-09-24, the zoom-chrome build log).
  test(`${name}a slow hand on its way up to NOW grows the card it passes — and the click still lands on NOW`, { skip }, async () => {
    const { ctx, page } = await openWall(engine, '2026-09-26T22:30:00-07:00');
    try {
      const now = await glide(page);
      await sleep(INTENT_WINDOW);
      const under = await cardUnder(page, now.x, now.y);
      const again = await railNow(page);
      const before = await labelOf(page, under);
      let grew = false;
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(now.x + ((again.x - now.x) * i) / 6, now.y + ((again.y - now.y) * i) / 6);
        await sleep(i === 1 ? 450 : 70); // a dwell on the card, longer than the intent
        grew = grew || (await zoomState(page)).open;
      }
      assert.ok(grew, `not vacuous: the slow pass grew the card it dwelt on (${under})`);
      const z = await page.evaluate(() => {
        const s = document.querySelector('#zoom-layer .zoom-slot.shown');
        const rail = document.getElementById('day-rail').getBoundingClientRect();
        return s ? { top: s.getBoundingClientRect().top, railBottom: rail.bottom } : null;
      });
      if (z) assert.ok(z.top >= z.railBottom, `a standing zoom never covers the rail: ${JSON.stringify(z)}`);
      await page.mouse.click(again.x, again.y);
      await zoomGone(page);
      assert.match(await labelOf(page, 'Skepta') || '', / — not picked/, 'Skepta is still unpicked');
      assert.equal(await labelOf(page, under), before, `the click aimed at NOW picked nothing (${under})`);
    } finally {
      await ctx.close();
    }
  });

  test(`${name}a wheel scrolls a card under a still mouse: it does not grow; one small move and it grows as usual`, { skip }, async () => {
    const { ctx, page } = await openWall(engine, '2026-09-23T19:00:00-07:00');
    try {
      // A spot on the wall with no card under it, and a card a little below it.
      const P = await page.evaluate(() => {
        for (const c of document.querySelectorAll('#wall-root .card.cell')) {
          const r = c.getBoundingClientRect();
          if (r.top < 250 || r.top > 650) continue;
          const x = Math.round(r.left + r.width / 2);
          for (let y = Math.round(r.top) - 8; y > r.top - 120; y -= 4) {
            const e = document.elementFromPoint(x, y);
            if (e && !e.closest('.card') && e.closest('#wall-root')) return { x, y, dy: Math.round(r.top + r.height / 2 - y) };
          }
        }
        return null;
      });
      assert.ok(P, 'found an empty spot above a card');
      await page.mouse.move(P.x - 40, P.y, { steps: 2 });
      await page.mouse.move(P.x, P.y, { steps: 2 });
      await sleep(INTENT_WINDOW);
      assert.equal((await zoomState(page)).open, false, 'resting on empty wall: nothing grows');
      await page.mouse.wheel(0, P.dy);
      await sleep(100);
      await scrollSettled(page);
      await sleep(INTENT_WINDOW);
      const under = await cardUnder(page, P.x, P.y);
      assert.ok(under, `not vacuous: the wheel brought a card under the still pointer (${under})`);
      const z = await zoomState(page);
      assert.equal(z.open, false, `the card the wheel brought under the still pointer (${under}) did not grow: ${JSON.stringify(z)}`);
      await page.mouse.move(P.x + 2, P.y, { steps: 1 }); // the hand: one small move
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 5000 });
      assert.equal((await zoomState(page)).card, under, 'one small move over it and it grows, after the usual intent delay');
    } finally {
      await ctx.close();
    }
  });
}
