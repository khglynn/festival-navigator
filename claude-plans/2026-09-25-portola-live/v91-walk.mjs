// v91 item 1 walk (2026-09-25): the phone afters under a clock, in a real
// browser. Boots the real app on Portola for a made-up crew (/api answered
// here, never production), and at each width reports where the timetable's
// first column starts and where every stack on a clock day starts, whether
// the stacks scroll sideways and by how much, and shoots the join between a
// day's timetable and its afters. Run from the worktree:
//   node claude-plans/2026-09-25-portola-live/v91-walk.mjs <label> [widths...]
// e.g. `before 320 390 430`. The report and shots land in v91-shots/
// (git-ignored). Nothing here touches a real crew.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'v91-shots');
fs.mkdirSync(OUT, { recursive: true });
const { serveStatic } = await import('../../tests/helpers/static-server.mjs');
const { launchBrowser } = await import('../../tests/helpers/browser.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [label = 'walk', ...ws] = process.argv.slice(2);
const WIDTHS = ws.length ? ws.map(Number) : [320, 390, 430];
const FID = 'portola-2026';
const TOKEN = 'v91walk_0123456789abcdef'; // made up; never a real crew
const doc = {
  v: 4, meta: { name: 'Walk', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 3 }, Kat: { colorIndex: 5 } },
  festivals: { [FID]: { selections: {
    'Chloé Caillet': { Kevin: 4, Nhu: 2 }, Overmono: { Kat: 3 }, 'Fcukers': { Kevin: 2 }, Robyn: { Nhu: 4, Kat: 1 },
  } } },
};

const server = await serveStatic(WT);
const browser = await launchBrowser();
const report = [];
const note = (s) => { report.push(s); console.log(s); };

export async function openPhone(width, { now = '2026-09-20T12:00:00-07:00' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Walk' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN, FID]);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(`PAGEERROR ${e.message}`));
  if (now) await page.clock.setFixedTime(new Date(now));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .venue-grid').length > 0, null, { timeout: 15000 });
  await sleep(400);
  return { ctx, page };
}

// Every stack row on the wall: its day, room, clock tag, where its first
// column starts, its box, and whether (and how far) it scrolls sideways.
const measure = (page) => page.evaluate(() => {
  const out = { grids: {}, stacks: [] };
  for (const g of document.querySelectorAll('#wall-root .tt-block .times-wrap:not(.stage-strip) .times-grid')) {
    const day = g.closest('.day-block').dataset.day;
    const sc = g.closest('.times-scroll');
    const left = g.getBoundingClientRect().left;
    const tracks = getComputedStyle(g).gridTemplateColumns.split(' ').map(parseFloat);
    const gap = parseFloat(getComputedStyle(g).columnGap) || 0;
    const cols = tracks.slice(0, 3).map((_, i) => Math.round(left + tracks.slice(0, i).reduce((a, b) => a + b + gap, 0)));
    out.grids[day] = { cols, scrollerRight: Math.round(sc.getBoundingClientRect().right), overflow: sc.scrollWidth - sc.clientWidth };
  }
  for (const vg of document.querySelectorAll('#wall-root .venue-grid')) {
    const day = vg.closest('.day-block')?.dataset.day;
    const room = vg.closest('.room')?.dataset.room;
    const groups = [...vg.querySelectorAll(':scope > .venue-group, :scope > * > .venue-group')];
    const sc = vg.closest('.stack-scroll') || vg;
    const r = sc.getBoundingClientRect();
    const cs = getComputedStyle(sc);
    out.stacks.push({
      day, room, clock: vg.dataset.clock || null,
      venues: groups.length,
      cols: [...new Set(groups.map((g) => Math.round(g.getBoundingClientRect().left)))],
      colW: groups.length ? Math.round(groups[0].getBoundingClientRect().width) : null,
      box: [Math.round(r.left), Math.round(r.right)],
      overflowX: cs.overflowX, scrolls: sc.scrollWidth - sc.clientWidth, row: sc !== vg,
    });
  }
  out.pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return out;
});

// Shoot the join: from a little above the room's head to a screen below it.
async function shootRoom(page, day, room, name, { above = 180, height = 620, inner = '' } = {}) {
  const sel = `#wall-root .day-block[data-day="${day}"] .room[data-room="${room}"]${inner}`;
  const el = page.locator(sel).first();
  if (!(await el.count())) { note(`  (no ${day} ${room}${inner} on this wall)`); return; }
  await el.evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY - 200));
  await sleep(250);
  const b = await el.boundingBox();
  const vw = page.viewportSize().width;
  await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: Math.max(0, b.y - above), width: vw, height } });
}

