// THE LIST in a real browser (Phase 1, 2026-09-26), with real input — a
// finger's tap on a phone (Chromium touch and WebKit touch), a mouse on a
// laptop — never element.click(): the first cut of the past's line was
// covered by the band head under it, and only a real tap found that out.
//
//   1. the menu bar: dot · name · three lines; brand while open, never the accent;
//   2. the menu's Board · List row: two glyph choices, each a 44px target;
//   3. switching Board ↔ List keeps the place: the set at the top stays put;
//   4. the past's line flips its words under the finger, and holds still;
//   5. NOW lands on a row in the List.
// The real app, a made-up crew, /api answered in the page, the clock pinned
// to Portola Saturday 4:15 PM PT.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
// CI installs WebKit, and there a missing one is a failure (launchWebkit).
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const FID = 'portola-2026';
const SAT_415 = new Date('2026-09-26T16:15:00-07:00');

async function open(engine, { width = 390, view = 'list', now = SAT_415 } = {}) {
  const CREW = randomBytes(20).toString('base64url'); // made up, never a real link
  const phone = width < 720;
  const ctx = await engine.newContext({
    viewport: { width, height: phone ? 844 : 900 }, hasTouch: phone, isMobile: phone && engine === chromium,
    deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block',
  });
  const doc = {
    v: 4, meta: { name: 'List Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Ross: { colorIndex: 5 } },
    festivals: { [FID]: { selections: { Tricky: { Kevin: 2, Maya: 1 }, 'Tove Lo': { Maya: 4, Ross: 2 }, Robyn: { Kevin: 4 } } } },
  };
  const writes = [];
  await ctx.route('**/api/**', (r) => { if (r.request().method() !== 'GET') writes.push(r.request().url()); return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  await ctx.route('**/api/crew**', (r) => { if (r.request().method() !== 'GET') { writes.push(r.request().url()); return r.fulfill({ status: 503, body: '{}' }); } return r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }); });
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t, v]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'List Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    localStorage.setItem('fn_welcome_v1', '1');
    localStorage.setItem('fn_welcome_joined_v1', '1');
    if (v === 'list' && !sessionStorage.getItem('seeded')) localStorage.setItem('fn_view_v1_portola-2026', 'list');
    sessionStorage.setItem('seeded', '1');
  }, [CREW, view]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(now);
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#wall-root .card', { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(900);
  return { ctx, page, errors, writes, phone };
}
// Real input: a finger on a phone, a mouse on a laptop.
async function press(page, phone, sel) {
  const b = await page.locator(sel).first().boundingBox();
  assert.ok(b, `${sel} is on screen`);
  if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const scrollAt = async (page, sel, y) => {
  await page.evaluate(([s, top]) => {
    const el = document.querySelector(s);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - top);
  }, [sel, y]);
  await sleep(700);
};
// What holds the place: the card nearest the top of what you see, under the chrome.
const topCard = (page) => page.evaluate(() => {
  const band = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 0;
  let best = null;
  for (const c of document.querySelectorAll('#wall-root .card[data-artist]')) {
    const r = c.getBoundingClientRect();
    if (r.top >= band - 1 && r.height && (!best || r.top < best.top)) best = { artist: c.dataset.artist, occ: c.dataset.occ, top: r.top };
  }
  return best;
});
const cardTop = (page, artist, occ) => page.evaluate(([a, o]) => {
  const c = [...document.querySelectorAll('#wall-root .card[data-artist]')].find((x) => x.dataset.artist === a && x.dataset.occ === o);
  return c ? c.getBoundingClientRect().top : null;
}, [artist, occ]);
const rgb = (page, sel, prop = 'color') => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);
const brandRgb = (page) => page.evaluate(() => `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--brand').trim().split(/\s*,\s*/).join(', ')})`);
const festRgb = (page) => page.evaluate(() => `rgb(${getComputedStyle(document.body).getPropertyValue('--fest').trim().split(/\s*,\s*/).join(', ')})`);

