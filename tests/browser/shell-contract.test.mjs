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
    // bootFade: what the page asks of the loader's fade-in, the moment it asks.
    await ctx.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        if (this.id === 'screen-boot') window.__bootFade = { delay: options && options.delay, at: performance.now() };
        return animate.call(this, keyframes, options);
      };
    });
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
    // "After a beat" is the fade's own delay, recorded where the page asks for
    // it (bootFade, below), not inferred from how fast this machine got here:
    // on a loaded runner the page can finish loading after the beat — even
    // after the whole fade — and a wall-clock check read that as a flash
    // (seen twice in full parallel runs, 2026-09-24).
    const early = await page.evaluate(() => {
      const el = document.getElementById('screen-boot');
      const f = window.__bootFade;
      return el ? { opacity: Number(getComputedStyle(el).opacity), delay: f ? f.delay : null, elapsed: f ? performance.now() - f.at : null } : null;
    });
    assert.ok(early, 'the loader is there while the crew is on its way');
    assert.ok(early.delay >= 300, `it arrives after a beat, so a quick boot never flashes it: ${JSON.stringify(early)}`);
    if (early.elapsed < early.delay - 50) assert.equal(early.opacity, 0, `and it is not yet seen while the beat lasts: ${JSON.stringify(early)}`);
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
      localStorage.setItem('fn_welcome_v1', '1'); // the welcome card is not what this is about
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
    const roomsBefore = await page.evaluate(() => document.querySelectorAll('#wall-root .room[data-room="Folsom"]').length);
    assert.ok(roomsBefore > 0, 'Folsom is on the wall before the tap');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => localStorage.getItem('fn_fold_v1_portola-2026')), '["Folsom"]',
      'Space works the row — no second keyboard controller needed');
    // A hidden room renders nothing (2026-09-17): the room leaves whole, and
    // the days stay because the afters still play every one of them.
    await page.waitForSelector('#wall-root .room[data-room="Folsom"]', { state: 'detached' });
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#dock-days .day-tab')].map((t) => t.dataset.day)),
      ['Thursday', 'Friday', 'Saturday', 'Sunday']);

    // The menu stays up for the next row (v93), with the keyboard where it was.
    assert.equal(await page.getAttribute('#dock-fest-link', 'aria-expanded'), 'true', 'still open after the row');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.room), 'Folsom', 'focus stays on the row');
    // And Escape puts the menu away without touching anything under it, and
    // hands the keyboard back to the fest name that opened it.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('dock-fest-link').getAttribute('aria-expanded') === 'false', null, { timeout: 3000 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dock-fest-link', 'focus back on the fest name');
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
      localStorage.setItem('fn_welcome_v1', '1'); // the welcome card is not what this is about
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
      localStorage.setItem('fn_welcome_v1', '1');
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

// Diagnostics answers "the stage names stutter" on its own (2026-09-23): the
// paste says whether motion is off and which way the strip on the wall
// follows — and a phone that asks for reduced motion (which boots the app
// into Low power too) still has its strip on the grid's timeline, running.
test('Diagnostics names the motion settings and the strip route; Reduce Motion still rides the timeline', { skip }, async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { ctx, page } = await phone();
    const TOKEN = 'diagcontract_0123456789'; // a made-up crew
    const FID = 'portola-2026';              // two grid days, so there are strips
    try {
      await page.emulateMedia({ reducedMotion });
      await ctx.addInitScript(([t, f]) => {
        localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
        localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
        localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
        localStorage.setItem('fn_welcome_v1', '1');
      }, [TOKEN, FID]);
      const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
      await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
      await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
      await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
      await page.waitForSelector('#wall-root .stage-strip[data-follow]', { timeout: 10000 });
      const d = await page.evaluate(() => import('/js/errlog.js').then((m) => m.diagnostics()));
      const reduce = reducedMotion === 'reduce';
      assert.equal(d.reducedMotion, reduce, 'the OS setting, as the page sees it');
      assert.equal(d.lowPower, reduce, 'Reduce Motion boots the app into Low power');
      assert.equal(d.stripRoute, 'timeline', `the strip rides the timeline (reduce: ${reduce})`);
      assert.equal(d.stripAnimation, 'strip-follow', `and the engine runs it — no kill rule froze it (reduce: ${reduce})`);
    } finally {
      await ctx.close();
    }
  }
});