// ---- the touch walk (`touch`): real touch input through CDP at 390 ----------
// A swipe is a finger: touchStart, a move every frame, touchEnd — the browser
// turns it into a gesture scroll exactly as it does a thumb's, deciding which
// scroller (or the page) takes it. Chromium's decision, not WebKit's: say so.
async function swipe(cdp, x, y, dx, dy, { steps = 12, frame = 16 } = {}) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await sleep(frame);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] });
  }
  await sleep(frame);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // Let any fling settle: the page and every scroller hold still for 200ms.
  let last = '';
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    const now = JSON.stringify(await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify([scrollY, ...[...document.querySelectorAll(".stack-scroll, .times-scroll")].map((s) => s.scrollLeft)])', returnByValue: true }));
    if (now === last) break;
    last = now;
  }
}
const ROW = (day, room) => `#wall-root .day-block[data-day="${day}"] .room[data-room="${room}"] .stack-scroll`;
const where = (page) => page.evaluate((sel) => {
  const row = document.querySelector(sel);
  const tt = document.querySelector('#wall-root .day-block[data-day="Saturday"] .tt-block .times-wrap:not(.stage-strip) .times-scroll');
  const sun = document.querySelector('#wall-root .day-block[data-day="Sunday"] .tt-block .times-wrap:not(.stage-strip) .times-scroll');
  const strip = document.querySelector('#wall-root .day-block[data-day="Saturday"] .stage-strip .times-grid');
  const folsom = document.querySelector('#wall-root .day-block[data-day="Saturday"] .room[data-room="Folsom"] .stack-scroll');
  return { y: Math.round(scrollY), row: Math.round(row.scrollLeft), folsom: Math.round(folsom.scrollLeft), sat: Math.round(tt.scrollLeft), sun: Math.round(sun.scrollLeft), strip: getComputedStyle(strip).transform };
}, ROW('Saturday', 'Afters'));
const cardAt = (page, artist, sel) => page.evaluate(([a, s]) => {
  const el = [...document.querySelectorAll(`${s} .card`)].find((c) => c.dataset.artist === a);
  const r = el.getBoundingClientRect();
  const clip = el.closest('.stack-scroll, .times-scroll').getBoundingClientRect();
  const left = Math.max(r.left, clip.left), right = Math.min(r.right, clip.right);
  return { x: (left + right) / 2, y: r.top + r.height / 2, left: r.left, right: r.right };
}, [artist, sel]);
async function hold(ctx, page, at) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
  const z = await page.evaluate(() => {
    const slot = document.querySelector('#zoom-layer .zoom-slot.shown').getBoundingClientRect();
    const src = document.querySelector('#wall-root .card.zoom-source');
    return { artist: src && src.dataset.artist, left: Math.round(slot.left), right: Math.round(slot.right), top: Math.round(slot.top), bottom: Math.round(slot.bottom), vw: innerWidth };
  });
  await cdp.detach();
  return z;
}
async function touchWalk() {
  const { ctx, page } = await openPhone(390);
  const cdp = await ctx.newCDPSession(page);
  const shot = (name) => page.screenshot({ path: path.join(OUT, `touch-${name}.png`) });
  try {
    // Stand with SAT AFTERS' first cards mid-screen.
    await page.locator(ROW('Saturday', 'Afters')).evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + scrollY - 260));
    await sleep(300);
    note(`\n== touch walk @ 390 (Chromium, CDP touch)`);
    note(`at rest: ${JSON.stringify(await where(page))}`);
    await shot('1-rest');

    // The zoom over the right-hand card at rest: its right edge is off the screen.
    const afters = ROW('Saturday', 'Afters');
    const chloe = await cardAt(page, 'Chloé Caillet', afters);
    note(`Chloé Caillet's afters card at rest spans x=${Math.round(chloe.left)}..${Math.round(chloe.right)} (screen 390)`);
    let z = await hold(ctx, page, chloe);
    note(`hold at rest -> zoom of ${z.artist}, x=${z.left}..${z.right} (vw ${z.vw}) ${z.left >= 8 && z.right <= z.vw - 8 ? 'ON SCREEN' : 'OFF SCREEN'}`);
    await shot('2-zoom-edge-at-rest');
    await page.keyboard.press('Escape');
    await sleep(400);

    // A sideways swipe on the row: the lead space scrolls away.
    const velvet = await cardAt(page, 'Velvet Trip', afters);
    let before = await where(page);
    await swipe(cdp, velvet.x, velvet.y, -120, -3);
    let after = await where(page);
    note(`sideways swipe on SAT AFTERS (dx -120, dy -3): ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    await shot('3-swiped');
    // The zoom after the swipe, on the same card, now whole on screen.
    const chloe2 = await cardAt(page, 'Chloé Caillet', afters);
    z = await hold(ctx, page, chloe2);
    note(`hold after the swipe (card x=${Math.round(chloe2.left)}..${Math.round(chloe2.right)}) -> zoom of ${z.artist}, x=${z.left}..${z.right} ${z.left >= 8 && z.right <= z.vw - 8 ? 'ON SCREEN' : 'OFF SCREEN'}`);
    await shot('4-zoom-after-swipe');
    await page.keyboard.press('Escape');
    await sleep(400);

    // Swipe it back, then the gestures a thumb makes going DOWN the page,
    // started on a stack card — and the same started on the timetable.
    await swipe(cdp, velvet.x, velvet.y, 120, 3);
    note(`swiped back: ${JSON.stringify(await where(page))}`);
    for (const [name, dx, dy] of [['straight up', 0, -260], ['thumb drift', -14, -260], ['diagonal ~17deg', -60, -200], ['diagonal ~27deg', -100, -200]]) {
      await page.locator(ROW('Saturday', 'Afters')).evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + scrollY - 260));
      await page.evaluate((sel) => { document.querySelector(sel).scrollLeft = 0; }, afters);
      await sleep(250);
      const v = await cardAt(page, 'Velvet Trip', afters);
      before = await where(page);
      await swipe(cdp, v.x, v.y + 120, dx, dy);
      after = await where(page);
      note(`on a stack, ${name} (dx ${dx}, dy ${dy}): page moved ${after.y - before.y}px, row moved ${after.row - before.row}px`);
      // The same gesture on Saturday's timetable (the baseline: the same construct since v3).
      const grid = await page.evaluate(() => {
        const g = document.querySelector('#wall-root .day-block[data-day="Saturday"] .tt-block .times-wrap:not(.stage-strip) .times-scroll');
        g.scrollLeft = 0;
        const cell = g.querySelector('.card.cell');
        cell.scrollIntoView({ block: 'center' });
        const r = cell.getBoundingClientRect();
        return { x: r.left + 40, y: r.top + r.height / 2 };
      });
      await sleep(250);
      before = await where(page);
      await swipe(cdp, grid.x, grid.y, dx, dy);
      after = await where(page);
      note(`  on the timetable, same: page moved ${after.y - before.y}px, grid moved ${after.sat - before.sat}px`);
    }
    await page.evaluate(() => { for (const g of document.querySelectorAll('#wall-root .times-scroll')) if (!g.closest('.stage-strip')) g.scrollLeft = 0; });

    // The timetable's own swipe mirrors day to day and moves the strip, and
    // leaves every stack row where it was.
    await page.locator(ROW('Saturday', 'Afters')).evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + scrollY - 260));
    await sleep(200);
    await swipe(cdp, (await cardAt(page, 'Velvet Trip', afters)).x, (await cardAt(page, 'Velvet Trip', afters)).y, -120, -3);
    const g2 = await page.evaluate(() => {
      const g = document.querySelector('#wall-root .day-block[data-day="Saturday"] .tt-block .times-wrap:not(.stage-strip) .times-scroll');
      const cell = g.querySelector('.card.cell');
      cell.scrollIntoView({ block: 'center' });
      const r = cell.getBoundingClientRect();
      return { x: r.left + 40, y: r.top + r.height / 2 };
    });
    await sleep(250);
    before = await where(page);
    await swipe(cdp, g2.x, g2.y, -150, -3);
    after = await where(page);
    note(`timetable swipe with SAT AFTERS at ${before.row}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    // A rotation / resize re-mirrors the timetables; a stack row keeps its own.
    await page.setViewportSize({ width: 391, height: 844 });
    await sleep(200);
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(500);
    note(`after a resize: ${JSON.stringify(await where(page))}`);

    // A crew-mate's pick arrives (the poll's repaint): the row keeps its place.
    doc.festivals[FID].selections['Velvet Trip'] = { Nhu: 3 };
    const oldRow = await page.$(afters);
    await oldRow.evaluate((n) => { n.__old = true; });
    before = await where(page);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction((sel) => { const n = document.querySelector(sel); return n && !n.__old; }, afters, { timeout: 10000 });
    await sleep(300);
    after = await where(page);
    const nhu = await page.evaluate(() => [...document.querySelectorAll('#wall-root .card')].some((c) => c.dataset.artist === 'Velvet Trip' && /Nhu|crew/i.test(c.getAttribute('aria-label') || c.textContent)));
    note(`remote repaint (Nhu picks Velvet Trip): ${JSON.stringify(before)} -> ${JSON.stringify(after)}; new row node: yes`);
    await shot('5-after-repaint');
  } finally {
    await ctx.close();
  }
}

