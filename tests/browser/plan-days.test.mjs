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
// The longest Earlier line ACL's data can make: its first Saturday is the one
// night with three behind that are not consecutive (Sep 29, Oct 1, Oct 2, each
// a date because its weekday comes twice), and a crew that picked every act
// that night, on the grid and at the late shows, has 11 stops (13 before the
// mud re-time of 2026-10-03 took two noon sets off). At 1:50 AM the last is
// on and 10 are over: "Earlier · Sep 29 · Oct 1 · Oct 2 · 10 stops".
// (From 2 AM nothing is left and the plan lands on Sunday: a span.)
const ACL_ALL_SAT = (() => {
  const base = CREWS['acl-2026'];
  const acl = JSON.parse(readFileSync(path.join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
  const inW1 = (name) => { const a = acl.artists.find((x) => x.name === name) || {}; return !a.weekends || String(a.weekends).includes('W1'); };
  const names = [...acl.days.Saturday.artists.map((a) => a.name).filter(inW1),
    ...acl.artists.filter((a) => a.day === 'Late nights' && a.date === '2026-10-03').map((a) => a.name)];
  const all = Object.fromEntries(base.members.map((m) => [m, 4]));
  return { ...base, picks: { ...base.picks, ...Object.fromEntries(names.map((n) => [n, all])) } };
})();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const SAT_940 = new Date('2026-09-26T21:40:00-07:00');     // Portola: Dog Blood on the Pier Stage, 8 picked
const SAT_941 = new Date('2026-09-26T21:41:00-07:00');
const SAT_942 = new Date('2026-09-26T21:42:00-07:00');
const SAT_1014 = new Date('2026-09-26T22:14:00-07:00');    // a minute before Dog Blood ends
const SAT_1015 = new Date('2026-09-26T22:15:00-07:00');
const ACL_W1_SUN = new Date('2026-10-04T19:00:00-05:00');  // ACL W1 Sunday: Mon and Tue ahead have nothing picked
const ACL_W2_SAT = new Date('2026-10-10T16:00:00-05:00');  // ACL W2 Saturday: nine nights behind, a short Sunday ahead
const ACL_W2_SAT_9PM = new Date('2026-10-10T21:00:00-05:00');
const SUN_9PM = new Date('2026-09-27T21:00:00-07:00');      // Portola Sunday: three nights behind and four stops over
const ACL_W1_SAT_150AM = new Date('2026-10-04T01:50:00-05:00'); // still ACL's first Saturday: ACL_ALL_SAT's last stop on, 10 over
const QUIET_MS = 450; // the shelf swallows the click just after a tap or a drag (plan-shelf.js quietUntil, 400)

// `fest`: which festival and made-up crew (`crew`: another made-up crew for
// it). `plan`: the link's &plan=<night>.
// `desk`: a laptop (else a phone `width` wide). `reduced`: Reduce Motion. `at`: the clock. `wait: false`
// hands the page back as soon as it has loaded, before the plan settles.
// `bars`: a scrollbar that takes room, as Windows and a Mac with a mouse draw
// one (Chromium needs a browser launched with its scrollbars on). `holdGlide`:
// the glide held part of the way (the held glide, below). The crew's doc
// comes back too: a friend's pick is a change to it, then a pull.
async function open(engine, { fest = 'portola-2026', crew: made = null, at = SAT_940, plan = null, desk = false, reduced = false, wait = true, bars = false, holdGlide = false, width = 390 } = {}) {
  const crew = made || CREWS[fest];
  const crewToken = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width, height: 844 },
    hasTouch: !desk, deviceScaleFactor: 2, timezoneId: crew.tz, serviceWorkers: 'block',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await lateStarts(ctx);
  if (bars) {
    await ctx.addInitScript(() => {
      const put = () => {
        const s = document.createElement('style');
        s.textContent = '::-webkit-scrollbar { width: 15px; background: #222; } ::-webkit-scrollbar-thumb { background: #777; }';
        document.head.appendChild(s);
      };
      if (document.head) put(); else document.addEventListener('DOMContentLoaded', put);
    });
  }
  if (holdGlide) await ctx.addInitScript(() => { window.__holdGlide = true; });
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
    // Every scrollTo the app asks of the list (the glide's intent, which every
    // engine can be held to — now-jump's recorded asks are the pattern), with
    // where the list was, the row at its top then (its night and stop, and how
    // far into it, as the shelf keeps a place) and whether the window itself
    // was still moving.
    window.__asks = [];
    const scrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function asked(...args) {
      if (this.matches && this.matches('#plan .plan-list')) {
        const o = typeof args[0] === 'object' && args[0] ? args[0] : { top: args[1] };
        const plan = document.getElementById('plan');
        const moving = plan.getAnimations().some((a) => a.playState === 'running' && a.effect.getComputedTiming().endTime !== Infinity);
        const row = [...this.children].find((r) => r.dataset.night && r.offsetTop + r.offsetHeight > this.scrollTop + 2);
        window.__asks.push({ top: o.top, behavior: o.behavior || 'auto', from: this.scrollTop, moving,
          row: row ? `${row.dataset.night}#${row.dataset.stop || row.className}` : '', at: row ? Math.round(this.scrollTop - row.offsetTop) : 0 });
        // The held glide: the first smooth ask stops 40% of the way there and
        // stays, and every later one lands at once.
        if (window.__holdGlide && o.behavior === 'smooth') {
          const first = !window.__glideHeld;
          window.__glideHeld = true;
          this.scrollTop = first ? this.scrollTop + (o.top - this.scrollTop) * 0.4 : o.top;
          return undefined;
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
    festivals: { [fest]: { selections: structuredClone(crew.picks) } },
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
  if (!wait) return { ctx, page, errors, crewToken, doc };
  await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
  await fontsIn(page);
  await settled(page);
  return { ctx, page, errors, crewToken, doc };
}
const settled = async (page) => { await motionDone(page, { within: '#plan' }); await sleep(QUIET_MS); };
// The later-night glide is the app's ask and the engine's animation. The ask
// is asserted on every engine: one smooth scrollTo, to the night's head, made
// once the window has landed. The frames in between are the engine's job once
// the ask is right, and only Chromium animates an element's smooth scroll
// reliably under this harness: CI's Linux WebKit lands it in one to three
// frames (a scratch scroller there went [0, 1964, 2000] over 673 ms, and the
// list [508]), and a runtime probe of that flipped from run to run (CI
// 36323629568 counted 3 places, read them as a glide, and three glide tests
// failed). So "through the rows between" and a repaint racing the engine's
// own glide are Chromium's, and every engine gets the carry-on driven
// deterministically: the held glide (open's `holdGlide`) keeps the list part
// of the way there for as long as a test needs it, and lands every later ask
// at once.
const ANIMATES = (name) => name === 'Chromium';
// The row at the list's top — its night and stop, how far into it the top
// edge sits, as the shelf keeps a place — and the list's scrollTop.
const topRow = (page) => page.evaluate(() => {
  const list = document.querySelector('#plan .plan-list');
  const row = [...list.children].find((r) => r.dataset.night && r.offsetTop + r.offsetHeight > list.scrollTop + 2);
  return { row: `${row.dataset.night}#${row.dataset.stop || row.className}`, at: Math.round(list.scrollTop - row.offsetTop), scrollTop: Math.round(list.scrollTop) };
});
// The held glide, once the first ask has stopped the list part of the way
// and the list has told the app (its scroll event): the row at its top.
async function heldGlide(page) {
  await until(() => page.evaluate(() => { const l = document.querySelector('#plan .plan-list'); return !!window.__glideHeld && !!l && l.scrollTop > 20; }), 'the glide is held part of the way', 15000);
  await sleep(200);
  return topRow(page);
}
// The minute turns (SAT_1015: Dog Blood ends) and its tick redraws the rows
// then and there.
async function tickRedraws(page, at) {
  await page.evaluate(() => { document.querySelector('#plan .plan-list').dataset.old = '1'; });
  await page.clock.setFixedTime(at);
  const redrawn = await page.evaluate(() => {
    document.body.dataset.busy = 'test-tick';
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.body.dataset.busy;
    return !document.querySelector('#plan .plan-list').dataset.old;
  });
  assert.ok(redrawn, 'the tick redrew the rows');
}
// Poll from Node, in real time, until `ok` (a timer inside the page runs on
// the fake clock: the harness traps).
async function until(ok, what, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ok()) return; await sleep(50); }
  assert.fail(`timed out waiting: ${what}`);
}
const planState = (page) => page.evaluate(() => { const el = document.getElementById('plan'); return el && !el.hidden ? el.dataset.state : 'none'; });
// A close by the grabber with a repaint during its motion: the minute turns,
// and the page repaints right after the close has begun (a listener on the
// document runs after the shelf's own pointerup, which starts the close), as
// a tick or a friend's update can. What the shelf was just before, and just
// after, that repaint.
async function closeWithRepaint(page, at) {
  await page.clock.setFixedTime(at);
  await page.evaluate(() => {
    window.__closeRepaint = null;
    document.addEventListener('pointerup', () => {
      const el = document.getElementById('plan');
      const was = { hidden: el.hidden, state: el.dataset.state, moving: el.getAnimations().length };
      document.dispatchEvent(new Event('visibilitychange'));
      window.__closeRepaint = { was, then: { hidden: el.hidden, state: el.dataset.state } };
    }, { once: true });
  });
  const box = await page.locator('#plan .plan-grab').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return page.evaluate(() => window.__closeRepaint);
}
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
  // Until the stub has it, on the real clock (a slow runner is late, not wrong:
  // Sol's nit on 0f076a6), then a beat to see that one text came, not two.
  const end = Date.now() + 4000;
  while ((await page.evaluate(() => window.__shared.length)) <= before) {
    assert.ok(Date.now() < end, 'the sheet was handed a text');
    await sleep(25);
  }
  await sleep(100);
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
  test(`${name}: a link for a later night opens the plan on that night, and the peek stays tonight's`, { skip }, async (t) => {
    const { ctx, page, errors } = await open(get(), { plan: '2026-09-27' });
    try {
      await page.waitForSelector('#plan[data-state="open"]', { timeout: 8000 });
      // It opens on tonight, then glides to Sunday once it has landed.
      await until(async () => Math.abs(await nightTop(page, '2026-09-27')) <= 2, 'the list glides to Sunday');
      await settled(page);
      const r = await read(page);
      assert.deepEqual([r.wd, r.sub, r.share], ['SUN', 'Sep 27 · 9 picking', 'Share Sunday’s picks']);
      assert.ok(Math.abs(await nightTop(page, '2026-09-27')) <= 2, 'Sunday’s head is at the top of the list');
      // The glide as the app asked for it, on every engine: once, smoothly,
      // from tonight's top to Sunday's head, and only once the window had
      // landed.
      const sun = await page.evaluate(() => [...document.querySelector('#plan .plan-list').children].find((x) => x.dataset.night === '2026-09-27').offsetTop);
      const asks = await page.evaluate(() => window.__asks);
      assert.equal(asks.length, 1, `one glide was asked for: ${JSON.stringify(asks)}`);
      assert.deepEqual([asks[0].behavior, asks[0].moving], ['smooth', false], `smoothly, once the window had landed: ${JSON.stringify(asks)}`);
      assert.ok(asks[0].from < 1 && Math.abs(asks[0].top - sun) <= 1, `from tonight's top to Sunday's head (${sun}): ${JSON.stringify(asks)}`);
      // The list moved only once the window had landed — and, where the
      // engine shows a smooth scroll on its way, through the rows between,
      // not in one jump.
      const glide = (await page.evaluate(() => window.__glide)).filter((g) => g.top > 0);
      assert.ok(glide.length > 0 && glide.every((g) => !g.moving), `the list moved only once the window had landed: ${JSON.stringify(glide.slice(0, 4))}`);
      if (ANIMATES(name)) assert.ok(new Set(glide.map((g) => g.top)).size >= 3, `it glided, through the rows between: ${JSON.stringify(glide.map((g) => g.top))}`);
      else t.diagnostic(`the rows between are the engine's job, asserted on Chromium (ANIMATES): the list's scroll events here said ${JSON.stringify(glide.map((g) => g.top))}`);
      // The head turned over once, upward, as Sunday reached the top.
      const turns = await page.evaluate(() => window.__turns);
      assert.deepEqual(turns.map((x) => [x.part, x.from]), [['wd', 'translateY(10px)'], ['sub', 'translateY(10px)']], 'the head turned over once, as Sunday arrived');
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
  // Racing the engine's own glide is Chromium's (ANIMATES); the held glide
  // below drives the same carry-on on every engine.
  test(`${name}: a later night's glide carries on across a repaint on the way (the engine's own glide)`, { skip: skip || (ANIMATES(name) ? false : 'a repaint can race the engine\'s own glide only where the engine animates it (ANIMATES: Linux WebKit lands it in one to three frames); the held glide covers the carry-on here') }, async () => {
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
      assert.ok(redrawn.top < end - 20, `the repaint came mid-glide (at ${redrawn.top}, Sunday at ${end})`);
      // The new list was asked to carry on, smoothly, from where the old one
      // had got to, to Sunday's head as the new rows place it.
      const asks = await page.evaluate(() => window.__asks);
      const last = asks[asks.length - 1];
      assert.ok(asks.length >= 2 && last.behavior === 'smooth' && Math.abs(last.from - redrawn.top) <= 1 && Math.abs(last.top - end) <= 1,
        `the glide carried on from ${redrawn.top} to Sunday at ${end}: ${JSON.stringify(asks)}`);
      assert.equal((await read(page)).wd, 'SUN');
      assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
    } finally { await ctx.close(); }
  });

  // The same carry-on on every engine, driven deterministically: the glide is
  // held part of the way (open's `holdGlide`), a friend's pick on Sunday
  // redraws the rows under it, and the new list is asked to carry on from the
  // row the old one had reached, to Sunday's head as the new rows place it.
  // (A pick, not the minute: the tick that ends Dog Blood takes away the
  // grown card the list is held in, and the place then passes to the next
  // row by design — the racing test above takes that path.)
  test(`${name}: a glide held part of the way across a friend's pick — the new list carries on from the row the old one had reached, to Sunday's head`, { skip }, async () => {
    const { ctx, page, errors, doc } = await open(get(), { plan: '2026-09-27', wait: false, holdGlide: true });
    try {
      const held = await heldGlide(page);
      const sel = doc.festivals['portola-2026'].selections;
      sel.Parcels = { ...sel.Parcels, Ana: 3 };
      await page.evaluate(() => { document.querySelector('#plan .plan-list').dataset.old = '1'; document.dispatchEvent(new Event('visibilitychange')); });
      await until(() => page.evaluate(() => !document.querySelector('#plan .plan-list').dataset.old), 'the friend\'s pick redrew the rows');
      await until(async () => Math.abs(await nightTop(page, '2026-09-27')) <= 2, 'the glide reaches Sunday after the repaint');
      await settled(page);
      const sun = await page.evaluate(() => [...document.querySelector('#plan .plan-list').children].find((x) => x.dataset.night === '2026-09-27').offsetTop);
      const asks = await page.evaluate(() => window.__asks);
      assert.ok(asks.length >= 2, `the glide was asked for, then asked to carry on: ${JSON.stringify(asks)}`);
      const [first, again, ...more] = asks;
      assert.deepEqual([first.behavior, first.moving, again.behavior], ['smooth', false, 'smooth'], `both smoothly, the first once the window had landed: ${JSON.stringify(asks)}`);
      assert.ok(again.row === held.row && Math.abs(again.at - held.at) <= 1 && Math.abs(again.top - sun) <= 1,
        `the new list carried on from where the old one had got to (${JSON.stringify(held)}) to Sunday's head (${sun}): ${JSON.stringify(again)}`);
      // A list drawn again before the landing's scroll event is asked from
      // Sunday's head to Sunday's head: no motion. (The pull's answer is drawn
      // twice, some 50 ms apart, on both engines; WebKit's second draw can
      // come before that event.)
      assert.ok(more.every((m) => Math.abs(m.from - sun) <= 1 && Math.abs(m.top - sun) <= 1), `nothing after the carry-on moved the list: ${JSON.stringify(more)}`);
      const r = await read(page);
      assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sunday’s picks']);
      assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
    } finally { await ctx.close(); }
  });

  // The held glide's repaint on a laptop whose list scrollbar takes room
  // (Windows, a Mac with a mouse). The new list was measured for the reader's
  // place before it was the open, scrolling list, 15px wider than the one it
  // became, and the settle after it only re-aims a glide: every scroll after
  // that read as a reflow and was never taken, so the next settle or repaint
  // put the list back where the glide had been when the tick came — the
  // landing on Sunday snapped back to Saturday, and a reader's own scroll
  // after it was lost the same way.
  test(`${name} laptop, a scrollbar that takes room: a glide across a repaint stays where it lands, and the next repaint keeps where the reader scrolls to`, { skip }, async () => {
    const own = name === 'Chromium' ? await launchBrowser({ scrollbars: true }) : null;
    const { ctx, page, errors, doc } = await open(own || get(), { plan: '2026-09-27', at: SAT_1014, desk: true, wait: false, bars: true, holdGlide: true });
    try {
      const held = await heldGlide(page);
      await tickRedraws(page, SAT_1015);
      await until(async () => Math.abs(await nightTop(page, '2026-09-27')) <= 2, 'the glide reaches Sunday after the repaint');
      await settled(page);
      assert.ok(Math.abs(await nightTop(page, '2026-09-27')) <= 2, `Sunday's head is still at the top once everything has settled: ${JSON.stringify(await topRow(page))} (the glide was held at ${JSON.stringify(held)})`);
      const gutter = await page.evaluate(() => { const l = document.querySelector('#plan .plan-list'); return l.offsetWidth - l.clientWidth; });
      assert.ok(gutter >= 10, `the list's scrollbar takes room: ${gutter}px`);
      // The reader goes back up a little, into Saturday's last rows, with a
      // real wheel: measured and sent again until it is there.
      const end = (await topRow(page)).scrollTop;
      const want = end - 60;
      for (let pass = 0; pass < 4; pass++) {
        const now = (await topRow(page)).scrollTop;
        if (Math.abs(now - want) <= 15) break;
        await wheel(page, want - now);
      }
      const before = await topRow(page);
      assert.ok(Math.abs(before.scrollTop - want) <= 15 && before.row !== held.row,
        `the reader is in Saturday's last rows, not where the glide was held: ${JSON.stringify({ before, want, held })}`);
      // A friend's pick on Sunday redraws the rows: Ana picks Parcels too.
      const sel = doc.festivals['portola-2026'].selections;
      sel.Parcels = { ...sel.Parcels, Ana: 3 };
      await page.evaluate(() => { document.querySelector('#plan .plan-list').dataset.old = '1'; document.dispatchEvent(new Event('visibilitychange')); });
      await until(() => page.evaluate(() => !document.querySelector('#plan .plan-list').dataset.old), 'the friend\'s pick redrew the rows');
      await settled(page);
      const after = await topRow(page);
      assert.ok(after.row === before.row && Math.abs(after.at - before.at) <= 1,
        `the repaint kept the reader where they were: ${JSON.stringify(before)} → ${JSON.stringify(after)} (the glide was held at ${JSON.stringify(held)})`);
      assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
    } finally { await ctx.close(); if (own) await own.close(); }
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
      // The nights behind arrive dimmed and stay so: held near the end of
      // their arrival, no past line is brighter than it rests. (The dim was
      // the rows' own opacity, which the arrival's fade also writes: they
      // faded in to full, then dropped to the dim — a pop.)
      const lit = () => page.evaluate(() => [...document.querySelectorAll('#plan .plan-list > .past')].map((r) => {
        const cs = getComputedStyle(r);
        const m = /opacity\(([\d.]+)(%?)\)/.exec(cs.filter || '');
        return Math.round(Number(cs.opacity) * (m ? Number(m[1]) / (m[2] ? 100 : 1) : 1) * 100) / 100;
      }));
      const held = await page.evaluate(() => {
        const moving = document.getElementById('plan').getAnimations({ subtree: true })
          .filter((a) => Number.isFinite(a.effect.getComputedTiming().endTime));
        for (const a of moving) {
          const t = a.effect.getComputedTiming();
          a.pause();
          a.currentTime = (t.delay || 0) + t.activeDuration * 0.95;
        }
        return moving.length;
      });
      const arriving = await lit();
      await page.evaluate(() => document.getElementById('plan').getAnimations({ subtree: true }).forEach((a) => { try { a.finish(); } catch { /* an endless one */ } }));
      await settled(page);
      const resting = await lit();
      assert.ok(resting.length > 8 && resting.every((v) => v < 0.6), `the nights behind rest dimmed: ${JSON.stringify(resting)}`);
      assert.ok(held > 0 && Math.max(...arriving) <= Math.max(...resting) + 0.02, `no past line is brighter as it arrives than at rest (${held} motions held near their end): ${JSON.stringify(arriving)}`);
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

  // The Earlier line is small capitals, and its words are never cut: on
  // Portola Sunday at 390px it read "EARLIER · THU · FRI · SAT · 4 S…" (the
  // lead's look at the walk's frames, 2026-09-27). A run of three nights or
  // more on consecutive dates is one range, "Thu – Sat", the way a bare run is
  // "Oct 5 – 6"; past three nights the date span stands. Three that are not
  // consecutive keep their labels, and that line wraps rather than cut (Sol's
  // final check, SOL-R3.md): ACL's longest, ACL_ALL_SAT's, is two lines at a
  // phone's width, a label never split across them, and the node and the
  // chevron sit at the middle of however many lines it takes. Measured, never
  // compared as a string: the words' own box holds all of them.
  for (const width of [320, 390]) {
    test(`${name} ${width}: the Earlier line's words are never cut — Portola Sunday with stops folded, ACL's second Saturday, ACL's longest`, { skip }, async () => {
      for (const [fest, at, crew] of [['portola-2026', SUN_9PM], ['acl-2026', ACL_W2_SAT_9PM], ['acl-2026', ACL_W1_SAT_150AM, ACL_ALL_SAT]]) {
        const { ctx, page, errors } = await open(get(), { fest, at, width, crew });
        try {
          await openPlan(page);
          const line = await page.evaluate(() => {
            const nm = document.querySelector('#plan .plan-row.earlier .plan-what .nm');
            return nm && { text: nm.textContent, scroll: nm.scrollWidth, client: nm.clientWidth,
              lines: Math.round(nm.getBoundingClientRect().height / parseFloat(getComputedStyle(nm).lineHeight)),
              items: [...nm.querySelectorAll('b')].map((b) => b.getClientRects().length) };
          });
          assert.ok(line && /\d+ stops?$/.test(line.text), `${fest}: an Earlier line with stops folded: ${JSON.stringify(line)}`);
          assert.ok(line.scroll <= line.client, `${fest}: the Earlier line's words fit their box: ${JSON.stringify(line)}`);
          // Portola's three nights behind run on consecutive dates: one range.
          if (fest === 'portola-2026') assert.match(line.text, /^Earlier · Thu – Sat · \d+ stops$/);
          if (crew) {
            assert.equal(line.text, 'Earlier · Sep 29 · Oct 1 · Oct 2 · 10 stops');
            // No label or count is split between two lines ("SEP" / "29").
            assert.deepEqual(line.items, line.items.map(() => 1), `every label on one line: ${JSON.stringify(line)}`);
          }
          // The chevron sits clear of the words, at the row's end, and the node
          // and the chevron at the middle of the words, however many lines.
          const clear = await page.evaluate(() => {
            const row = document.querySelector('#plan .plan-row.earlier');
            const nm = row.querySelector('.plan-what .nm').getBoundingClientRect();
            const words = document.createRange();
            words.selectNodeContents(row.querySelector('.plan-what .nm'));
            const w = words.getBoundingClientRect();
            const chev = row.querySelector('.chev').getBoundingClientRect();
            const node = row.querySelector('.plan-node').getBoundingClientRect();
            const mid = (r) => Math.round((r.top + r.height / 2) * 10) / 10;
            return { wordsEnd: Math.round(w.right), boxEnd: Math.round(nm.right), chev: Math.round(chev.left), rowEnd: Math.round(row.getBoundingClientRect().right),
              words: mid(w), node: mid(node), chevMid: mid(chev), row: mid(row.getBoundingClientRect()), tall: Math.round(w.height) };
          });
          assert.ok(clear.wordsEnd < clear.chev - 4 && clear.chev > clear.rowEnd - 24, `${fest}: the chevron is at the row's end, clear of the words: ${JSON.stringify(clear)}`);
          // (The chevron's own nudge, translateY(-2px) inside its 45° turn, lifts
          // its box about 1.4px: an optical centre, allowed for.)
          for (const [k, off] of [['node', 1.5], ['row', 1.5], ['chevMid', 2.5]]) assert.ok(Math.abs(clear[k] - clear.words) <= off, `${fest}: the ${k} is at the words' middle: ${JSON.stringify(clear)}`);
          if (crew && width === 320) assert.equal(line.lines, 2, `ACL's longest takes two lines at 320: ${JSON.stringify({ line, clear })}`);
          else assert.equal(line.lines, 1, `${fest}: one line where it fits: ${JSON.stringify({ line, clear })}`);
          assert.deepEqual(errors, []);
        } finally { await ctx.close(); }
      }
    });
  }

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
      // Read at the end of its transition, not at a fixed moment: a loaded
      // runner can still be mid-fade here (CI run 36311950842 read opacity
      // 0.13 and width 1.7px).
      const mark = await page.evaluate(async () => {
        const svg = document.querySelector('#plan .plan-share svg');
        const cs = getComputedStyle(svg);
        void cs.opacity; // style is current, so a transition the rest started is listed
        const ends = svg.getAnimations().map((a) => a.finished.catch(() => {}));
        await Promise.race([Promise.all(ends), new Promise((r) => setTimeout(r, 3000))]);
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
  test(`${name}: a highlight that empties the plan keeps it open under the menu — the day says why and the Share rests; closed, the shelf goes (a repaint during the close too), and Everyone brings it back`, { skip }, async () => {
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
      // Closed with no row to go back to, the shelf leaves. A repaint in that
      // motion (the minute's tick) is not an arrival: the shelf goes, and the
      // next minute leaves it gone (Sol's recheck on daf9c3b: it came back as
      // a peek with no row).
      const hit = await closeWithRepaint(page, SAT_941);
      assert.ok(hit && !hit.was.hidden && hit.was.state === 'open', `the repaint came while the shelf was closing: ${JSON.stringify(hit)}`);
      assert.notEqual(hit.then.state, 'peek', `the repaint did not bring the shelf back: ${JSON.stringify(hit)}`);
      await until(async () => (await planState(page)) === 'none', 'closed with no peek, the shelf goes, repaint and all', 4000);
      await page.clock.setFixedTime(SAT_942);
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await sleep(60);
      await settled(page);
      assert.equal(await planState(page), 'none', 'and the next minute leaves it gone');
      // With a highlight on, the avatar's slot is the pill: its faces reopen the menu.
      await tap(page, '#dock-you-wrap .hl-pill .hl-faces');
      await menuUp(page, '#dock-you-wrap .hl-pop');
      assert.equal(await planRow(page, '#dock-you-wrap'), null, 'no plan, no row');
      await tap(page, '#dock-you-wrap .hl-pop [data-person=""]');
      await until(async () => (await planState(page)) === 'peek', 'Everyone brings the peek back');
      await until(async () => !!(await planRow(page, '#dock-you-wrap')), 'and the open menu its Our picks row');
      assert.match(await tagged(page), /^Now: Dog Blood, Pier Stage/);
      // (A visibilitychange asks the service worker to update, and the
      // harness blocks service workers: that throw is the harness's.)
      assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
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