// The notes button beside search (v90, Kevin at Portola, 2026-09-25: "the
// notes thing to the right of it — the little tag with the outline — should
// be the same height, so it's just a little notes button"). One height with
// the field on a phone (the 44px floor both wear, as REAL height) and on a
// desktop (the field's own height on their shared line); the bubble keeps its
// outline and its sharp lower-left corner.
test('the notes button is the search field\'s height beside it, on a phone and on a desktop', { skip }, async () => {
  const TOKEN = 'notesheight_0123456789ab'; // a made-up crew
  const FID = 'portola-2026';
  // Six people, like the crew at Portola: the chips take the first line, and
  // the field and the notes button share the next.
  const people = Object.fromEntries(['Kevin', 'Nhu', 'Kat', 'Ross', 'Drew', 'Ava'].map((n, i) => [n, { colorIndex: i }]));
  for (const [label, opts] of [['phone', { viewport: { width: 390, height: 844 }, hasTouch: true }], ['desktop', { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' });
    try {
      await ctx.addInitScript(([t, f]) => {
        navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
        localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
        localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
        localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
        localStorage.setItem('fn_welcome_v1', '1');
      }, [TOKEN, FID]);
      const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people, festivals: { [FID]: { selections: {} } } };
      await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
      await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
      await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      const page = await ctx.newPage();
      page.on('pageerror', (e) => { throw e; });
      await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
      await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
      await page.waitForFunction(() => document.querySelectorAll('#person-chips .person-chip').length >= 6, null, { timeout: 10000 });
      const [field, notes, shape] = await page.evaluate(() => {
        const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, height: r.height, bottom: r.bottom }; };
        const n = document.getElementById('notes-chip');
        const cs = getComputedStyle(n);
        return [box(document.querySelector('.toolbar .search-pill')), box(n), { radius: cs.borderRadius, border: cs.borderTopWidth, style: cs.borderTopStyle }];
      });
      assert.ok(Math.abs(notes.height - field.height) < 0.5, `${label}: the notes button is ${notes.height}px, the field ${field.height}px`);
      assert.ok(Math.abs(notes.top - field.top) < 0.5, `${label}: and they sit on one line (tops ${notes.top} / ${field.top})`);
      if (label === 'phone') assert.ok(notes.height >= 44, `the phone's floor, as real height (${notes.height})`);
      assert.equal(shape.radius, '8px 8px 8px 2px', `${label}: the same bubble shape`);
      // The outline is 1.5px in the stylesheet; Chrome draws it at whole
      // device pixels, so only its presence is asserted.
      assert.ok(parseFloat(shape.border) >= 1 && shape.style === 'solid', `${label}: the same outline`);
    } finally {
      await ctx.close();
    }
  }
});

