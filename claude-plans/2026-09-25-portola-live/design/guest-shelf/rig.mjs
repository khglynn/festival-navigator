// Guest-shelf design rig (2026-09-25). Renders the frames for BRIEF.md with
// the PRODUCTION app: a scratch copy of the v92 worktree (APP, below) with
// this round's prototype applied (proto.diff beside this file), in a real
// Chromium with touch (hasTouch + isMobile, locator.tap), at 2x.
//
// NEVER production: this server answers /api from memory with made-up crews,
// refuses every write (and records it), swallows /fn-i, and the service
// worker is blocked. One browser, closed at the end.
//
// Run: APP=/path/to/scratch-copy node rig.mjs [only-prefix]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP;
if (!APP || !fs.existsSync(path.join(APP, 'index.html'))) throw new Error('set APP to the scratch copy of the app');
const OUT = path.join(HERE, 'frames');
fs.mkdirSync(OUT, { recursive: true });
const { launchBrowser } = await import(path.join(APP, 'tests/helpers/browser.mjs'));
const { deepMerge } = await import(path.join(APP, 'js/merge.js'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || null;

const FID = 'portola-2026';
// Made-up crews: parser-shaped, obviously fake, never a real link.
const T = { crew: 'gsDesignCREWdemo_0123456', big: 'gsDesignBIGCREWdemo_01234' };
function demoDoc(kind = 'crew') {
  const people = { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 }, Priya: { colorIndex: 9 }, Theo: { colorIndex: 12 }, Rosa: { colorIndex: 15 } };
  if (kind === 'big') Object.assign(people, { Ana: { colorIndex: 1 }, Benedikt: { colorIndex: 4 }, Cy: { colorIndex: 7 }, Dot: { colorIndex: 10 }, Eli: { colorIndex: 13 }, Fay: { colorIndex: 16 } });
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
  put('Ranger Trucco b2b Alisha', { Rosa: 2, Priya: 1 });
  return { v: 4, meta: { name: 'The Portola Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people, festivals: { [FID]: { selections: sel } } };
}
let DOCS = {};
const resetDocs = () => { DOCS = { [T.crew]: demoDoc('crew'), [T.big]: demoDoc('big') }; };
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
      if (p0.startsWith('/fn-i/')) {
        // What the error door would have sent (event + message only; never the key).
        try { for (const ev of JSON.parse(raw).batch || []) writes.push(`fn-i ${ev.event} ${JSON.stringify((ev.properties || {}).$exception_list || (ev.properties || {}).message || '').slice(0, 300)}`); } catch { writes.push('fn-i ?'); }
        res.writeHead(204); res.end(); return;
      }
      if (req.method !== 'GET') writes.push(`${req.method} ${p0} ${raw.slice(0, 120)}`);
      if (p0 === '/api/crew') {
        const t = u.searchParams.get('t');
        if (!DOCS[t]) return send(404, { error: 'Crew not found' });
        // A member's pick merges into THIS PROCESS's memory only — a mock.
        if (req.method !== 'GET') DOCS[t] = deepMerge(DOCS[t], (JSON.parse(raw || '{}').data) || {});
        return send(200, DOCS[t]);
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
const browser = await launchBrowser();
const SAT_315PM = '2026-09-26T22:15:00Z'; // Portola Saturday, 3:15 PM PT
const report = [];
const note = (s) => { report.push(s); console.log(s); };

async function phone({ width = 390, height = 844, clock = SAT_315PM, member = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await ctx.addInitScript((t) => {
    const T0 = new Date(t).getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
  }, clock);
  if (member) await ctx.addInitScript(([t, name]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, name);
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    } catch { /* storage blocked */ }
  }, member);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
async function openWall(page, token, { welcome = true } = {}) {
  await page.goto(`${origin}/f/${FID}#g=${token}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  if (welcome) await page.waitForSelector('#welcome-card', { timeout: 6000 });
  await sleep(1500); // the card's arrival has finished
}
const box = (page, sel) => page.locator(sel).first().evaluate((n) => { const r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; });

// A phone keyboard, drawn (Chromium has none): iOS proportions at 390 — 336pt
// with the suggestion bar. The shelf rides on it the way a visualViewport
// listener would put it there.
async function keyboardUp(page, kb) {
  await page.evaluate((kb) => {
    const k = document.createElement('div');
    k.id = 'kb-mock';
    k.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${kb}px;z-index:100;background:#2C2C2E;padding:8px 3px 0;box-sizing:border-box;font:500 22px -apple-system,system-ui,sans-serif;color:#fff;`;
    const bar = document.createElement('div');
    bar.style.cssText = 'height:36px;display:flex;justify-content:space-around;align-items:center;color:#d0d0d4;font-size:16px;margin-bottom:6px;';
    bar.innerHTML = '<span>"Sam"</span><span style="opacity:.3">|</span><span>Same</span><span style="opacity:.3">|</span><span>Sammy</span>';
    k.appendChild(bar);
    const rows = ['qwertyuiop', 'asdfghjkl', '⇧zxcvbnm⌫'];
    for (const [i, r] of rows.entries()) {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;justify-content:center;gap:6px;margin:0 0 11px;padding:0 ${i === 1 ? 20 : 0}px;`;
      for (const ch of r) {
        const key = document.createElement('span');
        const wide = ch === '⇧' || ch === '⌫';
        key.textContent = ch;
        key.style.cssText = `flex:${wide ? '1.4' : '1'};height:43px;border-radius:5px;background:${wide ? '#5A5A5E' : '#6B6B70'};display:flex;align-items:center;justify-content:center;max-width:${wide ? 44 : 34}px;`;
        row.appendChild(key);
      }
      k.appendChild(row);
    }
    const last = document.createElement('div');
    last.style.cssText = 'display:flex;gap:6px;padding:0 0;';
    last.innerHTML = '<span style="flex:1.2;height:43px;border-radius:5px;background:#5A5A5E;display:flex;align-items:center;justify-content:center;font-size:16px">123</span><span style="flex:5;height:43px;border-radius:5px;background:#6B6B70;display:flex;align-items:center;justify-content:center;font-size:16px">space</span><span style="flex:1.6;height:43px;border-radius:5px;background:#0A84FF;display:flex;align-items:center;justify-content:center;font-size:16px">go</span>';
    k.appendChild(last);
    document.body.appendChild(k);
    const sheet = document.getElementById('join-shelf');
    sheet.style.bottom = `${kb}px`;
    sheet.style.paddingBottom = '14px';
    sheet.style.borderRadius = '20px 20px 0 0';
  }, kb);
}

const scenario = async (name, fn) => {
  if (only && !name.includes(only)) return;
  resetDocs(); writes.length = 0;
  note(`\n== ${name}`);
  try { await fn(); } catch (e) { note(`FAIL ${name}: ${String(e).slice(0, 500)}`); }
};

for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} a welcome`, async () => {
    const { ctx, page, errors } = await phone({ width: W, height: H });
    await openWall(page, T.crew);
    const rows = await page.locator('#welcome-card button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.height)]; }));
    note(`buttons [label,left,top,right,h]: ${JSON.stringify(rows)}`);
    note(`card: ${JSON.stringify(await box(page, '#welcome-card .bring-card'))}  dock: ${JSON.stringify(await box(page, '#dock'))}`);
    await shot(page, `a-welcome-${W}.png`);
    note(`errors ${JSON.stringify(errors)}`);
    await ctx.close();
  });

  await scenario(`${W} b tap→zoom, c shelf, d returning, e keyboard`, async () => {
    const { ctx, page, errors } = await phone({ width: W, height: H });
    await openWall(page, T.crew);
    // A guest's tap on a card, straight from the welcome.
    const y0 = await page.evaluate(() => Math.round(window.scrollY));
    await page.locator('#wall-root .card[data-artist="Tove Lo"]').first().tap();
    const y1 = await page.evaluate(() => Math.round(window.scrollY));
    await sleep(1100);
    note(`welcome gone: ${!(await page.locator('#welcome-card').count())}; zoom up: ${await page.locator('.zoom-card').count()}`);
    note(`zoom row: ${JSON.stringify(await page.locator('.zoom-card .f-chips button').evaluateAll((cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return [c.textContent, Math.round(r.left), Math.round(r.right), Math.round(r.height)]; })))}`);
    await shot(page, `b-guest-zoom-${W}.png`);
    // "Pick shows" → the shelf.
    await page.locator('.zoom-card .f-pick').first().tap();
    await sleep(1100);
    note(`scrollY: before tap ${y0}, after tap ${y1}, with shelf ${await page.evaluate(() => Math.round(window.scrollY))}`);
    note(`zoom gone: ${!(await page.locator('.zoom-card').count())}; shelf: ${JSON.stringify(await box(page, '#join-shelf'))}`);
    note(`shelf buttons: ${JSON.stringify(await page.locator('#join-shelf .js-actions button').evaluateAll((bs) => bs.map((b) => [b.textContent, b.disabled, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])))}`);
    await shot(page, `c-shelf-new-${W}.png`);
    if (W === 390) {
      // A returning member on a new phone finds their name and taps it.
      await page.locator('#join-shelf .js-name[data-name="Maya"]').tap();
      await sleep(400);
      note(`after Maya: ${await page.locator('#join-shelf .js-go').textContent()}`);
      await shot(page, 'd-shelf-returning-390.png');
      await page.locator('#join-shelf .js-name[data-name="Maya"]').tap(); // un-choose
      // A new friend types their name; the keyboard is up.
      await page.locator('#join-shelf .js-field').tap();
      await page.keyboard.type('Sam');
      await keyboardUp(page, 336);
      await sleep(400);
      note(`typed: ${await page.locator('#join-shelf .js-go').textContent()}; field ${JSON.stringify(await box(page, '#join-shelf .js-field'))}; shelf ${JSON.stringify(await box(page, '#join-shelf'))}`);
      await shot(page, 'e-shelf-keyboard-390.png');
    }
    note(`writes ${JSON.stringify(writes)}; errors ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

// A member on a phone: a tap opens the zoom; − notes + step the level.
for (const [W, H] of [[390, 844], [320, 568]]) {
  await scenario(`${W} h member stepper`, async () => {
    const { ctx, page, errors } = await phone({ width: W, height: H, member: [T.crew, 'Kevin'] });
    await openWall(page, T.crew, { welcome: false });
    const card = page.locator('#wall-root .card[data-artist="Tove Lo"]').first();
    await card.tap();
    await sleep(1100);
    const row = async () => JSON.stringify(await page.locator('.zoom-card .f-chips button').evaluateAll((cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return [c.textContent, c.disabled, Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.height)]; })));
    const pills = async () => JSON.stringify(await page.locator('.zoom-card .f-who, .zoom-card [class*="who"]').first().evaluate((n) => n.textContent).catch(() => null));
    note(`level 0 row ${await row()}; who ${await pills()}`);
    await shot(page, `h-member-zoom-0-${W}.png`);
    await page.locator('.zoom-card .f-step.plus').tap();
    await sleep(900);
    note(`level 1 row ${await row()}; who ${await pills()}; zoom up ${await page.locator('.zoom-card').count()}`);
    await shot(page, `h-member-zoom-1-${W}.png`);
    for (let i = 0; i < 3; i++) { await page.locator('.zoom-card .f-step.plus').tap(); await sleep(700); }
    note(`level 4 row ${await row()}; who ${await pills()}`);
    await shot(page, `h-member-zoom-must-${W}.png`);
    // Close: a tap outside — here on ANOTHER card (Airwolf Paradise), the
    // likely "outside" on a dense wall: it only closes, it opens nothing.
    const other = await page.locator('#wall-root .card[data-artist="Airwolf Paradise"]').first().boundingBox();
    await page.touchscreen.tap(Math.round(other.x + other.width / 2), Math.round(other.y + 12));
    await sleep(700);
    note(`closed: ${!(await page.locator('.zoom-card').count())}; no other zoom: ${!(await page.locator('.zoom-card').count())}`);
    await card.scrollIntoViewIfNeeded();
    await shot(page, `h-member-closed-must-${W}.png`);
    note(`writes ${JSON.stringify(writes.slice(-3))}; errors ${JSON.stringify(errors)}`);
    await ctx.close();
  });
}

// Edge: a crew of 12 on a 320 phone, a long artist name, with the keyboard up.
await scenario('320 f crew of 12 + long name', async () => {
  const { ctx, page, errors } = await phone({ width: 320, height: 568 });
  await openWall(page, T.big);
  await page.locator('#wall-root .card[data-artist="Ranger Trucco b2b Alisha"]').first().tap();
  await sleep(1100);
  await page.locator('.zoom-card .f-pick').first().tap();
  await sleep(1100);
  note(`shelf ${JSON.stringify(await box(page, '#join-shelf'))}; names ${JSON.stringify(await box(page, '#join-shelf .js-names'))}`);
  await shot(page, 'f-shelf-12-long-320.png');
  await page.locator('#join-shelf .js-field').tap();
  await page.keyboard.type('Sam');
  await keyboardUp(page, 260);
  await sleep(400);
  note(`kb: field ${JSON.stringify(await box(page, '#join-shelf .js-field'))}; shelf ${JSON.stringify(await box(page, '#join-shelf'))}`);
  await shot(page, 'f2-shelf-12-keyboard-320.png');
  note(`writes ${JSON.stringify(writes)}; errors ${JSON.stringify(errors)}`);
  await ctx.close();
});

// Edge: offline, and the welcome's own "Pick shows" (no artist).
await scenario('390 g offline via Pick shows', async () => {
  const { ctx, page, errors } = await phone({ width: 390, height: 844 });
  await openWall(page, T.crew);
  await page.evaluate(() => { window.__shelfOffline = true; });
  await page.locator('#welcome-card .welcome-join').tap();
  await sleep(1100);
  await shot(page, 'g-shelf-offline-pickshows-390.png');
  note(`writes ${JSON.stringify(writes)}; errors ${JSON.stringify(errors)}`);
  await ctx.close();
});

await browser.close();
server.close();
fs.writeFileSync(path.join(HERE, 'rig-report.txt'), report.join('\n') + '\n');
