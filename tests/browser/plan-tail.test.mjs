// The room under the last day (the plan-days build, the P1–P3 review's first
// three findings, 2026-09-27: claude-plans/2026-09-26-unified-build/
// plan-days-design/REVIEW-P1P3.md). The open plan lets its last day come to
// the top, so the head and the Share can name it. That room used to be the
// list's bottom padding, cleared and measured again on every draw: a reader
// parked on the last day had the scroll clamped under them by any repaint
// (the minute, a tap, the Share's own), the head and the Share turned back to
// Saturday; a card that fitted read as cut off and moved its row; and a plan
// short enough to fit grew a gap under its last row and jumped as it opened.
// On ACL's second Saturday — Sunday Oct 11 is its last day, every day — with
// the made-up ACL crew (tests/fixtures/plan-crew-acl.json) and a made-up
// three whose plan fits. /api answered in the page, every write refused;
// navigator.share is a stub that keeps what it was handed.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { fontsIn, launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ACL_CREW = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/plan-crew-acl.json'), 'utf8'));
// Three who picked two sets, both weekends: on the second Saturday their plan
// is Arcy Drive now and The xx on Sunday — it fits the shelf with room over.
const SHORT_CREW = {
  members: ['Ada', 'Bo', 'Cal'], me: 'Ada',
  picks: { 'Arcy Drive': { Ada: 3, Bo: 3, Cal: 3 }, 'The xx': { Ada: 3, Bo: 3, Cal: 3 } },
};
const FID = 'acl-2026';
const SAT = '2026-10-10';
const SUN = '2026-10-11';
const W2_SAT_4PM = new Date('2026-10-10T16:00:00-05:00');   // Arcy Drive on Beatbox, 3:30–4:30
const W2_SAT_431 = new Date('2026-10-10T16:31:00-05:00');   // it is over: the minute folds it into Earlier
const W2_SUN_845 = new Date('2026-10-11T20:45:00-05:00');   // The xx on T-Mobile, the festival's last set
const QUIET_MS = 450; // the shelf swallows the click just after a tap (plan-shelf.js quietUntil, 400)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

async function open(engine, { crew = ACL_CREW, desk = false, at = W2_SAT_4PM } = {}) {
  const crewToken = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, deviceScaleFactor: 2, timezoneId: 'America/Chicago', serviceWorkers: 'block',
  });
  await lateStarts(ctx);
  // The crew doc the page pulls, as it is when it asks: a test changes a
  // friend's picks here, then `pull` (below) has the page ask again.
  const doc = {
    v: 4, meta: { name: 'Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(crew.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: structuredClone(crew.picks) } },
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
  }, [crewToken, FID, crew.me]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  await page.goto(`${server.origin}/#g=${crewToken}&f=${FID}`);
  await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
  await fontsIn(page);
  await settled(page);
  return { ctx, page, doc, errors: () => errors.filter((e) => !/reg\.update|reading 'update'/.test(e)) };
}
// A friend's pick reaching an open page: the doc changed on the server, and
// the page, shown again, polls it (app.js visibilitychange → pollSync). Waits
// for the rows the new doc draws (`drawn`: a check on the page), then rest.
async function pull(page, drawn, what) {
  await page.evaluate(() => { document.querySelector('#plan .plan-list').dataset.old = '1'; });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const end = Date.now() + 8000;
  for (;;) {
    const ok = await page.evaluate(`(() => { const list = document.querySelector('#plan .plan-list'); return !list.dataset.old && (${drawn})(list); })()`);
    if (ok) break;
    assert.ok(Date.now() < end, `the page drew the friend's change: ${what}`);
    await sleep(50);
  }
  await settled(page);
}
const settled = async (page) => { await motionDone(page, { within: '#plan' }); await sleep(QUIET_MS); };
const planState = (page) => page.evaluate(() => { const el = document.getElementById('plan'); return el && !el.hidden ? el.dataset.state : 'none'; });

