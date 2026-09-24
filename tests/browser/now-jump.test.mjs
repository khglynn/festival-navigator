// NOW, in a real browser with a pinned clock (2026-09-24). Kevin: "where is
// ross likely right now … tapping ross on the top to highlight him and then
// clicking something in the scroll-to-time bar", and then: "the line and
// highlight combo" — the answer is the now line and Ross's highlighted card
// seen TOGETHER.
//
// Saturday 10:30 PM PDT at Portola: Soulwax and Prospa are on the grid, and
// across town the afters have opened (Milli Meng at Public Works, Galen at the
// Great Northern). Ross is at the afters; Nhu is at Pier 80 for Soulwax. The
// app is booted for real against a made-up crew; /api never leaves the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const browser = await launchBrowser();
// NOW is for a phone in a field, so the landings run in WebKit too (the
// iPhone's engine: no scrollend, its own smooth scroll) where it is installed.
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: those cases skip */ }
test.after(async () => { if (browser) await browser.close(); if (webkit) await webkit.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;
const skipWebkit = webkit ? false : 'Playwright WebKit is not installed (npx playwright install webkit)';

const SAT_1030 = new Date('2026-09-26T22:30:00-07:00');
const SAT_9AM = new Date('2026-09-26T09:00:00-07:00');
// Kat is only at the Warehouse (Prospa): the third column, off a phone's
// screen until the grid scrolls to it.
const SELECTIONS = { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Prospa: { Nhu: 2, Kat: 3 } };

async function openApp({ width = 390, height = 844, touch = true, now = SAT_1030, fest = 'portola-2026', engine = browser } = {}) {
  const ctx = await engine.newContext({ viewport: { width, height }, hasTouch: touch, serviceWorkers: 'block' });
  const TOKEN = 'nowjumpcontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Now' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    // NOW's pulse, told apart from every other animation a card runs (a
    // picked card's aura, an arrival): a running scale on the card itself.
    window.__pulsing = (c) => c.getAnimations().some((a) => a.playState === 'running' && a.effect
      && a.effect.target === c && a.effect.getKeyframes().some((k) => /scale\(/.test(k.transform || '')));
  }, [TOKEN, fest]);
  const doc = {
    v: 4, meta: { name: 'Now', inviteFestId: fest }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 }, Kat: { colorIndex: 6 } },
    festivals: { [fest]: { selections: fest === 'portola-2026' ? SELECTIONS : {} } },
  };
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.setFixedTime(now);
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await sleep(600); // the day-of open's own landing
  return { ctx, page, door: width >= 720 ? 'rail' : 'dock' };
}

// Where things are now, against the part of the window a person can see:
// under the sticky chrome (and a grid's pinned stage strip), above the dock.
// `where` narrows the card — 'cell' for the grid's, else a room's name —
// because an artist can play twice (Soulwax is Thursday's afters AND
// Saturday's grid).
const view = (page, artist, where = null) => page.evaluate(([a, w]) => {
  const dock = document.getElementById('dock');
  const dockTop = dock && getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect().top : innerHeight;
  const rail = document.getElementById('day-rail');
  const railBottom = rail && getComputedStyle(rail).display !== 'none' ? rail.getBoundingClientRect().bottom : 0;
  const line = document.querySelector('#wall-root .now-line');
  const lr = line ? line.getBoundingClientRect() : null;
  const block = line ? line.closest('.tt-block') : null;
  const strip = block ? block.querySelector('.stage-strip').getBoundingClientRect() : null;
  const card = a ? [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a && !c.classList.contains('dim')
    && (!w || (w === 'cell' ? c.classList.contains('cell') : c.closest('.room').dataset.room === w))) : null;
  const cr = card ? card.getBoundingClientRect() : null;
  return {
    dockTop, railBottom, innerWidth,
    line: lr && { top: lr.top, left: lr.left, right: lr.right }, stripBottom: strip ? strip.bottom : null,
    card: cr && { top: cr.top, bottom: cr.bottom, left: cr.left, right: cr.right, cell: card.classList.contains('cell'), room: card.closest('.room').dataset.room },
  };
}, [artist, where]);

