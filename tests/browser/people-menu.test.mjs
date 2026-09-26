// The people menu with real input (2026-09-26): a finger on a phone, a mouse
// on a laptop, in Chromium and WebKit. The real app, a made-up crew, /api
// answered in the page (writes counted, never sent anywhere).
//
//   the avatar opens HIGHLIGHT on Show's line; a person is a tap, the menu
//   stays open and the wall dims live; a tap outside, the avatar again or
//   Escape put it away; with a highlight on, the slot is the pill — its faces
//   reopen the menu, its ✕ clears; Pick as someone else is two taps; the
//   Invite sheet's Copy, Share and Add; Back does what Back always did; and at
//   320 with NOW live the pill leaves the day you are in and NOW whole.
// The jsdom twin (the rules without a layout engine): tests/people-menu.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: that engine skips */ }
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

const FID = 'portola-2026';
const CREW = 'peoplemenucontract_0123'; // made-up crews, never real links
const OTHER = 'peoplemenucontract_other';
const SAT = new Date('2026-09-26T16:15:00-07:00'); // Portola Saturday, the grid live: NOW is in the day row
const docFor = () => ({
  v: 4, meta: { name: 'Menu Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Ana: { colorIndex: 0 }, Ben: { colorIndex: 1 }, Cy: { colorIndex: 2 }, Dot: { colorIndex: 3 }, Eli: { colorIndex: 4 } },
  festivals: { [FID]: { selections: { Robyn: { Ben: 2, Cy: 3 }, 'Dog Blood': { Cy: 3, Dot: 2 }, Soulwax: { Ana: 1 }, Tricky: { Eli: 2 }, 'Tove Lo': { Ben: 1 } } } },
});

async function openApp(engine, { width = 390, height = 844, guest = false } = {}) {
  const touch = width < 720;
  const ctx = await engine.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && engine === chromium, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' });
  const doc = docFor();
  const posts = [];
  await ctx.addInitScript(([t, o, f, g]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Menu Crew' }, { token: o, name: 'Other' }]));
    for (const x of [t, o]) { if (!g) localStorage.setItem(`fn_me_v3_${x}`, 'Ana'); localStorage.setItem(`fn_crew_fest_v3_${x}`, f); }
    for (const k of ['fn_welcome_v1', 'fn_welcome_joined_v1', 'fn_coach_v1', 'fn_errlog_off_v1']) localStorage.setItem(k, '1');
    // The share sheet, where this engine has none: a stand-in that records.
    window.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.__shared.push(data); } });
  }, [CREW, OTHER, FID, guest]);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/api/crew**', (r) => {
    const req = r.request();
    if (req.method() !== 'GET') {
      posts.push(req.postDataJSON());
      const data = (req.postDataJSON() || {}).data || {};
      Object.assign(doc.people, data.people || {});
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) });
  });
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(SAT);
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
  const phone = touch;
  const bar = phone ? 'dock' : 'rail';
  // Real input: a finger's tap, or a mouse's click, at the middle of the thing.
  const press = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    assert.ok(b, `${sel} is on screen`);
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(350);
  };
  // Outside the menu, far from it: a card on the wall clear of the menu —
  // where a thumb puts a menu away, and where the tap only closes it (the
  // card is not picked). Not beside the menu (a finger's tap is pulled onto
  // the nearest target), and not the empty gutter: WebKit sends no click for
  // a tap on nothing clickable, the iPhone's own rule.
  const outside = async () => {
    const at = await page.evaluate(() => {
      const pop = [...document.querySelectorAll('.hl-pop, .sort-pop')].find((p) => getComputedStyle(p).display !== 'none');
      const x = ((pop ? pop.getBoundingClientRect().right : 0) + innerWidth) / 2;
      const dock = document.getElementById('dock');
      const bottom = (dock && dock.getBoundingClientRect().height ? dock.getBoundingClientRect().top : innerHeight) - 12;
      for (let y = 90; y < bottom; y += 16) {
        const el = document.elementFromPoint(x, y);
        const card = el && el.closest('#wall-root .card');
        if (card && !(pop && pop.contains(el))) return { x, y, artist: card.dataset.artist };
      }
      return null;
    });
    assert.ok(at, 'a card to tap beside the menu');
    if (phone) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await sleep(450);
    return at.artist;
  };
  return { ctx, page, errors, posts, phone, bar, press, outside, width };
}

