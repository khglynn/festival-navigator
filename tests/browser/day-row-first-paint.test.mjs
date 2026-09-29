// The day row's first paint lights the day you are in (2026-09-29, the "FRI
// flash on open" banked in NOW.md since 2026-09-26). The wall is drawn whole —
// on open, and again whenever the day turns under an open page or a phone
// comes back from the lock screen — and every one of those draws wired the
// scrollspy (wall.js wireScrollspy) INSIDE the repaint, before the caller had
// put the page where it belongs (app.js maybeOpenOnDay on open, keepWallPlace
// after the day turns). The spy lit a day at once against that unplaced page
// — the first block on the wall at the top, else whatever the page's OLD
// scroll now pointed at in the NEW wall — and started the row gliding to it;
// the right day came a frame later, or whenever the landing's scroll event
// arrived. Kevin saw FRI for about a second on an ACL Saturday; v104's
// builder saw THU before SAT when Portola's day turned (V103-BUILD.md).
//
// Each case samples the row from the page's first frames: which day is lit
// when every frame BEGINS (before the app's own frame callbacks can fix it)
// and after every paint (a message posted from the frame, which runs once the
// frame has rendered). Every sample that lights a day must light the day the
// page settles on. Both engines, a 390 phone, and once more with late
// animation starts (LATE_ANIMATIONS_MS) where the suite runs that way.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { fontsIn, launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

// Records, from the first frame on, what the dock's row shows. Installed
// before any page script, so its frame callback is the first of every frame.
function recordFrames() {
  window.__rowFrames = [];
  const t0 = performance.now();
  const read = () => {
    const row = document.getElementById('dock-days');
    const lit = row ? [...row.querySelectorAll('.day-tab.active')].map((t) => t.dataset.day) : [];
    return { lit: lit.join(' + '), left: row ? Math.round(row.scrollLeft) : null, y: Math.round(window.scrollY) };
  };
  const post = new MessageChannel();
  post.port1.onmessage = () => window.__rowFrames.push({ at: 'painted', t: Math.round(performance.now() - t0), ...read() });
  const frame = () => {
    window.__rowFrames.push({ at: 'frame', t: Math.round(performance.now() - t0), ...read() });
    post.port2.postMessage(0); // runs once this frame has rendered
    if (window.__rowFrames.length < 4000) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function open(engine, { fid, tz, at }) {
  const token = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2, timezoneId: tz, serviceWorkers: 'block' });
  await lateStarts(ctx);
  const doc = { v: 4, meta: { name: 'Crew', inviteFestId: fid }, spotify: {}, affinity: {}, people: { Ada: { colorIndex: 0 } }, festivals: { [fid]: { selections: {} } } };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(([t, f]) => {
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Ada');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    for (const k of ['fn_welcome_v1', 'fn_welcome_joined_v1', 'fn_coach_v1', 'fn_errlog_off_v1']) localStorage.setItem(k, '1');
  }, [token, fid]);
  await ctx.addInitScript(recordFrames);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  await page.goto(`${server.origin}/#g=${token}&f=${fid}`, { waitUntil: 'load' });
  await page.waitForSelector('#wall-root .day-block', { timeout: 20000 });
  await fontsIn(page);
  await motionDone(page);
  return { ctx, page, errors: () => errors };
}

// The row at rest: the lit day the same for a run of frames, and the row still.
async function settled(page) {
  await page.waitForFunction(() => {
    const f = window.__rowFrames;
    const last = f.slice(-24);
    return last.length === 24 && last.every((x) => x.lit && x.lit === last[0].lit && x.left === last[0].left);
  }, null, { timeout: 8000, polling: 100 });
  return page.evaluate(() => window.__rowFrames[window.__rowFrames.length - 1]);
}

// Every sample from `from` on that lights a day lights `day`.
async function wrongFrames(page, day, from = 0) {
  const frames = await page.evaluate(() => window.__rowFrames);
  return frames.slice(from).filter((f) => f.lit && f.lit !== day)
    .map((f) => `${f.at} ${f.t}ms: ${f.lit} (y ${f.y}, row ${f.left})`);
}

const ENGINES = [['Chromium', chromium], ['WebKit', webkit]];

for (const [name, engine] of ENGINES) {
  // The brief's own case, the control: Friday is over and folded away, so the
  // first block on the wall is Saturday's.
  test(`${name}: ACL opened on Saturday afternoon lights SAT 3 from the first frame`, { skip: engine ? false : NO_BROWSER }, async () => {
    const { ctx, page, errors } = await open(engine, { fid: 'acl-2026', tz: 'America/Chicago', at: new Date('2026-10-03T15:00:00-05:00') });
    try {
      const end = await settled(page);
      assert.equal(end.lit, 'Saturday|W1');
      assert.deepEqual(await wrongFrames(page, end.lit), []);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });

  // An open that lands past the first block: late on Saturday the landing is
  // the Late nights tab, and the spy lit SAT 3 (the first block) until the
  // landing's scroll event came back to it.
  test(`${name}: ACL opened on Saturday at 11:30 PM lights LATE from the first frame`, { skip: engine ? false : NO_BROWSER }, async () => {
    const { ctx, page, errors } = await open(engine, { fid: 'acl-2026', tz: 'America/Chicago', at: new Date('2026-10-03T23:30:00-05:00') });
    try {
      const end = await settled(page);
      assert.equal(end.lit, 'Late nights', 'the landing is the Late nights now line');
      assert.deepEqual(await wrongFrames(page, end.lit), []);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });

  // The day turning under an open page, the phone shown again (v104's case):
  // Portola read on Saturday night, then Tuesday — the record is drawn whole
  // again (THU and FRI come back above), the place is held, and the spy used
  // to light FRI, from the old scroll, before the place was held.
  test(`${name}: the day turning under an open page never lights the day the old scroll pointed at`, { skip: engine ? false : NO_BROWSER }, async () => {
    const { ctx, page, errors } = await open(engine, { fid: 'portola-2026', tz: 'America/Los_Angeles', at: new Date('2026-09-26T22:30:00-07:00') });
    try {
      const before = await settled(page);
      assert.equal(before.lit, 'Saturday');
      const from = await page.evaluate(() => window.__rowFrames.length);
      await page.clock.setFixedTime(new Date('2026-09-29T12:00:00-07:00'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // the page shown again: the past is judged again
      await page.waitForFunction(() => document.querySelectorAll('#wall-root .day-block').length === 4, null, { timeout: 5000 });
      const end = await settled(page);
      assert.equal(end.lit, 'Saturday', 'the place is held: still Saturday');
      assert.deepEqual(await wrongFrames(page, end.lit, from), []);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });
}
