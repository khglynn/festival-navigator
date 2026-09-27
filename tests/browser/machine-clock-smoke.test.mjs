// The one browser test on the machine's clock, on purpose (2026-09-27).
//
// Every other test runs at a moment it names or at the harness's TEST_CLOCK,
// a week before Portola (tests/README.md). That makes the suite
// deterministic, and it also means nothing else in it boots the app TODAY. So
// this one does: each live festival in the catalog, on a phone, at whatever
// hour the suite happens to run, in both engines. It asserts only what must
// be true at any hour: the app boots without a page error, the wall has
// cards, and exactly one day tab is lit and it is a day on the wall. It never
// names a card or a day. A named card is how a test on the machine's clock
// goes red by the hour: at 10 AM PDT on Portola Sunday, Saturday's cards
// folded away and three tests that reached for one failed on every branch.
//
// So that these rules cannot themselves flake by the hour, the same boot runs
// with a pinned Date at every kind of hour the two live festivals have (before,
// a live night, 3 AM, a folded day, the minutes around the 5 AM turn, ACL's
// late nights, between weekends, after) and must pass at each. If the
// machine-clock run goes red, something breaks at this hour, for real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, onMachineClock, NO_BROWSER } from '../helpers/browser.mjs';
import { shiftDate } from '../helpers/test-clock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The festivals a clock can move under: the catalog's scheduled ones.
const LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/festivals/index.json'), 'utf8'))
  .filter((f) => f.status === 'scheduled').map((f) => f.id);
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { await chromium?.close(); await webkit?.close(); await server.close(); });

// Boot `fid` on a phone for a made-up crew (never a real link). `clock` is
// 'machine' or a moment (epoch ms) that Date alone is moved to.
async function boot(browser, fid, clock) {
  const opts = { viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' };
  const ctx = clock === 'machine'
    ? await onMachineClock(browser, opts, 'the one smoke that boots the app today, at whatever hour the suite runs')
    : await browser.newContext(opts);
  try {
    if (clock !== 'machine') await ctx.addInitScript(shiftDate, clock);
    const CREW = randomBytes(20).toString('base64url');
    await ctx.addInitScript(([t, f]) => {
      navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Smoke' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    }, [CREW, fid]);
    const doc = { v: 4, meta: { name: 'Smoke', inviteFestId: fid }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [fid]: { selections: {} } } };
    // Playwright tries the LAST-registered matching route first: the catch-all goes first.
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await ctx.route('**/api/crew**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
    await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
    const page = await ctx.newPage();
    const errors = [];
    // A ResizeObserver loop notice at boot is the browser's, not the app's
    // (the day rail refits inside its own callback; tap-shelf's note).
    page.on('pageerror', (e) => { if (!/^ResizeObserver loop/.test(e.message)) errors.push(String(e)); });
    await page.goto(`${server.origin}/#g=${CREW}&f=${fid}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 0, null, { timeout: 15000 });
    // The open's landing and the scrollspy light a tab a frame or two later.
    await page.waitForFunction(() => document.querySelector('#dock-days .day-tab.active'), null, { timeout: 8000 }).catch(() => {});
    const seen = await page.evaluate(() => ({
      at: new Date().toString().slice(0, 21),
      cards: document.querySelectorAll('#wall-root .card').length,
      lit: [...document.querySelectorAll('#dock-days .day-tab.active')].map((t) => t.dataset.day),
      tabs: [...document.querySelectorAll('#dock-days .day-tab')].map((t) => t.dataset.day),
      blocks: [...document.querySelectorAll('#wall-root .day-block[data-day]')].map((b) => b.dataset.day),
    }));
    return { seen, errors };
  } finally {
    await ctx.close();
  }
}

// What must be true at any hour, and nothing that is true only at some.
function holdsAtAnyHour({ seen, errors }, what) {
  const said = `${what} (${JSON.stringify(seen)})`;
  assert.deepEqual(errors, [], `${what}: no page error`);
  assert.ok(seen.cards > 0, `${said}: the wall has cards`);
  assert.equal(seen.lit.length, 1, `${said}: exactly one day tab is lit`);
  assert.ok(seen.tabs.includes(seen.lit[0]) && seen.blocks.includes(seen.lit[0]), `${said}: the lit tab is a day on the wall`);
}

for (const [name, browser] of [['Chromium', chromium], ['WebKit', webkit]]) {
  test(`${name}: every live festival boots TODAY, on the machine's clock — no page error, cards on the wall, one lit tab that is a day on it`, { skip: browser ? false : NO_BROWSER }, async () => {
    assert.ok(LIVE.length > 0, 'the catalog has a live festival to boot');
    for (const fid of LIVE) holdsAtAnyHour(await boot(browser, fid, 'machine'), `${fid} at ${new Date().toISOString()}`);
  });
}

// Every kind of hour the live festivals have, so the rules above are known to
// hold at each. Local wall-clock moments in the festivals' own zones.
const HOURS = [
  ['a week before Portola', '2026-09-19T09:00:00-07:00'],
  ['Portola Thursday, afters live', '2026-09-24T22:00:00-07:00'],
  ['3 AM, Friday night’s afters', '2026-09-26T03:00:00-07:00'],
  ['Portola Saturday, the grid live', '2026-09-26T21:40:00-07:00'],
  ['Portola Sunday, Saturday folded', '2026-09-27T10:05:00-07:00'],
  ['4:55 AM Monday, Sunday’s last party', '2026-09-28T04:55:00-07:00'],
  ['5:05 AM Monday, Portola over', '2026-09-28T05:05:00-07:00'],
  ['an ACL late night between the weekends', '2026-09-29T20:00:00-05:00'],
  ['ACL’s first Saturday', '2026-10-03T14:00:00-05:00'],
  ['between ACL’s weekends', '2026-10-06T12:00:00-05:00'],
  ['ACL’s last night', '2026-10-11T23:30:00-05:00'],
  ['after ACL', '2026-10-13T12:00:00-05:00'],
  ['months later', '2027-01-15T12:00:00-06:00'],
];
test('the smoke’s rules hold at every kind of hour the live festivals have (Chromium, Date pinned at each)', { skip: chromium ? false : NO_BROWSER }, async () => {
  for (const [hour, at] of HOURS) {
    for (const fid of LIVE) holdsAtAnyHour(await boot(chromium, fid, Date.parse(at)), `${fid}, ${hour}`);
  }
});
