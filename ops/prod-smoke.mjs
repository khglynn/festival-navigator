#!/usr/bin/env node
// prod-smoke.mjs — the post-ship smoke test for festival-navigator (2026-09-25).
//
// What it proves, in about half a minute:
//   1. All three production hosts answer service-worker.js with a 200, the
//      expected CACHE_VERSION and ASSET_STAMP, and identical bytes.
//   2. On every host, the crew-less landing screen boots in an iPhone-sized
//      WebKit with no page errors, console errors or failed requests.
//   3. On the base host, gallery.html (the fixture wall: real cards, zoom and
//      strip code, no crew, no database) renders its cards with no errors or
//      HTTP error responses (a 4xx/5xx the app swallows still fails it) —
//      far more of the shipped JS than the landing exercises.
//   4. Every file in the worker's APP_CORE list is byte-identical on all
//      three hosts, so a secondary host cannot serve different app code.
//   5. On the base host, the service worker really installs and caches the
//      expected build (a separate pass with workers allowed, landing only).
//
// READ-ONLY: it never loads a crew link (#g=...), so the app never has a crew
// to write to. On top of that the browser context blocks service workers (so
// every request passes the route guard — Playwright's routing cannot see
// requests a service worker handles), aborts EVERY non-GET/HEAD request on
// any URL, aborts all /fn-i/ telemetry, and fails the run if a page opens a
// WebSocket. Only step 5 lets a worker run, and only on the crew-less
// landing that step 2 has just proven makes no writes.
//
// Usage (run it from the RELEASE worktree, whose service-worker.js is the one
// that shipped — or pass the build explicitly):
//   node ops/prod-smoke.mjs [baseURL] [expectedBuild] [expectedStamp]
// Defaults: https://fest.kevinhg.com, and the CACHE_VERSION / ASSET_STAMP in
// this checkout's service-worker.js. SMOKE_OUT_DIR sets where screenshots and
// the JSON report land (default: fest-smoke in the OS temp dir, never the repo).
// Exit 0 = PASS; anything else = read the report.

import { webkit, devices } from 'playwright';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.SMOKE_OUT_DIR || path.join(os.tmpdir(), 'fest-smoke');
const HOSTS = ['fest.kevinhg.com', 'festival.kevinhg.com', 'crew.kevinhg.com'];

const local = localStamp();
const baseURL = (process.argv[2] || 'https://fest.kevinhg.com').replace(/\/+$/, '');
const expectedBuild = process.argv[3] || local.build;
const expectedStamp = process.argv[4] || (process.argv[3] ? null : local.stamp);
if (process.argv[3] && !process.argv[4]) {
  console.error('prod-smoke: pass the ASSET_STAMP with an explicit build (node ops/prod-smoke.mjs <base> <build> <stamp>)');
  process.exit(2);
}

function localStamp() {
  const sw = readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  return {
    build: (sw.match(/CACHE_VERSION\s*=\s*'([^']+)'/) || [])[1] || null,
    stamp: (sw.match(/ASSET_STAMP\s*=\s*'([^']+)'/) || [])[1] || null,
  };
}

const log = (...args) => console.log(new Date().toISOString(), ...args);

async function checkHost(host) {
  const url = `https://${host}/service-worker.js`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: 'manual', cache: 'no-store' });
    const text = await res.text();
    const r = {
      url,
      status: res.status,
      ms: Date.now() - t0,
      cacheVersion: (text.match(/CACHE_VERSION\s*=\s*'([^']+)'/) || [])[1] || null,
      assetStamp: (text.match(/ASSET_STAMP\s*=\s*'([^']+)'/) || [])[1] || null,
      md5: crypto.createHash('md5').update(text).digest('hex'),
    };
    r.ok = r.status === 200 && r.cacheVersion === expectedBuild &&
      (expectedStamp == null || r.assetStamp === expectedStamp);
    log(`[sw] ${host}: ${r.status} ${r.cacheVersion} ${r.assetStamp} md5=${r.md5.slice(0, 8)} ${r.ok ? 'ok' : 'MISMATCH'}`);
    return r;
  } catch (e) {
    log(`[sw] ${host}: FETCH FAILED — ${e && e.message}`);
    return { url, ok: false, error: String((e && e.message) || e) };
  }
}

// Every APP_CORE path, fetched from each host, must hash the same everywhere.
async function compareAppCore() {
  const swText = await (await fetch(`https://${HOSTS[0]}/service-worker.js`, { cache: 'no-store' })).text();
  const block = (swText.match(/const APP_CORE = \[([\s\S]*?)\];/) || [])[1] || '';
  const paths = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const mismatches = [];
  for (const p of paths) {
    const hashes = [];
    for (const host of HOSTS) {
      try {
        // Follow redirects (Vercel sends /index.html to / with a 308), but only
        // within the same host — landing somewhere else is a mismatch.
        const res = await fetch(`https://${host}${p}`, { redirect: 'follow', cache: 'no-store' });
        const buf = Buffer.from(await res.arrayBuffer());
        const sameHost = new URL(res.url).host === host;
        hashes.push(res.status === 200 && sameHost
          ? crypto.createHash('md5').update(buf).digest('hex')
          : `status ${res.status} at ${res.url}`);
      } catch (e) {
        hashes.push(`error ${e && e.message}`);
      }
    }
    if (new Set(hashes).size !== 1 || hashes[0].startsWith('status') || hashes[0].startsWith('error')) mismatches.push({ path: p, hashes });
  }
  const r = { files: paths.length, mismatches, ok: paths.length > 0 && mismatches.length === 0 };
  log(`[core] ${paths.length} APP_CORE files across ${HOSTS.length} hosts: ${r.ok ? 'identical' : `${mismatches.length} differ`}`);
  return r;
}

