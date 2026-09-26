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
import { pillWidth } from '../../js/v3/people-menu.js';

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

// `wide`: every glyph in the dock drawn this much wider than this engine
// draws it — a stand-in for Linux and Android, whose Inter and Anton are wider
// than a Mac's (CI put the 320 pill at one disc where the Mac fit two,
// 2026-09-26). now-jump's trick, aimed at the same dock.
async function openApp(engine, { width = 390, height = 844, guest = false, wide = null, fid = FID, now = SAT } = {}) {
  const touch = width < 720;
  const ctx = await engine.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && engine === chromium, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' });
  const doc = docFor();
  if (fid !== FID) doc.festivals[fid] = { selections: { Turnstile: { Ben: 2, Cy: 3 } } };
  const posts = [];
  if (wide) {
    await ctx.addInitScript((w) => {
      const css = `.dock .day-tab, .dock .now-tab .word { letter-spacing: ${w} !important; }
        .dock .fest-name { letter-spacing: calc(.04em + ${w}) !important; }`;
      const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };
      if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
    }, wide);
  }
  await ctx.addInitScript(([t, o, f, g]) => {
    // The worker is blocked here; the page's new-build check still asks it to update.
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Menu Crew' }, { token: o, name: 'Other' }]));
    for (const x of [t, o]) { if (!g) localStorage.setItem(`fn_me_v3_${x}`, 'Ana'); localStorage.setItem(`fn_crew_fest_v3_${x}`, f); }
    for (const k of ['fn_welcome_v1', 'fn_welcome_joined_v1', 'fn_coach_v1', 'fn_errlog_off_v1']) localStorage.setItem(k, '1');
    // The share sheet, where this engine has none: a stand-in that records.
    window.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.__shared.push(data); } });
  }, [CREW, OTHER, fid, guest]);
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
  await page.clock.setFixedTime(now);
  await page.goto(`${server.origin}/#g=${CREW}&f=${fid}`, { waitUntil: 'load' });
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
    // Wait for the menu to have gone, not a fixed time: on a loaded Linux
    // runner WebKit's close had not landed 450 ms after the tap (CI run
    // 36263155410, 2026-09-26; 4/4 locally). The pill's motion then settles.
    await page.waitForFunction(() => ![...document.querySelectorAll('.hl-pop, .sort-pop')].some((p) => getComputedStyle(p).display !== 'none'), null, { timeout: 4000 }).catch(() => {});
    await sleep(250);
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

