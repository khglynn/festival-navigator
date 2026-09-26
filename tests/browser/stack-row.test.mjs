// The afters under a clock, on a phone, in a real browser (v91, 2026-09-25).
//
// Kevin at Portola: the afters started at the shell's edge while the
// timetable above them starts its columns past the 40px hour rail — "just
// adding a little bit of extra padding that obviously scrolls away if you
// left scroll". On a phone a clocked stack row (wall.js venueGroups,
// `.stack-scroll`) carries the rail as lead space: its columns start at the
// timetable's first two columns, at the one card width, and a swipe carries
// the lead away. jsdom has no layout and no gestures; this is where the
// geometry and the thumb are checked. Chromium's gesture routing, not
// WebKit's: the walk rig in claude-plans/2026-09-25-portola-live
// (v91-walk.mjs) is the long form. The app is booted for real against a
// made-up crew; /api never leaves this page.
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
// WebKit, where installed, for the geometry: iPhones are WebKit, and a grid
// sized to its content inside an overflow box is exactly where engines differ.
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: that case skips */ }
test.after(async () => { if (browser) await browser.close(); if (webkit) await webkit.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

const FID = 'portola-2026';
// Before the festival: no NOW marks, no day-of landing — the wall at rest.
const BEFORE = new Date('2026-09-20T12:00:00-07:00');

async function open(width, { touch = true, engine = browser } = {}) {
  const ctx = await engine.newContext({ viewport: { width, height: 844 }, hasTouch: touch, ...(engine === browser ? { isMobile: touch } : {}), serviceWorkers: 'block' });
  const TOKEN = 'stackrowcontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1'); // the welcome card (v92) is not what this file is about
  }, [TOKEN, FID]);
  const doc = {
    v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 3 } },
    festivals: { [FID]: { selections: { 'Chloé Caillet': { Kevin: 4, Nhu: 2 } } } },
  };
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.setFixedTime(BEFORE);
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .venue-grid').length > 0, null, { timeout: 15000 });
  await sleep(300);
  // `doc` is the crew the route serves: change it and poll, and the app takes
  // it as a real remote change (the wall repaints).
  return { ctx, page, doc };
}

