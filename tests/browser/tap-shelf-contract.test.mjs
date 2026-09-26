// The tap change in a real engine (2026-09-26 — Kevin: "a tap on mobile …
// shows the notes shelf (with full controls) rather than a zoom with a notes
// button"). The REAL APP (index.html, never the gallery's copy of the
// routing), a member of a made-up crew on an iPhone profile, real touch input:
//
//   a tap on a card opens its shelf — the card, − · your meter · +, the
//   thread — and grows no zoom and picks nothing; + climbs one level a press
//   to must and stops, − steps back to nothing and stops, and the row stands
//   still under the finger through every press (the card grows upward); the
//   dimmed wall and the system Back both close it, and the resting card's
//   meter then says the level; a hold is a slow tap; the WebKit ghost at the
//   lift point grows nothing; a sideways swipe on a stack row opens nothing;
//   and on a touch screen with a mouse (an iPad with a trackpad) the mouse
//   still hovers the zoom and a click still picks.
//
// WebKit is the engine that matters (iPhones): its touch tap sends
// pointerdown/pointerup as TOUCH and the click after them as MOUSE, so this
// is the proof that the hand is read from the press, not the click. CI
// installs WebKit (U0); a missing engine fails there and skips here.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER } from '../helpers/browser.mjs';
import { deepMerge } from '../../js/merge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
let devices = {};
devices = (await import('playwright')).devices;
webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

const FID = 'portola-2026';
const ENGINES = [['WebKit (iPhone)', () => webkit], ['Chromium (touch)', () => chromium]];
const skipFor = (name, get) => (get() ? false : (name.startsWith('WebKit') ? 'Playwright WebKit is not installed (npx playwright install webkit)' : NO_BROWSER));

async function memberPhone(engine, { width = 390, height = 664, mouse = false } = {}) {
  const CREW = randomBytes(20).toString('base64url'); // a made-up crew, never a real link
  const profile = devices['iPhone 13'] || { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
  const opts = { ...profile, viewport: { width, height }, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' };
  delete opts.defaultBrowserType;
  if (engine !== chromium || mouse) delete opts.isMobile; // WebKit takes no isMobile; an iPad with a mouse is not "mobile"
  const ctx = await engine.newContext(opts);
  await ctx.addInitScript((t) => {
    localStorage.setItem('fn_welcome_v1', '1');
    localStorage.setItem('fn_tap_news_v1', '1'); // the one-time line has its own unit case
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Tap Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
  }, CREW);
  let crewDoc = {
    v: 4, meta: { name: 'Tap Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
    festivals: { [FID]: { selections: { Fcukers: { Maya: 2 } } } },
  };
  const writes = [];
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => {
    if (r.request().method() !== 'GET') {
      writes.push(r.request().url());
      try { crewDoc = deepMerge(crewDoc, JSON.parse(r.request().postData() || '{}').data || {}); } catch { /* not JSON */ }
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(crewDoc) });
  });
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-09-26T15:15:00-07:00'));
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await sleep(400);
  return { ctx, page, errors, writes };
}

// A card's centre, brought on screen and on top there.
const cardAt = (page, artist) => page.evaluate((a) => {
  const el = document.querySelector(`#wall-root .card[data-artist="${a}"]`);
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 30)) };
}, artist);
const shelf = (page) => page.evaluate(() => {
  const s = document.getElementById('artist-sheet');
  if (!s || s.classList.contains('join-shelf')) return null;
  const row = s.querySelector('.sheet-card .f-step-row');
  const b = (sel) => { const n = row && row.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, off: !!n.disabled }; };
  return { name: s.querySelector('.sheet-card .f-name')?.textContent, meter: row?.querySelector('.f-meter')?.dataset.level, minus: b('.f-step.minus'), plus: b('.f-step.plus'), notesButton: !!s.querySelector('.f-chip.notes') };
});
const zoomUp = (page) => page.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown').length);
const level = (page, artist) => page.evaluate(async (a) => {
  const st = await import('/js/state.js');
  return ((st.crewDoc.festivals['portola-2026'].selections[a] || {}).Kevin) || 0;
}, artist);
const restingMeter = (page, artist) => page.evaluate((a) => {
  const m = document.querySelector(`#wall-root .card[data-artist="${a}"] .chip-meter`);
  return m ? Number(m.dataset.level) : 0;
}, artist);
const tapAt = (page, p) => page.touchscreen.tap(Math.round(p.x), Math.round(p.y));