// A tick in the Show menu keeps your place (v93). A fold used to re-land on
// the top of your day whenever the page was scrolled at all: scrolled into
// Saturday evening, a tick snapped the page to "SAT PORTOLA · 1 PM" (the
// independent walk: 3400 -> 552 -> 2812 -> 552). Now the card at the top of
// what you see stays where it is on screen, tick after tick, while the days
// above it (Thursday's and Friday's afters) go and come back — the menu stays
// up for all four.
for (const [width, height, touch] of [[390, 844, true], [1280, 800, false]]) {
  test(`${width}: four ticks of Afters with the Show menu up — the card at the top of the screen stays put`, { skip }, async () => {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() }); });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { throw e; });
    const TOKEN = 'menukeepplacecontract_012'; // a made-up crew
    const FID = 'portola-2026';
    try {
      await ctx.addInitScript(([t, f]) => {
        localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
        localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
        localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
        localStorage.setItem('fn_welcome_v1', '1');
      }, [TOKEN, FID]);
      const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
      await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
      await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
      await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await page.clock.setFixedTime(new Date('2026-09-26T09:00:00-07:00')); // before doors: no now-line landing to move the page
      await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
      const door = width >= 720 ? 'rail' : 'dock';
      await page.waitForSelector(`#${door}-fest-wrap .sort-pop`, { state: 'attached', timeout: 10000 });
      await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20);
      // Saturday evening: Robyn's card a third of the way down the screen.
      await page.evaluate(() => {
        const robyn = [...document.querySelectorAll('#wall-root .day-block[data-day="Saturday"] .card')].find((c) => c.dataset.artist === 'Robyn');
        window.scrollTo(0, robyn.getBoundingClientRect().top + scrollY - innerHeight / 3);
      });
      await page.waitForTimeout(500);
      const where = () => page.evaluate(() => {
        const robyn = [...document.querySelectorAll('#wall-root .day-block[data-day="Saturday"] .card')].find((c) => c.dataset.artist === 'Robyn');
        return { y: Math.round(scrollY), robyn: Math.round(robyn.getBoundingClientRect().top), thursday: !!document.querySelector('#wall-root .day-block[data-day="Thursday"]') };
      });
      const start = await where();
      assert.ok(start.y > 1500, `scrolled well into Saturday: ${JSON.stringify(start)}`);
      const seen = [start];
      // A real pointer at the row, once the menu has finished growing.
      // page.click() is not used here on purpose: it retries while the menu
      // is still animating and each retry scrolls the page to "reveal" the
      // row, moving the wall before the tap and hiding what this measures.
      const tapAfters = async () => {
        const at = await page.evaluate(async (d) => {
          const row = document.querySelector(`#${d}-fest-wrap .sort-pop [data-room="Afters"]`);
          let last = '';
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => requestAnimationFrame(r));
            const r = row.getBoundingClientRect();
            const now = `${r.left},${r.top},${r.width},${r.height}`;
            if (now === last) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            last = now;
          }
          return null;
        }, door);
        assert.ok(at, 'the menu settles');
        if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
      };
      await page.click(`#${door}-fest-link`);
      await page.waitForSelector(`#${door}-fest-wrap .sort-pop`, { state: 'visible' });
      for (let tick = 0; tick < 4; tick++) {
        await tapAfters();
        await page.waitForTimeout(700); // the leave, the repaint, the arrival
        seen.push(await where());
      }
      const said = JSON.stringify(seen);
      assert.equal(seen[1].thursday, false, `the first tick hid Afters, and Thursday with it: ${said}`);
      assert.notEqual(seen[1].y, start.y, `the page did move, by what left above: ${said}`);
      for (const s of seen) assert.ok(Math.abs(s.robyn - start.robyn) <= 3, `Robyn stays where she was on screen, tick after tick: ${said}`);
      assert.equal(await page.isVisible(`#${door}-fest-wrap .sort-pop`), true, 'and the menu is still up for the next tick');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const closed = await where();
      assert.ok(Math.abs(closed.robyn - start.robyn) <= 3, `putting the menu away keeps the place too: ${JSON.stringify(closed)}`);
    } finally {
      await ctx.close();
    }
  });
}

