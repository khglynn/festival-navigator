// ACL ready, with real input (the plan-days build's P5, 2026-09-27). ACL runs
// two Zilker weekends with dated Late nights between (Sep 29 to Oct 10), so
// the open plan a friend opens on the first Late night holds a fortnight.
// Two checks, in the real app with the made-up ACL crew of eight
// (tests/fixtures/plan-crew-acl.json), /api answered in the page, every write
// refused, navigator.share a stub that keeps what it was handed:
// 1. The Share per night: from Tue Sep 29, 6 PM, the list is scrolled to every
//    night in turn, and what the Share sends there is that night's golden —
//    today's from now, every other night whole, a bare night resting and
//    saying so — and every picks line it sends is a row of that night.
// 2. The Late nights render with times: all 66 entries over their 10 dates,
//    each card on its date with its time drawn and whole, the 31 guesses
//    wearing the tilde — on the Board and in the List.
// 3. The morning after: a plan left open from the last night's end past 5 AM
//    draws that night as past, its Share sends it whole, and a close lets the
//    shelf go.
// The model's goldens for the days list are tests/plan-acl.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { fontsIn, launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => JSON.parse(readFileSync(path.join(ROOT, f), 'utf8'));
const CREW = read('tests/fixtures/plan-crew-acl.json');
const FEST = read('data/festivals/acl-2026.json');
const FID = 'acl-2026';
const TUE_SEP29_6PM = new Date('2026-09-29T18:00:00-05:00');
const MON_SEP28_NOON = new Date('2026-09-28T12:00:00-05:00'); // the day before the first Late night: nothing is over
const QUIET_MS = 450; // the shelf swallows the click just after a tap (plan-shelf.js quietUntil, 400)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

async function open(engine, { at = TUE_SEP29_6PM, desk = false, view = null } = {}) {
  const crewToken = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, deviceScaleFactor: 2, timezoneId: 'America/Chicago', serviceWorkers: 'block',
  });
  await lateStarts(ctx);
  const doc = {
    v: 4, meta: { name: 'Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(CREW.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: CREW.picks } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t, f, me, v]) => {
    // The List is this phone's choice for the festival (filters.js loadView);
    // a link's &view= only starts a phone that has never shown the festival.
    if (v) localStorage.setItem(`fn_view_v1_${f}`, v);
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, me);
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
    window.__shared = [];
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } });
  }, [crewToken, FID, CREW.me, view]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  await page.goto(`${server.origin}/#g=${crewToken}&f=${FID}`);
  await page.waitForSelector('#wall-root .day-block', { timeout: 15000 });
  await fontsIn(page);
  await motionDone(page);
  return { ctx, page, crewToken, errors: () => errors.filter((e) => !/reg\.update|reading 'update'/.test(e)) };
}
const settled = async (page) => { await motionDone(page, { within: '#plan' }); await sleep(QUIET_MS); };
const planState = (page) => page.evaluate(() => { const el = document.getElementById('plan'); return el && !el.hidden ? el.dataset.state : 'none'; });

// ---- 1. the Share per night -------------------------------------------------------------
const state = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const list = q('#plan .plan-list');
  return {
    wd: (q('#plan .plan-head .wd') || {}).textContent || '',
    share: q('#plan .plan-share').textContent.trim(),
    off: q('#plan .plan-share').disabled,
    top: list.scrollTop, room: list.scrollHeight - list.clientHeight - list.scrollTop,
  };
});
// Where a night's first row sits under the list's top edge (0: at the top). A
// run of bare nights is one head naming every night in it (`data-nights`).
const nightTop = (page, night) => page.evaluate((n) => {
  const list = document.querySelector('#plan .plan-list');
  const row = [...list.children].find((r) => r.dataset.night === n || (r.dataset.nights || '').split(' ').includes(n));
  return row ? row.getBoundingClientRect().top - list.getBoundingClientRect().top : null;
}, night);
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
    const { room, top } = await state(page);
    if (Math.abs(dy) <= 2 || (dy > 0 && room < 1) || (dy < 0 && top < 1)) return;
    await wheel(page, dy);
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