// Each day's timetable columns, and every stack row, as the eye sees them.
const geometry = (page) => page.evaluate(() => {
  const clocks = {};
  for (const g of document.querySelectorAll('#wall-root .tt-block .times-wrap:not(.stage-strip) .times-grid')) {
    const cs = getComputedStyle(g);
    const tracks = cs.gridTemplateColumns.split(' ').map(parseFloat);
    const gap = parseFloat(cs.columnGap) || 0;
    const left = g.getBoundingClientRect().left;
    clocks[g.closest('.day-block').dataset.day] = { cols: [left, left + tracks[0] + gap], width: tracks[0] };
  }
  const rows = [...document.querySelectorAll('#wall-root .venue-grid')].map((vg) => {
    const box = vg.closest('.stack-scroll') || vg;
    const cols = [...new Set([...vg.querySelectorAll('.venue-group')].map((g) => Math.round(g.getBoundingClientRect().left * 2) / 2))];
    return {
      where: `${vg.closest('.day-block').dataset.day} ${vg.closest('.room').dataset.room}`,
      day: vg.closest('.day-block').dataset.day,
      clock: vg.dataset.clock || null,
      venues: vg.querySelectorAll('.venue-group').length,
      cols,
      width: vg.querySelector('.venue-group').getBoundingClientRect().width,
      row: box !== vg,
      overflowX: getComputedStyle(box).overflowX,
      scrolls: box.scrollWidth - box.clientWidth,
      boxLeft: box.getBoundingClientRect().left,
    };
  });
  // A section read by time (v94, Portola's Folsom): its cards, as the eye
  // sees them, and its band heads.
  const lists = [...document.querySelectorAll('#wall-root .time-list')].map((l) => {
    const cards = [...l.querySelectorAll('.card')].map((c) => c.getBoundingClientRect());
    return {
      where: `${l.closest('.day-block').dataset.day} ${l.closest('.room').dataset.room}`,
      day: l.closest('.day-block').dataset.day,
      clock: l.dataset.clock || null,
      cols: [...new Set(cards.map((r) => Math.round(r.left * 2) / 2))].sort((a, b) => a - b),
      widths: [...new Set(cards.map((r) => Math.round(r.width * 2) / 2))],
      right: Math.max(...cards.map((r) => r.right)),
      heads: [...new Set([...l.querySelectorAll('.band-head')].map((h) => Math.round(h.getBoundingClientRect().left * 2) / 2))],
      most: Math.max(...[...l.querySelectorAll('.band-grid')].map((b) => b.children.length)),
      inRow: !!l.closest('.stack-scroll'),
      scrolls: l.scrollWidth - l.clientWidth,
    };
  });
  const shell = document.querySelector('#wall-root').getBoundingClientRect();
  const shellLeft = shell.left;
  return { clocks, rows, lists, shellLeft, shellRight: shell.right, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});

const phoneCases = [
  ...[320, 390, 430].map((width) => ({ width, engine: browser, name: `${width}px phone`, skip })),
  { width: 390, engine: webkit, name: 'WebKit, 390px phone', skip: webkit ? false : 'WebKit not installed (npx playwright install webkit)' },
];
for (const { width, engine, name, skip: why } of phoneCases) {
  test(`${name}: every stack under a clock starts at the clock's columns, at the one card width, and scrolls away only the lead`, { skip: why }, async () => {
    const { ctx, page } = await open(width, { engine });
    try {
      const g = await geometry(page);
      assert.equal(g.pageOverflow, 0, 'the page itself never scrolls sideways');
      const clocked = g.rows.filter((r) => r.clock);
      // Saturday's leftovers and the afters on Saturday and Sunday (Folsom
      // reads by time since v94, below).
      assert.ok(clocked.length >= 3, `Portola's clocked rows are on the wall (${clocked.length})`);
      // The lead scrolls away by exactly the rail and the clock's gap less the
      // shell's gap: the tokens' own arithmetic (v3-tokens.css).
      const lead = 40 + 4 - 6;
      for (const r of clocked) {
        const clock = g.clocks[r.day];
        assert.ok(clock, `${r.where}: a clock above it`);
        assert.ok(r.row && r.overflowX === 'auto', `${r.where}: its own sideways row`);
        assert.ok(Math.abs(r.width - clock.width) < 0.5, `${r.where}: the one card width (${r.width} vs the clock's ${clock.width})`);
        assert.ok(Math.abs(r.cols[0] - clock.cols[0]) < 0.75, `${r.where}: first column at the clock's first (${r.cols[0]} vs ${clock.cols[0]})`);
        if (r.venues > 1) {
          assert.equal(r.cols.length, 2, `${r.where}: two across, wrapping, never a one-by-one strip`);
          assert.ok(Math.abs(r.cols[1] - clock.cols[1]) < 0.75, `${r.where}: second column at the clock's second (${r.cols[1]} vs ${clock.cols[1]})`);
          assert.ok(Math.abs(r.scrolls - lead) <= 1, `${r.where}: scrolls the lead space only (${r.scrolls}px, want ${lead})`);
        } else {
          assert.equal(r.scrolls, 0, `${r.where}: one venue fits beside the lead and never scrolls`);
        }
      }
      // A section read by time (v94) never steps in or scrolls sideways on a
      // phone, clock or no clock: a time list is read ACROSS, and a sideways
      // row would park half of every pair off the screen. Two columns at the
      // one card width, edge to edge in the shell, band heads on its edge.
      assert.ok(g.lists.length >= 3, `Folsom's three nights read by time (${g.lists.length})`);
      const cardW = Object.values(g.clocks)[0].width;
      for (const l of g.lists) {
        assert.ok(!l.inRow && l.scrolls <= 0, `${l.where}: never a sideways row`);
        assert.equal(l.cols.length, Math.min(2, l.most), `${l.where}: two across wherever a band has two (${l.cols})`);
        assert.ok(Math.abs(l.cols[0] - g.shellLeft) < 0.75, `${l.where}: starts at the shell's edge (${l.cols[0]} vs ${g.shellLeft})`);
        assert.ok(l.widths.length === 1 && Math.abs(l.widths[0] - cardW) < 0.75, `${l.where}: the one card width (${l.widths} vs ${cardW})`);
        assert.ok(l.right <= g.shellRight + 0.5, `${l.where}: nothing past the shell (${l.right} vs ${g.shellRight})`);
        assert.deepEqual(l.heads, [l.cols[0]], `${l.where}: every band head on the list's edge`);
      }
      // A day with no clock (Thursday, Friday) is exactly as it was.
      const bare = g.rows.filter((r) => !r.clock);
      assert.ok(bare.length >= 2, 'the unclocked nights are on the wall');
      for (const r of bare) {
        assert.ok(!r.row && r.overflowX === 'visible' && r.scrolls === 0, `${r.where}: no row, nothing scrolls`);
        assert.ok(Math.abs(r.cols[0] - g.shellLeft) < 0.75, `${r.where}: starts at the shell's edge (${r.cols[0]} vs ${g.shellLeft})`);
      }
    } finally {
      await ctx.close();
    }
  });
}

test('1280px desktop: the row is an ordinary box — nothing scrolls, and v90\'s lining up stands', { skip }, async () => {
  const { ctx, page } = await open(1280, { touch: false });
  try {
    const g = await geometry(page);
    for (const r of g.rows.filter((x) => x.clock)) {
      assert.equal(r.overflowX, 'visible', `${r.where}: not a scroller on a desktop`);
      assert.equal(r.scrolls, 0, `${r.where}`);
      assert.ok(Math.abs(r.cols[0] - g.clocks[r.day].cols[0]) < 0.75, `${r.where}: under the clock's first column`);
    }
    // By time (v94): under a clock, column n sits under the clock's column n;
    // without one (Friday), the list starts at the shell's edge.
    assert.ok(g.lists.length >= 3, 'Folsom reads by time');
    for (const l of g.lists) {
      assert.equal(l.cols.length, Math.min(5, l.most), `${l.where}: as many across as the busiest band has, five at 1280 (${l.cols})`);
      if (l.clock) {
        const c = g.clocks[l.day];
        l.cols.slice(0, 2).forEach((x, i) => assert.ok(Math.abs(x - c.cols[i]) < 0.75, `${l.where}: column ${i + 1} under the clock's (${x} vs ${c.cols[i]})`));
        assert.ok(Math.abs(l.widths[0] - c.width) < 0.75, `${l.where}: the clock's card width`);
      } else {
        assert.ok(Math.abs(l.cols[0] - g.shellLeft) < 0.75, `${l.where}: at the shell's edge`);
      }
      assert.deepEqual(l.heads, [l.cols[0]], `${l.where}: band heads on the list's edge`);
      assert.ok(l.right <= g.shellRight + 0.5, `${l.where}: nothing past the shell`);
    }
  } finally {
    await ctx.close();
  }
});

// A finger, frame by frame: the browser decides who takes the gesture.
async function swipe(cdp, x, y, dx, dy, steps = 12) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] });
  }
  await sleep(16);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(900); // any fling settles
}
const AFTERS = '#wall-root .day-block[data-day="Saturday"] .room[data-room="Afters"] .stack-scroll';
const state = (page) => page.evaluate((sel) => {
  const tt = (day) => document.querySelector(`#wall-root .day-block[data-day="${day}"] .tt-block .times-wrap:not(.stage-strip) .times-scroll`);
  const folsom = document.querySelector('#wall-root .day-block[data-day="Saturday"] .room[data-room="Folsom"] .stack-scroll');
  return {
    // (A by-time SAT FOLSOM, v94, is no row at all: nothing to move.)
    y: scrollY, row: document.querySelector(sel).scrollLeft, folsom: folsom ? folsom.scrollLeft : 0,
    sat: tt('Saturday').scrollLeft, sun: tt('Sunday').scrollLeft,
    strip: new DOMMatrix(getComputedStyle(document.querySelector('#wall-root .day-block[data-day="Saturday"] .stage-strip .times-grid')).transform).m41,
  };
}, AFTERS);
// The visible middle of an artist's card in SAT AFTERS — the part a thumb can reach.
const cardIn = (page, artist) => page.evaluate(([sel, a]) => {
  const row = document.querySelector(sel);
  const el = [...row.querySelectorAll('.card')].find((c) => c.dataset.artist === a);
  const r = el.getBoundingClientRect(), clip = row.getBoundingClientRect();
  return { x: (Math.max(r.left, clip.left) + Math.min(r.right, clip.right)) / 2, y: r.top + r.height / 2, left: r.left, right: r.right };
}, [AFTERS, artist]);
async function holdZoom(ctx, page, at) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
  // Held until the card grows, as a finger does (the long-press timer can run
  // late under the fixed clock on a big wall — zoom-chips-contract).
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 5000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
  const z = await page.evaluate(() => {
    const r = document.querySelector('#zoom-layer .zoom-slot.shown').getBoundingClientRect();
    return { artist: document.querySelector('#wall-root .card.zoom-source')?.dataset.artist, left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth };
  });
  await cdp.detach();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#zoom-layer .zoom-slot.shown'), null, { timeout: 5000 });
  return z;
}

