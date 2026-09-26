// Folsom by time — the frame rig (v94 design round, 2026-09-25).
//
// Renders the Folsom nights with the REAL 68 parties (fixture.mjs) through the
// PRODUCTION app — the v94 worktree's own index.html, CSS and card — in a real
// Chromium: phones with touch at 390 and 320, a mouse at 1280, 2x. Frames go
// to ./frames beside this file.
//
// NEVER production: this server answers /api from memory with a made-up crew,
// refuses every write (and records it), swallows /fn-i, serves the fixture in
// place of portola-2026.json, and the service worker is blocked. One browser,
// closed at the end.
//
// Run: APP=/path/to/v94 node rig.mjs [only-substring]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP;
if (!APP || !fs.existsSync(path.join(APP, 'index.html'))) throw new Error('set APP to the v94 worktree');
const OUT = path.join(HERE, 'frames');
fs.mkdirSync(OUT, { recursive: true });
const SLICES = path.join(HERE, '.slices');
fs.mkdirSync(SLICES, { recursive: true });
const { launchBrowser } = await import(path.join(APP, 'tests/helpers/browser.mjs'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || null;

const FID = 'portola-2026';
// `real` is the v94 worktree's own file: the merged data/folsom-all plus the
// 18 same-venue parties (2026-09-26), Folsom declared by time.
const FIX = { time: path.join(HERE, 'fixture/portola-2026.json'), venue: path.join(HERE, 'fixture/portola-2026-venue.json'), real: path.join(APP, 'data/festivals/portola-2026.json') };
// The clock-day ALTERNATIVE (not built, for the decision): the v91 rule applied
// to a time list on a phone — the 40px hour rail as lead space, the two
// columns under the timetable's, the row scrolling sideways.
const ALT_B = `@media (max-width: 719.98px) {
  .time-list[data-clock] { overflow-x: auto; overflow-y: hidden; padding-block: 8px; margin-block: -8px; }
  .time-list[data-clock] > .time-band { width: max-content; padding-inline-start: var(--hour-rail-w); }
  .time-list[data-clock] .band-grid { grid-template-columns: repeat(2, var(--col-w)); column-gap: var(--clock-gap); }
}`;
let variant = 'time';
// A made-up crew: parser-shaped, obviously fake, never a real link.
const TOKEN = 'fbtDesignCREWdemo_0123456';
const DOC = {
  v: 4, meta: { name: 'The Folsom Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 }, Priya: { colorIndex: 9 }, Theo: { colorIndex: 12 }, Rosa: { colorIndex: 15 } },
  festivals: { [FID]: { selections: {
    Magnitude: { Kevin: 4, Maya: 3, Jonah: 2 },
    'PERVERT XXL': { Kevin: 3, Theo: 4, Rosa: 2 },
    'BRUT SF': { Jonah: 3, Priya: 2 },
    'MÜLL': { Kevin: 4, Theo: 3 },
    'Folsom Street Fair': { Kevin: 4, Maya: 4, Jonah: 4, Priya: 3, Theo: 3, Rosa: 4 },
    'Real Bad 37': { Maya: 3, Rosa: 3 },
    Zoomiez: { Priya: 4 },
    'Horse Meat Disco': { Kevin: 2, Maya: 3 },
    'Folsom Friday Warm-Up: Boot Camp': { Theo: 2 },
    'Big Muscle: Bare Chest Calendar': { Rosa: 1 },
  } } },
};
const writes = [];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p0 = decodeURIComponent(u.pathname);
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (req.method !== 'GET') writes.push(`${req.method} ${p0}`);
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew') {
        if (u.searchParams.get('t') !== TOKEN) return send(404, { error: 'Crew not found' });
        return send(200, DOC); // writes are refused: the doc never changes
      }
      return send(404, {});
    });
    return;
  }
  let p = p0 === '/' ? '/index.html' : p0;
  if (p.startsWith('/f/')) p = '/index.html';
  let file = p === `/data/festivals/${FID}.json` ? FIX[variant] : path.join(APP, p);
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser();
if (!browser) throw new Error('no browser');
const FRI_1130PM = '2026-09-26T06:30:00Z'; // Friday of Folsom weekend, 11:30 PM PT — tonight
const report = [];
const note = (s) => { report.push(s); console.log(s); };

