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
const room = (day, r) => `.day-block[data-day="${day}"] .room[data-room="${r}"]`;
export const FRAMES = [
  { id: 'list-sat-top-390', now: PT('2026-09-26T16:15:00'), width: 390, at: null },
  { id: 'list-sat-portola-390', now: PT('2026-09-26T16:15:00'), width: 390, at: room('Saturday', ':fest') },
  { id: 'list-sat-portola-320', now: PT('2026-09-26T16:15:00'), width: 320, at: room('Saturday', ':fest') },
  { id: 'list-sat-portola-1280', now: PT('2026-09-26T16:15:00'), width: 1280, height: 900, at: room('Saturday', ':fest') },
  { id: 'list-sat-afters-390', now: PT('2026-09-26T16:15:00'), width: 390, at: room('Saturday', 'Afters') },
  { id: 'list-sat-folsom-390', now: PT('2026-09-26T16:15:00'), width: 390, at: room('Saturday', 'Folsom') },
  { id: 'board-sat-portola-390', view: 'board', now: PT('2026-09-26T16:15:00'), width: 390, at: room('Saturday', ':fest') },
  { id: 'menu-open-390', now: PT('2026-09-26T16:15:00'), width: 390, at: room('Saturday', ':fest'), act: (p) => tap(p, '#dock-fest-link') },
  { id: 'menu-open-320', now: PT('2026-09-26T16:15:00'), width: 320, at: room('Saturday', ':fest'), act: (p) => tap(p, '#dock-fest-link') },
  { id: 'menu-open-1280', now: PT('2026-09-26T16:15:00'), width: 1280, height: 900, at: room('Saturday', ':fest'), act: (p) => click(p, '#rail-fest-link') },
  { id: 'menu-board-390', view: 'board', now: PT('2026-09-26T16:15:00'), width: 390, at: room('Saturday', ':fest'), act: (p) => tap(p, '#dock-fest-link') },
  { id: 'dock-closed-390', now: PT('2026-09-26T16:15:00'), width: 390, at: room('Saturday', ':fest'), clip: 'dock' },
  { id: 'dock-closed-320', now: PT('2026-09-26T16:15:00'), width: 320, at: room('Saturday', ':fest'), clip: 'dock' },
];
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
          if (f.at) await scrollTo(page, f.at);
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
