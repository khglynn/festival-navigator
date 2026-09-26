// The menu / past / persistence rig (list-view round, 2026-09-26).
//
// Boots the PRODUCTION app from the read-only design-app worktree (main at
// v95) with v93's app files laid over it straight from git objects
// (origin/live/v93 — the Show menu as it ships in v96: stay-open, "Show"
// label, gear), so every frame is real HTML, CSS and cards. Nothing is
// checked out and nothing in either worktree is written.
//
// NEVER production: a local static server; /api answered from memory with the
// made-up crew in ../people-shelf/crew.mjs (every write refused 503 and
// recorded); /fn-i swallowed; every request that is not this server aborted;
// the service worker stubbed; the clock pinned. The prototype (proto.mjs,
// proto.css beside this file) is served under /__m/ and imported into the page.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crewDoc, ME } from '../../people-shelf/crew.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP = process.env.APP || '/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/design-app';
// v93 is still moving (its builder pushes as it goes), so the frames name the
// commit they were made on; V93=<ref> renders another. Every app file that
// differs from main (added or changed; tests, plans and docs aside) comes
// from that commit.
export const V93 = process.env.V93 || 'e3c20d5';
const OVER = execFileSync('git', ['-C', APP, 'diff', '--name-only', '--diff-filter=AM', 'HEAD', V93], { encoding: 'utf8' })
  .split('\n').filter((p) => p && !/^(tests|claude-plans|docs)\//.test(p) && !p.endsWith('.md'));
const overlay = new Map(OVER.map((p) => [`/${p}`, execFileSync('git', ['-C', APP, 'show', `${V93}:${p}`], { maxBuffer: 1 << 26 })]));
const TOKEN = 'menupastframes_0123456789'; // made up; never a real crew link
const FID = 'portola-2026';
export const writes = [];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

export async function openRig() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p0 = decodeURIComponent(u.pathname);
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
      if (req.method !== 'GET') writes.push(`${req.method} ${p0}`);
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew' && req.method === 'GET') return u.searchParams.get('t') === TOKEN ? json(200, crewDoc(FID, 9)) : json(404, { error: 'Crew not found' });
      if (p0.startsWith('/api/festival-add')) return json(200, { festivals: [] });
      return json(503, {});
    }
    let p = p0 === '/' || p0.startsWith('/f/') ? '/index.html' : p0;
    let body = null;
    if (p.startsWith('/__m/')) {
      const f = path.join(HERE, p.slice(5));
      if (f.startsWith(HERE) && fs.existsSync(f)) body = fs.readFileSync(f);
    } else if (overlay.has(p)) body = overlay.get(p);
    else {
      const f = path.join(APP, p);
      if (f.startsWith(APP) && fs.existsSync(f) && !fs.statSync(f).isDirectory()) body = fs.readFileSync(f);
    }
    if (!body) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = await import(path.join(APP, 'node_modules/playwright/index.mjs'));
  const browser = await chromium.launch({ headless: true });
  return { origin, browser, close: async () => { await browser.close(); server.close(); } };
}

// One page at a pinned time. `store`: extra localStorage keys (the prototype's
// view/past settings, a fold). `hash`: extra hash params (a share link's).
export async function openApp(rig, { now, width = 390, height = 844, desktop = false, store = {}, hash = '', fresh = false }) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop, serviceWorkers: 'block' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(rig.origin) ? route.fallback() : route.abort()));
  await ctx.addInitScript(([t, me, st, fresh]) => {
    try {
      navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
      if (!fresh) {
        localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
        localStorage.setItem(`fn_me_v3_${t}`, me);
        localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      }
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_welcome_joined_v1', '1');
      localStorage.setItem('fn_coach_v1', '1');
      localStorage.setItem('fn_errlog_off_v1', '1');
      for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
    } catch { /* storage blocked */ }
  }, [TOKEN, ME, store, fresh]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${rig.origin}/f/${FID}#g=${TOKEN}&f=${FID}${hash}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const PT = (s) => new Date(`${s}-07:00`);
