// Our plan's peek, with real input (2026-09-26 — Kevin's call #5). The peek is
// the day plan's own NOW row seen through a window above the dock; a finger
// drags the window open, a slow release decides by distance, a flick by its
// direction, and the open plan drags back down by its grabber. What jsdom
// cannot see is held here: the row really sits in the window above the dock,
// the wall's end clears the peek, a finger on the peek never reaches the card
// behind it, a drag marks the page busy (a new build never reloads under the
// hand) and gives the mark back, and Reduce Motion settles at once.
// The real app, the made-up nine (tests/fixtures/plan-crew-nine.json), /api
// answered in the page, every write refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NINE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: that engine skips */ }
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const FID = 'portola-2026';
const SAT_940 = new Date('2026-09-26T21:40:00-07:00'); // Dog Blood on the Pier Stage, 8 of us

async function openPhone(engine, { reduced = false, desk = false } = {}) {
  const CREW = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, isMobile: !desk && engine === chromium, deviceScaleFactor: 2,
    timezoneId: 'America/Los_Angeles', serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const doc = {
    v: 4, meta: { name: 'Nine', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(NINE.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: NINE.picks } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Nine' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Gus');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
  }, [CREW]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(SAT_940);
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
  await sleep(900); // the peek has arrived
  return { ctx, page, errors };
}

