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
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

const SAT_1030 = new Date('2026-09-26T22:30:00-07:00');
const SAT_9AM = new Date('2026-09-26T09:00:00-07:00');
const SELECTIONS = { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Prospa: { Nhu: 2 } };

async function openApp({ width = 390, height = 844, touch = true, now = SAT_1030, fest = 'portola-2026' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, serviceWorkers: 'block' });
  const TOKEN = 'nowjumpcontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Now' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN, fest]);
  const doc = {
    v: 4, meta: { name: 'Now', inviteFestId: fest }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 } },
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
    line: lr && { top: lr.top }, stripBottom: strip ? strip.bottom : null,
    card: cr && { top: cr.top, bottom: cr.bottom, left: cr.left, right: cr.right, cell: card.classList.contains('cell'), room: card.closest('.room').dataset.room },
  };
}, [artist, where]);

const tapNow = async (page, door) => {
  await page.locator(`#${door}-now`).click();
  await sleep(1100); // the smooth scroll, and the pulse's start
};
const highlight = async (page, name) => {
  await page.locator('#person-chips .person-chip', { hasText: name }).first().click();
  await sleep(400);
};

for (const [width, height, touch] of [[390, 844, true], [1280, 800, false]]) {
  test(`${width}: NOW sits before the days, is not a day, and a tap lands the now line in view`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch });
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

  test(`${width}: Ross highlighted — NOW lands on his live pick in SAT AFTERS`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch });
    try {
      await highlight(page, 'Ross');
      await tapNow(page, door);
      const v = await view(page, 'Milli Meng', 'Afters');
      assert.ok(v.card, 'his card is on the wall, undimmed');
      assert.equal(v.card.room, 'Afters');
      const top = Math.max(v.railBottom, 0);
      assert.ok(v.card.top >= top && v.card.bottom <= v.dockTop, `his card sits in view below the chrome: ${JSON.stringify(v)}`);
    } finally { await ctx.close(); }
  });

  test(`${width}: Nhu highlighted — her live pick on the grid and the now line are in view together`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch });
    try {
      await highlight(page, 'Nhu');
      await tapNow(page, door);
      const v = await view(page, 'Soulwax', 'cell');
      assert.ok(v.card && v.card.cell, 'Soulwax, on the grid');
      assert.ok(v.line.top > v.stripBottom && v.line.top < v.dockTop, `the line is in view: ${JSON.stringify(v)}`);
      assert.ok(v.card.top >= v.stripBottom - 1 && v.card.top < v.dockTop, `the card's top is in view: ${JSON.stringify(v)}`);
      assert.ok(v.card.top <= v.line.top && v.card.bottom >= v.line.top, 'and it crosses the line — it is playing now');
      assert.ok(v.card.left >= 0 && v.card.right <= v.innerWidth, `and across, its column is on screen: ${JSON.stringify(v)}`);
    } finally { await ctx.close(); }
  });
}

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
