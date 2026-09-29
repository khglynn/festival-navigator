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
import { launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER, nowInView } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
// CI installs WebKit, and there a missing one is a failure (launchWebkit).
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const FID = 'portola-2026';
const SAT_415 = new Date('2026-09-26T16:15:00-07:00');

async function open(engine, { width = 390, view = 'list', now = SAT_415, selections = null } = {}) {
  const CREW = randomBytes(20).toString('base64url'); // made up, never a real link
  const phone = width < 720;
  const ctx = await engine.newContext({
    viewport: { width, height: phone ? 844 : 900 }, hasTouch: phone, isMobile: phone && engine === chromium,
    deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block',
  });
  await lateStarts(ctx); // LATE_ANIMATIONS_MS: Linux WebKit's late motion, on any machine
  const doc = {
    v: 4, meta: { name: 'List Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Ross: { colorIndex: 5 } },
    festivals: { [FID]: { selections: selections || { Tricky: { Kevin: 2, Maya: 1 }, 'Tove Lo': { Maya: 4, Ross: 2 }, Robyn: { Kevin: 4 } } } },
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
      // Read the colour once the menu is open and its .12s colour transition
      // has run: Linux WebKit on a loaded CI runner read the closed grey after
      // this same 450ms (run 36253819310, 2026-09-26).
      await page.waitForFunction((d) => document.querySelector(d).getAttribute('aria-expanded') === 'true', door, { timeout: 4000 });
      await motionDone(page, { within: wrap }); // the door and its menu
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
      // The past arriving is motion; the next tap waits for it to stop, as the
      // line's box is where the finger lands (a late start held it mid-way).
      await motionDone(page, { within: '#wall-root' });
      assert.equal(await page.locator(line).getAttribute('aria-expanded'), 'true');
      assert.equal((await page.locator(line).textContent()).trim(), 'Hide earlier');
      const y1 = (await page.locator(line).boundingBox()).y;
      assert.ok(Math.abs(y1 - y0) < 1.5, `the line held under the finger (${y0} → ${y1})`);
      assert.ok(await page.locator('.room[data-room=":fest"] .card[data-artist="Airwolf Paradise"]').first().isVisible(), 'the past is back, below it');
      await press(page, phone, line);
      await sleep(700);
      await motionDone(page, { within: '#wall-root' });
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
      // A phone's row can rest with NOW past its left edge (v103): the row to
      // its start first, as a finger's swipe would, so the tap lands on NOW
      // and not on the avatar beside the row.
      await nowInView(page, width < 720 ? 'dock' : 'rail');
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

// 6. In the List a highlight FILTERS (v103 — Kevin, 2026-09-26: "our grid can
// highlight. our list can filter."): with Maya highlighted through the people
// menu (real taps / clicks, the menu staying up), only her rows are in the
// List; a room she picked nothing in is one quiet line whose words are never
// cut; the change moves (the rows that go fade, the rest slide — transforms
// and opacity only); Everyone brings every row back; nothing is written.
for (const [name, get, width] of ENGINES) {
  const skip = get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER);
  const bar = width < 720 ? 'dock' : 'rail';
  test(`${name}: a highlight filters the List — her rows only, a quiet line where she picked nothing, and Everyone brings it back`, { skip }, async () => {
    const { ctx, page, errors, writes, phone } = await open(get(), { width });
    try {
      await scrollAt(page, '.day-block[data-day="Saturday"] .room[data-room=":fest"]', 120);
      await page.evaluate(() => {
        window.__anims = [];
        const was = Element.prototype.animate;
        Element.prototype.animate = function (kf, opts) {
          if (this.closest && this.closest('#wall-root')) window.__anims.push(JSON.stringify(kf));
          return was.call(this, kf, opts);
        };
      });
      const everyone = await page.evaluate(() => document.querySelectorAll('#wall-root .card[data-artist]').length);
      await press(page, phone, `#${bar}-you`);
      await sleep(400);
      await press(page, phone, `#${bar}-you-wrap .hl-pop [data-person="Maya"]`);
      await motionDone(page, { within: '#wall-root' });
      await sleep(300);
      const r = await page.evaluate((b) => {
        const cards = [...document.querySelectorAll('#wall-root .card[data-artist]')].map((c) => c.dataset.artist);
        const quiet = [...document.querySelectorAll('#wall-root .room.quiet')].map((q) => {
          const h = q.querySelector('.room-head').getBoundingClientRect();
          const w = q.querySelector('.quiet-words');
          const wr = w.getBoundingClientRect();
          return { room: q.dataset.room, day: q.closest('.day-block').dataset.day, kids: q.children.length, words: w.textContent, whole: w.scrollWidth <= w.clientWidth + 0.5 && wr.right <= h.right + 0.5 };
        });
        const menu = document.querySelector(`#${b}-you-wrap .hl-pop`);
        return { cards, quiet, menuOpen: !!menu && getComputedStyle(menu).display !== 'none' };
      }, bar);
      assert.ok(r.cards.length > 0 && r.cards.every((a) => ['Tricky', 'Tove Lo'].includes(a)), `only Maya's rows: ${r.cards}`);
      assert.ok(r.menuOpen, 'the menu stays up while you choose');
      const folsom = r.quiet.find((q) => q.day === 'Saturday' && q.room === 'Folsom');
      assert.ok(folsom, `SAT FOLSOM is a quiet line: ${JSON.stringify(r.quiet)}`);
      assert.equal(folsom.kids, 1, 'one line: the head and nothing under it');
      assert.equal(folsom.words, 'nothing Maya picked');
      for (const q of r.quiet) assert.ok(q.whole, `the words are never cut: ${JSON.stringify(q)}`);
      const anims = await page.evaluate(() => window.__anims.splice(0));
      assert.ok(anims.length > 0, 'the change moves');
      assert.ok(anims.every((kf) => !/"(top|left|height|width|margin)/.test(kf)), `transforms and opacity only: ${anims.slice(0, 4)}`);
      await press(page, phone, `#${bar}-you-wrap .hl-pop [data-person=""]`);
      await motionDone(page, { within: '#wall-root' });
      await sleep(300);
      const back = await page.evaluate(() => ({ n: document.querySelectorAll('#wall-root .card[data-artist]').length, quiet: document.querySelectorAll('#wall-root .room.quiet').length }));
      assert.deepEqual(back, { n: everyone, quiet: 0 }, 'Everyone brings every row back');
      assert.deepEqual(writes.filter((u) => u.includes('/api/crew')), [], 'nothing written to the crew');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// 7. A pick that stops belonging, filtered to yourself (Sol's review of v103;
// call 2d): un-pick a row and it DIMS where it is, stays while you are on it —
// the mouse resting there, the finger's shelf up — and leaves once you let it
// go, the rows closing up and the room's count right. Real input only.
for (const [name, get, width] of ENGINES) {
  const skip = get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER);
  const bar = width < 720 ? 'dock' : 'rail';
  test(`${name}: filtered to yourself, an un-picked row dims where it is, stays while you are on it, and leaves when you let it go`, { skip }, async () => {
    const { ctx, page, errors, writes, phone } = await open(get(), { width });
    try {
      await scrollAt(page, '.day-block[data-day="Saturday"] .room[data-room=":fest"]', 120);
      await press(page, phone, `#${bar}-you`);
      await sleep(400);
      await press(page, phone, `#${bar}-you-wrap .hl-pop [data-person="Kevin"]`);
      await motionDone(page, { within: '#wall-root' });
      await press(page, phone, `#${bar}-you`); // the menu away
      await sleep(500);
      const robyn = '#wall-root .room[data-room=":fest"] .card[data-artist="Robyn"]';
      const rows = () => page.evaluate(() => [...document.querySelectorAll('#wall-root .room[data-room=":fest"] .card[data-artist]')].map((c) => `${c.dataset.artist}${c.classList.contains('dim') ? ':dim' : ''}`));
      assert.deepEqual(await rows(), ['Tricky', 'Robyn'], 'yours: Tricky and Robyn');
      await page.locator(robyn).scrollIntoViewIfNeeded();
      const b = await page.locator(robyn).boundingBox();
      if (phone) {
        // A finger opens the shelf; − steps Robyn from must to nothing.
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForSelector('#artist-sheet .f-step.minus', { timeout: 5000 });
        // Each tap once the shelf stands still (it rises, and a step re-lays
        // its row: a late start held the − mid-way and the tap missed it),
        // and the next only once the pick has changed.
        for (let i = 0; i < 4 && !(await rows()).includes('Robyn:dim'); i++) {
          await motionDone(page, { within: '#artist-sheet' });
          const m = await page.locator('#artist-sheet .f-step.minus').boundingBox();
          const was = await page.locator(robyn).getAttribute('aria-label');
          await page.touchscreen.tap(m.x + m.width / 2, m.y + m.height / 2);
          await page.waitForFunction(([s, w]) => { const c = document.querySelector(s); return !c || c.getAttribute('aria-label') !== w; }, [robyn, was], { timeout: 4000 });
        }
      } else {
        // A mouse click cycles: must → nothing. The pointer stays on the row.
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
        await sleep(300);
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      }
      await sleep(1200);
      assert.deepEqual(await rows(), ['Tricky', 'Robyn:dim'], 'dimmed where it is, and still there while you are on it');
      // Let it go.
      if (phone) {
        // The finger closes the shelf the way a finger does: its ✕.
        const x = await page.locator('#artist-sheet .sheet-close').boundingBox();
        await page.touchscreen.tap(x.x + x.width / 2, x.y + x.height / 2);
        await page.waitForFunction(() => !document.getElementById('artist-sheet'), null, { timeout: 5000 });
      } else {
        await page.mouse.move(4, 4, { steps: 6 });
      }
      await page.waitForFunction(() => !document.querySelector('#wall-root .room[data-room=":fest"] .card[data-artist="Robyn"]'), null, { timeout: 5000 });
      await motionDone(page, { within: '#wall-root' });
      assert.deepEqual(await rows(), ['Tricky'], 'gone once let go');
      assert.deepEqual(writes.filter((u) => u.includes('/api/crew')).length > 0, true, 'the un-pick itself is a real pick, sent');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// 8. Each row settles on its own (Sol's re-review of v103): with a mouse,
// un-pick Tricky, move down to Robyn and un-pick it too. Where the page has
// room above to hold by, Tricky leaves while Robyn's zoom still stands and
// Robyn does not move under the pointer. At the page's top — nothing above to
// scroll back — Tricky would pull Robyn up under the pointer, so it waits for
// Robyn to be let go, and they leave together.
const LONG = { Tricky: { Kevin: 2 }, Robyn: { Kevin: 4 } };
for (const a of ['Airwolf Paradise', 'Felly Fell', 'Gelli Haha', 'Despacio', 'Oskar Med K', 'Six Sex', 'Groove Armada', 'DJ Shadow', 'Soulwax', 'Dog Blood', 'Milli Meng', 'Channel Tres', 'SG Lewis', 'Mochakk']) LONG[a] = { Kevin: 1 };
for (const [label, selections, roomAbove] of [['room above to hold by', LONG, true], ['at the page’s top', null, false]]) {
  test(`Chromium 1280 mouse, ${label}: un-pick A, then B — B never moves under the pointer${roomAbove ? ', and A leaves while B is held' : '; A waits for B, then both go'}`, { skip: chromium ? false : NO_BROWSER }, async () => {
    const { ctx, page, errors } = await open(chromium, { width: 1280, selections });
    try {
      await press(page, false, '#rail-you');
      await sleep(400);
      await press(page, false, '#rail-you-wrap .hl-pop [data-person="Kevin"]');
      await motionDone(page, { within: '#wall-root' });
      await press(page, false, '#rail-you');
      await sleep(500);
      const sel = (a) => `#wall-root .day-block[data-day="Saturday"] .room[data-room=":fest"] .card[data-artist="${a}"]`;
      const has = (a) => page.evaluate((s) => { const c = document.querySelector(s); return c ? (c.classList.contains('dim') ? 'dim' : 'on') : 'gone'; }, sel(a));
      await scrollAt(page, sel('Tricky'), 110);
      const y0 = await page.evaluate(() => scrollY);
      if (roomAbove) assert.ok(y0 > 150, `the page has room above (${y0})`);
      else assert.ok(y0 < 60, `the page is near its top (${y0})`);
      // A mouse steps a pick down with the grown card's − (the zoom's own
      // control, never a wrap: − lowers one level and stops at nothing). The
      // hand comes to rest on the − and stays there, as a person's does: every
      // step is a click at that one point, and before each the − has to be
      // what is under it. Nothing may slide the zoom out from under a still
      // hand, or put it away. On CI (run 36347015035) Robyn's zoom went while
      // Robyn was still picked, and a probe of this walk found why: Tricky
      // leaving repainted the List and grew Robyn's zoom again BEFORE the page
      // was held, one row too high, so it closed under the hand or snapped
      // back, and a click meant for the − landed on the card and stepped the
      // pick UP (picked to picked ×2). claude-plans/2026-09-29-tuesday/webkit-reds.md
      const face = (bb) => ({ x: bb.x + bb.width * 0.25, y: bb.y + bb.height * 0.3 });
      const onZoomOf = (a) => page.waitForFunction((n) => [...document.querySelectorAll('#zoom-layer .zoom-slot.shown')].some((z) => (z.querySelector('.f-name') || {}).textContent === n), a, { timeout: 4000 });
      const label = (a) => page.evaluate((s) => { const c = document.querySelector(s); return c ? c.getAttribute('aria-label') : null; }, sel(a));
      const level = (l) => (!l || / — not picked/.test(l) ? 0 : / — must/.test(l) ? 4 : Number((l.match(/ — picked ×(\d)/) || [0, 1])[1]));
      const onMinus = (p) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('#zoom-layer .zoom-slot.shown .f-step.minus')); }, [p.x, p.y]);
      const restOnMinus = async (a) => {
        await onZoomOf(a);
        const m = await page.evaluate(() => {
          const e = document.querySelector('#zoom-layer .zoom-slot.shown .f-step.minus');
          const r = e && e.getBoundingClientRect();
          return r && r.width ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null;
        });
        assert.ok(m, `${a}'s zoom stands with its −`);
        await page.mouse.move(m.x, m.y, { steps: 2 });
        return m;
      };
      const stepDown = async (a, hand) => {
        for (let i = 1; i <= 4 && (await has(a)) !== 'dim'; i++) {
          const was = await label(a);
          assert.ok(await onMinus(hand), `${a} is still picked (${was}), and the still hand is on its zoom's − (step ${i})`);
          await page.mouse.click(hand.x, hand.y);
          await page.waitForFunction(([s, w]) => { const c = document.querySelector(s); return !c || c.getAttribute('aria-label') !== w; }, [sel(a), was], { timeout: 4000 });
          const now = await label(a);
          assert.equal(level(now), level(was) - 1, `the − stepped ${a} down one level (step ${i}: ${was} → ${now})`);
        }
        assert.equal(await has(a), 'dim', `${a} un-picked, dimmed, still there under the hand`);
      };
      // Tricky: 2 → 1 → nothing, the hand resting on its −.
      let b = await page.locator(sel('Tricky')).boundingBox();
      let at = face(b);
      await page.mouse.move(at.x, at.y, { steps: 4 });
      await stepDown('Tricky', await restOnMinus('Tricky'));
      // Down to Robyn, watching where it is from the moment the pointer leaves Tricky.
      b = await page.locator(sel('Robyn')).boundingBox();
      await page.evaluate((s) => {
        window.__robyn = [];
        window.__robynWatch = setInterval(() => { const c = document.querySelector(s); if (c) window.__robyn.push(Math.round(c.getBoundingClientRect().top)); }, 16);
      }, sel('Robyn'));
      // Onto Robyn's lower half: Tricky's grown zoom can reach over the top of
      // the row just below it, and the pointer has to leave that zoom to be on Robyn.
      at = { x: b.x + b.width / 2, y: b.y + b.height * 0.85 };
      await page.mouse.move(at.x, at.y, { steps: 8 });
      const hand = await restOnMinus('Robyn');
      if (roomAbove) {
        // Tricky, let go, leaves while the hand rests on Robyn's zoom (the
        // leftover watch looks every 400 ms), and the page is held by Robyn.
        await page.waitForFunction((s) => !document.querySelector(s), sel('Tricky'), { timeout: 5000 });
        await motionDone(page, { within: '#wall-root' });
      }
      await stepDown('Robyn', hand); // must → ×3 → ×2 → picked → nothing
      await sleep(600); // a negative's window: a let-go Tricky has had its turns at the watch
      await motionDone(page, { within: '#wall-root' });
      assert.equal(await has('Robyn'), 'dim', 'Robyn un-picked, dimmed, held');
      assert.ok(await onMinus(hand), 'Robyn\'s zoom still stands under the still hand');
      assert.equal(await has('Tricky'), roomAbove ? 'gone' : 'dim', roomAbove ? 'Tricky gone while Robyn is held' : 'Tricky waits for Robyn');
      const tops = await page.evaluate(() => { clearInterval(window.__robynWatch); return window.__robyn; });
      assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, `Robyn never moved under the pointer: ${[...new Set(tops)]}`);
      // Let go: whatever is left goes.
      await page.mouse.move(4, 4, { steps: 6 });
      await page.waitForFunction(([r, t]) => !document.querySelector(r) && !document.querySelector(t), [sel('Robyn'), sel('Tricky')], { timeout: 5000 });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
