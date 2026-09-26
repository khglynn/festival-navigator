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

// `holdFont`: Inter's file is held back until releaseFont(), so the page
// paints in the fallback font first (font-display: swap), as a slow phone does.
async function openGallery({ w, h, touch }, { holdFont = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const held = [];
  let released = false;
  if (holdFont) {
    await ctx.route('**/inter-var-latin.woff2', (route) => { if (released) route.continue(); else held.push(route); });
  }
  const releaseFont = async () => { released = true; for (const r of held.splice(0)) await r.continue(); };
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${server.origin}/gallery.html`, { waitUntil: holdFont ? 'domcontentloaded' : 'load' });
  await page.waitForSelector('#zoom-row-crowded .card', { state: 'visible', timeout: 15000 });
  return { ctx, page, errors, releaseFont };
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
  // Every statement on one line, every pair either one line (its separator
  // showing) or stacked (no separator), and the middle in its column.
  const statements = [...z.querySelectorAll('.f-when, a.f-order, .f-where, a.f-link, .f-links')].map((e) => {
    const r = e.getBoundingClientRect();
    return { text: e.textContent.trim(), h: r.height, lh: parseFloat(getComputedStyle(e).fontSize) * 1.6 };
  });
  const pairs = [...z.querySelectorAll('.f-pair')].map((p) => {
    const items = [...p.children].filter((c) => !c.classList.contains('f-sep'));
    const mids = items.map((c) => { const r = c.getBoundingClientRect(); return (r.top + r.bottom) / 2; });
    const sep = p.querySelector('.f-sep');
    return { cls: p.className, oneLine: Math.max(...mids) - Math.min(...mids) < 6, sepShown: !!sep && getComputedStyle(sep).display !== 'none', w: p.getBoundingClientRect().width };
  });
  const middle = [z.querySelector('.f-name'), ...z.querySelector('.f-grown').children].map((e) => { const r = e.getBoundingClientRect(); return { cls: e.className.split(' ')[0], w: r.width, mid: (r.left + r.right) / 2 }; });
  const colW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom-col'));
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
    card: box(z), vw: innerWidth, vh: innerHeight, parts, doorsOut, cells, reach, content, statements, pairs, middle, colW,
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
        // (Friday's shows carry no price — the check priced only nights still to come — so its door reads a bare Tix.)
        assert.deepEqual(m.links, ['Tix', 'Info'], `both doors out — ${at}`);
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
        // Never a break inside a statement (Kevin, 2026-09-26); a pair is one
        // line with its separator, or stacked without it — never a dot left
        // at a line's end.
        for (const st of m.statements) assert.ok(st.h <= st.lh, `"${st.text}" is on one line — ${at}`);
        for (const p of m.pairs) assert.equal(p.sepShown, p.oneLine, `${p.cls}: separator only on one line — ${at}`);
        if (size.w >= 390) assert.equal(m.pairs.find((p) => p.cls.includes('f-sub')).oneLine, true, `the window and the order share a line on a ${size.w} zoom — ${at}`);
        // The middle stands in its column, centred; only the − and + reach the edges.
        const centre = (m.content.l + m.content.r) / 2;
        for (const e of m.middle) {
          assert.ok(e.w <= m.colW + 0.5, `${e.cls} within the ${m.colW}px column — ${at}`);
          assert.ok(Math.abs(e.mid - centre) <= 1.5, `${e.cls} centred — ${at}`);
        }
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

// The pairs are refit while a zoom stands (the re-review of a73df70): a
// rotation or a resized window changes how wide a finger's zoom may be, and
// Inter landing after the zoom opened draws every statement wider — the
// fitted layout from the moment it opened must not outlive either.
const pairState = (page) => page.evaluate(() => {
  const z = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
  if (!z) return null;
  const r = z.getBoundingClientRect();
  const pairs = [...z.querySelectorAll('.f-pair')].map((p) => {
    const items = [...p.children].filter((c) => !c.classList.contains('f-sep'));
    const mids = items.map((c) => { const b = c.getBoundingClientRect(); return (b.top + b.bottom) / 2; });
    const sep = p.querySelector('.f-sep');
    return {
      cls: p.className, oneLine: Math.max(...mids) - Math.min(...mids) < 6,
      sepShown: !!sep && getComputedStyle(sep).display !== 'none',
      overflow: p.scrollWidth > p.clientWidth + 0.5,
    };
  });
  return { left: r.left, right: r.right, vw: innerWidth, pairs, sub: pairs.find((p) => p.cls.includes('f-sub')) };
});
const assertPairsHonest = (s, at) => {
  for (const p of s.pairs) {
    assert.equal(p.sepShown, p.oneLine, `${p.cls}: its separator shows only on one line — ${at}`);
    assert.equal(p.overflow, false, `${p.cls}: nothing runs past its column — ${at}`);
  }
};
async function holdOpen(ctx, page, artist = CARDS[0]) {
  const at = await page.evaluate((a) => {
    const el = document.querySelector(`#zoom-row-crowded .card[data-artist="${a}"]`);
    el.scrollIntoView({ block: 'center', inline: 'start' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + Math.min(r.width / 2, 60)), y: Math.round(r.top + r.height / 2) };
  }, artist);
  await sleep(250);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
  await sleep(650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(800);
}

