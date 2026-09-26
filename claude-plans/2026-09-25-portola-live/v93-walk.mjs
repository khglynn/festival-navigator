// v93 walk (2026-09-25): the dock with NOW in the day row (D1), "+ Add
// someone", and the +n's solid ring — in a real Chromium with real touch, at
// 320, 375, 390, 430 and 1280. Every state the brief names: something live
// and nothing live, NOW arriving and leaving, a NOW tap, a day switch, the
// last day, a day with no festival room (Portola's Thursday), ACL's seven
// tabs and long name, Reduce Motion. NEVER production: this server answers
// /api from memory (a made-up crew), /fn-i is swallowed, the service worker
// is blocked.
// Run from the repo: node claude-plans/2026-09-25-portola-live/v93-walk.mjs [only]
// Shots and the report land in v93-shots/ (git-ignored).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.WALK_ROOT || path.resolve(HERE, '../..');
const OUT = path.join(HERE, process.env.WALK_OUT || 'v93-shots');
fs.mkdirSync(OUT, { recursive: true });
const { launchBrowser } = await import('../../tests/helpers/browser.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || null;

// A made-up crew: parser-shaped, obviously fake, never a real link. Six
// people, so the people row is the brief's "six people" case, and Robyn is
// picked by all six so her crew corner folds into a +n.
const TOKEN = 'v93walkCREWdemo_01234567';
function demoDoc(fid) {
  const people = { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 }, Priya: { colorIndex: 9 }, Theo: { colorIndex: 12 }, Rosa: { colorIndex: 15 } };
  const sel = {};
  const put = (a, who) => { sel[a] = { ...(sel[a] || {}), ...who }; };
  put('Robyn', { Kevin: 3, Maya: 4, Jonah: 3, Priya: 4, Theo: 2, Rosa: 3 });
  put('Dog Blood', { Kevin: 3, Jonah: 4, Theo: 3, Maya: 2, Rosa: 1 });
  put('Soulwax', { Kevin: 4, Maya: 2, Rosa: 3 });
  put('Tove Lo', { Maya: 4, Priya: 3, Rosa: 2 });
  put('Milli Meng', { Jonah: 3, Priya: 2, Theo: 1, Rosa: 2, Maya: 1 });
  put('Four Tet', { Kevin: 4, Jonah: 4, Theo: 3 });
  return { v: 4, meta: { name: 'The Walk Crew', inviteFestId: fid }, spotify: {}, affinity: {}, people, festivals: { [fid]: { selections: fid === 'portola-2026' ? sel : {} } } };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let FEST = 'portola-2026';
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p0 = decodeURIComponent(u.pathname);
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
    req.resume();
    req.on('end', () => {
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew') return req.method === 'GET' ? send(200, demoDoc(FEST)) : send(503, {});
      if (p0.startsWith('/api/festival-add')) return send(200, { festivals: [] });
      return send(503, {});
    });
    return;
  }
  const p = p0 === '/' ? '/index.html' : p0;
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

// Festival-local moments (the zone the fest file names).
const AT = {
  sat1030pm: '2026-09-27T05:30:00Z', // Portola Sat 10:30 PM PDT: Soulwax/Prospa on the grid, the afters open
  sat9am: '2026-09-26T16:00:00Z',    // Sat 9 AM: nothing live
  sat1255pm: '2026-09-26T19:55:00Z', // Sat 12:55 PM, five minutes before the grid starts
  sun3pm: '2026-09-27T22:00:00Z',    // Sun 3 PM: the last day's grid
  thu11pm: '2026-09-25T06:00:00Z',   // Thu 11 PM: Thursday's afters, a day with no festival room
  mon5am: '2026-09-28T12:00:00Z',    // Mon 5 AM: the week is over
  aclSat8pm: '2026-10-04T01:00:00Z', // ACL W1 Sat Oct 3, 8 PM CDT
};