const wrapSel = (bar) => `#${bar}-you-wrap`;
const menuState = (page, bar) => page.evaluate((b) => {
  const pop = document.querySelector(`#${b}-you-wrap .hl-pop`);
  const wrap = document.getElementById(`${b}-you-wrap`);
  return {
    open: !!pop && getComputedStyle(pop).display !== 'none',
    slot: wrap.dataset.slot,
    faces: [...wrap.querySelectorAll('.hl-pill .hl-faces .avatar')].map((a) => a.dataset.name || a.textContent),
    selected: pop ? [...pop.querySelectorAll('[data-person][aria-selected="true"]')].map((x) => x.dataset.person) : [],
    dim: document.querySelectorAll('#wall-root .card.dim').length,
    stored: (() => { try { return JSON.parse(sessionStorage.getItem('fn_filter_people_v1_portola-2026') || '[]'); } catch { return 'blocked'; } })(),
    len: history.length,
  };
}, bar);

const ENGINES = [
  ['Chromium 390 touch', () => chromium, 390],
  ['WebKit 390 touch', () => webkit, 390],
  ['Chromium 320 touch', () => chromium, 320],
  ['Chromium 1280 mouse', () => chromium, 1280],
];
for (const [name, get, width] of ENGINES) {
  const skip = get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER);

  test(`${name}: the avatar opens Highlight on Show's line; taps highlight live and keep it open; outside closes into the pill; the faces reopen, the avatar closes; the ✕ clears`, { skip }, async () => {
    const { ctx, page, errors, posts, phone, bar, press, outside } = await openApp(get(), { width });
    try {
      const w = wrapSel(bar);
      const len0 = (await menuState(page, bar)).len;
      await press(`#${bar}-you`);
      let s = await menuState(page, bar);
      assert.equal(s.open, true, 'the menu opened');
      assert.deepEqual(s.selected, [''], 'Everyone ✓');
      // Geometry: the mirror of Show — its near edge on the avatar's, its far edge on Show's line.
      const hl = await page.locator(`${w} .hl-pop`).boundingBox();
      const you = await page.locator(`#${bar}-you`).boundingBox();
      assert.ok(Math.abs(hl.x - you.x) < 0.6, `left edge on the avatar's left edge (${hl.x} / ${you.x})`);
      const rows = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .hl-pop [data-person]`)].map((b) => b.getBoundingClientRect().height), w);
      if (phone) assert.ok(rows.every((h) => h >= 43.5), `every row a 44px target on a phone (${rows})`);
      await press(`#${bar}-fest-link`);
      const show = await page.locator(`#${bar}-fest-wrap .sort-pop`).boundingBox();
      assert.equal((await menuState(page, bar)).open, false, 'Show put Highlight away: one menu at a time');
      if (phone) assert.ok(Math.abs((hl.y + hl.height) - (show.y + show.height)) < 0.6, `the bottoms on one line (${hl.y + hl.height} / ${show.y + show.height})`);
      else assert.ok(Math.abs(hl.y - show.y) < 0.6, `the tops on one line (${hl.y} / ${show.y})`);
      await press(`#${bar}-fest-link`); // Show away
      // Multi-select, live.
      await press(`#${bar}-you`);
      await press(`${w} .hl-pop [data-person="Ben"]`);
      s = await menuState(page, bar);
      assert.equal(s.open, true, 'still open after a person');
      assert.deepEqual(s.selected, ['Ben']);
      assert.ok(s.dim > 0, 'the wall dimmed behind it');
      await press(`${w} .hl-pop [data-person="Cy"]`);
      s = await menuState(page, bar);
      assert.deepEqual([s.open, s.selected, s.stored], [true, ['Ben', 'Cy'], ['Ben', 'Cy']], 'two, combined, kept in this tab');
      // Outside: the menu goes and the slot is the pill.
      await outside();
      s = await menuState(page, bar);
      assert.deepEqual([s.open, s.slot, s.faces], [false, 'pill', ['Ben', 'Cy']], `outside closed it into the pill: ${JSON.stringify(s)}`);
      assert.ok(await page.locator(`${w} .hl-pill`).isVisible(), 'the pill is on screen');
      assert.equal(await page.locator(`#${bar}-you`).isVisible(), false, 'in the avatar’s place');
      // The faces reopen; the avatar closes.
      await press(`${w} .hl-faces`);
      s = await menuState(page, bar);
      assert.deepEqual([s.open, s.slot, s.selected], [true, 'avatar', ['Ben', 'Cy']], 'the faces reopened it');
      await press(`#${bar}-you`);
      s = await menuState(page, bar);
      assert.deepEqual([s.open, s.slot], [false, 'pill'], 'the avatar again put it away');
      // Escape too.
      await press(`${w} .hl-faces`);
      await page.keyboard.press('Escape');
      await sleep(400);
      assert.equal((await menuState(page, bar)).open, false, 'Escape');
      // The ✕: one tap, from anywhere.
      await page.evaluate(() => window.scrollBy(0, 1400));
      await sleep(400);
      await press(`${w} .hl-x`);
      s = await menuState(page, bar);
      assert.deepEqual([s.open, s.slot, s.dim, s.stored], [false, 'avatar', 0, []], `the ✕ cleared it: ${JSON.stringify(s)}`);
      assert.ok(await page.locator(`#${bar}-you`).isVisible(), 'your avatar back');
      assert.equal(s.len, len0, 'not one history entry, through all of it');
      assert.equal(posts.length, 0, 'and nothing sent: a highlight is this tab’s own');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name} 390: Pick as someone else → the claim step, two taps; your own chip chooses nobody`, { skip }, async () => {
    const { ctx, page, errors, posts, press } = await openApp(get(), { width: 390 });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="pick-as"]');
      await page.waitForSelector('.join-shelf', { timeout: 3000 });
      await sleep(500); // risen
      assert.equal(await page.locator('#dock-you-wrap .hl-pop').isVisible(), false, 'the menu went');
      assert.equal(await page.locator('.join-shelf .js-sub').textContent(), 'Tap a name, then confirm.');
      await press('.join-shelf .js-name[data-name="Ana"]');
      assert.equal(await page.locator('.join-shelf .js-go').isDisabled(), true, 'your own chip: nobody chosen');
      await press('.join-shelf .js-name[data-name="Ben"]');
      assert.equal(await page.locator('.join-shelf .js-go').textContent(), 'I’m Ben');
      assert.equal(await page.evaluate((t) => localStorage.getItem(`fn_me_v3_${t}`), CREW), 'Ana', 'one tap switches nobody');
      await press('.join-shelf .js-go');
      await page.waitForFunction(() => !document.querySelector('.join-shelf'), null, { timeout: 3000 });
      assert.equal(await page.evaluate((t) => localStorage.getItem(`fn_me_v3_${t}`), CREW), 'Ben', 'the second tap does');
      await page.waitForFunction(() => document.getElementById('dock-you').textContent === 'B', null, { timeout: 3000 });
      assert.equal(posts.length, 0, 'nothing sent');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name} 390: + Invite someone — the crew link first; Copy, Share, then Add by name ends on their own link`, { skip }, async () => {
    const { ctx, page, errors, posts, press } = await openApp(get(), { width: 390 });
    try {
      if (name === 'Chromium') await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.origin });
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet', { timeout: 3000 });
      await sleep(300);
      const link = await page.locator('.invite-sheet .inv-link input').inputValue();
      assert.match(link, new RegExp(`/f/${FID}#g=${CREW}`), 'the crew link, printed, its festival in the path');
      await press('.invite-sheet .inv-copy');
      if (name === 'Chromium') {
        assert.equal(await page.locator('.invite-sheet .inv-copy').textContent(), 'Copied ✓');
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link, 'the link on the clipboard');
      }
      await press('.invite-sheet .inv-share');
      const shared = await page.evaluate(() => window.__shared);
      assert.equal(shared.length, 1, 'the share sheet was asked');
      assert.equal(shared[0].url, link, 'with the crew link');
      await press('.invite-sheet .inv-name input');
      await page.keyboard.type('Zed');
      await press('.invite-sheet .inv-add');
      await page.waitForFunction(() => /ZED IS IN/.test(document.querySelector('.invite-sheet .sheet-title')?.textContent || ''), null, { timeout: 4000 });
      assert.equal(posts.length, 1, 'one request: the server heard it first');
      assert.ok(posts[0].data.people.Zed, 'with Zed');
      assert.match(await page.locator('.invite-sheet .inv-link input').inputValue(), /me=Zed/, 'his own link');
      await press('.invite-sheet .inv-done');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet'), null, { timeout: 3000 });
      await press('#dock-you');
      assert.equal(await page.locator('#dock-you-wrap .hl-pop [data-person="Zed"]').count(), 1, 'and Zed is in the menu');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name} 390: a guest's + opens the same menu, and Join the crew raises the shelf`, { skip }, async () => {
    const { ctx, page, errors, posts, press } = await openApp(get(), { width: 390, guest: true });
    try {
      assert.equal(await page.locator('#dock-you').textContent(), '+');
      await press('#dock-you');
      assert.equal(await page.locator('#dock-you-wrap .hl-pop').isVisible(), true);
      assert.deepEqual(await page.locator('#dock-you-wrap .hl-pop [data-act]').evaluateAll((l) => l.map((b) => b.dataset.act)), ['join']);
      await press('#dock-you-wrap .hl-pop [data-person="Dot"]');
      assert.ok(await page.locator('#wall-root .card.dim').count() > 0, 'a guest can highlight: it writes nothing');
      await press('#dock-you-wrap .hl-pop [data-act="join"]');
      await page.waitForSelector('.join-shelf', { timeout: 3000 });
      assert.equal(await page.locator('.join-shelf .js-line').textContent(), 'Pick shows as…');
      assert.equal(posts.length, 0, 'a guest wrote nothing');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('Chromium 390: Back with the menu up does what Back always did — the crew before — and leaves no menu and no busy flag', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors, press } = await openApp(chromium, { width: 390 });
  try {
    // A second crew in this tab's history (the Show menu's contract does the same).
    await page.evaluate((o) => { location.hash = `#g=${o}`; }, OTHER);
    await sleep(600);
    await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 10000 });
    const len = await page.evaluate(() => history.length);
    await press('#dock-you');
    await press('#dock-you-wrap .hl-pop [data-person="Ben"]');
    assert.equal(await page.evaluate(() => document.body.dataset.busy), 'show-menu', 'it holds a new build’s reload while it is up');
    assert.equal(await page.evaluate(() => history.length), len, 'no entry of its own');
    await page.evaluate(() => history.back());
    await sleep(900);
    await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 10000 });
    const after = await page.evaluate(() => ({ hash: location.hash, busy: document.body.dataset.busy || null, open: getComputedStyle(document.querySelector('#dock-you-wrap .hl-pop') || document.body).display }));
    assert.match(after.hash, new RegExp(`g=${CREW}`), `one Back: the crew before (${after.hash})`);
    assert.equal(after.busy, null, 'no busy flag left behind');
    assert.equal(after.open, 'none', 'no menu left behind');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('Chromium 320, NOW live: four highlighted — the pill leaves the day you are in and NOW whole in the day row', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors, press, outside } = await openApp(chromium, { width: 320 });
  try {
    await press('#dock-you');
    for (const n of ['Ben', 'Cy', 'Dot', 'Eli']) await press(`#dock-you-wrap .hl-pop [data-person="${n}"]`);
    await outside();
    await sleep(600); // the row comes to rest
    const r = await page.evaluate(() => {
      const box = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.right]; };
      const row = document.getElementById('dock-days');
      const active = row.querySelector('.day-tab.active');
      const now = document.getElementById('dock-now');
      return { row: box(row), active: active && box(active), day: active && active.dataset.day, now: now.hidden ? null : box(now), pill: box(document.querySelector('#dock-you-wrap .hl-pill')), discs: document.querySelectorAll('#dock-you-wrap .hl-faces .avatar').length, fest: box(document.getElementById('dock-fest-link')) };
    });
    assert.ok(r.now, 'NOW is live');
    const inside = (x) => x[0] >= r.row[0] - 1 && x[1] <= r.row[1] + 1;
    assert.ok(inside(r.active), `the day you are in, whole: ${JSON.stringify(r)}`);
    assert.ok(inside(r.now), `NOW, whole: ${JSON.stringify(r)}`);
    assert.ok(r.pill[1] <= r.row[0] && r.row[1] <= r.fest[0], `in a row, no overlap: ${JSON.stringify(r)}`);
    assert.ok(r.discs < 3, `the pill gave the row its room (${r.discs} discs for four people)`);
    // The pill is as wide as people-menu.js pillWidth says (the fit is computed from it).
    const { pillWidth } = await import('../../js/v3/people-menu.js');
    assert.ok(Math.abs((r.pill[1] - r.pill[0]) - pillWidth(r.discs)) < 1, `pillWidth(${r.discs}) matches the drawn pill (${r.pill[1] - r.pill[0]})`);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('the phone top has no people row and the search field starts on the gutter; the laptop keeps its row', { skip: chromium ? false : NO_BROWSER }, async () => {
  for (const width of [390, 1280]) {
    const { ctx, page, errors } = await openApp(chromium, { width, height: width >= 720 ? 900 : 844 });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      const r = await page.evaluate(() => ({
        chips: getComputedStyle(document.getElementById('person-chips')).display,
        divider: getComputedStyle(document.querySelector('.toolbar .toolbar-divider')).display,
        search: document.querySelector('.toolbar .search-pill').getBoundingClientRect().left,
        head: document.querySelector('.app-header .back-btn').getBoundingClientRect().left,
        gutter: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-gutter')) || null,
      }));
      if (width < 720) {
        assert.deepEqual([r.chips, r.divider], ['none', 'none'], '390: no people row (design §4)');
        assert.ok(r.search <= 16.5, `390: the search field on the left gutter (${r.search})`);
      } else {
        assert.notEqual(r.chips, 'none', '1280: the people row stays (default 3)');
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
});

// A tap on nothing — the time rail, a gutter — closes either menu, WebKit
// included: WebKit sends a tap's click only where something listens, and
// both menus' outside tap is a document listener (app.js catchStrayTaps).
for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  test(`${name} 390: a tap on the wall's empty space closes Highlight and Show alike`, { skip: get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER) }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390 });
    try {
      for (const [door, wrap, spot] of [['#dock-you', '#dock-you-wrap', 'right'], ['#dock-fest-link', '#dock-fest-wrap', 'left']]) {
        await press(door);
        assert.equal(await page.locator(`${wrap} .sort-pop`).isVisible(), true, `${door} opened its menu`);
        // Nothing clickable under the finger, far from the menu.
        const at = await page.evaluate((side) => {
          const x = side === 'left' ? 6 : innerWidth - 4;
          for (let y = 120; y < innerHeight - 90; y += 12) {
            const el = document.elementFromPoint(x, y);
            if (el && !el.closest('button, a, input, .card, [role="button"], .sort-pop, .dock')) return { x, y, el: `${el.tagName}.${el.className}` };
          }
          return null;
        }, spot);
        assert.ok(at, 'an empty spot to tap');
        await page.touchscreen.tap(at.x, at.y);
        await sleep(450);
        assert.equal(await page.locator(`${wrap} .sort-pop`).isVisible(), false, `${door}: a tap on ${at.el} put it away`);
        assert.equal(await page.evaluate(() => document.getElementById('screen-app').classList.contains('menu-open')), false, 'and the wall stopped listening');
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
