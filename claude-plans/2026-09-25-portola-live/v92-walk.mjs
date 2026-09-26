// v92 walk (2026-09-25): first open, wall first, in a real Chromium with real
// touch (hasTouch + isMobile, locator.tap), at 390 and 320. Every state the
// brief names: a new link (the guest wall + welcome), "Just looking", a guest's tap
// (the join screen, "Pick … as"), "Just looking" (back where you were), a
// join (the first pick lands), a returning member, a recognized member, a
// crew with nobody in it, the share link with and without `show`, Settings as
// a guest, and Reduce Motion. NEVER production: this server answers /api from
// memory (made-up crews), /fn-i is swallowed, the service worker is blocked.
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
    // Just looking: the card leaves, the + pulses.
    await page.locator('#welcome-card .bring-actions button').first().tap();
    await sleep(250);
    await shot(page, `${tag}-02-got-it-pulse.png`);
    await sleep(700);
    note(`after Just looking: card gone=${!(await page.locator('#welcome-card').count())}; seen=${await page.evaluate(() => localStorage.getItem('fn_welcome_v1'))}`);
    await shot(page, `${tag}-03-guest-wall.png`);
    note(`errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${tag} 2 guest tap: join, just looking, join as Sam`, async () => {
    resetDocs(); writes.length = 0;
    const { ctx, page, errors } = await phone({ width: W, height: H, init: { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null } });
    await openWall(page, `#g=${T.crew}&f=${FID}`);
    // Scroll the Saturday timetable sideways a little and the page down, so
    // "back where you were" has something to prove.
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('#wall-root .times-scroll')].find((x) => !x.closest('.stage-strip') && x.scrollWidth > x.clientWidth);
      if (s) s.scrollLeft = 120;
    });
    await sleep(200);
    const target = page.locator('#wall-root .card[data-artist="Kettama"]').first();
    await target.scrollIntoViewIfNeeded();
    await sleep(300);
    const before = await place(page);
    note(`place before tap: ${JSON.stringify(before)}`);
    await target.tap();
    await page.waitForSelector('#screen-join', { state: 'visible', timeout: 5000 });
    await sleep(300);
    note(`join-for: "${await page.locator('#join-for').textContent()}"; just looking visible: ${await visible(page, '#join-look')}`);
    const look = await page.locator('#join-look').boundingBox();
    note(`Just looking box ${JSON.stringify(look)}`);
    await shot(page, `${tag}-04-join-from-tap.png`, { fullPage: true });
    await page.locator('#join-look').tap();
    await page.waitForSelector('#screen-app', { state: 'visible' });
    await sleep(300);
    const back = await place(page);
    note(`place after Just looking: ${JSON.stringify(back)} (same: ${JSON.stringify(back) === JSON.stringify(before)})`);
    note(`writes so far: ${JSON.stringify(writes)}`);
    // Now join as Sam from the same tap.
    await target.tap();
    await page.waitForSelector('#screen-join', { state: 'visible' });
    await page.locator('#join-name-input').tap();
    await page.keyboard.type('Sam');
    await page.locator('#join-add-btn').tap();
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 8000 });
    await sleep(900);
    const after = await place(page);
    note(`place after join: ${JSON.stringify(after)} (same: ${JSON.stringify(after) === JSON.stringify(before)})`);
    const lvl = await page.evaluate(async () => {
      const st = await import('/js/state.js');
      return st.crewDoc.festivals['portola-2026'].selections.Kettama;
    });
    note(`Kettama picks now: ${JSON.stringify(lvl)}`);
    note(`dock you: "${await page.locator('#dock-you').textContent()}" guest=${await page.locator('#dock-you').evaluate((n) => n.classList.contains('guest'))}`);
    await shot(page, `${tag}-05-joined-first-pick.png`);
    await sleep(1800);
    note(`writes: ${JSON.stringify(writes)}`);
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
        await page.locator('#welcome-card .bring-actions button').first().tap();
        await page.locator('#wall-root .card[data-artist="Robyn"]').first().tap();
        await page.waitForSelector('#screen-join', { state: 'visible' });
        await sleep(200);
        await shot(page, `${tag}-07-empty-join.png`, { fullPage: true });
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
  // A mouse click on a card: the same question.
  await page.locator('#welcome-card .bring-actions button').first().click();
  await page.locator('#rail-you').click();
  await page.waitForSelector('#screen-join', { state: 'visible' });
  note('rail + opens the join screen');
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('390 9 hold a card, then tap the grown card as a guest', async () => {
  resetDocs(); writes.length = 0;
  const { ctx, page, errors } = await phone({ init: { fn: () => { try { localStorage.setItem('fn_welcome_v1', '1'); } catch {} }, arg: null } });
  await openWall(page, `#g=${T.crew}&f=${FID}`);
  const card = page.locator('#wall-root .card[data-artist="Tove Lo"]').first();
  await card.scrollIntoViewIfNeeded();
  const b = await card.boundingBox();
  const cx = b.x + b.width / 2; const cy = b.y + b.height / 2;
  // A real hold: touch down, wait past the long-press, lift.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  await sleep(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(500);
  const zoomed = await page.evaluate(() => !!document.querySelector('#zoom-layer .zoom-slot, #zoom-layer .zoom-card'));
  note(`held: zoom up = ${zoomed}`);
  await shot(page, '390-16-guest-zoom.png');
  const z = await page.locator('#zoom-layer .zoom-card').first().boundingBox().catch(() => null);
  if (z) await page.touchscreen.tap(z.x + z.width / 2, z.y + 20);
  await sleep(400);
  note(`tap on the grown card: join visible = ${await visible(page, '#screen-join')}; join-for "${await page.locator('#join-for').textContent()}"; zoom left behind = ${await page.evaluate(() => !!document.querySelector('#zoom-layer .zoom-slot'))}`);
  await shot(page, '390-17-zoom-tap-join.png');
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
  await page.locator('#welcome-card .bring-actions button').first().tap();
  await sleep(300);
  note(`blocked: after Just looking card gone ${!(await page.locator('#welcome-card').count())}`);
  await page.locator('#wall-root .card[data-artist="Robyn"]').first().tap();
  await page.waitForSelector('#screen-join', { state: 'visible' });
  await page.locator('#join-look').tap();
  await page.waitForSelector('#screen-app', { state: 'visible' });
  await sleep(200);
  note(`blocked: tap → join → Just looking ok; welcome back? ${await page.locator('#welcome-card').count()}; toast "${await page.locator('#toast-root').textContent()}"`);
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
  await page.waitForSelector('#screen-join', { state: 'visible' });
  await page.locator('#join-look').tap();
  await page.waitForSelector('#screen-app', { state: 'visible' });
  await sleep(300);
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
  await sleep(2600);                                           // the card arrives; read it
  await page.locator('#wall-root .card[data-artist="Fcukers"]').first().tap();
  await page.waitForSelector('#screen-join', { state: 'visible' });
  await sleep(2600);                                           // "Pick Fcukers as…"
  await page.locator('#join-look').tap();
  await page.waitForSelector('#screen-app', { state: 'visible' });
  await sleep(2400);                                           // back on the wall, where they were
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
  await page.locator('#welcome-card .bring-actions button').first().tap(); // Look around
  await page.locator('#wall-root .card[data-artist="Tove Lo"]').first().tap();
  await page.waitForSelector('#screen-join', { state: 'visible' });
  await page.locator('#join-look').tap();
  await page.waitForSelector('#screen-app', { state: 'visible' });
  await sleep(2600); // past the 1.2 s push debounce, and a poll's worth
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // the unload beacon path (sendBeacon is real here)
  await sleep(800);
  const queued = await page.evaluate((t) => localStorage.getItem(`fn_crew_pending_v3_${t}`), T.crew);
  note(`guest zero writes: request log ${JSON.stringify(writes)} (${writes.length} writes); the earlier owner's pick still queued: ${queued && queued.includes('"Kevin":1')}; dot "${await page.locator('#dock .sync-dot').getAttribute('class')}"`);
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, 'walk.txt'), report.join('\n') + '\n');
console.log(`\nreport: ${path.join(OUT, 'walk.txt')}`);
