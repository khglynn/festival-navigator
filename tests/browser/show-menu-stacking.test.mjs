// The dock's Show menu is always on top (v92 — the code map, 2026-09-26). The
// dock is position:fixed with a z-index, a stacking context, so its upward
// menu used to paint at the dock's level — UNDER the welcome card and the
// bring-picks offer (z38): a guest who tapped the fest name with the welcome
// up got a menu they could not touch. While the menu is up the dock stands
// above them (v3.css .menu-up), and steps back when it goes. The join shelf
// is the other thing above the dock: opening it puts the menu away, and with
// the shelf up the fest name is behind its dimmed wall.
// The real app, a made-up crew, /api answered in the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const FID = 'portola-2026';

async function guestWithWelcome(engine) {
  const CREW = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine === chromium, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' });
  const doc = { v: 4, meta: { name: 'Menu Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } }, festivals: { [FID]: { selections: { Robyn: { Maya: 2 } } } } };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-09-26T15:15:00-07:00'));
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#welcome-card', { timeout: 15000 });
  await sleep(1200); // the card has arrived
  return { ctx, page, errors };
}
const tapOn = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
};
// In the overlap of the open menu and the welcome card: what a finger touches.
const overlapHit = (page) => page.evaluate(() => {
  const pop = document.querySelector('#dock .sort-pop');
  const card = document.querySelector('#welcome-card .bring-card');
  const a = pop.getBoundingClientRect(), b = card.getBoundingClientRect();
  const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), t = Math.max(a.top, b.top), bo = Math.min(a.bottom, b.bottom);
  if (r - l < 4 || bo - t < 4) return { overlap: false };
  const under = document.elementFromPoint((l + r) / 2, (t + bo) / 2);
  return { overlap: true, inMenu: !!(under && pop.contains(under)), under: under && (under.textContent || '').trim().slice(0, 20) };
});

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  test(`${name}: the Show menu opens on top of the welcome card, and the join shelf puts it away`, {
    skip: get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER),
  }, async () => {
    const { ctx, page, errors } = await guestWithWelcome(get());
    try {
      await tapOn(page, '#dock-fest-link');
      await sleep(400);
      assert.equal(await page.locator('#dock .sort-pop').isVisible(), true, 'the menu opened');
      assert.ok(await page.locator('#welcome-card').count(), 'with the welcome card still up');
      const hit = await overlapHit(page);
      assert.equal(hit.overlap, true, 'they overlap on a phone (the case this is about)');
      assert.equal(hit.inMenu, true, `a finger in the overlap touches the menu, not the card (${JSON.stringify(hit)})`);
      // A row in the overlap really works: it is the thing under its centre.
      const rowHit = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#dock .sort-pop [role="option"]')];
        return rows.every((b) => { const r = b.getBoundingClientRect(); const u = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return u && b.contains(u); });
      });
      assert.equal(rowHit, true, 'every row of the menu is reachable');
      // Closed and reopened faster than its 130 ms fade: the old fade's end
      // must not hide the reopened menu (the re-review of b29aac0).
      const link = await page.locator('#dock-fest-link').boundingBox();
      const lx = link.x + link.width / 2, ly = link.y + link.height / 2;
      await page.touchscreen.tap(lx, ly); // close
      await page.touchscreen.tap(lx, ly); // reopen, mid-fade
      await sleep(450);
      assert.equal(await page.locator('#dock .sort-pop').isVisible(), true, 'the reopened menu is still up after the old fade ended');
      assert.equal(await page.locator('#dock-fest-link').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#dock.menu-up').count(), 1, 'and the dock is still above the cards');
      // It steps back once the menu has gone.
      await page.keyboard.press('Escape');
      await sleep(500);
      assert.equal(await page.locator('#dock .sort-pop').isVisible(), false);
      assert.equal(await page.locator('#dock.menu-up').count(), 0, 'the dock stepped back under the cards');
      // The join shelf: opening it puts an open menu away.
      await tapOn(page, '#dock-fest-link');
      await sleep(400);
      assert.equal(await page.locator('#dock .sort-pop').isVisible(), true);
      await page.evaluate(() => document.getElementById('dock-you').click()); // the dashed +, under the menu's row of the dock
      await page.waitForSelector('.join-shelf', { timeout: 3000 });
      await sleep(500);
      assert.equal(await page.locator('#dock .sort-pop').isVisible(), false, 'the shelf put the menu away');
      const b = await page.locator('#dock-fest-link').boundingBox();
      const under = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id || document.elementFromPoint(x, y)?.className, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      assert.ok(/sheet|join-shelf|js-/.test(String(under)), `with the shelf up, the fest name is behind it (under: ${under})`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
