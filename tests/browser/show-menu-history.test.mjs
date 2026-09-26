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
// Now a switch that can wait a frame (the 404's fest list, a boot in place,
// a join from the shelf) takes the entry it would leave behind back first;
// every entry is numbered in order (js/v3/nav.js), so a press knows which way
// it went; and an arrival that would change nothing on screen — a menu whose
// screen went, a second wall entry for one address — is passed the same way,
// and only while arrivals change nothing (app.js onPopState). Asserted here
// by where the page is and what it shows after each press, in a real engine
// — the router's model alone once said all was well while the page sat
// still.
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

// `guestOf`: crews this phone opens as a guest (no name on it yet).
async function phone(browser, { guestOf = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([a, b, f, guests]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: a, name: 'Crew A' }, { token: b, name: 'Crew B' }]));
    for (const t of [a, b]) {
      if (!guests.includes(t)) localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    }
    localStorage.setItem('fn_welcome_v1', '1');
  }, [A, B, FID, guestOf]);
  const gone = new Set();
  const docs = {};
  const docOf = (t) => (docs[t] = docs[t] || { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } });
  await ctx.route('**/api/crew**', (route) => {
    const req = route.request();
    const t = new URL(req.url()).searchParams.get('t');
    if (t && gone.has(t)) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Crew not found"}' });
    const doc = docOf(t);
    if (req.method() !== 'GET') {
      // The server merges a write into its copy (a join adds the person).
      const data = (JSON.parse(req.postData() || '{}').data) || {};
      Object.assign(doc.people, data.people || {});
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) });
  });
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/api/person**', (route) => (route.request().method() === 'POST'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'menuhistoryperson_0123456', id: 'pid_menuhistory_01', doc: { v: 1, name: 'Sam', crews: {} } }) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
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
      const st = await page.evaluate(() => history.state);
      assert.ok(st && st.kind === 'wall' && !(st.layers || []).length, `standing on the wall’s entry — the menu’s was taken back first: ${JSON.stringify(st)}`);
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

  test(`${name}: back and forth across a menu whose screen went — every press shows something, and the dead entry is passed both ways`, { skip }, async () => {
    const { ctx, page } = await phone(get());
    try {
      await page.goto(`${server.origin}/404.html`);
      await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
      await onWall(page);
      await openMenu(page);
      await page.evaluate((u) => { location.hash = u; }, crewUrl(B).slice(1));
      await page.waitForTimeout(400);
      await onWall(page);
      const A_WALL = { url: crewUrl(A), screen: 'screen-app', menu: 'false' };
      const B_WALL = { url: crewUrl(B), screen: 'screen-app', menu: 'false' };
      await press(page, 'back');
      await onWall(page);
      assert.deepEqual(await at(page), A_WALL, 'Back: crew A, no menu');
      await press(page, 'back');
      assert.equal(new URL(page.url()).pathname, '/404.html', `Back: out of the app, not onto A again: ${page.url()}`);
      await press(page, 'forward');
      await onWall(page);
      assert.deepEqual(await at(page), A_WALL, 'Forward: crew A');
      await press(page, 'forward');
      await onWall(page);
      assert.deepEqual(await at(page), B_WALL, 'Forward: crew B — the menu’s dead entry passed, nothing reopened on the way');
      await press(page, 'back');
      await onWall(page);
      assert.deepEqual(await at(page), A_WALL, 'Back: crew A again');
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

  // Sol 6's first shape: a guest joins from the shelf, opens the menu, and the
  // crew is deleted on the server. The join used to leave the shelf's entry
  // rewritten as a second wall entry for the same address, so Back from the
  // fest list moved between two wall entries and nothing changed.
  test(`${name}: a guest joins, opens the Show menu, the crew is deleted — Back from the fest list is the crew before`, { skip }, async () => {
    const { ctx, page, gone } = await phone(get(), { guestOf: [B] });
    try {
      await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
      await onWall(page);
      await page.evaluate((u) => { location.hash = u; }, crewUrl(B).slice(1)); // crew B, as a guest
      await page.waitForTimeout(400);
      await onWall(page);
      await page.click('#dock-you'); // the guest's + : the join shelf
      await page.waitForSelector('.join-shelf .js-field', { state: 'visible' });
      await page.fill('.join-shelf .js-field', 'Sam');
      await page.click('.join-shelf .js-go');
      await page.waitForFunction(() => !document.querySelector('.join-shelf'), null, { timeout: 5000 });
      await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => document.getElementById('dock-you').textContent), 'S', 'joined as Sam');
      await page.evaluate(() => { document.getElementById('welcome-card')?.remove(); });
      await openMenu(page);
      gone.add(B);
      await page.evaluate(() => import('/js/sync.js').then((s) => s.pollSync()));
      await page.waitForSelector('#screen-landing', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(300);
      assert.deepEqual(await at(page), { url: crewUrl(B), screen: 'screen-landing', menu: 'false' });
      await press(page, 'back');
      await onWall(page);
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, 'one Back from the fest list: crew A');
    } finally {
      await ctx.close();
    }
  });

  // Sol 6's second shape, the way this model reads it: a boot on a menu entry
  // whose screen went (Back from a crew opened over it), with a REAL entry
  // for the same crew further back — the fest list between two visits. The
  // press passes exactly the one entry that shows nothing (the menu's own
  // wall entry) and stops on the fest list: never further, never short.
  test(`${name}: Back from a boot on a dead menu entry passes only the entry that changes nothing — the fest list between two visits is where it stops`, { skip }, async () => {
    const { ctx, page } = await phone(get());
    try {
      await page.goto(`${server.origin}/404.html`);
      await page.goto(`${server.origin}${crewUrl(A)}`, { waitUntil: 'load' });
      await onWall(page);
      await page.click('#fest-list-btn'); // the fest list, a real entry of its own
      await page.waitForSelector('#screen-landing', { state: 'visible' });
      await page.evaluate((u) => { location.hash = u; }, crewUrl(A).slice(1)); // crew A again, from the list
      await page.waitForTimeout(400);
      await onWall(page);
      await openMenu(page);
      await page.evaluate((u) => { location.hash = u; }, crewUrl(B).slice(1)); // a crew link opened over the menu
      await page.waitForTimeout(400);
      await onWall(page);
      await press(page, 'back'); // onto the menu's dead entry: crew A boots there
      await onWall(page);
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, 'crew A, nothing reopened');
      await press(page, 'back');
      await page.waitForSelector('#screen-landing', { state: 'visible', timeout: 5000 });
      assert.deepEqual(await at(page), { url: '/', screen: 'screen-landing', menu: 'false' }, 'the fest list — one entry passed, no more');
      await press(page, 'back');
      await onWall(page);
      assert.deepEqual(await at(page), { url: crewUrl(A), screen: 'screen-app', menu: 'false' }, 'and the first visit to crew A is still there, a real step');
    } finally {
      await ctx.close();
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
