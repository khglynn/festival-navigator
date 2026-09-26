// The moment-lens frame rig (list-view round, direction c, 2026-09-26).
//
// Boots the PRODUCTION app from the read-only design-app worktree (APP) in one
// headless Chromium with a made-up crew (crew.mjs), the people-shelf harness
// pattern: a local static server over APP, with THIS folder mounted at /__c/ so
// proto.mjs can import the app's own modules by absolute path (/js/...). /api
// is answered inside the page (GET crew = crew.mjs; every write refused 503),
// /fn-i swallowed, the service worker blocked, and any request that is not
// this machine's static server is aborted — nothing reaches production, a
// preview or the database. The app worktree is only ever READ.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crewDoc, ME } from './crew.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP = process.env.APP || '/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/design-app';
if (!fs.existsSync(path.join(APP, 'index.html'))) throw new Error('APP must be the design-app worktree');
const TOKEN = 'momentlensframes_0123456'; // made up; never a real crew link
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

function serve() {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
    if (p.includes('..')) { res.writeHead(403); res.end(); return; }
    if (p === '/' || p === '') p = '/index.html';
    let file = p.startsWith('/__c/') ? path.join(HERE, p.slice(5)) : path.join(APP, p);
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((c) => server.close(c)) })));
}

export async function openRig() {
  const { chromium } = await import(path.join(APP, 'node_modules/playwright/index.mjs'));
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  return { server, browser, close: async () => { await browser.close(); await server.close(); } };
}

// One page. A phone is 390 wide, touch, 2x; a desktop is a mouse at 1280.
export async function openApp(rig, { now, width = 390, height = 844, desktop = false } = {}) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop, serviceWorkers: 'block' });
  const origin = rig.server.origin;
  await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.fallback() : route.abort()));
  await ctx.route(`${origin}/api/**`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${origin}/api/crew**`, (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(crewDoc('portola-2026', 9)) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route(`${origin}/api/festival-add**`, (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route(`${origin}/fn-i/**`, (route) => route.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(([t, me]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, me);
    localStorage.setItem('fn_welcome_v1', '1');
    localStorage.setItem('fn_welcome_joined_v1', '1');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
  }, [TOKEN, ME]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
