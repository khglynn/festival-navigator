// The zoom's who-chips, in a real browser (2026-09-23): the width rule is
// layout, and layout is exactly what the Node suite cannot see.
//
// One chip per level anyone chose; inside it the meter's glyph, then first
// names (two at most, then "+n"). A name never wraps, and a chip never
// outgrows its row: at worst its names ellipsize, and the glyph and the "+n"
// always show. The stress case is Kevin's: a crew of fifteen with thirteen in,
// on a 390 phone, tapped with a real finger — plus one absurdly long name.
// Since the tap change (2026-09-26) a finger's tap opens the card's SHELF, whose
// card carries the same who-row (card-facts.js grownBlock) and the same motion
// on a − / + (refreshSheetCard): so on a phone every law here runs on the
// shelf, and the zoom's run where a zoom still grows — a mouse's hover.
//
// It runs with `npm run test:browser`, against the real index.html with a
// made-up crew and /api answered inside the page (nothing leaves it). The
// unit twin is tests/zoom-chips.test.mjs.
//
// Every festival we ship (2026-09-24): the zoom grows out of whatever card it
// is held on, so the same laws run from each wall's own shapes, found in its
// real data file (tests/helpers/fest-shapes.mjs) — Portola's Robyn (a cell)
// and Soulwax (an afters stack), ACL's right-most column and a Late nights
// stack, the lineup-only walls' longest names (EDC Orlando, Seismic), and
// Electric Forest's right-most column and a stack beside its clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, motionDone, NO_BROWSER } from '../helpers/browser.mjs';
import { festData, shapesOf } from '../helpers/fest-shapes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

// Fifteen people; Kevin is you. The long name sits where it is shown (second
// in the ×2 chip, after You), so the chip has to hold it.
const LONG = 'Bartholomew-Maximiliana';
const CREW = ['Kevin', 'Drew', 'Kat', 'Nhu', 'Pegah', 'Ross', 'Sam', 'Hal', 'Ivy', 'Jo', 'Lou', LONG, 'Mary Jane', 'Oli', 'Tess'];
const ROBYN = { Hal: 4, Drew: 4, Lou: 4, Kat: 3, 'Mary Jane': 3, Jo: 3, Kevin: 2, [LONG]: 2, Ivy: 2, Nhu: 2, Pegah: 1, Oli: 1, Tess: 1 };
// The motion walk's card: few enough people that every tap is one named case.
const SOULWAX = { Kevin: 1, Pegah: 3, Drew: 3, Nhu: 4 };

// Where each festival's zoom is held: `busy` cards carry ROBYN's crowd, the
// `motion` card SOULWAX's walk. Portola's are named (Robyn a Saturday cell,
// Soulwax a Thursday afters stack); every other festival's are found by
// shape, so a set-times drop re-aims them rather than breaking them: the
// longest name in the right-most stage column (the cell a scroll carries to
// the screen's edge), the longest name in a stack or a lineup's list, and a
// card of the kind the wall has most of for the walk.
const TARGETS = [
  { fid: 'portola-2026', name: 'Portola', busy: [{ artist: 'Robyn', cell: true }], motion: 'Soulwax' },
  ...['acl-2026', 'edc-orlando-2026', 'seismic-9', 'electric-forest-2026'].map((fid) => {
    const fest = festData(fid);
    const s = shapesOf(fest);
    const onClock = new Set(s.cells);
    const cards = [...s.stacked.filter((n) => !onClock.has(n)), ...s.listed];
    const busy = [];
    if (s.rightmost.length) busy.push({ artist: s.rightmost[0], cell: true });
    if (cards.length) busy.push({ artist: cards[0], cell: false });
    const motion = [...cards, ...s.cells].find((n) => !busy.some((b) => b.artist === n));
    return { fid, name: fest.name, busy, motion };
  }),
];
const doc = (t) => ({
  v: 4, meta: { name: 'Chips', inviteFestId: t.fid }, spotify: {}, affinity: {},
  people: Object.fromEntries(CREW.map((n, i) => [n, { colorIndex: i }])),
  festivals: { [t.fid]: { selections: { ...Object.fromEntries(t.busy.map((b) => [b.artist, ROBYN])), [t.motion]: SOULWAX } } },
});