async function open({ width = 390, height = 844, at = AT.sat1030pm, fest = 'portola-2026', reduce = false, touch = width < 720 } = {}) {
  FEST = fest;
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch,
    serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  // A clock that runs from `at` in real time and can be moved (window.__clockTo).
  await ctx.addInitScript((t) => {
    let T0 = new Date(t).getTime(); let start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
    window.__clockTo = (iso) => { T0 = new RealDate(iso).getTime(); start = RealDate.now(); };
  }, at);
  await ctx.addInitScript(([tok, f]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: tok, name: 'The Walk Crew' }]));
    localStorage.setItem(`fn_me_v3_${tok}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${tok}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
  }, [TOKEN, fest]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`${origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await sleep(1400); // the day-of open lands and the row rests
  return { ctx, page, errors };
}

// The dock (or the rail) as numbers: each child of the day row against the
// row's box, what is lit, where NOW is, and whether the fest name is whole.
const dockNumbers = (page) => page.evaluate(() => {
  const wide = innerWidth >= 720;
  const row = document.getElementById(wide ? 'rail-days' : 'dock-days');
  const r = row.getBoundingClientRect();
  const kids = [...row.children].filter((k) => !k.hidden).map((k) => {
    const b = k.getBoundingClientRect();
    const seen = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left));
    return `${k.classList.contains('now-tab') ? 'NOW' : k.textContent}${k.classList.contains('active') ? '*' : ''}[${Math.round(b.left - r.left)}..${Math.round(b.right - r.left)}${seen < b.width - 0.5 ? ` seen ${Math.round(seen)}` : ''}]`;
  });
  const now = document.getElementById(wide ? 'rail-now' : 'dock-now');
  const fest = document.getElementById(wide ? 'rail-fest-name' : 'dock-fest-name');
  return {
    row: `${Math.round(r.width)}w scroll ${Math.round(row.scrollLeft)}/${row.scrollWidth - row.clientWidth} ${['overflowing', 'more-left', 'more-right'].filter((c) => row.classList.contains(c)).join(' ')}`,
    kids: kids.join(' '),
    now: now.hidden ? 'hidden' : `${now.parentElement === row ? 'in the row' : 'outside the row'} after ${(now.previousElementSibling || {}).textContent || '(start)'}`,
    festCut: fest.scrollWidth > fest.clientWidth + 1,
  };
});
const dockShot = async (page, name) => {
  const wide = await page.evaluate(() => innerWidth >= 720);
  const box = await page.locator(wide ? '#day-rail' : '#dock').boundingBox();
  const pad = 70;
  const clip = wide
    ? { x: 0, y: Math.max(0, box.y), width: box.width, height: box.height + pad }
    : { x: 0, y: Math.max(0, box.y - pad), width: box.width, height: box.height + pad };
  await page.screenshot({ path: path.join(OUT, name), clip });
};
const scenario = async (name, fn) => {
  if (only && !name.startsWith(only)) return;
  note(`\n== ${name}`);
  try { await fn(); } catch (e) { note(`FAIL ${name}: ${String(e).slice(0, 600)}`); }
};
const done = async ({ ctx, errors }) => { if (errors.length) note(`errors: ${JSON.stringify(errors)}`); await ctx.close(); };

// ---- the dock at rest --------------------------------------------------------------
for (const [label, at, fest] of [
  ['sat-live', AT.sat1030pm, 'portola-2026'],
  ['sat-nothing', AT.sat9am, 'portola-2026'],
  ['sun-live', AT.sun3pm, 'portola-2026'],
  ['thu-live', AT.thu11pm, 'portola-2026'],
  ['acl-sat-live', AT.aclSat8pm, 'acl-2026'],
]) {
  for (const width of [320, 375, 390, 430, 1280]) {
    await scenario(`rest ${label} ${width}`, async () => {
      const o = await open({ width, height: width >= 720 ? 800 : 844, at, fest });
      const n = await dockNumbers(o.page);
      note(`${n.row} | ${n.kids} | NOW ${n.now}${n.festCut ? ' | FEST NAME CUT' : ''}`);
      await dockShot(o.page, `rest-${label}-${width}.png`);
      await done(o);
    });
  }
}