test('390px, real touch: a sideways swipe carries SAT AFTERS\' lead away and moves nothing else; a thumb going down the page is the page\'s; the zoom opens over the edge card before and after', { skip }, async () => {
  const { ctx, page } = await open(390);
  try {
    const cdp = await ctx.newCDPSession(page);
    await page.locator(AFTERS).evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + scrollY - 260));
    await sleep(300);
    const rest = await state(page);
    assert.deepEqual([rest.row, rest.folsom, rest.sat, rest.sun], [0, 0, 0, 0], 'at rest, every row and timetable at its start');

    // The right-hand card runs off the screen at rest; its zoom does not.
    const edge = await cardIn(page, 'Chloé Caillet');
    assert.ok(edge.right > 390, `the right-hand card runs off the edge at rest (${edge.right})`);
    let z = await holdZoom(ctx, page, edge);
    assert.equal(z.artist, 'Chloé Caillet');
    assert.ok(z.left >= 7.5 && z.right <= z.vw - 7.5, `the zoom stands on the screen (${z.left}..${z.right})`);

    // Sideways, on the row: the lead scrolls away and only the lead.
    const first = await cardIn(page, 'Velvet Trip');
    await swipe(cdp, first.x, first.y, -120, -3);
    const swiped = await state(page);
    assert.equal(swiped.row, 38, 'SAT AFTERS scrolled to its end: the lead is gone');
    assert.ok(Math.abs(swiped.y - rest.y) <= 1, `the page did not move (${rest.y} -> ${swiped.y})`);
    assert.deepEqual([swiped.folsom, swiped.sat, swiped.sun, swiped.strip], [0, 0, 0, 0], 'no other row, no timetable, and not the stage strip');
    z = await holdZoom(ctx, page, await cardIn(page, 'Chloé Caillet'));
    assert.equal(z.artist, 'Chloé Caillet', 'the zoom still opens on the card after the swipe');
    assert.ok(z.left >= 7.5 && z.right <= z.vw - 7.5, `and stands on the screen (${z.left}..${z.right})`);

    // Down the page, started on a stack card, with a thumb's drift: the page
    // takes it — the row never does.
    for (const [dx, dy] of [[0, -240], [-14, -240], [-60, -200]]) {
      await page.locator(AFTERS).evaluate((n) => { n.scrollLeft = 0; window.scrollTo(0, n.getBoundingClientRect().top + scrollY - 260); });
      await sleep(250);
      const at = await cardIn(page, 'Parcels');
      const before = await state(page);
      await swipe(cdp, at.x, at.y, dx, dy);
      const after = await state(page);
      assert.ok(after.y - before.y > 100, `(dx ${dx}, dy ${dy}): the page scrolled (${after.y - before.y}px)`);
      assert.equal(after.row, 0, `(dx ${dx}, dy ${dy}): the row did not`);
    }
  } finally {
    await ctx.close();
  }
});