async function openWall({ width = 390, height = 844, target = TARGETS[0], touch = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
  const TOKEN = 'chipscontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Chips' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
  }, [TOKEN, target.fid]);
  const body = JSON.stringify(doc(target));
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

// A real finger's tap on an artist's resting card: its shelf, the grown
// who-row settled. `cell` picks the timetable cell or a card that is not one,
// for an artist who is both.
async function tapOpen(page, artist, cell = null) {
  const at = await page.evaluate(([a, c]) => {
    const sel = c === true ? '#wall-root .card.cell' : c === false ? '#wall-root .card:not(.cell)' : '#wall-root .card';
    const el = [...document.querySelectorAll(sel)].find((x) => x.dataset.artist === a);
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 24) };
  }, [artist, cell]);
  await sleep(200);
  await page.touchscreen.tap(Math.round(at.x), Math.round(at.y));
  await page.waitForSelector('#artist-sheet .sheet-card .f-who', { timeout: 4000 });
  await sleep(700);
  await motionDone(page, { within: '#artist-sheet' }); // the − and + are measured at rest
}
const SHELF = '#artist-sheet .sheet-card';
const ZOOM = '#zoom-layer .zoom-slot.shown';

// A laptop's route: a real mouse comes to rest on the card, and hover intent
// grows it.
async function hoverOpen(page, artist, cell = null) {
  const at = await page.evaluate(([a, c]) => {
    const sel = c === true ? '#wall-root .card.cell' : c === false ? '#wall-root .card:not(.cell)' : '#wall-root .card';
    const el = [...document.querySelectorAll(sel)].find((x) => x.dataset.artist === a);
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [artist, cell]);
  await sleep(200);
  await page.mouse.move(at.x, at.y, { steps: 8 });
  await page.waitForSelector('#zoom-layer .zoom-slot.shown .f-who', { timeout: 4000 });
  await sleep(700);
}

// The grown who-row, chip by chip — in the zoom or on the shelf's card.
function chipRow(scope) {
  const row = document.querySelector(`${scope} .f-who`);
  const rr = row.getBoundingClientRect();
  return [...row.children].map((c) => {
    const r = c.getBoundingClientRect();
    const more = c.querySelector('.f-more');
    const glyph = c.querySelector('.bars, .must');
    return {
      level: c.dataset.level, label: c.getAttribute('aria-label'), you: c.classList.contains('you'),
      h: r.height, inRow: r.left >= rr.left - 0.5 && r.right <= rr.right + 0.5,
      // One line = every name's centre on the chip's own centre line (the
      // "+n" is set a size smaller, so tops differ; centres do not).
      lines: [...c.querySelectorAll('.f-nm, .f-more')].every((n) => { const b = n.getBoundingClientRect(); return Math.abs((b.top + b.bottom) / 2 - (r.top + r.bottom) / 2) <= 2; }) ? 1 : 2,
      ellipsized: [...c.querySelectorAll('.f-nm')].some((n) => n.scrollWidth > n.clientWidth + 0.5),
      moreShown: more ? more.getBoundingClientRect().width > 0 && more.getBoundingClientRect().right <= r.right : null,
      glyphShown: glyph.getBoundingClientRect().width > 0,
    };
  });
}

// ROBYN's crowd, as the row must draw it: four chips loudest first, each one
// line and inside its row, glyph and "+n" always shown, your chip the ×2 one
// with the long name ellipsized and named in full in the label.
function assertChipRow(m) {
  assert.deepEqual(m.map((c) => c.level), ['4', '3', '2', '1'], `four chips, loudest first: ${JSON.stringify(m)}`);
  for (const c of m) {
    assert.equal(c.lines, 1, `a chip's names sit on one line: ${JSON.stringify(c)}`);
    assert.ok(c.h <= 24, `a chip is one line tall (22px): ${JSON.stringify(c)}`);
    assert.ok(c.inRow, `a chip never outgrows its row: ${JSON.stringify(c)}`);
    assert.ok(c.glyphShown, `the meter's glyph always shows: ${JSON.stringify(c)}`);
    assert.equal(c.moreShown, true, `every chip here has a "+n", and it always shows: ${JSON.stringify(c)}`);
  }
  const mine = m.find((c) => c.you);
  assert.equal(mine.level, '2', 'your chip is the ×2 chip');
  assert.equal(mine.label, `Picked ×2: You, ${'Bartholomew-Maximiliana'}, Ivy and Nhu`, 'the label names everyone in full, even past the ellipsis');
  assert.ok(mine.ellipsized, 'the long name gives way with an ellipsis rather than pushing the chip out');
}

// The glyph-room law (glyphRoom below) on every name the zoom shows.
function assertGlyphRoom(names, where) {
  assert.ok(names.length >= 8, `${where} shows its names: ${names.length}`);
  for (const n of names) {
    assert.ok(n.top >= 2 && n.bottom >= 2, `${where}: "${n.name}" sits inside its clip with room for the halo, top and bottom: ${JSON.stringify(n)}`);
    if (!n.ellipsized) assert.ok(n.left >= 2 && n.right >= 2, `${where}: "${n.name}" has room at its sides: ${JSON.stringify(n)}`);
  }
}

// Every name's glyphs inside the boxes that clip it — its own (the ellipsis)
// and its chip's names box — with room for the halo, top and bottom. A tight
// clip cut descenders and left a hard dark box around each name (review,
// 2026-09-23). Horizontal room is checked only where the name is not
// ellipsized (an ellipsized name overflows its box by design).
function glyphRoom(scope) {
  return [...document.querySelectorAll(`${scope} .f-who .f-nm`)].map((nm) => {
    const range = document.createRange();
    range.selectNodeContents(nm);
    const g = range.getBoundingClientRect();
    const own = nm.getBoundingClientRect();
    const host = nm.closest('.f-names').getBoundingClientRect();
    const ellipsized = nm.scrollWidth > nm.clientWidth + 0.5;
    return {
      name: nm.textContent, ellipsized,
      top: Math.min(g.top - own.top, g.top - host.top), bottom: Math.min(own.bottom - g.bottom, host.bottom - g.bottom),
      left: ellipsized ? null : Math.min(g.left - own.left, g.left - host.left), right: ellipsized ? null : Math.min(own.right - g.right, host.right - g.right),
    };
  });
}

// What each busy zoom is held on, named for the test list.
const heldOn = (t, b) => `${t.name}, ${b.artist} (${b.cell ? 'a timetable cell' : 'a card'})`;

for (const t of TARGETS) for (const b of t.busy) {
  test(`${heldOn(t, b)} — a crew of fifteen at 390, on the shelf a finger opens: four chips, one line each, none past its row, the long name ellipsized`, { skip }, async () => {
    const { ctx, page } = await openWall({ target: t });
    try {
      await tapOpen(page, b.artist, b.cell);
      assertChipRow(await page.evaluate(chipRow, SHELF));
      assert.equal(await page.locator(ZOOM).count(), 0, 'a finger grows no zoom');
    } finally {
      await ctx.close();
    }
  });

  test(`${heldOn(t, b)} — every name keeps its descenders and its halo, on the shelf’s card`, { skip }, async () => {
    const { ctx, page } = await openWall({ target: t });
    try {
      await tapOpen(page, b.artist, b.cell);
      assertGlyphRoom(await page.evaluate(`(${glyphRoom})('${SHELF}')`), 'the shelf’s card');
    } finally {
      await ctx.close();
    }
  });

  test(`${heldOn(t, b)} — at 320 wide the shelf’s card holds the crowd: every chip inside its row, the card inside the screen`, { skip }, async () => {
    const { ctx, page } = await openWall({ width: 320, height: 640, target: t });
    try {
      await tapOpen(page, b.artist, b.cell);
      const m = await page.evaluate((scope) => {
        const card = document.querySelector(scope).getBoundingClientRect();
        const row = document.querySelector(`${scope} .f-who`).getBoundingClientRect();
        const chips = [...document.querySelectorAll(`${scope} .f-who > .f-pill`)].map((c) => { const r = c.getBoundingClientRect(); return { level: c.dataset.level, left: r.left, right: r.right }; });
        const steps = [...document.querySelectorAll(`${scope} .f-step-row > *`)].map((c) => { const r = c.getBoundingClientRect(); return { left: r.left, right: r.right }; });
        return { card: { left: card.left, right: card.right }, vw: window.innerWidth, row: { left: row.left, right: row.right }, chips, steps };
      }, SHELF);
      assert.ok(m.card.left >= 0 && m.card.right <= m.vw, `the card is on screen: ${JSON.stringify(m.card)}`);
      assert.equal(m.chips.length, 4, 'still one chip per level');
      for (const c of m.chips) assert.ok(c.left >= m.row.left - 0.5 && c.right <= m.row.right + 0.5, `a chip never outgrows its row at 320: ${JSON.stringify(c)}`);
      for (const d of m.steps) assert.ok(d.left >= m.card.left - 0.5 && d.right <= m.card.right + 0.5, `− · meter · + inside the card: ${JSON.stringify(d)}`);
    } finally {
      await ctx.close();
    }
  });

  // A narrow window with a mouse (a laptop's split screen, an iPad with a
  // trackpad) still grows the zoom: its box keeps 8px from either edge of a
  // 320 screen, even re-placed mid-bloom.
  test(`${heldOn(t, b)} — at 320 wide a hovered zoom stays on screen: 8px either side, every chip inside its row — even re-placed mid-bloom`, { skip }, async () => {
    const { ctx, page } = await openWall({ width: 320, height: 640, target: t, touch: false });
    try {
      await hoverOpen(page, b.artist, b.cell);
      const measure = () => page.evaluate(() => {
        const slot = document.querySelector('#zoom-layer .zoom-slot.shown');
        const r = slot.getBoundingClientRect();
        const row = slot.querySelector('.f-who').getBoundingClientRect();
        const chips = [...slot.querySelectorAll('.f-who > .f-pill')].map((c) => { const b = c.getBoundingClientRect(); return { level: c.dataset.level, left: b.left, right: b.right }; });
        return { left: r.left, right: r.right, vw: window.innerWidth, row: { left: row.left, right: row.right }, chips };
      });
      let m = await measure();
      assert.ok(m.left >= 8 - 0.5 && m.right <= m.vw - 8 + 0.5, `the zoom keeps 8px from either edge of a 320 screen: ${JSON.stringify(m)}`);
      for (const c of m.chips) assert.ok(c.left >= m.row.left - 0.5 && c.right <= m.row.right + 0.5, `a chip never outgrows its row at 320: ${JSON.stringify(c)}`);
      assert.equal(m.chips.length, 4, 'still one chip per level');
      // A scroll while the zoom is still blooming: the zoom follows its card
      // and is re-placed while its box is scaled down. place() once measured
      // that scaled box, centred it wrong and let the edge clamp pass it —
      // 2-3px past the screen once the bloom finished, on about half the runs
      // (2026-09-23). Held at the bloom's first scale on purpose, so the check
      // is deterministic rather than a race.
      await page.evaluate(() => new Promise((res) => {
        const slot = document.querySelector('#zoom-layer .zoom-slot.shown');
        slot.style.scale = '0.7';
        window.dispatchEvent(new Event('scroll')); // follow() is one re-place per frame
        requestAnimationFrame(() => requestAnimationFrame(() => { slot.style.scale = ''; res(); }));
      }));
      m = await measure();
      assert.ok(m.left >= 8 - 0.5 && m.right <= m.vw - 8 + 0.5, `re-placed mid-bloom, it still lands 8px from either edge: ${JSON.stringify(m)}`);
    } finally {
      await ctx.close();
    }
  });

  // A laptop grows the same card on hover, at the 360px cap — the row's laws,
  // reached by a mouse; its notes door opens the shelf, whose card holds them too.
  test(`${heldOn(t, b)} — a laptop at 1280, by hover: the same chips, one line each, every name with its descenders — and on the shelf its note door opens`, { skip }, async () => {
    const { ctx, page } = await openWall({ width: 1280, height: 800, target: t, touch: false });
    try {
      await hoverOpen(page, b.artist, b.cell);
      assertChipRow(await page.evaluate(chipRow, ZOOM));
      assertGlyphRoom(await page.evaluate(`(${glyphRoom})('${ZOOM}')`), 'the hovered zoom');
      const m = await page.evaluate(() => { const r = document.querySelector('#zoom-layer .zoom-slot.shown').getBoundingClientRect(); return { left: r.left, right: r.right, vw: window.innerWidth }; });
      assert.ok(m.left >= 8 - 0.5 && m.right <= m.vw - 8 + 0.5, `the zoom stays on screen: ${JSON.stringify(m)}`);
      await page.locator(`${ZOOM} .f-step-row .f-chip.notes`).click();
      await page.waitForSelector(`${SHELF} .f-who .f-nm`, { timeout: 4000 });
      await sleep(500);
      assertChipRow(await page.evaluate(chipRow, SHELF));
      const sheet = await page.evaluate(`(${glyphRoom})('${SHELF}')`);
      for (const n of sheet) assert.ok(n.top >= 2 && n.bottom >= 2, `shelf card: "${n.name}" keeps its descenders and halo: ${JSON.stringify(n)}`);
    } finally {
      await ctx.close();
    }
  });
}

// The motion's contract (storyboard: claude-plans/2026-09-23-zoom-chips-motion.md),
// in a real engine, with real taps on the grown card. A FLIP is only right if
// its FIRST frame is the old layout: so at the instant the pick's animations
// start, every name, chip and the title stand exactly where they stood before
// the tap. That one check caught three bugs jsdom never could (2026-09-23):
// the new row measured after its chips' slides began (names that never
// travelled), parked leavers laid out IN FLOW (the whole zoom jumped 6px at
// the tap), and a chip's level glyph that jumped to its new spot while the
// fill was still the old width (it sat outside its own chip).
// Then: the leavers parked in the chip's type, out of flow, and gone at the end.
// The first frame of a pick, and what is left once it settles — in the card
// `scope` names (the zoom's, or the shelf's). `press` makes the pick.
async function walkPick(page, scope, what, lands, press) {
  await page.evaluate((sc) => {
    const card = document.querySelector(sc);
    const m = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const read = () => ({
      names: Object.fromEntries([...card.querySelectorAll('.f-who .f-nm[data-person]')].map((n) => [n.dataset.person, m(n)])),
      chips: Object.fromEntries([...card.querySelectorAll('.f-who > .f-pill')].map((p) => [p.dataset.level, m(p)])),
      more: Object.fromEntries([...card.querySelectorAll('.f-who .f-more')].map((n) => [n.dataset.level, m(n)])),
      glyphs: Object.fromEntries([...card.querySelectorAll('.f-who > .f-pill > .bars, .f-who > .f-pill > .must')].map((g) => [g.parentElement.dataset.level, m(g)])),
      title: m(card.querySelector('.f-name')),
    });
    const before = read();
    window.__firstFrame = new Promise((res) => {
      const mo = new MutationObserver(() => {
        mo.disconnect();
        queueMicrotask(() => {
          const anims = document.getAnimations().filter((a) => !(a instanceof CSSAnimation));
          for (const a of anims) { a.pause(); a.currentTime = 0; }
          const off = [];
          const now = read();
          const cmp = (kind, k, a, b) => { if (a && b && (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1)) off.push(`${kind} ${k}: ${(b.x - a.x).toFixed(1)},${(b.y - a.y).toFixed(1)}`); };
          for (const k of Object.keys(now.names)) cmp('name', k, before.names[k], now.names[k]);
          for (const k of Object.keys(now.chips)) cmp('chip', k, before.chips[k], now.chips[k]);
          for (const k of Object.keys(now.glyphs)) cmp('glyph', k, before.glyphs[k], now.glyphs[k]);
          for (const k of Object.keys(now.more)) cmp('+n', k, before.more[k], now.more[k]);
          const seen = { parkedMore: card.querySelectorAll('.f-more.f-parked').length, parkedNames: card.querySelectorAll('.f-nm.f-parked').length };
          cmp('title', '', before.title, now.title);
          const parked = [...card.querySelectorAll('.f-parked')].map((p) => ({
            cls: p.className, position: getComputedStyle(p).position, fontSize: getComputedStyle(p).fontSize,
          }));
          for (const a of anims) { try { a.finish(); } catch { a.play(); } }
          res({ off, parked, seen });
        });
      });
      mo.observe(card, { childList: true });
    });
  }, scope);
  await press();
  const f = await page.evaluate(() => window.__firstFrame);
  assert.deepEqual(f.off, [], `${what}: at the first frame everything stands where it stood`);
  for (const p of f.parked) {
    assert.equal(p.position, 'absolute', `${what}: a leaver is out of flow (${JSON.stringify(p)})`);
    if (/f-ghost/.test(p.cls)) assert.equal(p.fontSize, '11px', `${what}: a leaving name keeps the chip's type (${JSON.stringify(p)})`);
  }
  await sleep(250);
  const after = await page.evaluate((sc) => {
    const card = document.querySelector(sc);
    const you = card.querySelector('.f-who .f-pill.you');
    return {
      temp: card.querySelectorAll('.f-parked, .f-bud, .f-fill .f-fill, .f-travel').length,
      lifted: [...card.querySelectorAll('.f-names')].filter((n) => n.style.overflow).length,
      you: you ? you.dataset.level : null,
      names: [...card.querySelectorAll('.f-nm[data-person]')].map((n) => n.dataset.person),
    };
  }, scope);
  assert.equal(after.temp, 0, `${what}: nothing temporary outlives the move (${JSON.stringify(after)})`);
  assert.equal(after.lifted, 0, `${what}: every lifted clip is restored`);
  assert.equal(after.you, lands, `${what}: you land at ${lands}`);
  assert.equal(new Set(after.names).size, after.names.length, `${what}: one rendering of every person (${after.names})`);
  return f.seen;
}

for (const t of TARGETS) {
  // A phone: the shelf a finger's tap opens, stepped with − and +, the finger
  // pressing the same spots every time (the row never moves).
  test(`${t.name}, ${t.motion} — on the shelf, a − / + pick's first frame is the old layout, in every case of the walk: carry, merge, both, split, clear, first`, { skip }, async () => {
    const { ctx, page } = await openWall({ target: t });
    try {
      await tapOpen(page, t.motion);
      const spot = async (side) => { const b = await page.locator(`${SHELF} .f-step.${side}`).boundingBox(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; };
      const plus = await spot('plus'), minus = await spot('minus');
      const CASES = [
        ['carry (×1 alone → ×2 alone)', '2', plus],
        ['merge (×2 alone → ×3 with Pegah and Drew)', '3', plus],
        ['both (out of ×3, into Nhu\'s MUST)', '4', plus],
        ['both, back (out of the shared MUST, into ×3)', '3', minus],
        ['split (out of ×3, alone at ×2)', '2', minus],
        ['carry, down (×2 alone → ×1 alone)', '1', minus],
        ['clear (nothing picked)', null, minus],
        ['first pick (nobody at ×1)', '1', plus],
      ];
      const walked = [];
      for (const [what, lands, at] of CASES) walked.push({ what, ...(await walkPick(page, SHELF, what, lands, () => page.touchscreen.tap(at.x, at.y))) });
      assert.ok(walked.some((w) => w.parkedNames > 0) && walked.some((w) => w.parkedMore > 0), `the walk parked names and a "+n": ${JSON.stringify(walked)}`);
      const row = await spot('plus');
      assert.deepEqual(row, plus, 'and the + is where the finger left it');
    } finally {
      await ctx.close();
    }
  });

  // A laptop: the zoom a hover grows, its body clicked — the cycle.
  test(`${t.name}, ${t.motion} — in the hovered zoom, a click's first frame is the old layout, in every case of the walk: carry, merge, both, clear, first`, { skip }, async () => {
    const { ctx, page } = await openWall({ width: 1280, height: 800, target: t, touch: false });
    try {
      await hoverOpen(page, t.motion);
      const CASES = [
        ['carry (×1 alone → ×2 alone)', '2'],
        ['merge (×2 alone → ×3 with Pegah and Drew)', '3'],
        ['both (out of ×3, into Nhu\'s MUST)', '4'],
        ['clear (out of the shared MUST)', null],
        ['first pick (nobody at ×1)', '1'],
      ];
      const walked = [];
      for (const [what, lands] of CASES) walked.push({ what, ...(await walkPick(page, `${ZOOM} .zoom-card`, what, lands, () => page.locator(`${ZOOM} .zoom-card .f-name`).click())) });
      assert.ok(walked.some((w) => w.parkedNames > 0) && walked.some((w) => w.parkedMore > 0), `the walk parked names and a "+n": ${JSON.stringify(walked)}`);
    } finally {
      await ctx.close();
    }
  });
}