// ---- motion: NOW arrives, NOW leaves (filmed at a tenth of the speed) ------------------
// The clock moves (window.__clockTo) and the page is told it is visible again —
// the minute ticker's other door — so the app re-reads what is live.
const strip = async (page, name, { frames = 14, every = 150 } = {}) => {
  const box = await page.locator('#dock').boundingBox();
  const shots = [];
  for (let i = 0; i < frames; i++) {
    shots.push(await page.screenshot({ clip: { x: 0, y: box.y, width: box.width, height: box.height } }));
    await sleep(every);
  }
  // One PNG per frame; the contact sheet is sheets.py's job (python, below).
  shots.forEach((b, i) => fs.writeFileSync(path.join(OUT, `${name}-${String(i).padStart(2, '0')}.png`), b));
};
const slow = async (page, rate) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
};
const moveClock = (page, iso) => page.evaluate((t) => { window.__clockTo(t); document.dispatchEvent(new Event('visibilitychange')); }, iso);
for (const width of [390, 320]) {
  await scenario(`motion arrive ${width}`, async () => {
    const o = await open({ width, at: AT.sat9am });
    note(`before: ${JSON.stringify(await dockNumbers(o.page))}`);
    await slow(o.page, 0.1);
    await moveClock(o.page, AT.sat1030pm);
    await strip(o.page, `motion-arrive-${width}`);
    await sleep(800);
    note(`after: ${JSON.stringify(await dockNumbers(o.page))}`);
    await done(o);
  });
  await scenario(`motion leave ${width}`, async () => {
    const o = await open({ width, at: AT.sun3pm });
    note(`before: ${JSON.stringify(await dockNumbers(o.page))}`);
    await slow(o.page, 0.1);
    await moveClock(o.page, AT.mon5am);
    await strip(o.page, `motion-leave-${width}`, { frames: 24 });
    await sleep(800);
    note(`after: ${JSON.stringify(await dockNumbers(o.page))}`);
    await done(o);
  });
}
await scenario('motion reduce 390', async () => {
  const o = await open({ width: 390, at: AT.sat9am, reduce: true });
  await moveClock(o.page, AT.sat1030pm);
  await sleep(60);
  note(`60ms after the clock: ${JSON.stringify(await dockNumbers(o.page))}; animations on the row: ${await o.page.evaluate(() => document.getElementById('dock-days').getAnimations({ subtree: true }).length)}`);
  await dockShot(o.page, 'motion-reduce-390.png');
  await done(o);
});

// ---- a NOW tap and a day switch ---------------------------------------------------------
for (const width of [390, 320, 1280]) {
  await scenario(`tap ${width}`, async () => {
    const o = await open({ width, height: width >= 720 ? 800 : 844 });
    await o.page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    await o.page.locator(width >= 720 ? '#rail-now' : '#dock-now').click();
    await sleep(1600);
    const line = await o.page.evaluate(() => { const l = document.querySelector('#wall-root .now-line'); return l ? Math.round(l.getBoundingClientRect().top) : null; });
    note(`NOW tapped: the now line at y=${line} of ${width >= 720 ? 800 : 844}; ${JSON.stringify(await dockNumbers(o.page))}`);
    await o.page.screenshot({ path: path.join(OUT, `tap-${width}.png`) });
    // A day switch: FRI, then back to SAT through its tab.
    const pre = width >= 720 ? '#rail-days' : '#dock-days';
    await o.page.locator(`${pre} .day-tab[data-day="Friday"]`).click();
    await sleep(1600);
    note(`FRI tapped: ${JSON.stringify(await dockNumbers(o.page))}`);
    await dockShot(o.page, `switch-fri-${width}.png`);
    await o.page.locator(`${pre} .day-tab[data-day="Saturday"]`).click();
    await sleep(1600);
    note(`SAT tapped: ${JSON.stringify(await dockNumbers(o.page))}`);
    await dockShot(o.page, `switch-sat-${width}.png`);
    await done(o);
  });
}

