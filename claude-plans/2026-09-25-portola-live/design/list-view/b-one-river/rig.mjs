// One river — the frame rig (list-view round, 2026-09-26).
//
// Boots the PRODUCTION app from the read-only design-app worktree (APP, main
// at v95) in one headless Chromium, and layers the prototype (proto.mjs +
// proto.css, served from THIS folder at /__proto/) on top — the app worktree
// is never edited. The prototype imports the app's own modules by their
// absolute URLs, so it shares their instances (state, the card, the ticker).
//
// NEVER production: /api answers from memory (GET crew = crew.mjs, a made-up
// crew; every write is refused 503 and recorded), /fn-i is swallowed, any
// request that is not this machine's server is aborted, the service worker is
// blocked, and the clock is pinned. No crew link, no preview, no database.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crewDoc } from './crew.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP = process.env.APP || '/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/design-app';
if (!fs.existsSync(path.join(APP, 'index.html'))) throw new Error('set APP to the design-app worktree');
const TOKEN = 'oneriverDESIGNdemo_012345'; // made up; never a real crew link
const FID = 'portola-2026';
export const writes = [];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

export async function openRig() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p0 = decodeURIComponent(u.pathname);
    if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        if (req.method !== 'GET') writes.push(`${req.method} ${p0}`);
        if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
        res.writeHead(p0 === '/api/crew' && req.method === 'GET' ? 200 : 503, { 'content-type': 'application/json' });
        res.end(p0 === '/api/crew' && req.method === 'GET' ? JSON.stringify(crewDoc(FID, 9)) : '{}');
      });
      return;
    }
    let file;
    if (p0.startsWith('/__proto/')) file = path.join(HERE, p0.slice('/__proto/'.length));
    else file = path.join(APP, p0 === '/' || p0.startsWith('/f/') ? '/index.html' : p0);
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { launchBrowser } = await import(path.join(APP, 'tests/helpers/browser.mjs'));
  const browser = await launchBrowser();
  if (!browser) throw new Error('no browser');
  return { origin, browser, close: async () => { await browser.close(); server.close(); } };
}

// One page at 2x: a phone (touch, 390 or 320) or a desktop (mouse, 1280).
export async function openApp(rig, { now, width = 390, height = 844, desktop = false, folded = null }) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop, serviceWorkers: 'block' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(rig.origin) ? route.fallback() : route.abort()));
  await ctx.addInitScript(([t, fold]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Ana');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_welcome_joined_v1', '1');
      localStorage.setItem('fn_coach_v1', '1');
      localStorage.setItem('fn_errlog_off_v1', '1');
      if (fold) localStorage.setItem('fn_fold_v1_portola-2026', JSON.stringify(fold));
    } catch { /* storage blocked */ }
  }, [TOKEN, folded]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${rig.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page, errors };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
