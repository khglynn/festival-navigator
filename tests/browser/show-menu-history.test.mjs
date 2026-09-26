// Every Back press does something you can see, even after the Show menu's
// screen went away with the menu up (v93 — Sol 6's re-review of 7332366).
//
// The menu holds a history entry of its own, so Back closes it. When its
// screen went instead — the crew deleted on the server, a crew opened over
// it — that entry was left behind. Rewriting it in place (router.forget) left
// two entries with the same URL and nothing between them, and one Back moved
// between them with nothing on screen changing: a press that did nothing. Or
// the entry still named the menu, and a Back into it reopened a menu over a
// wall it never belonged to.
//
// Now a switch that can wait a frame (the 404's fest list) takes the menu's
// entry back first, and an entry whose menu is gone opens nothing and never
// costs a Back (app.js arrivedAt, and the hashchange handler). Asserted here
// by where the page is and what it shows after each Back, in a real engine —
// the router's model alone once said all was well while the page sat still.
// WebKit runs when it is installed (iPhones); CI runs Chromium.
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
const A = 'menuhistorycrewaaa_012345'; // made-up crews, never real links
const B = 'menuhistorycrewbbb_012345';

async function phone(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([a, b, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: a, name: 'Crew A' }, { token: b, name: 'Crew B' }]));
    for (const t of [a, b]) {
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    }
    localStorage.setItem('fn_welcome_v1', '1');
  }, [A, B, FID]);
  const gone = new Set();
  const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
  await ctx.route('**/api/crew**', (route) => {
    const t = new URL(route.request().url()).searchParams.get('t');
    if (t && gone.has(t)) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Crew not found"}' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) });
  });
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  return { ctx, page, gone };
}

// Where the page is and what it shows: the address, the one visible screen,
// and whether the menu is up.
const at = (page) => page.evaluate(() => ({
  url: location.href.slice(location.origin.length),
  screen: [...document.querySelectorAll('[id^="screen-"]')].filter((s) => s.style.display !== 'none').map((s) => s.id).join(',') || null,
  menu: document.getElementById('dock-fest-link')?.getAttribute('aria-expanded') || null,
}));
const onWall = (page) => page.waitForFunction(() => document.getElementById('screen-app')?.style.display === ''
  && document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 10000 });
const openMenu = async (page) => {
  await page.click('#dock-fest-link');
  await page.waitForSelector('#dock-fest-wrap .sort-pop', { state: 'visible' });
  await page.waitForTimeout(250);
};
// One press, then long enough for any step it takes on its own and the boot
// a changed address brings.
const press = async (page, way) => {
  await page.evaluate((w) => (w === 'back' ? history.back() : history.forward()), way);
  await page.waitForTimeout(900);
};
const crewUrl = (t) => `/#g=${t}`;

