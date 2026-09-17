// The app shell's contract in a real browser (2026-09-16), with real input.
//
// index.html's new-build glue decides "in progress" partly from LAYOUT — a
// field counts only while it is on screen (getClientRects), so the bad-link
// input a hidden screen still holds a value in never pins an old build. jsdom
// has no layout, so tests/new-build-reload.test.mjs has to fake that part;
// this file is where it is real. The worker itself is blocked: the takeover is
// the controllerchange event the glue listens for, dispatched on the real
// ServiceWorkerContainer.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REQUIRED = !!process.env.BROWSER_TEST_REQUIRED; // CI: a missing browser is a failure, not a skip
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const { chromium } = await import('playwright');
  try { return await chromium.launch({ headless: true }); } catch (e) {
    try { return await chromium.launch({ channel: 'chrome', headless: true }); } catch {
      if (REQUIRED) throw e;
      return null;
    }
  }
}

const server = await serveStatic(ROOT);
const browser = await launch();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : 'no browser available (npx playwright install chromium, or install Chrome)';

async function phone() {
  // hasTouch, because a phone has one: it is what puts the page on a COARSE
  // pointer, and the 44px floor is a coarse-pointer rule. Without it the
  // viewport is phone-sized and every control still measures like a desktop's.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  // A blocked worker's register() resolves to nothing; the glue's update
  // checks want a registration to call.
  await ctx.addInitScript(() => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  return { ctx, page };
}

test('a new build waits for words on screen, ignores a hidden screen\'s, and reloads the first quiet moment', { skip }, async () => {
  const { ctx, page } = await phone();
  try {
    await page.goto(`${server.origin}/#g=cut`, { waitUntil: 'load' }); // a clipped link: the bad-link screen, with an input
    await page.waitForSelector('#screen-badlink', { state: 'visible' });
    const takeover = () => page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
    const recheck = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const samePage = () => page.evaluate(() => window.__samePage === true);
    await page.evaluate(() => { window.__samePage = true; });

    await takeover(); // the first worker to claim the page serves the build it runs
    assert.ok(await samePage(), 'no reload on the first claim');

    await page.click('#badlink-input');
    await page.keyboard.type('https://fest.kevinhg.com/#g=half');
    await page.mouse.click(8, 8); // focus leaves; the words stay
    await takeover();
    await sleep(150);
    assert.ok(await samePage(), 'typed words on screen hold the reload');
    assert.ok(await page.evaluate(() => !!document.getElementById('new-build-strip')), 'and the notice is up');
    await recheck();
    assert.ok(await samePage(), 'a re-check still sees them');

    // Words parked on a screen that is not showing are not work in progress.
    await page.evaluate(() => { document.getElementById('join-name-input').value = 'left over'; });
    await page.fill('#badlink-input', '');
    await page.mouse.click(8, 8);
    const reloaded = page.waitForEvent('load', { timeout: 5000 });
    await recheck();
    await reloaded;
    assert.equal(await page.evaluate(() => window.__samePage), undefined, 'the first quiet re-check reloaded the page');
  } finally {
    await ctx.close();
  }
});

test('a cold open waiting on the crew shows the loader after a beat, and the wall removes it', { skip }, async () => {
  const { ctx, page } = await phone();
  const TOKEN = 'shellcontract_0123456789'; // a made-up crew
  const FID = 'seismic-9';
  try {
    await ctx.addInitScript(([t, f]) => {
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    }, [TOKEN, FID]);
    const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    let answer;
    const crewAnswered = new Promise((r) => { answer = r; });
    await ctx.route('**/api/crew**', async (route) => { await crewAnswered; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }); });
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));

    await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
    const loaderOpacity = () => page.evaluate(() => {
      const el = document.getElementById('screen-boot');
      return el ? Number(getComputedStyle(el).opacity) : null;
    });
    assert.equal(await loaderOpacity(), 0, 'present, and not yet seen — a quick boot never flashes it');
    await sleep(900);
    assert.equal(await loaderOpacity(), 1, 'a slow boot shows it');
    assert.ok(await page.isVisible('#screen-boot .eq-loader'));

    answer();
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
    assert.equal(await loaderOpacity(), null, 'gone with the first screen');
  } finally {
    await ctx.close();
  }
});