// The pill's promise, read off the page — never a Mac's disc count (CI's
// Linux draws Inter wider and fit one disc at 320 where the Mac fit two,
// 2026-09-26). What must hold at any glyph width (app.js pillCap):
//   a. the discs and the +n add up to the people highlighted, faces in the crew's order;
//   b. the day you are in is whole in the day row;
//   c. while NOW is live, NOW and the day it follows are whole too — wherever
//      they fit beside the bare avatar (the pill folds to the avatar's size
//      before it would take their room; where they do not fit even then, the
//      pill is not what pushed them out);
//   d. one to three discs, and a ✕ unless folded.
const pillRead = (page) => page.evaluate(() => {
  const row = document.getElementById('dock-days');
  const wrap = document.getElementById('dock-you-wrap');
  const edges = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.right]; };
  const tabs = [...row.children].filter((t) => !t.hidden);
  const active = tabs.find((t) => t.classList.contains('day-tab') && t.classList.contains('active')) || null;
  const nowAt = tabs.findIndex((t) => t.classList.contains('now-tab'));
  const now = nowAt >= 0 ? tabs[nowAt] : null;
  const live = nowAt > 0 ? tabs[nowAt - 1] : null;
  const span = (list) => (list.length ? Math.max(...list.map((t) => t.offsetLeft + t.offsetWidth)) - Math.min(...list.map((t) => t.offsetLeft)) : 0);
  const discs = [...wrap.querySelectorAll('.hl-pill .hl-faces .avatar')];
  return {
    slot: wrap.dataset.slot,
    named: discs.filter((a) => a.dataset.name).map((a) => a.dataset.name),
    count: discs.reduce((n, a) => n + (a.dataset.name ? 1 : Number(a.textContent.replace('+', ''))), 0),
    discs: discs.length,
    compact: wrap.querySelector('.hl-pill').hasAttribute('data-compact'),
    x: getComputedStyle(wrap.querySelector('.hl-pill .hl-x')).display !== 'none',
    row: edges(row), active: active && edges(active), now: now && edges(now), live: live && edges(live),
    room: row.clientWidth + wrap.getBoundingClientRect().width,
    focus: span([active, now, live].filter(Boolean)),
    activeW: active ? active.offsetWidth : 0,
    pill: wrap.querySelector('.hl-pill').getBoundingClientRect().width,
  };
});
const BARE = pillWidth(0); // the avatar's width, and the folded pill's
// "Whole" is the day row's own word (wall.js restingLeft): a pixel of slack
// in whole-pixel layout positions, so up to about two in the rects read here.
function assertPillPromise(r, people, label) {
  const whole = (x) => !!x && x[0] >= r.row[0] - 2 && x[1] <= r.row[1] + 2;
  assert.equal(r.slot, 'pill', `${label}: the slot is the pill`);
  assert.equal(r.count, people.length, `${label}: the discs and the +n add up to ${people.length} (${JSON.stringify(r)})`);
  assert.deepEqual(r.named, people.slice(0, r.named.length), `${label}: the faces are the first of the highlighted, in the crew's order`);
  assert.ok(r.discs >= 1 && r.discs <= 3, `${label}: one to three discs (${r.discs})`);
  assert.equal(r.x, !r.compact, `${label}: a ✕ unless folded`);
  if (r.activeW <= r.room - BARE) assert.ok(whole(r.active), `${label}: the day you are in is whole (${JSON.stringify(r)})`);
  if (r.now && r.focus <= r.room - BARE) {
    assert.ok(whole(r.now) && whole(r.live), `${label}: NOW and its day are whole (${JSON.stringify(r)})`);
  }
}
// And it uses the room it has: one disc more would break the promise (the
// refit's reason to exist; pillWidth is held to the drawn pill below).
async function assertPillFull(r, people, label) {
  const need = r.now ? r.focus : r.activeW;
  if (r.compact) {
    assert.ok(pillWidth(1) + need > r.room, `${label}: folded where one disc and its ✕ would fit (${JSON.stringify(r)})`);
    return;
  }
  if (r.discs >= Math.min(3, people.length)) return;
  assert.ok(pillWidth(r.discs + 1) + need > r.room, `${label}: ${r.discs} disc(s) where ${r.discs + 1} would fit (${JSON.stringify(r)})`);
}