// The nights the open plan holds from the first Late night, in order, and
// what the Share says and sends with each at the top. `text` is null where
// the Share rests. The link's crew token reads TOKEN, and this run's server
// ORIGIN.
const SHARE_GOLDEN = [
  { night: '2026-09-29', wd: 'TUE', share: 'Share today’s picks', text: [
    "Our crew's main picks for Sep 29 ACL, now till end of day",
    '',
    'Mohawk Austin for Fcukers @ ~8:45pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-09-29',
  ].join('\n') },
  { night: '2026-10-01', wd: 'THU', share: 'Share Thu Oct 1’s picks', text: [
    "Our crew's main picks for Oct 1 ACL",
    '',
    "Stubb's for Jess Williamson and Brandon Flowers @ ~8:30pm",
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-01',
  ].join('\n') },
  { night: '2026-10-02', wd: 'FRI', share: 'Share Fri Oct 2’s picks', text: [
    "Our crew's main picks for Oct 2 ACL",
    '',
    'Miller Lite for Faouzia @ 1:45pm',
    'Miller Lite for Paris Paloma @ 3:15pm',
    'Miller Lite for Brandon Flowers @ 5:15pm',
    'T-Mobile for Turnstile @ 6:15pm',
    'T-Mobile for Skrillex @ 8:15pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-02',
  ].join('\n') },
  { night: '2026-10-03', wd: 'SAT', share: 'Share Sat Oct 3’s picks', text: [
    "Our crew's main picks for Oct 3 ACL",
    '',
    'Miller Lite for Arcy Drive @ 3:40pm',
    'Beatbox for Ryan Beatty @ 5:50pm',
    'T-Mobile for Lorde @ 8:15pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-03',
  ].join('\n') },
  { night: '2026-10-04', wd: 'SUN', share: 'Share Sun Oct 4’s picks', text: [
    "Our crew's main picks for Oct 4 ACL",
    '',
    "Tito's for Fcukers @ 6:30pm",
    'T-Mobile for The xx @ 8:35pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-04',
  ].join('\n') },
  { night: '2026-10-05', wd: 'MON', share: 'Nothing to share Monday', text: null },
  { night: '2026-10-08', wd: 'THU', share: 'Share Thu Oct 8’s picks', text: [
    "Our crew's main picks for Oct 8 ACL",
    '',
    'Brushy Street Commons for Arcy Drive @ ~8:45pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-08',
  ].join('\n') },
  { night: '2026-10-09', wd: 'FRI', share: 'Share Fri Oct 9’s picks', text: [
    "Our crew's main picks for Oct 9 ACL",
    '',
    'American Express for Faouzia @ 2:45pm',
    'Miller Lite for Paris Paloma @ 5:15pm',
    'T-Mobile for Turnstile @ 6:15pm',
    'T-Mobile for Kings of Leon @ 8:15pm',
    'American Express for Charli xcx @ 8:40pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-09',
  ].join('\n') },
  { night: '2026-10-10', wd: 'SAT', share: 'Share Sat Oct 10’s picks', text: [
    "Our crew's main picks for Oct 10 ACL",
    '',
    'Beatbox for Arcy Drive @ 3:30pm',
    'Beatbox for Ryan Beatty @ 5:30pm',
    'T-Mobile for Lorde @ 8:15pm',
    'Devil May Care for Fcukers @ 11:45pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-10',
  ].join('\n') },
  { night: '2026-10-11', wd: 'SUN', share: 'Share Sun Oct 11’s picks', text: [
    "Our crew's main picks for Oct 11 ACL",
    '',
    "Tito's for Fcukers @ 6:30pm",
    'T-Mobile for The xx @ 8:30pm',
    'American Express for Twenty One Pilots @ 8:30pm',
    '',
    'Full rundown: ORIGIN/f/acl-2026#g=TOKEN&f=acl-2026&plan=2026-10-11',
  ].join('\n') },
];

for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  test(`${name}: from Tue Sep 29, 6 PM, the Share sends each night the list brings to the top — today from now, the rest whole, a bare night resting`, { skip }, async () => {
    const { ctx, page, crewToken, errors } = await open(engine);
    try {
      await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
      await settled(page);
      const box = await page.locator('#plan .plan-grab').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await settled(page);
      assert.equal(await planState(page), 'open');
      // The nights, as the list holds them: today's, under the panel's own
      // head, then each day head's — a run of bare nights is one head, and
      // one place for the list to bring to the top.
      const nights = await page.evaluate(() => {
        const list = document.querySelector('#plan .plan-list');
        const out = [list.querySelector(':scope > [data-night]').dataset.night];
        for (const r of list.querySelectorAll(':scope > .plan-day')) if (!out.includes(r.dataset.night)) out.push(r.dataset.night);
        return out;
      });
      const got = [];
      for (const night of nights) {
        await scrollToNight(page, night);
        const s = await state(page);
        const entry = { night, wd: s.wd, share: s.share, text: null };
        if (!s.off) {
          const text = await share(page);
          entry.text = text.split(crewToken).join('TOKEN').split(server.origin).join('ORIGIN');
          await linesInNight(page, text, night);
        }
        got.push(entry);
      }
      if (process.env.PLAN_ACL_PRINT) console.log(JSON.stringify(got, null, 2));
      else assert.deepEqual(got, SHARE_GOLDEN);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });
}

