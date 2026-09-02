// The hover contract, in a real browser, with real input.
//
// Every jsdom test in this suite dispatches events by hand; none of them can
// see what a browser does on its own — the boundary events it fires when an
// overlay appears under a still pointer, the blur it fires from inside a node
// removal, the focus heuristics it applies after a keypress. Those are where
// the zoom broke, repeatedly, between 2026-08-29 and 2026-09-01, while the
// suite stayed green: "it worked, then it broke, then it worked" is what a
// contract nobody runs looks like. This file is that contract. It drives
// Playwright's input layer (CDP mouse and keyboard — never element.click())
// against gallery.html, which renders the production modules with no network,
// and asserts the outcomes a person sees.
//
// It runs with `npm run test:browser` (CI installs Chromium for it); it is not
// in `npm test`, which stays offline and fast. Locally it needs a browser:
// Playwright's bundled Chromium, or Chrome (channel) as a fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REQUIRED = !!process.env.BROWSER_TEST_REQUIRED; // CI: a missing browser is a failure, not a skip
const OPEN_MS = 650;   // ZOOM_IN_MS (200) + the bloom, with slack
const CLOSE_MS = 650;  // ZOOM_OUT_MS (260) + the way out, with slack
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const { chromium } = await import('playwright');
  try { return await chromium.launch({ headless: true }); } catch (e) {
    try { return await chromium.launch({ channel: 'chrome', headless: true }); } catch (e2) {
      if (REQUIRED) throw e;
      return null;
    }
  }
}

const server = await serveStatic(ROOT);
const browser = await launch();
test.after(async () => { if (browser) await browser.close(); await server.close(); });

const skip = browser ? false : 'no browser available (npx playwright install chromium, or install Chrome)';

// One page per test file: the gallery renders the same states every load.
let page;
test.before(async () => {
  if (!browser) return;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(`${server.origin}/gallery.html`, { waitUntil: 'load' });
  await page.waitForSelector('#zoom-row-ladder .card', { state: 'visible', timeout: 15000 });
  await page.evaluate(() => document.getElementById('zoom-row-ladder').scrollIntoView({ block: 'start' }));
  await sleep(300);
});

const state = () => page.evaluate(() => {
  const card = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
  return {
    shown: document.querySelectorAll('#zoom-layer .zoom-slot.shown').length,
    zoom: card ? card.getAttribute('aria-label') : null,
    you: !!document.querySelector('#zoom-layer .zoom-card .f-pill.you'),
    active: (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.artist) || null,
  };
});
// Visible resting cards in the ladder row, centre points in viewport coordinates.
const cards = () => page.evaluate(() => [...document.querySelectorAll('#zoom-row-ladder .card, #zoom-row-cells .card, #zoom-row-names .card')]
  .map((el) => { const r = el.getBoundingClientRect(); return { artist: el.dataset.artist, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), top: r.top, bottom: r.bottom }; })
  .filter((c) => c.top > 60 && c.bottom < innerHeight - 40));
// A point with nothing under it that a hover could grow: the row caption area
// is text; the page background left of the ladder is empty.
const empty = () => page.evaluate(() => {
  for (let y = 80; y < innerHeight - 40; y += 20) for (let x = 12; x < innerWidth - 12; x += 20) {
    const el = document.elementFromPoint(x, y);
    if (!el || el.closest('.card, #zoom-layer, button, a, input, label')) continue;
    const near = [...document.querySelectorAll('.card')].some((c) => { const r = c.getBoundingClientRect(); return x > r.left - 48 && x < r.right + 48 && y > r.top - 48 && y < r.bottom + 48; });
    if (!near) return { x, y };
  }
  return null;
});
const move = (x, y) => page.mouse.move(x, y, { steps: 8 });

test('hover with intent grows the card; leaving it closes the zoom', { skip }, async () => {
  const [c] = await cards();
  const sp = await empty();
  assert.ok(c && sp, 'a card and an empty spot are on screen');
  await move(sp.x, sp.y); await sleep(200);
  await move(c.x, c.y); await sleep(OPEN_MS);
  let s = await state();
  assert.equal(s.shown, 1, `grown after the dwell: ${JSON.stringify(s)}`);
  assert.ok(s.zoom && s.zoom.startsWith(c.artist), `the grown card is the hovered one: ${s.zoom}`);
  await move(sp.x, sp.y); await sleep(CLOSE_MS);
  s = await state();
  assert.equal(s.shown, 0, `closed after leaving: ${JSON.stringify(s)}`);
});

test('a fast click on a resting card picks it, the hover then grows it, and leaving still closes it', { skip }, async () => {
  const list = await cards();
  const c = list[1];
  const sp = await empty();
  await page.mouse.move(c.x, c.y, { steps: 2 });
  await page.mouse.click(c.x, c.y);
  await sleep(OPEN_MS + 200);
  let s = await state();
  assert.equal(s.shown, 1, `the zoom stands after a click on the resting card: ${JSON.stringify(s)}`);
  assert.equal(s.you, true, 'and the pick landed (the You pill)');
  await move(sp.x, sp.y); await sleep(CLOSE_MS);
  s = await state();
  assert.equal(s.shown, 0, `a zoom born after a click still closes on hover-out (it is a MOUSE zoom, not a keyboard one): ${JSON.stringify(s)}`);
});

