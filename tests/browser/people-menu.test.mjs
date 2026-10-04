// The people menu with real input (2026-09-26): a finger on a phone, a mouse
// on a laptop, in Chromium and WebKit. The real app, a made-up crew, /api
// answered in the page (writes counted, never sent anywhere).
//
//   the avatar opens HIGHLIGHT on Show's line; a person is a tap, the menu
//   stays open and the wall dims live; a tap outside, the avatar again or
//   Escape put it away; with a highlight on, the slot is the pill — its faces
//   reopen the menu, its ✕ clears; Pick as someone else is two taps; the
//   Invite sheet's Copy and Share, its quiet Pick for a friend row and the
//   step it opens (a step, not a layer: it travels in, its ‹ travels back,
//   and Back still closes the sheet), and Add; Back does what Back always did; and at
//   320 with NOW live the pill leaves the day you are in and NOW whole.
// The jsdom twin (the rules without a layout engine): tests/people-menu.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER, waitForAsync } from '../helpers/browser.mjs';
import { pillWidth } from '../../js/v3/people-menu.js';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

const FID = 'portola-2026';
const STEP_SETTLE_MS = 350; // app.js: how long a step that just arrived holds its taps
const CREW = 'peoplemenucontract_0123'; // made-up crews, never real links
const OTHER = 'peoplemenucontract_other';
const SAT = new Date('2026-09-26T16:15:00-07:00'); // Portola Saturday, the grid live: NOW is in the day row
// The other crew (`others`): Ana, and two people this crew does not have.
const OTHER_DOC = { v: 4, meta: { name: 'Other' }, spotify: {}, affinity: {}, people: { Ana: { colorIndex: 0 }, Drew: { colorIndex: 6 }, Kat: { colorIndex: 7 } }, festivals: {} };
const docFor = () => ({
  v: 4, meta: { name: 'Menu Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Ana: { colorIndex: 0 }, Ben: { colorIndex: 1 }, Cy: { colorIndex: 2 }, Dot: { colorIndex: 3 }, Eli: { colorIndex: 4 } },
  festivals: { [FID]: { selections: { Robyn: { Ben: 2, Cy: 3 }, 'Dog Blood': { Cy: 3, Dot: 2 }, Soulwax: { Ana: 1 }, Tricky: { Eli: 2 }, 'Tove Lo': { Ben: 1 } } } },
});

// `wide`: every glyph in the dock drawn this much wider than this engine
// draws it — a stand-in for Linux and Android, whose Inter and Anton are wider
// than a Mac's (CI put the 320 pill at one disc where the Mac fit two,
// 2026-09-26). now-jump's trick, aimed at the same dock.
async function openApp(engine, { width = 390, height = 844, guest = false, wide = null, fid = FID, now = SAT, reducedMotion = 'no-preference', routes = null, others = false, touch = width < 720 } = {}) {
  const ctx = await engine.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && engine === chromium, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block', reducedMotion });
  await lateStarts(ctx);
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
  await ctx.addInitScript(([t, o, f, g, od]) => {
    // The worker is blocked here; the page's new-build check still asks it to update.
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Menu Crew' }, { token: o, name: 'Other' }]));
    for (const x of [t, o]) { if (!g) localStorage.setItem(`fn_me_v3_${x}`, 'Ana'); localStorage.setItem(`fn_crew_fest_v3_${x}`, f); }
    // The other crew's people, on this phone: the Invite sheet's "From your other fests".
    if (od) localStorage.setItem(`fn_crew_doc_v3_${o}`, JSON.stringify(od));
    for (const k of ['fn_welcome_v1', 'fn_welcome_joined_v1', 'fn_coach_v1', 'fn_errlog_off_v1']) localStorage.setItem(k, '1');
    // The share sheet, where this engine has none: a stand-in that records.
    window.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.__shared.push(data); } });
  }, [CREW, OTHER, fid, guest, others ? OTHER_DOC : null]);
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
  if (routes) await routes(ctx); // a test's own: a module held or refused from the first request
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // What the page fetched, by path (the faked clock empties the page's own
  // resource timing, so the test listens from outside).
  const fetched = [];
  page.on('requestfinished', (r) => { try { fetched.push(new URL(r.url()).pathname); } catch { /* not a URL */ } });
  await page.clock.setFixedTime(now);
  await page.goto(`${server.origin}/#g=${CREW}&f=${fid}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
  const phone = touch;
  // The dock under 720 wide, the rail from there — a phone on its side is a
  // finger on the rail.
  const bar = await page.evaluate(() => (document.getElementById('dock-you')?.getBoundingClientRect().width ? 'dock' : 'rail'));
  // Real input: a finger's tap, or a mouse's click, at the middle of the thing.
  const press = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    assert.ok(b, `${sel} is on screen`);
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(350);
    // A menu arrives with a 4px slide and a touch of overshoot; on a busy
    // machine it can still be moving at 350 ms, and a box read then is off
    // by the slide (a full local run, 2026-09-26: "the tops on one line
    // (40.6 / 38.5)", green alone three times). Read geometry at rest.
    await page.waitForFunction(() => [...document.querySelectorAll('.hl-pop, .sort-pop')]
      .every((p) => p.getAnimations().every((a) => a.playState !== 'running')), null, { timeout: 3000 }).catch(() => {});
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
  return { ctx, page, errors, posts, phone, bar, press, outside, width, fetched };
}

const wrapSel = (bar) => `#${bar}-you-wrap`;
// A menu is gone when its fade has run out (app.js hides it then), which a
// loaded runner starts late: wait for that, never a beat (runs 36266741642
// and 36266745098, 2026-09-26). A menu that never goes fails the assertion
// that follows, with its state.
const menusGone = (page) => page.waitForFunction(() => ![...document.querySelectorAll('.hl-pop, .sort-pop')].some((p) => getComputedStyle(p).display !== 'none'), null, { timeout: 4000 }).catch(() => {});
// The dock's row and pill at rest before they are read: a refit moves them,
// and a day change glides the row (a smooth scroll, which is no animation:
// the row is at rest when its scroll has held still for four reads).
// At rest also means the scrollspy has settled (v103): after the day turns
// under an open page, the wall is drawn whole again and the spy lights the
// day at the page's OLD height (Thursday) before the place is held, then the
// day you are in (Saturday) a long frame later — a second on a loaded
// runner, the banked "FRI flash" of the NOW.md list — and the row glides
// there. A read in between saw Saturday lit over a row still resting on
// Thursday (CI, three runs in five). So: still, and the lit day whole; past
// the timeout the assertions that follow say what is wrong.
const dockStill = async (page) => {
  await motionDone(page, { within: '#dock' });
  await page.evaluate(() => { window.__rowRest = { left: NaN, same: 0 }; });
  await page.waitForFunction(() => {
    const r = document.getElementById('dock-days');
    const w = window.__rowRest;
    if (r.scrollLeft !== w.left) { w.left = r.scrollLeft; w.same = 0; return false; }
    if (++w.same < 4) return false;
    const on = r.querySelector('.day-tab.active');
    if (!on) return true;
    const a = on.getBoundingClientRect();
    const b = r.getBoundingClientRect();
    return (a.left >= b.left - 2 && a.right <= b.right + 2) || w.same >= 40; // two seconds still: let the assertions speak
  }, null, { timeout: 4000, polling: 50 }).catch(() => {});
};
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
//   c. while NOW is live, the pill leaves the row room for NOW's width and one
//      gap beside the day you are in (v103: NOW is the row's FIRST item, so
//      this is the room v93's `SAT · NOW` pair asked for — the disc counts
//      are what they were), folding to the avatar's size before it would take
//      it; and wherever NOW and the day you are in fit the row together, the
//      row rests with both whole (wall.js restingLeft);
//   d. one to three discs, and a ✕ unless folded.
const pillRead = (page) => page.evaluate(() => {
  const row = document.getElementById('dock-days');
  const wrap = document.getElementById('dock-you-wrap');
  const edges = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.right]; };
  const tabs = [...row.children].filter((t) => !t.hidden);
  const active = tabs.find((t) => t.classList.contains('day-tab') && t.classList.contains('active')) || null;
  const now = tabs.find((t) => t.classList.contains('now-tab')) || null;
  const span = (list) => (list.length ? Math.max(...list.map((t) => t.offsetLeft + t.offsetWidth)) - Math.min(...list.map((t) => t.offsetLeft)) : 0);
  const discs = [...wrap.querySelectorAll('.hl-pill .hl-faces .avatar')];
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  return {
    slot: wrap.dataset.slot,
    named: discs.filter((a) => a.dataset.name).map((a) => a.dataset.name),
    count: discs.reduce((n, a) => n + (a.dataset.name ? 1 : Number(a.textContent.replace('+', ''))), 0),
    discs: discs.length,
    compact: wrap.querySelector('.hl-pill').hasAttribute('data-compact'),
    x: getComputedStyle(wrap.querySelector('.hl-pill .hl-x')).display !== 'none',
    row: edges(row), active: active && edges(active), now: now && edges(now),
    first: !now || row.firstElementChild === now,
    room: row.clientWidth + wrap.getBoundingClientRect().width,
    rowW: row.clientWidth,
    need: (active ? active.offsetWidth : 0) + (now ? now.offsetWidth + (active ? gap : 0) : 0),
    together: span([active, now].filter(Boolean)),
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
  assert.ok(r.first, `${label}: NOW is the row's first item`);
  if (r.activeW <= r.room - BARE) assert.ok(whole(r.active), `${label}: the day you are in is whole (${JSON.stringify(r)})`);
  if (r.now && r.need <= r.room - BARE) {
    assert.ok(r.pill + r.need <= r.room + 2, `${label}: the pill left NOW's room beside the day's (${JSON.stringify(r)})`);
  }
  if (r.now && r.together <= r.rowW - 1) assert.ok(whole(r.now) && whole(r.active), `${label}: NOW and the day you are in fit together, so both are whole (${JSON.stringify(r)})`);
}
// And it uses the room it has: one disc more would break the promise (the
// refit's reason to exist; pillWidth is held to the drawn pill below).
async function assertPillFull(r, people, label) {
  const need = r.need;
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
      // Escape too — once the faces have opened it (a state, not a beat: CI's
      // Linux WebKit read the menu still open 400 ms after Escape, runs
      // 36266741642 and 36266745098).
      await press(`${w} .hl-faces`);
      assert.equal((await menuState(page, bar)).open, true, 'the faces opened it again');
      await page.keyboard.press('Escape');
      await menusGone(page);
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

  test(`${name} 390: + Invite someone — the crew link first; Copy, Share, then Pick for a friend: its step, its ‹ back, and Add ends on their own link`, { skip }, async () => {
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
      // One quiet row under Share, and nothing of the next step on this one.
      assert.equal(await page.locator('.invite-sheet .inv-friend-name').textContent(), 'Pick for a friend');
      assert.equal(await page.locator('.invite-sheet .inv-name input').isVisible(), false, 'no name field on the link’s step');
      const entries = await page.evaluate(() => history.length);
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => document.querySelector('.invite-sheet .sheet-title')?.textContent === 'ADD A FRIEND', null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      const up = await page.evaluate(() => ({
        focus: document.activeElement === document.querySelector('.invite-sheet .inv-name input'),
        people: [...document.querySelectorAll('.invite-sheet .inv-people .person-chip')].map((c) => c.textContent),
        link: !!document.querySelector('.invite-sheet .inv-link')?.getClientRects().length,
        len: history.length,
      }));
      assert.equal(up.focus, true, 'the name field has the focus');
      assert.deepEqual(up.people, ['Ana', 'Ben', 'Cy', 'Dot', 'Eli'], 'our people, already in');
      assert.equal(up.link, false, 'the link’s step has gone');
      assert.equal(up.len, entries, 'no history entry');
      // ‹ back to the link, and in again.
      await press('.invite-sheet .sheet-back');
      await page.waitForFunction(() => document.querySelector('.invite-sheet .sheet-title')?.textContent === 'INVITE SOMEONE', null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      assert.equal(await page.locator('.invite-sheet .inv-link input').isVisible(), true, 'the link again');
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.invite-sheet .inv-friend')), true, 'focus on the row it left from');
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => document.activeElement === document.querySelector('.invite-sheet .inv-name input'), null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      await page.keyboard.type('Zed'); // straight in: the field has the focus
      await press('.invite-sheet .inv-add');
      await page.waitForFunction(() => /ZED IS IN/.test(document.querySelector('.invite-sheet .sheet-title')?.textContent || ''), null, { timeout: 4000 });
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 }); // the answer travels in as a step
      await motionDone(page, { within: '.invite-sheet' });
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

  // The step change is a small event (AGENTS.md, "How this app moves"): the
  // link's step leaves travelling, the friend step arrives from the other
  // side, and the sheet's height TRAVELS between the two — never one jump.
  // Proven by seeking the sheet's own height animation (the QR fold's
  // method: a seek reads the same in every engine, where painted frames do
  // not), and the leaving step's fade. Back, from the friend step, still
  // closes the whole sheet.
  test(`${name} 390: the step change travels — the sheet's height partway at every point, the link's step fading out where it stood — and Back closes the whole sheet`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390 });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await sheetStill(page);
      const before = await page.evaluate(() => {
        const s = document.querySelector('.invite-sheet');
        const row = s.querySelector('.inv-friend').getBoundingClientRect();
        return { h: s.getBoundingClientRect().height, top: s.getBoundingClientRect().top, len: history.length, state: JSON.stringify(history.state), row: [row.top, row.bottom, innerHeight] };
      });
      assert.ok(before.row[1] <= before.row[2], `the row is on screen at 390×844: ${before.row}`);
      // Every animation the swap starts, recorded and — for the sheet's
      // height and the leaving step — sought along the way, then played from
      // the start as the app asked. animate() keeps its receiver (WebIDL).
      await page.evaluate(() => {
        window.__step = { sheet: null, out: null };
        const own = Element.prototype.animate;
        Element.prototype.animate = function (frames, opts) {
          const a = own.call(this, frames, opts);
          const sheet = document.querySelector('.invite-sheet');
          const duration = opts && typeof opts === 'object' ? opts.duration : opts;
          const seek = (read) => {
            a.pause();
            const out = [0.25, 0.5, 0.75].map((p) => { a.currentTime = duration * p; return { p, ...read() }; });
            a.currentTime = 0;
            a.play();
            return out;
          };
          try {
            if (this === sheet && !window.__step.sheet) {
              window.__step.sheet = { duration, frames: JSON.stringify(frames), seek: seek(() => ({ h: sheet.getBoundingClientRect().height })) };
            } else if (this.classList && this.classList.contains('inv-step') && !window.__step.out) {
              window.__step.out = { duration, seek: seek(() => ({ o: Number(getComputedStyle(this).opacity), lifted: getComputedStyle(this).position })) };
            }
          } catch (e) { window.__step.error = String(e); }
          return a;
        };
      });
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      const after = await page.evaluate(() => {
        const s = document.querySelector('.invite-sheet');
        const f = s.querySelector('.inv-name input').getBoundingClientRect();
        return { h: s.getBoundingClientRect().height, field: [f.top, f.bottom], sheet: [s.getBoundingClientRect().top, s.getBoundingClientRect().bottom], ghosts: s.querySelectorAll('.sheet-title').length, link: s.querySelector('.inv-link').getClientRects().length, len: history.length, state: JSON.stringify(history.state) };
      });
      const step = await page.evaluate(() => window.__step);
      assert.equal(step.error, undefined, `the swap could be sought: ${step.error}`);
      assert.ok(Math.abs(after.h - before.h) > 40, `the friend step is a different height: ${before.h} → ${after.h}`);
      assert.ok(step.sheet, 'the sheet’s height animated, not set');
      assert.ok(step.sheet.duration >= 200, `long enough to see: ${step.sheet.duration}ms`);
      const lo = Math.min(before.h, after.h);
      const hi = Math.max(before.h, after.h);
      const dir = Math.sign(after.h - before.h);
      for (const at of step.sheet.seek) assert.ok(lo + 1 < at.h && at.h < hi - 1, `the height partway at ${at.p * 100}%, not jumped: ${JSON.stringify(step.sheet.seek)} (${before.h} → ${after.h})`);
      for (let i = 1; i < step.sheet.seek.length; i++) assert.ok((step.sheet.seek[i].h - step.sheet.seek[i - 1].h) * dir > 0, `further along at each step: ${JSON.stringify(step.sheet.seek)}`);
      assert.ok(step.out, 'the link’s step left by an animation, not a hide');
      assert.equal(step.out.seek[0].lifted, 'absolute', 'lifted where it stood while the friend step takes its place');
      assert.ok(step.out.seek[0].o > 0 && step.out.seek[0].o < 1, `fading, not gone in one frame: ${JSON.stringify(step.out.seek)}`);
      assert.ok(step.out.seek[0].o > step.out.seek[2].o, `fading out: ${JSON.stringify(step.out.seek)}`);
      // At rest: one title, the link's step hidden, the field on screen in the sheet.
      assert.equal(after.ghosts, 1, 'the old title’s ghost is gone');
      assert.equal(after.link, 0, 'the link’s step is hidden at rest');
      assert.ok(after.field[0] >= after.sheet[0] && after.field[1] <= Math.min(after.sheet[1], 844), `the name field is on screen inside the sheet: ${JSON.stringify(after)}`);
      assert.equal(after.len, before.len, 'no history entry');
      assert.equal(after.state, before.state);
      // Back from the friend step: the whole sheet goes, and the page is
      // where it was before the sheet.
      await page.goBack();
      await page.waitForFunction(() => !document.querySelector('#artist-sheet'), null, { timeout: 3000 });
      await sleep(300);
      assert.equal(await page.locator('.invite-sheet').count(), 0, 'the whole sheet, not just its step');
      assert.equal(await page.evaluate(() => (history.state && (history.state.layers || []).length) || 0), 0, 'and no layer left behind');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The other half of the step change (the review of v112: the arrivals
  // could be removed, started at once, or their title left uncrossed, and
  // every test still passed): each part of the step that arrives — the title,
  // the ‹ with the friend step, every part of the step — comes in from
  // nothing, once the step that leaves has gone; the old title crosses out.
  // Both ways: in to the friend step, and ‹ back to the link.
  test(`${name} 390: the step that arrives comes in part by part after the one that leaves has gone, both ways — and the old title crosses out`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, others: true });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await sheetStill(page);
      await page.evaluate(() => {
        window.__anims = [];
        const own = Element.prototype.animate;
        Element.prototype.animate = function (frames, opts) {
          const a = own.call(this, frames, opts);
          window.__anims.push({ el: this, frames, opts });
          return a;
        };
      });
      const read = (toSel) => page.evaluate((sel) => {
        const s = document.querySelector('.invite-sheet');
        const step = s.querySelector(sel).closest('.inv-step');
        const back = s.querySelector('.sheet-back');
        const parts = [s.querySelector('.sheet-title'), ...(back.hidden ? [] : [back]), ...[...step.children].filter((n) => !n.hidden)];
        const left = window.__anims.filter((x) => x.el.classList && x.el.classList.contains('inv-step') && x.el !== step);
        const outEnd = left.length ? Math.max(...left.map((x) => (x.opts.delay || 0) + x.opts.duration)) : null;
        const of = (el) => window.__anims.filter((x) => x.el === el).map((x) => ({ from: x.frames[0], delay: x.opts.delay || 0 }));
        const ghost = window.__anims.find((x) => x.el.classList && x.el.classList.contains('sheet-title') && x.el.getAttribute('aria-hidden') === 'true');
        const backOut = window.__anims.filter((x) => x.el === back).map((x) => x.frames.at(-1));
        const out = { outEnd, parts: parts.map((el) => ({ c: el.className, a: of(el) })), ghost: ghost ? ghost.frames.at(-1) : null, backHidden: back.hidden, backOut };
        window.__anims = [];
        return out;
      }, toSel);
      const check = (r, way) => {
        assert.ok(r.outEnd !== null, `${way}: the step that left did so by an animation: ${JSON.stringify(r)}`);
        for (const p of r.parts) {
          assert.equal(p.a.length, 1, `${way}: ${p.c} arrives by one animation: ${JSON.stringify(r)}`);
          assert.equal(p.a[0].from.opacity, 0, `${way}: ${p.c} from nothing`);
          assert.ok(p.a[0].delay >= r.outEnd, `${way}: ${p.c} after the step that left has gone (${p.a[0].delay} >= ${r.outEnd})`);
        }
        assert.ok(r.ghost && r.ghost.opacity === 0, `${way}: the old title crosses out`);
      };
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      const inward = await read('.inv-name');
      check(inward, 'in');
      assert.ok(inward.parts.some((p) => /sheet-back/.test(p.c)), 'the ‹ arrives with the friend step');
      await press('.invite-sheet .sheet-back');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      const outward = await read('.inv-link');
      check(outward, 'back');
      assert.equal(outward.backHidden, true, 'the ‹ went with its step');
      assert.ok(outward.backOut.length === 1 && outward.backOut[0].opacity === 0, `and it left by fading, not a hide: ${JSON.stringify(outward.backOut)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The keys (notes.js rideKeys, one ride for every sheet): the friend step's
  // field takes the focus inside the tap, so on a phone the keyboard comes up
  // while the step is still moving — and the sheet stands on it, the field in
  // view above it, whenever it rises (the review of v112: deleting the ride
  // passed every test). A scripted visualViewport stands in for iOS's keys.
  // It keeps a log of who listens and who stops listening (with where from),
  // so a ride that ends early names its own end when a test fails.
  const fakeKeys = (page) => page.evaluate(() => {
    const et = new EventTarget();
    const log = [];
    const t0 = performance.now();
    const from = () => (new Error().stack || '').split('\n').slice(2, 6).map((l) => l.trim().replace(/^.*\/(js\/[^?:]+)[^:]*:(\d+).*$/, '$1:$2')).join(' < ');
    let listening = 0;
    const vv = { offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1, kb: 0,
      get width() { return innerWidth; }, get height() { return innerHeight - vv.kb; },
      addEventListener: (...a) => { if (a[0] === 'resize') { listening += 1; log.push(`+${Math.round(performance.now() - t0)} ${from()}`); } et.addEventListener(...a); },
      removeEventListener: (...a) => { if (a[0] === 'resize') { listening -= 1; log.push(`-${Math.round(performance.now() - t0)} ${from()}`); } et.removeEventListener(...a); } };
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    window.__keys = (kb) => { vv.kb = kb; window.__keysUp = kb > 0; log.push(`keys ${kb} at ${Math.round(performance.now() - t0)}, ${listening} listening`); et.dispatchEvent(new Event('resize')); };
    window.__keysLog = () => {
      const sh = document.querySelector('.invite-sheet');
      return { log, inline: sh ? { bottom: sh.style.bottom, maxHeight: sh.style.maxHeight, overflowY: sh.style.overflowY } : null };
    };
  });
  for (const raiseAt of [0, 120, 600]) {
    test(`${name} 390: the friend step with the keys up (raised ${raiseAt} ms after the tap) stands on them, its field in view`, { skip }, async () => {
      const { ctx, page, errors, press } = await openApp(get(), { width: 390, others: true });
      try {
        await fakeKeys(page);
        await press('#dock-you');
        await press('#dock-you-wrap .hl-pop [data-act="invite"]');
        await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
        await motionDone(page, { within: '.invite-sheet' });
        await sheetStill(page);
        const b = await page.locator('.invite-sheet .inv-friend').boundingBox();
        await page.evaluate((ms) => { document.querySelector('.invite-sheet .inv-friend').addEventListener('click', () => setTimeout(() => window.__keys(336), ms), { once: true }); }, raiseAt);
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        // Up when they are up: a page's timer can run late (WebKit on a busy
        // runner fired the 600 ms raise after a fixed wait had measured —
        // the ride's own log said so: listening, the keys never raised).
        await page.waitForFunction(() => window.__keysUp === true, null, { timeout: 5000 });
        await sleep(200);
        await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
        await motionDone(page, { within: '.invite-sheet' });
        const m = await page.evaluate(() => {
          const s = document.querySelector('.invite-sheet');
          const r = s.getBoundingClientRect();
          const f = s.querySelector('.inv-name input').getBoundingClientRect();
          return { sheet: [r.top, r.bottom], keysTop: innerHeight - 336, field: [f.top, f.bottom], focus: document.activeElement === s.querySelector('.inv-name input') };
        });
        assert.ok(m.sheet[1] <= m.keysTop + 1, `the sheet stands on the keys: ${JSON.stringify(m)} — the ride: ${JSON.stringify(await page.evaluate(() => window.__keysLog()))}`);
        assert.ok(m.field[0] >= Math.max(0, m.sheet[0]) && m.field[1] <= m.keysTop, `the field shows above the keys: ${JSON.stringify(m)}`);
        assert.equal(m.focus, true, 'the field has the focus');
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  // …and leaving, it stops riding them (the review of v112): ✕ on the friend
  // step makes the sheet inert, the field blurs and the keys go down while
  // the sheet is still on its way out. A sheet still riding them was fitted
  // again mid-exit — its bottom and its height cap let go, so it jumped the
  // keyboard's height as it left. Every sheet's ride ends where its way out
  // begins (notes.js leave).
  test(`${name} 390: closing the friend step with the keys up, the sheet leaves from where it stood — the keys going down mid-exit never refit it`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390 });
    try {
      await fakeKeys(page);
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await press('.invite-sheet .inv-friend');
      await page.evaluate(() => window.__keys(300));
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      const up = await page.evaluate(() => { const s = document.querySelector('.invite-sheet'); return { bottom: s.style.bottom, maxHeight: s.style.maxHeight }; });
      assert.equal(up.bottom, '300px', `standing on the keys: ${JSON.stringify(up)}`);
      // The ✕, and the keys going down inside the sheet's way out.
      await page.evaluate(() => {
        const s = document.querySelector('.invite-sheet');
        s.querySelector('.sheet-close').addEventListener('click', () => setTimeout(() => {
          window.__leaving = { connected: s.isConnected, id: s.id, moving: s.getAnimations().length };
          window.__keys(0);
          window.__after = { bottom: s.style.bottom, maxHeight: s.style.maxHeight };
        }, 20), { once: true });
      });
      await page.touchscreen.tap(...await page.locator('.invite-sheet .sheet-close').boundingBox().then((c) => [c.x + c.width / 2, c.y + c.height / 2]));
      await page.waitForFunction(() => window.__after, null, { timeout: 3000 });
      const at = await page.evaluate(() => ({ leaving: window.__leaving, after: window.__after }));
      assert.ok(at.leaving.connected && at.leaving.id === '' && at.leaving.moving > 0, `the keys went down while the sheet was on its way out: ${JSON.stringify(at)}`);
      assert.deepEqual(at.after, up, `the leaving sheet kept where it stood: ${JSON.stringify(at)}`);
      await page.waitForFunction(() => !document.querySelector('.invite-sheet'), null, { timeout: 3000 });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The add's answer is a step of the same sheet (the review of v112: the
  // add's "Adding Zed…" line shoved the friend step 29px in one frame, then
  // ZED IS IN replaced the whole sheet in one — the only state change in the
  // flow that still cut). While the add is out nothing moves: the Add button
  // carries the wait itself, at its own width. Its answer travels like the
  // ‹ and the row do: the friend step leaves, its ‹ with it, ZED IS IN
  // arrives part by part, and the sheet's height travels between the two.
  const holdAdds = () => {
    let release = () => {};
    const held = new Promise((r) => { release = r; });
    const routes = (c) => c.route('**/api/crew**', async (r) => { if (r.request().method() !== 'GET') await held; await r.fallback(); });
    return { routes, release: () => release() };
  };
  test(`${name} 390: Add — nothing moves while it is out, and its answer travels in as a step: the friend step and its ‹ leave, ZED IS IN arrives, the height travels`, { skip }, async (t) => {
    const hold = holdAdds();
    const { ctx, page, errors, posts, press } = await openApp(get(), { width: 390, routes: hold.routes, others: true });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      await page.keyboard.type('Zed');
      const where = () => page.evaluate(() => {
        const s = document.querySelector('.invite-sheet');
        const top = (sel) => s.querySelector(sel).getBoundingClientRect().top;
        const add = s.querySelector('.inv-add').getBoundingClientRect();
        return { sheet: s.getBoundingClientRect().top, h: s.getBoundingClientRect().height, title: top('.sheet-title'), field: top('.inv-name input'), add: [add.left, add.width] };
      });
      const before = await where();
      // Every animation from here, and the sheet's height in every frame.
      await page.evaluate(() => {
        window.__anims = [];
        window.__seek = null;
        const own = Element.prototype.animate;
        Element.prototype.animate = function (frames, opts) {
          const a = own.call(this, frames, opts);
          window.__anims.push({ el: this, frames, opts });
          // The sheet's height, sought along the way (a seek reads the same in
          // every engine, where painted frames do not), then played from the start.
          const sheet = document.querySelector('.invite-sheet');
          if (this === sheet && !window.__seek) {
            a.pause();
            window.__seek = [0.25, 0.5, 0.75].map((p) => { a.currentTime = opts.duration * p; return sheet.getBoundingClientRect().height; });
            a.currentTime = 0;
            a.play();
            // Where it really runs: the replay starts on a later frame than
            // the one it was made in (a busy runner's frames are far apart).
            a.ready.then(() => { window.__swapAt = [a.startTime, opts.duration]; });
          }
          return a;
        };
        window.__hs = [];
        const tick = () => {
          const s = document.querySelector('.invite-sheet');
          if (!s) return;
          window.__hs.push([document.timeline.currentTime, s.getBoundingClientRect().height]);
          if (window.__hs.length < 2000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await press('.invite-sheet .inv-add');
      await page.waitForFunction(() => document.querySelector('.invite-sheet .inv-add').disabled, null, { timeout: 3000 });
      await sleep(250);
      const out = await where();
      for (const k of ['sheet', 'h', 'title', 'field']) assert.ok(Math.abs(out[k] - before[k]) < 0.5, `${k} did not move when the add went out: ${before[k]} → ${out[k]}`);
      assert.deepEqual(out.add, before.add, 'the Add button kept its place and its width');
      const waiting = await page.evaluate(() => {
        const s = document.querySelector('.invite-sheet');
        return { bars: !!s.querySelector('.inv-add .eq-loader'), heard: s.querySelector('.inv-status').textContent, row: s.querySelector('.inv-friend-sub').textContent };
      });
      assert.deepEqual(waiting, { bars: true, heard: 'Adding Zed…', row: 'Adding Zed…' }, 'the wait is on the button, said to a screen reader, and on the row behind');
      hold.release();
      await page.waitForFunction(() => /ZED IS IN/.test(document.querySelector('.invite-sheet .sheet-title')?.textContent || '') && !document.querySelector('.invite-sheet.stepping'), null, { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      assert.equal(posts.length, 1, 'one request');
      const r = await page.evaluate(() => {
        const s = document.querySelector('.invite-sheet');
        const steps = [...s.querySelectorAll('.inv-step')];
        const done = steps[0];
        const back = s.querySelector('.sheet-back');
        const of = (el) => window.__anims.filter((x) => x.el === el);
        const sheetH = of(s).map((x) => x.frames.map((f) => f.height));
        const leftEls = window.__anims.filter((x) => x.el.classList && x.el.classList.contains('inv-step') && x.el !== done);
        const outEnd = leftEls.length ? Math.max(...leftEls.map((x) => (x.opts.delay || 0) + x.opts.duration)) : null;
        const parts = [s.querySelector('.sheet-title'), ...done.children].map((el) => ({ c: el.className, a: of(el).map((x) => ({ from: x.frames[0], delay: x.opts.delay || 0 })) }));
        return {
          steps: steps.length, titles: s.querySelectorAll('.sheet-title').length, backHidden: back.hidden,
          backOut: of(back).map((x) => x.frames.at(-1)), leftOut: leftEls.map((x) => x.frames.at(-1)), outEnd, sheetH, parts,
          link: s.querySelector('.inv-link input').value, focusIn: s.contains(document.activeElement),
          hs: window.__hs, seek: window.__seek, swapAt: window.__swapAt, restH: s.getBoundingClientRect().height,
        };
      });
      assert.equal(r.steps, 1, 'at rest the sheet is the answer alone: the friend step and the link’s step have gone');
      assert.equal(r.titles, 1, 'one title, its ghost gone');
      assert.match(r.link, /me=Zed/, 'his own link');
      assert.equal(r.backHidden, true, 'no ‹ on the answer: there is no step to go back to');
      assert.ok(r.backOut.length === 1 && r.backOut[0].opacity === 0, `the ‹ left by fading: ${JSON.stringify(r.backOut)}`);
      assert.ok(r.leftOut.length === 1 && r.leftOut[0].opacity === 0, `the friend step left by fading where it stood: ${JSON.stringify(r.leftOut)}`);
      assert.ok(r.sheetH.length === 1 && Math.abs(parseFloat(r.sheetH[0][0]) - parseFloat(r.sheetH[0][1])) > 40, `the sheet's height animated, not set: ${JSON.stringify(r.sheetH)}`);
      const lo = Math.min(before.h, r.restH);
      const hi = Math.max(before.h, r.restH);
      for (const h of r.seek) assert.ok(lo + 1 < h && h < hi - 1, `the height partway along, not jumped: ${JSON.stringify(r.seek)} (${before.h} → ${r.restH})`);
      for (const p of r.parts) {
        assert.equal(p.a.length, 1, `${p.c} arrives by one animation: ${JSON.stringify(r.parts)}`);
        assert.equal(p.a[0].from.opacity, 0, `${p.c} from nothing`);
        assert.ok(p.a[0].delay >= r.outEnd, `${p.c} after the friend step has gone`);
      }
      assert.equal(r.focusIn, true, 'the focus stays in the sheet');
      // Where the engine applies an animation every frame (Chromium), every
      // frame painted in the middle of the replay shows the height on its way,
      // never at either end. Timed from the replay's own start (the frames
      // were once counted from the frame it was made in, and on a busy runner
      // the replay set off a frame or two later: "0 of 3"). A loaded runner
      // may paint none there: then the seek above stands alone, as the QR
      // fold's does. Mid-way is 10–70% of its time: the surface curve is
      // ~93% of the way by 70% and ~98% by 83%, within a pixel of its end.
      assert.ok(r.swapAt, 'the height animation ran');
      const mid = r.hs.filter(([at]) => at > r.swapAt[0] + 0.1 * r.swapAt[1] && at < r.swapAt[0] + 0.7 * r.swapAt[1]);
      if (name === 'Chromium' && mid.length) {
        for (const [at, h] of mid) assert.ok(lo + 1 < h && h < hi - 1, `the height on its way at ${Math.round(at - r.swapAt[0])}ms of ${r.swapAt[1]}: ${h} (${lo} → ${hi}) — not jumped ${Math.round(hi - lo)}px in one`);
      } else {
        t.diagnostic(`${name}: ${mid.length} frames painted mid-way through the ${r.swapAt[1]}ms swap; the travel is proven by seeking it`);
      }
      assert.deepEqual(errors, []);
    } finally { hold.release(); await ctx.close(); }
  });

  // A long name's answer at 320 (the review of v112, F5): the title read
  // "WILHELMINA FEATHERSTONHA IS" / "IN" — "IS IN" now stays one phrase on
  // the line its name ends on — and Share's words stay inside their pill.
  test(`${name} 320×568: a long name's answer never leaves "IN" alone on a line`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 320, height: 568 });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      await page.keyboard.type('Wilhelmina Featherstonha'); // the field's 24 characters
      await press('.invite-sheet .inv-add');
      await page.waitForFunction(() => /IS IN$/.test(document.querySelector('.invite-sheet .sheet-title')?.textContent || '') && !document.querySelector('.invite-sheet.stepping'), null, { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      const r = await page.evaluate(() => {
        const title = document.querySelector('.invite-sheet .sheet-title');
        const phrase = title.querySelector('.inv-nowrap');
        const range = document.createRange();
        range.selectNodeContents(title.firstChild);
        const name = [...range.getClientRects()];
        const p = phrase.getBoundingClientRect();
        const share = document.querySelector('.invite-sheet .inv-share');
        return { text: title.textContent, phraseLines: phrase.getClientRects().length, nameEnds: name.at(-1).top, phraseTop: p.top, share: share.scrollWidth <= share.clientWidth + 1 };
      });
      assert.equal(r.text, 'WILHELMINA FEATHERSTONHA IS IN');
      assert.equal(r.phraseLines, 1, `"IS IN" on one line: ${JSON.stringify(r)}`);
      assert.ok(Math.abs(r.nameEnds - r.phraseTop) < 2, `and on the line the name ends on, never alone: ${JSON.stringify(r)}`);
      assert.equal(r.share, true, 'Share’s words inside their pill');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // An add's answer landing while a step is moving (the review of v112): the
  // sheet reopened with the add still out, its row tapped, and the answer in
  // while the friend step travels in — the sheet comes to rest as ZED IS IN,
  // nothing left moving, at that state's own height.
  test(`${name} 390: an add answered while the steps are moving comes to rest as its answer — nothing left mid-way`, { skip }, async () => {
    const hold = holdAdds();
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, routes: hold.routes });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      await page.keyboard.type('Zed');
      await press('.invite-sheet .inv-add');
      await press('.invite-sheet .sheet-close');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet'), null, { timeout: 3000 });
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      assert.equal(await page.locator('.invite-sheet .inv-friend-sub').textContent(), 'Adding Zed…', 'the reopened sheet says what is out');
      const b = await page.locator('.invite-sheet .inv-friend').boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForFunction(() => document.querySelector('.invite-sheet.stepping'), null, { timeout: 2000 }).catch(() => {});
      hold.release();
      await page.waitForFunction(() => /ZED IS IN/.test(document.querySelector('.invite-sheet .sheet-title')?.textContent || ''), null, { timeout: 4000 });
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      const r = await page.evaluate(() => {
        const s = document.querySelector('.invite-sheet');
        const h = s.getBoundingClientRect().height;
        s.style.transition = 'none';
        const natural = s.scrollHeight + parseFloat(getComputedStyle(s).borderTopWidth) + parseFloat(getComputedStyle(s).borderBottomWidth);
        const back = s.querySelector('.sheet-back');
        return { h, natural, running: s.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length, steps: s.querySelectorAll('.inv-step').length, titles: s.querySelectorAll('.sheet-title').length, back: !back || back.hidden };
      });
      assert.equal(r.running, 0, `nothing left moving: ${JSON.stringify(r)}`);
      assert.ok(Math.abs(r.h - r.natural) < 1.5, `at the answer's own height: ${JSON.stringify(r)}`);
      assert.deepEqual([r.steps, r.titles, r.back], [1, 1, true], `the answer alone: ${JSON.stringify(r)}`);
      assert.deepEqual(errors, []);
    } finally { hold.release(); await ctx.close(); }
  });

  // A double tap on the row (a phone that felt slow, a thumb that bounced)
  // must not reach the friend step: at 390 its "+ Drew" lands right where
  // the row's words were, and the second half of the tap added Drew to the
  // crew — a write nobody asked for (the walk of this build, 2026-10-03:
  // 1 POST at 300 ms). The step that arrives takes no taps while it moves,
  // nor for a double tap's window after it lands — with motion or without.
  for (const reducedMotion of ['no-preference', 'reduce']) {
    test(`${name} 390${reducedMotion === 'reduce' ? ', Reduce Motion' : ''}: a double tap on the row never reaches the friend step's chips — nothing is added`, { skip }, async () => {
      const { ctx, page, errors, posts, press, phone } = await openApp(get(), { width: 390, reducedMotion, others: true });
      try {
        await press('#dock-you');
        await press('#dock-you-wrap .hl-pop [data-act="invite"]');
        await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
        await motionDone(page, { within: '.invite-sheet' });
        await sheetStill(page);
        assert.deepEqual(await page.locator('.invite-sheet .inv-others button').allTextContents(), ['+ Drew', '+ Kat'], 'your other fests’ people are on the friend step');
        // On the row's words ("Pick for"), where a thumb goes: the text's
        // own box, not its span's (the span stretches across the row).
        const { x, y } = await page.evaluate(() => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelector('.invite-sheet .inv-friend-name'));
          const t = range.getBoundingClientRect();
          const r = document.querySelector('.invite-sheet .inv-friend').getBoundingClientRect();
          return { x: t.left + Math.min(40, t.width / 2), y: r.top + r.height / 2 };
        });
        const tapAt = () => (phone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
        // Each click's time, in the page (the review of v112: a page.evaluate
        // sat inside the gap this measures, leaving 60–90 ms between the
        // second tap and the window it tests; a slow runner would then add
        // Drew and read exactly like the bug).
        await page.evaluate(() => { window.__clicks = []; document.addEventListener('click', () => window.__clicks.push(performance.now()), { capture: true }); });
        for (const gap of [120, 200]) {
          await page.evaluate(() => { window.__clicks = []; });
          await tapAt();
          await sleep(gap);
          await tapAt();
          const { hit, apart } = await page.evaluate(([px, py]) => {
            const e = document.elementFromPoint(px, py);
            const c = window.__clicks;
            return { hit: e ? e.closest('button')?.textContent || e.className : null, apart: c.length >= 2 ? c[1] - c[0] : null };
          }, [x, y]);
          // Inside the window the step holds taps for, or this run proves nothing.
          assert.ok(apart !== null && apart < STEP_SETTLE_MS, `timing, not the app: the two taps landed ${apart} ms apart, past the ${STEP_SETTLE_MS} ms this case tests`);
          await sleep(700);
          assert.equal(posts.length, 0, `a second tap ${Math.round(apart)} ms after the first added nobody (under it then: ${hit})`);
          assert.equal(await page.locator('.invite-sheet .sheet-title').textContent(), 'ADD A FRIEND', 'the friend step is up, and nothing else happened');
          await press('.invite-sheet .sheet-back');
          await motionDone(page, { within: '.invite-sheet' });
          await sleep(400);
        }
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  test(`${name} 390, Reduce Motion: the friend step is there at once — nothing moving, the sheet already its new height`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, reducedMotion: 'reduce' });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      // A real tap, read in the same task as the app's own click handler
      // (a listener on the document hears the click after the row's): no
      // frame for a motion to start in.
      await page.evaluate(() => {
        document.addEventListener('click', () => {
          const s = document.querySelector('.invite-sheet');
          window.__atTap = {
            title: s.querySelector('.sheet-title').textContent,
            moving: s.getAnimations({ subtree: true }).length,
            stepping: s.classList.contains('stepping'),
            link: s.querySelector('.inv-link').getClientRects().length,
            focus: document.activeElement === s.querySelector('.inv-name input'),
            titles: s.querySelectorAll('.sheet-title').length,
          };
        }, { once: true });
      });
      await press('.invite-sheet .inv-friend');
      const at = await page.evaluate(() => window.__atTap);
      assert.deepEqual(at, { title: 'ADD A FRIEND', moving: 0, stepping: false, link: 0, focus: true, titles: 1 }, 'instant, and whole');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The QR's fade has finished: wait for the state, not the motion's
  // bookkeeping. On Linux WebKit the fade had not been created yet when
  // motionDone first looked, so it passed and the tile read 0.22 (CI run
  // 37078125450). A fade that never finishes still fails the opacity
  // assertion that follows, after this deadline.
  const qrShown = (page) => page.waitForFunction(() => {
    const tile = document.querySelector('.invite-sheet .inv-qr-tile');
    return !!tile && getComputedStyle(tile).opacity === '1';
  }, null, { timeout: 4000, polling: 'raf' }).catch(() => {});

  // The sheet itself at rest: its entrance (v3.css sheetIn, scale .98 -> 1
  // over .15 s) finished. motionDone can look before WebKit has created that
  // animation, and a read inside it measured the tile at 175.9 of its 176px
  // (CI run 37085409915). Waits for the state: no transform left, fully
  // opaque.
  const sheetStill = (page) => page.waitForFunction(() => {
    const s = document.querySelector('.invite-sheet');
    if (!s) return false;
    const cs = getComputedStyle(s);
    return cs.transform === 'none' && cs.opacity === '1';
  }, null, { timeout: 4000, polling: 'raf' });

  // The Invite sheet's QR (find your crew, slice 1): what a camera sees is
  // the link the box prints. Read off a screenshot of the tile — the pixels
  // the screen shows, not the data the page drew — at the small phone and
  // the common one, where the sheet's 72vh cap is a fold the friend row
  // can sit below.
  for (const [w, h] of [[320, 568], [390, 844]]) {
    test(`${name} ${w}×${h}: the Invite sheet's QR is square, inside the sheet, drawn, and scans to the link, and the card a long-press keeps is the export card; Copy and Share still work; the friend row is on screen, its step's field too, and ‹ comes back to the scroll it left`, { skip }, async (t) => {
      const { ctx, page, errors, posts, press, fetched } = await openApp(get(), { width: w, height: h });
      try {
        if (name === 'Chromium') await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.origin });
        // Warmed after the wall painted (app.js warmQr): nobody has asked for
        // the QR, and its module comes in all the same, when the page is idle
        // — on a loaded runner later than a fixed beat after the wall (a full
        // parallel run, 2026-10-02: the sheet beat it), so the test waits for
        // that fetch. A sheet opened after it arrives with its QR already
        // drawn, never a blank tile filled in later: drawn the moment the
        // sheet is on the page (its tile measured there), in a microtask
        // queued before this observer's, so before any frame is painted.
        for (let t = 0; !fetched.includes('/vendor/uqr.mjs'); t += 50) {
          assert.ok(t < 8000, `the QR module was never warmed: ${fetched.filter((f) => /\.m?js$/.test(f)).slice(-5).join(', ')}`);
          await sleep(50);
        }
        await sleep(150); // fetched, then evaluated: the import's own promise settles a task or two later
        await page.evaluate(() => {
          window.__qrAtOpen = null;
          new MutationObserver((list, obs) => {
            const sheet = document.querySelector('.invite-sheet');
            if (!sheet) return;
            const img = sheet.querySelector('.inv-qr img');
            window.__qrAtOpen = img ? (img.getAttribute('src') || '').slice(0, 22) : 'no figure';
            obs.disconnect();
          }).observe(document.body, { childList: true });
        });
        await press('#dock-you');
        await press('#dock-you-wrap .hl-pop [data-act="invite"]');
        assert.equal(await page.evaluate(() => window.__qrAtOpen), 'data:image/png;base64,', 'drawn before the sheet was ever painted');
        await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
        await motionDone(page, { within: '.invite-sheet' });
        await qrShown(page);
        const link = await page.locator('.invite-sheet .inv-link input').inputValue();
        const geo = await page.evaluate(() => {
          const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
          const sheet = document.querySelector('.invite-sheet');
          const tile = sheet.querySelector('.inv-qr-tile');
          const img = tile.querySelector('img');
          const st = getComputedStyle(img);
          return {
            sheet: box(sheet), tile: box(tile), img: box(img),
            natural: [img.naturalWidth, img.naturalHeight], opacity: getComputedStyle(tile).opacity, rendering: st.imageRendering,
            callout: st.webkitTouchCallout || null, tileBg: getComputedStyle(tile).backgroundColor,
            ghost: [getComputedStyle(tile, '::before').opacity, getComputedStyle(tile, '::after').opacity],
            order: [...sheet.querySelector('.inv-step').children].map((n) => n.classList[0]).filter((c) => /^inv-(qr|link)$/.test(c)),
          };
        });
        assert.deepEqual(geo.order, ['inv-qr', 'inv-link'], 'the QR on top of the link');
        assert.ok(Math.abs(geo.img.w - geo.img.h) < 0.5 && Math.abs(geo.tile.w - geo.tile.h) < 0.5, `square: tile ${geo.tile.w}×${geo.tile.h}, image ${geo.img.w}×${geo.img.h}`);
        // v3.css: 208px, 196 on a shorter screen, 132 on a short one (Share
        // stays on screen at 320×568) — and never past about half the width.
        const cap = h <= 640 ? 132 : h < 760 ? 196 : 208;
        const vw = h <= 640 ? 0.52 : 0.54;
        const tileW = Math.min(cap, vw * w);
        assert.ok(Math.abs(geo.tile.w - tileW) < 0.5, `the tile is min(${cap}px, ${vw * 100}vw): ${geo.tile.w}`);
        assert.ok(geo.tile.l >= geo.sheet.l && geo.tile.r <= geo.sheet.r && geo.tile.t >= geo.sheet.t && geo.tile.b <= Math.min(geo.sheet.b, h), `inside the sheet and on screen: ${JSON.stringify(geo)}`);
        assert.ok(Math.abs((geo.tile.l + geo.tile.r) / 2 - (geo.sheet.l + geo.sheet.r) / 2) < 1, 'centred');
        assert.ok(geo.natural[0] > 0 && geo.natural[0] === geo.natural[1], `drawn, square: ${geo.natural}`);
        // Shown at its own pixels: one image pixel to one screen pixel at 2x.
        // A bitmap stretched over its room by even 1.1× makes its modules
        // alternate 7 and 8 pixels with image-rendering: pixelated (the walk
        // of 1b80842: 287 drawn, 320 shown); `>= 1.5×` let that through.
        assert.ok(Math.abs(geo.natural[0] - geo.img.w * 2) < 0.01, `shown at its own pixels at 2x: ${geo.natural[0]}px drawn, ${geo.img.w} CSS px shown`);
        assert.ok(Math.abs((geo.img.l + geo.img.r) / 2 - (geo.tile.l + geo.tile.r) / 2) < 0.5 && Math.abs((geo.img.t + geo.img.b) / 2 - (geo.tile.t + geo.tile.b) / 2) < 0.5, `centred in its tile: ${JSON.stringify([geo.img, geo.tile])}`);
        assert.equal(geo.opacity, '1', 'faded in with its tile, and still');
        // The card is the image (the aura, the panel, the code): the tile
        // behind it carries no colour of its own to seam against its edge,
        // and its placeholder has crossfaded away.
        assert.equal(geo.tileBg, 'rgba(0, 0, 0, 0)', 'no tile colour: the card is the image');
        assert.deepEqual(geo.ghost, ['0', '0'], 'the placeholder (a soft card, an empty window) faded out under the code');
        if (geo.callout !== null) assert.equal(geo.callout, 'default', 'a long-press keeps the OS’s Save Image');
        // A screen reader hears the image by its alt and the caption once (a
        // <figure> took its name from its caption, so it was read twice).
        const aria = await page.locator('.invite-sheet .inv-qr').ariaSnapshot();
        assert.equal(aria.split('Point a phone camera here').length - 1, 1, `the caption read once: ${aria}`);
        assert.match(aria, /img "QR code for the crew link"/, aria);
        // What a camera sees: the tile as the screen shows it, decoded.
        const shot = await page.locator('.invite-sheet .inv-qr-tile').screenshot({ type: 'jpeg', quality: 100 });
        const px = jpeg.decode(shot, { useTArray: true });
        const hit = jsQR(new Uint8ClampedArray(px.data.buffer, px.data.byteOffset, px.data.byteLength), px.width, px.height, { inversionAttempts: 'dontInvert' });
        assert.equal(hit && hit.data, link, 'the screenshot scans to exactly the link in the box');
        // The card qr.js laid out for this tile (whole device pixels a
        // module: version v is 17 + 4v modules, inside the 4-module quiet
        // zone): exactly its width, and — where the tile grew (196, 208) to
        // pay for the aura — never fewer pixels a module than v111's 176px
        // tile gave the code.
        const modules = 17 + 4 * hit.version + 8;
        const lay = await page.evaluate(([m, room]) => import('/js/v3/qr.js').then((q) => q.qrLayout(m, room, 2)), [modules, geo.tile.w]);
        assert.equal(geo.natural[0], lay.w, `the card is qrLayout's: ${geo.natural[0]} for ${modules} modules in ${geo.tile.w}px (${JSON.stringify(lay)})`);
        // v111's tile on this same screen: min(132px, 52vw) up to 640 tall, min(176px, 52vw) above.
        const v111 = Math.min(h <= 640 ? 132 : 176, 0.52 * w);
        assert.ok(lay.s >= Math.floor((v111 * 2) / modules), `no fewer pixels a module than v111 drew here: ${lay.s} (v111's ${v111}px tile)`);
        // The card a long-press keeps (qr.js qrSaveCard, the review of v112:
        // the saved image was this screen's card, 263px from a 320 phone, no
        // words): under the card on screen, where a press lands; one export
        // size on every screen; and it scans. The screen's card covers it
        // whole — showing it or not, the tile is the same pixels.
        await page.waitForSelector('.invite-sheet .inv-qr.keep', { timeout: 6000 });
        const keep = await page.evaluate(async () => {
          const tile = document.querySelector('.invite-sheet .inv-qr-tile');
          const shown = tile.querySelector('img:not(.inv-qr-keep)');
          const k = tile.querySelector('.inv-qr-keep');
          const r = shown.getBoundingClientRect();
          const kr = k.getBoundingClientRect();
          const hits = [[0.5, 0.5], [0.15, 0.5], [0.5, 0.85]].map(([fx, fy]) => document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy) === k);
          const q = await import('/js/v3/qr.js');
          const c = document.createElement('canvas');
          c.width = Math.round(k.naturalWidth / 2);
          c.height = Math.round(k.naturalHeight / 2);
          c.getContext('2d').drawImage(k, 0, 0, c.width, c.height);
          return { hits, natural: [k.naturalWidth, k.naturalHeight], box: [kr.left - r.left, kr.top - r.top, kr.width - r.width, kr.height - r.height], alt: k.alt, hidden: k.getAttribute('aria-hidden'), jpeg: c.toDataURL('image/jpeg', 1), save: q.SAVE_CARD };
        });
        assert.deepEqual(keep.hits, [true, true, true], 'a press on the card lands on the card made for keeping');
        assert.ok(keep.box.every((d) => Math.abs(d) < 0.5), `in the very box of the card on screen: ${keep.box}`);
        assert.deepEqual([keep.alt, keep.hidden], ['', 'true'], 'read once, as the card on screen');
        const want = await page.evaluate(([m, sc]) => import('/js/v3/qr.js').then((q) => { const L = q.qrLayout(m, sc.room, sc.ratio); return [L.w, L.h + Math.round(sc.band * sc.ratio)]; }), [modules, keep.save]);
        assert.deepEqual(keep.natural, want, `the export size, whatever this screen: ${keep.natural}`);
        assert.ok(keep.natural[0] >= 1000, `big enough to keep: ${keep.natural}`);
        const kpx = jpeg.decode(Buffer.from(keep.jpeg.split(',')[1], 'base64'), { useTArray: true });
        const khit = jsQR(new Uint8ClampedArray(kpx.data.buffer, kpx.data.byteOffset, kpx.data.byteLength), kpx.width, kpx.height, { inversionAttempts: 'dontInvert' });
        assert.equal(khit && khit.data, link, 'the card kept scans to the link');
        const tileShot = () => page.locator('.invite-sheet .inv-qr-tile').screenshot({ type: 'png' });
        await page.evaluate(() => { document.querySelector('.invite-sheet .inv-qr-keep').style.visibility = 'hidden'; });
        const without = await tileShot();
        await page.evaluate(() => { document.querySelector('.invite-sheet .inv-qr-keep').style.visibility = ''; });
        const withKeep = await tileShot();
        assert.ok(without.equals(withKeep), 'the card kept never shows past the card on screen');
        // Copy and Share, with real input, as before the QR.
        await press('.invite-sheet .inv-copy');
        if (name === 'Chromium') {
          assert.equal(await page.locator('.invite-sheet .inv-copy').textContent(), 'Copied ✓');
          assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link, 'the link on the clipboard');
        }
        await press('.invite-sheet .inv-share');
        const shared = await page.evaluate(() => window.__shared);
        assert.equal(shared.length, 1, 'the share sheet was asked');
        assert.equal(shared[0].url, link, 'with the crew link');
        // Below Share, the friend row: the sheet scrolls to it where it is
        // below the fold (a wheel over the sheet, the way a laptop's
        // trackpad or a phone's drag moves it); it opens the friend step,
        // whose name field is on screen with the focus, and takes a name.
        const inReach = (sel) => page.evaluate((q) => {
          const f = document.querySelector(q).getBoundingClientRect();
          const sh = document.querySelector('.invite-sheet').getBoundingClientRect();
          return f.height > 0 && f.top >= sh.top && f.bottom <= Math.min(sh.bottom, innerHeight);
        }, sel);
        const row = '.invite-sheet .inv-friend';
        // The whole step fits: the row is there at open, nothing to scroll —
        // at 320×568 too, where it once opened cut in half by the sheet's
        // edge (the review of v112).
        assert.ok(await inReach(row), `at ${w}×${h} the friend row is whole on screen at open, unscrolled`);
        // Scrolled to its end before the row is pressed (a wheel over the
        // sheet, the way a trackpad or a drag moves it), so the ‹ below has a
        // place to come back to.
        const c = await page.locator('.invite-sheet').boundingBox();
        await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
        await page.mouse.wheel(0, 400);
        await sleep(200);
        assert.ok(await inReach(row), 'the friend row is on screen inside the sheet');
        const linkScroll = await page.evaluate(() => document.querySelector('.invite-sheet').scrollTop);
        await press(row);
        await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
        await motionDone(page, { within: '.invite-sheet' });
        const field = '.invite-sheet .inv-name input';
        assert.ok(await inReach(field), 'the name field is on screen inside the sheet, no scrolling');
        await page.keyboard.type('Zed');
        assert.equal(await page.locator(field).inputValue(), 'Zed', 'and it takes a name, straight in');
        assert.equal(posts.length, 0, 'nothing sent yet');
        // ‹ back: the link's step where it was left, scroll and all (the
        // review of v112: a ‹ that dropped the scroll passed every test).
        await press('.invite-sheet .sheet-back');
        await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
        await motionDone(page, { within: '.invite-sheet' });
        const back = await page.evaluate(() => document.querySelector('.invite-sheet').scrollTop);
        if (linkScroll > 0) assert.ok(Math.abs(back - linkScroll) <= 1, `the link's step back at its scroll: ${linkScroll} → ${back}`);
        else t.diagnostic(`${w}×${h}: the link's step does not scroll here`);
        assert.ok(await inReach(row), 'the row it left from, on screen');
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  // The sheet's main action stays on screen at open on the smallest phone,
  // with the line a shared view adds (the review of 1b80842: at 320×568 a
  // Show filter + List put Share 26px below the sheet's 72vh fold — 18 of
  // its 44px showing). The tile gives way on a short screen instead.
  // 375×667 (an iPhone SE, the 196px tile) is the next-tightest screen, in
  // its tightest mode.
  for (const [w, h, mode] of [[320, 568, 'List'], [320, 568, 'a room off + List'], [375, 667, 'List']]) {
    test(`${name} ${w}×${h}, ${mode}: Share and Done are on screen when the Invite sheet opens`, { skip }, async () => {
      const { ctx, page, errors, press } = await openApp(get(), { width: w, height: h });
      try {
        await press('#dock-fest-link');
        if (mode !== 'List') await press('#dock-fest-wrap .sort-pop [data-room]');
        await press('#dock-fest-wrap .sort-pop .view-row [data-view="list"]');
        await press('#dock-fest-link'); // the Show menu closes on its own door
        await page.waitForFunction(() => ![...document.querySelectorAll('.sort-pop')].some((p) => getComputedStyle(p).display !== 'none'), null, { timeout: 4000 }).catch(() => {});
        await press('#dock-you');
        await press('#dock-you-wrap .hl-pop [data-act="invite"]');
        await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
        await motionDone(page, { within: '.invite-sheet' });
        const at = await page.evaluate(() => {
          const sheet = document.querySelector('.invite-sheet');
          const s = sheet.getBoundingClientRect();
          const box = (sel) => { const b = sheet.querySelector(sel).getBoundingClientRect(); return { t: b.top, b: b.bottom }; };
          const tile = sheet.querySelector('.inv-qr-tile').getBoundingClientRect();
          return { top: Math.max(s.top, 0), bottom: Math.min(s.bottom, innerHeight), scrolled: sheet.scrollTop, sub: sheet.querySelector('.inv-sub').textContent, share: box('.inv-share'), done: box('.inv-done'), tile: [tile.width, tile.height] };
        });
        assert.match(at.sub, mode === 'List' ? /as a list/ : / \+ .*, as a list/, `the sheet says which view the link opens on: ${at.sub}`);
        assert.equal(at.scrolled, 0, 'at open, unscrolled');
        for (const k of ['share', 'done']) assert.ok(at[k].t >= at.top && at[k].b <= at.bottom + 0.5, `${k} wholly on screen at open: ${JSON.stringify(at)}`);
        assert.ok(Math.abs(at.tile[0] - at.tile[1]) < 0.5, `the tile still square: ${at.tile}`);
        // The friend row is under Share: on screen, or a short scroll away
        // inside the sheet — and whole when it gets there.
        const rowAt = () => page.evaluate(() => {
          const sheet = document.querySelector('.invite-sheet');
          const s = sheet.getBoundingClientRect();
          const r = sheet.querySelector('.inv-friend').getBoundingClientRect();
          return { whole: r.top >= Math.max(s.top, 0) && r.bottom <= Math.min(s.bottom, innerHeight) + 0.5, h: r.height };
        });
        const box = await page.locator('.invite-sheet').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 6 && !(await rowAt()).whole; i++) { await page.mouse.wheel(0, 120); await sleep(120); }
        const r = await rowAt();
        assert.ok(r.whole, `the friend row is reachable, whole, inside the sheet: ${JSON.stringify(r)}`);
        assert.ok(r.h >= 44, `and it is a 44px target: ${r.h}`);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }

  // A phone on its side (the review of v112: at 844×390 Share and Done
  // opened below the dialog's edge and the friend row 111px down; at 667×375
  // the sheet showed the link alone): the link's step in two columns, the QR
  // beside the rest, all of it on screen at open, unscrolled.
  for (const [w, h] of [[844, 390], [667, 375]]) {
    test(`${name} ${w}×${h}, a phone on its side: Share, Done and the friend row are on screen when the Invite sheet opens, the QR beside them`, { skip }, async () => {
      const { ctx, page, errors, press, bar } = await openApp(get(), { width: w, height: h, touch: true });
      try {
        await press(`#${bar}-you`);
        // The menu's own fold on its side is the menu's matter: its last row
        // is scrolled to here, setup only.
        await page.locator(`#${bar}-you-wrap .hl-pop [data-act="invite"]`).scrollIntoViewIfNeeded();
        await sleep(200);
        await press(`#${bar}-you-wrap .hl-pop [data-act="invite"]`);
        await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
        await motionDone(page, { within: '.invite-sheet' });
        await sheetStill(page);
        const at = await page.evaluate(() => {
          const sheet = document.querySelector('.invite-sheet');
          const s = sheet.getBoundingClientRect();
          const box = (sel) => { const b = sheet.querySelector(sel).getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
          return { top: Math.max(s.top, 0), bottom: Math.min(s.bottom, innerHeight), scrolled: sheet.scrollTop, share: box('.inv-share'), done: box('.inv-done'), friend: box('.inv-friend'), tile: box('.inv-qr-tile'), link: box('.inv-link'), sub: box('.inv-sub') };
        });
        assert.equal(at.scrolled, 0, 'at open, unscrolled');
        for (const k of ['share', 'done', 'friend']) assert.ok(at[k].t >= at.top && at[k].b <= at.bottom + 0.5, `${k} wholly on screen at open: ${JSON.stringify(at)}`);
        assert.ok(at.tile.r <= at.link.l && at.tile.r <= at.sub.l, `the QR beside the line and the link, not above them: ${JSON.stringify(at)}`);
        const link = await page.locator('.invite-sheet .inv-link input').inputValue();
        const shot = await page.locator('.invite-sheet .inv-qr-tile').screenshot({ type: 'jpeg', quality: 100 });
        const px = jpeg.decode(shot, { useTArray: true });
        const hit = jsQR(new Uint8ClampedArray(px.data.buffer, px.data.byteOffset, px.data.byteLength), px.width, px.height, { inversionAttempts: 'dontInvert' });
        assert.equal(hit && hit.data, link, 'and it scans to the link');
        // …and the friend row moves the sheet on: ADD A FRIEND alone, its
        // field in the sheet (the review of the v115 head: on its side the
        // link step's two-column grid outranked [hidden], so both steps
        // showed, the friend step under the link's, its field off screen).
        await press('.invite-sheet .inv-friend');
        await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
        await motionDone(page, { within: '.invite-sheet' });
        const fr = await page.evaluate(() => {
          const sheet = document.querySelector('.invite-sheet');
          const s = sheet.getBoundingClientRect();
          const f = sheet.querySelector('.inv-name input').getBoundingClientRect();
          const shown = [...sheet.querySelectorAll('.inv-step')].filter((st) => getComputedStyle(st).display !== 'none').map((st) => (st.classList.contains('inv-link-step') ? 'link' : 'friend'));
          return { shown, field: [f.top, f.bottom], sheet: [Math.max(s.top, 0), Math.min(s.bottom, innerHeight)], title: sheet.querySelector('.sheet-title').textContent };
        });
        assert.equal(fr.title, 'ADD A FRIEND');
        assert.deepEqual(fr.shown, ['friend'], `the friend step alone: ${JSON.stringify(fr)}`);
        assert.ok(fr.field[0] >= fr.sheet[0] && fr.field[1] <= fr.sheet[1] + 0.5, `its field in the sheet: ${JSON.stringify(fr)}`);
        // At 844 the day rail shows, and WebKit's "ResizeObserver loop" from
        // its observer is the known one (LEDGER follow-up 37: fix the rail's
        // observer, then drop every filter like this); errlog.js drops it too.
        assert.deepEqual(errors.filter((e) => !/^ResizeObserver loop/.test(e)), []);
      } finally { await ctx.close(); }
    });
  }

  // The add's own poll (sync.afterServerWrite, in the tick the answer's step
  // begins) brings the new person straight back, and its wall repaint — every
  // card behind the dimmed backdrop — once landed inside the step: the
  // sheet's height travel froze, then dropped 52px in one frame (the review
  // of the v115 head). The wall waits for the step to land, then repaints.
  test(`${name} 390: the add's own poll never repaints the wall while the answer is arriving — the wall catches up once it has`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, others: true });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await press('.invite-sheet .inv-friend');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet.stepping'), null, { timeout: 3000 });
      await motionDone(page, { within: '.invite-sheet' });
      await page.keyboard.type('Zed');
      await page.evaluate(() => {
        window.__wall = [];
        new MutationObserver((recs) => {
          if (recs.some((r) => r.type === 'childList')) window.__wall.push(!!document.querySelector('.invite-sheet.stepping'));
        }).observe(document.getElementById('wall-root'), { childList: true, subtree: true });
      });
      await press('.invite-sheet .inv-add');
      await page.waitForFunction(() => /ZED IS IN/.test(document.querySelector('.invite-sheet .sheet-title')?.textContent || '') && !document.querySelector('.invite-sheet.stepping'), null, { timeout: 4000 });
      // The poll's repaint, once the step is at rest (up to the swapper's own
      // bound and a beat); a wall that repainted mid-step has nothing after.
      await page.waitForFunction(() => window.__wall.some((stepping) => !stepping), null, { timeout: 3000 }).catch(() => {});
      const wall = await page.evaluate(() => window.__wall);
      assert.equal(wall.filter(Boolean).length, 0, `no wall repaint while the answer's step moved: ${JSON.stringify(wall)}`);
      assert.ok(wall.length >= 1, `and the wall caught up once it had: ${JSON.stringify(wall)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Closed while a step is still moving (Escape a beat after the friend
  // row, the review of the v115 head): the sheet leaves at the height it was
  // showing. Its way out once cancelled the step's height on its way and
  // dropped from the next step's — 165px in one frame.
  test(`${name} 390: closed mid-step, the sheet leaves at the height it was showing — never the next step's in one frame`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, height: 844 });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await sheetStill(page);
      await page.evaluate(() => {
        const sheet = document.querySelector('.invite-sheet');
        const heightOn = () => sheet.getAnimations().some((a) => { try { return a.effect.getKeyframes().some((k) => 'height' in k); } catch { return false; } });
        // The step's height animation, held where it is when it starts, so
        // the close always lands mid-way, however busy the machine.
        const own = Element.prototype.animate;
        Element.prototype.animate = function animate(frames, opts) {
          const a = own.call(this, frames, opts);
          if (this === sheet && Array.isArray(frames) && frames.some((f) => 'height' in f)) { a.pause(); a.currentTime = opts.duration / 2; }
          return a;
        };
        window.addEventListener('keydown', (e) => {
          if (e.key !== 'Escape' || window.__closed) return;
          window.__closed = { before: parseFloat(getComputedStyle(sheet).height), moving: heightOn() };
        }, true);
        // The way out begins when the sheet gives up its id (notes.js leave,
        // its first act) — Escape goes through history, so that can be a
        // task later. Read once leave() has run, before any frame or timer:
        // a timer ran late on WebKit and read a sheet already gone.
        new MutationObserver((recs, mo) => {
          if (sheet.id || !window.__closed) return;
          window.__closed.after = parseFloat(getComputedStyle(sheet).height);
          mo.disconnect();
        }).observe(sheet, { attributes: true, attributeFilter: ['id'] });
      });
      const b = await page.locator('.invite-sheet .inv-friend').boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForFunction(() => document.querySelector('.invite-sheet.stepping'), null, { timeout: 2000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__closed && 'after' in window.__closed, null, { timeout: 2000 });
      const c = await page.evaluate(() => window.__closed);
      assert.equal(c.moving, true, `the close landed while the step's height was on its way: ${JSON.stringify(c)}`);
      assert.ok(Math.abs(c.after - c.before) <= 1, `the sheet leaves at the height it showed: ${JSON.stringify(c)}`);
      await page.waitForFunction(() => !document.querySelector('.invite-sheet'), null, { timeout: 3000 });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The card kept lies in the very box of the card on screen — and stays
  // in it when the tile shrinks under it (the review of the v115 head: a
  // phone turned on its side with the sheet open left the kept card's box
  // as tall as it was, and a second QR and its PORTOLA '26 band showed above
  // and below the card on screen).
  test(`${name} 390, the sheet open, then the phone on its side: the card kept never shows past the card on screen`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, height: 844 });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForSelector('.invite-sheet .inv-qr.keep', { timeout: 6000 });
      await page.setViewportSize({ width: 844, height: 390 });
      await sleep(500);
      await motionDone(page, { within: '.invite-sheet' });
      const tileShot = async () => jpeg.decode(await page.locator('.invite-sheet .inv-qr-tile').screenshot({ type: 'jpeg', quality: 100 }), { useTArray: true });
      const box = await page.evaluate(() => {
        const t = document.querySelector('.invite-sheet .inv-qr-tile').getBoundingClientRect();
        const k = document.querySelector('.invite-sheet .inv-qr-keep').getBoundingClientRect();
        return { tile: [t.top, t.bottom, t.left, t.right], keep: [k.top, k.bottom, k.left, k.right] };
      });
      assert.ok(box.keep[0] >= box.tile[0] - 0.5 && box.keep[1] <= box.tile[1] + 0.5 && box.keep[2] >= box.tile[2] - 0.5 && box.keep[3] <= box.tile[3] + 0.5, `the card kept stays inside the tile: ${JSON.stringify(box)}`);
      await page.evaluate(() => { document.querySelector('.invite-sheet .inv-qr-keep').style.visibility = 'hidden'; });
      const a = await tileShot();
      await page.evaluate(() => { document.querySelector('.invite-sheet .inv-qr-keep').style.visibility = ''; });
      const b = await tileShot();
      // The screen's card, scaled down to the smaller tile, leaves its own
      // edge a little see-through (11 of 765 at worst, here); a card kept
      // showing past it is a second QR and its band (hundreds).
      let worst = 0;
      for (let i = 0; i < a.data.length; i += 4) worst = Math.max(worst, Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]));
      assert.ok(worst <= 48, `showing it or not, the tile is the same picture (worst pixel ${worst} of 765)`);
      assert.deepEqual(errors.filter((e) => !/^ResizeObserver loop/.test(e)), []);
    } finally { await ctx.close(); }
  });

  // The QR's late paths (the reviews of 1b80842): its module comes over the
  // network whenever the worker has not precached it yet — a first visit's
  // Create on weak signal is the share moment's cold path. Held, the tile is
  // a square from the first frame that promises nothing (no "point a camera
  // here" before there is a code) and nothing moves when the code lands;
  // never coming, the tile folds away after its deadline — travelling, not
  // gone in one frame; refused, the sheet loses only its QR, and the record
  // says so without the link.
  const qrRead = (page) => page.evaluate(() => {
    const sheet = document.querySelector('.invite-sheet');
    const top = (sel) => sheet.querySelector(sel).getBoundingClientRect().top;
    const fig = sheet.querySelector('.inv-qr');
    const tile = fig && fig.querySelector('.inv-qr-tile');
    const cap = fig && fig.querySelector('.inv-qr-cap');
    const t = tile && tile.getBoundingClientRect();
    return {
      sheet: sheet.getBoundingClientRect().top, sub: top('.inv-sub'), link: top('.inv-link'),
      tile: t ? [t.width, t.height] : null, tileOpacity: tile ? getComputedStyle(tile).opacity : null,
      ghost: tile ? getComputedStyle(tile, '::before').opacity : null,
      cap: cap ? getComputedStyle(cap).visibility : null, ready: !!fig && fig.classList.contains('in'),
      drawn: !!fig && !!fig.querySelector('img').getAttribute('src'),
      next: sheet.querySelector('.inv-sub').nextElementSibling.className,
    };
  });
  const qrRecords = (page) => page.evaluate(() => import('/js/errlog.js').then((m) => m.recent().filter((e) => e.kind === 'invite:qr')));

  test(`${name} 390, the QR module held: the tile is square from the first frame and says nothing until there is a code; nothing moves when it lands`, { skip }, async () => {
    let release = () => {};
    const held = new Promise((r) => { release = r; });
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, routes: (c) => c.route('**/js/v3/qr.js', async (r) => { await held; await r.continue().catch(() => {}); }) });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await motionDone(page, { within: '.invite-sheet' });
      await sheetStill(page);
      const before = await qrRead(page);
      assert.equal(before.drawn, false, 'the module is held: nothing drawn yet');
      assert.ok(before.tile && Math.abs(before.tile[0] - before.tile[1]) < 0.5 && before.tile[0] > 100, `square from the first frame: ${before.tile}`);
      assert.equal(before.cap, 'hidden', 'no "point a phone camera here" before there is a code to point it at');
      assert.ok(Number(before.tileOpacity) < 0.5, `a soft placeholder, not a white square promising a code: ${before.tileOpacity}`);
      assert.equal(before.ghost, '1', 'the placeholder is a soft version of the card (its aura, an empty window), whole until the code lands');
      // Its window is the token's barely-there panel, never a white square
      // (the review of v112: a white window passed every test).
      const window_ = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.background = 'var(--qr-panel-ghost)';
        document.body.appendChild(probe);
        const want = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return { got: getComputedStyle(document.querySelector('.invite-sheet .inv-qr-tile'), '::after').backgroundColor, want };
      });
      assert.equal(window_.got, window_.want, `the empty window is --qr-panel-ghost: ${JSON.stringify(window_)}`);
      assert.notEqual(window_.got, 'rgb(255, 255, 255)', 'never white');
      await sleep(1500);
      assert.equal((await qrRead(page)).tile !== null, true, 'still waiting, inside its deadline');
      release();
      await page.waitForSelector('.invite-sheet .inv-qr.in', { timeout: 4000 });
      await motionDone(page, { within: '.invite-sheet' });
      await qrShown(page);
      const after = await qrRead(page);
      for (const k of ['sheet', 'sub', 'link']) assert.ok(Math.abs(after[k] - before[k]) < 0.5, `${k} did not move when the QR landed: ${before[k]} → ${after[k]}`);
      assert.deepEqual(after.tile, before.tile, 'the tile kept its size');
      assert.equal(after.cap, 'visible', 'with the code, the words');
      assert.equal(after.tileOpacity, '1', 'and the tile whole');
      assert.equal(after.ghost, '0', 'the placeholder crossfaded away under the card');
      const link = await page.locator('.invite-sheet .inv-link input').inputValue();
      const shot = await page.locator('.invite-sheet .inv-qr-tile').screenshot({ type: 'jpeg', quality: 100 });
      const px = jpeg.decode(shot, { useTArray: true });
      const hit = jsQR(new Uint8ClampedArray(px.data.buffer, px.data.byteOffset, px.data.byteLength), px.width, px.height, { inversionAttempts: 'dontInvert' });
      assert.equal(hit && hit.data, link, 'it scans to the link');
      assert.deepEqual(await qrRecords(page), [], 'slow is not an error');
      assert.deepEqual(errors, []);
    } finally { release(); await ctx.close(); }
  });

  test(`${name} 390, the QR module never comes: past its deadline the tile folds away, travelling, and the link stands alone`, { skip }, async (t) => {
    let release = () => {};
    const held = new Promise((r) => { release = r; });
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, routes: (c) => c.route('**/js/v3/qr.js', async (r) => { await held; await r.abort().catch(() => {}); }) });
    try {
      // The fold itself, on the animation's own clock (document.timeline;
      // the page's Date is pinned): when the tile's animation began, how
      // long it was asked to run, what it animates, and when the tile left
      // the page. animate() keeps its receiver (WebIDL).
      //
      // And where things stand along it, by SEEKING the fold — paused, its
      // clock set to points along the way, the layout read at each, then
      // played from the start as the app asked. Painted frames cannot show
      // the travel everywhere: CI's Linux WebKit applies animated styles in
      // coarse steps, not per frame (diag run 37089577730: the fold read
      // 0ms for 368ms of painted frames, then finished in one step; under
      // load the height never changed before the tile left), so a test
      // counting frames failed a fold that was there. The seek is the same
      // in every engine.
      await page.evaluate(() => {
        window.__qrFold = null;
        window.__qrGoneAt = null;
        const own = Element.prototype.animate;
        Element.prototype.animate = function (frames, opts) {
          const a = own.call(this, frames, opts);
          if (this.classList && this.classList.contains('inv-qr') && !window.__qrFold) {
            const duration = opts && typeof opts === 'object' ? opts.duration : opts;
            const fold = window.__qrFold = { at: document.timeline.currentTime, duration, frames: JSON.stringify(frames), seek: null };
            try {
              const sheet = document.querySelector('.invite-sheet');
              a.pause();
              fold.seek = [0.2, 0.4, 0.5, 0.6, 0.7].map((p) => {
                a.currentTime = duration * p;
                return { p, sheet: sheet.getBoundingClientRect().top, link: sheet.querySelector('.inv-link').getBoundingClientRect().top };
              });
              a.currentTime = 0;
              a.play();
            } catch (e) { fold.seek = String(e); }
          }
          return a;
        };
        new MutationObserver((list, obs) => {
          if (window.__qrFold && !document.querySelector('.invite-sheet .inv-qr')) { window.__qrGoneAt = document.timeline.currentTime; obs.disconnect(); }
        }).observe(document.body, { childList: true, subtree: true });
      });
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await sheetStill(page);
      const before = await qrRead(page);
      // Every frame from here: where the sheet's top and the link box stand.
      await page.evaluate(() => {
        window.__qrTrack = [];
        const tick = () => {
          const sheet = document.querySelector('.invite-sheet');
          if (!sheet) return;
          window.__qrTrack.push({ t: document.timeline.currentTime, sheet: sheet.getBoundingClientRect().top, link: sheet.querySelector('.inv-link').getBoundingClientRect().top, qr: !!sheet.querySelector('.inv-qr') });
          if (window.__qrTrack.length < 3000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.waitForFunction(() => !document.querySelector('.invite-sheet .inv-qr'), null, { timeout: 9000 });
      await sleep(250);
      const after = await qrRead(page);
      assert.equal(after.next, 'inv-link', 'the link right under the line, where it always was');
      const track = await page.evaluate(() => window.__qrTrack);
      // The sheet is bottom-anchored: its top comes down, or — when it is
      // full and scrolls — the link comes up. Whatever moved, travelled.
      const moved = ['sheet', 'link'].filter((k) => Math.abs(after[k] - before[k]) > 1);
      assert.ok(moved.some((k) => Math.abs(after[k] - before[k]) > 40), `the tile's room closed: ${JSON.stringify([before, after])}`);
      // It folded: one animation on the tile, its height to nothing over
      // the whole QR_FOLD_MS, and the tile left only once that had run.
      const fold = await page.evaluate(() => ({ ...window.__qrFold, goneAt: window.__qrGoneAt }));
      assert.ok(fold && fold.at != null, 'the tile left by an animation, not a remove');
      assert.ok(fold.duration >= 200, `a fold long enough to see: ${fold.duration}ms`);
      assert.match(fold.frames, /"height":"\d+(\.\d+)?px"[^]*"height":"0px"/, `its room closes, from its height to 0: ${fold.frames}`);
      assert.ok(fold.goneAt != null && fold.goneAt - fold.at >= fold.duration * 0.9, `gone only after the fold ran: ${Math.round(fold.goneAt - fold.at)}ms of ${fold.duration}`);
      // It fades first, then its room closes, so what stood below travels
      // into place: still at 20% of the fold, then partway at every point
      // from 40% to 70%, each further along than the last — a fold, never
      // a fade and then a jump.
      assert.ok(Array.isArray(fold.seek), `the fold could be sought: ${fold.seek}`);
      for (const k of moved) {
        const from = before[k];
        const to = after[k];
        const dir = Math.sign(to - from);
        const [still, ...along] = fold.seek;
        assert.ok(Math.abs(still[k] - from) <= 1, `${k} holds still while the tile fades (20%): ${JSON.stringify(fold.seek)}`);
        for (const at of along) assert.ok(Math.min(from, to) + 1 < at[k] && at[k] < Math.max(from, to) - 1, `${k} partway at ${at.p * 100}% of the fold, not jumped ${Math.round(to - from)}px: ${JSON.stringify(fold.seek)}`);
        for (let i = 1; i < along.length; i++) assert.ok((along[i][k] - along[i - 1][k]) * dir > 0, `${k} further along at each step: ${JSON.stringify(fold.seek)}`);
      }
      // Where the engine applies an animation every frame (Chromium), the
      // painted frames show the travel too, never one jump between two.
      // CI's Linux WebKit steps its animated styles coarsely (above), so
      // there the seek stands alone.
      const during = track.filter((f) => f.t > fold.at && f.t < fold.goneAt);
      if (name === 'Chromium' && during.length >= 3) {
        for (const k of moved) {
          const from = before[k];
          const to = after[k];
          const between = track.filter((f) => Math.min(from, to) + 1 < f[k] && f[k] < Math.max(from, to) - 1).length;
          assert.ok(between >= 2, `${k} travelled — seen on its way in ${between} of ${during.length} frames painted during the fold, not jumped ${Math.round(to - from)}px in one`);
        }
      } else {
        t.diagnostic(`${name}: ${during.length} frames painted during the ${fold.duration}ms fold; the travel is proven by seeking the fold, not by frames`);
      }
      assert.deepEqual(await qrRecords(page), [], 'too slow is not yet an error');
      // The request fails at last: that IS recorded, once, and nothing comes back.
      release();
      await waitForAsync(page, () => import('/js/errlog.js').then((m) => m.recent().some((e) => e.kind === 'invite:qr')), null, { timeout: 4000, what: 'the invite:qr record' });
      const said = await qrRecords(page);
      assert.equal(said.length, 1, `recorded once: ${JSON.stringify(said)}`);
      assert.doesNotMatch(JSON.stringify(said), new RegExp(`${CREW}|#g=|g=`), 'no link anywhere in it');
      assert.equal(await page.locator('.invite-sheet .inv-qr').count(), 0, 'and no QR comes back');
      assert.deepEqual(errors, []);
    } finally { release(); await ctx.close(); }
  });

  test(`${name} 390, the QR module refused from the start: the sheet loses only its QR, and the record names no link`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, routes: (c) => c.route('**/js/v3/qr.js', (r) => r.abort()) });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      await page.waitForFunction(() => !document.querySelector('.invite-sheet .inv-qr'), null, { timeout: 6000 });
      const at = await qrRead(page);
      assert.equal(at.next, 'inv-link', 'the link right under the line, where it always was');
      await press('.invite-sheet .inv-share');
      assert.equal((await page.evaluate(() => window.__shared)).length, 1, 'Share still shares');
      const said = await qrRecords(page);
      assert.equal(said.length, 1, `recorded once: ${JSON.stringify(said)}`);
      assert.doesNotMatch(JSON.stringify(said), new RegExp(`${CREW}|#g=|g=`), 'no link anywhere in it');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name} 390, Reduce Motion: the QR is there at once — no fade to wait for`, { skip }, async () => {
    const { ctx, page, errors, press } = await openApp(get(), { width: 390, reducedMotion: 'reduce' });
    try {
      await press('#dock-you');
      await press('#dock-you-wrap .hl-pop [data-act="invite"]');
      // The moment the image has loaded, it is whole: no transition runs.
      await page.waitForFunction(() => { const i = document.querySelector('.invite-sheet .inv-qr img'); return !!i && i.complete && i.naturalWidth > 0 && i.closest('.inv-qr').classList.contains('in'); }, null, { timeout: 4000 });
      const st = await page.evaluate(() => {
        const fig = document.querySelector('.invite-sheet .inv-qr');
        const tile = fig.querySelector('.inv-qr-tile');
        const cap = fig.querySelector('.inv-qr-cap');
        return { opacity: getComputedStyle(tile).opacity, cap: getComputedStyle(cap).opacity, transition: [getComputedStyle(tile).transitionDuration, getComputedStyle(cap).transitionDuration], moving: fig.getAnimations({ subtree: true }).length };
      });
      assert.equal(st.opacity, '1', 'visible without waiting');
      assert.equal(st.cap, '1', 'and its words');
      assert.equal(st.moving, 0, 'nothing moving on it');
      for (const t of st.transition) assert.match(t, /^0s/, 'the tokens’ kill rule holds the fade at nothing');
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
      await sleep(600);
      await dockStill(page); // the row comes to rest
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
        await menusGone(page);
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
    await menusGone(page);
    const hl = await menuState(page, 'dock');
    assert.deepEqual([hl.open, hl.stored, hl.dim], [false, [], 0], `nothing highlighted by the fading menu: ${JSON.stringify(hl)}`);
    // Show: the same with a room row.
    await press('#dock-fest-link');
    const row = await page.locator('#dock-fest-wrap .sort-pop [data-room]').first().boundingBox();
    const room = await page.locator('#dock-fest-wrap .sort-pop [data-room]').first().getAttribute('data-room');
    const fest = await page.locator('#dock-fest-link').boundingBox();
    await page.touchscreen.tap(fest.x + fest.width / 2, fest.y + fest.height / 2);
    await page.touchscreen.tap(row.x + row.width / 2, row.y + row.height / 2);
    await menusGone(page);
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
      await dockStill(page);
      const live = await pillRead(page);
      assert.ok(live.now, 'NOW is live');
      assertPillPromise(live, four, label('NOW live'));
      await assertPillFull(live, four, label('NOW live'));
      // Every move of the dock's day row from here, for a failure message
      // (v103: CI caught this row resting at its start with the day you are
      // in off its right edge, three runs in five, never on a Mac).
      await page.evaluate(() => {
        const row = document.getElementById('dock-days');
        const now = document.getElementById('dock-now');
        const log = window.__rowLog = [];
        const t0 = performance.now();
        const at = () => Math.round(performance.now() - t0);
        const lit = () => (row.querySelector('.day-tab.active') || {}).dataset?.day || '-';
        const who = () => (new Error().stack.split('\n').slice(3, 6).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/g, '').replace(/\(?\/js\/v3\//g, '').replace(/\)$/, '')).join(' < '));
        const scrollToWas = Element.prototype.scrollTo;
        Element.prototype.scrollTo = function (...a) {
          if (this === row) log.push(`${at()} scrollTo ${JSON.stringify(a[0])} from ${Math.round(row.scrollLeft)} lit ${lit()} w ${row.clientWidth} | ${who()}`);
          return scrollToWas.apply(this, a);
        };
        const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
        Object.defineProperty(row, 'scrollLeft', { configurable: true, get() { return d.get.call(this); },
          set(v) { log.push(`${at()} scrollLeft= ${v} from ${Math.round(d.get.call(this))} lit ${lit()} | ${who()}`); d.set.call(this, v); } });
        new MutationObserver(() => log.push(`${at()} NOW hidden=${now.hidden} leaving=${!!now.dataset.leaving}`)).observe(now, { attributes: true, attributeFilter: ['hidden', 'data-leaving'] });
        new MutationObserver(() => log.push(`${at()} tabs rebuilt, lit ${lit()}`)).observe(row, { childList: true });
        let last = -1;
        row.addEventListener('scroll', () => { const v = Math.round(row.scrollLeft); if (v !== last) { last = v; log.push(`${at()} at ${v}`); } });
      });
      await page.clock.setFixedTime(new Date('2026-09-29T12:00:00-07:00')); // Tuesday: nothing live
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // the page shown again: the clock is read
      await page.waitForFunction(() => document.getElementById('dock-now').hidden, null, { timeout: 5000 });
      await sleep(600);
      await dockStill(page);
      const gone = await pillRead(page);
      assert.equal(gone.now, null, 'NOW is hidden (still first in the row)');
      const lit = gone.active && gone.active[0] >= gone.row[0] - 2 && gone.active[1] <= gone.row[1] + 2;
      if (!lit) assert.fail(`${label('NOW gone')}: the day you are in is whole (${JSON.stringify(gone)})\n${(await page.evaluate(() => window.__rowLog)).join('\n')}`);
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
// ACL (a long name until 2026-10-03), at the Mac's glyph widths and at
// Linux's. Before the rule
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
        await dockStill(page);
        let last = 0;
        const seen = [];
        for (const width of [320, 340, 360, 375, 390, 412, 430]) {
          await page.setViewportSize({ width, height: 844 });
          await sleep(700); // the resize refit (160 ms)
          await dockStill(page); // and the row at rest
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