const ENGINES = [
  ['Chromium 390 touch', () => chromium, 390],
  ['WebKit 390 touch', () => webkit, 390],
  ['Chromium 1280 mouse', () => chromium, 1280],
];
for (const [name, get, width] of ENGINES) {
  const skip = get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER);
  const door = width < 720 ? '#dock-fest-link' : '#rail-fest-link';
  const wrap = width < 720 ? '#dock-fest-wrap' : '#rail-fest-wrap';

  test(`${name}: the menu bar reads dot · name · three lines, brand while open and never the accent; the menu's Board · List row`, { skip }, async () => {
    const { ctx, page, errors, phone } = await open(get(), { width });
    try {
      const order = await page.evaluate((d) => [...document.querySelector(d).children].map((k) => (k.getAttribute('class') || '').split(' ')[0]).filter((c) => c !== 'sr-only'), door);
      assert.deepEqual(order, ['sync-dot', 'fest-name', 'menu-glyph']);
      const dot = await page.locator(`${door} .sync-dot`).boundingBox();
      const nameBox = await page.locator(`${door} .fest-name`).boundingBox();
      const glyph = await page.locator(`${door} .menu-glyph`).boundingBox();
      assert.ok(dot.x < nameBox.x && nameBox.x + nameBox.width <= glyph.x + 0.5, 'drawn in that order, left to right');
      assert.ok(Math.abs(glyph.width - 13) < 0.6, `the three lines at 13px (${glyph.width})`);
      const closed = await rgb(page, `${door} .menu-glyph`);
      assert.notEqual(closed, await brandRgb(page), 'grey while closed');
      await press(page, phone, door);
      await sleep(450);
      assert.equal(await rgb(page, `${door} .menu-glyph`), await brandRgb(page), 'brand while the menu is open');
      assert.notEqual(await rgb(page, `${door} .menu-glyph`), await festRgb(page), 'never the festival accent');
      const row = await page.evaluate((w) => {
        const pop = document.querySelector(`${w} .sort-pop`);
        const vr = pop.querySelector('.view-row');
        return {
          visible: getComputedStyle(pop).display !== 'none',
          options: [...vr.querySelectorAll('[role="option"]')].map((b) => ({ text: b.textContent, sel: b.getAttribute('aria-selected'), h: b.getBoundingClientRect().height, color: getComputedStyle(b).color, glyph: !!b.querySelector('svg') })),
          after: vr.previousElementSibling.className, before: vr.nextElementSibling.className,
        };
      }, wrap);
      assert.ok(row.visible);
      assert.deepEqual(row.options.map((o) => [o.text, o.sel, o.glyph]), [['Board', 'false', true], ['List', 'true', true]]);
      assert.equal(row.options[1].color, await brandRgb(page), 'the chosen one in brand');
      assert.notEqual(row.options[0].color, await brandRgb(page));
      if (phone) assert.ok(row.options.every((o) => o.h >= 44 - 0.5), `each choice a 44px target on a phone (${row.options.map((o) => o.h)})`);
      assert.deepEqual([row.after, row.before], ['pop-div', 'pop-div'], 'a line either side of it');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: Board ↔ List holds the place — the set at the top stays where it was, the menu stays up`, { skip }, async () => {
    const { ctx, page, errors, writes, phone } = await open(get(), { width });
    try {
      await scrollAt(page, '.day-block[data-day="Saturday"] .room[data-room=":fest"] .card[data-artist="Tove Lo"]', 260);
      const before = await topCard(page);
      assert.ok(before, 'a card at the top');
      await press(page, phone, door);
      await sleep(450);
      await press(page, phone, `${wrap} .view-row [data-view="board"]`);
      await sleep(900);
      // The new view's rooms arrive from 6px below: measure once they are in.
      // (Linux WebKit on a loaded CI runner measured Mike D mid-arrival,
      // 45.6 -> 52, after this same 900ms; run 36247465311, 2026-09-26.)
      await motionDone(page, { within: '#wall-root' });
      assert.ok(await page.locator('#wall-root .times-grid').count(), 'the Board');
      const onBoard = await cardTop(page, before.artist, before.occ);
      assert.ok(onBoard != null && Math.abs(onBoard - before.top) < 2, `${before.artist} held on the Board: ${before.top} → ${onBoard}`);
      assert.equal(await page.locator(door).getAttribute('aria-expanded'), 'true', 'the menu stayed up');
      await press(page, phone, `${wrap} .view-row [data-view="list"]`);
      await sleep(900);
      await motionDone(page, { within: '#wall-root' });
      assert.equal(await page.locator('#wall-root[data-view="list"]').count(), 1, 'the List again');
      const back = await cardTop(page, before.artist, before.occ);
      assert.ok(back != null && Math.abs(back - before.top) < 2, `and held back in the List: ${before.top} → ${back}`);
      assert.equal(await page.evaluate(() => localStorage.getItem('fn_view_v1_portola-2026')), 'list');
      assert.deepEqual(writes.filter((u) => u.includes('/api/crew')), [], 'never sent to the crew');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: the past's line flips its words under the finger, and holds still both ways`, { skip }, async () => {
    const { ctx, page, errors, phone } = await open(get(), { width });
    try {
      const line = '.day-block[data-day="Saturday"] .room[data-room=":fest"] .past-line';
      await scrollAt(page, line, 180);
      const hit = await page.evaluate((s) => {
        const l = document.querySelector(s);
        const r = l.getBoundingClientRect();
        const at = (x, y) => { const u = document.elementFromPoint(x, y); return !!u && l.contains(u); };
        return { h: r.height, mid: at(r.left + r.width / 2, r.top + r.height / 2), low: at(r.left + 40, r.bottom - 3), high: at(r.left + 40, r.top + 3) };
      }, line);
      assert.ok(hit.h >= 44 - 0.5, `the line is a 44px target (${hit.h})`);
      assert.deepEqual([hit.high, hit.mid, hit.low], [true, true, true], 'nothing covers any part of it');
      const y0 = (await page.locator(line).boundingBox()).y;
      assert.equal((await page.locator(line).textContent()).trim(), 'Earlier · 7 sets');
      await press(page, phone, line);
      await sleep(700);
      assert.equal(await page.locator(line).getAttribute('aria-expanded'), 'true');
      assert.equal((await page.locator(line).textContent()).trim(), 'Hide earlier');
      const y1 = (await page.locator(line).boundingBox()).y;
      assert.ok(Math.abs(y1 - y0) < 1.5, `the line held under the finger (${y0} → ${y1})`);
      assert.ok(await page.locator('.room[data-room=":fest"] .card[data-artist="Airwolf Paradise"]').first().isVisible(), 'the past is back, below it');
      await press(page, phone, line);
      await sleep(700);
      assert.equal((await page.locator(line).textContent()).trim(), 'Earlier · 7 sets');
      const y2 = (await page.locator(line).boundingBox()).y;
      assert.ok(Math.abs(y2 - y0) < 1.5, `and held folding back (${y0} → ${y2})`);
      assert.equal(await page.locator('.room[data-room=":fest"] .card[data-artist="Airwolf Paradise"]').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: NOW lands on a row in the List`, { skip }, async () => {
    const { ctx, page, errors, phone } = await open(get(), { width });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(500);
      const now = width < 720 ? '#dock-now' : '#rail-now';
      assert.equal(await page.locator(now).isVisible(), true, 'NOW is in the day row while sets are on');
      await press(page, phone, now);
      await sleep(1600);
      const seen = await page.evaluate(() => {
        const band = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 0;
        const dock = document.getElementById('dock');
        const bottom = dock && getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect().top : innerHeight;
        return [...document.querySelectorAll('#wall-root .card.row.now')].filter((c) => { const r = c.getBoundingClientRect(); return r.top >= band - 2 && r.bottom <= bottom + 2; }).map((c) => c.dataset.artist);
      });
      assert.ok(seen.length > 0, `a row wearing the ring is on screen after NOW (${seen})`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