// The landing is a smooth scroll (the page, and a grid sideways): wait for it
// to come to rest rather than for a fixed time — under a loaded CI box a
// glide can outlast any sleep (a 1.1 s sleep flaked once in the full suite).
const settled = (page) => page.evaluate(() => new Promise((resolve) => {
  const where = () => scrollY + [...document.querySelectorAll('.times-scroll')].reduce((s, e) => s + e.scrollLeft * 1e-3, 0);
  let last = NaN, still = 0;
  const t0 = performance.now();
  const step = () => {
    const w = where();
    still = w === last ? still + 1 : 0;
    last = w;
    if (still >= 12 || performance.now() - t0 > 6000) resolve();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}));
const tapNow = async (page, door) => {
  await page.locator(`#${door}-now`).click();
  await sleep(150); // the glide starts
  await settled(page);
};
const highlight = async (page, name) => {
  await page.locator('#person-chips .person-chip', { hasText: name }).first().click();
  await sleep(400);
};

for (const [width, height, touch, engine, name] of [[390, 844, true, browser, ''], [1280, 800, false, browser, ''], [390, 844, true, webkit, 'WebKit ']]) {
  const skip = engine === webkit ? skipWebkit : browser ? false : NO_BROWSER;
  test(`${name}${width}: NOW sits before the days, is not a day, and a tap lands the now line in view`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch, engine });
    try {
      const tab = await page.evaluate((d) => {
        const now = document.getElementById(`${d}-now`);
        const days = document.getElementById(`${d}-days`);
        const r = now.getBoundingClientRect();
        return {
          shown: !now.hidden && r.width > 0, text: now.textContent.trim(), left: r.right <= days.getBoundingClientRect().left + 1,
          day: now.dataset.day || null, color: getComputedStyle(now).color, dot: !!now.querySelector('.live'),
        };
      }, door);
      assert.ok(tab.shown, 'something is live, so NOW is there');
      assert.equal(tab.text, 'NOW');
      assert.ok(tab.left, 'to the left of the days');
      assert.equal(tab.day, null, 'not a day: the scrollspy never lights it');
      assert.ok(tab.dot, 'with its live dot');
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      await tapNow(page, door);
      const v = await view(page, null);
      assert.ok(v.line, 'the line is on the wall');
      assert.ok(v.line.top > v.stripBottom && v.line.top < v.dockTop, `the line is in view: ${JSON.stringify(v)}`);
      assert.equal(await page.evaluate((d) => document.getElementById(`${d}-now`).classList.contains('active'), door), false);
    } finally { await ctx.close(); }
  });

  test(`${name}${width}: Ross highlighted — NOW lands on his live pick in SAT AFTERS`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch, engine });
    try {
      await highlight(page, 'Ross');
      await tapNow(page, door);
      const v = await view(page, 'Milli Meng', 'Afters');
      assert.ok(v.card, 'his card is on the wall, undimmed');
      assert.equal(v.card.room, 'Afters');
      const top = Math.max(v.railBottom, 0);
      assert.ok(v.card.top >= top && v.card.bottom <= v.dockTop, `his card sits in view below the chrome: ${JSON.stringify(v)}`);
      // Tap again, already there: nothing moves, and the card pulses at once.
      // With a mouse, the first click was made while the rail still sat below
      // the header; the jump stuck the rail to the top and left the pointer
      // over the wall, where hover grows whatever card is under it — and a
      // zoom blooms OVER the rail by design (z 36 > 25), covering NOW. A hand
      // moves off it first (Playwright would otherwise scroll to dodge it).
      await page.mouse.move(8, 8);
      await sleep(1000); // the zoom's grace close, and the first landing's pulse, are over
      const y = await page.evaluate(() => scrollY);
      await page.locator(`#${door}-now`).click();
      await sleep(80);
      const again = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#wall-root .room[data-room="Afters"] .card')].find((x) => x.dataset.artist === 'Milli Meng');
        return { y: scrollY, pulsing: window.__pulsing(c) };
      });
      assert.ok(Math.abs(again.y - y) < 1, `a second tap does not move the page: ${y} -> ${again.y}`);
      assert.ok(again.pulsing, 'and the card pulses straight away — the pulse is the whole answer');
    } finally { await ctx.close(); }
  });

  test(`${name}${width}: Nhu highlighted — her live pick on the grid and the now line are in view together`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch, engine });
    try {
      await highlight(page, 'Nhu');
      await tapNow(page, door);
      const v = await view(page, 'Soulwax', 'cell');
      assert.ok(v.card && v.card.cell, 'Soulwax, on the grid');
      assert.ok(v.line.top > v.stripBottom && v.line.top < v.dockTop, `the line is in view: ${JSON.stringify(v)}`);
      assert.ok(v.card.top >= v.stripBottom - 1 && v.card.top < v.dockTop, `the card's top is in view: ${JSON.stringify(v)}`);
      assert.ok(v.card.top <= v.line.top && v.card.bottom >= v.line.top, 'and it crosses the line — it is playing now');
      assert.ok(v.card.left >= 0 && v.card.right <= v.innerWidth, `and across, its column is on screen: ${JSON.stringify(v)}`);
      assert.ok(v.line.left <= v.card.left + 1 && v.line.right >= v.card.right - 1, `and the line runs right across the card: ${JSON.stringify(v)}`);
    } finally { await ctx.close(); }
  });
}

