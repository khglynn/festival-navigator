// TEMPORARY CI probe (deps/oct-bumps, 2026-10-19): why does Linux WebKit on
// Playwright 1.63 miss the List after Board -> List in list-view.test.mjs?
// Removed before the PR merges.
import test from 'node:test';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../tests/helpers/static-server.mjs';
import { launchWebkit, lateStarts, motionDone } from '../tests/helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const webkit = await launchWebkit();
test.after(async () => { if (webkit) await webkit.close(); await server.close(); });
const FID = 'portola-2026';

async function open() {
  const CREW = randomBytes(20).toString('base64url');
  const ctx = await webkit.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' });
  await lateStarts(ctx);
  const doc = { v: 4, meta: { name: 'List Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } }, festivals: { [FID]: { selections: { Tricky: { Kevin: 2 }, 'Tove Lo': { Maya: 4 } } } } };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() !== 'GET' ? r.fulfill({ status: 503, body: '{}' }) : r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'List Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    localStorage.setItem('fn_welcome_v1', '1');
    localStorage.setItem('fn_welcome_joined_v1', '1');
    if (!sessionStorage.getItem('seeded')) localStorage.setItem('fn_view_v1_portola-2026', 'list');
    sessionStorage.setItem('seeded', '1');
    window.__ev = [];
    for (const t of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click']) {
      addEventListener(t, (e) => { const v = e.target && e.target.closest && e.target.closest('[data-view]'); window.__ev.push(`${Math.round(performance.now())} ${t}${e.pointerType !== undefined ? `(${e.pointerType})` : ''} ${v ? `view=${v.dataset.view}` : (e.target && e.target.className && String(e.target.className).slice(0, 30)) || e.target && e.target.tagName}${e.defaultPrevented ? ' PREVENTED' : ''}`); }, { capture: true });
    }
  }, [CREW]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-09-26T16:15:00-07:00'));
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#wall-root .card', { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(900);
  return { ctx, page };
}
const state = (page, sel) => page.evaluate((s) => {
  const b = document.querySelector(s);
  const r = b ? b.getBoundingClientRect() : null;
  const hit = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
  return {
    t: Math.round(performance.now()), view: document.getElementById('wall-root').dataset.view || '-', grid: document.querySelectorAll('#wall-root .times-grid').length,
    sel: [...document.querySelectorAll('#dock-fest-wrap .view-row [data-view]')].map((x) => `${x.dataset.view}:${x.getAttribute('aria-selected')}`).join(' '),
    open: document.getElementById('dock-fest-link').getAttribute('aria-expanded'), box: r && [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    hit: hit ? `${hit.tagName}.${String(hit.className).slice(0, 30)}${hit.closest('[data-view]') ? ` in view=${hit.closest('[data-view]').dataset.view}` : ''}` : null,
    anims: document.getAnimations().filter((a) => a.playState === 'running').map((a) => `${a.effect && a.effect.target ? (a.effect.target.id || a.effect.target.className || a.effect.target.tagName) : '?'}`).slice(0, 6), y: Math.round(scrollY),
  };
}, sel);
async function tap(page, sel, log, label) {
  log.push([`${label} before`, await state(page, sel)]);
  const b = await page.locator(sel).first().boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  for (const ms of [0, 150, 450, 900, 1800, 3000]) { if (ms) await sleep(ms - (log.lastMs || 0)); log.lastMs = ms; log.push([`${label} +${ms}`, await state(page, sel)]); }
  log.lastMs = 0;
}
for (let run = 1; run <= 6; run += 1) {
  test(`WebKit 390 probe run ${run}`, async () => {
    const { ctx, page } = await open();
    const log = [];
    try {
      await page.evaluate(() => { const el = document.querySelector('.day-block[data-day="Saturday"] .room[data-room=":fest"] .card[data-artist="Tove Lo"]'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 260); });
      await sleep(700);
      await tap(page, '#dock-fest-link', log, 'door');
      await tap(page, '#dock-fest-wrap .view-row [data-view="board"]', log, 'board');
      await motionDone(page, { within: '#wall-root' });
      await tap(page, '#dock-fest-wrap .view-row [data-view="list"]', log, 'list');
      log.push(['events', await page.evaluate(() => window.__ev.slice(-30))]);
    } finally {
      console.log(`PROBE run ${run}\n${log.map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n')}`);
      await ctx.close();
    }
  });
}
