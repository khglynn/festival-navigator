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
import fs from 'node:fs';
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
// The season in progress around the REAL today — Fall on Sep 25, Winter from
// Dec 1 — under its real id, with the index row it would have (routed below),
// so the suite reads the same on any day of the year.
const FEST = seasonShape({ today: TODAY });
const ON_WALL = (fest, today) => fest.artists.filter((a) => a.date >= today && !a.unlisted).length;
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/festivals/index.json'), 'utf8'));
const indexWith = (fest) => [
  ...INDEX.filter((f) => f.id !== fest.id),
  { id: fest.id, kind: 'season', name: fest.name, year: fest.year, startsOn: fest.startsOn, endsOn: fest.endsOn, status: 'scheduled', dates: fest.dates, updated: fest.updated, location: fest.location, accent: fest.accent },
];
// Kevin's Spotify knows a handful of the season's artists; he picked one more
// at another fest in this crew.
const LOVED = FEST.artists.filter((_, i) => i % 53 === 7).slice(0, 6).map((a) => a.name);
const LOVED_AFFINITY = Object.fromEntries([...LOVED, 'Presale Darlings'].map((n, i) => [n, { songs: 2 + i, followed: i % 2 === 0 }]));

async function openSeason({ width, touch = false, spotify = true, fest = FEST, now = null }) {
  const phone = width < 720;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 800 }, hasTouch: touch, serviceWorkers: 'block' });
  const TOKEN = 'seasoncontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Season' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN, fest.id]);
  const doc = {
    v: 4, meta: { name: 'Season', inviteFestId: fest.id }, spotify: {},
    affinity: spotify ? { Kevin: LOVED_AFFINITY } : {},
    people: { Kevin: { colorIndex: 0 }, Kat: { colorIndex: 2 } },
    festivals: { [fest.id]: { selections: { 'Presale Darlings': { Kat: 2 } } }, 'portola-2026': { selections: { [FEST.artists[2].name]: { Kevin: 3 } } } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.route(`**/data/festivals/${fest.id}.json`, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(fest) }));
  await ctx.route('**/data/festivals/index.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(indexWith(fest)) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (now) await page.clock.setFixedTime(now);
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  const expected = now ? 1 : Math.min(ON_WALL(fest, TODAY), 20);
  await page.waitForFunction((n) => document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card').length >= n, expected, { timeout: 20000 });
  await sleep(700); // the open's landing and the scrollspy's frame
  return { ctx, page, errors };
}

// The wall as a person meets it: what is where, read off real layout.
const survey = (page) => page.evaluate(() => {
  const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 8;
  const month = document.querySelector('#wall-root .day-block[data-kind="month"]');
  const firstWeek = month.querySelector('.room');
  // The fullest week's grid: a row across is only a row where there are
  // cards enough to fill one.
  const grid = [...document.querySelectorAll('#wall-root .day-block[data-kind="month"] .wall-grid')].sort((a, b) => b.children.length - a.children.length)[0];
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
      assert.ok(s.labels[0].occ.date >= TODAY, 'nothing before today');
      assert.equal(s.labels.length, ON_WALL(FEST, TODAY), 'every show of the season from today on is on the wall');
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

test('390: when Austin’s day turns (5 AM), a phone that comes back to the page drops yesterday’s shows and moves THIS WEEK', { skip }, async () => {
  // Monday 2026-10-05, 4:58 AM in Austin: still Sunday night's festival day.
  const fest = seasonShape({ today: '2026-10-04' });
  const { ctx, page, errors } = await openSeason({ width: 390, touch: true, spotify: false, fest, now: new Date('2026-10-05T04:58:00-05:00') });
  const read = () => page.evaluate(() => ({
    sunday: [...document.querySelectorAll('#wall-root .card')].filter((c) => JSON.parse(c.dataset.occ).date === '2026-10-04').length,
    head: document.querySelector('#wall-root .day-block[data-kind="month"] .room-head')?.textContent,
  }));
  try {
    const before = await read();
    assert.ok(before.sunday > 0, 'Sunday night is still on at 4:58 AM');
    assert.equal(before.head, 'OCT 4This week');
    await page.clock.setFixedTime(new Date('2026-10-05T05:02:00-05:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await sleep(500);
    const after = await read();
    assert.equal(after.sunday, 0, 'yesterday is gone');
    assert.equal(after.head, 'OCT 5 – 11This week', 'and THIS WEEK is the new week');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// ---- the city's run of seasons (Kevin, 2026-09-25), on the real files, pinned ----------
// The live index changes under the feed (the first run after Nov 30 archives
// Fall) and the real clock walks past Winter, so these read a FIXED snapshot of
// the city's index rows, the season files as they are but held to that
// snapshot's status, and a page clock pinned to Fri 2026-09-25, 8 PM in Austin
// (the review, round 2).
const PINNED = new Date('2026-09-25T20:00:00-05:00');
const PINNED_TODAY = '2026-09-25';
const SNAPSHOT = [
  { id: 'austin-fall-2026', kind: 'season', name: 'Austin Fall', year: "'26", startsOn: '2026-09-01', endsOn: '2026-11-30', status: 'scheduled', dates: 'Sep – Nov 2026', updated: '2026-09-25', location: 'Austin, TX', timezone: 'America/Chicago', accent: '240, 146, 76' },
  { id: 'austin-winter-2027', kind: 'season', name: 'Austin Winter', year: "'27", startsOn: '2026-12-01', endsOn: '2027-02-28', status: 'scheduled', dates: 'Dec 2026 – Feb 2027', updated: '2026-09-25', location: 'Austin, TX', timezone: 'America/Chicago', accent: '125, 196, 255' },
  { id: 'austin-spring-2027', kind: 'season', name: 'Austin Spring', year: "'27", startsOn: '2027-03-01', endsOn: '2027-05-31', status: 'scheduled', dates: 'Mar – May 2027', updated: '2026-09-25', location: 'Austin, TX', timezone: 'America/Chicago', accent: '244, 114, 182' },
  { id: 'austin-summer-2027', kind: 'season', name: 'Austin Summer', year: "'27", startsOn: '2027-06-01', endsOn: '2027-08-31', status: 'scheduled', dates: 'Jun – Aug 2027', updated: '2026-09-25', location: 'Austin, TX', timezone: 'America/Chicago', accent: '250, 204, 90' },
];
const pinnedIndex = () => [...INDEX.filter((f) => f.kind !== 'season'), ...SNAPSHOT];
// A season file as the snapshot knows it: its shows as the feed wrote them,
// its status and updated day the snapshot's.
const pinnedFile = (id) => {
  const f = JSON.parse(fs.readFileSync(path.join(ROOT, `data/festivals/${id}.json`), 'utf8'));
  const row = SNAPSHOT.find((r) => r.id === id);
  return { ...f, status: row.status, updated: row.updated, startsOn: row.startsOn, endsOn: row.endsOn, dates: row.dates };
};
async function pinnedContext({ width, touch, doc, token, fest, reducedMotion = 'no-preference' }) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 720 ? 844 : 800 }, hasTouch: touch, serviceWorkers: 'block', reducedMotion });
  await ctx.addInitScript(([t, d, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Seasons' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_doc_v3_${t}`, JSON.stringify(d));
    if (!localStorage.getItem(`fn_crew_fest_v3_${t}`)) localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [token, doc, fest]);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.route('**/data/festivals/index.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(pinnedIndex()) }));
  for (const row of SNAPSHOT) await ctx.route(`**/data/festivals/${row.id}.json`, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(pinnedFile(row.id)) }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(PINNED);
  return { ctx, page };
}

test('390: the landing lists the next two Austin seasons with their updated lines, tucks the rest, and a future season opens on its first month', { skip }, async () => {
  const winter = pinnedFile('austin-winter-2027');
  const TOKEN = 'seasonlanding_0123456789';
  const doc = {
    v: 4, meta: { name: 'Seasons', inviteFestId: 'austin-winter-2027' }, spotify: {},
    affinity: { Kevin: Object.fromEntries(winter.artists.slice(0, 4).map((a) => [a.name, { songs: 3 }])) },
    people: { Kevin: { colorIndex: 0 } },
    festivals: Object.fromEntries(SNAPSHOT.map((f) => [f.id, { selections: {} }])),
  };
  const { ctx, page } = await pinnedContext({ width: 390, touch: true, doc, token: TOKEN, fest: 'austin-winter-2027' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto(`${server.origin}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#landing-fests .fest-row').length > 0, null, { timeout: 15000 });
    const list = await page.evaluate(() => [...document.getElementById('landing-fests').children].map((n) => (n.classList.contains('micro-label') ? { head: n.textContent }
      : n.classList.contains('fest-row') ? { name: n.querySelector('.fest-name').textContent, lines: [...n.querySelectorAll('.fest-dates')].map((d) => d.textContent) }
        : { fold: n.querySelector('button').textContent })));
    assert.deepEqual(list.map((x) => x.head || (x.name && x.name.replace(/\s*'\d\d$/, '')) || x.fold.replace(/\s*[▸▾]$/, '')),
      ['City seasons', 'Austin Fall', 'Austin Winter', 'Later seasons · 2'], 'Sep 25: Fall and Winter, the rest tucked');
    assert.deepEqual(list.filter((x) => x.name).map((x) => x.lines[0]), ['Sep – Nov 2026 · updated today', 'Dec 2026 – Feb 2027 · updated today']);
    // Winter: ahead of today, so all of it, from its first month.
    await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card').length > 0, null, { timeout: 15000 });
    await sleep(600);
    const w = await page.evaluate(() => ({
      first: document.querySelector('#wall-root .day-block[data-kind="month"]').dataset.day,
      cards: document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card').length,
      yours: document.querySelectorAll('#wall-root .day-block[data-day="yours"] .card').length,
      sub: document.getElementById('fest-sub').textContent,
      name: document.getElementById('fest-name').textContent,
      tabs: [...document.querySelectorAll('#dock-days .day-tab')].map((t) => t.dataset.day),
    }));
    assert.equal(w.cards, winter.artists.filter((a) => !a.unlisted).length, 'every Winter show is on the wall');
    assert.equal(w.first, 'December', 'it opens on its first month');
    assert.equal(w.name, 'AUSTIN WINTER');
    assert.equal(w.sub, 'Dec 2026 – Feb 2027 · updated today', 'the header is the description line');
    assert.ok(w.yours > 0, 'YOURS is this season’s');
    assert.deepEqual(w.tabs, ['yours', 'December', 'January', 'February']);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// Kevin, 2026-09-25: "little chevron style to the left and right of our months
// list … we can just slide over into the next season." Real pointer input on
// the chevrons (a finger on the dock, a mouse on the rail), then what a person
// sees when it settles: the season, its months, its first month on the wall,
// and chevrons that say where they go — hidden, in place, where there is none.
for (const [width, touch, where, reducedMotion] of [[390, true, 'dock', 'no-preference'], [1280, false, 'rail', 'no-preference'], [390, true, 'dock', 'reduce']]) {
  test(`${width}${reducedMotion === 'reduce' ? ' (Reduce Motion)' : ''}: › turns Fall into Winter and ‹ turns it back; the chevrons say where they go and hold their place`, { skip }, async () => {
    const TOKEN = 'seasonsteps_0123456789ab';
    const doc = { v: 4, meta: { name: 'Seasons', inviteFestId: 'austin-fall-2026' }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { 'austin-fall-2026': { selections: {} } } };
    const { ctx, page } = await pinnedContext({ width, touch, doc, token: TOKEN, fest: 'austin-fall-2026', reducedMotion });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const read = () => page.evaluate((w) => {
      const b = (dir) => { const e = document.getElementById(`${w}-season-${dir}`); const r = e.getBoundingClientRect(); return { shown: !e.hidden && getComputedStyle(e).visibility === 'visible', label: e.getAttribute('aria-label'), x: Math.round(r.left), w: Math.round(r.width) }; };
      const cards = [...document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card')].map((c) => JSON.parse(c.dataset.occ).date);
      return {
        name: document.getElementById('fest-name').textContent,
        tabs: [...document.querySelectorAll(`#${w}-days .day-tab`)].map((t) => t.dataset.day),
        first: (document.querySelector('#wall-root .day-block[data-kind="month"]') || {}).dataset?.day || null,
        lo: cards.reduce((a, d) => (a && a < d ? a : d), ''), hi: cards.reduce((a, d) => (a > d ? a : d), ''),
        prev: b('prev'), next: b('next'),
        moving: document.getAnimations().filter((a) => a.playState === 'running').length,
      };
    }, where);
    const press = async (dir) => {
      const r = await page.locator(`#${where}-season-${dir}`).boundingBox();
      if (touch) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
      else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    };
    const landed = async (name) => {
      for (let i = 0; i < 60; i++) {
        const s = await read();
        if (s.name === name && !s.moving) return s;
        await sleep(50);
      }
      return read();
    };
    try {
      await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelectorAll('#wall-root .day-block[data-kind="month"] .card').length > 0, null, { timeout: 15000 });
      await sleep(600);
      const fall = await read();
      assert.equal(fall.name, 'AUSTIN FALL');
      assert.equal(fall.prev.shown, false, 'nothing before Fall in the snapshot: ‹ hidden');
      assert.ok(fall.prev.w > 0, '— but it keeps its place');
      assert.equal(fall.next.label, "Next season: Austin Winter '27");
      await press('next');
      const winter = await landed('AUSTIN WINTER');
      assert.equal(winter.name, 'AUSTIN WINTER');
      assert.deepEqual(winter.tabs.filter((t) => t !== 'yours'), ['December', 'January', 'February'], 'Winter’s months');
      assert.equal(winter.first, 'December', 'its first month on the wall');
      assert.ok(winter.lo >= '2026-12-01' && winter.hi <= '2027-02-28', `only Winter’s shows (${winter.lo} … ${winter.hi})`);
      assert.equal(winter.prev.label, "Previous season: Austin Fall '26");
      assert.equal(winter.next.label, "Next season: Austin Spring '27");
      assert.ok(winter.prev.shown && winter.next.shown);
      assert.equal(winter.next.x, fall.next.x, 'the › did not move under the thumb');
      assert.equal(winter.prev.x, fall.prev.x);
      await press('prev');
      const back = await landed('AUSTIN FALL');
      assert.deepEqual(back.tabs.filter((t) => t !== 'yours'), ['September', 'October', 'November']);
      assert.ok(back.lo >= PINNED_TODAY && back.hi <= '2026-11-30', 'Fall from today');
      assert.equal(back.prev.shown, false);
      // Two quick taps land cleanly two seasons over: never a half-drawn wall.
      await press('next');
      await sleep(40);
      await press('next');
      const spring = await landed('AUSTIN SPRING');
      assert.equal(spring.name, 'AUSTIN SPRING');
      assert.ok(spring.lo >= '2027-03-01' && spring.hi <= '2027-05-31', 'the wall is Spring’s, whole');
      assert.deepEqual(spring.tabs.filter((t) => t !== 'yours'), [...new Set(pinnedFile('austin-spring-2027').artists.map((a) => a.day))]);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('a festival never shows the season chevrons', { skip }, async () => {
  const { ctx, page } = await openSeason({ width: 390, touch: true }).catch(() => ({}));
  if (ctx) await ctx.close();
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const T = 'festnochevrons_012345678';
  await c.addInitScript(([t]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'F' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    localStorage.setItem('fn_coach_v1', '1');
  }, [T]);
  const doc = { v: 4, meta: { name: 'F' }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { 'portola-2026': { selections: {} } } };
  await c.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await c.route('**/api/crew**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  const p = await c.newPage();
  try {
    await p.goto(`${server.origin}/#g=${T}`, { waitUntil: 'load' });
    await p.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 0, null, { timeout: 15000 });
    const shown = await p.evaluate(() => [...document.querySelectorAll('.season-step')].map((e) => !e.hidden && e.getClientRects().length > 0));
    assert.deepEqual(shown, [false, false, false, false]);
  } finally { await c.close(); }
});
