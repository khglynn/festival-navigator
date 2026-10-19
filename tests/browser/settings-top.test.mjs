// Settings opens at its top, and Back puts the wall where it was (v116, the
// off-season walk, 2026-10-19). The wall scrolls the PAGE, and showing the
// Settings screen used to leave the page's scroll alone: opened from a wall
// scrolled to its middle, Settings came up at its bottom (the Spotify and App
// rows), with its title and its back chevron above the fold, and a drill
// opened from a scrolled Settings did the same. Real input throughout: a
// wheel on the wall, real clicks on the doors.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER, motionDone } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await serveStatic(ROOT);
const browser = await launchBrowser();
// WebKit too: every iPhone runs it, and the Back case leans on the engine's
// own scroll restore for a history entry.
const webkit = await launchWebkit();
test.after(async () => {
  if (browser) await browser.close();
  if (webkit) await webkit.close();
  await server.close();
});
const skip = browser ? false : NO_BROWSER;
const skipWebkit = webkit ? false : 'no WebKit (npx playwright install webkit)';

const TOKEN = 'settingstopcontract12345'; // a made-up crew
const FID = 'portola-2026';

async function wallPhone(engine = browser) {
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Scroll Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
  }, [TOKEN, FID]);
  const doc = { v: 4, meta: { name: 'Scroll Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
  await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(`${server.origin}/#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('#wall-root .card', { timeout: 10000 });
  await motionDone(page);
  return { ctx, page };
}

const scrollY = (page) => page.evaluate(() => window.scrollY);
// Wheel the page down until it stands past `y`, then wait for it to stop.
async function wheelTo(page, y) {
  await page.mouse.move(60, 600);
  // One notch at a time, each left to come to rest (an engine may glide a
  // wheel): a burst of notches read before they land overshot to the page's
  // foot, where the browser's clamp decides the place, not the app (CI,
  // WebKit: 3871 -> 3877).
  for (let i = 0; i < 40 && (await scrollY(page)) < y; i++) {
    await page.mouse.wheel(0, 300);
    await stillPage(page);
  }
  const at = await scrollY(page);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  assert.ok(at >= y, `the page scrolled past ${y} (stands at ${at})`);
  assert.ok(at < max - 100, `and stands mid-page, clear of the clamp at its foot (${at} of ${max})`);
  return at;
}
// Still: the same scroll on three polls in a row.
const stillPage = (page) => page.waitForFunction(() => {
  const now = window.scrollY;
  const w = window.__still || (window.__still = { y: null, n: 0 });
  w.n = now === w.y ? w.n + 1 : 0;
  w.y = now;
  return w.n >= 2;
}, null, { polling: 100, timeout: 5000 });
// The engine restores a scroll for the wall's history entry right after the
// popstate that closes Settings; the app keeps it from doing so until that
// Back is done, then hands the entry back ('auto') — the state at rest.
const backAtRest = (page) => page.waitForFunction(() => history.scrollRestoration === 'auto'
  && document.getElementById('screen-app').style.display !== 'none', null, { timeout: 5000 });
// What the person is looking at: the first card under the sticky band, keyed
// the way the wall keys its anchors (wall.js wallAnchors: day, room, artist,
// occurrence, and a count for a repeat), and where it stands. "The wall where
// it was" is that card back at that spot. The app keeps the place by what is
// on screen (keepWallPlace), so when something above it measures a few pixels
// differently after the repaint (Linux WebKit in CI: scrollY 3871 -> 3877)
// scrollY moves and the wall does not. The bug this guards, the engine's own
// restore writing Settings' 0 over the place, moves every card at once.
const cardsOnWall = (page) => page.evaluate(() => {
  const band = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 0;
  const count = new Map();
  return [...document.querySelectorAll('#wall-root .card[data-artist]')].map((el) => {
    const day = (el.closest('.day-block') || { dataset: {} }).dataset.day || '';
    const room = (el.closest('.room') || { dataset: {} }).dataset.room || '';
    let key = `${day}|${room}|${el.dataset.artist}|${el.dataset.occ || ''}`;
    const n = (count.get(key) || 0) + 1;
    count.set(key, n);
    if (n > 1) key += `|${n}`;
    return { key, top: el.getBoundingClientRect().top, band };
  });
});
async function seen(page) {
  const inView = (await cardsOnWall(page)).filter((c) => c.top >= c.band - 1 && c.top < 844);
  inView.sort((a, b) => a.top - b.top);
  return inView[0] ? { key: inView[0].key, top: inView[0].top, y: await scrollY(page) } : null;
}
async function sameWall(page, was, why) {
  assert.ok(was, 'not vacuous: a card stood under the band before Settings opened');
  const now = (await cardsOnWall(page)).find((c) => c.key === was.key);
  const y = await scrollY(page);
  assert.ok(now && Math.abs(now.top - was.top) <= 2,
    `${why}: ${was.key} stood at ${Math.round(was.top)}px, now ${now ? Math.round(now.top) + 'px' : 'gone'} (scrollY ${was.y} -> ${y})`);
}
// An element's box, read in the viewport.
const boxOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, h: r.height };
}, sel);
async function openSettingsFromDock(page) {
  await page.click('#dock-fest-link');
  await page.waitForSelector('#dock-fest-wrap .sort-pop', { state: 'visible' });
  await motionDone(page);
  await page.locator('#dock-fest-wrap .sort-pop button.settings').first().click();
  await page.waitForSelector('#screen-settings', { state: 'visible' });
  await page.waitForSelector('#settings-main .back-btn', { state: 'visible' });
}

test('390 touch: Settings opened from a scrolled wall stands at its top, a drill does too, and Back finds the wall\'s place', { skip }, async () => {
  const { ctx, page } = await wallPhone();
  try {
    await wheelTo(page, 1500);
    const was = await seen(page);
    await openSettingsFromDock(page);
    assert.equal(await scrollY(page), 0, 'Settings opens at its top');
    const back = await boxOf(page, '#settings-main .back-btn');
    assert.ok(back && back.top >= 0 && back.bottom <= 844, `its back chevron is on screen: ${JSON.stringify(back)}`);
    const title = await boxOf(page, '#settings-main .screen-title');
    assert.ok(title && title.top >= 0, `and its title: ${JSON.stringify(title)}`);

    // A drill opened from a scrolled Settings stands at its own top.
    await page.mouse.move(195, 600);
    await page.mouse.wheel(0, 300);
    await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 3000 });
    const how = page.locator('#settings-main button', { hasText: /^How it works/ }).first();
    await how.scrollIntoViewIfNeeded(); // so the click below moves nothing
    await stillPage(page);
    const mainAt = await scrollY(page);
    assert.ok(mainAt > 0, `Settings is scrolled when the drill opens (${mainAt})`);
    await how.click();
    await page.waitForFunction(() => {
      const sub = document.getElementById('settings-subview');
      return !!sub && sub.childElementCount > 0 && document.getElementById('settings-main').style.display === 'none';
    }, null, { timeout: 5000 });
    assert.equal(await scrollY(page), 0, 'the drill opens at its top');
    const subBack = await boxOf(page, '#settings-subview .back-btn');
    assert.ok(subBack && subBack.top >= 0, `the drill's back chevron is on screen: ${JSON.stringify(subBack)}`);

    // Back out of the drill, then out of Settings: the wall where it was.
    await page.click('#settings-subview .back-btn');
    await page.waitForSelector('#settings-main', { state: 'visible' });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
    const mainAfter = await scrollY(page);
    assert.ok(Math.abs(mainAfter - mainAt) <= 2, `Back from the drill puts Settings where it stood: ${mainAt} -> ${mainAfter}`);
    await page.click('#settings-main .back-btn');
    await backAtRest(page);
    await sameWall(page, was, 'Back puts the wall where it was');
  } finally {
    await ctx.close();
  }
});

for (const [name, engine, skipIt] of [['Chromium', () => browser, skip], ['WebKit', () => webkit, skipWebkit]]) {
  test(`${name} 390 touch: browser Back from Settings finds the wall's place too`, { skip: skipIt }, async () => {
    const { ctx, page } = await wallPhone(engine());
    try {
      await wheelTo(page, 1200);
      const was = await seen(page);
      await openSettingsFromDock(page);
      assert.equal(await scrollY(page), 0, 'Settings opens at its top');
      assert.equal(await page.evaluate(() => history.scrollRestoration), 'manual', 'the wall\'s entry holds its own place while Settings is up');
      await page.goBack();
      await backAtRest(page);
      await sameWall(page, was, 'browser Back puts the wall where it was');
    } finally {
      await ctx.close();
    }
  });
}
