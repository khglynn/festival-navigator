// v94 walk (2026-09-25): Folsom weekend BY TIME, in a real Chromium — real
// touch (hasTouch + isMobile, locator.tap, a CDP touch hold) at 390 and 320,
// a real mouse at 1280. The clock is pinned to Friday 11:30 PM PT: tonight.
//
// What it walks, per the v94 brief: the night in start order under its bands,
// a pick (the card keeps its band, its label and its ring), the zoom by hold
// (Tix/Info, − · note · +), the room head's note door (Folsom · Friday), NOW
// landing in a time list, a highlight dimming, the show menu hiding and
// bringing back Folsom, a share link's `&show=folsom`, a night without the
// section (Thursday), Saturday under the clock, hover at 1280, Reduce Motion.
//
// The data: FIXTURE=<path to a portola-2026.json> walks that file — the
// design round's 68-party fixture is
//   <portola-live>/claude-plans/2026-09-25-portola-live/design/folsom-by-time/fixture/portola-2026.json
// — else the repo's own file (Folsom as it is today). NEVER production: this
// server answers /api from memory (a made-up crew), /fn-i is swallowed, the
// service worker is blocked, and every write is recorded, never kept.
// Run from the repo: [FIXTURE=…] node claude-plans/2026-09-25-portola-live/v94-walk.mjs [only]
// Shots and the report land in v94-shots/ (git-ignored).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.WALK_ROOT || path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'v94-shots');
fs.mkdirSync(OUT, { recursive: true });
const { launchBrowser } = await import('../../tests/helpers/browser.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || null;

const FID = 'portola-2026';
const FIXTURE = process.env.FIXTURE || null;
if (FIXTURE && !fs.existsSync(FIXTURE)) throw new Error(`no fixture at ${FIXTURE}`);
const FEST = JSON.parse(fs.readFileSync(FIXTURE || path.join(WT, 'data/festivals/portola-2026.json'), 'utf8'));
const has = (name) => FEST.artists.some((a) => a.name === name);
// A made-up crew: parser-shaped, obviously fake, never a real link.
const TOKEN = 'v94walkCREWdemo_01234567';
const DOC = {
  v: 4, meta: { name: 'The Folsom Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 }, Priya: { colorIndex: 9 } },
  festivals: { [FID]: { selections: Object.fromEntries(Object.entries({
    Magnitude: { Kevin: 4, Maya: 3 }, 'PERVERT XXL': { Kevin: 3, Jonah: 4 }, 'BRUT SF': { Jonah: 3, Priya: 2 },
    'MÜLL': { Kevin: 4 }, 'Folsom Street Fair': { Kevin: 4, Maya: 4, Jonah: 4, Priya: 3 }, 'Horse Meat Disco': { Maya: 3 },
    Stank: { Maya: 2 }, 'Such a Good Girl': { Priya: 4 },
  }).filter(([n]) => has(n))) } },
};
const writes = [];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p0 = decodeURIComponent(u.pathname);
  if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (req.method !== 'GET') writes.push(`${req.method} ${p0}`);
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      res.writeHead(p0 === '/api/crew' && u.searchParams.get('t') === TOKEN ? 200 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(p0 === '/api/crew' ? DOC : {}));
    });
    return;
  }
  let p = p0 === '/' ? '/index.html' : p0;
  if (p.startsWith('/f/')) p = '/index.html';
  let file = FIXTURE && p === `/data/festivals/${FID}.json` ? FIXTURE : path.join(WT, p);
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser();
if (!browser) throw new Error('no browser');
const FRI_1130PM = '2026-09-26T06:30:00Z';
const report = [];
const note = (s) => { report.push(s); console.log(s); };
const tag = FIXTURE ? 'fixture' : 'file';

async function open({ width, height, touch, member = true, hash = '', reduced = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((t) => {
    const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
  }, FRI_1130PM);
  if (member) await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Folsom Crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      localStorage.setItem('fn_welcome_v1', '1');
    } catch { /* storage blocked */ }
  }, TOKEN);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/f/${FID}#g=${TOKEN}&f=${FID}${hash}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await sleep(1600);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
