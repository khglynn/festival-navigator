// ACL's Late nights, tonight and through Oct 10 (2026-09-29), with real input
// in the real app: a made-up crew of five on the shipped ACL file, /api
// answered in the page (every write refused), the service worker blocked,
// the phone in Austin's zone. The first Late night is Tue Sep 29: Total Wife
// at 8 PM, Fcukers at ~8:45 PM, Mohawk Austin, close 12 AM.
// 1. The open lands on tonight's room and the day row says LATE — also when
//    the web fonts land after the open (WebKit has no scroll anchoring: each
//    grid day above grew 6px when Inter arrived, and a laptop's open sat
//    36px short with the rail saying SUN 11).
// 2. Tonight's rings across midnight and the 5 AM rollover: each set lights
//    in its own window and nothing is lit after the close; NOW is there
//    exactly while something is on (the day row's, or the peek's when it
//    carries NOW), and a NOW tap lands on what is lit.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { fontsIn, launchBrowser, launchWebkit, lateStarts, motionDone, nowInView, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FID = 'acl-2026';
const CDT = (s) => new Date(`${s}-05:00`);
const ME = 'Ada';
const MEMBERS = ['Ada', 'Bo', 'Cal', 'Dee', 'Eve'];
const PICKS = { // invented; placeholder names on the real lineup
  'Total Wife': { Ada: 3, Bo: 2 },
  Fcukers: { Bo: 3, Dee: 2, Ada: 2 },
  'Brandon Flowers': { Bo: 3, Cal: 3 },
  Parcels: { Ada: 4, Eve: 2 },
  Lorde: { Ada: 4, Bo: 3 },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

// `fontsLate`: hold the two web fonts back until the app has opened on its
// day (a cold open on a slow connection), then let them in.
async function open(engine, { at, width = 390, fontsLate = 0, hold = false }) {
  const desk = width >= 720;
  const token = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: { width, height: desk ? 900 : 844 }, hasTouch: !desk, deviceScaleFactor: 2,
    timezoneId: 'America/Chicago', serviceWorkers: 'block',
  });
  await lateStarts(ctx);
  const doc = {
    v: 4, meta: { name: 'Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(MEMBERS.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: PICKS } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  let letFontsIn = () => {};
  if (fontsLate) {
    const gate = new Promise((go) => { letFontsIn = go; });
    await ctx.route('**/assets/fonts/*.woff2', async (r) => { await gate; await r.fallback(); });
  }
  await ctx.addInitScript(([t, f, me]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, me);
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_welcome_v1', '1');
    localStorage.setItem('fn_welcome_joined_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
  }, [token, FID, ME]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  // (Held fonts hold the load event: wait for the document, not the load.)
  await page.goto(`${server.origin}/#g=${token}&f=${FID}`, { waitUntil: fontsLate ? 'domcontentloaded' : 'load' });
  await page.waitForSelector('#wall-root .day-block', { timeout: 15000 });
  if (fontsLate) {
    // The open has happened (it runs in the same task as the first paint);
    // the fonts arrive after it, as on a cold phone — or, with `hold`, when
    // the test lets them in.
    await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 15000 });
    await sleep(fontsLate);
    if (!hold) letFontsIn();
  }
  if (!hold) {
    await fontsIn(page);
    await motionDone(page);
  }
  return { ctx, page, desk, letFontsIn, errors: () => errors.filter((e) => !/reg\.update|reading 'update'|ResizeObserver loop/.test(e)) };
}
const door = (desk) => (desk ? 'rail' : 'dock');
// The room's head, against the chrome's line (every block's scroll-margin-top).
const landing = (page, iso, desk) => page.evaluate(([i, d]) => {
  const room = document.querySelector(`#wall-root .room[data-iso="${i}"]`);
  const block = room.closest('.day-block');
  const row = document.getElementById(`${d}-days`);
  return {
    gap: Math.round((room.getBoundingClientRect().top - parseFloat(getComputedStyle(block).scrollMarginTop)) * 10) / 10,
    active: [...row.children].filter((t) => t.classList.contains('active')).map((t) => t.textContent.trim()),
    fonts: document.fonts.status,
  };
}, [iso, door(desk)]);

for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  for (const width of [390, 1280]) {
    for (const fontsLate of [0, 900]) {
      test(`${name} ${width}: Tue 4 PM, the open lands on tonight's Late nights room and the day row says LATE${fontsLate ? ' — the fonts landing after the open' : ''}`, { skip }, async () => {
        const { ctx, page, desk, errors } = await open(engine, { at: CDT('2026-09-29T16:00:00'), width, fontsLate });
        try {
          // Until the page has settled on its landing (a correction, if any,
          // comes in the frames after the fonts).
          await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 8000 });
          await sleep(300);
          const at = await landing(page, '2026-09-29', desk);
          assert.ok(Math.abs(at.gap) <= 2, `Sep 29's head sits under the chrome, not ${at.gap}px below it: ${JSON.stringify(at)}`);
          assert.deepEqual(at.active, [desk ? 'LATE NIGHTS' : 'LATE'], JSON.stringify(at));
          assert.deepEqual(errors(), []);
        } finally { await ctx.close(); }
      });
    }
  }
}