// ---- the NOW walk (`now`): Saturday night, the rows' NOW marks and the NOW tab --
async function nowWalk() {
  const { ctx, page } = await openPhone(390, { now: '2026-09-26T23:55:00-07:00' });
  try {
    note(`\n== NOW walk @ 390, Sat Sep 26 11:55 PM PT`);
    const marks = () => page.evaluate(() => [...document.querySelectorAll('#wall-root .stack-scroll .card.now')].map((c) => {
      const row = c.closest('.stack-scroll'), r = c.getBoundingClientRect(), b = row.getBoundingClientRect();
      return `${c.closest('.room').dataset.room}:${c.dataset.artist} x=${Math.round(r.left)}..${Math.round(r.right)} (row ${Math.round(b.left)}..${Math.round(b.right)}, ${Math.round(r.bottom)} vs row bottom ${Math.round(b.bottom)})`;
    }));
    note(`NOW cards in clocked rows: ${(await marks()).join(' | ') || 'none'}`);
    await shootRoom(page, 'Saturday', 'Afters', 'now-390-sat-afters.png');
    await page.tap('#dock-now');
    await sleep(1600);
    note(`after one NOW tap: scrollY=${await page.evaluate(() => Math.round(scrollY))}`);
    await page.screenshot({ path: path.join(OUT, 'now-390-after-tap.png') });
    await page.tap('#dock-now');
    await sleep(1600);
    note(`after a second NOW tap: scrollY=${await page.evaluate(() => Math.round(scrollY))}`);
    await page.screenshot({ path: path.join(OUT, 'now-390-after-tap2.png') });
  } finally {
    await ctx.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && label === 'now') {
  try { await nowWalk(); } finally {
    fs.writeFileSync(path.join(OUT, 'now-walk.txt'), report.join('\n') + '\n');
    await browser.close();
    await server.close();
  }
} else if (process.argv[1] === fileURLToPath(import.meta.url) && label === 'touch') {
  try { await touchWalk(); } finally {
    fs.writeFileSync(path.join(OUT, 'touch-walk.txt'), report.join('\n') + '\n');
    await browser.close();
    await server.close();
  }
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    for (const w of WIDTHS) {
      const { ctx, page } = await openPhone(w);
      try {
        const m = await measure(page);
        note(`\n== ${label} @ ${w}px (page overflow ${m.pageOverflow}px)`);
        for (const [d, g] of Object.entries(m.grids)) note(`  ${d} timetable: columns at x=${g.cols.join('/')}, scroller right=${g.scrollerRight}, scrolls ${g.overflow}px`);
        for (const s of m.stacks) {
          note(`  ${s.day || '-'} ${s.room || '-'} [clock=${s.clock}] ${s.venues} venue(s), columns at x=${s.cols.join('/')}, col ${s.colW}px, ${s.row ? 'row' : 'grid'} box ${s.box.join('..')}, overflow-x ${s.overflowX}, scrolls ${s.scrolls}px`);
        }
        await shootRoom(page, 'Saturday', 'Afters', `${label}-${w}-sat-afters.png`);
        await shootRoom(page, 'Saturday', ':fest', `${label}-${w}-sat-crane.png`, { inner: ' .venue-grid', above: 260, height: 420 });
        await shootRoom(page, 'Sunday', 'Folsom', `${label}-${w}-sun-folsom.png`);
        if (w === 390) await shootRoom(page, 'Friday', 'Afters', `${label}-${w}-fri-afters.png`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    fs.writeFileSync(path.join(OUT, `${label}-walk.txt`), report.join('\n') + '\n');
    await browser.close();
    await server.close();
  }
}
