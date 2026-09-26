// The OURS round-two frame rig (2026-09-25; round one's, plus a crew size): boots the REAL app in one headless
// Chromium against a made-up crew — the harness pattern from
// tests/browser/now-jump.test.mjs — so every frame is production HTML, CSS
// and cards. /api is answered inside the page (GET crew = crew.mjs; every
// write is refused 503) and any request that is not this machine's static
// server is aborted, so nothing reaches a database or the network.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../../../../tests/helpers/static-server.mjs';
import { crewDoc, ME } from './crew.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
export const REL = path.relative(ROOT, HERE); // the design folder, as served
const TOKEN = 'oursroundtwoframes_0123456'; // made up; never a real crew link

export async function openRig() {
  const { chromium } = await import('playwright');
  const server = await serveStatic(ROOT);
  const browser = await chromium.launch({ headless: true });
  return { server, browser, close: async () => { await browser.close(); await server.close(); } };
}

// One page: 390 x 844 CSS px at 2x, touch, the clock pinned.
export async function openApp(rig, { now, width = 390, height = 844, fold = null, crew = 9, desktop = false } = {}) {
  // A desktop frame is a mouse and a wide window (no touch, not mobile), so
  // the app takes its >=720 layout: the day rail on top, no dock, hover zooms.
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop, serviceWorkers: 'block' });
  const origin = rig.server.origin;
  await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.fallback() : route.abort()));
  await ctx.route(`${origin}/api/**`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${origin}/api/crew**`, (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(crewDoc('portola-2026', crew)) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route(`${origin}/api/festival-add**`, (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route(`${origin}/fn-i/**`, (route) => route.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(([t, me, folded]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, me);
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
    if (folded) localStorage.setItem('fn_fold_v1_portola-2026', JSON.stringify(folded));
  }, [TOKEN, ME, fold]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  return { ctx, page };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