for (const [name, get] of ENGINES) {
  test(`${name}: a tap opens the card's shelf; + climbs to must and − back to nothing with the row standing still; the wall and Back close it`, { skip: skipFor(name, get) }, async () => {
    const { ctx, page, errors } = await memberPhone(get());
    try {
      const at = await cardAt(page, 'Oskar Med K');
      await tapAt(page, at);
      await page.waitForFunction(() => !!document.querySelector('#artist-sheet .sheet-card'), null, { timeout: 4000 });
      await sleep(500);
      let s = await shelf(page);
      assert.equal(s.name, 'Oskar Med K', 'the tapped card’s shelf');
      assert.equal(s.meter, '0');
      assert.equal(s.minus.off, true);
      assert.equal(s.notesButton, false, 'no notes button of its own');
      assert.equal(await zoomUp(page), 0, 'no zoom');
      assert.equal(await level(page, 'Oskar Med K'), 0, 'a tap picks nothing');

      const rowY = s.plus.y;
      const plusAt = { x: s.plus.x, y: s.plus.y };
      const minusX = s.minus.x;
      for (const want of [1, 2, 3, 4]) {
        await tapAt(page, plusAt); // the same spot every time: the finger does not move
        await sleep(450);
        s = await shelf(page);
        assert.ok(s, `the shelf stays up (+${want})`);
        assert.equal(await level(page, 'Oskar Med K'), want, `+ ×${want}`);
        assert.equal(s.meter, String(want));
        // Within a pixel and a half: Linux's WebKit put the row 1.03px lower
        // after the first + on CI (run 36239935622, 2026-09-26) — the sheet's
        // snapped height against its content's fractional one — where macOS
        // WebKit and Chromium hold it to 0. No finger feels a pixel; the law's
        // teeth are the 22–29px jumps a who-row arriving used to cause.
        assert.ok(Math.abs(s.plus.y - rowY) <= 1.5, `the row did not move under the finger (+${want}: ${s.plus.y - rowY}px)`);
        // Nor sideways: the meter's MUST is wider than its bars, and a middle
        // that sized to it re-divided the row at must (the tap walk).
        assert.ok(Math.abs(s.plus.x - plusAt.x) <= 1.5 && Math.abs(s.minus.x - minusX) <= 1.5,
          `− and + kept their boxes (+${want}: +${(s.plus.x - plusAt.x).toFixed(1)}px, −${(s.minus.x - minusX).toFixed(1)}px)`);
      }
      assert.equal(s.plus.off, true, 'must: nowhere higher');
      const minusAt = { x: s.minus.x, y: s.minus.y };
      for (const want of [3, 2, 1, 0]) {
        await tapAt(page, minusAt);
        await sleep(450);
        s = await shelf(page);
        assert.equal(await level(page, 'Oskar Med K'), want, `back to ${want}`);
        assert.ok(Math.abs(s.minus.y - rowY) <= 1.5, `the row stood still (−: ${s.minus.y - rowY}px)`);
      }
      assert.equal(s.minus.off, true);
      await tapAt(page, plusAt);
      await tapAt(page, plusAt);
      await sleep(450);
      assert.equal(await level(page, 'Oskar Med K'), 2, 'two quick presses, two levels');

      // The dimmed wall closes it, and nothing under that tap is touched.
      await tapAt(page, { x: 195, y: 40 });
      await page.waitForFunction(() => !document.getElementById('artist-sheet'), null, { timeout: 4000 });
      await sleep(400);
      assert.equal(await zoomUp(page), 0, 'nothing grew where the finger lifted');
      assert.equal(await restingMeter(page, 'Oskar Med K'), 2, 'the resting card’s meter says the level');

      // The system Back closes it too.
      await tapAt(page, await cardAt(page, 'Fcukers'));
      await page.waitForFunction(() => !!document.querySelector('#artist-sheet .sheet-card'), null, { timeout: 4000 });
      await sleep(400);
      await page.goBack();
      await page.waitForFunction(() => !document.getElementById('artist-sheet'), null, { timeout: 4000 });
      assert.equal(await level(page, 'Fcukers'), 0, 'looking wrote nothing');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: the ghost a finger leaves grows nothing — not the tapped card, not one scrolled under the spot`, { skip: skipFor(name, get) }, async () => {
    const { ctx, page, errors } = await memberPhone(get());
    try {
      const at = await cardAt(page, 'Tove Lo');
      await tapAt(page, at);
      await page.waitForFunction(() => !!document.querySelector('#artist-sheet .sheet-card'), null, { timeout: 4000 });
      await sleep(400);
      await tapAt(page, { x: 195, y: 40 }); // close on the dimmed wall
      await page.waitForFunction(() => !document.getElementById('artist-sheet'), null, { timeout: 4000 });
      // What WebKit sends by itself after a tap: mouse-type events at the lift
      // point. Chromium never does, so there they are driven through the real
      // input layer (a trusted mouse move to the exact spot).
      if (get() === chromium) await page.mouse.move(at.x, at.y);
      await sleep(700);
      assert.equal(await zoomUp(page), 0, 'the ghost at the lift point grew nothing');
      await page.evaluate(() => window.scrollBy(0, 140));
      await sleep(700);
      assert.equal(await zoomUp(page), 0, 'no card grew under the still spot');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// Chromium's touch input can hold a finger down for real (CDP): a hold is a
// slow tap — one shelf, no pick, no system callout — whether this engine
// ends the gesture with a click or with a context menu.
test('Chromium (touch): a hold then a release opens one shelf and picks nothing', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await memberPhone(chromium);
  try {
    const at = await cardAt(page, 'Tove Lo');
    await page.evaluate(() => { window.__menus = 0; document.addEventListener('contextmenu', () => { window.__menus += 1; }, true); });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
    await sleep(750);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(600);
    const s = await shelf(page);
    assert.ok(s, 'the hold opened the shelf');
    assert.equal(s.name, 'Tove Lo');
    assert.equal(await page.locator('#artist-sheet').count(), 1, 'one shelf');
    assert.equal(await zoomUp(page), 0, 'no zoom');
    assert.equal(await level(page, 'Tove Lo'), 0, 'and no pick');
    console.log(`  (this engine's hold sent ${await page.evaluate(() => window.__menus)} contextmenu event(s))`);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// A sideways swipe on a phone's stack row scrolls the row and opens nothing
// (a drag sends no click).
test('Chromium (touch): a sideways swipe on a stack row opens nothing', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await memberPhone(chromium);
  try {
    const at = await page.evaluate(() => {
      const row = [...document.querySelectorAll('#wall-root .stack-scroll')].find((r) => r.scrollWidth > r.clientWidth + 20);
      if (!row) return null;
      row.scrollIntoView({ block: 'center' });
      const r = row.getBoundingClientRect();
      return { x: Math.round(r.left + r.width * 0.7), y: Math.round(r.top + Math.min(40, r.height / 2)) };
    });
    if (!at) { console.log('  (no scrolling stack row on this day — nothing to swipe)'); return; }
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    for (let i = 1; i <= 6; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x - i * 30, y: at.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(600);
    assert.equal(await page.locator('#artist-sheet').count(), 0, 'no shelf');
    assert.equal(await zoomUp(page), 0, 'no zoom');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// An iPad with a trackpad: the same device, two hands. A finger's tap opens
// the shelf; the mouse hovers the zoom as a desktop does, and a mouse click
// on the wall picks — decided by the press, never the width.
test('Chromium (a touch screen with a mouse): a finger opens the shelf, the mouse hovers the zoom and a click picks', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await memberPhone(chromium, { width: 820, height: 1180, mouse: true });
  try {
    const at = await cardAt(page, 'Tove Lo');
    await tapAt(page, at);
    await page.waitForFunction(() => !!document.querySelector('#artist-sheet .sheet-card'), null, { timeout: 4000 });
    await sleep(400);
    assert.equal((await shelf(page)).name, 'Tove Lo', 'the finger opened the shelf (a centred dialog at this width)');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('artist-sheet'), null, { timeout: 4000 });
    const other = await cardAt(page, 'Fcukers');
    await page.mouse.move(other.x - 60, other.y - 60);
    await page.mouse.move(other.x, other.y, { steps: 5 });
    await sleep(700);
    assert.equal(await zoomUp(page), 1, 'the mouse hovers the zoom');
    await page.mouse.click(other.x, other.y);
    await sleep(300);
    assert.equal(await level(page, 'Fcukers'), 1, 'a click on the (grown) card picks');
    assert.equal(await page.locator('#artist-sheet').count(), 0, 'and opens no shelf');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// The review of the tap change (2026-09-26): a close during the rise leaves
// from wherever the rise has got to — the sheet never jumps up to its rest
// on its way out (nothing pops).
for (const [name, get] of ENGINES) {
  test(`${name}: closed during its rise, the shelf goes straight down from where it was`, { skip: skipFor(name, get) }, async () => {
    const { ctx, page, errors } = await memberPhone(get());
    try {
      const at = await cardAt(page, 'Tove Lo');
      // Sampled from here, round trip by round trip (this file fixes the
      // page's clock, and the page's own timers and frames go with it).
      const sample = () => page.evaluate(() => {
        const s = document.querySelector('.sheet:not(.join-shelf)');
        return s ? { top: s.getBoundingClientRect().top, rest: innerHeight - s.offsetHeight, closing: !s.id } : null;
      });
      await tapAt(page, at);
      await page.waitForFunction(() => !!document.getElementById('artist-sheet'), null, { timeout: 4000 });
      const tops = [];
      for (let i = 0; i < 4; i++) { const f = await sample(); if (f) tops.push(f); } // mid-rise
      await page.evaluate(() => history.back());
      for (let i = 0; i < 60; i++) { const f = await sample(); if (!f) break; tops.push(f); }
      const closing = tops.filter((f) => f.closing);
      assert.ok(closing.length >= 2, `the way out was sampled (${closing.length} frames)`);
      const lastRising = tops.filter((f) => !f.closing).pop();
      assert.ok(lastRising && lastRising.top > lastRising.rest + 40, `not vacuous: the close came mid-rise (${lastRising && lastRising.top} vs rest ${lastRising && lastRising.rest})`);
      // The rise may have gone on a few px between the two samples; a snap to
      // the rest would be the whole remaining way.
      assert.ok(closing[0].top > closing[0].rest + 30 && closing[0].top >= lastRising.top - 12,
        `the way out starts where the rise was (${lastRising.top} → ${closing[0].top}; rest ${closing[0].rest}), not at its rest`);
      for (let i = 1; i < closing.length; i++) assert.ok(closing[i].top >= closing[i - 1].top - 1, `and only goes down (${closing[i - 1].top} → ${closing[i].top})`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// The real-input walk (2026-09-26): the shelf a mouse opens from the zoom's
// note door hands focus back to the card on Escape — the door is gone by then.
for (const [name, get] of ENGINES) {
  test(`${name.split(" ")[0]}, a desktop's mouse: the zoom's note door opens the shelf, and Escape hands focus back to the card with no zoom regrown`, { skip: skipFor(name, get) }, async () => {
    const engine = get();
    const CREW = randomBytes(20).toString('base64url'); // a made-up crew, never a real link
    const ctx = await engine.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
    try {
      await ctx.addInitScript((t) => {
        localStorage.setItem('fn_welcome_v1', '1');
        localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Tap Crew' }]));
        localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
        localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      }, CREW);
      const doc = { v: 4, meta: { name: 'Tap Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
      await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await ctx.route('**/api/crew**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
      await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
      await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date('2026-09-26T15:15:00-07:00'));
      await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
      const at = await cardAt(page, 'Tove Lo');
      await page.mouse.move(at.x - 50, at.y - 50);
      await page.mouse.move(at.x, at.y, { steps: 6 });
      await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
      await sleep(600);
      const door = await page.locator('#zoom-layer .zoom-slot.shown .f-step-row .f-chip.notes').boundingBox();
      await page.mouse.click(door.x + door.width / 2, door.y + door.height / 2);
      await page.waitForSelector('#artist-sheet .sheet-card .f-step.plus', { timeout: 4000 });
      await sleep(400);
      // The mouse leaves the card's spot (resting on it, a hover would grow
      // its zoom again once the sheet is gone — hover's own rule); what is
      // pinned here is the keyboard's handed-back focus.
      await page.mouse.move(640, 24, { steps: 3 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('artist-sheet'), null, { timeout: 4000 });
      await sleep(400);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset?.artist || document.activeElement?.nodeName), 'Tove Lo', 'focus is back on the card');
      assert.equal(await zoomUp(page), 0, 'and no zoom regrew on it');
    } finally { await ctx.close(); }
  });
}
