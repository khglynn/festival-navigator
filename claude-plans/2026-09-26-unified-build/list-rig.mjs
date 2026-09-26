// Phase 1's frames rig (2026-09-26): THIS worktree's app, as it ships — no
// patches, no overlay — in a real Chromium or WebKit, at a pinned clock.
//
// NEVER production: a local static server over the worktree; /api answered
// from memory with the made-up people-shelf crew (every write refused 503 and
// counted); /fn-i swallowed; every request that is not this server aborted;
// the service worker blocked. Frames land in list-shots/ (git-ignored).
//
//   node claude-plans/2026-09-26-unified-build/list-rig.mjs [frame-id-prefix …]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crewDoc } from '../2026-09-25-portola-live/design/people-shelf/crew.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const SHOTS = path.join(ROOT, 'list-shots');
const TOKEN = 'listBuildDEMOcrew_0123456'; // made up; never a real crew link
const FID = 'portola-2026';
const ACL = 'acl-2026';
const docFor = () => {
  const d = crewDoc(FID, 9);
  Object.assign(d.festivals[FID].selections, {
    AIRTIGHT: { Cy: 3, Fay: 2 },
    'Party On The Plaza: Folsom Edition': { Dot: 3, Hal: 2 },
    Magnitude: { Ana: 3, Eli: 2 },
    'PERVERT XXL': { Ben: 2 },
    // A long party name with people beside it: three lines at 320 (the row grows).
    'CUMUNION + BEARUNION - FOLSOM EDITION': { Ana: 3, Ben: 2, Cy: 4, Dot: 1, Eli: 2 },
  });
  d.festivals[ACL] = { selections: { Turnstile: { Ana: 3, Ben: 2 }, 'Jesse Welles': { Cy: 2 }, Fcukers: { Ana: 2, Dot: 3 } } };
  return d;
};
const DOC = docFor();
export const writes = [];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

export async function openRig({ engine = 'chromium' } = {}) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p0 = decodeURIComponent(u.pathname);
    const json = (s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
      if (req.method !== 'GET') writes.push(`${req.method} ${p0}`);
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew' && req.method === 'GET') return u.searchParams.get('t') === TOKEN ? json(200, DOC) : json(404, { error: 'Crew not found' });
      if (p0.startsWith('/api/festival-add')) return json(200, { festivals: [] });
      return json(503, {});
    }
    const p = p0 === '/' || p0.startsWith('/f/') ? '/index.html' : p0;
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const pw = await import('playwright');
  const browser = await pw[engine].launch({ headless: true });
  return { origin, browser, engine, close: async () => { await browser.close(); server.close(); } };
}

// One page at a pinned time. `view`: 'list' | 'board'. `fid`: which festival.
export async function openApp(rig, { now, width = 390, height = 844, desktop = width >= 720, view = 'list', fid = FID, store = {} }) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop && rig.engine === 'chromium', serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(rig.origin) ? route.fallback() : route.abort()));
  await ctx.addInitScript(([t, f, v, st]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Ana');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_welcome_joined_v1', '1');
      localStorage.setItem('fn_coach_v1', '1');
      localStorage.setItem('fn_errlog_off_v1', '1');
      if (v === 'list' && !sessionStorage.getItem('rig_seeded')) localStorage.setItem(`fn_view_v1_${f}`, 'list');
      sessionStorage.setItem('rig_seeded', '1');
      for (const [k, val] of Object.entries(st)) localStorage.setItem(k, val);
    } catch { /* storage blocked */ }
  }, [TOKEN, fid, view, store]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${rig.origin}/f/${fid}#g=${TOKEN}&f=${fid}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const PT = (s) => new Date(`${s}-07:00`);
export const CDT = (s) => new Date(`${s}-05:00`);

// Scroll so an element sits just under the sticky chrome.
export async function scrollTo(page, sel, pad = 8) {
  await page.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`no ${s}`);
    const off = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 0;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off - p);
  }, [sel, pad]);
  await sleep(900); // the day row glides to the day you are in (restDayRow)
}

async function shot(page, id, opts = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), ...opts });
  return id;
}