// The line runs under EVERY column (Kevin's local demo, 2026-09-24: at 430
// the line stopped partway across the grid, and scrolled to Warehouse / Ship
// Tent there was none). It was `left:0; right:0` on a grid whose BOX was only
// the scroller's width while its tracks overflowed it — so it spanned the
// view at scroll 0, not the columns.
const lineVsColumns = (page) => page.evaluate(() => {
  const line = document.querySelector('#wall-root .now-line');
  const grid = line.closest('.times-grid');
  const scroller = grid.closest('.times-scroll');
  const cells = [...grid.querySelectorAll('.card.cell')];
  const col = (c) => Number(c.style.gridColumn) || 0;
  const lastCol = Math.max(...cells.map(col));
  const last = cells.find((c) => col(c) === lastCol).getBoundingClientRect();
  const l = line.getBoundingClientRect(), s = scroller.getBoundingClientRect();
  return { lastCol, line: [l.left, l.right], last: [last.left, last.right], seen: [s.left, s.right], scrollLeft: scroller.scrollLeft, max: scroller.scrollWidth - scroller.clientWidth };
});
for (const [width, height] of [[390, 844], [430, 932]]) {
  test(`${width}: the grid scrolled to its right end — the now line still crosses the last column`, { skip }, async () => {
    const { ctx, page } = await openApp({ width, height });
    try {
      await page.evaluate(() => {
        const s = document.querySelector('#wall-root .now-line').closest('.times-scroll');
        s.scrollLeft = s.scrollWidth;
      });
      await sleep(250);
      const r = await lineVsColumns(page);
      assert.ok(r.max > 0 && Math.abs(r.scrollLeft - r.max) < 2, `the grid really is at its right end: ${JSON.stringify(r)}`);
      assert.ok(r.line[0] <= r.last[0] + 1 && r.line[1] >= r.last[1] - 1, `the line crosses the last column (${r.lastCol}): ${JSON.stringify(r)}`);
      assert.ok(r.line[0] <= r.seen[0] + 1 && r.line[1] >= r.seen[1] - 1, `and runs the whole visible width: ${JSON.stringify(r)}`);
    } finally { await ctx.close(); }
  });
}

test('390: Kat highlighted — NOW scrolls to her pick in the third column, and the line crosses it there', { skip }, async () => {
  const { ctx, page, door } = await openApp();
  try {
    await highlight(page, 'Kat');
    await tapNow(page, door);
    const v = await view(page, 'Prospa', 'cell');
    assert.ok(v.card && v.card.cell, 'Prospa, on the grid');
    assert.ok(v.card.left >= 0 && v.card.right <= v.innerWidth, `the grid scrolled her column on screen: ${JSON.stringify(v)}`);
    assert.ok(v.card.top <= v.line.top && v.card.bottom >= v.line.top, 'the card crosses the line — it is playing now');
    assert.ok(v.line.left <= v.card.left + 1 && v.line.right >= v.card.right - 1, `and the line runs right across it: ${JSON.stringify(v)}`);
  } finally { await ctx.close(); }
});

// Honest with a highlight (review, 2026-09-24): Kat's only pick (Prospa) is
// long over at 11:45 PM. NOW lands where it would for nobody — the first
// NOW card — pulses nothing, and says so in one quiet line on the app's
// toast. The same for you: "Nothing of yours".
for (const [who, says] of [['Kat', 'Nothing of Kat’s is on right now — here’s what is.'], ['Kevin', 'Nothing of yours is on right now — here’s what is.']]) {
  test(`${who} highlighted, nothing of theirs on (Sat 11:45 PM): no pulse, the quiet line, the landing anyone would get`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ now: new Date('2026-09-26T23:45:00-07:00') });
    try {
      await highlight(page, who);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(150);
      await page.locator(`#${door}-now`).click();
      await sleep(150);
      await settled(page);
      await sleep(900); // past the 750 ms pulse fallback
      const r = await page.evaluate(() => {
        const first = document.querySelector('#wall-root .venue-grid[data-iso] .card.now');
        const b = first.getBoundingClientRect();
        return {
          toast: (document.querySelector('#toast-root') || {}).textContent || '',
          pulsing: [...document.querySelectorAll('#wall-root .card')].filter((c) => window.__pulsing(c)).map((c) => c.dataset.artist),
          first: first.dataset.artist, top: b.top, bottom: b.bottom, dockTop: document.getElementById('dock').getBoundingClientRect().top,
        };
      });
      assert.equal(r.toast.trim(), says);
      assert.deepEqual(r.pulsing, [], 'nothing pulses — no stranger’s card passes for theirs');
      assert.ok(r.top >= 0 && r.bottom <= r.dockTop, `it lands on what IS on, the first NOW card (${r.first}): ${JSON.stringify(r)}`);
    } finally { await ctx.close(); }
  });
}

