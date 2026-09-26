// The zoom's door row on its most crowded card, in a real browser (v92 —
// Kevin, 2026-09-25: "We need to test that design on a crowded card with buy
// and info links"). gallery.html's 20 grows a real Portola afters — Femme
// Jatale b2b erika's own entry: doors, a guessed window, the unconfirmed
// order door, the venue's map door, Tix and Info — with someone at every
// level, notes and a Spotify pill, and then its second set under a bill long
// enough for two lines. At 390 and 320 by a real hold (touch), at 1280 by a
// real hover, it measures what the eye would check:
//   nothing clipped: every row inside the grown card, the card inside the
//   screen with its 8px margins;
//   nothing overlapping: no two rows share a pixel;
//   the − · note · + row is the card's floor (Kevin, after the button study:
//   "just − + no button shape", and the notes chip as it always was): the
//   glyphs stand on the card's content edges, the − and + targets meet the
//   chip with no gap, 44px tall, and reach out to the card's edges and down
//   to its bottom;
//   every door out (map, order, Tix, Info) and every row door is still the
//   thing under its own centre — reachable, not covered.
// Then + and − step the level with the zoom standing.
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

const CARDS = ['Femme Jatale b2b erika', 'Femme Jatale b2b erika b2b sfcowboy'];
const SIZES = [
  { w: 390, h: 844, touch: true },
  { w: 320, h: 568, touch: true },
  { w: 1280, h: 900, touch: false },
];

async function openGallery({ w, h, touch }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${server.origin}/gallery.html`, { waitUntil: 'load' });
  await page.waitForSelector('#zoom-row-crowded .card', { state: 'visible', timeout: 15000 });
  return { ctx, page, errors };
}

// A real hold (touch) or a real hover (mouse) on the card, centred on screen.
async function grow(ctx, page, artist, touch) {
  const at = await page.evaluate((a) => {
    const el = document.querySelector(`#zoom-row-crowded .card[data-artist="${a}"]`);
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }, artist);
  await sleep(250);
  if (touch) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
    await sleep(650);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(at.x - 40, at.y - 40);
    await page.mouse.move(at.x, at.y, { steps: 6 });
  }
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(800); // the bloom and its cascade have landed
}

const measure = (page) => page.evaluate(() => {
  const z = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const rows = [...z.children].filter((c) => !c.classList.contains('z-surface') && !c.classList.contains('f-parked'));
  // The grown block's own rows, and the door row after it.
  const parts = [];
  for (const c of rows) {
    if (c.classList.contains('f-grown')) for (const g of c.children) parts.push({ cls: g.className, ...box(g) });
    else parts.push({ cls: c.className, ...box(c) });
  }
  const hit = (el) => {
    const r = el.getBoundingClientRect();
    const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!under && (under === el || el.contains(under));
  };
  const doorsOut = [...z.querySelectorAll('a.f-link, a.f-where, a.f-order')].map((a) => ({ text: a.textContent.trim(), hit: hit(a) }));
  const row = z.querySelector('.f-step-row');
  const cells = row ? [...row.children].map((b) => {
    const g = b.querySelector('.f-step-dot');
    return { text: b.textContent, disabled: !!b.disabled, hit: hit(b), ...box(b), glyph: g ? box(g) : null };
  }) : [];
  const cs = getComputedStyle(z);
  const content = { l: z.getBoundingClientRect().left + parseFloat(cs.paddingLeft), r: z.getBoundingClientRect().right - parseFloat(cs.paddingRight) };
  // The reach: what a finger gets at the card's own edges and just above the pill.
  const at = (x, y) => { const u = document.elementFromPoint(x, y); const d = u && u.closest('.f-step-row > *'); return d ? d.textContent : null; };
  const zr = z.getBoundingClientRect();
  const rr = row ? row.getBoundingClientRect() : null;
  const reach = rr ? {
    leftEdge: at(zr.left + 3, rr.top + rr.height / 2),
    rightEdge: at(zr.right - 3, rr.top + rr.height / 2),
    bottomEdge: [...row.children].map((b) => { const r = b.getBoundingClientRect(); return at(r.left + r.width / 2, zr.bottom - 3); }),
    above: [...row.children].map((b) => { const r = b.getBoundingClientRect(); return at(r.left + r.width / 2, rr.top - 4); }),
    chipTall: (() => { const c = row.querySelector('.f-chip.notes').getBoundingClientRect(); return [at(c.left + c.width / 2, rr.top + 1), at(c.left + c.width / 2, rr.bottom - 1)]; })(),
  } : null;
  const name = z.querySelector('.f-name');
  const lh = parseFloat(getComputedStyle(name).lineHeight);
  return {
    card: box(z), vw: innerWidth, vh: innerHeight, parts, doorsOut, cells, reach, content,
    row: row ? box(row) : null, nameLines: Math.round(name.getBoundingClientRect().height / lh),
    links: [...z.querySelectorAll('a.f-link')].map((a) => a.textContent.trim()),
    order: !!z.querySelector('.f-order'), who: !!z.querySelector('.f-who'), spot: !!z.querySelector('.f-chip.spot'),
  };
});

