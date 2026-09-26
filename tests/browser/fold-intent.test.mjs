// A tick in the Show menu keeps your place — unless you have somewhere newer
// to be (v93 — Sol 6's re-review of c8230b1). A fold reads the place before
// its room's 130 ms way out and puts the page back on it after the repaint.
// Anything that moved the page in between used to be undone by that: a hand
// scroll snapped back to where the tick was made, and a NOW tap's glide was
// cut short and pulled back. Now the next intent finishes the fold first
// (NOW, a day tab, the next tick), and a page that moved during the fade has
// its place read again where it now is.
// WebKit runs when it is installed; CI runs Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: that engine skips */ }
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

const FID = 'portola-2026';
const TOKEN = 'foldintentcontract_012345'; // a made-up crew, never a real link

async function desk(browser, when) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
  }, [TOKEN, FID]);
  const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
  await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.setFixedTime(new Date(when));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#rail-fest-wrap .sort-pop', { state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20);
  await page.waitForTimeout(400);
  return { ctx, page };
}
const cardTop = (page, day, artist) => page.evaluate(([d, a]) => {
  const c = [...document.querySelectorAll(`#wall-root .day-block[data-day="${d}"] .card`)].find((x) => x.dataset.artist === a);
  return c ? Math.round(c.getBoundingClientRect().top) : null;
}, [day, artist]);
// The menu up, grown, and a real pointer on the Afters row once it has.
async function openAndFindAfters(page) {
  await page.click('#rail-fest-link');
  await page.waitForSelector('#rail-fest-wrap .sort-pop', { state: 'visible' });
  return page.evaluate(async () => {
    const row = document.querySelector('#rail-fest-wrap .sort-pop [data-room="Afters"]');
    let last = '';
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const r = row.getBoundingClientRect();
      const now = `${r.left},${r.top}`;
      if (now === last) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      last = now;
    }
    return null;
  });
}

for (const [name, get] of [['WebKit', () => webkit], ['Chromium', () => chromium]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name}: a hand scroll during a tick's fade wins — the page stays where the hand put it`, { skip }, async () => {
    const { ctx, page } = await desk(get(), '2026-09-26T09:00:00-07:00'); // before doors: no now-line landing
    try {
      await page.evaluate(() => {
        const r = [...document.querySelectorAll('#wall-root .day-block[data-day="Saturday"] .card')].find((c) => c.dataset.artist === 'Tove Lo');
        window.scrollTo(0, r.getBoundingClientRect().top + scrollY - 200);
      });
      await page.waitForTimeout(300);
      const row = await openAndFindAfters(page);
      assert.ok(row, 'the menu settles');
      // The tick, and at once a scroll the app did not make: Robyn, further
      // down, is where the hand brought her.
      await page.mouse.click(row.x, row.y);
      const handAt = await page.evaluate(() => {
        window.scrollBy(0, 240);
        const c = [...document.querySelectorAll('#wall-root .day-block[data-day="Saturday"] .card')].find((x) => x.dataset.artist === 'Robyn');
        return Math.round(c.getBoundingClientRect().top);
      });
      await page.waitForTimeout(800); // the fade, the repaint, the arrival
      const after = await cardTop(page, 'Saturday', 'Robyn');
      assert.equal(await page.evaluate(() => !!document.querySelector('#wall-root .day-block[data-day="Thursday"]')), false, 'the tick hid Afters (and Thursday with it)');
      assert.ok(Math.abs(after - handAt) <= 3, `Robyn stays where the hand scrolled her, not where the tick was made: ${handAt} -> ${after}`);
    } finally {
      await ctx.close();
    }
  });

  test(`${name}: NOW tapped during a tick's fade lands where NOW lands — the fold does not pull it back`, { skip }, async () => {
    const { ctx, page } = await desk(get(), '2026-09-26T19:30:00-07:00'); // Saturday, 7:30 PM: Robyn is on
    try {
      await page.evaluate(() => window.scrollTo(0, 0)); // the top of the week, far from now
      await page.waitForTimeout(300);
      const row = await openAndFindAfters(page);
      assert.ok(row, 'the menu settles');
      const now = await page.evaluate(() => { const r = document.getElementById('rail-now').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.mouse.click(row.x, row.y); // the tick
      await page.mouse.click(now.x, now.y); // and NOW, before the room has gone
      await page.waitForTimeout(1800);
      const settled = await page.evaluate(() => Math.round(scrollY));
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => Math.round(scrollY)), settled, 'nothing moves the page after NOW has landed');
      const robyn = await cardTop(page, 'Saturday', 'Robyn');
      assert.ok(robyn != null && robyn > 0 && robyn < 800, `NOW's stop is on screen — Robyn, on now, at ${robyn} (page at ${settled})`);
    } finally {
      await ctx.close();
    }
  });
}
