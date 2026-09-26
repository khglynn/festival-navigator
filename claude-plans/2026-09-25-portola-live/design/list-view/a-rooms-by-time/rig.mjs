// Direction A — Rooms by time — the frame rig (2026-09-26, on v95 / 75ccf2f).
//
// The folsom-by-time rig's server (a local static server over the read-only
// app worktree; /api answered from memory with a made-up crew; every write
// refused and recorded; /fn-i swallowed; the service worker blocked; the
// clock pinned) plus two things of this round's own:
//   - patch.mjs's hooks applied to the SERVED bytes of wall.js, events.js and
//     index.html (never the files), and
//   - /__proto/ serving proto.mjs + proto.css from this folder.
// The real portola-2026.json (v95's), the people-shelf crew (Ana … Ivy) with a
// few Folsom Sunday picks added. Frames go to ./frames at 2x.
//
// Run: APP=/path/to/design-app node rig.mjs [only-substring]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyPatches } from './patch.mjs';
import { crewDoc } from '../../people-shelf/crew.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP;
if (!APP || !fs.existsSync(path.join(APP, 'index.html'))) throw new Error('set APP to the design-app worktree');
const OUT = path.join(HERE, 'frames');
const SLICES = path.join(HERE, '.slices');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SLICES, { recursive: true });
const { launchBrowser } = await import(path.join(APP, 'tests/helpers/browser.mjs'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || null;

const FID = 'portola-2026';
const TOKEN = 'lvDesignCREWdemo_0123456a'; // made up; never a real crew link
const DOC = crewDoc(FID, 9);
// A few Folsom picks so Sunday's question has people on both sides.
Object.assign(DOC.festivals[FID].selections, {
  'AIRTIGHT': { Cy: 3, Fay: 2 },
  'Party On The Plaza: Folsom Edition': { Dot: 3, Hal: 2 },
  'BOOF presents MCMLXXXV (Herrensauna)': { Gus: 3 },
  'Magnitude': { Ana: 3, Eli: 2 },
  'PERVERT XXL': { Ben: 2 },
});
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
      if (p0 === '/api/crew' && req.method === 'GET') {
        if (u.searchParams.get('t') !== TOKEN) return send(404, { error: 'Crew not found' });
        return send(200, DOC);
      }
      if (p0.startsWith('/api/festival-add')) return send(200, { festivals: [] });
      return send(503, {}); // every write refused
    });
    return;
  }
  let p = p0 === '/' ? '/index.html' : p0;
  if (p.startsWith('/f/')) p = '/index.html';
  let file = p.startsWith('/__proto/') ? path.join(HERE, p.slice('/__proto/'.length)) : path.join(APP, p);
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  let body = fs.readFileSync(file);
  if (/^text\/(html|javascript)/.test(type)) body = applyPatches(p, body.toString('utf8'));
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser();
if (!browser) throw new Error('no browser');

// Saturday 4:15 PM at Pier 80 — the afternoon you'd ask about tomorrow.
const SAT_415PM = '2026-09-26T23:15:00Z';
const report = [];
const note = (s) => { report.push(s); console.log(s); };

async function open({ width, height, touch, view = 'list', stage = 'caps', oneUp = false, now = SAT_415PM }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.fallback() : route.abort()));
  await ctx.addInitScript((t) => {
    const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
  }, now);
  await ctx.addInitScript(([t, v, s, one]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Ana');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_welcome_joined_v1', '1');
      localStorage.setItem('fn_coach_v1', '1');
      localStorage.setItem('fn_errlog_off_v1', '1');
      localStorage.setItem('lv_view', v);
      localStorage.setItem('lv_stage', s);
      localStorage.setItem('lv_1up', one ? '1' : '');
    } catch { /* storage blocked */ }
  }, [TOKEN, view, stage, oneUp]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${origin}/f/${FID}#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(1400);
  return { ctx, page, errors };
}
const proto = (page, fn, arg) => page.evaluate(async ([f, a]) => { const P = await import('/__proto/proto.mjs'); return P[f](...(a || [])); }, [fn, arg]);
const roomSel = (day, room) => `.day-block[data-day="${day}"] .room[data-room="${room}"]`;