const room = (day) => `#wall-root .day-block[data-day="${day}"] .room[data-room="Folsom"]`;
const toRoom = async (page, day, lead = 0) => {
  await page.evaluate(([sel, lead]) => {
    const r = document.querySelector(sel);
    const rail = document.querySelector('.day-rail');
    const chrome = rail && rail.offsetParent ? rail.getBoundingClientRect().height : 0;
    window.scrollTo(0, Math.max(0, r.getBoundingClientRect().top + window.scrollY - chrome - 8 - lead));
  }, [room(day), lead]);
  await sleep(500);
};
const bands = (page, day) => page.evaluate((sel) => [...document.querySelectorAll(`${sel} .time-band`)]
  .map((b) => `${b.querySelector('.band-head .label').textContent}:${b.querySelectorAll('.card').length}`), room(day));
const levelOf = (page, day, artist) => page.evaluate(([sel, a]) => {
  const c = document.querySelector(`${sel} .card[data-artist="${CSS.escape(a)}"]`);
  return c ? { label: c.getAttribute('aria-label'), band: c.closest('.time-band').dataset.band, time: c.dataset.time, now: c.classList.contains('now') } : null;
}, [room(day), artist]);
async function hold(ctx, page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await sleep(250);
  const b = await locator.boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const pt = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 5000 }).catch(() => {});
  await sleep(200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(900);
  await cdp.detach();
}
const scenario = async (name, fn) => {
  if (only && !name.includes(only)) return;
  writes.length = 0;
  note(`\n== ${name}`);
  try { await fn(); } catch (e) { note(`FAIL ${name}: ${String(e).slice(0, 600)}`); }
};

