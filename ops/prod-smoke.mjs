#!/usr/bin/env node
// prod-smoke.mjs — a two-minute post-ship smoke test for festival-navigator.
//
// What it proves: production boots on a phone (an iPhone-sized WebKit — or
// touch Chromium if WebKit isn't installed — reaches the landing screen with
// no console/page errors and no failed requests), and that all three
// production hosts are serving the expected build (CACHE_VERSION +
// ASSET_STAMP from service-worker.js).
//
// READ-ONLY GUARANTEE: this script never creates a crew or person and never
// POSTs to /api/crew or /api/person. It never even navigates with a crew
// hash (#g=...), so the app boots straight to the crew-less landing screen.
// As a second line of defense (belt + suspenders — the app shouldn't try
// these on landing at all, but we abort+report if it ever does):
//   - ANY non-GET request to /api/* is aborted and logged as a finding.
//   - Any request to /fn-i/* (the PostHog telemetry relay, vercel.json) is
//     aborted too — a synthetic smoke run has no business writing real
//     events into Kevin's production PostHog project during a live festival.
//
// Usage:
//   node ops/prod-smoke.mjs [baseURL] [expectedBuild]
// Defaults:
//   baseURL      = https://fest.kevinhg.com
//   expectedBuild= the CACHE_VERSION in this checkout's service-worker.js
//
// Env:
//   SMOKE_OUT_DIR - where screenshots + report.json land (default: a
//                   fest-smoke folder in the OS temp dir, never the repo)
//
// It checks two pages: the crew-less landing screen, and gallery.html (the
// fixture wall: real cards, zoom and strip code with no crew and no
// database), which exercises far more of the shipped JS than the landing.
//
// Exit code: 0 if every host matches expectedBuild AND the browser check
// found zero console errors, zero page errors, zero failed requests, zero
// blocked-write attempts, and the landing screen rendered. Non-zero
// otherwise — read report.json for what failed.

import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.SMOKE_OUT_DIR || path.join(os.tmpdir(), 'fest-smoke');

const baseURL = (process.argv[2] || 'https://fest.kevinhg.com').replace(/\/+$/, '');
const expectedBuild = process.argv[3] || localBuild();

function localBuild() {
  const sw = readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  const m = sw.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error('prod-smoke: no CACHE_VERSION in service-worker.js — pass the expected build');
  return m[1];
}
const HOSTS = ['fest.kevinhg.com', 'festival.kevinhg.com', 'crew.kevinhg.com'];

const startedAt = Date.now();
const report = {
  startedAtISO: new Date().toISOString(),
  baseURL,
  expectedBuild,
  hosts: {},
  browser: null,
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function checkServiceWorker(host) {
  const url = `https://${host}/service-worker.js`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    const ms = Date.now() - t0;
    const cacheMatch = text.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    const stampMatch = text.match(/ASSET_STAMP\s*=\s*'([^']+)'/);
    const result = {
      url,
      status: res.status,
      ms,
      cacheVersion: cacheMatch ? cacheMatch[1] : null,
      assetStamp: stampMatch ? stampMatch[1] : null,
      matchesExpected: cacheMatch ? cacheMatch[1] === expectedBuild : false,
    };
    log(
      `[sw] ${host}: status=${result.status} ms=${ms} ` +
        `CACHE_VERSION=${result.cacheVersion} ASSET_STAMP=${result.assetStamp} ` +
        `matches=${result.matchesExpected}`
    );
    return result;
  } catch (e) {
    const ms = Date.now() - t0;
    log(`[sw] ${host}: FETCH FAILED (${ms}ms) — ${e && e.message}`);
    return { url, ms, error: String((e && e.message) || e) };
  }
}

