// Where a stop ends, in the real app (the plan-days build's P4, 2026-09-27;
// DESIGN.md "Banked from the Share release: where a stop ends"). The model's
// sweep is tests/plan-stop-ends.test.mjs; this is acceptance test 5 — the
// dock's NOW tab and the peek's NOW never show together — minute by minute
// across Sunday's Zara Larsson set ending, where the route used to run on ten
// minutes past her set (the peek said "NOW · Zara Larsson · till 8:05 PM"
// until 8:15). The made-up nine (tests/fixtures/plan-crew-nine.json), /api
// answered in the page, every write refused. Under a highlight the one-NOW
// rule is Kevin's open question (the plan-days build log, P3), so this runs
// on the whole crew only.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { fontsIn, launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NINE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const FID = 'portola-2026';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const SUN = (hm) => new Date(`2026-09-27T${hm}:00-07:00`);

async function open(engine, { at, desk = false }) {
  const crewToken = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block',
  });
  await lateStarts(ctx);
  const doc = {
    v: 4, meta: { name: 'Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(NINE.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: NINE.picks } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t, f]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Gus');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
  }, [crewToken, FID]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  await page.goto(`${server.origin}/#g=${crewToken}&f=${FID}`);
  await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
  await fontsIn(page);
  await motionDone(page);
  return { ctx, page, errors };
}

// The minute's tick as the page runs it on a shown page (app.js tickClock:
// the wall judges the past again and repaints, and with it the plan and the
// NOW tab), then the page at rest.
async function tick(page, at) {
  await page.clock.setFixedTime(at);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(60);
  await motionDone(page);
}

// What a person sees: the dock's (or the laptop rail's) NOW tab, and the
// plan's NOW row — each only if it is on screen.
const seen = (page) => page.evaluate(() => {
  const shown = (el) => {
    if (!el || el.hidden || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth;
  };
  const tab = innerWidth >= 720 ? document.getElementById('rail-now') : document.getElementById('dock-now');
  const plan = document.getElementById('plan');
  const row = plan && !plan.hidden ? plan.querySelector('.plan-row[data-tag="now"]') : null;
  return {
    tab: shown(tab),
    now: shown(row) ? row.getAttribute('aria-label') : null,
    state: plan && !plan.hidden ? plan.dataset.state : 'none',
  };
});
const planState = (page) => page.evaluate(() => { const el = document.getElementById('plan'); return el && !el.hidden ? el.dataset.state : 'none'; });
async function openPlan(page, desk) {
  const box = await page.locator(desk ? '#plan .plan-row.tagged' : '#plan .plan-grab').boundingBox();
  await page.mouse.click(box.x + box.width * (desk ? 0.4 : 0.5), box.y + box.height / 2);
  await motionDone(page);
  await sleep(450);
  assert.equal(await planState(page), 'open');
}

// Every minute from 7:58 to 8:22 PM: Zara Larsson ends at 8:05, the crew's
// ten minutes of Tiësto run to 8:15, a five-minute walk, Overmono from 8:20.
const MINUTES = Array.from({ length: 25 }, (_, i) => { const m = 20 * 60 - 2 + i; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
const inZara = (hm) => hm < '20:05';
const inTiesto = (hm) => hm >= '20:05' && hm < '20:15';

for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  for (const [how, desk, opened] of [['390, the peek', false, false], ['390, the open plan', false, true], ['1280, the corner card', true, false]]) {
    test(`${name} ${how}: Sunday 7:58 to 8:22 PM, minute by minute — the NOW tab and the plan's NOW never show together, and NOW is never a set that is over`, { skip }, async () => {
      const { ctx, page, errors } = await open(engine, { at: SUN(MINUTES[0]), desk });
      try {
        if (opened) await openPlan(page, desk);
        const log = [];
        for (const hm of MINUTES) {
          await tick(page, SUN(hm));
          const s = await seen(page);
          log.push(`${hm} tab:${s.tab ? 'shown' : '-'} now:${s.now || '-'}`);
          assert.ok(!(s.tab && s.now), `${hm}: the NOW tab and the plan's NOW both show (${s.now})\n${log.join('\n')}`);
          if (inZara(hm)) assert.match(s.now || '', /^Now: Zara Larsson/, `${hm}: her set is on\n${log.join('\n')}`);
          if (inTiesto(hm)) assert.match(s.now || '', /^Now: Tiësto, Warehouse, till 8:15 PM/, `${hm}: Zara Larsson ended at 8:05; the crew is at Tiësto\n${log.join('\n')}`);
          if (hm >= '20:05') assert.doesNotMatch(s.now || '', /Zara Larsson/, `${hm}: her set is over\n${log.join('\n')}`);
          if (opened) assert.equal(s.state, 'open', `${hm}: the plan stays open across the minutes`);
        }
        assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
      } finally { await ctx.close(); }
    });
  }
}
