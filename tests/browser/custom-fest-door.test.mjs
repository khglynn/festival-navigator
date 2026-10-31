// A festival the crew researched and saved has a door (v119, 2026-10-30).
// Settings' "Your festivals" listed only festivals the crew doc names, and the
// doc names one only after someone picks in it, so a custom saved a moment ago
// had no row anywhere: "Saved — find it under Your festivals" pointed at
// nothing, and Freaky Deaky had to be opened by hand. Now the crew's customs
// have rows, and a save goes straight to the festival it saved. Real clicks.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER, motionDone } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => {
  if (browser) await browser.close();
  await server.close();
});
const skip = browser ? false : NO_BROWSER;

const TOKEN = 'customfestdoorcontract12'; // a made-up crew
const FID = 'portola-2026';
const custom = (id, name) => ({
  id, name, year: "'26", status: 'lineup', subtitle: 'Expo Center', location: 'Austin, TX', dates: 'Oct 30-31, 2026',
  artists: [{ name: 'Restricted', day: 'Saturday' }, { name: 'Hannah Laing', day: 'Friday' }],
});

async function wallPhone({ saved = [], research = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Door Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
  }, [TOKEN, FID]);
  const doc = { v: 4, meta: { name: 'Door Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
  const stored = [...saved];
  await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/festival-add**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ festivals: stored }) });
    const body = JSON.parse(req.postData() || '{}');
    if (body.confirm) { stored.push(body.festival); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ saved: true, id: body.festival.id }) }); }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidate: research, warnings: [], sources: [], gridNote: null, added: [] }) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(`${server.origin}/#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('#wall-root .card', { timeout: 10000 });
  await motionDone(page);
  return { ctx, page };
}

async function openSettings(page) {
  await page.click('#dock-fest-link');
  await page.waitForSelector('#dock-fest-wrap .sort-pop', { state: 'visible' });
  await motionDone(page);
  await page.locator('#dock-fest-wrap .sort-pop button.settings').first().click();
  await page.waitForSelector('#screen-settings', { state: 'visible' });
  await page.waitForSelector('#settings-main .back-btn', { state: 'visible' });
}

const onWallOf = (page, name) => page.waitForFunction((n) => document.getElementById('screen-settings').style.display === 'none'
  && document.title.startsWith(n), name, { timeout: 6000 });

test('a saved custom festival has a row in Your festivals, and the row opens it', { skip }, async () => {
  const { ctx, page } = await wallPhone({ saved: [custom('door-fest-2026', 'Door Fest')] });
  try {
    await openSettings(page);
    const row = page.locator('#settings-main .fest-row', { hasText: /DOOR FEST/ });
    assert.equal(await row.count(), 1, 'the crew\'s own festival is listed once under Your festivals');
    await row.first().click();
    await onWallOf(page, 'Door Fest');
  } finally { await ctx.close(); }
});

test('saving a researched festival makes it the current one: Settings comes back with it on top, one Back from its wall', { skip }, async () => {
  const { ctx, page } = await wallPhone({ research: custom('fresh-fest-2026', 'Fresh Fest') });
  try {
    await openSettings(page);
    await page.locator('#settings-main button', { hasText: /Research \+ add it to this board/ }).first().click();
    await page.fill('#settings-subview input[aria-label="Festival name"]', 'Fresh Fest 2026');
    await page.locator('#settings-subview button', { hasText: /^Research$/ }).click();
    await page.locator('#settings-subview button', { hasText: /Looks right/ }).click();
    await page.waitForFunction(() => {
      const main = document.getElementById('settings-main');
      const cur = main && main.querySelector('.settings-card.current');
      return main && getComputedStyle(main).display !== 'none' && cur && /FRESH FEST/.test(cur.textContent);
    }, null, { timeout: 6000 });
    await page.click('#settings-main .back-btn');
    await onWallOf(page, 'Fresh Fest');
  } finally { await ctx.close(); }
});