// ---- 3. the morning after ---------------------------------------------------------------
// Sol's important on 0f076a6: past 5 AM on the day after the festival, a plan
// still open fell back to the last night with no clock, and Sunday came back
// whole and undimmed with its Share on, as if still to come. It stays open on
// Sunday as a night before today — its rows dimmed under its head, as an
// opened Earlier draws them — its Share names it and sends it whole, and a
// close lets the shelf go (there is no peek to close to).
const SUN_OCT11_9PM = new Date('2026-10-11T21:00:00-05:00');   // The xx, the festival's last set
const SUN_OCT11_1130PM = new Date('2026-10-11T23:30:00-05:00'); // nothing left today
const MON_OCT12_501AM = new Date('2026-10-12T05:01:00-05:00');  // the festival's night is behind the phone
const MON_OCT12_502AM = new Date('2026-10-12T05:02:00-05:00');
const MON_OCT12_503AM = new Date('2026-10-12T05:03:00-05:00');
async function tick(page, at) {
  await page.clock.setFixedTime(at);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(60);
  await settled(page);
}
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
// Poll from Node, in real time (the page's timers ride the fake clock).
async function until(ok, what, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ok()) return; await sleep(50); }
  assert.fail(`timed out waiting: ${what}`);
}
// How bright each of a night's lines is drawn: its opacity times any opacity
// filter — the past's dim, whichever property carries it.
const brightness = (page, night) => page.evaluate((n) => [...document.querySelectorAll(`#plan .plan-list > [data-night="${n}"]`)].map((r) => {
  const cs = getComputedStyle(r);
  const m = /opacity\(([\d.]+)(%?)\)/.exec(cs.filter || '');
  const f = m ? Number(m[1]) / (m[2] ? 100 : 1) : 1;
  return { past: r.classList.contains('past'), head: r.classList.contains('plan-day'), lit: Math.round(Number(cs.opacity) * f * 100) / 100 };
}), night);
for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  test(`${name}: the morning after, a plan left open draws the last night as past, sends it whole, and a close lets the shelf go — a repaint during the close too`, { skip }, async () => {
    const { ctx, page, errors } = await open(engine, { at: SUN_OCT11_9PM });
    try {
      await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
      await settled(page);
      const grab = async () => {
        const box = await page.locator('#plan .plan-grab').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await settled(page);
      };
      await grab();
      assert.equal(await planState(page), 'open');
      await tick(page, SUN_OCT11_1130PM);
      assert.equal(await planState(page), 'open', 'open past the last stop');
      assert.equal((await state(page)).off, true, 'at 11:30 PM nothing is left to send today');
      // The minute turns past 5 AM, and its repaint's motion — Sunday's lines
      // arriving — is held near its end: a past line is never drawn brighter
      // than it rests. (The dim used to be the rows' own opacity, which every
      // fade of the window's also writes: a line faded in to full and then
      // dropped to the dim, a pop — and CI's Linux WebKit, reading mid-fade,
      // saw two of five lines undimmed, run 36319088534.)
      await page.clock.setFixedTime(MON_OCT12_501AM);
      const held = await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        const moving = document.getElementById('plan').getAnimations({ subtree: true })
          .filter((a) => Number.isFinite(a.effect.getComputedTiming().endTime));
        for (const a of moving) {
          const t = a.effect.getComputedTiming();
          a.pause();
          a.currentTime = (t.delay || 0) + t.activeDuration * 0.95;
        }
        return moving.length;
      });
      const mid = await brightness(page, '2026-10-11');
      await page.evaluate(() => document.getElementById('plan').getAnimations({ subtree: true }).forEach((a) => { try { a.finish(); } catch { /* an endless one */ } }));
      await settled(page);
      assert.equal(await planState(page), 'open', 'open across the rollover');
      const rows = await brightness(page, '2026-10-11');
      assert.ok(rows.length > 2 && rows[0].head, `Sunday under its own head: ${JSON.stringify(rows)}`);
      assert.ok(rows.every((r) => r.past && r.lit < 0.6), `every Sunday line is drawn past, dimmed: ${JSON.stringify(rows)}`);
      assert.ok(held === 0 || mid.every((r) => r.lit <= rows[0].lit + 0.02), `a past line never shows brighter than it rests, even as it arrives (${held} motions held near their end): ${JSON.stringify(mid)}`);
      const s = await state(page);
      assert.deepEqual([s.wd, s.share, s.off], ['SUN', 'Share Sun Oct 11’s picks', false], 'the head and the Share name Sunday by its date');
      const text = await share(page);
      assert.ok(text.endsWith('&plan=2026-10-11'), `the link opens on Sunday:\n${text}`);
      assert.doesNotMatch(text, /now till|@ now/, 'Sunday reads whole, not from now');
      assert.match(text, /The xx/, text);
      // The close has no row to go back to, so the shelf leaves. A repaint in
      // that motion (5:02 AM's tick) is not an arrival: the shelf goes, and
      // the next minute leaves it gone (Sol's recheck on daf9c3b: it came
      // back as a peek with no row).
      const hit = await closeWithRepaint(page, MON_OCT12_502AM);
      assert.ok(hit && !hit.was.hidden && hit.was.state === 'open', `the repaint came while the shelf was closing: ${JSON.stringify(hit)}`);
      assert.notEqual(hit.then.state, 'peek', `the repaint did not bring the shelf back: ${JSON.stringify(hit)}`);
      await until(async () => (await planState(page)) === 'none', 'a close lets the shelf go, repaint and all');
      await tick(page, MON_OCT12_503AM);
      assert.equal(await planState(page), 'none', 'and the next minute leaves it gone');
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });
}

