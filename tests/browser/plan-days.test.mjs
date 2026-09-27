// Our picks across the days (the plan-days build, 2026-09-26), with real
// input. The open plan lands on today and keeps going: every later night
// under the wall's own day heads, what is over folded behind one Earlier line
// (a date span past three nights, ACL), a run of bare nights one head with
// its reason. The head and the Share follow the day at the top of the view —
// the weekday turns over like a page number (instant under Reduce Motion) and
// the Share names and sends that day, from now for today and whole for any
// other. The last day can come to the top. A link for a later night opens the
// plan scrolled to it; the laptop's corner card stays today's. The real app,
// the made-up crews (tests/fixtures/plan-crew-nine.json on Portola,
// plan-crew-acl.json on ACL), /api answered in the page, every write refused;
// navigator.share is a stub that keeps what it was handed. DESIGN.md B1–B4
// (claude-plans/2026-09-26-unified-build/plan-days-design).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { fontsIn, launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (f) => JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures', f), 'utf8'));
const CREWS = {
  'portola-2026': { ...fixture('plan-crew-nine.json'), me: 'Gus', tz: 'America/Los_Angeles' },
  'acl-2026': { ...fixture('plan-crew-acl.json'), tz: 'America/Chicago' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const SAT_940 = new Date('2026-09-26T21:40:00-07:00');     // Portola: Dog Blood on the Pier Stage, 8 picked
const ACL_W1_SUN = new Date('2026-10-04T19:00:00-05:00');  // ACL W1 Sunday: Mon and Tue ahead have nothing picked
const ACL_W2_SAT = new Date('2026-10-10T16:00:00-05:00');  // ACL W2 Saturday: nine nights behind, a short Sunday ahead
const QUIET_MS = 450; // the shelf swallows the click just after a tap or a drag (plan-shelf.js quietUntil, 400)

// `fest`: which festival and made-up crew. `plan`: the link's &plan=<night>.
// `desk`: a laptop. `reduced`: Reduce Motion. `at`: the clock.
async function open(engine, { fest = 'portola-2026', at = SAT_940, plan = null, desk = false, reduced = false } = {}) {
  const crew = CREWS[fest];
  const crewToken = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, deviceScaleFactor: 2, timezoneId: crew.tz, serviceWorkers: 'block',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await lateStarts(ctx);
  // The head's turn, as the page asks for it: every animation started on the
  // head's weekday or date, with its first frame and its length.
  await ctx.addInitScript(() => {
    window.__turns = [];
    // The list's scroll positions, each with whether the window itself was
    // still moving (its own grow, not the rows'): the later-night glide.
    window.__glide = [];
    document.addEventListener('scroll', (e) => {
      const list = e.target;
      if (!(list instanceof Element) || !list.matches('#plan .plan-list') || window.__glide.length > 500) return;
      const plan = document.getElementById('plan');
      const moving = plan.getAnimations().some((a) => a.playState === 'running' && a.effect.getComputedTiming().endTime !== Infinity);
      window.__glide.push({ top: list.scrollTop, moving });
    }, true);
    const animate = Element.prototype.animate;
    Element.prototype.animate = function recorded(frames, opts) {
      if (this.matches && this.matches('#plan .plan-head .wd, #plan .plan-head .sub')) {
        window.__turns.push({ part: this.className, from: (frames[0] || {}).transform, duration: typeof opts === 'number' ? opts : (opts || {}).duration });
      }
      return animate.call(this, frames, opts);
    };
  });
  const doc = {
    v: 4, meta: { name: 'Crew', inviteFestId: fest }, spotify: {}, affinity: {},
    people: Object.fromEntries(crew.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [fest]: { selections: crew.picks } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t, f, me]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, me);
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
    window.__shared = [];
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } });
  }, [crewToken, fest, crew.me]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  await page.goto(`${server.origin}/#g=${crewToken}&f=${fest}${plan ? `&plan=${plan}` : ''}`);
  await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
  await fontsIn(page);
  await settled(page);
  return { ctx, page, errors, crewToken };
}
const settled = async (page) => { await motionDone(page, { within: '#plan' }); await sleep(QUIET_MS); };
// Poll from Node, in real time, until `ok` (a timer inside the page runs on
// the fake clock: the harness traps).
async function until(ok, what, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ok()) return; await sleep(50); }
  assert.fail(`timed out waiting: ${what}`);
}
const planState = (page) => page.evaluate(() => { const el = document.getElementById('plan'); return el && !el.hidden ? el.dataset.state : 'none'; });
async function openPlan(page) {
  const box = await page.locator('#plan .plan-grab').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settled(page);
  assert.equal(await planState(page), 'open');
}
// What the head, the Share and the list say right now.
const read = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const list = q('#plan .plan-list');
  return {
    wd: (q('#plan .plan-head .wd') || {}).textContent || '',
    sub: (q('#plan .plan-head .sub') || {}).textContent || '',
    share: q('#plan .plan-share').textContent.trim(),
    shareOff: q('#plan .plan-share').disabled,
    top: list.scrollTop, room: list.scrollHeight - list.clientHeight - list.scrollTop,
  };
});
// Where a night's first row sits under the list's top edge (0: at the top).
const nightTop = (page, night) => page.evaluate((n) => {
  const list = document.querySelector('#plan .plan-list');
  const row = [...list.children].find((r) => r.dataset.night === n);
  return row ? row.getBoundingClientRect().top - list.getBoundingClientRect().top : null;
}, night);
// Scroll the open list with a real wheel over it, and wait for it to stop.
async function wheel(page, dy) {
  const box = await page.locator('#plan .plan-list').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  for (let left = dy; Math.abs(left) > 0.5;) {
    const step = Math.sign(left) * Math.min(Math.abs(left), 240);
    await page.mouse.wheel(0, step);
    left -= step;
    await sleep(40);
  }
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() => document.querySelector('#plan .plan-list').scrollTop);
    if (Math.abs(now - last) < 0.5) break;
    last = now;
    await sleep(80);
  }
  await sleep(250);
}
// A wheel can land short or long: measure and scroll again until the night's
// first row is at the top (or the list can go no further).
async function scrollToNight(page, night) {
  for (let pass = 0; pass < 6; pass++) {
    const dy = await nightTop(page, night);
    assert.notEqual(dy, null, `a row for ${night} in the open plan`);
    const { room, top } = await read(page);
    if (Math.abs(dy) <= 2 || (dy > 0 && room < 1) || (dy < 0 && top < 1)) return;
    await wheel(page, dy);
  }
}
// Every picks line of a shared text is a row of that night in the open plan.
async function linesInNight(page, text, night) {
  const rows = await page.evaluate((n) => [...document.querySelectorAll('#plan .plan-row')]
    .filter((r) => r.dataset.night === n && !r.classList.contains('past')).map((r) => r.textContent), night);
  const lines = text.split('\n');
  const picks = lines.slice(2, lines.indexOf('', 2));
  assert.ok(picks.length > 0, text);
  for (const line of picks) {
    const [where, act] = line.split(' @ ')[0].split(' for ');
    assert.ok(rows.some((r) => r.includes(where) && (!act || r.includes(act.split(/, | and /)[0]))), `"${line}" is a ${night} row:\n${rows.join('\n')}`);
  }
}
async function share(page) {
  const box = await page.locator('#plan .plan-share').boundingBox();
  const before = await page.evaluate(() => window.__shared.length);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(150);
  const all = await page.evaluate(() => window.__shared);
  assert.equal(all.length, before + 1, 'the sheet was handed one text');
  return all[all.length - 1].text;
}

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : NO_BROWSER;

  test(`${name}: the head and the Share follow the day at the top — Sunday turns up into the head as it scrolls in, and Saturday back down`, { skip }, async () => {
    const { ctx, page, errors, crewToken } = await open(get());
    try {
      await openPlan(page);
      let r = await read(page);
      assert.deepEqual([r.wd, r.sub, r.share], ['SAT', 'Sep 26 · 9 picking', 'Share today’s picks']);
      await page.evaluate(() => { window.__turns = []; });
      await scrollToNight(page, '2026-09-27');
      r = await read(page);
      assert.deepEqual([r.wd, r.sub, r.share], ['SUN', 'Sep 27 · 9 picking', 'Share Sunday’s picks'], 'the day at the top names the head and the Share');
      const up = await page.evaluate(() => window.__turns);
      assert.ok(up.length >= 2 && up.every((t) => t.from === 'translateY(10px)' && t.duration === 200), `the weekday and date rise in from below: ${JSON.stringify(up)}`);
      // Sunday's Share is Sunday, whole: no "now", and a link that opens on it.
      const sun = await share(page);
      assert.match(sun, /^Our crew's main picks for Sun Portola\n\n/);
      assert.doesNotMatch(sun, /now till|@ now/);
      assert.ok(sun.endsWith(`Full rundown: ${server.origin}/f/portola-2026#g=${crewToken}&f=portola-2026&plan=2026-09-27`), sun);
      await linesInNight(page, sun, '2026-09-27');
      await page.evaluate(() => { window.__turns = []; });
      await wheel(page, -(await read(page)).top);
      r = await read(page);
      assert.deepEqual([r.wd, r.sub, r.share], ['SAT', 'Sep 26 · 9 picking', 'Share today’s picks']);
      const down = await page.evaluate(() => window.__turns);
      assert.ok(down.length >= 2 && down.every((t) => t.from === 'translateY(-10px)'), `back up, Saturday comes down from above: ${JSON.stringify(down)}`);
      const sat = await share(page);
      assert.match(sat, /^Our crew's main picks for Sat Portola, now till end of day\n\nPier Stage for Dog Blood @ now till 10:15pm\n/);
      assert.ok(sat.endsWith('&plan=2026-09-26'), sat);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}, Reduce Motion: the head changes day at once, with no turn`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { reduced: true });
    try {
      await openPlan(page);
      await page.evaluate(() => { window.__turns = []; });
      await scrollToNight(page, '2026-09-27');
      const r = await read(page);
      assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sunday’s picks']);
      assert.deepEqual(await page.evaluate(() => window.__turns), [], 'nothing animates under Reduce Motion');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // DESIGN.md B1's spirit, decided in the build (BUILD.md P2): a link for a
  // later night opens the plan scrolled to that night, since that is what
  // its words were about. A link for a night already over still lands on the
  // wall with its peek (plan-share's "a plan link for another night").
  test(`${name}: a link for a later night opens the plan on that night, and the peek stays tonight's`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { plan: '2026-09-27' });
    try {
      await page.waitForSelector('#plan[data-state="open"]', { timeout: 8000 });
      // It opens on tonight, then glides to Sunday once it has landed.
      await until(async () => Math.abs(await nightTop(page, '2026-09-27')) <= 2, 'the list glides to Sunday');
      await settled(page);
      const r = await read(page);
      assert.deepEqual([r.wd, r.sub, r.share], ['SUN', 'Sep 27 · 9 picking', 'Share Sunday’s picks']);
      assert.ok(Math.abs(await nightTop(page, '2026-09-27')) <= 2, 'Sunday’s head is at the top of the list');
      // The window grew from tonight's row, and only then did the list move:
      // through the rows between, not in one jump, the head turning over
      // once, upward, as Sunday reached the top.
      const glide = (await page.evaluate(() => window.__glide)).filter((g) => g.top > 0);
      assert.ok(glide.length > 0 && glide.every((g) => !g.moving), `the list moved only once the window had landed: ${JSON.stringify(glide.slice(0, 4))}`);
      assert.ok(new Set(glide.map((g) => g.top)).size >= 3, `it glided, through the rows between: ${JSON.stringify(glide.map((g) => g.top))}`);
      const turns = await page.evaluate(() => window.__turns);
      assert.deepEqual(turns.map((t) => [t.part, t.from]), [['wd', 'translateY(10px)'], ['sub', 'translateY(10px)']], 'the head turned over once, as Sunday arrived');
      // The peek is still tonight's: closing goes back to Dog Blood.
      const box = await page.locator('#plan .plan-grab').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await settled(page);
      assert.equal(await planState(page), 'peek');
      assert.match(await page.locator('#plan .plan-row.tagged').getAttribute('aria-label'), /^Now: Dog Blood, Pier Stage/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: the last day can come to the top — ACL's short Sunday under W2 Saturday, named in the head and the Share`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { fest: 'acl-2026', at: ACL_W2_SAT });
    try {
      await openPlan(page);
      await wheel(page, 4000);
      const r = await read(page);
      assert.ok(r.room < 1, 'at the end of the list');
      assert.ok(Math.abs(await nightTop(page, '2026-10-11')) <= 2, `Sunday’s head reached the top: ${await nightTop(page, '2026-10-11')}`);
      assert.deepEqual([r.wd, r.sub, r.share], ['SUN', 'Oct 11 · 8 picking', 'Share Sun Oct 11’s picks'], 'a weekday that repeats is called by its date');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: Earlier folds what is over — a date span past three nights (ACL), the weekdays and today's stops on Portola — and opens it dimmed under its heads`, { skip }, async () => {
    let { ctx, page, errors } = await open(get(), { fest: 'acl-2026', at: ACL_W2_SAT });
    try {
      await openPlan(page);
      const earlier = page.locator('#plan .plan-row.earlier');
      assert.equal((await earlier.textContent()).trim(), 'Earlier · Sep 29 – Oct 9');
      const box = await earlier.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await settled(page);
      assert.equal((await earlier.textContent()).trim(), 'Hide earlier');
      const past = await page.evaluate(() => [...document.querySelectorAll('#plan .plan-day')]
        .filter((h) => h.classList.contains('past')).map((h) => h.textContent.trim().replace(/\s+/g, ' ')));
      assert.deepEqual(past, ['TUESep 29', 'THUOct 1', 'FRIOct 2', 'SATOct 3', 'SUNOct 4', 'MON · TUEOct 5 – 6', 'THUOct 8', 'FRIOct 9'],
        'every night behind under its own head, dimmed — a bare run still one head');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await settled(page);
      assert.equal((await earlier.textContent()).trim(), 'Earlier · Sep 29 – Oct 9');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
    ({ ctx, page, errors } = await open(get()));
    try {
      await openPlan(page);
      assert.equal((await page.locator('#plan .plan-row.earlier').textContent()).trim(), 'Earlier · Thu · Fri · 8 stops');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a run of bare nights is one head and its reason, and its Share rests (ACL's Mon and Tue)`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { fest: 'acl-2026', at: ACL_W1_SUN });
    try {
      await openPlan(page);
      const run = await page.evaluate(() => {
        const head = document.querySelector('#plan .plan-day[data-night="2026-10-05"]');
        const next = head && head.nextElementSibling;
        return head && { head: head.textContent.trim().replace(/\s+/g, ' '), line: next.textContent.trim(), empty: next.classList.contains('empty'),
          tue: !!document.querySelector('#plan .plan-day[data-night="2026-10-06"]') };
      });
      assert.deepEqual(run, { head: 'MON · TUEOct 5 – 6', line: 'Nothing picked yet', empty: true, tue: false });
      await scrollToNight(page, '2026-10-05');
      const r = await read(page);
      assert.deepEqual([r.wd, r.share, r.shareOff], ['MON', 'Nothing to share Monday', true], 'a day with nothing to send says so and rests');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name} laptop: the open panel scrolls the days, and the corner card stays today's`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { desk: true });
    try {
      const card = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.mouse.click(card.x + card.width * 0.4, card.y + card.height / 2);
      await settled(page);
      assert.equal(await planState(page), 'open');
      await scrollToNight(page, '2026-09-27');
      let r = await read(page);
      assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sunday’s picks']);
      const grab = await page.locator('#plan .plan-grab').boundingBox();
      await page.mouse.click(grab.x + grab.width / 2, grab.y + 20);
      await settled(page);
      assert.equal(await planState(page), 'peek');
      const corner = await page.evaluate(() => ({
        line: document.querySelector('#plan .pc-line').textContent.replace(/\s+/g, ' ').trim(),
        row: document.querySelector('#plan .plan-row.tagged').getAttribute('aria-label'),
        head: document.querySelector('#plan .pc-head .wd').textContent,
      }));
      assert.deepEqual([corner.line, corner.head], ['OUR PICKS · SAT · 9 PICKING', 'SAT'], 'the corner is tonight’s');
      assert.match(corner.row, /^Now: Dog Blood, Pier Stage/);
      await page.mouse.click(card.x + card.width * 0.4, card.y + card.height / 2);
      await settled(page);
      r = await read(page);
      assert.deepEqual([r.wd, r.top], ['SAT', 0], 'opened again, it lands on today');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