test('a pick on the grown card keeps the zoom standing, and leaving closes it', { skip }, async () => {
  const list = await cards();
  const c = list[2];
  const sp = await empty();
  await move(c.x, c.y); await sleep(OPEN_MS);
  await page.mouse.click(c.x, c.y); await sleep(500);
  let s = await state();
  assert.equal(s.shown, 1, `still standing after the pick: ${JSON.stringify(s)}`);
  assert.equal(s.you, true, 'the You pill arrived');
  await move(sp.x, sp.y); await sleep(CLOSE_MS);
  s = await state();
  assert.equal(s.shown, 0, `closed after leaving: ${JSON.stringify(s)}`);
});

test("click, Escape, click again on one card: a keypress never turns the next pick into a zoom that ignores the mouse", { skip }, async () => {
  // Chrome flips a focused card to :focus-visible after any key; the module
  // must not read the script focus of the next pick as keyboard intent.
  const list = await cards();
  const c = list[3];
  const sp = await empty();
  await page.mouse.move(c.x, c.y, { steps: 2 });
  await page.mouse.click(c.x, c.y);            // focuses + picks
  await sleep(OPEN_MS);
  await page.keyboard.press('Escape');          // puts the zoom away; the card stays focused
  await sleep(200);
  let s = await state();
  assert.equal(s.shown, 0, `Escape closed it: ${JSON.stringify(s)}`);
  await page.mouse.click(c.x, c.y);            // picks again on the resting card
  await sleep(OPEN_MS + 200);
  s = await state();
  // Whatever stands now must be a mouse zoom: it closes on hover-out.
  await move(sp.x, sp.y); await sleep(CLOSE_MS);
  s = await state();
  assert.equal(s.shown, 0, `no zoom survives the mouse leaving: ${JSON.stringify(s)}`);
});

test('Escape puts a hovered zoom away and the mark clears on leave: coming back regrows it', { skip }, async () => {
  const list = await cards();
  const c = list[4];
  const sp = await empty();
  await move(c.x, c.y); await sleep(OPEN_MS);
  await page.keyboard.press('Escape'); await sleep(300);
  let s = await state();
  assert.equal(s.shown, 0, 'Escape closed it');
  await sleep(OPEN_MS);
  s = await state();
  assert.equal(s.shown, 0, 'and a hand that never left cannot regrow it');
  await move(sp.x, sp.y); await sleep(200);
  await move(c.x, c.y); await sleep(OPEN_MS);
  s = await state();
  assert.equal(s.shown, 1, `leave and return regrows: ${JSON.stringify(s)}`);
  await move(sp.x, sp.y); await sleep(CLOSE_MS);
});

test('a mouse button held on a resting card is a slow click, never a touch-style zoom that ignores the mouse', { skip }, async () => {
  const list = await cards();
  const c = list[5];
  const sp = await empty();
  await page.mouse.move(c.x, c.y, { steps: 2 });
  await page.mouse.down(); await sleep(700); await page.mouse.up();
  await sleep(300);
  await move(sp.x, sp.y); await sleep(CLOSE_MS);
  const s = await state();
  assert.equal(s.shown, 0, `whatever the hold grew, the mouse leaving closes it: ${JSON.stringify(s)}`);
});

test('Tab grows the focused card, Tab again reaches its notes chip, Escape closes it', { skip }, async () => {
  const list = await cards();
  const prev = list[2], c = list[3]; // consecutive cards in the ladder row: Tab from one lands on the next
  const sp = await empty();
  await move(sp.x, sp.y);
  await page.mouse.click(sp.x, sp.y);           // the last input is a press…
  await page.evaluate((artist) => document.querySelector(`.card[data-artist="${CSS.escape(artist)}"]`).focus(), prev.artist);
  await sleep(OPEN_MS);
  let s = await state();
  assert.equal(s.shown, 0, `…so a script focus grows nothing: ${JSON.stringify(s)}`);
  await page.keyboard.press('Tab');             // a real Tab moves to the next card
  await sleep(OPEN_MS);
  s = await state();
  assert.equal(s.active, c.artist, `Tab reached the next card: ${JSON.stringify(s)}`);
  assert.equal(s.shown, 1, 'and the keyboard route grew it');
  await page.keyboard.press('Tab'); await sleep(150);
  const onChip = await page.evaluate(() => !!document.activeElement.closest('#zoom-layer') && document.activeElement.classList.contains('notes'));
  assert.equal(onChip, true, 'Tab from the grown card reaches its notes chip');
  await page.keyboard.press('Escape'); await sleep(300);
  s = await state();
  assert.equal(s.shown, 0, 'Escape closed the keyboard zoom');
  await page.mouse.click(sp.x, sp.y);
});

test('a random real-input walk: every dwell grows the right card, every leave closes it', { skip }, async () => {
  const list = await cards();
  const sp = await empty();
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const bad = [];
  for (let i = 0; i < 14; i++) {
    const c = list[Math.floor(rnd() * list.length)];
    await move(c.x, c.y); await sleep(OPEN_MS);
    let s = await state();
    if (!(s.shown === 1 && s.zoom && s.zoom.startsWith(c.artist))) bad.push(`open ${c.artist}: ${JSON.stringify(s)}`);
    const r = rnd();
    if (r < 0.4) { await page.mouse.click(c.x, c.y); await sleep(350); }
    else if (r < 0.5) { await page.keyboard.press('Escape'); await sleep(150); }
    await move(sp.x, sp.y); await sleep(CLOSE_MS);
    s = await state();
    if (s.shown !== 0) bad.push(`close ${c.artist}: ${JSON.stringify(s)}`);
  }
  assert.deepEqual(bad, [], 'every step of the walk held');
});