// The show menu's rows (MODEL-V4 §3.1). Node sees an element and a listener;
// what a thumb and a keyboard get is only real here. A click-only <li> measured
// under the 44px floor and could not be reached at all without a mouse.
test('the show menu\'s rows are worked by a keyboard, and clear the 44px floor on a phone', { skip }, async () => {
  const { ctx, page } = await phone();
  const TOKEN = 'showmenucontract_0123456789'; // a made-up crew
  const FID = 'portola-2026';                  // three rooms, so there is a menu
  try {
    await ctx.addInitScript(([t, f]) => {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_coach_v1', '1'); // the coach mark is not what this is about
    }, [TOKEN, FID]);
    const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));

    await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#dock-fest-wrap .sort-pop', { state: 'attached', timeout: 10000 });

    // Open it the way a keyboard opens it: the fest name is a button.
    await page.focus('#dock-fest-link');
    await page.keyboard.press('Enter');
    const row = page.locator('#dock-fest-wrap .sort-pop [data-room="Folsom"]');
    await row.waitFor({ state: 'visible' });
    const box = await row.boundingBox();
    assert.ok(box.height >= 44, `a menu row is ${box.height}px tall on a phone; the floor is 44`);

    await row.focus();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.room), 'Folsom', 'and the keyboard can stand on it');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => localStorage.getItem('fn_fold_v1_portola-2026')), '["Folsom"]',
      'Space works the row — no second keyboard controller needed');
    await page.waitForSelector('#wall-root .room[data-room="Folsom"] .sec-head.folded');

    // And Escape puts the menu away without touching anything under it.
    await page.focus('#dock-fest-link');
    await page.keyboard.press('Enter');
    assert.equal(await page.getAttribute('#dock-fest-link', 'aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.getAttribute('#dock-fest-link', 'aria-expanded'), 'false');
    assert.ok(await page.isVisible('#screen-app'), 'the wall is still the wall');
  } finally {
    await ctx.close();
  }
});

// The sort chip's popover (DT-7) — the same touch-floor miss the show menu's
// rows just fixed (a click-only <li role="option"> at 32px), fixed the same
// way: native <button role="option">. A search wall hides the control
// entirely (CORE-5: a timetable has one true order), so this needs an
// UNSCHEDULED fest — seismic-9, already used above for the cold-open case.
test('the sort popover\'s rows clear the 44px floor on a phone, and the chip\'s own keyboard still drives them', { skip }, async () => {
  const { ctx, page } = await phone();
  const TOKEN = 'sortmenucontract_0123456789'; // a made-up crew
  const FID = 'seismic-9';                     // no `days` — the sort control stays on screen
  try {
    await ctx.addInitScript(([t, f]) => {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_coach_v1', '1'); // the coach mark is not what this is about
    }, [TOKEN, FID]);
    const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));

    await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#sort-control .sort-pop', { state: 'attached', timeout: 10000 });
    assert.ok(await page.isVisible('#sort-control .sort-chip'), 'an unscheduled fest keeps the sort control on screen');

    // Open it the way a keyboard opens it: the chip is a button — Enter fires
    // its native click, same as the show menu's link above.
    await page.focus('#sort-control .sort-chip');
    await page.keyboard.press('Enter');
    const row = page.locator('#sort-control .sort-pop [role="option"]').nth(1); // "A → Z"
    await row.waitFor({ state: 'visible' });
    const box = await row.boundingBox();
    assert.ok(box.height >= 44, `a sort row is ${box.height}px tall on a phone; the floor is 44`);

    // Arrow-key roving stays the chip's own — a row is a tap target, not a
    // second place the keyboard has to visit (tabIndex -1, so Tab and the
    // browser's own focus-on-click both skip it). The popover opened already
    // highlighting the current choice (billing, index 0); one ArrowDown
    // moves the highlight to "A → Z" without moving DOM focus off the chip.
    await page.keyboard.press('ArrowDown');
    assert.ok(await page.evaluate(() => document.activeElement.classList.contains('sort-chip')),
      'the keyboard never lands on a row');
    assert.equal(await page.getAttribute('#sort-control .sort-pop', 'aria-activedescendant'), 'sort-opt-az');

    // Enter selects the highlighted row, closes the popover, and the chip's
    // own label carries the pick — no second controller needed.
    await page.keyboard.press('Enter');
    assert.equal(await page.getAttribute('#sort-control .sort-chip', 'aria-expanded'), 'false');
    assert.match(await page.locator('#sort-control .sort-chip').innerText(), /A → Z/);

    // And Escape puts the popover away without changing the pick.
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.getAttribute('#sort-control .sort-chip', 'aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.getAttribute('#sort-control .sort-chip', 'aria-expanded'), 'false');
    assert.match(await page.locator('#sort-control .sort-chip').innerText(), /A → Z/, 'unchanged');
  } finally {
    await ctx.close();
  }
});

