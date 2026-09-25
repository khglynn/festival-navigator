// The city season, in a real browser with real input (2026-09-25,
// claude-plans/2026-09-25-season-v0/). jsdom proves the model and the DOM
// (tests/season-view.test.mjs); this proves what a thumb and a mouse meet: the
// month is ONE responsive set of cards (two across a phone, a column per
// ~176px on a desktop) with a thin head per week, every card says its date,
// the open lands on today below YOURS, the tabs light the month you are in,
// YOURS exists only for someone with Spotify, and the zoom — by hover and by a
// held finger — says where, the bill and the ticket doors.
//
// The season is built around the REAL today in Austin (tests/helpers/
// season-shape.mjs, the live feed's shape: ~890 shows, an October of ~400).
// A pinned page clock would starve requestAnimationFrame, and the scrollspy
// runs on it (found building this, 2026-09-25) — so the data moves with the
// clock instead, and every assertion is a rule, never a date.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';
import { seasonShape } from '../helpers/season-shape.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A long smooth scroll outlasts any fixed wait: poll from Node, in real time,
// until the page has stood still for a beat (never a timer inside the page —
// browser-harness traps, 2026-09-24).
async function settled(page) {
  let y = -1;
  for (let still = 0, i = 0; still < 3 && i < 60; i++) {
    const now = await page.evaluate(() => window.scrollY);
    still = now === y ? still + 1 : 0;
    y = now;
    await sleep(80);
  }
}
const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const FEST = seasonShape({ today: TODAY });
// Kevin's Spotify knows a handful of the season's artists; he picked one more
// at another fest in this crew.
const LOVED = FEST.artists.filter((_, i) => i % 53 === 7).slice(0, 6).map((a) => a.name);
const LOVED_AFFINITY = Object.fromEntries([...LOVED, 'Presale Darlings'].map((n, i) => [n, { songs: 2 + i, followed: i % 2 === 0 }]));

async function openSeason({ width, touch = false, spotify = true }) {
  const phone = width < 720;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 800 }, hasTouch: touch, serviceWorkers: 'block' });
  const TOKEN = 'seasoncontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Season' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'austin');
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN]);
  const doc = {
    v: 4, meta: { name: 'Season', inviteFestId: 'austin' }, spotify: {},
    affinity: spotify ? { Kevin: LOVED_AFFINITY } : {},
    people: { Kevin: { colorIndex: 0 }, Kat: { colorIndex: 2 } },
    festivals: { austin: { selections: { 'Presale Darlings': { Kat: 2 } } }, 'portola-2026': { selections: { [FEST.artists[2].name]: { Kevin: 3 } } } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.route('**/data/festivals/austin.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(FEST) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card').length > 100, null, { timeout: 20000 });
  await sleep(700); // the open's landing and the scrollspy's frame
  return { ctx, page, errors };
}

// The wall as a person meets it: what is where, read off real layout.
const survey = (page) => page.evaluate(() => {
  const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 8;
  const month = document.querySelector('#wall-root .day-block[data-kind="month"]');
  const firstWeek = month.querySelector('.room');
  const grid = month.querySelector('.wall-grid');
  const cards = [...grid.children];
  const top = cards[0].getBoundingClientRect().top;
  const row = cards.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 1);
  const labels = [...document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card')].map((c) => ({ occ: JSON.parse(c.dataset.occ), time: c.querySelector('.time')?.textContent || '' }));
  const active = (id) => (document.querySelector(`#${id} .day-tab.active`) || {}).dataset?.day || null;
  return {
    offset,
    monthTop: month.getBoundingClientRect().top,
    month: month.dataset.day,
    firstHead: firstWeek.querySelector('.room-head .name').textContent,
    firstSub: firstWeek.querySelector('.room-head .sub').textContent,
    perRow: row.length,
    widths: [...new Set(row.map((c) => Math.round(c.getBoundingClientRect().width)))],
    labels,
    tabs: [...document.querySelectorAll('#dock-days .day-tab')].map((t) => t.dataset.day),
    activeDock: active('dock-days'),
    activeRail: active('rail-days'),
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 0.5,
    venueStacks: document.querySelectorAll('#wall-root .venue-grid, #wall-root .venue-group').length,
    sortShown: getComputedStyle(document.getElementById('sort-control')).display !== 'none',
    now: !document.getElementById('dock-now').hidden || !document.getElementById('rail-now').hidden,
  };
});
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]} · ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

