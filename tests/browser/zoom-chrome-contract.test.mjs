// The zoom clears the chrome, top and bottom (2026-09-24).
//
// Bottom first — Kevin, on a narrow desktop window under a mouse: "can we
// keep this from happening easily — where the cards don't cover the footer?
// nbd, not worth hurting our carefully crafted cards". Under 720px the dock
// is fixed at the bottom and the zoom layer sits over it, so a card grown
// near the bottom (Sara Afshar in the Sunday afters) hung across the day
// tabs. Then the top — Kevin, on v87: the same "for the sticky headers too".
// A card near the top grew over the pinned stage strip at 430, and over the
// day rail and strip on a desktop (the v87 review's finding 1, option b).
// That retires the old law "the top never moves it".
//
// The rule (card-facts.js place()): the dock, while it shows, is a FLOOR; the
// sticky chrome above the card — the desktop day rail and the card's OWN
// timetable's stage strip, pinned or at its natural spot — is a CEILING. A
// zoom that would come within 8px of either is MOVED — never shrunk or
// reshaped — and still grows from its own card's centre (its
// transform-origin, as at the side edges). When it cannot clear both, the
// ceiling wins. Nothing else moves: a zoom clear of the chrome is centred on
// its card as ever, a stack card on a phone has no ceiling at all, and the
// screen's own top and bottom edges move nothing. The jsdom twin (the
// arithmetic, rail + strip, the too-tall case, follow) is
// tests/zoom-geometry.test.mjs.
//
// Every route a zoom still has: a mouse hover — on a plain screen and on a
// touch screen (an iPad with a trackpad: the coarse pointer's CSS, a mouse's
// hand) — and the keyboard (a key, then focus). A finger grows no zoom since
// the tap change (2026-09-26): its tap opens the card's shelf, which rises
// over the dock by design. Chromium always; WebKit for the mouse and the
// keyboard. Runs with `npm run test:browser`, on the real
// index.html on Portola, with a made-up crew and /api answered inside the
// page (nothing leaves it).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FID = 'portola-2026';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveStatic(ROOT);
const browser = await launchBrowser();
let webkit = null;
webkit = await launchWebkit();
test.after(async () => { if (browser) await browser.close(); if (webkit) await webkit.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;
const skipWebkit = webkit ? false : 'Playwright WebKit is not installed (npx playwright install webkit)';

const LOW = 'Sara Afshar'; // Kevin's card: the Sunday afters, the last block on the wall (a stack card)
const MID = 'Zara Larsson';
const GRID = 'Robyn'; // Saturday's grid, under its own stage strip
const CREW = ['Kevin', 'Drew', 'Kat', 'Nhu', 'Pegah'];
const doc = () => ({
  v: 4, meta: { name: 'Chrome', inviteFestId: FID }, spotify: {}, affinity: {},
  people: Object.fromEntries(CREW.map((n, i) => [n, { colorIndex: i }])),
  festivals: { [FID]: { selections: { [LOW]: { Kevin: 2, Drew: 3, Kat: 1 }, [MID]: { Drew: 2 }, [GRID]: { Kevin: 2, Drew: 3, Kat: 1 } } } },
});

async function openWall(engine, { width, height, touch = false }) {
  const ctx = await engine.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
  const TOKEN = 'zoomchromecontract_01234'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Chrome' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
  }, [TOKEN, FID]);
  const body = JSON.stringify(doc());
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  // The chrome as the page draws it, read the test's own way: the lowest
  // bottom edge on screen of the rail and the card's own stage strip (null
  // where there is none), and the dock's top.
  await ctx.addInitScript(() => {
    window.__chrome = (el) => {
      let ceiling = null;
      const block = el.closest('.tt-block');
      for (const n of [document.getElementById('day-rail'), block && block.querySelector(':scope > .stage-strip')]) {
        if (!n || !n.getClientRects().length) continue;
        const r = n.getBoundingClientRect();
        if (r.height > 0 && r.bottom > 0 && r.top < innerHeight && (ceiling === null || r.bottom > ceiling)) ceiling = r.bottom;
      }
      // The floor is the top of the bottom chrome: the dock, or Our plan's
      // peek standing on it (foot.js footTop, 2026-09-26).
      const tops = (document.getElementById('dock').getClientRects().length ? ['dock', 'plan'] : []).map((id) => document.getElementById(id)).filter((n) => n && n.getClientRects().length).map((n) => n.getBoundingClientRect().top).filter((y) => y > 0 && y < innerHeight);
      return { ceiling, floor: tops.length ? Math.min(...tops) : null };
    };
  });
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


// Scroll an artist's card so its TOP sits `dy` px below the ceiling (negative:
// tucked under it), or its BOTTOM `-dy` px above the floor when `from` is 'floor',
// or leave it centred (dy null). Returns a point on its visible part.
const parkCard = (page, artist, dy, from = 'ceiling') => page.evaluate(([a, d, f]) => {
  const at = window.__chrome;
  const el = [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a);
  el.scrollIntoView({ block: 'center' });
  for (let i = 0; d !== null && i < 3; i++) {
    const c = at(el);
    const r = el.getBoundingClientRect();
    if (f === 'ceiling') window.scrollBy(0, r.top - ((c.ceiling ?? 0) + d));
    else window.scrollBy(0, r.bottom - ((c.floor ?? innerHeight) - d));
  }
  const r = el.getBoundingClientRect();
  const c = at(el);
  const top = Math.max(r.top, c.ceiling ?? 0), bottom = Math.min(r.bottom, c.floor ?? innerHeight);
  return { x: r.left + r.width / 2, y: (top + bottom) / 2 };
}, [artist, dy, from]);

// Grow it by one route.
async function grow(ctx, page, at, route, artist) {
  if (route === 'mouse') {
    await page.mouse.move(at.x - 6, at.y + 2, { steps: 2 });
    await page.mouse.move(at.x, at.y, { steps: 2 });
  } else {
    await page.keyboard.press('Escape'); // a key: the next focus is the keyboard's
    await page.evaluate((a) => [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a).focus({ preventScroll: true }), artist);
  }
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(600);
}

// The standing zoom against its card and the chrome.
const measure = (page) => page.evaluate(() => {
  const at = window.__chrome;
  const slot = document.querySelector('#zoom-layer .zoom-slot.shown');
  const r = slot.getBoundingClientRect();
  const el = document.querySelector('#wall-root .card.zoom-source');
  const c = el.getBoundingClientRect();
  const [ox, oy] = slot.style.transformOrigin.split(' ').map(parseFloat);
  return {
    ...at(el),
    top: r.top, bottom: r.bottom, height: r.height,
    cardCentre: { x: c.left + c.width / 2, y: c.top + c.height / 2 },
    // Where the bloom grows from, in page terms: the slot's layout corner plus its origin.
    origin: { x: slot.offsetLeft + ox, y: slot.offsetTop + oy },
    centredTop: Math.round(c.top + c.height / 2 - slot.offsetHeight / 2),
    offsetTop: slot.offsetTop,
  };
});

const fromItsCard = (m, what) => assert.ok(Math.abs(m.origin.x - m.cardCentre.x) < 1 && Math.abs(m.origin.y - m.cardCentre.y) < 1,
  `${what}: it still grows from its card's centre (the bloom's origin): ${JSON.stringify(m)}`);

const ROUTES = [
  [browser, '', 'mouse', skip, false], [browser, 'touch screen, ', 'mouse', skip, true], [browser, '', 'keyboard', skip, false],
  [webkit, 'WebKit ', 'mouse', skipWebkit, false], [webkit, 'WebKit ', 'keyboard', skipWebkit, false],
];

for (const [engine, name, route, skipIt, touch] of ROUTES) {
  test(`${name}${route}, 430×760: a card by the dock moves UP to clear it by 8px, from its own centre`, { skip: skipIt }, async () => {
    const { ctx, page } = await openWall(engine, { width: 430, height: 760, touch });
    try {
      await grow(ctx, page, await parkCard(page, LOW, 6, 'floor'), route, LOW);
      const m = await measure(page);
      assert.ok(m.floor !== null && m.floor < 760, `the dock is showing at the bottom: ${JSON.stringify(m)}`);
      assert.ok(m.centredTop + m.height > m.floor - 8, `not vacuous: centred on its card, this zoom would reach the dock: ${JSON.stringify(m)}`);
      assert.ok(m.bottom <= m.floor - 8 + 0.5 && m.floor - 8 - m.bottom < 1.5, `its bottom clears the dock's top by 8px, exactly: ${JSON.stringify(m)}`);
      fromItsCard(m, 'by the dock');
    } finally {
      await ctx.close();
    }
  });

  for (const [width, height, chrome] of [[430, 760, 'its pinned stage strip'], [1280, 800, 'the day rail and its stage strip']]) {
    test(`${name}${route}, ${width}×${height}: a grid card tucked under ${chrome} grows DOWN to clear it by 8px, from its own centre`, { skip: skipIt }, async () => {
      const { ctx, page } = await openWall(engine, { width, height, touch });
      try {
        await grow(ctx, page, await parkCard(page, GRID, -12), route, GRID);
        const m = await measure(page);
        assert.ok(m.ceiling !== null && m.ceiling > 20, `there is sticky chrome above it: ${JSON.stringify(m)}`);
        assert.ok(m.centredTop < m.ceiling + 8, `not vacuous: centred on its card, this zoom would reach under the chrome: ${JSON.stringify(m)}`);
        assert.ok(m.top >= m.ceiling + 8 - 0.5 && m.top - (m.ceiling + 8) < 1.5, `its top clears the chrome by 8px, exactly: ${JSON.stringify(m)}`);
        fromItsCard(m, `under ${chrome}`);
      } finally {
        await ctx.close();
      }
    });
  }
}

test('no ceiling is invented: a stack card near the top of a phone grows where it lives; on a desktop the rail is its ceiling', { skip }, async () => {
  let { ctx, page } = await openWall(browser, { width: 430, height: 760 });
  try {
    await grow(ctx, page, await parkCard(page, LOW, 4), 'mouse', LOW);
    const m = await measure(page);
    assert.equal(m.ceiling, null, `a stack on a phone has no sticky chrome above it: ${JSON.stringify(m)}`);
    assert.equal(m.offsetTop, m.centredTop, `so it is centred on its card, even past the screen's top: ${JSON.stringify(m)}`);
  } finally {
    await ctx.close();
  }
  ({ ctx, page } = await openWall(browser, { width: 1280, height: 800 }));
  try {
    await grow(ctx, page, await parkCard(page, LOW, -10), 'mouse', LOW);
    const m = await measure(page);
    const rail = await page.evaluate(() => document.getElementById('day-rail').getBoundingClientRect().bottom);
    assert.ok(Math.abs(m.ceiling - rail) < 0.5, `the rail is the only chrome above a stack card: ${JSON.stringify(m)}`);
    assert.ok(m.top >= rail + 8 - 0.5 && m.top - (rail + 8) < 1.5, `and it clears the rail by 8px: ${JSON.stringify(m)}`);
    fromItsCard(m, 'a stack card under the rail');
  } finally {
    await ctx.close();
  }
});

test('nothing else moves: clear of the chrome a zoom is centred on its card, and above 720 (no dock) the bottom does not move it', { skip }, async () => {
  let { ctx, page } = await openWall(browser, { width: 430, height: 760 });
  try {
    await grow(ctx, page, await parkCard(page, MID, null), 'mouse', MID);
    const m = await measure(page);
    assert.equal(m.offsetTop, m.centredTop, `mid-screen with the dock and a strip showing: centred on its card, as ever: ${JSON.stringify(m)}`);
  } finally {
    await ctx.close();
  }
  ({ ctx, page } = await openWall(browser, { width: 800, height: 760 }));
  try {
    await grow(ctx, page, await parkCard(page, LOW, 6, 'floor'), 'mouse', LOW);
    const m = await measure(page);
    assert.equal(m.floor, null, 'above 720 there is no dock');
    assert.equal(m.offsetTop, m.centredTop, `so a card by the screen's bottom grows where it is, centred, as before: ${JSON.stringify(m)}`);
  } finally {
    await ctx.close();
  }
});

// (b) A zoom kept open while the wall scrolls under a pinned strip: it follows
// its card, then stands clamped under the strip — every frame on the same
// pixel, no jitter, never flipping back — and closes once its card has gone
// entirely under the strip.
test('a zoom kept open while the wall scrolls: it glides to the strip, holds still there, and closes when its card has gone under it', { skip }, async () => {
  const { ctx, page } = await openWall(browser, { width: 430, height: 760 });
  try {
    const at = await parkCard(page, GRID, 70);
    await grow(ctx, page, { x: at.x, y: at.y + 20 }, 'mouse', GRID);
    await page.evaluate(() => {
      const c = window.__chrome;
      const el = document.querySelector('#wall-root .card.zoom-source');
      window.__frames = [];
      const tick = () => {
        const s = document.querySelector('#zoom-layer .zoom-slot.shown');
        const r = el.getBoundingClientRect();
        window.__frames.push({ open: !!s, top: s ? s.getBoundingClientRect().top : null, cardBottom: r.bottom, ceiling: c(el).ceiling });
        if (window.__frames.length < 600 && s) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 8); await sleep(40); }
    await sleep(300);
    const f = await page.evaluate(() => window.__frames);
    const open = f.filter((x) => x.open);
    const tops = open.map((x) => Math.round(x.top));
    for (let i = 1; i < tops.length; i++) assert.ok(tops[i] <= tops[i - 1], `the zoom only ever moves up as the wall scrolls up — no jitter, no jump back: ${tops.join(',')}`);
    const clamped = open.filter((x) => Math.round(x.top) === Math.round(x.ceiling + 8));
    assert.ok(clamped.length >= 3, `it stood clamped 8px under the strip for a while: ${tops.join(',')}`);
    assert.equal(f[f.length - 1].open, false, 'and it closed');
    const last = open[open.length - 1];
    assert.ok(last.cardBottom > last.ceiling - 12, `it closed once its card went under the strip, not long after: ${JSON.stringify(last)}`);
  } finally {
    await ctx.close();
  }
});