// ACL has seven tabs and a phone dock has ~152px between the avatar and the
// fest name. The row already scrolled, with no affordance and no idea where
// you were standing: on open it showed FRI 2 / SAT 3 with a cut-off "SU", and
// in LATE NIGHTS it still showed FRI 2 / SAT 3 (real-browser walk, 2026-09-17).
// Only a real browser has the geometry for this.
test('seven tabs on a phone: the day you are in is in the row, and the clipped edges fade', { skip }, async () => {
  const { ctx, page } = await phone();
  const TOKEN = 'dayrowcontract_0123456789'; // a made-up crew
  const FID = 'acl-2026';                    // six dated tabs plus LATE NIGHTS
  try {
    await ctx.addInitScript(([t, f]) => {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_coach_v1', '1');
    }, [TOKEN, FID]);
    const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));

    await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
    await page.waitForSelector('#dock-days .day-tab.active', { timeout: 10000 });
    await sleep(600); // the row's own smooth scroll

    const read = () => page.evaluate(() => {
      const row = document.getElementById('dock-days');
      const tab = row.querySelector('.day-tab.active');
      const r = row.getBoundingClientRect();
      const t = tab.getBoundingClientRect();
      return {
        day: tab.dataset.day, tabs: row.querySelectorAll('.day-tab').length,
        inside: t.left >= r.left - 1 && t.right <= r.right + 1,
        overflowing: row.classList.contains('overflowing'),
        more: [row.classList.contains('more-left'), row.classList.contains('more-right')],
        masked: getComputedStyle(row).maskImage !== 'none' || getComputedStyle(row).webkitMaskImage !== 'none',
      };
    });

    const open = await read();
    assert.equal(open.tabs, 7, 'six dated days and Late nights');
    assert.equal(open.day, 'Friday|W1', 'the wall opens on Oct 2');
    assert.ok(open.inside, `the opening day sits inside its row — ${JSON.stringify(open)}`);
    assert.ok(open.overflowing && open.masked, `the clipped edges fade — ${JSON.stringify(open)}`);
    assert.deepEqual(open.more, [false, true], 'at the start of the row, only the right edge has more past it');

    // Jump to the tab at the far end; the row has to bring it back. 7,000px of
    // smooth scrolling takes a moment, so wait for the wall to say it arrived.
    await page.click('#dock-days .day-tab[data-day="Late nights"]');
    await page.waitForFunction(() => document.querySelector('#dock-days .day-tab.active')?.dataset.day === 'Late nights', null, { timeout: 8000 });
    await sleep(500); // the row's own glide
    const late = await read();
    assert.equal(late.day, 'Late nights', 'the wall says you are in LATE NIGHTS');
    assert.ok(late.inside, `and so does the dock — ${JSON.stringify(late)}`);
    assert.deepEqual(late.more, [true, false], 'at the end of the row the tab you are on is not the dim one');
  } finally {
    await ctx.close();
  }
});