// A real tap: a finger on the phone, the mouse on the laptop.
async function tap(page, target, { at = 0.5 } = {}) {
  const el = typeof target === 'string' ? page.locator(target).first() : target;
  const b = await el.boundingBox();
  assert.ok(b, `${target} is on screen`);
  const x = b.x + b.width * at;
  const y = b.y + b.height / 2;
  if ((page.viewportSize() || {}).width < 720) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await sleep(60);
}
async function openPlan(page, desk) {
  // The laptop's card is one button; the phone's peek opens from its grabber.
  await tap(page, desk ? '#plan .plan-row.tagged' : '#plan .plan-grab', { at: desk ? 0.4 : 0.5 });
  await settled(page);
  assert.equal(await planState(page), 'open');
}
// The minute's tick as the page runs it on a shown page (app.js tickClock).
async function tick(page, at) {
  await page.clock.setFixedTime(at);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(60);
  await settled(page);
}

// What the head, the Share and the list say right now.
const read = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const desk = innerWidth >= 720;
  const head = desk ? q('#plan .plan-grab .pc-head') : q('#plan .plan-head');
  const list = q('#plan .plan-list');
  return {
    wd: ((head && head.querySelector('.wd')) || {}).textContent || '',
    share: q('#plan .plan-share').textContent.trim(),
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
// To the end of the list: the last day, Sunday, at the top.
async function toSunday(page) {
  await wheel(page, 4000);
  const r = await read(page);
  assert.ok(r.room < 1, 'at the end of the list');
  assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `Sunday’s head is at the top: ${await nightTop(page, SUN)}`);
  assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks']);
}
async function share(page) {
  const before = await page.evaluate(() => window.__shared.length);
  await tap(page, '#plan .plan-share');
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
// The shelf's box on every frame while `fn` runs, until it is still.
async function framesOf(page, fn) {
  await page.evaluate(() => {
    window.__frames = [];
    window.__rec = true;
    const step = () => {
      if (!window.__rec) return;
      const b = document.getElementById('plan').getBoundingClientRect();
      window.__frames.push({ top: Math.round(b.top * 10) / 10, h: Math.round(b.height * 10) / 10 });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await fn();
  await settled(page);
  return page.evaluate(() => { window.__rec = false; return window.__frames; });
}
// The peek's row ends on the dock's top edge (plan-drag's geometry).
const peekOnDock = (page) => page.evaluate(() => {
  const r = document.querySelector('#plan .plan-row.tagged').getBoundingClientRect();
  return Math.abs(r.bottom - document.getElementById('dock').getBoundingClientRect().top);
});

for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  for (const desk of [false, true]) {
    const how = desk ? `${name} laptop` : name;

    test(`${how}: Sunday at the top stays there through a repaint (the minute folding a stop) and a tap on a Sunday row`, { skip }, async () => {
      const { ctx, page, errors } = await open(engine, { desk });
      try {
        await openPlan(page, desk);
        // Two Saturday cards a person grew, so the plan still overflows once
        // the minute folds Arcy Drive and its NOW card away. A repaint that
        // leaves the plan short enough to fit is the short plan's case (below).
        for (let i = 0; i < 2; i++) {
          const more = page.locator(`#plan button.plan-row[data-night="${SAT}"]:not(.earlier):not(.tagged):not([aria-expanded="true"])`).first();
          await tap(page, more, { at: 0.35 });
          await settled(page);
        }
        await toSunday(page);
        await page.evaluate(() => { document.querySelector('#plan .plan-list').dataset.old = '1'; });
        await tick(page, W2_SAT_431);
        assert.equal(await page.evaluate(() => document.querySelector('#plan .plan-list').dataset.old), undefined, 'the minute redrew the rows');
        assert.equal(await planState(page), 'open', 'the plan stays open across the minute');
        const over = await page.evaluate(() => {
          const list = document.querySelector('#plan .plan-list');
          const rows = [...list.children].filter((x) => !x.classList.contains('plan-tail'));
          const last = rows[rows.length - 1];
          const end = last.offsetTop + last.offsetHeight + (parseFloat(getComputedStyle(list).paddingBottom) || 0);
          return { end, box: list.clientHeight, earlier: !!list.querySelector('.plan-row.earlier'), grown: list.querySelectorAll('.plan-row[aria-expanded="true"]').length };
        });
        assert.ok(over.earlier && over.end > over.box + 40, `the premise: Arcy Drive folded, and the rows alone still overflow the list: ${JSON.stringify(over)}`);
        let r = await read(page);
        assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `after the repaint Sunday’s head is still at the top: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks'], 'the head and the Share still name Sunday');
        // A tap on Sunday's first stop grows its card under it; the row stays
        // under the finger (the card fits below it), and Sunday stays on top.
        const row = page.locator(`#plan button.plan-row[data-night="${SUN}"]:not(.earlier)`).first();
        const was = (await row.boundingBox()).y;
        await tap(page, row, { at: 0.35 });
        await settled(page);
        assert.equal(await row.getAttribute('aria-expanded'), 'true', 'its card grew');
        const now = (await row.boundingBox()).y;
        assert.ok(Math.abs(now - was) <= 1, `the tapped row stayed under the finger: ${was} → ${now}`);
        r = await read(page);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks'], 'the head and the Share still name Sunday after the tap');
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });

    test(`${how}: a Share tapped with Sunday at the top sends Sunday, whole`, { skip }, async () => {
      const { ctx, page, errors } = await open(engine, { desk });
      try {
        await openPlan(page, desk);
        await toSunday(page);
        const text = await share(page);
        assert.ok(text.endsWith(`&plan=${SUN}`), `the link opens on Sunday:\n${text}`);
        assert.doesNotMatch(text, /now till|@ now/, 'Sunday reads whole, not from now');
        assert.match(text, /The xx/, text);
        const r = await read(page);
        assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `Sunday’s head is still at the top after the Share: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks']);
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });

    test(`${how}: a lower Saturday row whose card fits does not move when it is tapped`, { skip }, async () => {
      const { ctx, page, errors } = await open(engine, { desk });
      try {
        await openPlan(page, desk);
        // The lowest Saturday stop with room under it, inside the list's
        // visible box, for a card the NOW row's size (Arcy Drive's, grown as
        // the plan opens) and a margin. The box, not its padding: the old
        // room under the last day WAS the padding, and inflated it.
        const pick = await page.evaluate((sat) => {
          const list = document.querySelector('#plan .plan-list');
          const floor = list.getBoundingClientRect().bottom - 24;
          const grown = list.querySelector('.plan-grow');
          const cardH = grown ? grown.getBoundingClientRect().height : 0;
          const rows = [...list.querySelectorAll(`button.plan-row[data-night="${sat}"]:not(.earlier):not(.tagged)`)]
            .filter((r) => r.getAttribute('aria-expanded') !== 'true' && r.getBoundingClientRect().bottom + cardH + 12 <= floor);
          const r = rows[rows.length - 1];
          if (!r) return { cardH, floor };
          return { cardH, floor, label: r.getAttribute('aria-label'), stop: r.dataset.stop };
        }, SAT);
        assert.ok(pick.label, `a Saturday row with room for its card: ${JSON.stringify(pick)}`);
        // By its stop: the tap draws the rows again, and the row is a new element.
        const byStop = `#plan .plan-row[data-stop="${pick.stop.replace(/["\\]/g, '\\$&')}"]`;
        const row = page.locator(byStop);
        const was = (await row.boundingBox()).y;
        const topWas = (await read(page)).top;
        await tap(page, row, { at: 0.35 });
        await settled(page);
        assert.equal(await row.getAttribute('aria-expanded'), 'true', `${pick.label}: its card grew`);
        const fit = await page.evaluate((sel) => {
          const list = document.querySelector('#plan .plan-list');
          const card = document.querySelector(sel).nextElementSibling;
          return { card: card.getBoundingClientRect().bottom, bottom: list.getBoundingClientRect().bottom };
        }, byStop);
        assert.ok(fit.card <= fit.bottom, `the card is whole inside the list: ${JSON.stringify(fit)}`);
        const now = (await row.boundingBox()).y;
        assert.ok(Math.abs(now - was) <= 1, `${pick.label}: the row stayed under the finger (${was} → ${now}; the list scrolled ${topWas} → ${(await read(page)).top})`);
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });

    // Sol's blocker on 0f076a6 (2026-09-27): a redraw kept a NUMBER, not a
    // place. A friend's pick that adds a Saturday stop above slides Sunday
    // down under the same offset, and Saturday's rows came to the top — the
    // head and the Share turned to Saturday, and a Share sent Saturday.
    test(`${how}: a friend's pick that adds a Saturday stop above keeps Sunday at the top, and the Share sends Sunday`, { skip }, async () => {
      const { ctx, page, doc, errors } = await open(engine, { desk });
      try {
        await openPlan(page, desk);
        await toSunday(page);
        // Dee, Eve and Gil pick Bleachers (T-Mobile, 6:15 PM): a stop of three
        // between Ryan Beatty and Lorde.
        doc.festivals[FID].selections.Bleachers = { Dee: 3, Eve: 3, Gil: 3 };
        await pull(page, `(list) => [...list.querySelectorAll('.plan-row')].some((r) => r.dataset.night === '${SAT}' && /Bleachers/.test(r.textContent))`, 'a Bleachers stop on Saturday');
        const r = await read(page);
        assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `Sunday's head is still at the top: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks'], 'the head and the Share still name Sunday');
        const text = await share(page);
        assert.ok(text.endsWith(`&plan=${SUN}`), `the Share sends Sunday:\n${text}`);
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });

    test(`${how}: a pick taken back that removes a Saturday stop above keeps Sunday at the top`, { skip }, async () => {
      const { ctx, page, doc, errors } = await open(engine, { desk });
      try {
        await openPlan(page, desk);
        await toSunday(page);
        // Cal takes back Ryan Beatty: two is under the crew's bar, and the stop goes.
        delete doc.festivals[FID].selections['Ryan Beatty'].Cal;
        await pull(page, `(list) => ![...list.querySelectorAll('.plan-row')].some((r) => r.dataset.night === '${SAT}' && /Ryan Beatty/.test(r.textContent))`, 'no Ryan Beatty stop on Saturday');
        const r = await read(page);
        assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `Sunday's head is still at the top: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks']);
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });
    // The short-plan default (Kevin's to overrule; the plan-days build log,
    // 2026-09-27): while a plan has a later day, the phone's open shelf takes
    // its full height and the list keeps the room to bring every day to the
    // top — the laptop's panel is full height already. Before it, a plan
    // that fitted had nowhere to scroll: its later day never reached the
    // top, so the head and the Share could never name it.
    test(`${how}: a short plan with a later day lets that day come to the top, and its Share sends it`, { skip }, async () => {
      const { ctx, page, errors } = await open(engine, { crew: SHORT_CREW, desk });
      try {
        await openPlan(page, desk);
        if (!desk) {
          const h = await page.evaluate(() => { const el = document.getElementById('plan'); return { h: el.getBoundingClientRect().height, cap: parseFloat(getComputedStyle(el).maxHeight) }; });
          assert.ok(h.h >= h.cap - 0.5, `the open shelf takes its full height: ${JSON.stringify(h)}`);
        }
        await toSunday(page);
        const text = await share(page);
        assert.ok(text.endsWith(`&plan=${SUN}`), `the Share sends Sunday:\n${text}`);
        assert.match(text, /The xx/, text);
        // Arcy Drive ends and Saturday has nothing left: the plan turns to
        // Sunday (the peek says where we start tomorrow), still open, and a
        // plan whose last day is today is content-sized again.
        await tick(page, W2_SAT_431);
        assert.equal(await planState(page), 'open', 'the plan stays open as its day turns');
        const r = await read(page);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks'], 'the head and the Share name Sunday');
        if (!desk) {
          const h = await page.evaluate(() => { const el = document.getElementById('plan'); return { h: el.getBoundingClientRect().height, cap: parseFloat(getComputedStyle(el).maxHeight) }; });
          assert.ok(h.h < h.cap - 40, `a plan with no later day is content-sized: ${JSON.stringify(h)}`);
        }
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });

    // The repaint case of the same default: the minute folds Arcy Drive and
    // its NOW card away, and what is left of the crew's plan fits. The view
    // stays on Sunday — it never goes back to today.
    test(`${how}: Sunday at the top stays there when the minute folds a stop and leaves the plan short`, { skip }, async () => {
      const { ctx, page, errors } = await open(engine, { desk });
      try {
        await openPlan(page, desk);
        await toSunday(page);
        await page.evaluate(() => { document.querySelector('#plan .plan-list').dataset.old = '1'; });
        await tick(page, W2_SAT_431);
        assert.equal(await page.evaluate(() => document.querySelector('#plan .plan-list').dataset.old), undefined, 'the minute redrew the rows');
        const fits = await page.evaluate(() => {
          const list = document.querySelector('#plan .plan-list');
          const rows = [...list.children].filter((x) => !x.classList.contains('plan-tail'));
          const last = rows[rows.length - 1];
          return { end: last.offsetTop + last.offsetHeight + (parseFloat(getComputedStyle(list).paddingBottom) || 0), box: list.clientHeight, earlier: !!list.querySelector('.plan-row.earlier') };
        });
        assert.ok(fits.earlier && fits.end <= fits.box + 1, `the premise: Arcy Drive folded, and the rows alone fit the list: ${JSON.stringify(fits)}`);
        const r = await read(page);
        assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `after the fold Sunday's head is still at the top: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks'], 'the head and the Share still name Sunday');
        const text = await share(page);
        assert.ok(text.endsWith(`&plan=${SUN}`), `the Share sends Sunday:\n${text}`);
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });
  }

  test(`${name}: a highlight changed under the people menu while Sunday is at the top keeps Sunday there, and the Share sends Sunday`, { skip }, async () => {
    const { ctx, page, errors } = await open(engine);
    try {
      await openPlan(page, false);
      await toSunday(page);
      await tap(page, '#dock-you');
      await page.waitForFunction(() => { const m = document.querySelector('#dock-you-wrap .hl-pop'); return !!m && m.getClientRects().length > 0 && getComputedStyle(m).visibility !== 'hidden'; }, null, { timeout: 4000 });
      // Ada is this phone: her own day — Saturday's rows change above Sunday.
      await tap(page, '#dock-you-wrap .hl-pop [data-person="Ada"]');
      await page.waitForFunction(() => /just you/.test(document.querySelector('#plan .plan-head .sub').textContent), null, { timeout: 4000 });
      await settled(page);
      let r = await read(page);
      assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `under the menu, Sunday's head is still at the top: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
      assert.equal(r.wd, 'SUN');
      await tap(page, '#dock-you');
      await page.waitForFunction(() => { const m = document.querySelector('#dock-you-wrap .hl-pop'); return !m || !m.getClientRects().length || getComputedStyle(m).display === 'none'; }, null, { timeout: 4000 });
      await settled(page);
      r = await read(page);
      assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `Sunday's head is still at the top: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
      assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks']);
      const text = await share(page);
      assert.ok(text.endsWith(`&plan=${SUN}`), `the Share sends Sunday:\n${text}`);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });

  for (const [from, to] of [[390, 1280], [1280, 390]]) {
    test(`${name}: crossing ${from} → ${to} with Sunday at the top keeps Sunday there`, { skip }, async () => {
      const { ctx, page, errors } = await open(engine, { desk: from >= 720 });
      try {
        await openPlan(page, from >= 720);
        await toSunday(page);
        await page.setViewportSize(to >= 720 ? { width: 1280, height: 800 } : { width: 390, height: 844 });
        await sleep(400); // the page's resize timer (app.js, 160 ms) and its refit
        await settled(page);
        assert.equal(await planState(page), 'open', 'the plan stays open across the layout');
        const r = await read(page);
        assert.ok(Math.abs(await nightTop(page, SUN)) <= 2, `Sunday's head is still at the top: ${await nightTop(page, SUN)} (scrollTop ${r.top})`);
        assert.deepEqual([r.wd, r.share], ['SUN', 'Share Sun Oct 11’s picks']);
        assert.deepEqual(errors(), []);
      } finally { await ctx.close(); }
    });
  }

  // The short plan with a later day opens to the shelf's full height: the
  // peek is laid out at it, so the open only moves the window up and the
  // close only moves it down — no frame resizes it (the jump the room grew
  // in a content-sized shelf, the P1–P3 review) — and the peek's row sits on
  // the dock before and after.
  test(`${name}: a short plan with a later day opens at the shelf's full height and closes to the peek with no jump`, { skip }, async () => {
    const { ctx, page, errors } = await open(engine, { crew: SHORT_CREW });
    try {
      const peek = await page.evaluate(() => { const el = document.getElementById('plan'); return { h: el.getBoundingClientRect().height, cap: parseFloat(getComputedStyle(el).maxHeight) }; });
      assert.ok(peek.h >= peek.cap - 0.5, `the peek is laid out at the full height: ${JSON.stringify(peek)}`);
      assert.ok(await peekOnDock(page) <= 0.5, `the peek’s row ends on the dock: ${await peekOnDock(page)}`);
      const opening = await framesOf(page, () => tap(page, '#plan .plan-grab'));
      assert.equal(await planState(page), 'open');
      const heights = new Set(opening.map((f) => f.h));
      assert.ok(opening.length > 1 && heights.size === 1 && [...heights][0] === Math.round(peek.h * 10) / 10,
        `the window keeps its height as it opens: ${peek.h} → ${JSON.stringify([...heights])}`);
      const top = await page.evaluate(() => document.getElementById('plan').getBoundingClientRect().top);
      const dock = await page.evaluate(() => document.getElementById('dock').getBoundingClientRect().top);
      assert.ok(Math.abs(top + peek.h - dock) <= 1, `open, the shelf stands on the dock: top ${top} + ${peek.h} vs the dock at ${dock}`);
      const closing = await framesOf(page, () => tap(page, '#plan .plan-grab'));
      assert.equal(await planState(page), 'peek');
      const shut = new Set(closing.map((f) => f.h));
      assert.ok(shut.size === 1 && [...shut][0] === Math.round(peek.h * 10) / 10, `the window keeps its height as it closes: ${JSON.stringify([...shut])}`);
      assert.ok(await peekOnDock(page) <= 0.5, `the peek’s row ends on the dock: ${await peekOnDock(page)}`);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a today-only plan stays content-sized: it opens and closes with no gap under its last row and no jump`, { skip }, async () => {
    const { ctx, page, errors } = await open(engine, { crew: SHORT_CREW, at: W2_SUN_845 });
    try {
      const peek = await page.evaluate(() => document.getElementById('plan').getBoundingClientRect().height);
      const opening = await framesOf(page, () => tap(page, '#plan .plan-grab'));
      assert.equal(await planState(page), 'open');
      const heights = new Set(opening.map((f) => f.h));
      assert.ok(opening.length > 1 && heights.size === 1 && [...heights][0] === Math.round(peek * 10) / 10,
        `the window keeps its height as it opens (the peek is laid out at it): ${peek} → ${JSON.stringify([...heights])}`);
      const box = await page.evaluate(() => {
        const list = document.querySelector('#plan .plan-list');
        const rows = [...list.children].filter((r) => !r.classList.contains('plan-tail'));
        const last = rows[rows.length - 1];
        return {
          scroll: list.scrollHeight - list.clientHeight,
          gap: list.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom,
          pad: parseFloat(getComputedStyle(list).paddingBottom) || 0,
          last: last.getAttribute('aria-label') || last.textContent,
        };
      });
      assert.ok(box.scroll <= 1, `a plan that fits does not scroll: ${JSON.stringify(box)}`);
      assert.ok(box.gap <= box.pad + 1, `no gap under its last row (${box.last}) past the list’s own padding: ${JSON.stringify(box)}`);
      assert.deepEqual((await read(page)).wd, 'SUN');
      const closing = await framesOf(page, () => tap(page, '#plan .plan-grab'));
      assert.equal(await planState(page), 'peek');
      const shut = new Set(closing.map((f) => f.h));
      assert.ok(shut.size === 1 && [...shut][0] === Math.round(peek * 10) / 10, `the window keeps its height as it closes: ${JSON.stringify([...shut])}`);
      assert.ok(await peekOnDock(page) <= 0.5, `the peek’s row ends on the dock: ${await peekOnDock(page)}`);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });
}
