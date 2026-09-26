// The plan-days round's frame rig (2026-09-26): round two's rig
// (design/ours-r2/rig.mjs — the real app in one headless Chromium, /api
// answered in the page, every write refused, anything off this machine
// aborted, no database, no network), with this round's made-up crews and the
// design switch (window.__planDesign: which Despacio option, and whether the
// highlight filters) set before the app boots.
import { serveStatic } from '../../../tests/helpers/static-server.mjs';
import { crewDocDespacio, ME } from './crew-despacio.mjs';
import { crewDocAcl, ACL_ME } from './crew-acl.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
// Made up, assembled at run time — never a real crew link, never a literal in a file.
const TOKEN = ['plandays', 'designround', 'frames', '0926'].join('_');

export async function openRig() {
  const { chromium } = await import('playwright');
  const server = await serveStatic(ROOT);
  const browser = await chromium.launch({ headless: true });
  return { server, browser, close: async () => { await browser.close(); await server.close(); } };
}

// One page at 2x: a phone (touch, mobile) or a laptop (a mouse, no touch).
export async function openApp(rig, { now, width = 390, height = 844, desktop = false, fest = 'portola-2026', design = {}, fold = null } = {}) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop, serviceWorkers: 'block' });
  const origin = rig.server.origin;
  const doc = fest === 'acl-2026' ? crewDocAcl() : crewDocDespacio(fest);
  const me = fest === 'acl-2026' ? ACL_ME : ME;
  await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.fallback() : route.abort()));
  await ctx.route(`${origin}/api/**`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${origin}/api/crew**`, (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route(`${origin}/api/festival-add**`, (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route(`${origin}/fn-i/**`, (route) => route.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(([t, m, f, d, folded]) => {
    window.__planDesign = d;
    // A phone has a share sheet; headless Chromium does not. The frames show
    // what a phone shows ("Share …"); a tap on it is never made here.
    // A tap on it (the D frames) keeps what it was handed, for the report.
    if (!navigator.share && navigator.maxTouchPoints > 0) navigator.share = (d) => { window.__shared = d; return Promise.resolve(); };
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, m);
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
    if (folded) localStorage.setItem(`fn_fold_v1_${f}`, JSON.stringify(folded));
  }, [TOKEN, me, fest, design, fold]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