async function runBrowserCheck(target, readySelector) {
  const t0 = Date.now();

  let engineName = 'webkit';
  let engine = webkit;
  let browser;
  try {
    browser = await engine.launch({ headless: true });
  } catch (e) {
    log(`[browser] webkit launch failed (${e && e.message}) — falling back to chromium`);
    engineName = 'chromium';
    engine = chromium;
    browser = await engine.launch({ headless: true });
  }
  log(`[browser] engine=${engineName}`);

  // devices['iPhone 14'] is authored for webkit (Safari UA, 390x664 CSS
  // viewport, hasTouch/isMobile). It works fine as a context descriptor for
  // a chromium fallback too — chromium just ignores the defaultBrowserType
  // hint and gets real touch + the iPhone viewport, which is what matters
  // for a phone smoke test.
  const deviceDescriptor = devices['iPhone 14'];
  const context = await browser.newContext({ ...deviceDescriptor });

  const blockedWrites = [];
  await context.route('**/*', (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (url.includes('/api/') && method !== 'GET') {
      blockedWrites.push({ url, method, reason: 'non-GET to /api/*' });
      log(`[GUARD] aborting non-GET /api/ request: ${method} ${url}`);
      return route.abort('blockedbyclient');
    }
    if (url.includes('/fn-i/')) {
      blockedWrites.push({ url, method, reason: 'posthog telemetry relay (fn-i) — kept out of prod analytics' });
      log(`[GUARD] aborting telemetry request: ${method} ${url}`);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String((err && err.stack) || err));
  });
  page.on('requestfailed', (req) => {
    // Requests we ourselves aborted via the guard show up here too — that's
    // expected and already recorded in blockedWrites; don't double-count
    // them as organic failures.
    const failure = req.failure();
    if (failure && failure.errorText === 'NS_BINDING_ABORTED') return;
    if (blockedWrites.some((b) => b.url === req.url())) return;
    failedRequests.push({ url: req.url(), method: req.method(), failure: failure && failure.errorText });
  });

  let navOk = false;
  let navError = null;
  try {
    // Never a crew hash (#g=...): the landing and the fixture gallery only.
    await page.goto(target, { waitUntil: 'load', timeout: 30000 });
    navOk = true;
  } catch (e) {
    navError = String((e && e.message) || e);
  }

  let landingVisible = false;
  try {
    await page.waitForSelector(readySelector, { state: 'visible', timeout: 15000 });
    landingVisible = true;
  } catch {
    landingVisible = false;
  }

  // Let deferred work (SW registration/activation, festival list fetch,
  // any late console errors) settle before we call it done.
  await page.waitForTimeout(1500);

  let screenshotPath = null;
  try {
    const slug = target.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_');
    screenshotPath = path.join(OUT_DIR, `screenshot-${slug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch (e) {
    log(`[browser] screenshot failed: ${e && e.message}`);
    screenshotPath = null;
  }

  let bodySample = null;
  let swRegistered = null;
  try {
    bodySample = await page.evaluate(() => document.body.innerText.slice(0, 400));
  } catch {}
  try {
    swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? (reg.active ? 'active' : reg.installing ? 'installing' : 'registered-no-worker') : 'none';
    });
  } catch (e) {
    swRegistered = `error: ${e && e.message}`;
  }

  await context.close();
  await browser.close();

  const ms = Date.now() - t0;
  const ok =
    navOk &&
    landingVisible &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0 &&
    failedRequests.length === 0 &&
    blockedWrites.length === 0;

  return {
    target,
    engine: engineName,
    ms,
    navOk,
    navError,
    landingVisible,
    swRegistered,
    consoleErrors,
    pageErrors,
    failedRequests,
    blockedWrites,
    screenshotPath,
    bodySample,
    ok,
  };
}

(async () => {
  for (const host of HOSTS) {
    report.hosts[host] = await checkServiceWorker(host);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  report.browser = await runBrowserCheck(`${baseURL}/`, '#screen-landing');
  report.gallery = await runBrowserCheck(`${baseURL}/gallery.html`, 'body *');

  report.totalMs = Date.now() - startedAt;

  const reportPath = path.join(OUT_DIR, `report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  log(`Report written to ${reportPath}`);
  log(`TOTAL WALL TIME: ${(report.totalMs / 1000).toFixed(1)}s`);

  const hostsOk = Object.values(report.hosts).every((h) => h.matchesExpected === true);
  const overallOk = hostsOk && report.browser?.ok && report.gallery?.ok;
  log(overallOk ? 'RESULT: PASS' : 'RESULT: FAIL — see report for detail');
  process.exitCode = overallOk ? 0 : 1;
})().catch((e) => {
  log('FATAL', e && (e.stack || e));
  process.exitCode = 2;
});