// ---- the frames --------------------------------------------------------------------
// Every state the brief names, at 390 / 320 / 1280 (Portola live on Saturday
// 4:15 PM; ACL on its first Saturday, 8 PM in Austin), plus the zoom on a row,
// the rings at night, the 5 AM rollover and NOW's landing.
const room = (day, r) => `.day-block[data-day="${day}"] .room[data-room="${r}"]`;
const SAT = PT('2026-09-26T16:15:00');
const ACL_SAT = CDT('2026-10-03T20:00:00');
const W3 = (id, o) => [390, 320, 1280].map((width) => ({ id: `${id}-${width}`, width, height: width >= 720 ? 900 : 844, now: SAT, ...o, act: o.act ? o.act(width) : undefined }));
const lateNight = (iso) => `.day-block .room[data-room="Late nights"][data-iso="${iso}"]`;
export const FRAMES = [
  ...W3('p-sat-top', { at: 'top' }),
  ...W3('p-sat-portola', { at: room('Saturday', ':fest') }),
  ...W3('p-sat-portola-open', { at: room('Saturday', ':fest'), act: (w) => (p) => (w >= 720 ? click : tap)(p, `${room('Saturday', ':fest')} .past-line`) }),
  ...W3('p-days-open', { at: 'top', act: (w) => (p) => (w >= 720 ? click : tap)(p, '#wall-root > .past-line') }),
  ...W3('p-sat-afters', { at: room('Saturday', 'Afters') }),
  ...W3('p-sat-folsom', { at: room('Saturday', 'Folsom') }),
  ...W3('p-sun-portola', { at: room('Sunday', ':fest') }),
  ...W3('p-menu-open', { at: room('Saturday', ':fest'), act: (w) => (p) => (w >= 720 ? click(p, '#rail-fest-link') : tap(p, '#dock-fest-link')) }),
  ...W3('p-board-top', { view: 'board', at: 'top' }),
  { id: 'p-dock-closed-390', width: 390, now: SAT, at: room('Saturday', ':fest'), clip: 'dock' },
  { id: 'p-dock-closed-320', width: 320, now: SAT, at: room('Saturday', ':fest'), clip: 'dock' },
  { id: 'p-dock-open-390', width: 390, now: SAT, at: room('Saturday', ':fest'), clip: 'dock', act: (p) => tap(p, '#dock-fest-link') },
  { id: 'p-zoom-row-390', width: 390, now: SAT, at: room('Saturday', ':fest'), act: (p) => hold(p, 'Tricky') },
  { id: 'p-zoom-row-1280', width: 1280, height: 900, now: SAT, at: room('Saturday', ':fest'), act: (p) => hover(p, 'Tricky') },
  { id: 'p-now-landing-390', width: 390, now: SAT, at: 'top', act: (p) => tap(p, '#dock-now').then(() => sleep(1300)) },
  { id: 'p-930pm-afters-390', width: 390, now: PT('2026-09-26T21:30:00'), at: room('Saturday', 'Afters') },
  { id: 'p-6am-sun-390', width: 390, now: PT('2026-09-27T06:00:00'), at: 'top' },
  { id: 'p-long-name-320', width: 320, now: SAT, at: '.day-block[data-day="Saturday"] .room[data-room="Folsom"] .time-band[data-band="evening"]' },
  ...W3('acl-sat-grid', { fid: 'acl-2026', now: ACL_SAT, at: '.day-block[data-day="Saturday|W1"] .room[data-room=":fest"]' }),
  ...W3('acl-late-night', { fid: 'acl-2026', now: ACL_SAT, at: lateNight('2026-10-03') }),
  { id: 'acl-menu-open-390', width: 390, fid: 'acl-2026', now: ACL_SAT, at: '.day-block[data-day="Saturday|W1"] .room[data-room=":fest"]', act: (p) => tap(p, '#dock-fest-link') },
  { id: 'acl-board-top-390', width: 390, view: 'board', fid: 'acl-2026', now: CDT('2026-10-09T15:00:00'), at: 'top' },
  { id: 'acl-list-top-w2-390', width: 390, fid: 'acl-2026', now: CDT('2026-10-09T15:00:00'), at: 'top' },
];
// A finger's hold (the long-press zoom; its timer can run late under a pinned
// clock, so hold until the card grows, as a finger does), and a mouse's hover.
export async function hold(page, artist) {
  const at = await page.evaluate((a) => {
    const el = [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, artist);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
  await sleep(650);
  for (let i = 0; i < 40 && !(await page.$('#zoom-layer .zoom-slot.shown')); i++) await sleep(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
}
export async function hover(page, artist) {
  const b = await page.locator(`#wall-root .card[data-artist="${artist}"]`).first().boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await sleep(900);
}
// Real input: a finger's tap on a phone, a mouse's click on a laptop.
export async function tap(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(450);
}
export async function click(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(450);
}

export async function renderFrames(prefixes = []) {
  const want = (id) => !prefixes.length || prefixes.some((p) => id.startsWith(p));
  const report = [];
  for (const engine of ['chromium']) {
    const rig = await openRig({ engine });
    try {
      for (const f of FRAMES.filter((x) => want(x.id))) {
        const { ctx, page, errors } = await openApp(rig, { now: f.now, width: f.width, height: f.height || (f.width >= 720 ? 900 : 844), view: f.view || 'list', fid: f.fid });
        try {
          if (f.at === 'top') { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(900); }
          else if (f.at) await scrollTo(page, f.at);
          if (f.act) await f.act(page);
          let opts = f.full ? { fullPage: true } : {};
          if (f.clip === 'dock') {
            const b = await page.locator('#dock').boundingBox();
            opts = { clip: { x: 0, y: b.y - 24, width: b.width, height: b.height + 24 } };
          }
          await shot(page, f.id, opts);
          report.push(`${f.id}: ok${errors.length ? ` — page errors: ${errors.join(' | ')}` : ''}`);
        } finally { await ctx.close(); }
      }
    } finally { await rig.close(); }
  }
  report.push(`writes refused: ${writes.length} (${[...new Set(writes)].join(', ')})`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lines = await renderFrames(process.argv.slice(2));
  console.log(lines.join('\n'));
}