// Scroll so an element's top sits `lead` px under the sticky chrome.
async function scrollToEl(page, sel, lead = 12) {
  await page.evaluate(([s, l]) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`no ${s}`);
    const rail = document.querySelector('.day-rail');
    const chrome = rail && rail.offsetParent ? rail.getBoundingClientRect().height : 0;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - chrome - l));
  }, [sel, lead]);
  await sleep(450);
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name) }); note(`  frame ${name}`); }
// A room (or a whole day) top to bottom, stitched from viewport slices (a
// full-page capture drops touch emulation — the folsom rig's lesson).
async function longShot(page, sel, name) {
  await page.addStyleTag({ content: '#dock, .day-rail, .stage-strip, .toast, #update-row { visibility: hidden !important; }' });
  const box = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(r.top + scrollY), height: Math.round(r.height) }; }, sel);
  const { height: vh } = page.viewportSize();
  const top = Math.max(0, box.top - 14);
  const total = box.height + 28;
  const parts = [];
  for (let y = top; y < top + total; y += vh) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(220);
    const got = await page.evaluate(() => window.scrollY);
    const file = path.join(SLICES, `${name}.${parts.length}.png`);
    await page.screenshot({ path: file });
    parts.push({ file, off: y - got, h: Math.min(vh, top + total - y) });
  }
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
  note(`  frame ${name}`);
}
// Numbers the eye should not have to trust.
async function measure(page, day) {
  return page.evaluate((d) => {
    const block = document.querySelector(`.day-block[data-day="${d}"]`);
    const r = (el) => el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const rooms = [...block.querySelectorAll(':scope > .room')].map((room) => ({
      room: room.dataset.room,
      bands: [...room.querySelectorAll('.time-band')].map((b) => `${b.querySelector('.band-head .label').textContent}:${b.querySelectorAll('.card').length}`).join(' '),
      doors: room.querySelectorAll('button.band-head').length,
      headH: [...new Set([...room.querySelectorAll('.band-head')].filter((h) => !h.hidden).map((h) => Math.round(r(h).height)))],
      now: room.querySelectorAll('.card.now').length,
      overflow: [...room.querySelectorAll('.card')].filter((c) => r(c).right > vw + 0.5).length,
      widths: [...new Set([...room.querySelectorAll('.card')].map((c) => Math.round(r(c).width)))],
      places: [...room.querySelectorAll('.card .place')].slice(0, 3).map((p) => p.textContent),
    }));
    return { h: Math.round(r(block).height), aligned: block.classList.contains('lv-aligned'), cols: block.style.gridTemplateColumns, rooms };
  }, day);
}

const scenario = async (name, fn) => {
  if (only && !name.includes(only)) return;
  note(`\n== ${name}`);
  try { await fn(); } catch (e) { note(`FAIL ${name}: ${String(e).slice(0, 800)}`); }
};

