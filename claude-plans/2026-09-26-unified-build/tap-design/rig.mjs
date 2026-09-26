// The tap change — the frame rig (2026-09-26).
//
// Renders the notes shelf a finger's tap opens, through the PRODUCTION app —
// this worktree's own index.html, CSS and card — in a real Chromium (and
// WebKit where asked): phones with touch at 390 and 320, a mouse at 1280, 2x.
// Frames go to ./frames beside this file (images are gitignored: send paths).
//
// NEVER production: this server answers /api from memory with a MADE-UP crew
// (no real names, no real token), refuses every write (and records it),
// swallows /fn-i, and the service worker is blocked. One browser, closed at the
// end.
//
// Run from the worktree: node claude-plans/2026-09-26-unified-build/tap-design/rig.mjs [only] [--webkit] [--slow]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../../..');
const OUT = path.join(HERE, 'frames');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--')) || null;
const ENGINE = args.includes('--webkit') ? 'webkit' : 'chromium';
const SLOW = args.includes('--slow');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FID = 'portola-2026';
// A made-up crew: parser-shaped, obviously fake, never a real link.
const TOKEN = 'tapDesignCREWdemo_0123456';
const ts = (h, m) => `2026-09-26T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const note = (author, h, m, text, re) => [`${author}.${Date.parse(ts(h, m))}.a${h}${m}`, re ? { author, ts: ts(h, m), text, re } : { author, ts: ts(h, m), text }];
const robynThread = Object.fromEntries([
  note('Maya', 17, 2, 'Robyn at golden hour on the pier. Non-negotiable.'),
  note('Jonah', 17, 9, 'Dancing On My Own into the sunset, I will cry, you will cry'),
  note('Priya', 17, 30, 'Meet at the sound booth after Tove Lo? We can walk over together.'),
  note('Theo', 18, 4, 'I’m in but leaving at 8 sharp for Dog Blood'),
  note('Rosa', 18, 20, 'She played Call Your Girlfriend twice at Primavera. Twice.'),
  note('Maya', 18, 40, 'Bringing the flags. Somebody bring sunscreen, the pier has zero shade before 6.'),
  note('Jonah', 19, 1, 'Water refill station is behind the Pier Stage bar'),
]);
const DOC = {
  v: 4, meta: { name: 'The Pier Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 }, Priya: { colorIndex: 9 }, Theo: { colorIndex: 12 }, Rosa: { colorIndex: 15 } },
  festivals: { [FID]: {
    selections: {
      Robyn: { Maya: 4, Jonah: 4, Priya: 3, Theo: 2, Rosa: 3 },
      'Dog Blood': { Kevin: 3, Theo: 4, Jonah: 2 },
      'Tove Lo': { Maya: 3, Priya: 2 },
      'Boys Noize': { Theo: 2 },
    },
    notes: { artist: { Robyn: robynThread, 'Dog Blood': Object.fromEntries([note('Theo', 16, 0, 'Front left, by the subs')]) } },
  } },
};
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
      if (req.method !== 'GET') writes.push(`${req.method} ${p0}`);
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew') {
        if (u.searchParams.get('t') !== TOKEN) return send(404, { error: 'Crew not found' });
        if (req.method !== 'GET') return send(503, { error: 'design rig: writes refused' });
        return send(200, DOC);
      }
      return send(404, {});
    });
    return;
  }
  let p = p0 === '/' ? '/index.html' : p0;
  if (p.startsWith('/f/')) p = '/index.html';
  let file = path.join(APP, p);
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const pw = await import('playwright');
const browser = await pw[ENGINE].launch({ headless: true });
const SAT_3PM = '2026-09-26T22:00:00Z'; // Saturday of Portola, 3 PM PT
const report = [];
const say = (s) => { report.push(s); console.log(s); };

async function open({ width, height, touch, guest = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch && ENGINE === 'chromium', serviceWorkers: 'block' });
  await ctx.addInitScript((t) => {
    const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
  }, SAT_3PM);
  await ctx.addInitScript(([t, isGuest]) => {
    try {
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_welcome_joined_v1', '1');
      if (isGuest) return;
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Pier Crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    } catch { /* storage blocked */ }
  }, [TOKEN, guest]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/f/${FID}#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await sleep(1200);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}
const cardSel = (name) => `#wall-root .card[data-artist="${name}"]`;
async function bring(page, name) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.scrollIntoView({ block: 'center', inline: 'center' });
  }, cardSel(name));
  await sleep(350);
  const box = await page.locator(cardSel(name)).first().boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  say(`  frame ${name}.png`);
}
async function tapCard(page, name) {
  const at = await bring(page, name);
  await page.touchscreen.tap(at.x, at.y);
  await sleep(SLOW ? 3000 : 700);
}
async function tapIn(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(SLOW ? 3000 : 600);
}
const shelfInfo = (page) => page.evaluate(() => {
  const s = document.getElementById('artist-sheet');
  if (!s) return null;
  const r = s.getBoundingClientRect();
  const row = s.querySelector('.f-step-row');
  const rr = row ? row.getBoundingClientRect() : null;
  return { top: Math.round(r.top), h: Math.round(r.height), rowY: rr ? Math.round(rr.top) : null, meter: s.querySelector('.f-meter')?.dataset.level ?? null, minusOff: !!s.querySelector('.f-step.minus')?.disabled, plusOff: !!s.querySelector('.f-step.plus')?.disabled };
});