for (const [name, get] of [['WebKit', () => webkit], ['Chromium', () => chromium]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name}: the crew deleted on the server with the Show menu up — Back from the fest list goes where Back goes from there`, { skip }, async () => {
    const { ctx, page, gone } = await phone(get());
    try {
      await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
      await onWall(page);
      await page.evaluate((u) => { location.hash = u; }, crewUrl(B).slice(1)); // crew B opened over A: A is the page Back returns to
      await page.waitForTimeout(400);
      await onWall(page);
      await openMenu(page);
      gone.add(B);
      await page.evaluate(() => import('/js/sync.js').then((s) => s.pollSync()));
      await page.waitForSelector('#screen-landing', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(300);
      const list = await at(page);
      assert.deepEqual(list, { url: crewUrl(B), screen: 'screen-landing', menu: 'false' }, 'the fest list, the menu gone');
      assert.equal(await page.evaluate(() => history.state), null, 'standing on the wall’s entry — the menu’s was taken back first');
      await press(page, 'back');
      await onWall(page);
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, 'one Back: crew A’s wall');
      await press(page, 'forward'); // onto the fest list's entry: crew B, deleted
      await page.waitForSelector('#screen-badlink', { state: 'visible', timeout: 5000 });
      await press(page, 'forward'); // the menu's old entry, if anything: nothing opens
      const ahead = await at(page);
      assert.notEqual(ahead.menu, 'true', `no menu opens over a screen it never belonged to: ${JSON.stringify(ahead)}`);
      await press(page, 'back');
      await onWall(page);
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, 'and Back from there is crew A again, not a press that stays put');
    } finally {
      await ctx.close();
    }
  });

  test(`${name}: a crew opened over the Show menu — Back is the crew before, the next Back leaves, and nothing reopens`, { skip }, async () => {
    const { ctx, page } = await phone(get());
    try {
      await page.goto(`${server.origin}/404.html`); // the page before the app's: where leaving lands
      await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
      await onWall(page);
      await openMenu(page);
      await page.evaluate((u) => { location.hash = u; }, crewUrl(B).slice(1)); // a crew link opened into the tab
      await page.waitForTimeout(400);
      await onWall(page);
      assert.deepEqual(await at(page), { url: crewUrl(B), screen: 'screen-app', menu: 'false' }, 'crew B, the menu gone with A’s wall');
      await press(page, 'back');
      await onWall(page);
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, 'Back: crew A, with no menu reopened');
      await press(page, 'back');
      assert.equal(new URL(page.url()).pathname, '/404.html', `the next Back leaves the app — no phantom step on A: ${page.url()}`);
    } finally {
      await ctx.close();
    }
  });

  test(`${name}: Forward over a menu whose screen went, then Back — neither press sits still for long, and Back never does`, { skip }, async () => {
    const { ctx, page } = await phone(get());
    try {
      await page.goto(`${server.origin}/404.html`);
      await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
      await onWall(page);
      await openMenu(page);
      await page.evaluate((u) => { location.hash = u; }, crewUrl(B).slice(1));
      await page.waitForTimeout(400);
      await onWall(page);
      await press(page, 'back'); // crew A
      await onWall(page);
      await press(page, 'forward'); // the menu's dead entry: A's wall, nothing opens
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, 'the dead entry opens nothing');
      await press(page, 'back'); // not onto the same wall again: out of the app
      assert.equal(new URL(page.url()).pathname, '/404.html', `Back from the dead entry does not stop on the same screen: ${page.url()}`);
    } finally {
      await ctx.close();
    }
  });

  test(`${name}: a refresh, or a boot in place, with the Show menu up — the next Back leaves the wall`, { skip }, async () => {
    for (const how of ['refresh', 'boot']) {
      const { ctx, page } = await phone(get());
      try {
        await page.goto(`${server.origin}/404.html`);
        await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
        await onWall(page);
        await openMenu(page);
        if (how === 'refresh') await page.reload({ waitUntil: 'load' });
        else await page.evaluate(() => import('/js/v3/app.js').then((m) => m.boot()));
        await onWall(page);
        await page.waitForTimeout(400);
        assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, `${how}: the wall, the menu not reopened`);
        await press(page, 'back');
        assert.equal(new URL(page.url()).pathname, '/404.html', `${how}: one Back leaves the wall: ${page.url()}`);
      } finally {
        await ctx.close();
      }
    }
  });

  test(`${name}: the ordinary way — Back closes the menu, Forward opens it again, Back closes it, Back leaves`, { skip }, async () => {
    const { ctx, page } = await phone(get());
    try {
      await page.goto(`${server.origin}/404.html`);
      await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
      await onWall(page);
      await openMenu(page);
      await press(page, 'back');
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' });
      await press(page, 'forward');
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'true' }, 'Forward: the menu again');
      await press(page, 'back');
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' });
      await press(page, 'back');
      assert.equal(new URL(page.url()).pathname, '/404.html', page.url());
    } finally {
      await ctx.close();
    }
  });
}