for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} touch — tonight, FRI FOLSOM by time`, async () => {
    const { ctx, page, errors } = await open({ width: W, height: H, touch: true });
    const days = await page.evaluate(() => [...document.querySelectorAll('#wall-root .day-block')].map((b) => `${b.dataset.day}:${[...b.querySelectorAll(':scope > .room')].map((r) => r.dataset.room).join('+')}`));
    note(`days/rooms: ${JSON.stringify(days)} (Thursday has no Folsom room: ${!days.find((d) => d.startsWith('Thursday')).includes('Folsom')})`);
    note(`FRI bands: ${JSON.stringify(await bands(page, 'Friday'))}; SAT: ${JSON.stringify(await bands(page, 'Saturday'))}; SUN: ${JSON.stringify(await bands(page, 'Sunday'))}`);
    note(`venue stacks inside Folsom: ${await page.locator('#wall-root .room[data-room="Folsom"] .venue-grid').count()}; time lists: ${await page.locator('#wall-root .room[data-room="Folsom"] .time-list').count()}; rings tonight: ${await page.locator(`${room('Friday')} .card.now`).count()}`);
    await toRoom(page, 'Friday');
    await shot(page, `${tag}-a-fri-folsom-${W}.png`);

    // A finger's tap picks: the card is repainted where it was, in its band.
    const target = has('Stank') ? 'Stank' : 'BRUT SF';
    const before = await levelOf(page, 'Friday', target);
    await page.locator(`${room('Friday')} .card[data-artist="${target}"]`).tap();
    await sleep(900);
    const after = await levelOf(page, 'Friday', target);
    note(`tap ${target}: ${before.label} → ${after.label}; band ${before.band} → ${after.band}; time kept ${before.time === after.time}; ring kept ${before.now === after.now}`);
    await shot(page, `${tag}-b-fri-picked-${W}.png`);

    // A hold opens the card: its place, Tix/Info, − · note · +.
    const zoomed = has('BRUT SF') ? 'BRUT SF' : target;
    await hold(ctx, page, page.locator(`${room('Friday')} .card[data-artist="${zoomed}"]`));
    const z = await page.evaluate(() => {
      const zc = document.querySelector('.zoom-card');
      return zc ? { where: (zc.querySelector('.f-where') || {}).textContent, links: [...zc.querySelectorAll('.f-links a')].map((a) => a.textContent), row: [...zc.querySelectorAll('.f-chips button')].map((b) => b.textContent.trim()) } : null;
    });
    note(`hold ${zoomed}: ${JSON.stringify(z)}`);
    await shot(page, `${tag}-c-fri-zoom-${W}.png`);
    await page.keyboard.press('Escape');
    await sleep(600);

    // The room head is the door to Folsom on Friday.
    await toRoom(page, 'Friday');
    await page.locator(`${room('Friday')} .room-head`).tap();
    await sleep(900);
    note(`head → sheet open: ${await page.locator('#sheet-backdrop').count() > 0}; title: ${JSON.stringify(await page.locator('.sheet .sheet-title, .sheet h2, .sheet .title').first().textContent().catch(() => null))}`);
    await shot(page, `${tag}-d-fri-head-notes-${W}.png`);
    await page.keyboard.press('Escape');
    await sleep(700);

    // NOW: tap until it lands in the time list.
    const nowBtn = page.locator('#dock-now');
    note(`NOW visible: ${await nowBtn.isVisible()}`);
    for (let i = 0; i < 6 && (await nowBtn.isVisible()); i++) {
      await nowBtn.tap();
      await sleep(1300);
      const landed = await page.evaluate(() => {
        const pulsed = [...document.querySelectorAll('#wall-root .card.now')].filter((c) => { const r = c.getBoundingClientRect(); return r.top > 40 && r.bottom < innerHeight - 60; });
        return pulsed.map((c) => `${c.dataset.artist}@${c.closest('.room').dataset.room}`).slice(0, 4);
      });
      note(`NOW tap ${i + 1}: y=${await page.evaluate(() => Math.round(scrollY))} in view: ${JSON.stringify(landed)}; said: ${JSON.stringify(await page.locator('#now-status').textContent().catch(() => ''))}`);
      if (landed.some((s) => s.endsWith('@Folsom'))) { await shot(page, `${tag}-e-now-in-folsom-${W}.png`); break; }
    }

    // A highlight dims; it never takes a card away.
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    const chip = page.locator('#person-chips .person-chip', { hasText: 'Maya' }).first();
    if (await chip.count()) {
      await chip.tap();
      await sleep(800);
      await toRoom(page, 'Friday');
      note(`Maya highlighted: FRI FOLSOM cards ${await page.locator(`${room('Friday')} .card`).count()}, dimmed ${await page.locator(`${room('Friday')} .card.dim`).count()}, lit ${JSON.stringify(await page.locator(`${room('Friday')} .card:not(.dim)`).evaluateAll((cs) => cs.map((c) => c.dataset.artist)))}`);
      await shot(page, `${tag}-f-highlight-${W}.png`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      await chip.tap();
      await sleep(600);
    }

    // SAT FOLSOM under the clock, with the afters above.
    await toRoom(page, 'Saturday', 240);
    await shot(page, `${tag}-g-sat-under-clock-${W}.png`);
    const geo = await page.evaluate((sel) => {
      const cs = [...document.querySelectorAll(`${sel} .card`)].map((c) => c.getBoundingClientRect());
      const head = document.querySelector(`${sel} .room-head`).getBoundingClientRect();
      return { lefts: [...new Set(cs.map((r) => Math.round(r.left)))], width: [...new Set(cs.map((r) => Math.round(r.width)))], maxRight: Math.max(...cs.map((r) => Math.round(r.right))), head: Math.round(head.left), vw: innerWidth, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, room('Saturday'));
    note(`SAT geometry: ${JSON.stringify(geo)}`);
    note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

await scenario('390 touch — the show menu hides Folsom and brings it back; a share link with show=folsom', async () => {
  const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true });
  await page.locator('#dock-fest-link').tap();
  await sleep(700);
  await shot(page, `${tag}-h-show-menu-390.png`);
  await page.locator('#dock-fest-wrap .sort-pop [data-room="Folsom"]').tap();
  await sleep(1200);
  note(`Folsom hidden: rooms left ${await page.locator('#wall-root .room[data-room="Folsom"]').count()}`);
  await page.locator('#dock-fest-link').tap();
  await sleep(600);
  await page.locator('#dock-fest-wrap .sort-pop [data-room="Folsom"]').tap();
  await sleep(1400);
  note(`Folsom back: rooms ${await page.locator('#wall-root .room[data-room="Folsom"]').count()}, time lists ${await page.locator('#wall-root .room[data-room="Folsom"] .time-list').count()}`);
  await page.keyboard.press('Escape');
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
  // A phone that has never shown this festival (a guest opening a friend's
  // link): v92 seeds the fold from `show` only there, once.
  const link = await open({ width: 390, height: 844, touch: true, member: false, hash: '&show=folsom' });
  const rooms = await link.page.evaluate(() => [...new Set([...document.querySelectorAll('#wall-root .room')].map((r) => r.dataset.room))]);
  note(`a fresh phone opening &show=folsom sees rooms: ${JSON.stringify(rooms)}; time lists ${await link.page.locator('#wall-root .time-list').count()}`);
  await shot(link.page, `${tag}-i-show-folsom-link-390.png`);
  note(`errors: ${JSON.stringify(link.errors)}`);
  await link.ctx.close();
});

await scenario('1280 mouse — hover zooms, a click picks, Saturday sits under the clock', async () => {
  const { ctx, page, errors } = await open({ width: 1280, height: 860, touch: false });
  await toRoom(page, 'Friday');
  await shot(page, `${tag}-j-fri-1280.png`);
  const card = page.locator(`${room('Friday')} .card`).nth(2);
  const name = await card.getAttribute('data-artist');
  const b = await card.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await sleep(1300);
  note(`hover ${name}: zoom ${await page.locator('#zoom-layer .zoom-slot.shown').count()}`);
  await shot(page, `${tag}-k-hover-1280.png`);
  const before = await levelOf(page, 'Friday', name);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(900);
  note(`click ${name}: ${before.label} → ${(await levelOf(page, 'Friday', name)).label}`);
  await page.mouse.move(5, 400, { steps: 6 });
  await sleep(700);
  await toRoom(page, 'Saturday', 380);
  await shot(page, `${tag}-l-sat-under-clock-1280.png`);
  const cols = await page.evaluate((sel) => {
    const clock = [...document.querySelectorAll('.day-block[data-day="Saturday"] .tt-block .times-wrap:not(.stage-strip) .times-grid > .card')].map((c) => Math.round(c.getBoundingClientRect().left));
    const list = [...document.querySelectorAll(`${sel} .card`)].map((c) => Math.round(c.getBoundingClientRect().left));
    return { clock: [...new Set(clock)].sort((a, c) => a - c), list: [...new Set(list)].sort((a, c) => a - c) };
  }, room('Saturday'));
  note(`1280 columns: clock ${JSON.stringify(cols.clock)} · SAT FOLSOM ${JSON.stringify(cols.list)}`);
  note(`writes: ${JSON.stringify(writes)}; errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await scenario('390 Reduce Motion — the list is the list, a pick is instant', async () => {
  const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true, reduced: true });
  await toRoom(page, 'Friday');
  const target = has('Stank') ? 'Stank' : 'BRUT SF';
  await page.locator(`${room('Friday')} .card[data-artist="${target}"]`).tap();
  await sleep(300);
  note(`reduced: ${JSON.stringify(await levelOf(page, 'Friday', target))}`);
  await shot(page, `${tag}-m-reduced-390.png`);
  note(`errors: ${JSON.stringify(errors)}`);
  await ctx.close();
});

await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, `walk-${tag}.txt`), report.join('\n') + '\n');
console.log(`\nreport: ${path.join(OUT, `walk-${tag}.txt`)}`);