async function open({ width, height, touch }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
  await ctx.addInitScript((t) => {
    const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
  }, FRI_1130PM);
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Folsom Crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    } catch { /* storage blocked */ }
  }, TOKEN);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/f/${FID}#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await sleep(1600);
  return { ctx, page, errors };
}
const roomSel = (day) => `.day-block[data-day="${day}"] .room[data-room="Folsom"]`;
// The whole night, chrome hidden (the dock and the sticky rail would sit over
// it). What the list IS, top to bottom, with the wall's gutter either side.
//
// Stitched from viewport slices, NEVER a fullPage capture: Chromium's
// full-page capture drops the touch emulation, `(pointer: coarse)` stops
// matching, and every room head falls from its 44px touch floor to 24px —
// the first round of these frames drew a mouse's layout on a phone.
async function roomShot(page, day, name) {
  await page.addStyleTag({ content: '#dock, .day-rail, .stage-strip, .toast, #update-row { visibility: hidden !important; }' });
  const read = () => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
  }, roomSel(day));
  await page.evaluate(() => document.fonts.ready);
  let box = await read();
  for (let i = 0; i < 10; i++) { await sleep(300); const again = await read(); if (again.top === box.top && again.height === box.height) break; box = again; }
  const { width: vw, height: vh } = page.viewportSize();
  const top = Math.max(0, box.top - 16);
  const total = box.height + 32;
  const parts = [];
  for (let y = top; y < top + total; y += vh) {
    const want = y;
    await page.evaluate((v) => window.scrollTo(0, v), want);
    await sleep(250);
    const got = await page.evaluate(() => window.scrollY);
    const file = path.join(SLICES, `${name}.${parts.length}.png`);
    await page.screenshot({ path: file });
    // The slice covers page [got, got + vh); keep [want, min(want + vh, end)).
    parts.push({ file, off: want - got, h: Math.min(vh, top + total - want) });
  }
  const { execFileSync } = await import('node:child_process');
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
spec = json.loads(sys.argv[1]); out = sys.argv[2]; dpr = 2
ims = [Image.open(p['file']).crop((0, p['off'] * dpr, Image.open(p['file']).width, (p['off'] + p['h']) * dpr)) for p in spec]
W = ims[0].width; H = sum(i.height for i in ims)
s = Image.new('RGB', (W, H)); y = 0
for i in ims: s.paste(i, (0, y)); y += i.height
s.save(out, optimize=True)
`, JSON.stringify(parts), path.join(OUT, name)]);
  await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('#dock, .day-rail')) s.remove(); });
}
// What a phone shows: the room's head scrolled to just under the chrome
// (or `lead` px of the room above it, to judge the two together).
async function viewShot(page, day, name, { lead = 0 } = {}) {
  await page.evaluate(([sel, lead]) => {
    const r = document.querySelector(sel);
    const top = r.getBoundingClientRect().top + window.scrollY;
    const rail = document.querySelector('.day-rail');
    const chrome = rail && rail.offsetParent ? rail.getBoundingClientRect().height : 0;
    window.scrollTo(0, Math.max(0, top - chrome - 12 - lead));
  }, [roomSel(day), lead]);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, name) });
}
// Geometry the eye should not have to trust: every card's left/right edge in a
// room, the columns they fall into, the band heads' left edges, and the room
// head's — so "aligned" is a number, not a feeling.
async function measure(page, day) {
  return page.evaluate((sel) => {
    const room = document.querySelector(sel);
    const r = (el) => el.getBoundingClientRect();
    const cards = [...room.querySelectorAll('.card')];
    const lefts = [...new Set(cards.map((c) => Math.round(r(c).left)))].sort((a, b) => a - b);
    const rights = [...new Set(cards.map((c) => Math.round(r(c).right)))].sort((a, b) => a - b);
    const widths = [...new Set(cards.map((c) => Math.round(r(c).width)))];
    const heads = [...new Set([...room.querySelectorAll('.band-head, .venue-group .stage-head')].map((h) => Math.round(r(h).left)))];
    const roomHead = room.querySelector('.room-head');
    const vw = document.documentElement.clientWidth;
    const overflow = cards.filter((c) => r(c).right > vw + 0.5).length;
    const bands = [...room.querySelectorAll('.time-band')].map((b) => `${b.querySelector('.band-head .label').textContent}:${b.querySelectorAll('.card').length}`);
    const now = room.querySelectorAll('.card.now').length;
    // Vertical rhythm: the gap between consecutive card rows in a band.
    const gaps = new Set();
    for (const g of room.querySelectorAll('.band-grid')) {
      const tops = [...new Set([...g.children].map((c) => Math.round(r(c).top)))].sort((a, b) => a - b);
      const rows = tops.map((t) => [...g.children].filter((c) => Math.round(r(c).top) === t));
      for (let i = 1; i < rows.length; i++) gaps.add(Math.round(r(rows[i][0]).top - Math.max(...rows[i - 1].map((c) => r(c).bottom))));
      for (const row of rows) { const hs = new Set(row.map((c) => Math.round(r(c).height))); if (hs.size > 1) gaps.add(`ragged:${[...hs]}`); }
    }
    const ttCols = [...document.querySelectorAll(`.day-block[data-day="${room.closest('.day-block').dataset.day}"] .times-grid > .card, .day-block[data-day="${room.closest('.day-block').dataset.day}"] .stage-strip .stage-head`)].map((c) => Math.round(r(c).left));
    return { cards: cards.length, lefts, rights, widths, heads, roomHead: roomHead ? Math.round(r(roomHead).left) : null, vw, overflow, bands, now, rowGaps: [...gaps], clockCols: [...new Set(ttCols)].sort((a, b) => a - b).slice(0, 6) };
  }, roomSel(day));
}

const scenario = async (name, fn) => {
  if (only && !name.includes(only)) return;
  note(`\n== ${name}`);
  try { await fn(); } catch (e) { note(`FAIL ${name}: ${String(e).slice(0, 600)}`); }
};

for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} phone, by time`, async () => {
    variant = 'time';
    const { ctx, page, errors } = await open({ width: W, height: H, touch: true });
    for (const [day, tag] of [['Friday', 'fri'], ['Saturday', 'sat'], ['Sunday', 'sun']]) {
      note(`${tag}: ${JSON.stringify(await measure(page, day))}`);
      await roomShot(page, day, `${tag}-${W}.png`);
    }
    await viewShot(page, 'Friday', `view-fri-${W}.png`);
    await viewShot(page, 'Saturday', `view-sat-${W}.png`, { lead: 260 });
    if (W === 390) {
      // The zoom on a Folsom card: its Tix/Info doors and the − · note · + row.
      await viewShot(page, 'Saturday', 'zoom-sat-390-base.png');
      const card = page.locator(`${roomSel('Saturday')} .card[data-artist="Magnitude"]`).first();
      await card.scrollIntoViewIfNeeded();
      await sleep(300);
      // A member's finger HOLDS to open the card (a tap picks): a real touch
      // press through CDP, held past the 500ms long-press.
      const b = await card.boundingBox();
      const cdp = await ctx.newCDPSession(page);
      const pt = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
      await sleep(800);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(1200);
      note(`zoom up: ${await page.locator('.zoom-card').count()}; links: ${JSON.stringify(await page.locator('.zoom-card .f-links a').allTextContents())}`);
      await page.screenshot({ path: path.join(OUT, 'zoom-sat-390.png') });
    }
    note(`writes ${JSON.stringify(writes)}; errors ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

await scenario('1280 desktop, by time', async () => {
  variant = 'time';
  const { ctx, page, errors } = await open({ width: 1280, height: 900, touch: false });
  for (const [day, tag] of [['Friday', 'fri'], ['Saturday', 'sat'], ['Sunday', 'sun']]) {
    note(`${tag}: ${JSON.stringify(await measure(page, day))}`);
    await roomShot(page, day, `${tag}-1280.png`);
  }
  await viewShot(page, 'Saturday', 'view-sat-1280.png', { lead: 420 });
  note(`errors ${JSON.stringify(errors)}`);
  await ctx.close();
});

// Today's venue stacks with the same 68 parties, for comparison.
for (const [W, H, touch] of [[390, 844, true], [1280, 900, false]]) {
  await scenario(`${W} today (venue stacks), same data`, async () => {
    variant = 'venue';
    const { ctx, page, errors } = await open({ width: W, height: H, touch });
    note(`sat: ${JSON.stringify(await measure(page, 'Saturday'))}`);
    await roomShot(page, 'Saturday', `today-venue-sat-${W}.png`);
    await viewShot(page, 'Saturday', `today-venue-view-sat-${W}.png`, { lead: W > 700 ? 420 : 260 });
    note(`errors ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

// The full data (v94, 2026-09-26): every night whole at 390, and Saturday as
// the phone shows it under the clock — the built choice (A) and the v91 rule
// (B) side by side, same scroll.
for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} real data, by time`, async () => {
    variant = 'real';
    const { ctx, page, errors } = await open({ width: W, height: H, touch: true });
    for (const [day, tag] of [['Friday', 'fri'], ['Saturday', 'sat'], ['Sunday', 'sun']]) {
      note(`${tag}: ${JSON.stringify(await measure(page, day))}`);
      if (W === 390) await roomShot(page, day, `real-${tag}-390.png`);
    }
    await viewShot(page, 'Saturday', `real-A-view-sat-${W}.png`, { lead: 300 });
    await page.addStyleTag({ content: ALT_B });
    await sleep(500);
    note(`B: ${JSON.stringify(await page.evaluate(() => { const l = document.querySelector('.day-block[data-day="Saturday"] .time-list'); const c = [...l.querySelectorAll('.card')].map((x) => x.getBoundingClientRect()); return { lefts: [...new Set(c.map((r) => Math.round(r.left)))], rights: [...new Set(c.map((r) => Math.round(r.right)))].slice(0, 3), vw: innerWidth, scrolls: l.scrollWidth - l.clientWidth }; }))}`);
    await viewShot(page, 'Saturday', `real-B-view-sat-${W}.png`, { lead: 300 });
    note(`errors ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

await browser.close();
server.close();
fs.writeFileSync(path.join(HERE, 'rig-report.txt'), report.join('\n') + '\n');
