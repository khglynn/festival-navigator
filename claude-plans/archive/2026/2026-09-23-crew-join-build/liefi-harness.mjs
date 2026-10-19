#!/usr/bin/env node
// The lie-fi harness (2026-09-23): does a phone with everything cached paint
// its wall on a network that HANGS — and how fast — in Chromium and WebKit?
//
//   node claude-plans/2026-09-23-crew-join-build/liefi-harness.mjs [chromium|webkit|both] [runs]
//
// Why a server with a switch, not page.route: Playwright's route handlers do
// not see requests a service worker makes, so "hang everything with a route"
// leaves the worker's own fetches (the navigation, the festival files) on the
// real network — a first reload paints in ~50 ms because nothing was starved,
// and later reloads can wedge on the route itself (the WebKit walk, 2026-09-23).
// Here ONE local HTTP server serves the app (this repo, as files) and a mocked
// /api; flipping `hang` makes it hold EVERY request open with no answer — the
// page's and the worker's alike, because both are real HTTP to this server.
//
// The run: one online open to install the worker and cache the crew, a second
// online open under the worker so the festival file is in its data cache, then
// the switch, then `runs` reloads, each timed to the moment #screen-app shows
// (ms from that navigation's start). Nothing here touches production: /api is
// answered by this file, and the crew is made up.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENGINES = { chromium, webkit };
const which = process.argv[2] || 'both';
const RUNS = Number(process.argv[3] || 3);
// `route` reproduces the WebKit walk's harness instead (a context.route that
// never answers), to show how it differs from a network that really hangs.
const VIA_ROUTE = process.argv[4] === 'route';
const FID = 'portola-2026';
const TOKEN = 'liefiharness_0123456789ab'; // made up: never a real crew
const PID = 'pid_liefi_0001';
const PAINT_BUDGET_MS = 20000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function startServer() {
  let hang = false;
  const hung = [];
  let crew = {
    v: 4, meta: { name: '', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0, pid: PID }, Ross: { colorIndex: 3 } },
    festivals: { [FID]: { selections: { Robyn: { Kevin: 2 } } } },
  };
  const server = http.createServer((req, res) => {
    if (hang) { hung.push({ res, url: req.url, sw: req.headers['service-worker'] || '', mode: req.headers['sec-fetch-mode'] || '' }); return; }
    const url = new URL(req.url, 'http://x');
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    if (url.pathname.startsWith('/api/')) {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (url.pathname === '/api/crew') return send(200, JSON.stringify(crew));
        if (url.pathname === '/api/person') return send(200, JSON.stringify({ id: PID, doc: { v: 1, name: 'Kevin', crews: {} } }));
        if (url.pathname === '/api/festival-add') return send(200, JSON.stringify({ festivals: [] }));
        if (url.pathname === '/api/access') return send(200, JSON.stringify({ enabled: false, ownerClientId: '' }));
        return send(503, '{}');
      });
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/' || p.startsWith('/f/')) p = '/index.html';
    if (p.includes('..')) return send(403, 'no', 'text/plain');
    const file = path.join(ROOT, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'not found', 'text/plain');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    origin: `http://127.0.0.1:${server.address().port}`,
    setHang: (on) => { hang = on; },
    hung,
    close: () => { for (const h of hung) { try { h.res.destroy(); } catch { /* gone */ } } server.close(); },
  })));
}

async function runEngine(name) {
  const server = await startServer();
  const browser = await ENGINES[name].launch({ headless: true });
  const phone = name === 'webkit'
    ? { ...devices['iPhone 15'] }
    : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
  const context = await browser.newContext({ ...phone, serviceWorkers: 'allow' });
  await context.addInitScript(({ TOKEN, PID }) => {
    // The first moment #screen-app shows in THIS document, from its navigation start.
    const tick = () => {
      const el = document.getElementById('screen-app');
      if (el && getComputedStyle(el).display !== 'none') { window.__wallAt = performance.now(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (localStorage.getItem('liefi-seeded')) return;
    localStorage.setItem('liefi-seeded', '1');
    localStorage.setItem('fn_person_v1', JSON.stringify({ token: 'liefiharness_person_01234', id: PID, name: 'Kevin', crews: {} }));
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: TOKEN, name: '' }]));
    localStorage.setItem(`fn_me_v3_${TOKEN}`, 'Kevin');
    localStorage.setItem('fn_coach_v1', '1');
  }, { TOKEN, PID });
  const page = await context.newPage();
  const wall = () => page.waitForFunction(() => window.__wallAt !== undefined, null, { timeout: PAINT_BUDGET_MS, polling: 50 });
  const result = { engine: name, hang: VIA_ROUTE ? 'context.route (never answered)' : 'server switch (every request held)', online: [], lieFi: [] };
  try {
    await page.goto(`${server.origin}/f/${FID}#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
    await wall();
    result.online.push(Math.round(await page.evaluate(() => window.__wallAt)));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    await page.reload({ waitUntil: 'load' });
    await wall();
    result.online.push(Math.round(await page.evaluate(() => window.__wallAt)));
    await sleep(1500); // the worker finishes its cache writes
    result.cached = await page.evaluate(async (fid) => ({
      shell: !!(await caches.match('/')),
      index: !!(await caches.match('/data/festivals/index.json')),
      fest: !!(await caches.match(`/data/festivals/${fid}.json`)),
      doc: !!localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('fn_crew_doc_v3_')) || '_'),
      saved: Object.keys(localStorage).some((k) => k.startsWith('fn_crew_fest_v3_')),
    }), FID);

    if (VIA_ROUTE) await context.route('**/*', () => { /* never answered */ });
    else server.setHang(true);
    for (let i = 0; i < RUNS; i++) {
      const before = server.hung.length;
      const t0 = Date.now();
      let committed = true;
      try { await page.reload({ waitUntil: 'commit', timeout: PAINT_BUDGET_MS }); } catch { committed = false; }
      let paint = null;
      if (committed) {
        try { await wall(); paint = Math.round(await page.evaluate(() => window.__wallAt)); } catch { /* never painted */ }
      }
      result.lieFi.push({
        run: i + 1, committed, firstPaintMs: paint, wallClockMs: Date.now() - t0,
        heldThisRun: server.hung.slice(before).map((h) => `${h.sw ? 'SW ' : ''}${h.mode} ${h.url}`),
      });
    }
  } finally {
    await browser.close();
    server.close();
  }
  return result;
}

const engines = which === 'both' ? ['chromium', 'webkit'] : [which];
for (const e of engines) {
  const r = await runEngine(e);
  console.log(JSON.stringify(r, null, 2));
}
process.exit(0);