const ENGINES = [
  ['Chromium 390 touch', () => chromium, 390],
  ['WebKit 390 touch', () => webkit, 390],
  ['Chromium 320 touch', () => chromium, 320],
  // Linux / Android widths: the Mac draws Inter narrower than CI does.
  ['Chromium 320 touch, wide glyphs', () => chromium, 320, '0.7px'],
  ['Chromium 1280 mouse', () => chromium, 1280],
];
for (const [name, get, width, wide = null] of ENGINES) {
  const skip = get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER);

  test(`${name}: the avatar opens Highlight on Show's line; taps highlight live and keep it open; outside closes into the pill; the faces reopen, the avatar closes; the ✕ clears`, { skip }, async () => {
    const { ctx, page, errors, posts, phone, bar, press, outside } = await openApp(get(), { width, wide });
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
      assert.deepEqual([s.open, s.slot], [false, 'pill'], `outside closed it into the pill: ${JSON.stringify(s)}`);
      if (phone) assertPillPromise(await pillRead(page), ['Ben', 'Cy'], `${width}${wide ? ' wide' : ''}`);
      else assert.deepEqual(s.faces, ['Ben', 'Cy'], 'the rail has room for both faces');
      assert.ok(await page.locator(`${w} .hl-pill`).isVisible(), 'the pill is on screen');
      assert.equal(await page.locator(`#${bar}-you`).isVisible(), false, 'in the avatar’s place');
      // The faces reopen; the avatar closes.
      await press(`${w} .hl-faces`);
      s = await menuState(page, bar);
      assert.deepEqual([s.open, s.slot, s.selected], [true, 'avatar', ['Ben', 'Cy']], 'the faces reopened it');
      await press(`#${bar}-you`);
      // Wait for the close to land, not press's fixed beat: Linux WebKit under
      // load read the menu still open (CI runs on PR #60, 2026-09-26).
      await page.waitForFunction((b) => { const p = document.querySelector(`#${b}-you-wrap .hl-pop`); return !p || getComputedStyle(p).display === 'none'; }, bar, { timeout: 4000 }).catch(() => {});
      s = await menuState(page, bar);
      assert.deepEqual([s.open, s.slot], [false, 'pill'], 'the avatar again put it away');
      // Escape too.
      await press(`${w} .hl-faces`);
      await page.keyboard.press('Escape');
      await sleep(400);
      assert.equal((await menuState(page, bar)).open, false, 'Escape');
      // The ✕: one tap, from anywhere — or, where the pill has folded to the
      // avatar's size for want of room (Linux's glyphs at 320), Everyone in
      // the menu the faces open.
      await page.evaluate(() => window.scrollBy(0, 1400));
      await sleep(400);
      if (await page.evaluate((sel) => document.querySelector(`${sel} .hl-pill`).hasAttribute('data-compact'), w)) {
        await press(`${w} .hl-faces`);
        await press(`${w} .hl-pop [data-person=""]`);
        await press(`#${bar}-you`);
      } else await press(`${w} .hl-x`);
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

  test(`${name} 390: + Invite someone — the crew link first; Copy, Share, then Or add a friend ends on their own link`, { skip }, async () => {
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
      assert.equal(await page.locator('.invite-sheet .inv-section .micro-label').first().textContent(), 'Or add a friend', 'a peer of the link');
      await press('.invite-sheet .inv-name input');
      await page.keyboard.type('Zed');
      await press('.invite-sheet .inv-add');
      await page.waitForFunction(() => /ZED IS IN/.test(document.querySelector('.invite-sheet .sheet-title')?.textContent || ''), null, { timeout: 4000 });
      assert.equal(posts.length, 1, 'one request: the server heard it first');
      assert.ok(posts[0].data.people.Zed, 'with Zed');
      assert.match(await page.locator('.invite-sheet .inv-link input').inputValue(), /me=Zed/, 'his own link');
      assert.equal(await page.locator('.invite-sheet .inv-sub').first().textContent(), 'If Zed ever wants to pick, send this link. Opening it makes the picks theirs.', 'done as it stands; the link is an if-ever');
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

for (const wide of [null, '0.7px']) {
  test(`Chromium 320${wide ? ', wide glyphs' : ''}, NOW live: four highlighted — the pill keeps the day you are in and NOW whole, and is as wide as pillWidth says`, { skip: chromium ? false : NO_BROWSER }, async () => {
    const { ctx, page, errors, press, outside } = await openApp(chromium, { width: 320, wide });
    const four = ['Ben', 'Cy', 'Dot', 'Eli'];
    try {
      await press('#dock-you');
      for (const n of four) await press(`#dock-you-wrap .hl-pop [data-person="${n}"]`);
      await outside();
      await sleep(600); // the row comes to rest
      const r = await pillRead(page);
      assert.ok(r.now, 'NOW is live');
      assertPillPromise(r, four, `320${wide ? ' wide' : ''}`);
      await assertPillFull(r, four, `320${wide ? ' wide' : ''}`);
      const fest = await page.evaluate(() => document.getElementById('dock-fest-link').getBoundingClientRect().left);
      assert.ok(r.row[1] <= fest + 0.5, `the day row stops before the fest name (${r.row[1]} / ${fest})`);
      // The fit is computed from pillWidth: it must be the pill as drawn.
      assert.ok(Math.abs(r.pill - pillWidth(r.compact ? 0 : r.discs)) < 1, `pillWidth matches the drawn pill (${r.pill}, ${r.compact ? 'folded' : `${r.discs} discs`})`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('the phone top has no people row and the search field starts on the gutter; the laptop keeps its row, parted from the field by space — no line in the header at any width', { skip: chromium ? false : NO_BROWSER }, async () => {
  for (const width of [390, 900, 1280]) {
    const { ctx, page, errors } = await openApp(chromium, { width, height: width >= 720 ? 900 : 844 });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      const r = await page.evaluate(() => ({
        chips: getComputedStyle(document.getElementById('person-chips')).display,
        chipsBox: (() => { const b = document.getElementById('person-chips').getBoundingClientRect(); return { right: b.right, top: b.top }; })(),
        // Kevin, 2026-09-26: "in the header we don't need these lines".
        divider: !!document.querySelector('.toolbar-divider'),
        rail: getComputedStyle(document.getElementById('day-rail')).borderBottomWidth,
        search: document.querySelector('.toolbar .search-pill').getBoundingClientRect().left,
        searchTop: document.querySelector('.toolbar .search-pill').getBoundingClientRect().top,
        head: document.querySelector('.app-header .back-btn').getBoundingClientRect().left,
        gutter: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-gutter')) || null,
      }));
      assert.equal(r.divider, false, `${width}: no divider stub before the search field`);
      if (width < 720) {
        assert.equal(r.chips, 'none', '390: no people row (design §4)');
        assert.ok(r.search <= 16.5, `390: the search field on the left gutter (${r.search})`);
      } else {
        assert.notEqual(r.chips, 'none', `${width}: the people row stays (default 3)`);
        assert.equal(r.rail, '0px', `${width}: no hairline under the rail`);
        // Sharing a line, the row and the field are two groups: 18px of space
        // (the toolbar's 6 + the row's 12), three times the chips' own gap.
        if (Math.abs(r.searchTop - r.chipsBox.top) < 12) {
          assert.ok(Math.abs(r.search - r.chipsBox.right - 18) < 1.5, `${width}: 18px between the people row and the field (${r.search - r.chipsBox.right})`);
        }
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

// A menu on its way out takes no taps (Codex's review of a1612a0): its rows
// stayed live through the 130 ms fade, so a quick second tap where a row had
// been still moved a highlight — or, in Show, a room — after it had closed.
test('Chromium 390: a tap on a row while its menu fades out does nothing — Highlight and Show alike', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors, press } = await openApp(chromium, { width: 390 });
  try {
    // Highlight: close by the avatar, then at once a tap where Ben's row was.
    await press('#dock-you');
    const ben = await page.locator('#dock-you-wrap .hl-pop [data-person="Ben"]').boundingBox();
    const you = await page.locator('#dock-you').boundingBox();
    await page.touchscreen.tap(you.x + you.width / 2, you.y + you.height / 2);
    await page.touchscreen.tap(ben.x + ben.width / 2, ben.y + ben.height / 2);
    await sleep(500);
    const hl = await menuState(page, 'dock');
    assert.deepEqual([hl.open, hl.stored, hl.dim], [false, [], 0], `nothing highlighted by the fading menu: ${JSON.stringify(hl)}`);
    // Show: the same with a room row.
    await press('#dock-fest-link');
    const row = await page.locator('#dock-fest-wrap .sort-pop [data-room]').first().boundingBox();
    const room = await page.locator('#dock-fest-wrap .sort-pop [data-room]').first().getAttribute('data-room');
    const fest = await page.locator('#dock-fest-link').boundingBox();
    await page.touchscreen.tap(fest.x + fest.width / 2, fest.y + fest.height / 2);
    await page.touchscreen.tap(row.x + row.width / 2, row.y + row.height / 2);
    await sleep(500);
    const folded = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('fn_fold_v1_portola-2026') || '[]'); } catch { return 'blocked'; } });
    assert.deepEqual(folded, [], `no room folded by the fading Show menu (${room})`);
    // And a reopened menu takes taps again.
    await press('#dock-you');
    await press('#dock-you-wrap .hl-pop [data-person="Ben"]');
    assert.deepEqual((await menuState(page, 'dock')).stored, ['Ben'], 'reopened, its rows work');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// The pill refits when the day row changes under it (Codex's review of
// a1612a0): at 320 with NOW live four people take fewer discs; when NOW
// leaves (the festival over, the page shown again) the row has more room, and
// the pill takes it — at the Mac's glyph widths and at Linux's.
for (const wide of [null, '0.7px']) {
  test(`Chromium 320${wide ? ', wide glyphs' : ''}: the pill refits when NOW leaves the day row — never fewer discs for more room, and all the room it has`, { skip: chromium ? false : NO_BROWSER }, async () => {
    const { ctx, page, errors, press, outside } = await openApp(chromium, { width: 320, wide });
    const four = ['Ben', 'Cy', 'Dot', 'Eli'];
    const label = (w) => `${w}${wide ? ' (wide)' : ''}`;
    try {
      await press('#dock-you');
      for (const n of four) await press(`#dock-you-wrap .hl-pop [data-person="${n}"]`);
      await outside();
      await sleep(500);
      const live = await pillRead(page);
      assert.ok(live.now, 'NOW is live');
      assertPillPromise(live, four, label('NOW live'));
      await assertPillFull(live, four, label('NOW live'));
      await page.clock.setFixedTime(new Date('2026-09-29T12:00:00-07:00')); // Tuesday: nothing live
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // the page shown again: the clock is read
      await page.waitForFunction(() => document.getElementById('dock-now').hidden, null, { timeout: 5000 });
      await sleep(600);
      const gone = await pillRead(page);
      assert.equal(gone.now, null, 'NOW has left the row');
      assertPillPromise(gone, four, label('NOW gone'));
      const size = (r) => (r.compact ? 0 : r.discs); // folded is the smallest
      assert.ok(size(gone) >= size(live), `more room never yields fewer discs (${size(live)} → ${size(gone)})`);
      await assertPillFull(gone, four, label('NOW gone'));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// More room never yields fewer discs (the rule has no cliffs): four people
// highlighted with NOW live, the phone widened step by step — Portola and
// ACL's long name, at the Mac's glyph widths and at Linux's. Before the rule
// asked for NOW's room whenever NOW was live, ACL showed two discs at 320 and
// one at 360. Each step is a real resize (the pill refits on it).
for (const [fest, fid, now] of [['Portola', FID, SAT], ['ACL', 'acl-2026', new Date('2026-10-03T20:00:00-05:00')]]) {
  for (const wide of [null, '0.7px']) {
    test(`Chromium, ${fest}${wide ? ', wide glyphs' : ''}: widening the phone from 320 to 430 never takes a disc away, and the promise holds at every width`, { skip: chromium ? false : NO_BROWSER }, async () => {
      const { ctx, page, errors, press, outside } = await openApp(chromium, { width: 320, wide, fid, now });
      const four = fid === FID ? ['Ben', 'Cy', 'Dot', 'Eli'] : ['Ben', 'Cy', 'Dot', 'Eli'];
      try {
        await press('#dock-you');
        for (const n of four) await press(`#dock-you-wrap .hl-pop [data-person="${n}"]`);
        await outside();
        await sleep(500);
        let last = 0;
        const seen = [];
        for (const width of [320, 340, 360, 375, 390, 412, 430]) {
          await page.setViewportSize({ width, height: 844 });
          await sleep(700); // the resize refit (160 ms) and the row at rest
          const r = await pillRead(page);
          seen.push(`${width}:${r.compact ? 'folded' : r.discs}`);
          assert.ok(Math.abs(r.pill - pillWidth(r.compact ? 0 : r.discs)) < 1, `${width}: pillWidth matches the drawn pill (${r.pill})`);
          assertPillPromise(r, four, `${fest} ${width}${wide ? ' wide' : ''}`);
          await assertPillFull(r, four, `${fest} ${width}${wide ? ' wide' : ''}`);
          const size = r.compact ? 0 : r.discs; // folded is the smallest
          assert.ok(size >= last, `more room, never fewer discs: ${seen.join(' ')}`);
          last = size;
        }
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
}