const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

for (const size of SIZES) {
  test(`${size.w}: the most crowded zoom holds every row — nothing clipped, nothing overlapping, every door reachable, the door row on the card's floor`, { skip }, async () => {
    const { ctx, page, errors } = await openGallery(size);
    try {
      for (const artist of CARDS) {
        await grow(ctx, page, artist, size.touch);
        const m = await measure(page);
        const at = `${size.w} ${artist}: ${JSON.stringify(m)}`;
        // It really is the crowded case.
        assert.deepEqual(m.links, ['Tix @ AXS', 'Info @ DoTheBay'], `both doors out — ${at}`);
        assert.ok(m.order && m.who && m.spot, `the order door, the who-row and Spotify — ${at}`);
        if (artist.length > 30) assert.ok(m.nameLines >= 2, `the long bill takes two lines — ${at}`);
        // Inside the screen, with the margins place() keeps.
        assert.ok(m.card.l >= 7.5 && m.card.r <= m.vw - 7.5 && m.card.t >= 0 && m.card.b <= m.vh, `the zoom is on screen — ${at}`);
        // Nothing clipped: every row inside the grown card.
        for (const p of m.parts) {
          assert.ok(p.l >= m.card.l - 0.5 && p.r <= m.card.r + 0.5 && p.t >= m.card.t - 0.5 && p.b <= m.card.b + 0.5, `${p.cls} inside the card — ${at}`);
        }
        // Nothing overlapping.
        for (let i = 0; i < m.parts.length; i += 1) {
          for (let j = i + 1; j < m.parts.length; j += 1) {
            assert.ok(overlap(m.parts[i], m.parts[j]) < 1, `${m.parts[i].cls} and ${m.parts[j].cls} do not overlap — ${at}`);
          }
        }
        // The door row: the card's floor, across the card's content width.
        assert.ok(m.row, `the row is there — ${at}`);
        assert.equal(m.parts[m.parts.length - 1].cls.includes('f-step-row'), true, `the row is the last thing on the card — ${at}`);
        assert.ok(Math.abs(m.row.l - m.content.l) <= 1 && Math.abs(m.row.r - m.content.r) <= 1, `the row spans the content width — ${at}`);
        assert.ok(Math.abs(m.row.b - (m.card.b - 12)) <= 1, `the row sits on the card's floor — ${at}`);
        assert.deepEqual(m.cells.map((c) => c.text), ['−', '2 notes', '+']);
        const [minus, chip, plus] = m.cells;
        // Bare glyphs a smidge (10px) inside the content edges, the same on every card and width.
        assert.ok(Math.abs(minus.glyph.l - (m.content.l + 10)) <= 1.5, `− stands 10px inside the left content edge — ${at}`);
        assert.ok(Math.abs(plus.glyph.r - (m.content.r - 10)) <= 1.5, `+ stands 10px inside the right content edge — ${at}`);
        // Centred on the chip's line.
        const mid = (b) => (b.t + b.b) / 2;
        assert.ok(Math.abs(mid(minus.glyph) - mid(chip)) <= 1.5 && Math.abs(mid(plus.glyph) - mid(chip)) <= 1.5, `− and + centred on the note chip — ${at}`);
        assert.ok(Math.abs(minus.w - plus.w) <= 1.5, `− and + own equal sides — ${at}`);
        assert.ok(Math.abs(minus.r - chip.l) <= 0.5 && Math.abs(chip.r - plus.l) <= 0.5, `the targets meet the chip, no gap — ${at}`);
        assert.ok(Math.abs((chip.l + chip.r) / 2 - (m.content.l + m.content.r) / 2) <= 1.5, `the chip sits in the middle — ${at}`);
        assert.ok(minus.h >= 44 && plus.h >= 44, `− and + are 44px tall — ${at}`);
        assert.ok(m.cells.every((c) => c.hit), `every row door is the thing under its centre — ${at}`);
        // The reach: out to the card's edges and down to its bottom; the chip is its own 44px target.
        assert.equal(m.reach.leftEdge, '−', `the card's left edge beside the row is still − — ${at}`);
        assert.equal(m.reach.rightEdge, '+', `the card's right edge beside the row is still + — ${at}`);
        assert.equal(m.reach.bottomEdge[0], '−', `the card's bottom edge under − is − — ${at}`);
        assert.equal(m.reach.bottomEdge[2], '+', `the card's bottom edge under + is + — ${at}`);
        assert.ok(m.reach.above[0] === '−' && m.reach.above[2] === '+', `just above the row is still − and + — ${at}`);
        assert.deepEqual(m.reach.chipTall, ['2 notes', '2 notes'], `the chip's target is the row's full 44px — ${at}`);
        assert.ok(m.doorsOut.length >= 4 && m.doorsOut.every((d) => d.hit), `every door out is reachable — ${at}`);
        await page.keyboard.press('Escape');
        await sleep(400);
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('390: + and − step the level with the zoom standing; must stops the +', { skip }, async () => {
  const { ctx, page, errors } = await openGallery(SIZES[0]);
  try {
    const artist = CARDS[0];
    await grow(ctx, page, artist, true);
    const level = () => page.evaluate(async (a) => {
      const st = await import('/js/state.js');
      return (st.crewDoc.festivals['gallery-zoom-fest'].selections[a] || {}).Kevin || 0;
    }, artist);
    // The still-hand law: a step never moves the doors under the finger that
    // is stepping — each door is where it was before the tap (a pick used to
    // widen the zoom and slide the + 22px sideways, 2026-09-25).
    const rowAt = () => page.evaluate(() => [...document.querySelectorAll('#zoom-layer .zoom-slot.shown .f-step-row > *')]
      .map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }));
    const tapDoor = async (sel) => {
      const was = await rowAt();
      const b = await page.locator(`#zoom-layer .zoom-slot.shown .f-step-row > ${sel}`).boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await sleep(450);
      assert.deepEqual(await rowAt(), was, `the doors did not move under the finger (${sel})`);
    };
    assert.equal(await level(), 1);
    await tapDoor('.f-step.plus');
    assert.equal(await level(), 2, '+ raised it');
    await tapDoor('.f-step.plus');
    await tapDoor('.f-step.plus');
    assert.equal(await level(), 4, 'up to must');
    assert.equal(await page.locator('#zoom-layer .zoom-slot.shown .f-step.plus').isDisabled(), true, 'and the + stops there');
    await tapDoor('.f-step.minus');
    assert.equal(await level(), 3, '− lowered it');
    assert.equal(await page.locator('#zoom-layer .zoom-slot.shown').count(), 1, 'the zoom stood through every step');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// The still-hand law on the card where it bites: a sparse one, where your
// first pick adds a chip to the who-row. Before the rule, that chip widened
// the zoom and slid the + 22px sideways between two taps (390 walk,
// 2026-09-25) — a fast second tap could land on "+ note".
for (const size of [SIZES[0], SIZES[1]]) {
  test(`${size.w}: a step never moves the doors — your first pick on a sparse card leaves every third where it was`, { skip }, async () => {
    const { ctx, page, errors } = await openGallery(size);
    try {
      const artist = 'Room To Grow'; // three levels by others, you at nothing: + brings a fourth chip
      const at = await page.evaluate((a) => {
        const el = document.querySelector(`#zoom-row-crowded .card[data-artist="${a}"]`);
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }, artist);
      await sleep(250);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
      await sleep(650);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
      await sleep(800);
      const rowAt = () => page.evaluate(() => [...document.querySelectorAll('#zoom-layer .zoom-slot.shown .f-step-row > *')]
        .map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }));
      const who = () => page.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown .f-who .f-pill').length);
      const was = await rowAt();
      const chipsBefore = await who();
      // One place, tapped three times without moving: + + −.
      const plus = was[2];
      const x = (plus[0] + plus[2]) / 2, y = (plus[1] + plus[3]) / 2;
      await page.touchscreen.tap(x, y); await sleep(450);
      assert.ok(await who() > chipsBefore, 'the pick added your chip to the who-row');
      assert.deepEqual(await rowAt(), was, 'the doors stayed put through the chip arriving');
      await page.touchscreen.tap(x, y); await sleep(450);
      assert.deepEqual(await rowAt(), was, 'and through the second +');
      const level = await page.evaluate(async (a) => ((await import('/js/state.js')).crewDoc.festivals['gallery-zoom-fest'].selections[a] || {}).Kevin || 0, artist);
      assert.equal(level, 2, 'both taps landed on +');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