const flows = {
  async member390() {
    const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true });
    await tapCard(page, 'Robyn');
    say(`  Robyn open: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-390-member-robyn-open`);
    await tapIn(page, '#artist-sheet .f-step.plus');
    say(`  after +: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-390-member-robyn-plus1`);
    await tapIn(page, '#artist-sheet .f-step.plus');
    await tapIn(page, '#artist-sheet .f-step.plus');
    await tapIn(page, '#artist-sheet .f-step.plus');
    say(`  after + x4: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-390-member-robyn-must`);
    await page.evaluate(() => { const s = document.getElementById('artist-sheet'); s.scrollTop = s.scrollHeight; });
    await sleep(300);
    await shot(page, `${ENGINE}-390-member-robyn-thread-end`);
    // Back to the wall: the backdrop closes it, and the resting card shows your MUST.
    await page.touchscreen.tap(195, 60);
    await sleep(700);
    await shot(page, `${ENGINE}-390-member-robyn-closed`);
    await tapCard(page, 'Boys Noize');
    say(`  Boys Noize open: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-390-member-boysnoize-doors`);
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  },
  // A card nobody has picked, on a sheet shorter than its cap: the first +
  // brings the who-row, the card grows UPWARD (the sheet's top rises) and
  // the row stays under the finger.
  async grows390() {
    const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true });
    await tapCard(page, 'Oskar Med K');
    const a = await shelfInfo(page);
    say(`  Oskar open: ${JSON.stringify(a)}`);
    await shot(page, `${ENGINE}-390-member-unpicked-open`);
    await tapIn(page, '#artist-sheet .f-step.plus');
    const b = await shelfInfo(page);
    say(`  after +: ${JSON.stringify(b)} — row moved ${b.rowY - a.rowY}px, top rose ${a.top - b.top}px`);
    await shot(page, `${ENGINE}-390-member-unpicked-plus1`);
    await tapIn(page, '#artist-sheet .f-step.minus');
    const c = await shelfInfo(page);
    say(`  after −: ${JSON.stringify(c)} — row moved ${c.rowY - a.rowY}px from the first`);
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  },
  // The motion, slowed ×10 (CDP): the shelf rising from a tap, then one +.
  async motion390() {
    if (ENGINE !== 'chromium') return;
    const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Animation.enable');
    const at = await bring(page, 'Oskar Med K');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
    await page.touchscreen.tap(at.x, at.y);
    for (let i = 0; i < 8; i++) { await shot(page, `${ENGINE}-390-motion-arrive-${i}`); await sleep(420); }
    await sleep(1500);
    const b = await page.locator('#artist-sheet .f-step.plus').boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    for (let i = 0; i < 8; i++) { await shot(page, `${ENGINE}-390-motion-plus-${i}`); await sleep(450); }
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  },
  // The alternative to call 1, for the decision: the bare − and + with nothing between.
  async alt390() {
    const { ctx, page } = await open({ width: 390, height: 844, touch: true });
    await page.addStyleTag({ content: '.sheet-card .f-step-row > .f-meter { visibility: hidden; }' });
    await tapCard(page, 'Oskar Med K');
    await tapIn(page, '#artist-sheet .f-step.plus');
    await tapIn(page, '#artist-sheet .f-step.plus');
    await shot(page, `${ENGINE}-390-ALT-no-meter-plus2`);
    await ctx.close();
  },
  async member320() {
    const { ctx, page, errors } = await open({ width: 320, height: 568, touch: true });
    await tapCard(page, 'Boys Noize');
    await shot(page, `${ENGINE}-320-member-boysnoize-doors`);
    await page.touchscreen.tap(160, 40);
    await sleep(700);
    await tapCard(page, 'Robyn');
    say(`  Robyn open 320: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-320-member-robyn-open`);
    await tapIn(page, '#artist-sheet .f-step.plus');
    say(`  after + 320: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-320-member-robyn-plus1`);
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  },
  async guest390() {
    const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true, guest: true });
    await tapCard(page, 'Robyn');
    say(`  guest Robyn: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-390-guest-robyn-open`);
    await page.evaluate(() => { const s = document.getElementById('artist-sheet'); s.scrollTop = s.scrollHeight; });
    await sleep(300);
    await shot(page, `${ENGINE}-390-guest-robyn-thread-end`);
    await page.evaluate(() => { const s = document.getElementById('artist-sheet'); s.scrollTop = 0; });
    await tapIn(page, '#artist-sheet .f-step.plus');
    await shot(page, `${ENGINE}-390-guest-robyn-plus-asks`);
    say(`  history after + : ${await page.evaluate(() => JSON.stringify(history.state))} length ${await page.evaluate(() => history.length)}`);
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  },
  async keyboard390() {
    // The keys up, the way the page sees them where they resize the viewport
    // (Android): 844 - 336. iOS rides the visual viewport instead — Kevin's
    // phone is the check there.
    const { ctx, page, errors } = await open({ width: 390, height: 508, touch: true });
    await tapCard(page, 'Robyn');
    await page.evaluate(() => document.querySelector('#artist-sheet .composer textarea').scrollIntoView({ block: 'nearest' }));
    await sleep(200);
    await tapIn(page, '#artist-sheet .composer textarea');
    await page.keyboard.type('Pier by 6:45, flags up');
    await sleep(400);
    await shot(page, `${ENGINE}-390-member-robyn-typing`);
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  },
  async desktop1280() {
    const { ctx, page, errors } = await open({ width: 1280, height: 800, touch: false });
    const at = await bring(page, 'Robyn');
    await page.mouse.move(at.x - 40, at.y - 80);
    await page.mouse.move(at.x, at.y, { steps: 6 });
    await sleep(700);
    await shot(page, `${ENGINE}-1280-mouse-robyn-zoom`);
    await page.locator('#zoom-layer .f-step-row .f-chip.notes').click();
    await sleep(700);
    say(`  desktop shelf: ${JSON.stringify(await shelfInfo(page))}`);
    await shot(page, `${ENGINE}-1280-mouse-robyn-shelf`);
    await page.locator('#artist-sheet .f-step.plus').click();
    await sleep(600);
    await shot(page, `${ENGINE}-1280-mouse-robyn-shelf-plus1`);
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  },
};

try {
  for (const [name, run] of Object.entries(flows)) {
    if (only && !name.includes(only)) continue;
    say(`${ENGINE} ${name}`);
    await run();
  }
} finally {
  say(`writes seen (all refused): ${writes.length ? writes.join(', ') : 'none'}`);
  fs.writeFileSync(path.join(HERE, `rig-report-${ENGINE}.txt`), report.join('\n') + '\n');
  await browser.close();
  server.close();
}