// Workers allowed, crew-less landing only: does the worker install and cache
// the expected build? (The guarded pass has already shown this page writes
// nothing.)
async function checkWorkerInstall(browser, target) {
  const context = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await context.newPage();
  const r = { target, ok: false };
  try {
    await page.goto(target, { waitUntil: 'load', timeout: 30000 });
    r.state = await page.evaluate(async () => {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 20000)),
      ]);
      if (!reg || !reg.active) return 'not active';
      // ready resolves while the worker may still be "activating".
      for (let i = 0; i < 100 && reg.active.state !== 'activated'; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return reg.active.state;
    });
    r.caches = await page.evaluate(() => caches.keys());
    r.ok = r.state === 'activated' && r.caches.some((k) => k.includes(expectedBuild));
  } catch (e) {
    r.error = String((e && e.message) || e);
  }
  await context.close();
  log(`[worker] ${target}: ${r.state || r.error} caches=${JSON.stringify(r.caches || [])} ${r.ok ? 'ok' : 'FAIL'}`);
  return r;
}

async function bootPage(browser, target, readySelector) {
  const t0 = Date.now();
  const context = await browser.newContext({ ...devices['iPhone 14'], serviceWorkers: 'block' });
  const blocked = [];
  const sockets = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = []; // a 4xx/5xx completes normally in Playwright; boot may swallow it

  await context.route('**/*', (route) => {
    const req = route.request();
    const method = req.method();
    const url = req.url();
    if (url.includes('/fn-i/') || (method !== 'GET' && method !== 'HEAD')) {
      blocked.push({ method, url });
      log(`[guard] aborted ${method} ${url}`);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });

  const page = await context.newPage();
  page.on('websocket', (ws) => sockets.push(ws.url()));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String((e && e.stack) || e)));
  page.on('response', (res) => {
    try {
      if (new URL(res.url()).host === new URL(target).host && res.status() >= 400) {
        httpErrors.push({ url: res.url(), status: res.status() });
      }
    } catch {}
  });
  page.on('requestfailed', (req) => {
    if (blocked.some((b) => b.url === req.url())) return;
    failedRequests.push({ url: req.url(), failure: req.failure() && req.failure().errorText });
  });

  let status = null;
  let navError = null;
  try {
    const resp = await page.goto(target, { waitUntil: 'load', timeout: 30000 });
    status = resp ? resp.status() : null;
  } catch (e) {
    navError = String((e && e.message) || e);
  }

  let ready = false;
  try {
    for (const sel of [].concat(readySelector)) {
      await page.waitForSelector(sel, { state: 'visible', timeout: 15000 });
    }
    ready = true;
  } catch {}
  await page.waitForTimeout(1500); // let late errors and deferred work land

  const slug = target.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_');
  const screenshot = path.join(OUT_DIR, `screenshot-${slug}.png`);
  try { await page.screenshot({ path: screenshot }); } catch {}
  await context.close();

  const r = {
    target, readySelector, status, navError, ready, ms: Date.now() - t0,
    consoleErrors, pageErrors, failedRequests, httpErrors, blocked, sockets, screenshot,
  };
  r.ok = status === 200 && ready && !navError && !consoleErrors.length &&
    !pageErrors.length && !failedRequests.length && !httpErrors.length && !blocked.length && !sockets.length;
  log(`[page] ${target}: ${status} ready=${ready} errors=${consoleErrors.length + pageErrors.length} ` +
    `failed=${failedRequests.length} http=${httpErrors.length} blocked=${blocked.length} sockets=${sockets.length} ${r.ok ? 'ok' : 'FAIL'}`);
  return r;
}

(async () => {
  const startedAt = Date.now();
  const report = { startedAt: new Date().toISOString(), baseURL, expectedBuild, expectedStamp, hosts: {}, pages: [] };
  if (!expectedBuild) throw new Error('no expected build: pass one, or run from a checkout with service-worker.js');
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const host of HOSTS) report.hosts[host] = await checkHost(host);
  const md5s = new Set(Object.values(report.hosts).map((h) => h.md5));
  report.hostsAgree = md5s.size === 1;
  report.appCore = await compareAppCore();

  // WebKit is the point (iPhone Safari); there is deliberately no fallback.
  let browser;
  try {
    browser = await webkit.launch({ headless: true });
  } catch (e) {
    report.browserError = `WebKit would not launch: ${e && e.message} (npx playwright install webkit)`;
    log(report.browserError);
  }
  if (browser) {
    for (const host of HOSTS) report.pages.push(await bootPage(browser, `https://${host}/`, '#screen-landing'));
    // Cards the gallery's own scripts render, not its static scaffolding.
    report.pages.push(await bootPage(browser, `${baseURL}/gallery.html`, ['#zoom-gallery .card', '#events-wall .card']));
    report.worker = await checkWorkerInstall(browser, `${baseURL}/`);
    await browser.close();
  }

  report.totalMs = Date.now() - startedAt;
  const reportPath = path.join(OUT_DIR, `report-${startedAt}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  const pass = report.hostsAgree && Object.values(report.hosts).every((h) => h.ok) && report.appCore.ok &&
    !report.browserError && report.pages.length === HOSTS.length + 1 && report.pages.every((p) => p.ok) &&
    report.worker && report.worker.ok;
  log(`report: ${reportPath}`);
  log(`${pass ? 'PASS' : 'FAIL'} — ${expectedBuild}${expectedStamp ? ` / ${expectedStamp}` : ''} in ${(report.totalMs / 1000).toFixed(1)} s`);
  process.exitCode = pass ? 0 : 1;
})().catch((e) => {
  log('FATAL', e && (e.stack || e));
  process.exitCode = 2;
});