// The review's two other cases (2026-09-25).
test('390, real touch: a row swiped sideways stays swiped when a crew-mate\'s pick repaints the wall', { skip }, async () => {
  const { ctx, page, doc } = await open(390);
  try {
    const cdp = await ctx.newCDPSession(page);
    await page.locator(AFTERS).evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + scrollY - 260));
    await sleep(300);
    const first = await cardIn(page, 'Velvet Trip');
    await swipe(cdp, first.x, first.y, -120, -3);
    assert.equal((await state(page)).row, 38, 'swiped to the end');
    await page.locator(AFTERS).evaluate((n) => { n.__before = true; });
    doc.festivals[FID].selections['Velvet Trip'] = { Nhu: 3 };
    await page.evaluate(() => import('/js/sync.js').then((s) => s.pollSync()));
    await page.waitForFunction((sel) => { const n = document.querySelector(sel); return n && !n.__before; }, AFTERS, { timeout: 10000 });
    await sleep(200);
    const after = await state(page);
    assert.equal(after.row, 38, 'the new row stands where the old one was left');
    assert.equal(after.folsom, 0, 'and its neighbour where it was');
  } finally {
    await ctx.close();
  }
});

test('390, real touch: a hold on a card in the row\'s last line — the right-hand one, just above the dock — opens the zoom on screen', { skip }, async () => {
  const { ctx, page } = await open(390);
  try {
    // The row's last line of venues (two across), its right-hand venue, and
    // that venue's last card.
    const artist = await page.evaluate((sel) => {
      const groups = [...document.querySelector(sel).querySelectorAll('.venue-group')];
      const right = groups[groups.length % 2 ? groups.length - 2 : groups.length - 1];
      return [...right.querySelectorAll('.card')].pop().dataset.artist;
    }, AFTERS);
    // Its bottom 16px above the dock: the zoom has a floor to clear.
    await page.evaluate(([sel, a]) => {
      const card = [...document.querySelector(sel).querySelectorAll('.card')].find((c) => c.dataset.artist === a);
      const dock = document.getElementById('dock').getBoundingClientRect().top;
      window.scrollBy(0, card.getBoundingClientRect().bottom - (dock - 16));
    }, [AFTERS, artist]);
    await sleep(300);
    const at = await cardIn(page, artist);
    assert.ok(at.right > 390, `the right-hand card, running off the screen at rest (${artist}: ${at.left}..${at.right})`);
    const z = await holdZoom(ctx, page, at);
    const dockTop = await page.evaluate(() => document.getElementById('dock').getBoundingClientRect().top);
    assert.equal(z.artist, artist, `the zoom is ${artist}'s`);
    assert.ok(z.left >= 7.5 && z.right <= z.vw - 7.5, `across, on the screen (${z.left}..${z.right})`);
    assert.ok(z.top >= 0 && z.bottom <= dockTop - 7.5, `and clear of the dock (${z.top}..${z.bottom}, dock at ${dockTop})`);
  } finally {
    await ctx.close();
  }
});