const geometry = (page) => page.evaluate(() => {
  const el = document.getElementById('plan');
  const row = el.querySelector('.plan-row.tagged');
  const dock = document.getElementById('dock').getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width * 0.3, r.top + r.height / 2);
  return {
    state: el.dataset.state, planTop: el.getBoundingClientRect().top, dockTop: dock.top,
    rowTop: r.top, rowBottom: r.bottom, hitInRow: !!(hit && row.contains(hit)),
    grabBottom: el.querySelector('.plan-grab').getBoundingClientRect().bottom,
    busy: document.body.dataset.busy || null,
    // The window's own motion (Web Animations), not the nodes' endless aura drift.
    running: el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && !(a instanceof CSSAnimation)).length,
  };
});
const grabAt = (page) => page.evaluate(() => {
  const g = document.querySelector('#plan .plan-grab').getBoundingClientRect();
  const el = document.getElementById('plan');
  return { x: g.left + g.width / 2, y: g.top + g.height / 2, range: el.offsetHeight - Number(el.dataset.peekH) };
});
// A mouse drag: down, a slow walk of `steps`, an optional hold, up.
async function drag(page, from, dy, { steps = 12, stepMs = 16, holdMs = 250 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) { await page.mouse.move(from.x, from.y + dy * (k / steps)); await sleep(stepMs); }
  if (holdMs) await sleep(holdMs);
  const mid = await geometry(page);
  await page.mouse.up();
  return mid;
}

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name}: the peek is the NOW row in a window on the dock — seen whole, and what a finger touches`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      const g = await geometry(page);
      assert.equal(g.state, 'peek');
      assert.ok(Math.abs(g.rowBottom - g.dockTop) <= 1, `the row ends at the dock's top edge: ${JSON.stringify(g)}`);
      assert.ok(g.rowTop >= g.grabBottom - 0.5, `and starts under the grabber: ${JSON.stringify(g)}`);
      assert.ok(g.hitInRow, 'a finger on the row touches the row (nothing paints over it)');
      assert.equal(await page.locator('#plan .plan-row.tagged').getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 8 of us');
      // The wall's end clears the peek: scrolled to the bottom, the last room
      // ends above the peek's top.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(300);
      const end = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('#wall-root .card')];
        const last = Math.max(...blocks.map((c) => c.getBoundingClientRect().bottom));
        return { last, peekTop: document.getElementById('plan').getBoundingClientRect().top };
      });
      assert.ok(end.last <= end.peekTop + 0.5, `the last card is not under the peek: ${JSON.stringify(end)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a slow drag past a third opens it, short of a third it goes back, and the page is busy only while the hand is down`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      let from = await grabAt(page);
      const short = await drag(page, from, -from.range * 0.2);
      assert.equal(short.busy, 'plan-drag', 'the hand is down: the page is marked busy');
      await sleep(500);
      let g = await geometry(page);
      assert.equal(g.state, 'peek', 'short of a third: back to the peek');
      assert.equal(g.busy, null, 'and the mark is given back');
      from = await grabAt(page);
      const mid = await drag(page, from, -from.range * 0.55);
      assert.ok(mid.planTop < from.y - from.range * 0.4, `mid-drag the window follows the finger: ${JSON.stringify(mid)}`);
      await sleep(600);
      g = await geometry(page);
      assert.equal(g.state, 'open', 'past a third: open');
      assert.equal(g.running, 0, 'and settled');
      const head = await page.evaluate(() => {
        const h = document.querySelector('#plan .plan-head').getBoundingClientRect();
        const at = document.elementFromPoint(h.left + 40, h.top + h.height / 2);
        return { inHead: !!(at && document.querySelector('#plan .plan-head').contains(at)), opacity: getComputedStyle(document.querySelector('#plan .plan-head')).opacity };
      });
      assert.deepEqual(head, { inHead: true, opacity: '1' }, 'the head is there, whole');
      // Back down by the grabber, past a third of the way.
      from = await grabAt(page);
      await drag(page, from, from.range * 0.5);
      await sleep(500);
      assert.equal((await geometry(page)).state, 'peek');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a flick decides by its direction; a tap on the peek opens it and never reaches the card behind`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      let from = await grabAt(page);
      await drag(page, from, -60, { steps: 3, stepMs: 8, holdMs: 0 }); // short and fast
      await sleep(600);
      assert.equal((await geometry(page)).state, 'open', 'a flick up opens it, short as it was');
      from = await grabAt(page);
      await drag(page, from, 60, { steps: 3, stepMs: 8, holdMs: 0 });
      await sleep(500);
      assert.equal((await geometry(page)).state, 'peek', 'a flick down closes it');
      // A tap on the peek's row: the plan opens; the wall behind hears nothing.
      const picksBefore = await page.evaluate(() => document.querySelectorAll('#wall-root .card.picked, #wall-root .card[data-level]:not([data-level="0"])').length);
      const b = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.touchscreen.tap(b.x + b.width * 0.4, b.y + b.height / 2);
      await sleep(600);
      assert.equal((await geometry(page)).state, 'open');
      const picksAfter = await page.evaluate(() => document.querySelectorAll('#wall-root .card.picked, #wall-root .card[data-level]:not([data-level="0"])').length);
      assert.equal(picksAfter, picksBefore, 'no pick went through the peek');
      assert.equal(await page.evaluate(() => { const z = document.getElementById('zoom-layer'); return z ? z.childElementCount : 0; }), 0, 'and no zoom');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}, Reduce Motion: the settle after a drag is instant; the drag itself still follows the finger`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { reduced: true });
    try {
      const from = await grabAt(page);
      const mid = await drag(page, from, -from.range * 0.6);
      assert.ok(mid.planTop < from.y - from.range * 0.4, 'direct manipulation is kept');
      const g = await geometry(page);
      assert.equal(g.state, 'open');
      assert.equal(g.running, 0, 'nothing animates after the hand lets go');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('Chromium touch: a finger drag opens it, and a finger drag on the open list scrolls the list, never the plan', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await openPhone(chromium);
  try {
    const cdp = await ctx.newCDPSession(page);
    const from = await grabAt(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ x: from.x, y: from.y + 30 }]);
    for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: from.x, y: from.y + 30 - (from.range * 0.6) * (k / 12) }]); await sleep(16); }
    await sleep(250);
    await touch('touchEnd', []);
    await sleep(600);
    assert.equal((await geometry(page)).state, 'open');
    const list = await page.evaluate(() => {
      const l = document.querySelector('#plan .plan-list');
      const r = l.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.7, scrolls: l.scrollHeight > l.clientHeight + 4 };
    });
    if (list.scrolls) {
      await touch('touchStart', [{ x: list.x, y: list.y }]);
      for (let k = 1; k <= 8; k++) { await touch('touchMove', [{ x: list.x, y: list.y - k * 15 }]); await sleep(16); }
      await touch('touchEnd', []);
      await sleep(500);
      const after = await page.evaluate(() => ({ state: document.getElementById('plan').dataset.state, top: document.querySelector('#plan .plan-list').scrollTop }));
      assert.equal(after.state, 'open', 'the list scrolled; the plan stayed open');
      assert.ok(after.top > 0, 'and the list moved');
    }
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// ---- the laptop: the corner card that grows into the side panel ----------------------
const hitPlan = (page, x, y) => page.evaluate(([xx, yy]) => {
  const at = document.elementFromPoint(xx, yy);
  return !!(at && document.getElementById('plan').contains(at));
}, [x, y]);

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name} 1280: the corner card is 20px in from both edges; a click grows it into the panel under the rail, the wall usable beside it; Escape puts it back`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true });
    try {
      const row = await page.locator('#plan .plan-row.tagged').boundingBox();
      const y = row.y + row.height / 2;
      assert.equal(await hitPlan(page, 1280 - 25, y), true, 'inside the card, near its right edge');
      assert.equal(await hitPlan(page, 1280 - 15, y), false, 'the 20px gap to the window edge is the wall');
      assert.equal(await hitPlan(page, 1280 - 380 - 25, y), false, 'the card is 380px wide');
      const bottom = await page.evaluate(() => {
        const r = document.querySelector('#plan .plan-row.tagged').getBoundingClientRect();
        return innerHeight - r.bottom;
      });
      assert.ok(bottom >= 18 && bottom <= 24, `its row sits just above the 20px gap at the bottom (${bottom})`);
      assert.equal(await page.evaluate(() => document.getElementById('rail-now').hidden), true, 'the corner says NOW: the rail steps aside');
      await page.mouse.click(row.x + row.width * 0.4, y);
      await sleep(700);
      const open = await page.evaluate(() => {
        const el = document.getElementById('plan');
        const r = el.getBoundingClientRect();
        const rail = document.getElementById('day-rail').getBoundingClientRect();
        return { state: el.dataset.state, side: el.dataset.side, left: r.left, top: r.top, railBottom: rail.bottom, width: r.width };
      });
      assert.equal(open.state, 'open');
      assert.equal(open.side, 'open');
      assert.ok(Math.abs(open.left - 880) <= 1 && Math.abs(open.width - 400) <= 1, `a 400px panel on the right: ${JSON.stringify(open)}`);
      assert.ok(Math.abs(open.top - open.railBottom) <= 1, `from under the rail: ${JSON.stringify(open)}`);
      assert.equal(await hitPlan(page, 1280 - 15, 400), true, 'the panel reaches the edge');
      assert.equal(await hitPlan(page, 870, 400), false, 'and the wall beside it is the wall (no backdrop)');
      assert.equal(await page.evaluate(() => document.body.classList.contains('sheet-open') || !!document.querySelector('.sheet-backdrop')), false);
      await page.keyboard.press('Escape');
      await sleep(600);
      assert.equal(await page.evaluate(() => document.getElementById('plan').dataset.state), 'peek', 'Escape puts it back in the corner');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name} 1280: with the panel open, a zoom keeps left of it`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true });
    try {
      const row = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.mouse.click(row.x + row.width * 0.4, row.y + row.height / 2);
      await sleep(700);
      const at = await page.evaluate(() => {
        const side = document.getElementById('plan').getBoundingClientRect().left;
        const hit = [...document.querySelectorAll('#wall-root .card')].map((c) => ({ a: c.dataset.artist, r: c.getBoundingClientRect() }))
          .find(({ r }) => r.right > side - 140 && r.right <= side && r.top > 140 && r.bottom < innerHeight - 60);
        return hit ? { x: hit.r.left + hit.r.width / 2, y: hit.r.top + hit.r.height / 2, side } : null;
      });
      assert.ok(at, 'a card beside the panel');
      await page.mouse.move(at.x, at.y, { steps: 5 });
      await sleep(1100);
      const z = await page.evaluate(() => { const c = document.querySelector('#zoom-layer .zoom-card'); if (!c) return null; const r = c.getBoundingClientRect(); return { left: r.left, right: r.right }; });
      assert.ok(z, 'it zoomed');
      assert.ok(z.right <= at.side - 7.5, `its right edge clears the panel by 8px: ${JSON.stringify({ z, side: at.side })}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