// ---- the show menu: stays up while you choose; its ways out; the gear ---------------------
for (const width of [390, 320, 1280]) {
  await scenario(`menu ${width}`, async () => {
    const o = await open({ width, height: width >= 720 ? 800 : 844, at: AT.sat9am });
    const { page } = o;
    const door = width >= 720 ? 'rail' : 'dock';
    const link = page.locator(`#${door}-fest-link`);
    const pop = page.locator(`#${door}-fest-wrap .sort-pop`);
    const tap = (loc) => (width >= 720 ? loc.click() : loc.tap());
    const state = () => page.evaluate((d) => ({
      open: document.querySelector(`#${d}-fest-wrap .sort-pop`).style.display !== 'none',
      checks: [...document.querySelectorAll(`#${d}-fest-wrap .sort-pop [data-room]`)].map((r) => `${r.textContent}:${r.getAttribute('aria-selected')}`).join(' '),
      rooms: [...new Set([...document.querySelectorAll('#wall-root .room[data-room]')].map((r) => r.dataset.room))].join(','),
      hist: history.length, state: JSON.stringify(history.state),
    }), door);
    const h0 = await state();
    note(`closed: ${JSON.stringify(h0)}`);
    await tap(link);
    await sleep(500);
    note(`open: ${JSON.stringify(await state())}`);
    const gear = await page.evaluate((d) => {
      const row = document.querySelector(`#${d}-fest-wrap .sort-pop .settings`);
      const g = row.querySelector('svg.gear').getBoundingClientRect();
      const w = row.children[1].getBoundingClientRect();
      const room = document.querySelector(`#${d}-fest-wrap .sort-pop [data-room] span:nth-child(2)`).getBoundingClientRect();
      return { gear: [Math.round(g.width), Math.round(g.height)], gearMid: Math.round(g.top + g.height / 2), wordMid: Math.round(w.top + w.height / 2), wordLeft: Math.round(w.left), roomLeft: Math.round(room.left), color: getComputedStyle(row.querySelector('.check')).color };
    }, door);
    note(`gear: ${JSON.stringify(gear)}`);
    await page.screenshot({ path: path.join(OUT, `menu-open-${width}.png`) });
    await tap(pop.locator('[data-room="Afters"]'));
    await sleep(700);
    await tap(pop.locator('[data-room="Folsom"]'));
    await sleep(700);
    note(`two rooms ticked off: ${JSON.stringify(await state())}`);
    await page.screenshot({ path: path.join(OUT, `menu-two-off-${width}.png`) });
    // A tap outside, on a card clear of the menu: the menu goes and the card
    // is not picked (the card's own markup is unchanged, and its artist).
    const target = await page.evaluate((d) => {
      const m = document.querySelector(`#${d}-fest-wrap .sort-pop`).getBoundingClientRect();
      const dock = document.getElementById('dock').getBoundingClientRect();
      const bottom = innerWidth >= 720 ? innerHeight : dock.top;
      const c = [...document.querySelectorAll('#wall-root .card[data-artist]')].find((el) => {
        const r = el.getBoundingClientRect();
        const clear = r.right < m.left || r.left > m.right || r.bottom < m.top || r.top > m.bottom;
        return clear && r.top > 120 && r.bottom < bottom - 10 && r.left >= 0 && r.right <= innerWidth;
      });
      const r = c.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { artist: c.dataset.artist, x: r.left + r.width / 2, y: r.top + r.height / 2, html: c.outerHTML, onCard: c.contains(hit) };
    }, door);
    if (width >= 720) await page.mouse.click(target.x, target.y);
    else await page.touchscreen.tap(target.x, target.y);
    await sleep(600);
    const after = await page.evaluate((a) => document.querySelector(`#wall-root .card[data-artist="${a}"]`).outerHTML, target.artist);
    note(`tap outside on ${target.artist} (on the card: ${target.onCard}): ${JSON.stringify(await state())}; the card unchanged: ${target.html === after}`);
    // Escape and Back.
    await tap(link); await sleep(400);
    await page.keyboard.press('Escape'); await sleep(500);
    note(`Escape: ${JSON.stringify(await state())}`);
    await tap(link); await sleep(400);
    await page.goBack(); await sleep(600);
    note(`Back: ${JSON.stringify(await state())} (the app is still up: ${await page.locator('#screen-app').isVisible()})`);
    // Settings from the menu, then Back.
    await tap(link); await sleep(400);
    await tap(pop.locator('.settings'));
    await sleep(600);
    note(`Settings: settings up ${await page.locator('#screen-settings').isVisible()} ${JSON.stringify(await state())}`);
    await page.goBack(); await sleep(700);
    note(`Back from Settings: wall ${await page.locator('#screen-app').isVisible()} ${JSON.stringify(await state())}`);
    // Put the rooms back through the menu, and film the menu at rest.
    await tap(link); await sleep(400);
    await tap(pop.locator('[data-room="Afters"]')); await sleep(600);
    await tap(pop.locator('[data-room="Folsom"]')); await sleep(600);
    const wrapBox = await page.locator(`#${door}-fest-wrap .sort-pop`).boundingBox();
    const clip = { x: Math.max(0, wrapBox.x - 20), y: Math.max(0, wrapBox.y - 20), width: Math.min(wrapBox.width + 40, width - Math.max(0, wrapBox.x - 20)), height: wrapBox.height + 90 };
    await page.screenshot({ path: path.join(OUT, `menu-close-up-${width}.png`), clip });
    await done(o);
  });
}

fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n');
await browser.close();
server.close();