// The Show menu is a popover, not a place (v93, after the cut of its own
// history entry): opening it pushes nothing, a Back with it up goes where Back
// goes and takes the menu and its busy flag with it, and a crew deleted on the
// server with it up leaves no menu and no flag behind (Sol 6's review: the flag
// held every new build's reload on that phone).
test('the show menu: opening it pushes nothing; Back with it up leaves no menu and no busy flag; a crew 404 clears it too', { skip }, async () => {
  const { ctx, page } = await phone();
  const TOKEN = 'menupopovercontract_01234'; // a made-up crew
  const OTHER = 'menupopoverothercrew_0123'; // and the one before it
  const FID = 'portola-2026';
  let gone = false;
  try {
    await ctx.addInitScript(([t, o, f]) => {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }, { token: o, name: 'Other' }]));
      for (const x of [t, o]) { localStorage.setItem(`fn_me_v3_${x}`, 'Kevin'); localStorage.setItem(`fn_crew_fest_v3_${x}`, f); }
      localStorage.setItem('fn_welcome_v1', '1');
    }, [TOKEN, OTHER, FID]);
    const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    await ctx.route('**/api/crew**', (route) => {
      const t = new URL(route.request().url()).searchParams.get('t');
      return gone && t === TOKEN
        ? route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Crew not found"}' })
        : route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) });
    });
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    const wall = () => page.waitForFunction(() => document.getElementById('screen-app').style.display === '' && document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 10000 });
    const state = () => page.evaluate(() => ({
      url: location.hash, len: history.length, busy: document.body.dataset.busy || null,
      menu: document.getElementById('dock-fest-link').getAttribute('aria-expanded'),
      shown: getComputedStyle(document.querySelector('#dock-fest-wrap .sort-pop')).display,
    }));
    await page.goto(`${server.origin}/#g=${OTHER}`, { waitUntil: 'load' });
    await wall();
    await page.evaluate((t) => { location.hash = `#g=${t}`; }, TOKEN);
    await page.waitForTimeout(400);
    await wall();
    const before = await state();
    await page.click('#dock-fest-link');
    await page.waitForSelector('#dock-fest-wrap .sort-pop', { state: 'visible' });
    const up = await state();
    assert.equal(up.len, before.len, 'opening the menu pushed no history entry');
    assert.equal(up.busy, 'show-menu', 'and it holds a new build\'s reload while it is up');
    await page.evaluate(() => history.back());
    await page.waitForTimeout(900);
    await wall();
    const back = await state();
    const crewOf = (hash) => (/[#&]g=([^&]+)/.exec(hash) || [])[1];
    assert.equal(crewOf(back.url), OTHER, `one Back: the crew before, as Back always did: ${back.url}`);
    assert.deepEqual([back.menu, back.shown, back.busy], ['false', 'none', null], 'with no menu and no busy flag left behind');

    await page.evaluate(() => history.forward());
    await page.waitForTimeout(900);
    await wall();
    await page.click('#dock-fest-link');
    await page.waitForSelector('#dock-fest-wrap .sort-pop', { state: 'visible' });
    gone = true;
    await page.evaluate(() => import('/js/sync.js').then((s) => s.pollSync()));
    await page.waitForSelector('#screen-landing', { state: 'visible', timeout: 5000 });
    const list = await state();
    assert.deepEqual([list.menu, list.busy], ['false', null], `the crew 404: the fest list, the menu and its flag gone: ${JSON.stringify(list)}`);
    await page.evaluate(() => history.back());
    await page.waitForTimeout(900);
    await wall();
    assert.equal(crewOf((await state()).url), OTHER, 'and Back from the fest list is the crew before');
  } finally {
    await ctx.close();
  }
});

// The wall's address follows its festival (v96 — Sol's review of 3599950, and
// the independent walk): a festival switched in Settings left the address on
// the old one, so a reload bounced the phone back to it (the address's &f= is
// a hint, and a hint wins at boot). In a real engine: switch, close, reload.
test('a festival switched in Settings moves the address, and a reload stays on it', { skip }, async () => {
  const { ctx, page } = await phone();
  const TOKEN = 'festswitchreloadcontract1'; // a made-up crew
  try {
    await ctx.addInitScript(([t]) => {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Two Fests' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem('fn_welcome_v1', '1');
    }, [TOKEN]);
    const doc = { v: 4, meta: { name: 'Two Fests', inviteFestId: 'portola-2026' }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { 'portola-2026': { selections: {} }, 'acl-2026': { selections: {} } } };
    await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    // /f/<fest> is api/share.js's in production: the app's shell, with that
    // festival's preview tags. Here, the shell.
    await ctx.route(/\/f\/[a-z0-9-]+$/, async (route) => route.fulfill({ response: await route.fetch({ url: `${server.origin}/` }) }));
    await page.goto(`${server.origin}/f/portola-2026#g=${TOKEN}&f=portola-2026`, { waitUntil: 'load' });
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
    await page.click('#gear-btn');
    await page.waitForSelector('#screen-settings', { state: 'visible' });
    await page.locator('#settings-root button.fest-row', { hasText: /ACL/i }).first().click();
    await page.waitForSelector('#screen-app', { state: 'visible' });
    await page.waitForFunction(() => location.pathname === '/f/acl-2026', null, { timeout: 5000 }).catch(() => {});
    const url = new URL(page.url());
    assert.equal(url.pathname, '/f/acl-2026', `the address follows the switch: ${page.url()}`);
    assert.match(url.hash, /&f=acl-2026/, 'the app\'s own copy too');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(400);
    assert.match(await page.textContent('#dock-fest-name'), /ACL/i, 'a reload stays on ACL');
    assert.equal(new URL(page.url()).pathname, '/f/acl-2026');
  } finally {
    await ctx.close();
  }
});
