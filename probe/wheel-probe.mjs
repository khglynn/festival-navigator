// TEMPORARY CI probe (deps/oct-bumps, 2026-10-19): why does Linux WebKit on
// Playwright 1.63 not scroll on a wheel sent before the held fonts land?
// Removed before the PR merges.
import test from 'node:test';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../tests/helpers/static-server.mjs';
import { launchWebkit, launchBrowser, lateStarts, motionDone } from '../tests/helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'acl-2026';
const CDT = (s) => new Date(`${s}-05:00`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const webkit = await launchWebkit();
const chromium = await launchBrowser();
test.after(async () => { if (webkit) await webkit.close(); if (chromium) await chromium.close(); await server.close(); });

async function open(engine) {
  const token = randomBytes(20).toString('base64url');
  const ctx = await engine.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: false, deviceScaleFactor: 2, timezoneId: 'America/Chicago', serviceWorkers: 'block' });
  await lateStarts(ctx);
  const doc = { v: 4, meta: { name: 'Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Ada: { colorIndex: 0 }, Bo: { colorIndex: 1 } }, festivals: { [FID]: { selections: { Lorde: { Ada: 4 } } } } };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET' ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }) : r.fulfill({ status: 503, body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  let letFontsIn = () => {};
  const gate = new Promise((go) => { letFontsIn = go; });
  await ctx.route('**/assets/fonts/*.woff2', async (r) => { await gate; await r.fallback(); });
  await ctx.addInitScript(([t, f]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Ada');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    for (const k of ['fn_coach_v1', 'fn_welcome_v1', 'fn_welcome_joined_v1', 'fn_errlog_off_v1']) localStorage.setItem(k, '1');
    window.__wheels = 0; window.__scrolls = 0; window.__sets = [];
    addEventListener('wheel', () => { window.__wheels += 1; }, { capture: true, passive: true });
    addEventListener('scroll', () => { window.__scrolls += 1; }, { capture: true, passive: true });
    const st = window.scrollTo.bind(window);
    window.scrollTo = (...a) => { window.__sets.push([Math.round(performance.now()), JSON.stringify(a)]); return st(...a); };
  }, [token, FID]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(CDT('2026-09-29T16:00:00'));
  await page.goto(`${server.origin}/#g=${token}&f=${FID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#wall-root .day-block', { timeout: 15000 });
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 15000 });
  return { ctx, page, letFontsIn };
}
const snap = (page) => page.evaluate(() => ({ t: Math.round(performance.now()), y: Math.round(scrollY), rs: document.readyState, fonts: document.fonts.status, wheels: window.__wheels, scrolls: window.__scrolls, sets: window.__sets.length, top: Math.round(document.querySelector('#wall-root .room[data-iso="2026-09-29"]').getBoundingClientRect().top), anims: document.getAnimations().filter((a) => a.playState === 'running').length }));

async function variant(engine, name, before) {
  const { ctx, page, letFontsIn } = await open(engine);
  const log = [];
  try {
    await sleep(1);
    log.push(['opened', await snap(page)]);
    await before(page, log);
    log.push(['before wheel', await snap(page)]);
    await page.mouse.move(640, 450);
    await page.mouse.wheel(0, -600);
    log.push(['wheel resolved', await snap(page)]);
    for (let i = 0; i < 12; i += 1) { await sleep(150); log.push([`+${(i + 1) * 150}`, await snap(page)]); }
    await page.mouse.wheel(0, -600);
    await sleep(600);
    log.push(['second wheel +600', await snap(page)]);
    letFontsIn();
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 8000 });
    await sleep(400);
    log.push(['fonts in', await snap(page)]);
    log.push(['scrollTo calls', await page.evaluate(() => window.__sets)]);
  } finally {
    console.log(`PROBE ${name}\n${log.map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n')}`);
    await ctx.close();
  }
}

for (const [engine, ename] of [[webkit, 'WebKit'], [chromium, 'Chromium']]) {
  test(`${ename} A: as the test does`, async () => variant(engine, `${ename} A`, async () => {}));
  test(`${ename} B: 3.5s before the wheel`, async () => variant(engine, `${ename} B`, async () => { await sleep(3500); }));
  test(`${ename} C: motionDone + two frames before the wheel`, async () => variant(engine, `${ename} C`, async (page) => {
    await motionDone(page).catch(() => {});
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }));
}