for (const [width, touch, perRow] of [[390, true, 2], [1280, false, 5]]) {
  test(`${width}: the open lands on today under YOURS; a month is one set of cards, ${perRow} across, each saying its date`, { skip }, async () => {
    const { ctx, page, errors } = await openSeason({ width, touch });
    try {
      const s = await survey(page);
      assert.equal(s.tabs[0], 'yours', 'YOURS leads the tabs');
      assert.ok(s.monthTop >= s.offset - 2 && s.monthTop <= s.offset + 32, `the current month landed at ${s.monthTop}px; the chrome ends at ${s.offset}px`);
      assert.equal(s.activeDock, s.month, 'the dock lights the month you landed in');
      assert.equal(s.activeRail, s.month, 'and so does the rail');
      assert.match(s.firstHead, /^[A-Z]{3} \d{1,2}( – \d{1,2})?$/, `a week head is the month and its dates: "${s.firstHead}"`);
      assert.equal(s.firstSub, 'This week');
      assert.equal(s.perRow, perRow, `${perRow} cards across at ${width}`);
      assert.equal(s.widths.length, 1, `one card width in a row (${s.widths})`);
      assert.equal(s.venueStacks, 0, 'nothing on the wall is split by location');
      assert.ok(!s.hscroll, 'no sideways scroll');
      assert.ok(!s.sortShown, 'a season has one order: no sort control');
      assert.ok(!s.now, 'no NOW in a season');
      // Every card on the months says the date of the show it is; they read
      // in date order down the page — a cancelled show sits last in its week,
      // as it does in any list, so it steps out of the order it is struck from.
      let last = '';
      for (const { occ, time } of s.labels) {
        assert.ok(time.includes(dateLabel(occ.date)), `"${time}" says ${dateLabel(occ.date)}`);
        if (time.startsWith('Cancelled')) continue;
        assert.ok(occ.date >= last, `date order: ${occ.date} after ${last}`);
        last = occ.date;
      }
      assert.ok(s.labels[0].occ.date >= TODAY.slice(0, 8) + '01' && s.labels.length > 400, `the season's months are on the wall (${s.labels.length} cards)`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('390: a month tab lands its first week under the chrome; YOURS’s tab goes back up to it', { skip }, async () => {
  const { ctx, page } = await openSeason({ width: 390, touch: true });
  try {
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#dock-days .day-tab')].map((t) => t.dataset.day));
    for (const day of [tabs[2], tabs[1], 'yours']) {
      const tab = page.locator(`#dock-days .day-tab[data-day="${day}"]`);
      await tab.scrollIntoViewIfNeeded();
      const b = await tab.boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await settled(page);
      assert.equal(await page.evaluate(() => document.querySelector('#dock-days .day-tab.active')?.dataset.day), day, `${day} is lit`);
      const top = await page.evaluate((d) => document.querySelector(`#wall-root .day-block[data-day="${d}"]`).getBoundingClientRect().top, day);
      assert.ok(top >= -2 && top <= 40, `${day} landed at ${top}px`);
    }
  } finally { await ctx.close(); }
});

test('no Spotify: no YOURS tab, no YOURS block, and today is the top of the page', { skip }, async () => {
  const { ctx, page } = await openSeason({ width: 390, touch: true, spotify: false });
  try {
    const s = await page.evaluate(() => ({
      yours: !!document.querySelector('#wall-root .day-block[data-day="yours"]'),
      tab: !!document.querySelector('.day-tab[data-day="yours"]'),
      scrollY: window.scrollY,
      first: document.querySelector('#wall-root > .day-block').dataset.kind,
    }));
    assert.deepEqual(s, { yours: false, tab: false, scrollY: 0, first: 'month' });
  } finally { await ctx.close(); }
});

test('1280: hover grows a card into its zoom — the bill, the date with its start and doors, the location, the ticket doors', { skip }, async () => {
  const { ctx, page } = await openSeason({ width: 1280 });
  try {
    // A show with everything: the made-up long name (bill, doors, time).
    const name = await page.evaluate(() => [...document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card')].find((c) => c.dataset.artist.startsWith('Don Was'))?.dataset.artist);
    const card = page.locator(`#wall-root .day-block[data-kind="month"] .card[data-artist="${name}"]`);
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -150));
    await sleep(300);
    const b = await card.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 3000 });
    await sleep(500);
    const z = await page.evaluate(() => {
      const card = document.querySelector('#zoom-layer .zoom-slot.shown');
      const r = card.getBoundingClientRect();
      const t = (s) => card.querySelector(s)?.textContent || null;
      return { bill: t('.f-bill'), when: t('.f-sub'), where: t('.f-where'), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
    });
    assert.equal(z.bill, 'with Mikaela Davis');
    assert.match(z.when, /· 8 PM · Doors 6:30 PM$/);
    assert.equal(z.where, 'ACL Live');
    assert.ok(z.inView, 'the zoom is on the screen');
  } finally { await ctx.close(); }
});

test('390: a held finger zooms a YOURS card with its on-sale timeline; a tap on the zoom picks it, and its other card follows', { skip }, async () => {
  const { ctx, page } = await openSeason({ width: 390, touch: true });
  try {
    const at = await page.evaluate(() => {
      const el = document.querySelector('#wall-root .day-block[data-day="yours"] .card[data-artist="Presale Darlings"]');
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await sleep(300);
    const cdp = await ctx.newCDPSession(page); // a real held finger: Playwright's tap cannot hold
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    for (let i = 0; i < 40 && !(await page.$('#zoom-layer .zoom-slot.shown')); i++) await sleep(50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach().catch(() => {});
    await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
    await sleep(600);
    const sale = await page.evaluate(() => [...document.querySelectorAll('#zoom-layer .zoom-slot.shown .f-sale > span')].map((s) => s.textContent));
    assert.equal(sale.length, 2, `presale then on-sale: ${JSON.stringify(sale)}`);
    assert.match(sale[0], /^Presale /);
    assert.match(sale[1], /^On sale /);
    const n = await page.evaluate(() => { const r = document.querySelector('#zoom-layer .zoom-slot.shown .f-name').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(n.x, n.y);
    await sleep(400);
    const labels = await page.evaluate(() => [...document.querySelectorAll('#wall-root .card[data-artist="Presale Darlings"]')].map((c) => c.getAttribute('aria-label')));
    assert.equal(labels.length, 2, 'the show is in YOURS and in its month');
    assert.ok(labels.every((l) => /— picked/.test(l)), `both cards carry the pick: ${JSON.stringify(labels)}`);
  } finally { await ctx.close(); }
});

test('390: the fest name opens the locations — a tap hides one and the menu stays open; All locations brings everything back', { skip }, async () => {
  const { ctx, page, errors } = await openSeason({ width: 390, touch: true });
  const tapAt = async (sel) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  const POP = '#dock-fest-wrap .sort-pop.locations';
  const read = () => page.evaluate((s) => {
    const pop = document.querySelector(s);
    const r = pop.getBoundingClientRect();
    const venues = [...document.querySelectorAll('#wall-root .card')].map((c) => JSON.parse(c.dataset.occ).venue);
    return {
      open: pop.style.display !== 'none', head: pop.querySelector('.pop-head').textContent,
      first: pop.querySelectorAll('[data-room]')[1].dataset.room, cards: venues.length, venues,
      onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
    };
  }, POP);
  try {
    await tapAt('#dock-fest-link');
    await sleep(400);
    const a = await read();
    const total = Number(a.head.match(/of (\d+) locations/)[1]);
    assert.ok(a.open && a.onScreen, 'the menu opens, on the screen');
    assert.equal(a.head, `Show · ${total} of ${total} locations`);
    const busiest = a.first.slice('location:'.length);
    assert.ok(a.venues.includes(busiest));
    await tapAt(`${POP} [data-room="${a.first.replace(/"/g, '\\"')}"]`);
    await sleep(700);
    const b = await read();
    assert.ok(b.open, 'the menu stays open for the next tick');
    assert.equal(b.head, `Show · ${total - 1} of ${total} locations`);
    assert.ok(!b.venues.includes(busiest), `no ${busiest} card on the wall`);
    assert.ok(b.cards < a.cards);
    await tapAt(`${POP} [data-room="location:*"]`);
    await sleep(700);
    const c = await read();
    assert.equal(c.head, `Show · ${total} of ${total} locations`, 'All locations brings every one back');
    assert.equal(c.cards, a.cards);
    await page.touchscreen.tap(20, 200);
    await sleep(400);
    assert.equal((await read()).open, false, 'a tap outside closes it');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