test('a standing zoom refits when the screen changes width: the pair restacks, the zoom stays on screen, and comes back', { skip }, async () => {
  const { ctx, page, errors } = await openGallery(SIZES[0]);
  try {
    await holdOpen(ctx, page);
    let s = await pairState(page);
    assert.equal(s.sub.oneLine, true, 'at 390 the window and the order share a line');
    // Narrower than the pair's line (its column falls under 291px): it must stack.
    await page.setViewportSize({ width: 330, height: 844 });
    await sleep(300);
    s = await pairState(page);
    assert.ok(s, 'the zoom still stands');
    assert.ok(s.right <= s.vw - 7.5 && s.left >= 7.5, `the zoom fits the narrower screen (${s.left}–${s.right} in ${s.vw})`);
    assert.equal(s.sub.oneLine, false, 'the pair restacked');
    assertPairsHonest(s, '330');
    // And back.
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(300);
    s = await pairState(page);
    assert.equal(s.sub.oneLine, true, 'back at 390 the pair shares a line again');
    assertPairsHonest(s, '390 again');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a standing zoom refits when Inter lands after it opened', { skip }, async (t) => {
  // Measured, not assumed: the pair's one-line width in the fallback font and
  // in Inter. A viewport is chosen whose column sits between them, so the two
  // fonts disagree about the pair — the case a stale fit gets wrong.
  const lineWidth = async (holdFont) => {
    const { ctx, page } = await openGallery(SIZES[0], { holdFont });
    try {
      await holdOpen(ctx, page);
      return await page.evaluate(() => {
        const p = document.querySelector('#zoom-layer .zoom-slot.shown .f-pair.f-sub');
        const was = p.classList.contains('inline');
        p.classList.add('inline');
        p.style.maxWidth = 'none';
        const w = p.scrollWidth;
        p.style.maxWidth = '';
        if (!was) p.classList.remove('inline');
        return w;
      });
    } finally { await ctx.close(); }
  };
  const wFallback = await lineWidth(true);
  const wInter = await lineWidth(false);
  t.diagnostic(`the pair's one line: ${wFallback}px in the fallback font, ${wInter}px in Inter`);
  if (Math.abs(wFallback - wInter) < 8 || Math.max(wFallback, wInter) > 300) {
    t.skip(`this engine draws the fallback within 8px of Inter (${wFallback} vs ${wInter}), or wider than the column: nothing to disagree about`);
    return;
  }
  const column = Math.round((wFallback + wInter) / 2); // between the two
  const vw = column + 28 + 16;                         // a finger's zoom: the screen less 16, its padding 28
  const { ctx, page, errors, releaseFont } = await openGallery({ ...SIZES[0], w: vw }, { holdFont: true });
  try {
    await holdOpen(ctx, page);
    let s = await pairState(page);
    assert.equal(s.sub.oneLine, wFallback <= column, `opened in the fallback font: laid out for it (${wFallback}px in a ${column}px column)`);
    assertPairsHonest(s, 'fallback');
    await releaseFont();
    await page.waitForFunction(() => document.fonts.check('600 11.5px Inter'), null, { timeout: 5000 });
    await sleep(300);
    s = await pairState(page);
    assert.equal(s.sub.oneLine, wInter <= column, `Inter landed: refit for it (${wInter}px in a ${column}px column)`);
    assertPairsHonest(s, 'Inter');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