test('Reduce Motion: NOW lands at once and nothing pulses; the live dot is still', { skip }, async () => {
  const { ctx, page, door } = await openApp();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await highlight(page, 'Ross');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(100);
    await page.locator(`#${door}-now`).click();
    await sleep(60);
    const r = await page.evaluate((d) => {
      const c = [...document.querySelectorAll('#wall-root .room[data-room="Afters"] .card')].find((x) => x.dataset.artist === 'Milli Meng');
      const b = c.getBoundingClientRect();
      const dot = getComputedStyle(document.querySelector(`#${d}-now .live`));
      return { y: scrollY, top: b.top, bottom: b.bottom, dockTop: document.getElementById('dock').getBoundingClientRect().top,
        pulsing: window.__pulsing(c), dotAnimation: dot.animationName };
    }, door);
    assert.ok(r.y > 0 && r.top >= 0 && r.bottom <= r.dockTop, `landed already, no glide: ${JSON.stringify(r)}`);
    assert.equal(r.pulsing, false, 'no pulse');
    assert.equal(r.dotAnimation, 'none', 'the dot does not breathe');
  } finally { await ctx.close(); }
});

test('outside the live window there is no NOW (Saturday 9 AM)', { skip }, async () => {
  const { ctx, page, door } = await openApp({ now: SAT_9AM });
  try {
    const shown = await page.evaluate((d) => { const n = document.getElementById(`${d}-now`); return !n.hidden && n.getBoundingClientRect().width > 0; }, door);
    assert.equal(shown, false);
  } finally { await ctx.close(); }
});

test('320: NOW fits the dock beside the days and the fest name, nothing overlapping', { skip }, async () => {
  const { ctx, page } = await openApp({ width: 320, height: 640 });
  try {
    const r = await page.evaluate(() => {
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const now = box('dock-now'), days = box('dock-days'), fest = box('dock-fest-link'), you = box('dock-you');
      return { now: [now.left, now.right], days: [days.left, days.right], fest: [fest.left, fest.right], you: [you.left, you.right], width: innerWidth };
    });
    assert.ok(r.you[1] <= r.now[0] && r.now[1] <= r.days[0] && r.days[1] <= r.fest[0], `in a row, no overlap: ${JSON.stringify(r)}`);
    assert.ok(r.fest[1] <= r.width, 'nothing off the right edge');
  } finally { await ctx.close(); }
});

// The dock's days keep the day you are in. They already scroll on a phone
// (Portola's four overflow a 390 dock by a few px), and NOW narrows them —
// fine while the row holds its widest tab and a glimpse of the next. A long
// fest name on a 320 dock (an iPhone on Display Zoom) cannot: ACL's row
// would be 27px, so there NOW keeps only its dot, and the day stays whole.
const dockFit = (page) => page.evaluate(() => {
  const now = document.getElementById('dock-now');
  const row = document.getElementById('dock-days');
  const on = row.querySelector('.day-tab.active');
  const n = now.getBoundingClientRect(), r = row.getBoundingClientRect(), a = on.getBoundingClientRect();
  return {
    shown: !now.hidden && n.width > 0, compact: now.classList.contains('compact'), label: now.getAttribute('aria-label'),
    dot: !!now.querySelector('.live') && getComputedStyle(now.querySelector('.live')).display !== 'none',
    rowW: Math.round(r.width), active: on.dataset.day, activeWhole: a.left >= r.left - 1 && a.right <= r.right + 1,
    overflowing: row.classList.contains('overflowing'), clear: n.right <= r.left,
  };
});
for (const [fest, width, height, now, compact] of [
  ['portola-2026', 390, 844, SAT_1030, false],
  ['portola-2026', 320, 640, SAT_1030, false],
  ['acl-2026', 390, 844, new Date('2026-10-02T20:00:00-05:00'), false],
  ['acl-2026', 320, 640, new Date('2026-10-02T20:00:00-05:00'), true],
]) {
  test(`${fest} at ${width}: NOW ${compact ? 'keeps only its dot' : 'keeps its word'}, and the day you are in stays whole`, { skip }, async () => {
    const { ctx, page } = await openApp({ fest, width, height, now });
    try {
      await sleep(400); // the day-of open's glide, and the row's scroll to the day it lit
      const f = await dockFit(page);
      assert.ok(f.shown, 'something is live');
      assert.equal(f.compact, compact, JSON.stringify(f));
      assert.ok(f.dot, 'the live dot, either way');
      assert.equal(f.label, 'Jump to what is playing now');
      assert.ok(f.clear, 'NOW never sits over the days');
      assert.ok(f.activeWhole, `the day you are in is whole in the row: ${JSON.stringify(f)}`);
      assert.ok(f.overflowing, 'a row that scrolls says so at its edges (re-read when NOW took its room)');
    } finally { await ctx.close(); }
  });
}