// The landing again is the open's, never a hand's: a person who has already
// moved the page when the fonts arrive keeps the page where they put it.
for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  test(`${name} 1280: a wheel before the fonts land keeps the page where the hand put it`, { skip }, async () => {
    const { ctx, page, errors, letFontsIn } = await open(engine, { at: CDT('2026-09-29T16:00:00'), width: 1280, fontsLate: 1, hold: true });
    try {
      await page.mouse.move(640, 450);
      await page.mouse.wheel(0, -600);
      await page.waitForFunction(() => { const w = window.__still || (window.__still = { y: -1, n: 0 }); if (scrollY !== w.y) { w.y = scrollY; w.n = 0; return false; } w.n += 1; return w.n > 5; }, null, { polling: 50, timeout: 5000 });
      const handTop = await page.evaluate(() => document.querySelector('#wall-root .room[data-iso="2026-09-29"]').getBoundingClientRect().top);
      letFontsIn();
      await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 8000 });
      await fontsIn(page);
      await sleep(300);
      const top = await page.evaluate(() => document.querySelector('#wall-root .room[data-iso="2026-09-29"]').getBoundingClientRect().top);
      // The room may move by the text growing above it (no anchoring), never
      // back up to the chrome's line the open had put it on.
      assert.ok(top >= handTop - 1 && top > 400, `the hand's place stands: the room at ${top}px, ${handTop}px after the wheel`);
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });
}

// ---- 2. tonight's rings ----------------------------------------------------------------
const lit = (page) => page.evaluate(() => [...document.querySelectorAll('#wall-root .card.now')].map((c) => {
  const iso = (c.closest('[data-iso]') || {}).dataset?.iso || '';
  return `${c.dataset.artist}@${iso}`;
}));
const nowShows = (page, desk) => page.evaluate((d) => {
  const now = document.getElementById(`${d}-now`);
  const tab = !!now && !now.hidden && now.offsetParent !== null;
  // The peek's NOW: a row tagged now, drawn where a person can see it.
  const plan = document.getElementById('plan');
  const tag = plan && !plan.hidden ? plan.querySelector('[data-tag="now"]') : null;
  const peekNow = !!tag && tag.getClientRects().length > 0;
  return { tab, peekNow };
}, door(desk));
async function tick(page, at) {
  await page.clock.setFixedTime(at);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(80);
  await motionDone(page).catch(() => {});
}
const TONIGHT = [
  ['7:59 PM', CDT('2026-09-29T19:59:00'), []],
  ['8:00 PM', CDT('2026-09-29T20:00:00'), ['Total Wife@2026-09-29']],
  ['8:44 PM', CDT('2026-09-29T20:44:00'), ['Total Wife@2026-09-29']],
  ['8:45 PM', CDT('2026-09-29T20:45:00'), ['Fcukers@2026-09-29']],
  ['11:59 PM', CDT('2026-09-29T23:59:00'), ['Fcukers@2026-09-29']],
  ['12:00 AM', CDT('2026-09-30T00:00:00'), []],
  ['4:59 AM', CDT('2026-09-30T04:59:00'), []],
  ['5:00 AM', CDT('2026-09-30T05:00:00'), []],
];
for (const [engine, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const skip = engine ? false : NO_BROWSER;
  test(`${name} 390: Tue Sep 29 through the 5 AM rollover, each set lights in its own window and NOW is there exactly while something is on`, { skip }, async () => {
    const { ctx, page, desk, errors } = await open(engine, { at: TONIGHT[0][1] });
    try {
      const seen = [];
      for (const [label, at, want] of TONIGHT) {
        await tick(page, at);
        const on = await lit(page);
        const { tab, peekNow } = await nowShows(page, desk);
        seen.push(`${label}: ${on.join(', ') || '-'} | NOW ${tab ? 'tab' : peekNow ? 'peek' : 'none'}`);
        assert.deepEqual(on, want, seen.join('\n'));
        assert.equal(tab || peekNow, want.length > 0, `NOW is there only while something is on:\n${seen.join('\n')}`);
        assert.ok(!(tab && peekNow), `one NOW at a time:\n${seen.join('\n')}`);
      }
      // A tap on NOW while Total Wife plays lands on her card.
      await tick(page, CDT('2026-09-29T20:20:00'));
      assert.equal((await nowShows(page, desk)).tab, true, 'at 8:20 PM the peek says NEXT, so the day row carries NOW');
      await page.evaluate(() => window.scrollTo(0, 0));
      await nowInView(page, door(desk));
      const b = await page.locator(`#${door(desk)}-now`).boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForFunction(() => {
        const c = document.querySelector('#wall-root .room[data-iso="2026-09-29"] .card.now');
        if (!c) return false;
        const r = c.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight - 100;
      }, null, { timeout: 6000 });
      assert.deepEqual(errors(), []);
    } finally { await ctx.close(); }
  });
}
