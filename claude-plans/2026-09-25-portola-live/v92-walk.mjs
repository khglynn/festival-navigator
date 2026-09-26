// v92 walk (2026-09-25): first open, wall first, in a real Chromium with real
// touch (hasTouch + isMobile, locator.tap), at 390 and 320. Every state the
// brief names, as the flow stands after Kevin's round-3 changes: a new link
// (the guest wall + welcome, "Pick shows" left and filled, "Look around"
// right), a guest's tap (the card's zoom, − · note · + along its floor), any
// door asking on the join shelf ("Pick … as", "Join the plan for … as"),
// "Look around" (back where you were), a join (a +'s pick lands), a
// member's hold (+ + − and the meter follows; note opens notes), the most
// crowded real card at 390/320/1280, a returning member, a recognized member,
// a crew with nobody in it, the share link with and without `show`, Settings
// as a guest, and Reduce Motion. NEVER production: this server answers /api
// from memory (made-up crews), /fn-i is swallowed, the service worker is
// blocked.
// Run from the repo: node claude-plans/2026-09-25-portola-live/v92-walk.mjs [only]
// Shots and the report land in v92-shots/ (git-ignored).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.WALK_ROOT || path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'v92-shots');
fs.mkdirSync(OUT, { recursive: true });
const { launchBrowser } = await import('../../tests/helpers/browser.mjs');
const { deepMerge } = await import('../../js/merge.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || null;

const FID = 'portola-2026';
// Made-up crews: parser-shaped, obviously fake, never a real link.
const T = { crew: 'v92walkCREWdemo_0123456', empty: 'v92walkEMPTYdemo_012345', nopick: 'v92walkNOPICKdemo_01234' };
const PID = 'pid_v92walk_kevin';
function demoDoc(kind = 'crew') {
  if (kind === 'empty') return { v: 4, meta: { name: 'The Portola Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: {}, festivals: { [FID]: { selections: {} } } };
  const people = { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 }, Priya: { colorIndex: 9 }, Theo: { colorIndex: 12 }, Rosa: { colorIndex: 15 } };
  if (kind === 'nopick') return { v: 4, meta: { name: 'The Portola Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
  const sel = {};
  const put = (a, who) => { sel[a] = { ...(sel[a] || {}), ...who }; };
  put('Robyn', { Kevin: 4, Maya: 4, Jonah: 3, Priya: 4, Theo: 2, Rosa: 3 });
  put('Dog Blood', { Kevin: 3, Jonah: 4, Theo: 3 });
  put('Soulwax', { Kevin: 4, Maya: 2, Rosa: 3 });
  put('Tove Lo', { Maya: 4, Priya: 3, Rosa: 2 });
  put('Fcukers', { Kevin: 2, Jonah: 2 });
  put('Kettama', { Jonah: 3, Theo: 4 });
  put('DJ Shadow', { Kevin: 3, Theo: 2 });
  put('Four Tet', { Kevin: 4, Jonah: 4, Theo: 3 });
  put('Parcels', { Maya: 3, Rosa: 3, Kevin: 2 });
  put('Overmono', { Jonah: 3, Kevin: 3 });
  // The most crowded real card (Great American Music Hall, Friday afters).
  put('Femme Jatale b2b erika', { Maya: 4, Jonah: 4, Priya: 3, Theo: 2, Rosa: 1 });
  return { v: 4, meta: { name: 'The Portola Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people, festivals: { [FID]: { selections: sel } } };
}

let DOCS = {};
const resetDocs = () => { DOCS = { [T.crew]: demoDoc('crew'), [T.empty]: demoDoc('empty'), [T.nopick]: demoDoc('nopick') }; };
resetDocs();
const writes = [];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p0 = decodeURIComponent(u.pathname);
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (req.method !== 'GET') writes.push(`${req.method} ${p0}${u.searchParams.get('t') ? '?t=' + u.searchParams.get('t').slice(0, 12) + '…' : ''} ${raw.slice(0, 160)}`);
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew') {
        const t = u.searchParams.get('t');
        if (!DOCS[t]) return send(404, { error: 'Crew not found' });
        if (req.method !== 'GET') DOCS[t] = deepMerge(DOCS[t], (JSON.parse(raw || '{}').data) || {});
        return send(200, DOCS[t]);
      }
      if (p0 === '/api/person') {
        if (req.method === 'GET') return send(404, { error: 'nobody' });
        const body = JSON.parse(raw || '{}');
        return send(200, { token: 'v92walkPERSONtoken_0123456789', id: 'pid_v92walk_new', doc: { v: 1, name: body.name || 'Sam', crews: (body.data || {}).crews || {} } });
      }
      if (p0.startsWith('/api/festival-add')) return send(200, { festivals: [] });
      return send(404, {});
    });
    return;
  }
  let p = p0 === '/' ? '/index.html' : p0;
  if (p.startsWith('/f/')) p = '/index.html'; // the share path serves the shell (api/share.js in production)
  let file = path.join(WT, p);
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser();
const report = [];
const note = (s) => { report.push(s); console.log(s); };
const SAT_315PM = '2026-09-26T22:15:00Z'; // Portola Saturday, 3:15 PM PT — the day-of open

async function phone({ width = 390, height = 844, reduce = false, clock = SAT_315PM, init = null, video = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference',
    // At the viewport's own size: a larger size does not scale the page up, it
    // pads it into the top-left corner of a grey canvas.
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  if (clock) await ctx.addInitScript((t) => {
    const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
  }, clock);
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return { ctx, page, errors };
}
const shot = async (page, name, opts = {}) => { await page.screenshot({ path: path.join(OUT, name), ...opts }); };
const visible = (page, sel) => page.locator(sel).isVisible();
const place = (page) => page.evaluate(() => ({
  y: Math.round(window.scrollY),
  lefts: [...document.querySelectorAll('#wall-root .times-scroll')].filter((s) => !s.closest('.stage-strip')).map((s) => Math.round(s.scrollLeft)),
}));
const openWall = async (page, hash, { wait = '#screen-app' } = {}) => {
  await page.goto(`${origin}/f/${FID}${hash}`, { waitUntil: 'load' });
  await page.waitForSelector(wait, { state: 'visible', timeout: 20000 });
  await sleep(900);
};
// The welcome's two halves since Kevin's flip: "Pick shows" left (filled),
// "Look around" right (outlined).
const lookAroundWelcome = (page) => page.locator('#welcome-card .bring-actions .btn-ghost').tap();
// A guest's way in: tap a card (its zoom opens), then one of its doors.
async function guestDoor(page, artist, door = '.f-step.plus') {
  const card = page.locator(`#wall-root .card[data-artist="${artist}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await sleep(150);
  await card.tap();
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(500);
  await page.locator(`#zoom-layer .zoom-slot.shown .f-step-row > ${door}`).tap();
  await page.waitForSelector('.join-shelf', { timeout: 4000 });
  await sleep(450);
}
const shelfLook = async (page) => { await page.locator('.join-shelf .js-look').tap(); await sleep(500); };
// A real hold: touch down, wait past the long-press, lift.
async function hold(ctx, page, sel) {
  const card = page.locator(sel).first();
  await card.scrollIntoViewIfNeeded();
  await sleep(150);
  const b = await card.boundingBox();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await sleep(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(700);
}
// A phone keyboard (Chromium has none): the page's visualViewport is swapped
// for one this rig can shrink, so the shelf's OWN listener (join-shelf.js
// fitKeys) moves it; the keys are drawn only for the picture.
const fakeViewport = { fn: () => {
  const et = new EventTarget();
  const vv = { offsetTop: 0, offsetLeft: 0, pageTop: 0, scale: 1, kb: 0,
    get width() { return innerWidth; }, get height() { return innerHeight - vv.kb; },
    addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a) };
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
  window.__keys = (kb) => { vv.kb = kb; et.dispatchEvent(new Event('resize')); };
}, arg: null };
async function keyboardUp(page, kb) {
  await page.evaluate((kb) => {
    window.__keys(kb);
    const k = document.createElement('div');
    k.id = 'kb-mock';
    k.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${kb}px;z-index:100;background:#2C2C2E;padding:8px 3px 0;box-sizing:border-box;font:500 22px -apple-system,system-ui,sans-serif;color:#fff;`;
    const bar = document.createElement('div');
    bar.style.cssText = 'height:36px;display:flex;justify-content:space-around;align-items:center;color:#d0d0d4;font-size:16px;margin-bottom:6px;';
    bar.textContent = '"Sam"   |   Same   |   Sammy';
    k.appendChild(bar);
    for (const [i, r] of ['qwertyuiop', 'asdfghjkl', '⇧zxcvbnm⌫'].entries()) {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;justify-content:center;gap:6px;margin:0 0 11px;padding:0 ${i === 1 ? 20 : 0}px;`;
      for (const ch of r) {
        const key = document.createElement('span');
        key.textContent = ch;
        key.style.cssText = 'flex:1;height:43px;border-radius:5px;background:#6B6B70;display:flex;align-items:center;justify-content:center;max-width:34px;';
        row.appendChild(key);
      }
      k.appendChild(row);
    }
    document.body.appendChild(k);
  }, kb);
  await sleep(250);
}
// Every row of a standing zoom, with the checks Kevin named for the crowded
// card: nothing clipped, nothing overlapping, every door reachable, 44px on a
// finger, and the zoom clear of the dock and the sticky chrome.
const zoomGeometry = (page) => page.evaluate(() => {
  const z = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
  if (!z) return null;
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const parts = [];
  for (const c of z.children) {
    if (c.classList.contains('z-surface') || c.classList.contains('f-parked')) continue;
    if (c.classList.contains('f-grown')) for (const g of c.children) parts.push({ c: g.className.split(' ')[0], ...box(g) });
    else parts.push({ c: c.className.split(' ').slice(-1)[0], ...box(c) });
  }
  const card = box(z);
  const ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const overlaps = [];
  for (let i = 0; i < parts.length; i += 1) for (let j = i + 1; j < parts.length; j += 1) if (ov(parts[i], parts[j]) >= 1) overlaps.push(`${parts[i].c}×${parts[j].c}`);
  const clipped = parts.filter((p) => p.l < card.l || p.r > card.r || p.t < card.t || p.b > card.b).map((p) => p.c);
  const hit = (el) => { const r = el.getBoundingClientRect(); const u = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!u && (u === el || el.contains(u)); };
  const doors = [...z.querySelectorAll('a.f-link, a.f-where, a.f-order, .f-step-row > *')].map((d) => [d.textContent.trim().slice(0, 18), hit(d), Math.round(d.getBoundingClientRect().height)]);
  const dock = document.getElementById('dock');
  // The dock is position:fixed, so offsetParent is always null — ask its box.
  const dockBox = dock ? dock.getBoundingClientRect() : null;
  const dockTop = dockBox && dockBox.height && getComputedStyle(dock).display !== 'none' ? Math.round(dockBox.top) : null;
  const strip = [...document.querySelectorAll('#wall-root .stage-strip, .day-rail, #topbar')].map((n) => n.getBoundingClientRect()).filter((r) => r.height && r.bottom > 0 && r.top < 10).reduce((m, r) => Math.max(m, Math.round(r.bottom)), null);
  return { card, vw: innerWidth, vh: innerHeight, dockTop, chromeBottom: strip, parts: parts.map((p) => `${p.c}[${p.t}-${p.b}]`), overlaps, clipped, doors };
});

const scenario = async (name, fn) => {
  if (only && !name.startsWith(only)) return;
  note(`\n== ${name}`);
  try { await fn(); } catch (e) { note(`FAIL ${name}: ${String(e).slice(0, 400)}`); }
};

for (const [W, H] of [[390, 844], [320, 568]]) {
  const tag = `${W}`;

  await scenario(`${tag} 1 new link: guest wall + welcome`, async () => {
    resetDocs(); writes.length = 0;
    const { ctx, page, errors } = await phone({ width: W, height: H });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    await page.waitForSelector('#welcome-card', { timeout: 5000 });
    await sleep(900); // the arrival has finished
    note(`screen-app visible: ${await visible(page, '#screen-app')}; join visible: ${await visible(page, '#screen-join')}`);
    note(`welcome: ${await page.locator('#welcome-card .bring-line').textContent()} | ${await page.locator('#welcome-card .bring-sub').textContent()}`);
    note(`dock you: "${await page.locator('#dock-you').textContent()}" guest=${await page.locator('#dock-you').evaluate((n) => n.classList.contains('guest'))} size=${JSON.stringify(await page.locator('#dock-you').boundingBox())}`);
    const card = await page.locator('#welcome-card .bring-card').boundingBox();
    const dock = await page.locator('#dock').boundingBox();
    note(`welcome card box ${JSON.stringify(card)}; dock top ${dock.y}; gap ${Math.round(dock.y - (card.y + card.height))}px; fits width: ${card.x >= 0 && card.x + card.width <= W}`);
    const btns = await page.locator('#welcome-card button').evaluateAll((bs) => bs.map((b) => [b.textContent, Math.round(b.getBoundingClientRect().height)]));
    note(`buttons (label, height): ${JSON.stringify(btns)}`);
    const rects = await page.locator('#welcome-card .bring-actions button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.top), Math.round(r.right)]; }));
    const cardR = await page.locator('#welcome-card .bring-card').evaluate((n) => { const r = n.getBoundingClientRect(); return Math.round(r.right); });
    note(`buttons (label, left, top, right) ${JSON.stringify(rects)}; card right ${cardR}`);
    note(`writes: ${JSON.stringify(writes)}`);
    await shot(page, `${tag}-01-guest-welcome.png`);
    // Look around (the right half): the card leaves, the + pulses.
    await lookAroundWelcome(page);
    await sleep(250);
    await shot(page, `${tag}-02-got-it-pulse.png`);
    await sleep(700);
    note(`after Look around: card gone=${!(await page.locator('#welcome-card').count())}; seen=${await page.evaluate(() => localStorage.getItem('fn_welcome_v1'))}`);
    await shot(page, `${tag}-03-guest-wall.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${tag} 2 guest: card → zoom → + → shelf; Look around keeps the place; the other doors ask too`, async () => {
    resetDocs(); writes.length = 0;
    const { ctx, page, errors } = await phone({ width: W, height: H, init: { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null } });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    // Scroll the Saturday timetable sideways a little, so "back where you
    // were" has something to prove.
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('#wall-root .times-scroll')].find((x) => !x.closest('.stage-strip') && x.scrollWidth > x.clientWidth);
      if (s) s.scrollLeft = 120;
    });
    await sleep(200);
    await page.locator('#wall-root .card[data-artist="Kettama"]').first().scrollIntoViewIfNeeded();
    await sleep(300);
    const before = await place(page);
    await guestDoor(page, 'Kettama', '.f-step.plus');
    note(`+ → shelf "${await page.locator('.join-shelf .js-line').textContent()}"; join screen ${await visible(page, '#screen-join')}`);
    await shelfLook(page);
    const back = await place(page);
    note(`place ${JSON.stringify(before)} → after Look around ${JSON.stringify(back)} (same: ${JSON.stringify(back) === JSON.stringify(before)})`);
    for (const door of ['.f-step.minus', '.f-chip.notes']) {
      await guestDoor(page, 'Kettama', door);
      note(`${door} → shelf "${await page.locator('.join-shelf .js-line').textContent()}"`);
      await shelfLook(page);
    }
    note(`writes: ${JSON.stringify(writes)} (expect none)`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${tag} 3 empty crew and nothing-picked crew`, async () => {
    resetDocs();
    for (const [kind, token] of [['empty', T.empty], ['nopick', T.nopick]]) {
      const { ctx, page, errors } = await phone({ width: W, height: H, reduce: true });
      await openWall(page, `#g=${token}&f=${FID}`);
      await page.waitForSelector('#welcome-card', { timeout: 5000 });
      note(`${kind}: ${await page.locator('#welcome-card .bring-line').textContent()} | ${await page.locator('#welcome-card .bring-sub').textContent()}`);
      await shot(page, `${tag}-06-${kind}-welcome.png`);
      if (kind === 'empty') {
        await lookAroundWelcome(page);
        await guestDoor(page, 'Robyn');
        note(`empty crew: shelf "${await page.locator('.join-shelf .js-line').textContent()}"; names ${await page.locator('.join-shelf .js-name').count()}`);
        await shot(page, `${tag}-07-empty-shelf.png`);
      }
      note(`errors: ${JSON.stringify(errors)}`);
      await ctx.close();
    }
  });

  await scenario(`${tag} 4 returning member and recognized member: no card, they land as in v91`, async () => {
    resetDocs();
    // A member who has used the app (claimed), never welcomed (a v91 phone).
    const claimed = { fn: ([t]) => { try { localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }])); localStorage.setItem(`fn_me_v3_${t}`, 'Maya'); localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026'); localStorage.setItem('fn_coach_v1', '1'); } catch {} }, arg: [T.crew] };
    let { ctx, page, errors } = await phone({ width: W, height: H, init: claimed });
    await openWall(page, `#g=${T.crew}`);
    await sleep(900);
    note(`returning member: now line at viewport y ${await page.evaluate(() => { const l = document.querySelector('#wall-root .now-line'); return l ? Math.round(l.getBoundingClientRect().top) : null; })}`);
    note(`returning member: card ${await page.locator('#welcome-card').count()}; dock you "${await page.locator('#dock-you').textContent()}"; scrollY ${await page.evaluate(() => Math.round(scrollY))}; active tab ${await page.locator('#dock .day-tab.active').textContent().catch(() => '?')}`);
    await shot(page, `${tag}-08-member-no-card.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
    // Recognized: the crew carries this phone's pid.
    DOCS[T.crew].people.Kevin.pid = PID;
    const person = { fn: ([pid]) => { try { localStorage.setItem('fn_person_v1', JSON.stringify({ token: 'v92walkPERSONkevin_0123456789', id: pid, name: 'Kevin', crews: {} })); } catch {} }, arg: [PID] };
    ({ ctx, page, errors } = await phone({ width: W, height: H, init: person }));
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    await sleep(900);
    note(`recognized: now line at viewport y ${await page.evaluate(() => { const l = document.querySelector('#wall-root .now-line'); return l ? Math.round(l.getBoundingClientRect().top) : null; })}; coach strip ${await page.locator('#coach-mark').count()}`);
    note(`recognized: card ${await page.locator('#welcome-card').count()}; toast "${await page.locator('#toast-root').textContent()}"; dock you "${await page.locator('#dock-you').textContent()}"; scrollY ${await page.evaluate(() => Math.round(scrollY))}`);
    await shot(page, `${tag}-09-recognized-no-card.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${tag} 5 share link with and without show`, async () => {
    resetDocs();
    const seen = { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null };
    let { ctx, page, errors } = await phone({ width: W, height: H, init: seen });
    await openWall(page, `#g=${T.crew}&f=${FID}&show=folsom`);
    note(`show=folsom: toast "${await page.locator('#toast-root').textContent()}"; fold ${await page.evaluate(() => localStorage.getItem('fn_fold_v1_portola-2026'))}`);
    note(`rooms on wall: ${JSON.stringify(await page.evaluate(() => [...new Set([...document.querySelectorAll('#wall-root .room[data-room]')].map((r) => r.dataset.room))]))}`);
    await shot(page, `${tag}-10-show-folsom.png`);
    await page.locator('#toast-root button', { hasText: 'Show all' }).tap();
    await sleep(700);
    note(`after Show all: fold ${await page.evaluate(() => localStorage.getItem('fn_fold_v1_portola-2026'))}; rooms ${JSON.stringify(await page.evaluate(() => [...new Set([...document.querySelectorAll('#wall-root .room[data-room]')].map((r) => r.dataset.room))]))}`);
    await shot(page, `${tag}-11-show-all.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
    ({ ctx, page, errors } = await phone({ width: W, height: H, init: seen }));
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    note(`no show: toast "${await page.locator('#toast-root').textContent()}"; fold ${await page.evaluate(() => localStorage.getItem('fn_fold_v1_portola-2026'))}`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${tag} 6 settings: guest, and a member's view line`, async () => {
    resetDocs();
    const seen = { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null };
    let { ctx, page, errors } = await phone({ width: W, height: H, init: seen });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    await page.locator('#gear-btn').tap();
    await page.waitForSelector('#screen-settings', { state: 'visible' });
    await sleep(300);
    await shot(page, `${tag}-12-settings-guest.png`, { fullPage: true });
    note(`guest settings has Rename: ${await page.locator('#settings-root button', { hasText: 'Rename' }).count()}; Add yourself: ${await page.locator('#settings-root button', { hasText: 'Add yourself' }).count()}`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
    const member = { fn: ([t]) => { try { localStorage.setItem('fn_welcome_v1', '1'); localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }])); localStorage.setItem(`fn_me_v3_${t}`, 'Maya'); localStorage.setItem('fn_fold_v1_portola-2026', JSON.stringify(['Folsom'])); } catch {} }, arg: [T.crew] };
    ({ ctx, page, errors } = await phone({ width: W, height: H, init: member }));
    await openWall(page, `#g=${T.crew}`);
    await page.locator('#gear-btn').tap();
    await page.waitForSelector('#screen-settings', { state: 'visible' });
    await sleep(300);
    const link = await page.locator('#settings-root input[aria-label="Crew invite link"]').inputValue();
    note(`member invite link ends: ${link.replace(/#g=[^&]+/, '#g=<token>')}`);
    note(`view line: ${await page.locator('#settings-root', { hasText: 'Opens on' }).count() ? (await page.getByText(/^Opens on/).first().textContent()) : '(none)'}`);
    await page.getByText(/^Opens on/).first().scrollIntoViewIfNeeded();
    await shot(page, `${tag}-13-settings-member-view-line.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

await scenario('390 7 motion: the card arrives (mid-flight frame), reduced motion is instant', async () => {
  resetDocs();
  let { ctx, page, errors } = await phone({});
  await page.goto(`${origin}/f/${FID}#g=${T.crew}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#welcome-card', { timeout: 20000 });
  const early = await page.locator('#welcome-card .bring-card').evaluate((n) => getComputedStyle(n).opacity);
  await sleep(430);
  await shot(page, '390-14-arriving.png');
  const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#welcome-card')).length);
  note(`motion on: opacity at mount ${early}; welcome animations ${anims}`);
  await ctx.close();
  ({ ctx, page, errors } = await phone({ reduce: true }));
  await page.goto(`${origin}/f/${FID}#g=${T.crew}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#welcome-card', { timeout: 20000 });
  const op = await page.locator('#welcome-card .bring-card').evaluate((n) => getComputedStyle(n).opacity);
  const anims2 = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#welcome-card')).length);
  note(`reduced motion: opacity at mount ${op}; welcome animations ${anims2}`);
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('1440 8 desktop: the guest ring on the rail, the card bottom-centre', async () => {
  resetDocs();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.addInitScript((t) => {
    const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
  }, SAT_315PM);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  await page.waitForSelector('#welcome-card', { timeout: 5000 });
  await sleep(900);
  note(`rail you: "${await page.locator('#rail-you').textContent()}" guest=${await page.locator('#rail-you').evaluate((n) => n.classList.contains('guest'))}`);
  note(`card box ${JSON.stringify(await page.locator('#welcome-card .bring-card').boundingBox())}`);
  await shot(page, '1440-15-desktop-guest.png');
  await page.locator('#welcome-card .bring-actions .btn-ghost').click();
  await sleep(500);
  await page.locator('#rail-you').click();
  await page.waitForSelector('.join-shelf', { timeout: 4000 });
  note(`rail + opens the shelf: "${await page.locator('.join-shelf .js-line').textContent()}"`);
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('390 9 hold a card, then tap the grown card as a guest', async () => {
  resetDocs(); writes.length = 0;
  const { ctx, page, errors } = await phone({ init: { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null } });
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  await hold(ctx, page, '#wall-root .card[data-artist="Tove Lo"]');
  note(`held: zoom up = ${await page.locator('#zoom-layer .zoom-slot.shown').count()}; doors ${JSON.stringify(await page.locator('#zoom-layer .f-step-row > *').allTextContents())}`);
  await shot(page, '390-16-guest-zoom-held.png');
  const z = await page.locator('#zoom-layer .zoom-card').first().boundingBox().catch(() => null);
  if (z) await page.touchscreen.tap(z.x + z.width / 2, z.y + 20);
  await sleep(400);
  note(`tap on the grown card's body: shelf ${await page.locator('.join-shelf').count()} (expect 0 — reading never asks); zoom up ${await page.locator('#zoom-layer .zoom-slot.shown').count()}`);
  await page.locator('#zoom-layer .zoom-slot.shown .f-step.plus').tap();
  await page.waitForSelector('.join-shelf', { timeout: 3000 });
  note(`+ → shelf "${await page.locator('.join-shelf .js-line').textContent()}"`);
  await shot(page, '390-17-held-plus-shelf.png');
  note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('390 10 tonight, real clock: a friend opens the link on Friday night', async () => {
  resetDocs();
  const { ctx, page, errors } = await phone({ clock: null });
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  await page.waitForSelector('#welcome-card', { timeout: 5000 });
  await sleep(900);
  note(`real clock ${await page.evaluate(() => new Date().toString())}; active tab ${await page.locator('#dock .day-tab.active').textContent().catch(() => '?')}; scrollY ${await page.evaluate(() => Math.round(scrollY))}`);
  await shot(page, '390-18-friday-night-guest.png');
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('390 11 storage blocked: the getters throw, and a guest still gets in', async () => {
  resetDocs(); writes.length = 0;
  // Chrome with site data blocked: touching window.localStorage/sessionStorage
  // itself raises SecurityError (CLAUDE.md, 2026-08-27).
  const blocked = { fn: () => {
    for (const k of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
    }
  }, arg: null };
  const { ctx, page, errors } = await phone({ init: blocked });
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  note(`blocked: wall visible ${await visible(page, '#screen-app')}; welcome ${await page.locator('#welcome-card').count()}`);
  await lookAroundWelcome(page);
  await sleep(300);
  note(`blocked: after Look around card gone ${!(await page.locator('#welcome-card').count())}`);
  await guestDoor(page, 'Robyn');
  await shelfLook(page);
  note(`blocked: tap → zoom → + → shelf → Look around ok; welcome back? ${await page.locator('#welcome-card').count()}; toast "${await page.locator('#toast-root').textContent()}"`);
  note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('390 12 a phone afters row (v91) scrolled sideways comes back where it was', async () => {
  resetDocs(); writes.length = 0;
  const { ctx, page, errors } = await phone({ init: { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null } });
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  const found = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#wall-root .stack-scroll')].find((r) => r.scrollWidth > r.clientWidth + 20);
    if (!row) return null;
    row.scrollIntoView({ block: 'center' });
    row.scrollLeft = 90;
    const card = row.querySelector('.card[data-artist]');
    row.dataset.walk = '1';
    return { rows: document.querySelectorAll('#wall-root .stack-scroll').length, artist: card && card.dataset.artist };
  });
  note(`stack rows: ${JSON.stringify(found)}`);
  if (!found || !found.artist) { note('no scrollable stack row on this wall/clock — skipped'); await ctx.close(); return; }
  await sleep(300);
  const before = await page.evaluate(() => ({ y: Math.round(scrollY), left: Math.round(document.querySelector('[data-walk]').scrollLeft) }));
  const card = page.locator('[data-walk] .card[data-artist]').first();
  // tap() scrolls a card into view first: read the page where the finger lands.
  await page.evaluate(() => document.addEventListener('pointerdown', () => { window.__yAtTap = Math.round(scrollY); }, { capture: true, once: true }));
  await card.tap();
  before.y = await page.evaluate(() => window.__yAtTap);
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(500);
  await page.locator('#zoom-layer .zoom-slot.shown .f-step.plus').tap();
  await page.waitForSelector('.join-shelf', { timeout: 4000 });
  await sleep(400);
  await shelfLook(page);
  const after = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#wall-root .stack-scroll')];
    return { y: Math.round(scrollY), lefts: rows.map((r) => Math.round(r.scrollLeft)).filter(Boolean) };
  });
  note(`row before ${JSON.stringify(before)}; after Just looking ${JSON.stringify(after)} (row kept: ${after.lefts.includes(before.left)}, page kept: ${after.y === before.y})`);
  await shot(page, '390-19-stack-row-kept.png');
  note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('390 13 recording: a guest lands, the card arrives, taps an artist, looks around', async () => {
  resetDocs(); writes.length = 0;
  const dir = path.join(OUT, 'video-tmp');
  fs.rmSync(dir, { recursive: true, force: true });
  // Recording-only: a soft ring where the finger lands, so a viewer can see
  // the taps. Never part of the app.
  const touches = { fn: () => {
    addEventListener('pointerdown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.85);background:rgba(255,255,255,.18);z-index:99999;pointer-events:none;transition:opacity .5s ease, transform .5s ease;`;
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.opacity = '0'; r.style.transform = 'scale(1.5)'; }));
      setTimeout(() => r.remove(), 700);
    }, true);
  }, arg: null };
  const { ctx, page, errors } = await phone({ video: dir, init: touches });
  const t0 = Date.now();
  await page.goto(`${origin}/f/${FID}#g=${T.crew}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  const wallAt = (Date.now() - t0) / 1000;
  await page.waitForSelector('#welcome-card', { timeout: 5000 });
  await sleep(2200);                                           // the card arrives; read it
  await page.locator('#wall-root .card[data-artist="Fcukers"]').first().tap();
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
  await sleep(1700);                                           // the card opens: − · note · +
  await page.locator('#zoom-layer .zoom-slot.shown .f-step.plus').tap();
  await page.waitForSelector('.join-shelf', { timeout: 4000 });
  await sleep(1300);                                           // "Pick Fcukers as…"
  await page.locator('.join-shelf .js-field').tap();
  await page.keyboard.type('Sam', { delay: 120 });
  await sleep(1300);                                           // "Join as Sam"
  await page.locator('.join-shelf .js-look').tap();
  await sleep(1800);                                           // back on the wall, where they were
  const end = (Date.now() - t0) / 1000;
  const video = page.video();
  await ctx.close();
  const raw = await video.path();
  const start = Math.max(0, wallAt - 0.4);
  const dur = Math.min(15, end - start);
  const mp4 = path.join(OUT, 'v92-guest-first-open-390.mp4');
  const { execFileSync } = await import('node:child_process');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-i', raw, '-t', dur.toFixed(2),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
  fs.rmSync(dir, { recursive: true, force: true });
  note(`recording: ${mp4} (${dur.toFixed(1)} s from the wall's first paint); writes ${JSON.stringify(writes)}; errors ${JSON.stringify(errors)}`);
});

await scenario('390 14 a guest sends nothing — the rig logs every request that is not a read', async () => {
  resetDocs(); writes.length = 0;
  // The hardest case: this phone once picked as Kevin in this crew, and that
  // pick never left (it is still queued). Now nobody's name is on the phone.
  const leftover = { fn: ([t, f]) => {
    try { localStorage.setItem(`fn_crew_pending_v3_${t}`, JSON.stringify({ festivals: { [f]: { selections: { Robyn: { Kevin: 1 } } } } })); } catch {}
  }, arg: [T.crew, FID] };
  const { ctx, page, errors } = await phone({ init: leftover });
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  await page.waitForSelector('#welcome-card', { timeout: 5000 });
  await lookAroundWelcome(page);
  for (const door of ['.f-step.plus', '.f-step.minus', '.f-chip.notes']) {
    await guestDoor(page, 'Tove Lo', door);
    await shelfLook(page);
  }
  await sleep(2600); // past the 1.2 s push debounce, and a poll's worth
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // the unload beacon path (sendBeacon is real here)
  await sleep(800);
  const queued = await page.evaluate((t) => localStorage.getItem(`fn_crew_pending_v3_${t}`), T.crew);
  note(`guest zero writes: request log ${JSON.stringify(writes)} (${writes.length} writes); the earlier owner's pick still queued: ${queued && queued.includes('"Kevin":1')}; dot "${await page.locator('#dock .sync-dot').getAttribute('class')}"`);
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

// ---- the guest shelf round (2026-09-25): a finger's tap opens the card; Pick
// shows asks on a shelf over the wall ----------------------------------------
for (const [W, H] of [[390, 844], [320, 568]]) {
  const tag = `${W}`;
  await scenario(`${tag} 20 shelf: welcome halves, tap → zoom → + → shelf → type (keyboard up) → Look around`, async () => {
    resetDocs(); writes.length = 0;
    const { ctx, page, errors } = await phone({ width: W, height: H, init: fakeViewport });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    await page.waitForSelector('#welcome-card', { timeout: 5000 });
    await sleep(900);
    const halves = await page.locator('#welcome-card .bring-actions button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.height)]; }));
    const more = await page.locator('#welcome-card .welcome-more').evaluate((b) => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.top)]; });
    const edges = await page.locator('#welcome-card .bring-card').evaluate((c) => { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return [Math.round(r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)), Math.round(r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth))]; });
    note(`welcome halves ${JSON.stringify(halves)}; card content edges ${JSON.stringify(edges)} (left half starts on the left edge: ${halves[0][1] === edges[0]}, right half ends on the right edge: ${halves[halves.length - 1][2] === edges[1]}); link ${JSON.stringify(more)}; card height ${Math.round((await page.locator('#welcome-card .bring-card').boundingBox()).height)}`);
    await shot(page, `${tag}-20-welcome-halves.png`);
    const card = page.locator('#wall-root .card[data-artist="Tove Lo"]').first();
    await card.scrollIntoViewIfNeeded();
    await sleep(200);
    const yBefore = await page.evaluate(() => Math.round(scrollY));
    await card.tap();
    await sleep(700);
    const zoom = await page.evaluate(() => {
      const z = document.querySelector('#zoom-layer .zoom-card');
      if (!z) return null;
      return { buttons: [...z.querySelectorAll('button')].map((b) => b.textContent), welcome: !!document.getElementById('welcome-card') };
    });
    note(`tap → zoom ${JSON.stringify(zoom)}; screens: join ${await visible(page, '#screen-join')}`);
    await shot(page, `${tag}-21-guest-zoom.png`);
    // A tap on another card with the zoom up only closes it — a card the zoom
    // does not cover (a finger's zoom is as wide as the screen now).
    const ob = await page.evaluate(() => {
      for (const c of document.querySelectorAll('#wall-root .card[data-artist]')) {
        if (c.dataset.artist === 'Tove Lo') continue;
        const r = c.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + Math.min(20, r.height / 2);
        if (y < 60 || y > innerHeight - 80 || x < 0 || x > innerWidth) continue;
        if (document.elementFromPoint(x, y)?.closest('.card') === c) return { x, y, artist: c.dataset.artist };
      }
      return null;
    });
    if (ob) {
      await page.touchscreen.tap(ob.x, ob.y);
      await sleep(600);
      note(`close-tap on another card (${ob.artist}): zoom open ${await page.locator('#zoom-layer .zoom-card').count()} (expect 0)`);
      await card.tap();
      await sleep(700);
    }
    await page.locator('#zoom-layer .f-step.plus').tap();
    await sleep(700);
    const shelf = await page.evaluate(() => {
      const s = document.querySelector('.join-shelf');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { line: s.querySelector('.js-line').textContent, names: [...s.querySelectorAll('.js-name')].map((b) => b.textContent), go: s.querySelector('.js-go').textContent, goOff: s.querySelector('.js-go').disabled, top: Math.round(r.top), bottom: Math.round(r.bottom), zoom: !!document.querySelector('#zoom-layer .zoom-card'), y: Math.round(scrollY) };
    });
    note(`+ → shelf ${JSON.stringify(shelf)} (wall before ${yBefore}); placeholder "${await page.locator('.join-shelf .js-field').getAttribute('placeholder')}"`);
    const shelfHalves = await page.evaluate(() => {
      const s = document.querySelector('.join-shelf'); const cs = getComputedStyle(s); const r = s.getBoundingClientRect();
      return { halves: [...s.querySelectorAll('.js-actions button')].map((b) => { const q = b.getBoundingClientRect(); return [b.textContent, Math.round(q.left), Math.round(q.right), Math.round(q.height)]; }),
        edges: [Math.round(r.left + parseFloat(cs.paddingLeft)), Math.round(r.right - parseFloat(cs.paddingRight))] };
    });
    note(`shelf halves ${JSON.stringify(shelfHalves)}`);
    await shot(page, `${tag}-22-shelf.png`);
    await page.locator('.join-shelf .js-name').nth(1).tap();
    await sleep(250);
    note(`tapped a name → go "${await page.locator('.join-shelf .js-go').textContent()}"`);
    await shot(page, `${tag}-23-shelf-name-tapped.png`);
    await page.locator('.join-shelf .js-field').tap();
    await page.keyboard.type('Sam');
    await sleep(250);
    note(`typed → go "${await page.locator('.join-shelf .js-go').textContent()}"; typing class ${await page.locator('.join-shelf.typing').count()}`);
    await keyboardUp(page, W >= 390 ? 336 : 260);
    const kb = await page.evaluate(() => {
      const s = document.querySelector('.join-shelf'); const f = s.querySelector('.js-field'); const k = document.getElementById('kb-mock');
      const r = (n) => { const b = n.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
      return { shelf: r(s), field: r(f), keys: r(k), goVisible: s.querySelector('.js-go').getBoundingClientRect().bottom <= k.getBoundingClientRect().top };
    });
    note(`keyboard up: ${JSON.stringify(kb)} (the shelf rides on the keys: shelf bottom ≤ keys top, the Join button above them)`);
    await shot(page, `${tag}-24-shelf-keyboard.png`);
    await page.evaluate(() => { document.getElementById('kb-mock')?.remove(); window.__keys(0); });
    await sleep(200);
    await page.locator('.join-shelf .js-look').tap();
    await sleep(500);
    note(`Look around → shelf gone ${!(await page.locator('.join-shelf').count())}; backdrop gone ${!(await page.locator('#sheet-backdrop').count())}; wall y ${await page.evaluate(() => Math.round(scrollY))}; history state ${JSON.stringify(await page.evaluate(() => history.state))}`);
    note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${tag} 21 shelf join: + → Join as Sam — today's four writes, the + lands as the first pick`, async () => {
    resetDocs(); writes.length = 0;
    const { ctx, page, errors } = await phone({ width: W, height: H, init: { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null } });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    const card = page.locator('#wall-root .card[data-artist="Kettama"]').first();
    await card.scrollIntoViewIfNeeded();
    await sleep(200);
    const before = await place(page);
    await card.tap();
    await sleep(600);
    await page.locator('#zoom-layer .f-step.plus').tap();
    await page.waitForSelector('.join-shelf', { timeout: 3000 });
    await sleep(400);
    await page.locator('.join-shelf .js-field').tap();
    await page.keyboard.type('Sam');
    await page.locator('.join-shelf .js-go').tap();
    await sleep(1500);
    const after = await place(page);
    note(`joined: me ${await page.evaluate(() => localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('fn_me_v3_'))))}; shelf gone ${!(await page.locator('.join-shelf').count())}; place same ${JSON.stringify(before) === JSON.stringify(after)} (${JSON.stringify(before)} → ${JSON.stringify(after)})`);
    note(`Kettama now ${JSON.stringify(await page.evaluate(async () => (await import('/js/state.js')).crewDoc.festivals['portola-2026'].selections.Kettama))}; dock "${await page.locator('#dock-you').textContent()}"`);
    note(`just-joined welcome: ${await page.locator('#welcome-card').count() ? JSON.stringify([await page.locator('#welcome-card .bring-sub').textContent(), await page.locator('#welcome-card .bring-actions button').allTextContents()]) : 'NONE'}`);
    await page.locator('#welcome-card .bring-actions button').first().tap().catch(() => {}); // Got it
    await sleep(500);
    await shot(page, `${tag}-25-shelf-joined.png`);
    await sleep(1500);
    note(`writes (${writes.length}): ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

// ---- Kevin's round-3 changes (2026-09-25): − · note · + for everyone -------------
const memberInit = { fn: ([t]) => { try {
  localStorage.setItem('fn_welcome_v1', '1'); localStorage.setItem('fn_coach_v1', '1');
  localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }]));
  localStorage.setItem(`fn_me_v3_${t}`, 'Kevin'); localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
} catch {} }, arg: [T.crew] };
const levelOf = (page, artist) => page.evaluate(async (a) => ((await import('/js/state.js')).crewDoc.festivals['portola-2026'].selections[a] || {}).Kevin || 0, artist);
const rowState = (page) => page.evaluate(() => {
  const z = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
  const cs = getComputedStyle(z);
  const content = [Math.round(z.getBoundingClientRect().left + parseFloat(cs.paddingLeft)), Math.round(z.getBoundingClientRect().right - parseFloat(cs.paddingRight))];
  const doors = [...z.querySelectorAll('.f-step-row > *')].map((b) => {
    const r = b.getBoundingClientRect();
    const g = b.querySelector('.f-step-dot');
    const gr = g ? g.getBoundingClientRect() : null;
    return [b.textContent, b.disabled ? 'off' : 'on', Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.height), gr ? `glyph ${Math.round(gr.left)}-${Math.round(gr.right)}` : ''];
  });
  const who = z.querySelector('.f-who');
  return { content, who: who ? [Math.round(who.getBoundingClientRect().left), Math.round(who.getBoundingClientRect().right)] : null, doors };
});
for (const [W, H] of [[390, 844], [320, 568]]) {
  const tag = `${W}`;
  await scenario(`${tag} 22 member: hold → zoom → + + − → the level and the meter follow; must stops; note opens notes`, async () => {
    resetDocs(); writes.length = 0;
    const { ctx, page, errors } = await phone({ width: W, height: H, init: memberInit });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    const sel = '#wall-root .card[data-artist="Tove Lo"]';
    await hold(ctx, page, sel);
    note(`level ${await levelOf(page, 'Tove Lo')}: row ${JSON.stringify(await rowState(page))}`);
    await shot(page, `${tag}-30-member-zoom-0.png`);
    const tap = async (door) => {
      const b = await page.locator(`#zoom-layer .zoom-slot.shown .f-step-row > ${door}`).boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await sleep(550);
      return b;
    };
    const p1 = await tap('.f-step.plus');
    note(`+ → level ${await levelOf(page, 'Tove Lo')}; resting card "${await page.locator(sel).first().getAttribute('aria-label')}"; row ${JSON.stringify(await rowState(page))}`);
    await shot(page, `${tag}-31-member-zoom-1.png`);
    const p2 = await tap('.f-step.plus');
    note(`+ → level ${await levelOf(page, 'Tove Lo')}; the + moved ${Math.round(Math.abs(p2.y - p1.y))}px down / ${Math.round(Math.abs(p2.x - p1.x))}px across between taps`);
    await tap('.f-step.minus');
    note(`− → level ${await levelOf(page, 'Tove Lo')}; meter on the card: ${await page.locator(sel).first().evaluate((c) => c.querySelector('.meter, [class*="meter"]')?.getAttribute('aria-label') || c.querySelector('.meter, [class*="meter"]')?.className || '(none)')}`);
    await tap('.f-step.plus'); await tap('.f-step.plus'); await tap('.f-step.plus');
    note(`+ + + → level ${await levelOf(page, 'Tove Lo')}; row ${JSON.stringify(await rowState(page))}`);
    await tap('.f-step.plus');
    note(`a tap on the spent + → level ${await levelOf(page, 'Tove Lo')} (expect 4: no wraparound); zoom up ${await page.locator('#zoom-layer .zoom-slot.shown').count()}`);
    await shot(page, `${tag}-32-member-zoom-must.png`);
    await page.locator('#zoom-layer .zoom-slot.shown .f-chip.notes').tap();
    await sleep(600);
    note(`note → notes sheet ${await page.evaluate(() => { const s = document.getElementById('artist-sheet'); return !!s && !s.classList.contains('join-shelf'); })}; composer ${await page.locator('#artist-sheet textarea').count()}`);
    await shot(page, `${tag}-33-member-note-opens-notes.png`);
    await page.goBack().catch(() => {});
    await sleep(500);
    // Closed: the resting card shows your meter at must.
    await page.mouse.click(4, 4).catch(() => {});
    await sleep(400);
    await page.locator(sel).first().scrollIntoViewIfNeeded();
    await shot(page, `${tag}-34-member-closed-must.png`);
    // v91's tap still cycles on a resting card.
    await page.locator(sel).first().tap();
    await sleep(500);
    note(`a tap on the resting card at must → level ${await levelOf(page, 'Tove Lo')} (v91's cycle: must → not picked); zoom opened by the tap ${await page.locator('#zoom-layer .zoom-slot.shown').count()} (expect 0)`);
    await sleep(1500);
    note(`writes: ${JSON.stringify(writes.filter((w) => w.includes('/api/crew')).map((w) => w.slice(0, 140)))}`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${tag} 23 crowded real card: Femme Jatale b2b erika held open, every row, the doors, the dock`, async () => {
    resetDocs(); writes.length = 0;
    const { ctx, page, errors } = await phone({ width: W, height: H, init: memberInit });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    await hold(ctx, page, '#wall-root .card[data-artist="Femme Jatale b2b erika"]');
    const g = await zoomGeometry(page);
    note(`crowded ${W}: ${JSON.stringify(g)}`);
    note(`  clear of the dock: ${g.dockTop === null || g.card.b <= g.dockTop} (zoom bottom ${g.card.b}, dock top ${g.dockTop}); clear of the chrome: ${g.chromeBottom === null || g.card.t >= g.chromeBottom} (zoom top ${g.card.t}, chrome ${g.chromeBottom}); overlaps ${g.overlaps.length}; clipped ${g.clipped.length}; doors all reachable ${g.doors.every((d) => d[1])}; − and + 44px tall ${[g.doors[g.doors.length - 3], g.doors[g.doors.length - 1]].every((d) => d[2] >= 44)} (the chip draws 30px and its target is the row's 44 — pinned in tests/browser/zoom-door-row.test.mjs)`);
    await shot(page, `${tag}-35-crowded-real-card.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} 25 the look: an unpicked card (member), a pale wash (guest)`, async () => {
    resetDocs(); writes.length = 0;
    let { ctx, page, errors } = await phone({ width: W, height: H, init: memberInit });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    await hold(ctx, page, '#wall-root .card[data-artist="Airwolf Paradise"]');
    const g = await zoomGeometry(page);
    note(`unpicked ${W}: row ${JSON.stringify(await rowState(page))}; card ${JSON.stringify(g.card)}; overlaps ${g.overlaps.length}; clipped ${g.clipped.length}`);
    await shot(page, `${W}-40-unpicked-member.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
    writes.length = 0; // the member's own first-open writes (its person) are not the guest's
    ({ ctx, page, errors } = await phone({ width: W, height: H, init: { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null } }));
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    const card = page.locator('#wall-root .card[data-artist="Tove Lo"]').first();
    await card.scrollIntoViewIfNeeded();
    await sleep(150);
    await card.tap();
    await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
    await sleep(700);
    note(`pale, guest ${W}: row ${JSON.stringify(await rowState(page))}`);
    await shot(page, `${W}-41-pale-guest.png`);
    note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

await scenario('1280 24 desktop: the door row in a hover zoom — a member clicks + and −, a click on the wall still picks; a guest\'s + asks', async () => {
  resetDocs(); writes.length = 0;
  const desk = async (init) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
    }, SAT_315PM);
    if (init) await ctx.addInitScript(init.fn, init.arg);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    return { ctx, page, errors };
  };
  const hover = async (page, sel) => {
    const card = page.locator(sel).first();
    await card.scrollIntoViewIfNeeded();
    await sleep(200);
    const b = await card.boundingBox();
    await page.mouse.move(b.x - 20, b.y - 20);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
    await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
    await sleep(700);
  };
  const click = async (page, door) => {
    const b = await page.locator(`#zoom-layer .zoom-slot.shown .f-step-row > ${door}`).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(500);
  };
  let { ctx, page, errors } = await desk(memberInit);
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  await hover(page, '#wall-root .card[data-artist="Femme Jatale b2b erika"]');
  const g = await zoomGeometry(page);
  note(`crowded 1280 (hover): ${JSON.stringify(g)}`);
  note(`  overlaps ${g.overlaps.length}; clipped ${g.clipped.length}; doors reachable ${g.doors.every((d) => d[1])}`);
  await shot(page, '1280-36-crowded-hover.png');
  await click(page, '.f-step.plus');
  const l1 = await levelOf(page, 'Femme Jatale b2b erika');
  await click(page, '.f-step.plus');
  const l2 = await levelOf(page, 'Femme Jatale b2b erika');
  await click(page, '.f-step.minus');
  note(`member clicks + + − → ${l1}, ${l2}, ${await levelOf(page, 'Femme Jatale b2b erika')}; zoom still up ${await page.locator('#zoom-layer .zoom-slot.shown').count()}`);
  await shot(page, '1280-37-member-hover-row.png');
  await page.mouse.move(640, 20, { steps: 5 });
  await sleep(600);
  const before = await levelOf(page, 'Tove Lo');
  await page.locator('#wall-root .card[data-artist="Tove Lo"]').first().click();
  await sleep(400);
  note(`a click on a resting card still picks: Tove Lo ${before} → ${await levelOf(page, 'Tove Lo')}`);
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
  ({ ctx, page, errors } = await desk({ fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null }));
  writes.length = 0;
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  await hover(page, '#wall-root .card[data-artist="Tove Lo"]');
  note(`guest hover row: ${JSON.stringify(await rowState(page))}`);
  await click(page, '.f-step.plus');
  await page.waitForSelector('.join-shelf', { timeout: 3000 });
  note(`guest + → shelf "${await page.locator('.join-shelf .js-line').textContent()}"`);
  await shot(page, '1280-38-guest-hover-plus-shelf.png');
  note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, 'walk.txt'), report.join('\n') + '\n');
console.log(`\nreport: ${path.join(OUT, 'walk.txt')}`);
