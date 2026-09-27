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
const SAT_1014 = new Date('2026-09-26T22:14:00-07:00');    // a minute before Dog Blood ends
const SAT_1015 = new Date('2026-09-26T22:15:00-07:00');
const ACL_W1_SUN = new Date('2026-10-04T19:00:00-05:00');  // ACL W1 Sunday: Mon and Tue ahead have nothing picked
const ACL_W2_SAT = new Date('2026-10-10T16:00:00-05:00');  // ACL W2 Saturday: nine nights behind, a short Sunday ahead
const QUIET_MS = 450; // the shelf swallows the click just after a tap or a drag (plan-shelf.js quietUntil, 400)

// `fest`: which festival and made-up crew. `plan`: the link's &plan=<night>.
// `desk`: a laptop. `reduced`: Reduce Motion. `at`: the clock. `wait: false`
// hands the page back as soon as it has loaded, before the plan settles.
async function open(engine, { fest = 'portola-2026', at = SAT_940, plan = null, desk = false, reduced = false, wait = true } = {}) {
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
    // DIAGNOSTIC (CI's Linux WebKit glide reds, 2026-09-27): every scrollTo
    // the app asks of the list, and the list's scrollTop sampled on every
    // animation frame for a second after a smooth one — whether scroll events
    // fire or not.
    window.__glideCalls = [];
    window.__glideFrames = [];
    const scrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (...args) {
      if (this.matches && this.matches('#plan .plan-list')) {
        const o = typeof args[0] === 'object' ? args[0] : { top: args[1] };
        window.__glideCalls.push({ top: o.top, behavior: o.behavior || 'auto', from: this.scrollTop, t: Math.round(performance.now()) });
        if (o.behavior === 'smooth') {
          const t0 = performance.now();
          const step = () => {
            const list = document.querySelector('#plan .plan-list');
            window.__glideFrames.push({ top: list ? Math.round(list.scrollTop) : null, t: Math.round(performance.now() - t0) });
            if (performance.now() - t0 < 1000 && window.__glideFrames.length < 400) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      }
      return scrollTo.apply(this, args);
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function recorded(frames, opts) {
      // The phone's head, and the laptop panel's head line (`corner`).
      if (this.matches && this.matches('#plan .plan-head .wd, #plan .plan-head .sub, #plan .pc-head .wd, #plan .pc-head .sub')) {
        window.__turns.push({ part: this.className, where: this.closest('.pc-head') ? 'corner' : 'head', from: (frames[0] || {}).transform, duration: typeof opts === 'number' ? opts : (opts || {}).duration });
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
  if (!wait) return { ctx, page, errors, crewToken };
  await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
  await fontsIn(page);
  await settled(page);
  return { ctx, page, errors, crewToken };
}
const settled = async (page) => { await motionDone(page, { within: '#plan' }); await sleep(QUIET_MS); };
// DIAGNOSTIC: does this engine animate an element's smooth scroll? A scratch
// scroller asked for 2000px smoothly, its scrollTop sampled on each frame,
// and the scroll events counted.
const smoothProbe = (page) => page.evaluate(() => new Promise((done) => {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;top:0;width:60px;height:120px;overflow-y:auto;opacity:0;pointer-events:none';
  const inner = document.createElement('div');
  inner.style.height = '4000px';
  box.appendChild(inner);
  document.body.appendChild(box);
  let events = 0;
  box.addEventListener('scroll', () => { events += 1; });
  box.scrollTo({ top: 2000, behavior: 'smooth' });
  const tops = [Math.round(box.scrollTop)];
  const t0 = performance.now();
  const step = () => {
    tops.push(Math.round(box.scrollTop));
    if (box.scrollTop < 2000 && performance.now() - t0 < 1500) requestAnimationFrame(step);
    else { box.remove(); done({ tops, events, ms: Math.round(performance.now() - t0) }); }
  };
  requestAnimationFrame(step);
}));
// DIAGNOSTIC: the list's scrollTop read from Node in real time, as fast as
// evaluate returns, until `done` — no page timer, no rAF (the fake clock
// runs both late).
async function sampleList(page, done, ms = 8000) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const top = await page.evaluate(() => { const l = document.querySelector('#plan .plan-list'); return l ? Math.round(l.scrollTop) : null; }).catch(() => null);
    if (!out.length || out[out.length - 1][1] !== top) out.push([Date.now() - t0, top]);
    if (await done()) break;
  }
  return out;
}
const glideDiag = async (page, what, sampled = null) => {
  const d = await page.evaluate(() => ({ calls: window.__glideCalls, frames: window.__glideFrames, events: window.__glide.map((g) => g.top) }));
  const probe = await smoothProbe(page);
  console.log(`DIAG ${what}: ${JSON.stringify({ calls: d.calls, events: d.events, sampled: sampled && sampled.map(([t, v]) => `${t}:${v}`).join(' '), rafFrames: d.frames.length, probe })}`);
};
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

// A real tap: a finger on the phone (the harness's phones have touch), the
// mouse on the laptop. `target`: a selector or a handle.
async function tap(page, target) {
  const el = typeof target === 'string' ? page.locator(target).first() : target;
  const b = await el.boundingBox();
  assert.ok(b, `${target} is on screen`);
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  if (await page.evaluate(() => matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 0) && (page.viewportSize() || {}).width < 720) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await sleep(60);
}
const menuUp = (page, sel) => page.waitForFunction((s) => { const m = document.querySelector(s); return !!m && m.getClientRects().length > 0 && getComputedStyle(m).display !== 'none' && getComputedStyle(m).visibility !== 'hidden'; }, sel, { timeout: 4000 });
const menuGone = (page, sel) => page.waitForFunction((s) => { const m = document.querySelector(s); return !m || !m.getClientRects().length || getComputedStyle(m).display === 'none'; }, sel, { timeout: 4000 });
// The menu is ON TOP: a finger at its middle reaches it, and so does one at
// the middle of wherever it overlaps the open plan (on the laptop the people
// menu can sit clear of the panel; the Show menu drops over it).
async function onTop(page, sel, { over = false } = {}) {
  const hit = await page.evaluate(([s, must]) => {
    const reach = (x, y) => { const at = document.elementFromPoint(x, y); return at && at.closest(s) ? 'menu' : (at ? at.className || at.tagName : 'nothing'); };
    const m = document.querySelector(s).getBoundingClientRect();
    const own = reach((m.left + m.right) / 2, (m.top + m.bottom) / 2);
    if (own !== 'menu') return `its middle: ${own}`;
    const p = document.getElementById('plan').getBoundingClientRect();
    const x0 = Math.max(m.left, p.left); const x1 = Math.min(m.right, p.right);
    const y0 = Math.max(m.top, p.top); const y1 = Math.min(m.bottom, p.bottom);
    if (x1 - x0 < 4 || y1 - y0 < 4) return must ? 'clear of the plan' : 'menu';
    const over = reach((x0 + x1) / 2, (y0 + y1) / 2);
    return over === 'menu' ? 'menu' : `over the plan: ${over}`;
  }, [sel, over]);
  assert.equal(hit, 'menu', `the menu is on top of the open plan (${sel})`);
}
// The people menu's Our picks row (people-menu.js), or null.
const planRow = async (page, wrap) => {
  const row = page.locator(`${wrap} .hl-pop [data-act="plan"]`);
  return (await row.count()) ? row.first() : null;
};
const tagged = (page) => page.locator('#plan .plan-row.tagged').getAttribute('aria-label');
const rowsOf = (page, night) => page.evaluate((n) => [...document.querySelectorAll('#plan .plan-row')]
  .filter((r) => r.dataset.night === n).map((r) => r.textContent), night);

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
    const { ctx, page, errors } = await open(get(), { plan: '2026-09-27', wait: false });
    try {
      const sunTop = () => page.evaluate(() => {
        const list = document.querySelector('#plan .plan-list');
        const row = list && [...list.children].find((r) => r.dataset.night === '2026-09-27');
        return row ? row.getBoundingClientRect().top - list.getBoundingClientRect().top : 99;
      }).catch(() => 99);
      const sampled = await sampleList(page, async () => Math.abs(await sunTop()) <= 2, 12000);
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
      await glideDiag(page, `${name} link`, sampled);
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

  // A repaint on the way — the minute's tick ending Dog Blood, a friend's
  // pick — replaces the list's rows mid-glide. The new list keeps the place
  // the old one had reached, and the glide carries on from there to Sunday.
  test(`${name}: a later night's glide carries on across a repaint on the way`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { plan: '2026-09-27', at: SAT_1014, wait: false });
    try {
      // Mid-glide (the list has left today; the recorder in open()), the
      // minute turns and its tick redraws the rows.
      const deadline = Date.now() + 15000;
      while (!(await page.evaluate(() => (window.__glide || []).some((g) => g.top > 20)))) {
        assert.ok(Date.now() < deadline, 'the glide starts');
        await sleep(5);
      }
      await page.evaluate(() => { document.querySelector('#plan .plan-list').dataset.old = '1'; window.__redrawn = null; });
      await page.clock.setFixedTime(SAT_1015);
      await page.evaluate(() => {
        document.body.dataset.busy = 'test-tick';
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.body.dataset.busy;
        const list = document.querySelector('#plan .plan-list');
        if (!list.dataset.old) window.__redrawn = { top: list.scrollTop };
      });
      const redrawn = await page.evaluate(() => window.__redrawn);
      assert.ok(redrawn, 'the tick redrew the rows');
      await until(async () => Math.abs(await nightTop(page, '2026-09-27')) <= 2, 'the glide reaches Sunday after the repaint');
      await settled(page);
      const end = await page.evaluate(() => document.querySelector('#plan .plan-list').scrollTop);
      await glideDiag(page, `${name} carry-on (redrawn at ${redrawn.top})`);
      assert.ok(redrawn.top < end - 20, `the repaint came mid-glide (at ${redrawn.top}, Sunday at ${end})`);
      assert.equal((await read(page)).wd, 'SUN');
      assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
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
      // Its mark went the way it came — faded as it narrowed, the pill closing
      // up behind it — not gone in one frame (the P1–P3 review, 2026-09-27).
      const mark = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('#plan .plan-share svg'));
        const eased = (prop) => { const i = cs.transitionProperty.split(', ').indexOf(prop); return i >= 0 && parseFloat(cs.transitionDuration.split(', ')[i]) > 0; };
        return { display: cs.display, opacity: cs.opacity, width: cs.width, eased: ['opacity', 'width'].every(eased) };
      });
      assert.deepEqual(mark, { display: 'block', opacity: '0', width: '0px', eased: true }, `the Share’s mark eases out: ${JSON.stringify(mark)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The P1–P3 review's eighth finding (2026-09-27): closing from a later day
  // swapped the list and the head back to today in the close's first frame,
  // so its fade showed today, not the day being closed. The fade shows the
  // day being closed, and today's head is painted once it is out of sight;
  // the peek lands on the dock (measured at the list's top, not scrolled).
  test(`${name}: closing from a later day fades that day out — its rows and its head — and the peek lands on the dock`, { skip }, async () => {
    const { ctx, page, errors } = await open(get());
    try {
      await openPlan(page);
      await scrollToNight(page, '2026-09-27');
      assert.equal((await read(page)).wd, 'SUN');
      await page.evaluate(() => {
        window.__close = [];
        window.__rec = true;
        // From the press on: the frames before it are the open plan at rest.
        document.addEventListener('pointerdown', () => { window.__close = []; }, { capture: true, once: true });
        const plan = document.getElementById('plan');
        const step = () => {
          if (!window.__rec) return;
          const list = plan.querySelector('.plan-list').getBoundingClientRect();
          const hit = document.elementFromPoint(list.left + list.width / 2, list.top + 12);
          const row = hit && hit.closest('#plan .plan-list > [data-night]');
          window.__close.push({ top: Math.round(plan.getBoundingClientRect().top), wd: plan.querySelector('.plan-head .wd').textContent, night: row ? row.dataset.night : null });
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      const grab = await page.locator('#plan .plan-grab').boundingBox();
      await page.mouse.click(grab.x + grab.width / 2, grab.y + grab.height / 2);
      await settled(page);
      const frames = await page.evaluate(() => { window.__rec = false; return window.__close; });
      assert.equal(await planState(page), 'peek');
      const rest = frames[frames.length - 1].top;
      const moving = frames.filter((f) => f.top < rest - 2);
      if (!process.env.LATE_ANIMATIONS_MS) assert.ok(moving.length > 0, `frames of the close were seen: ${JSON.stringify(frames.slice(0, 3))}`);
      const wrong = moving.filter((f) => f.wd !== 'SUN' || (f.night && f.night !== '2026-09-27'));
      assert.deepEqual(wrong, [], `while it closes, the head and the rows are Sunday’s: ${wrong.length} of ${moving.length} frames are not, from ${JSON.stringify(wrong[0])}`);
      const dock = await page.evaluate(() => {
        const r = document.querySelector('#plan .plan-row.tagged').getBoundingClientRect();
        return { row: document.querySelector('#plan .plan-row.tagged').getAttribute('aria-label'), off: Math.round((r.bottom - document.getElementById('dock').getBoundingClientRect().top) * 10) / 10 };
      });
      assert.match(dock.row, /^Now: Dog Blood, Pier Stage/);
      assert.ok(Math.abs(dock.off) <= 0.5, `the peek’s row ends on the dock: ${dock.off}`);
      assert.equal((await read(page)).wd, 'SAT', 'once it is out of sight, the head is today’s again');
      await openPlan(page);
      const r = await read(page);
      assert.deepEqual([r.wd, r.top], ['SAT', 0], 'opened again, it lands on today');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The P1–P3 review's seventh finding (2026-09-27): the laptop's head never
  // turned over — the turn played on the phone's head, which is display:none
  // there, and the panel's head line was swapped in place.
  test(`${name} laptop: the panel's head line turns over as Sunday comes to the top`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { desk: true });
    try {
      const card = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.mouse.click(card.x + card.width * 0.4, card.y + card.height / 2);
      await settled(page);
      await page.evaluate(() => { window.__turns = []; });
      await scrollToNight(page, '2026-09-27');
      const turns = await page.evaluate(() => window.__turns);
      const corner = turns.filter((t) => t.where === 'corner');
      assert.ok(corner.length >= 2 && corner.every((t) => t.from === 'translateY(10px)' && t.duration === 200), `the panel’s head line rose in from below: ${JSON.stringify(turns)}`);
      assert.equal(await page.locator('#plan .pc-head .wd').textContent(), 'SUN');
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

  // ---- the menus while the plan is open (P3; DESIGN.md C1–C7) ----------------------
  // Both menus open over the open plan and re-plan it live; neither takes a
  // history entry (a menu never does: v93's four rounds). The people menu's
  // "Our picks" row is there only while the plan is closed — open, it is
  // already the thing under the menu.

  test(`${name}: the Show menu opens over the open plan, takes no history entry, and hiding a room re-plans it under the menu`, { skip }, async () => {
    const { ctx, page, errors } = await open(get());
    try {
      await openPlan(page);
      const len = await page.evaluate(() => history.length);
      const sat = () => rowsOf(page, '2026-09-26');
      assert.ok((await sat()).some((t) => t.includes('The Great Northern')), 'Saturday ends at an afters room');
      await tap(page, '#dock-fest-link');
      await menuUp(page, '#dock-fest-wrap .sort-pop');
      assert.equal(await planState(page), 'open', 'the plan stays open under the menu');
      await onTop(page, '#dock-fest-wrap .sort-pop', { over: true });
      await tap(page, '#dock-fest-wrap .sort-pop [data-room="Afters"]');
      await until(async () => !(await sat()).some((t) => t.includes('The Great Northern')), 'hiding Afters takes its rooms out of the plan');
      assert.ok(await page.locator('#dock-fest-wrap .sort-pop').isVisible(), 'the menu is still up');
      assert.equal(await planState(page), 'open');
      await tap(page, '#dock-fest-link');
      await menuGone(page, '#dock-fest-wrap .sort-pop');
      await settled(page);
      assert.equal(await planState(page), 'open', 'and still open once the menu has gone');
      assert.equal(await page.evaluate(() => history.length), len, 'no history entry, through all of it');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: the people menu opens over the open plan without Our picks; a highlight re-plans it live, the head says whose, and the Share goes out unnamed`, { skip }, async () => {
    const { ctx, page, errors } = await open(get());
    try {
      await openPlan(page);
      const len = await page.evaluate(() => history.length);
      await tap(page, '#dock-you');
      await menuUp(page, '#dock-you-wrap .hl-pop');
      assert.equal(await planState(page), 'open');
      await onTop(page, '#dock-you-wrap .hl-pop', { over: true });
      assert.equal(await planRow(page, '#dock-you-wrap'), null, 'no Our picks row while the plan is open');
      // This phone is Gus: his own day, live under the menu.
      await tap(page, '#dock-you-wrap .hl-pop [data-person="Gus"]');
      await until(async () => (await read(page)).sub === 'Sep 26 · just you', 'the head says whose');
      assert.match(await tagged(page), /^Next: Prospa, Warehouse, 9:45 PM/);
      assert.equal(await page.locator('#plan .plan-row.dim').count(), 0, 'nothing dims: the plan is theirs');
      await tap(page, '#dock-you-wrap .hl-pop [data-person="Cy"]');
      await tap(page, '#dock-you-wrap .hl-pop [data-person="Hal"]');
      await until(async () => (await read(page)).sub === 'Sep 26 · you, Cy + Hal', 'three, by name');
      assert.match(await tagged(page), /^Now: Dog Blood, Pier Stage.*2 of 3/);
      assert.equal(await planState(page), 'open');
      await tap(page, '#dock-you');
      await menuGone(page, '#dock-you-wrap .hl-pop');
      await settled(page);
      assert.equal((await read(page)).sub, 'Sep 26 · you, Cy + Hal', 'the head keeps saying whose');
      // The Share sends what is on screen, with no one's name, and the foot
      // says the link opens on everyone's picks (a highlight never rides in a link).
      assert.match(await page.locator('#plan .plan-foot .opens').textContent(), /^Opens on everyone’s picks/);
      const text = await share(page);
      assert.match(text, /^Our picks for Sat Portola, now till end of day\n\n/);
      for (const n of CREWS['portola-2026'].members) assert.doesNotMatch(text.split('Full rundown:')[0], new RegExp(`\\b${n}\\b`), `${n} is not named`);
      assert.match(text, /&plan=2026-09-26$/);
      await linesInNight(page, text, '2026-09-26');
      assert.equal(await page.evaluate(() => history.length), len, 'no history entry');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // DESIGN.md C's edge: a highlight can leave the plan with nothing in it
  // (Gus and Hal are never together again this weekend). A menu over the
  // plan must never take it away: it stays open on today, saying why, its
  // Share resting. Closed, there is no peek, so the shelf goes; Everyone
  // brings the peek back, and the open menu grows its Our picks row.
  test(`${name}: a highlight that empties the plan keeps it open under the menu — the day says why and the Share rests; closed, the shelf goes, and Everyone brings it back`, { skip }, async () => {
    const { ctx, page, errors } = await open(get());
    try {
      await openPlan(page);
      await tap(page, '#dock-you');
      await menuUp(page, '#dock-you-wrap .hl-pop');
      await tap(page, '#dock-you-wrap .hl-pop [data-person="Gus"]');
      await tap(page, '#dock-you-wrap .hl-pop [data-person="Hal"]');
      await until(async () => (await read(page)).sub === 'Sep 26 · you + Hal', 'the head names the two');
      assert.equal(await planState(page), 'open', 'the plan stays open');
      // Their two stops today are over (behind Earlier), none is left, and
      // they never meet on Sunday: each day says so.
      assert.deepEqual(await rowsOf(page, '2026-09-26'), ['Nothing left today'], 'today says why');
      assert.ok((await rowsOf(page, '2026-09-27')).includes('Never together — no stop'), 'and Sunday');
      const r = await read(page);
      assert.deepEqual([r.share, r.shareOff], ['Nothing to share today', true]);
      await tap(page, '#dock-you');
      await menuGone(page, '#dock-you-wrap .hl-pop');
      await settled(page);
      assert.equal(await planState(page), 'open', 'and still open once the menu has gone');
      const box = await page.locator('#plan .plan-grab').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await until(async () => ['none', 'gone'].includes(await planState(page)), 'closed with no peek, the shelf goes');
      // With a highlight on, the avatar's slot is the pill: its faces reopen the menu.
      await tap(page, '#dock-you-wrap .hl-pill .hl-faces');
      await menuUp(page, '#dock-you-wrap .hl-pop');
      assert.equal(await planRow(page, '#dock-you-wrap'), null, 'no plan, no row');
      await tap(page, '#dock-you-wrap .hl-pop [data-person=""]');
      await until(async () => (await planState(page)) === 'peek', 'Everyone brings the peek back');
      await until(async () => !!(await planRow(page, '#dock-you-wrap')), 'and the open menu its Our picks row');
      assert.match(await tagged(page), /^Now: Dog Blood, Pier Stage/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: with the plan closed the people menu offers Our picks, and it opens the plan`, { skip }, async () => {
    const { ctx, page, errors } = await open(get());
    try {
      assert.equal(await planState(page), 'peek');
      await tap(page, '#dock-you');
      await menuUp(page, '#dock-you-wrap .hl-pop');
      const row = await planRow(page, '#dock-you-wrap');
      assert.ok(row, 'the row is there while the plan is closed');
      await tap(page, row);
      await menuGone(page, '#dock-you-wrap .hl-pop');
      await settled(page);
      assert.equal(await planState(page), 'open');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name} laptop: both menus open with the panel open, the Show menu over it, and a highlight's head and corner say whose`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { desk: true });
    try {
      const card = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.mouse.click(card.x + card.width * 0.4, card.y + card.height / 2);
      await settled(page);
      assert.equal(await planState(page), 'open');
      const len = await page.evaluate(() => history.length);
      await tap(page, '#rail-fest-link');
      await menuUp(page, '#rail-fest-wrap .sort-pop');
      assert.equal(await planState(page), 'open');
      await onTop(page, '#rail-fest-wrap .sort-pop', { over: true });
      await page.keyboard.press('Escape');
      await menuGone(page, '#rail-fest-wrap .sort-pop');
      await tap(page, '#rail-you');
      await menuUp(page, '#rail-you-wrap .hl-pop');
      await onTop(page, '#rail-you-wrap .hl-pop');
      assert.equal(await planRow(page, '#rail-you-wrap'), null, 'no Our picks row while the panel is open');
      await tap(page, '#rail-you-wrap .hl-pop [data-person="Gus"]');
      // The laptop's head is the panel's (the corner card grown), not the phone's.
      await until(async () => (await page.evaluate(() => document.querySelector('#plan .pc-head .sub').textContent)) === 'Sep 26 · just you', 'the panel head says whose');
      await page.keyboard.press('Escape');
      await menuGone(page, '#rail-you-wrap .hl-pop');
      assert.equal(await planState(page), 'open');
      const grab = await page.locator('#plan .plan-grab').boundingBox();
      await page.mouse.click(grab.x + grab.width / 2, grab.y + 20);
      await settled(page);
      assert.equal(await planState(page), 'peek');
      const line = await page.evaluate(() => document.querySelector('#plan .pc-line').textContent.replace(/\s+/g, ' ').trim());
      assert.equal(line, 'OUR PICKS · SAT · JUST YOU', 'the corner says whose too');
      assert.equal(await page.evaluate(() => history.length), len, 'no history entry');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// DIAGNOSTIC (2026-09-27): the smooth-scroll probe on a clock-free page.
for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  test(`DIAG ${name}: an element's smooth scroll, sampled on a page with no fake clock`, { skip: get() ? false : NO_BROWSER }, async () => {
    const ctx = await get().newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${server.origin}/gallery.html`);
      await page.evaluate(() => { window.__glide = []; window.__glideCalls = []; window.__glideFrames = []; });
      const probe = await smoothProbe(page);
      // And from Node, as fast as evaluate returns.
      const node = await page.evaluate(() => {
        const box = document.createElement('div');
        box.id = 'probe2';
        box.style.cssText = 'position:fixed;left:0;top:0;width:60px;height:120px;overflow-y:auto';
        const inner = document.createElement('div');
        inner.style.height = '4000px';
        box.appendChild(inner);
        document.body.appendChild(box);
        box.scrollTo({ top: 2000, behavior: 'smooth' });
        return Math.round(box.scrollTop);
      });
      const seen = [node];
      const t0 = Date.now();
      while (Date.now() - t0 < 1500) {
        const v = await page.evaluate(() => Math.round(document.getElementById('probe2').scrollTop));
        if (seen[seen.length - 1] !== v) seen.push(v);
        if (v >= 2000) break;
      }
      console.log(`DIAG ${name} clock-free: ${JSON.stringify({ probe, node: seen, ua: await page.evaluate(() => navigator.userAgent) })}`);
    } finally { await ctx.close(); }
  });
}