// 1. Today's board and the list, same day, same scroll: SAT PORTOLA at 4:15 PM.
for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} board vs list, Saturday`, async () => {
    for (const view of ['board', 'list']) {
      const { ctx, page, errors } = await open({ width: W, height: H, touch: true, view });
      note(`${view} sat: ${JSON.stringify(await measure(page, 'Saturday'))}`);
      await scrollToEl(page, roomSel('Saturday', ':fest'));
      await shot(page, `${view}-sat-top-${W}.png`);
      if (view === 'list') {
        // The NOW hour: 4 PM, with the ring on what is playing.
        await scrollToEl(page, `${roomSel('Saturday', ':fest')} .time-band[data-band="h15"]`, 4);
        await shot(page, `list-sat-now-${W}.png`);
        if (W === 390) {
          note(`sun: ${JSON.stringify(await measure(page, 'Sunday'))}`);
          await longShot(page, roomSel('Saturday', ':fest'), 'list-sat-portola-390-long.png');
          await longShot(page, roomSel('Saturday', 'Afters'), 'list-sat-afters-390-long.png');
          await longShot(page, roomSel('Sunday', ':fest'), 'list-sun-portola-390-long.png');
          await longShot(page, roomSel('Sunday', 'Folsom'), 'list-sun-folsom-390-long.png');
        }
      }
      note(`writes ${JSON.stringify(writes)}; errors ${JSON.stringify(errors)}`);
      await ctx.close();
    }
  });
}

// 2. How a stage reads on a card: the file's name, short, short in capitals.
await scenario('390 stage readings', async () => {
  for (const stage of ['full', 'short', 'caps']) {
    const { ctx, page } = await open({ width: 390, height: 844, touch: true, stage });
    await scrollToEl(page, `${roomSel('Saturday', ':fest')} .time-band[data-band="h19"]`, 4);
    await shot(page, `stage-${stage}-390.png`);
    await ctx.close();
  }
});

// 3. Density: one row per set (the official app's shape) vs two-up.
await scenario('390 one-up', async () => {
  const { ctx, page } = await open({ width: 390, height: 844, touch: true, oneUp: true });
  await scrollToEl(page, `${roomSel('Saturday', ':fest')} .time-band[data-band="h15"]`, 4);
  await shot(page, 'oneup-sat-now-390.png');
  note(`1-up sat height ${JSON.stringify((await measure(page, 'Saturday')).h)}`);
  await ctx.close();
});

// 4. Sunday at 2 — Folsom or Portola? On a phone: pin 2 PM in SUN PORTOLA,
//    mid-motion, settled, then the jump to SUN FOLSOM.
for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} sunday at 2`, async () => {
    const { ctx, page, errors } = await open({ width: W, height: H, touch: true });
    const head = `${roomSel('Sunday', ':fest')} .time-band[data-band="h14"]`;
    await scrollToEl(page, `${roomSel('Sunday', ':fest')} .time-band[data-band="h13"]`, 4);
    await shot(page, `at2-before-${W}.png`);
    // A real finger on the 2 PM head.
    const b = await page.locator(`${head} > button.band-head`).boundingBox();
    note(`2 PM head box ${JSON.stringify(b)}`);
    if (W === 390) {
      await page.touchscreen.tap(b.x + 30, b.y + b.height / 2);
      await sleep(110);
      await proto(page, 'freezeAll', [110]);
      await shot(page, `at2-mid-${W}.png`);
      await page.evaluate(() => { for (const a of document.getAnimations()) { if (Number.isFinite(a.effect.getComputedTiming().endTime)) a.finish(); else a.play(); } });
    } else {
      await page.touchscreen.tap(b.x + 30, b.y + b.height / 2);
    }
    await sleep(600);
    await shot(page, `at2-pinned-${W}.png`);
    note(`pinned: ${JSON.stringify(await page.evaluate(() => ({ at: [...document.querySelectorAll('.lv-at')].map((h) => h.textContent.trim()), jumps: [...document.querySelectorAll('.lv-jump')].map((j) => j.textContent), lit: [...document.querySelectorAll('.day-block[data-day="Sunday"] .card:not(.lv-off)')].map((c) => c.dataset.artist) })))}`);
    // The jump: tap FOLSOM ↓.
    const j = await page.locator(`${head} .lv-jump`).boundingBox();
    await page.touchscreen.tap(j.x + j.width / 2, j.y + j.height / 2);
    await sleep(1400);
    await shot(page, `at2-folsom-${W}.png`);
    if (W === 390) {
      await page.evaluate(() => window.scrollBy(0, 420));
      await sleep(400);
      await shot(page, `at2-folsom-later-${W}.png`);
      await longShot(page, '.day-block[data-day="Sunday"]', 'at2-sunday-390-long.png');
    }
    note(`writes ${JSON.stringify(writes)}; errors ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

// 5. Desktop: today's board, then the rooms side by side on one clock, 2 PM pinned.
await scenario('1280 desktop', async () => {
  for (const view of ['board', 'list']) {
    const { ctx, page, errors } = await open({ width: 1280, height: 1000, touch: false, view });
    note(`${view} sun: ${JSON.stringify(await measure(page, 'Sunday'))}`);
    await scrollToEl(page, roomSel('Sunday', ':fest'));
    await shot(page, `${view}-sun-1280.png`);
    if (view === 'list') {
      await longShot(page, '.day-block[data-day="Sunday"]', 'list-sun-1280-long.png');
      // Noon's row just under the sticky room heads, then a real click on 2 PM.
      await scrollToEl(page, '.day-block[data-day="Sunday"] .time-band[data-band="h12"] > .band-head:not([hidden])', 70);
      const hb = await page.locator('.day-block[data-day="Sunday"] .time-band[data-band="h14"] > .band-head:not([hidden])').first().boundingBox();
      await page.mouse.click(hb.x + 20, hb.y + hb.height / 2);
      await sleep(700);
      await shot(page, 'at2-sun-1280.png');
      note(`desktop pinned: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.lv-at')].map((h) => h.textContent.trim())))} ${JSON.stringify(hb)}`);
      await longShot(page, '.day-block[data-day="Saturday"]', 'list-sat-1280-long.png');
    }
    note(`errors ${JSON.stringify(errors)}`);
    await ctx.close();
  }
});

await browser.close();
server.close();
note(`\nall writes attempted (all refused): ${JSON.stringify(writes)}`);
fs.writeFileSync(path.join(HERE, 'rig-report.txt'), report.join('\n') + '\n');