// ---- 2. the Late nights render with times -----------------------------------------------
const LATE = FEST.artists.filter((a) => a.day === 'Late nights' && a.date);
const DATES = [...new Set(LATE.map((a) => a.date))].sort();
const expectTime = (a) => (a.approx === true ? `~${a.time}` : a.time);

for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  for (const view of [null, 'list']) {
    test(`${name}${view ? ' List' : ''}: every Late night is on its date with its time drawn — 66 over 10 dates, the 31 guesses with a tilde`, { skip }, async () => {
      assert.deepEqual([LATE.length, DATES.length, LATE.filter((a) => a.approx === true).length, LATE.filter((a) => !a.time).length], [66, 10, 31, 0], 'the data this checks');
      const { ctx, page, errors } = await open(engine, { at: MON_SEP28_NOON, view });
      try {
        const drawn = await page.evaluate((dates) => {
          const out = {};
          for (const iso of dates) {
            const room = document.querySelector(`#wall-root .day-block .room[data-iso="${iso}"]`);
            if (!room) { out[iso] = null; continue; }
            room.scrollIntoView({ block: 'center' });
            out[iso] = [...room.querySelectorAll('.card[data-artist]')].map((c) => {
              const t = c.querySelector('.time');
              const cb = c.getBoundingClientRect();
              const tb = t ? t.getBoundingClientRect() : null;
              const cs = t ? getComputedStyle(t) : null;
              return {
                name: c.dataset.artist,
                time: t ? t.textContent : null,
                shown: !!t && t.getClientRects().length > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && tb.width > 0,
                whole: !!tb && tb.left >= cb.left - 0.5 && tb.right <= cb.right + 0.5 && tb.bottom <= cb.bottom + 0.5,
              };
            });
          }
          return out;
        }, DATES);
        const rows = await page.evaluate(() => document.querySelectorAll('#wall-root .room[data-iso] .card.row').length);
        assert.equal(rows, view ? LATE.length : 0, view ? 'the List draws every card as a row' : 'the Board draws no rows');
        for (const iso of DATES) {
          const want = LATE.filter((a) => a.date === iso);
          const cards = drawn[iso];
          assert.ok(cards, `${iso}: a room for the date`);
          assert.deepEqual(cards.map((c) => c.name).sort(), want.map((a) => a.name).sort(), `${iso}: every entry, and only those`);
          for (const a of want) {
            const c = cards.find((x) => x.name === a.name);
            assert.ok(c.time && c.time.startsWith(expectTime(a)), `${iso} ${a.name}: its time is ${expectTime(a)}, drawn "${c.time}"`);
            assert.ok(c.shown && c.whole, `${iso} ${a.name}: its time is drawn and whole: ${JSON.stringify(c)}`);
          }
        }
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });
  }
}
