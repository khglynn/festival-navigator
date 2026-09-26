// A finger leaves a ghost of a mouse where it lifted — in a real browser
// (2026-09-23; the rule and its history: tests/zoom-touch-ghost.test.mjs).
//
// WebKit does it on its own: a touch tap, then — when the page changes under
// the finger — trusted mouse-type pointerover / pointerenter at that spot,
// and hover intent used to grow the card you had just tapped. Since the tap
// change (2026-09-26) a finger's tap opens the card's SHELF, and the shelf
// closing uncovers the wall right under the spot: exactly where a ghost would
// grow a zoom. Chromium never sends the ghosts, so there this drives the same
// events through the real input layer: a touch tap, then a trusted mouse move
// to the exact lift point. WebKit runs the phenomenon itself, with nothing but
// touch taps (CI installs WebKit since U0).
//
// Against gallery.html, which renders the production modules with the
// shipping route (a finger opens the shelf) and no network. The same laws on
// the real app: tests/browser/tap-shelf-contract.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER, REQUIRED } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OPEN_MS = 700; // ZOOM_IN_MS (200) + the bloom, with room for a slow engine
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveStatic(ROOT);
const browser = await launchBrowser();
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch (e) { if (REQUIRED) throw e; /* not installed here: that half skips */ }
test.after(async () => {
  if (browser) await browser.close();
  if (webkit) await webkit.close();
  await server.close();
});
const skip = browser ? false : NO_BROWSER;

async function openGallery(engine, { isMobile = false } = {}) {
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(`${server.origin}/gallery.html`, { waitUntil: 'load' });
  await page.waitForSelector('#zoom-row-meter .card', { state: 'visible', timeout: 15000 });
  await page.evaluate(() => document.getElementById('zoom-row-meter').scrollIntoView({ block: 'center' }));
  await sleep(300);
  return { ctx, page };
}

// A card in the meter row that is wholly on screen and on top at its centre.
const target = (page) => page.evaluate(() => {
  for (const c of document.querySelectorAll('#zoom-row-meter .card')) {
    const r = c.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + 16);
    if (r.left < 4 || r.right > innerWidth - 4 || r.top < 60 || r.bottom > innerHeight - 60) continue;
    if (document.elementFromPoint(x, y)?.closest('.card') === c) return { artist: c.dataset.artist, x, y, right: Math.round(r.right) };
  }
  return null;
});
const zoomState = (page) => page.evaluate(() => ({
  shown: document.querySelectorAll('#zoom-layer .zoom-slot.shown').length,
  source: document.querySelector('.card.zoom-source')?.dataset.artist || null,
}));
const levelOf = (page, artist) => page.evaluate((a) => {
  const m = document.querySelector(`#zoom-row-meter .card[data-artist="${a}"] > .corner-about > .chip-meter`);
  return m ? Number(m.dataset.level) : 0;
}, artist);

const shelfOf = (page) => page.evaluate(() => document.querySelector('#artist-sheet .sheet-card .f-name')?.textContent || null);
const closeShelf = async (page) => {
  await page.touchscreen.tap(195, 30); // the dimmed wall
  await page.waitForFunction(() => !document.getElementById('artist-sheet'), null, { timeout: 4000 });
};

test('Chromium: a tap opens the shelf; once it closes, a mouse event at the spot the finger lifted grows nothing; a mouse that moves off it hovers as ever', { skip }, async () => {
  const { ctx, page } = await openGallery(browser);
  try {
    const t = await target(page);
    assert.ok(t, 'a card on screen to tap');
    const before = await levelOf(page, t.artist);
    await page.touchscreen.tap(t.x, t.y);
    await page.waitForFunction(() => !!document.getElementById('artist-sheet'), null, { timeout: 4000 });
    assert.equal(await shelfOf(page), t.artist, 'the tap opened the card’s shelf');
    assert.equal(await levelOf(page, t.artist), before, 'and picked nothing');
    await closeShelf(page);
    // What WebKit sends by itself after a tap: mouse-type events AT the lift point.
    await page.mouse.move(t.x, t.y);
    await sleep(OPEN_MS);
    assert.deepEqual(await zoomState(page), { shown: 0, source: null }, 'the ghost at the lift point grew nothing');
    // A hybrid laptop's trackpad moving the pointer is a hand: it hovers.
    await page.mouse.move(t.x + 20, t.y + 4, { steps: 3 });
    await sleep(OPEN_MS);
    const z = await zoomState(page);
    assert.equal(z.shown, 1, 'a real mouse movement grows the card as it always has');
    assert.equal(z.source, t.artist);
  } finally { await ctx.close(); }
});

test('WebKit: touch taps open the shelf and + steps inside it; nothing grows — not the tapped card, not a card that scrolls under the spot', { skip: skip || (webkit ? false : 'Playwright WebKit is not installed (npx playwright install webkit)') }, async () => {
  const { ctx, page } = await openGallery(webkit, { isMobile: true });
  try {
    const t = await target(page);
    assert.ok(t, 'a card on screen to tap');
    const before = await levelOf(page, t.artist);
    for (let i = 1; i <= 2; i++) {
      await page.touchscreen.tap(t.x, t.y);
      await page.waitForFunction(() => !!document.querySelector('#artist-sheet .sheet-card .f-step.plus'), null, { timeout: 4000 });
      await sleep(400);
      const plus = await page.locator('#artist-sheet .sheet-card .f-step.plus').boundingBox();
      await page.touchscreen.tap(plus.x + plus.width / 2, plus.y + plus.height / 2);
      await sleep(400);
      await closeShelf(page);
      await sleep(OPEN_MS);
      assert.equal(await levelOf(page, t.artist), Math.min(4, before + i), `tap ${i}: + picked on the shelf`);
      assert.deepEqual(await zoomState(page), { shown: 0, source: null }, `tap ${i}: the tapped card stayed resting`);
    }
    // Scroll a different card under the spot the finger lifted from.
    await page.evaluate(() => window.scrollBy(0, 140));
    await sleep(OPEN_MS + 300);
    assert.deepEqual(await zoomState(page), { shown: 0, source: null }, 'no card grew under the still spot');
  } finally { await ctx.close(); }
});
