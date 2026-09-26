// D — Full-width rows — the rig (list-view riff, 2026-09-26).
//
// Two siblings' rigs in one: m-menu-past-persist's server (the read-only
// design-app worktree at v95, with every app file v93 changed served straight
// from git objects at e3c20d5 — the Show menu as it ships in v96) and
// a-rooms-by-time's served-byte patches (patch.mjs, copied: every room reads
// as a list). This folder's proto.mjs / proto.css are served under /__proto/.
//
// NEVER production: a local static server; /api answered from memory with the
// made-up people-shelf crew (every write refused 503 and counted); /fn-i
// swallowed; every request that is not this server aborted; the service
// worker blocked; the clock pinned. Nothing in either worktree is written.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyPatches } from './patch.mjs';
import { crewDoc } from '../../people-shelf/crew.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP = process.env.APP || '/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/design-app';
export const V93 = process.env.V93 || 'e3c20d5';
const OVER = execFileSync('git', ['-C', APP, 'diff', '--name-only', '--diff-filter=AM', 'HEAD', V93], { encoding: 'utf8' })
  .split('\n').filter((p) => p && !/^(tests|claude-plans|docs)\//.test(p) && !p.endsWith('.md'));
const overlay = new Map(OVER.map((p) => [`/${p}`, execFileSync('git', ['-C', APP, 'show', `${V93}:${p}`], { maxBuffer: 1 << 26 })]));
const TOKEN = 'dFullWidthDEMOcrew_012345'; // made up; never a real crew link
const FID = 'portola-2026';
const DOC = crewDoc(FID, 9);
Object.assign(DOC.festivals[FID].selections, {
  'AIRTIGHT': { Cy: 3, Fay: 2 },
  'Party On The Plaza: Folsom Edition': { Dot: 3, Hal: 2 },
  'Magnitude': { Ana: 3, Eli: 2 },
  'PERVERT XXL': { Ben: 2 },
});
export const writes = [];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

export async function openRig() {
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
    let body = null;
    if (p.startsWith('/__proto/')) {
      const f = path.join(HERE, p.slice(9));
      if (f.startsWith(HERE) && fs.existsSync(f)) body = fs.readFileSync(f);
    } else if (overlay.has(p)) body = overlay.get(p);
    else {
      const f = path.join(APP, p);
      if (f.startsWith(APP) && fs.existsSync(f) && !fs.statSync(f).isDirectory()) body = fs.readFileSync(f);
    }
    if (!body) { res.writeHead(404); res.end('nf'); return; }
    const type = TYPES[path.extname(p)] || 'application/octet-stream';
    if (/^text\/(html|javascript)/.test(type)) body = applyPatches(p, body.toString('utf8'));
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = await import(path.join(APP, 'node_modules/playwright/index.mjs'));
  const browser = await chromium.launch({ headless: true });
  return { origin, browser, close: async () => { await browser.close(); server.close(); } };
}

// One page at a pinned time. `store`: the prototype's knobs (d_card = 'flow' |
// 'edges', lv_view = 'list' | 'board', d_past = 'open').
export async function openApp(rig, { now, width = 390, height = 844, desktop = false, store = {} }) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop, serviceWorkers: 'block' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(rig.origin) ? route.fallback() : route.abort()));
  await ctx.addInitScript(([t, st]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Ana');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_welcome_joined_v1', '1');
      localStorage.setItem('fn_coach_v1', '1');
      localStorage.setItem('fn_errlog_off_v1', '1');
      localStorage.setItem('lv_view', 'list');
      localStorage.setItem('lv_stage', 'caps');
      for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
    } catch { /* storage blocked */ }
  }, [TOKEN, store]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${rig.origin}/f/${FID}#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page, errors };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const PT = (s) => new Date(`${s}-07:00`);
