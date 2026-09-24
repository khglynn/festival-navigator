// The zoom clears the phone dock (2026-09-24). Kevin, on a narrow desktop
// window under a mouse: "can we keep this from happening easily — where the
// cards don't cover the footer? nbd, not worth hurting our carefully crafted
// cards". Under 720px the dock is fixed at the bottom, and the zoom layer
// sits over it, so a card grown near the bottom (Sara Afshar in the Sunday
// afters) hung across the day tabs.
//
// The rule (card-facts.js place()): the dock, while it shows, is a floor. A
// zoom that would come within 8px of it is MOVED up — never shrunk or
// reshaped — and still grows out of its own card (its transform-origin is the
// card's centre, as at the side edges). Nothing else moves: a zoom clear of
// the dock is centred on its card as ever, and above 720px, with no dock, the
// bottom of the screen still does not move it. The jsdom twin (arithmetic,
// the too-tall case, a hidden dock) is in tests/zoom-geometry.test.mjs.
//
// Runs with `npm run test:browser`, on the real index.html on Portola, with a
// made-up crew and /api answered inside the page (nothing leaves it).
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
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

const LOW = 'Sara Afshar'; // Kevin's card: the Sunday afters, the last block on the wall
const MID = 'Zara Larsson';
const CREW = ['Kevin', 'Drew', 'Kat', 'Nhu', 'Pegah'];
const doc = () => ({
  v: 4, meta: { name: 'Dock', inviteFestId: FID }, spotify: {}, affinity: {},
  people: Object.fromEntries(CREW.map((n, i) => [n, { colorIndex: i }])),
  festivals: { [FID]: { selections: { [LOW]: { Kevin: 2, Drew: 3, Kat: 1 }, [MID]: { Drew: 2 } } } },
});

async function openWall({ width, height, touch = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
  const TOKEN = 'zoomdockcontract_0123456'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Dock' }]));
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
  await page.clock.setFixedTime(new Date('2026-09-23T19:00:00-07:00'));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(250);
  return { ctx, page };
}

// Scroll an artist's card so its bottom sits `gap`px above the floor (the
// dock's top, or the screen's bottom where there is no dock); its centre.
const parkCard = (page, artist, gap) => page.evaluate(([a, g]) => {
  const el = [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a);
  const dock = document.getElementById('dock');
  const floor = dock && dock.getClientRects().length ? dock.getBoundingClientRect().top : innerHeight;
  el.scrollIntoView({ block: 'center' });
  if (g !== null) window.scrollBy(0, el.getBoundingClientRect().bottom - (floor - g));
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, [artist, gap]);

// Grow it: a mouse hover (Kevin's case), or a real touch hold.
async function grow(ctx, page, at, touch) {
  await sleep(200);
  if (touch) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
    await sleep(650);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(at.x - 6, at.y, { steps: 2 });
    await page.mouse.move(at.x, at.y, { steps: 2 });
  }
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(600);
}

// The standing zoom against its card and the dock.
const measure = (page) => page.evaluate(() => {
  const slot = document.querySelector('#zoom-layer .zoom-slot.shown');
  const r = slot.getBoundingClientRect();
  const c = document.querySelector('#wall-root .card.zoom-source').getBoundingClientRect();
  const dock = document.getElementById('dock');
  const [ox, oy] = slot.style.transformOrigin.split(' ').map(parseFloat);
  return {
    top: r.top, bottom: r.bottom, height: r.height, width: r.width,
    dockTop: dock && dock.getClientRects().length ? dock.getBoundingClientRect().top : null,
    cardCentre: { x: c.left + c.width / 2, y: c.top + c.height / 2 },
    // Where the bloom grows from, in page terms: the slot's layout corner plus its origin.
    origin: { x: slot.offsetLeft + ox, y: slot.offsetTop + oy },
    centredTop: Math.round(c.top + c.height / 2 - slot.offsetHeight / 2),
    offsetTop: slot.offsetTop,
  };
});

for (const touch of [false, true]) {
  test(`at 430×760 a card by the dock grows UP to clear it by 8px, from its own centre (${touch ? 'a touch hold' : 'a mouse hover'})`, { skip }, async () => {
    const { ctx, page } = await openWall({ width: 430, height: 760, touch });
    try {
      const at = await parkCard(page, LOW, 6);
      await grow(ctx, page, at, touch);
      const m = await measure(page);
      assert.ok(m.dockTop !== null && m.dockTop < 760, `the dock is showing at the bottom: ${JSON.stringify(m)}`);
      assert.ok(m.centredTop + m.height > m.dockTop - 8, `not vacuous: centred on its card, this zoom would reach the dock: ${JSON.stringify(m)}`);
      assert.ok(m.bottom <= m.dockTop - 8 + 0.5, `its bottom clears the dock's top by 8px: ${JSON.stringify(m)}`);
      assert.ok(m.dockTop - 8 - m.bottom < 1.5, `moved up exactly that far, no further: ${JSON.stringify(m)}`);
      assert.ok(Math.abs(m.origin.x - m.cardCentre.x) < 1 && Math.abs(m.origin.y - m.cardCentre.y) < 1,
        `and it still grows from its card's centre (the bloom's origin): ${JSON.stringify(m)}`);
    } finally {
      await ctx.close();
    }
  });
}

test('nothing else moves: clear of the dock a zoom is centred on its card, and above 720 (no dock) the bottom does not move it', { skip }, async () => {
  let { ctx, page } = await openWall({ width: 430, height: 760 });
  try {
    await grow(ctx, page, await parkCard(page, MID, null), false);
    const m = await measure(page);
    assert.equal(m.offsetTop, m.centredTop, `mid-screen with the dock showing: centred on its card, as ever: ${JSON.stringify(m)}`);
  } finally {
    await ctx.close();
  }
  ({ ctx, page } = await openWall({ width: 800, height: 760 }));
  try {
    await grow(ctx, page, await parkCard(page, LOW, 6), false);
    const m = await measure(page);
    assert.equal(m.dockTop, null, 'above 720 there is no dock');
    assert.equal(m.offsetTop, m.centredTop, `so a card by the screen's bottom grows where it is, centred, as before: ${JSON.stringify(m)}`);
  } finally {
    await ctx.close();
  }
});
