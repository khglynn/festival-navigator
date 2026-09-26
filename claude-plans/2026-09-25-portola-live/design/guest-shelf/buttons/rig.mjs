// Button study rig (2026-09-25, late). The production app (scratch copy of
// v92 + the guest-shelf prototype, APP) with variants.css injected; the variant
// is html[data-btn], the family html[data-family]. Real Chromium, touch, 2x.
// NEVER production: /api answered from this process's memory (made-up crew),
// /fn-i swallowed, the service worker blocked. One browser, closed at the end.
//
//   APP=<scratch copy> node rig.mjs study            → every variant on four cards
//   APP=<scratch copy> node rig.mjs winner A         → the winner at 390/320/1280,
//                                                      its states, the family
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP;
if (!APP || !fs.existsSync(path.join(APP, 'index.html'))) throw new Error('set APP to the scratch copy of the app');
const OUT = path.join(HERE, 'frames');
fs.mkdirSync(OUT, { recursive: true });
const CSS = fs.readFileSync(path.join(HERE, 'variants.css'), 'utf8');
const { launchBrowser } = await import(path.join(APP, 'tests/helpers/browser.mjs'));
const { deepMerge } = await import(path.join(APP, 'js/merge.js'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [mode = 'study', WIN = 'A'] = process.argv.slice(2);

const FID = 'portola-2026';
const TOKEN = 'btnStudyCREWdemo_0123456'; // made up, parser-shaped
// Twelve invented friends; colour slots chosen so the four cards are a pale
// wash (amber, yellow-green, sky), a dark one (deep hues at level 1), a busy
// one (all twelve), and an unpicked one.
const PEOPLE = { Kevin: 0, Maya: 4, Jonah: 9, Priya: 8, Theo: 12, Rosa: 21, Ana: 1, Ben: 5, Cy: 2, Dot: 6, Eli: 3, Fay: 19 };
function demoDoc() {
  const people = Object.fromEntries(Object.entries(PEOPLE).map(([n, c]) => [n, { colorIndex: c }]));
  const sel = {
    Nimino: { Maya: 4, Jonah: 4, Priya: 3 },
    Tricky: { Theo: 1, Rosa: 1, Fay: 1, Kevin: 1 },
    'Femme Jatale b2b erika': { Ben: 4, Cy: 3, Dot: 3, Eli: 3, Kevin: 2, Fay: 2, Ana: 2, Maya: 2, Ivy: 0, Jonah: 1, Priya: 1, Theo: 1, Rosa: 4 },
    Robyn: { Kevin: 4, Maya: 4, Jonah: 3 },
  };
  return { v: 4, meta: { name: 'The Portola Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people, festivals: { [FID]: { selections: sel } } };
}
let DOC = demoDoc();
const CARDS = [['pale', 'Nimino'], ['dark', 'Tricky'], ['busy', 'Femme Jatale b2b erika'], ['unpicked', 'Airwolf Paradise']];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p0 = decodeURIComponent(u.pathname);
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew' && u.searchParams.get('t') === TOKEN) {
        if (req.method !== 'GET') DOC = deepMerge(DOC, (JSON.parse(raw || '{}').data) || {});
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
const browser = await launchBrowser();
const report = [];
const note = (s) => { report.push(s); console.log(s); };

async function phone({ width = 390, height = 844, btn = 'A', family = false, member = true, touch = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch && width < 720, serviceWorkers: 'block' });
  await ctx.addInitScript(([t, css, btn, family, member]) => {
    const T0 = new Date('2026-09-26T22:15:00Z').getTime(); const start = Date.now(); const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (RealDate.now() - start)])); } static now() { return T0 + (RealDate.now() - start); } };
    try {
      if (member) {
        localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }]));
        localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
        localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      }
    } catch { /* storage blocked */ }
    // The document does not exist yet when an init script runs: mark it and
    // add the study's stylesheet as soon as it does (before the app renders).
    const add = () => {
      document.documentElement.dataset.btn = btn;
      if (family) document.documentElement.dataset.family = '1';
      const s = document.createElement('style'); s.id = 'btn-study'; s.textContent = css; document.head.appendChild(s);
    };
    document.addEventListener('DOMContentLoaded', add, { once: true });
  }, [TOKEN, CSS, btn, family, member]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/f/${FID}#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await sleep(1500);
  return { ctx, page, errors };
}
async function openZoom(page, artist) {
  if (await page.locator('.zoom-card').count()) { await page.keyboard.press('Escape'); await sleep(400); }
  await page.locator(`#wall-root .card[data-artist="${artist}"]`).first().tap();
  await sleep(1000);
  return page.locator('.zoom-card').first().boundingBox();
}
async function crop(page, name, W) {
  const b = await page.locator('.zoom-card').first().boundingBox();
  const y = Math.max(0, Math.floor(b.y - 14));
  await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y, width: W, height: Math.ceil(b.height + 28) } });
}
const rowFacts = (page) => page.locator('.zoom-card .f-chips > button').evaluateAll((bs) => bs.map((b) => {
  const r = b.getBoundingClientRect(); return [b.textContent.trim() || b.className, Math.round(r.left), Math.round(r.right), Math.round(r.height)];
}));

if (mode === 'study') {
  for (const v of ['A', 'B', 'C', 'D']) {
    DOC = demoDoc();
    const { ctx, page, errors } = await phone({ btn: v });
    for (const [kind, artist] of CARDS) {
      await openZoom(page, artist);
      note(`${v} ${kind}: ${JSON.stringify(await rowFacts(page))}`);
      await crop(page, `${v}-${kind}.png`, 390);
    }
    note(`${v} errors ${JSON.stringify(errors)}`);
    await ctx.close();
  }
} else {
  // The winner, whole phones: the busy card at 390 and 320, a tablet at 1280.
  for (const [W, H, tag] of [[390, 844, '390'], [320, 568, '320'], [1280, 800, '1280']]) {
    DOC = demoDoc();
    const { ctx, page, errors } = await phone({ width: W, height: H, btn: WIN, family: true });
    await openZoom(page, 'Femme Jatale b2b erika');
    note(`${WIN} ${tag} busy: ${JSON.stringify(await rowFacts(page))}`);
    await page.screenshot({ path: path.join(OUT, `W-${WIN}-full-${tag}.png`) });
    if (W === 390) {
      // States, cropped: pressed + and keyboard focus on −.
      await page.locator('.zoom-card .f-step.plus').evaluate((b) => b.classList.add('sim-press'));
      await crop(page, `W-${WIN}-pressed-plus.png`, W);
      await page.locator('.zoom-card .f-step.plus').evaluate((b) => b.classList.remove('sim-press'));
      await page.locator('.zoom-card .f-step.minus').evaluate((b) => b.classList.add('sim-focus'));
      await crop(page, `W-${WIN}-focus-minus.png`, W);
      await page.locator('.zoom-card .f-step.minus').evaluate((b) => b.classList.remove('sim-focus'));
      for (const [kind, artist] of CARDS) { await openZoom(page, artist); await crop(page, `W-${WIN}-${kind}-390.png`, W); }
    }
    note(`errors ${JSON.stringify(errors)}`);
    await ctx.close();
  }
  // The family: a guest's welcome card, their zoom, and the join shelf.
  DOC = demoDoc();
  {
    const { ctx, page, errors } = await phone({ btn: WIN, family: true, member: false });
    await page.waitForSelector('#welcome-card', { timeout: 6000 });
    await sleep(900);
    note(`welcome: ${JSON.stringify(await page.locator('#welcome-card .bring-actions button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.right), Math.round(r.height)]; })))}`);
    await page.screenshot({ path: path.join(OUT, `F-${WIN}-welcome-390.png`) });
    await openZoom(page, 'Nimino');
    note(`guest zoom: ${JSON.stringify(await rowFacts(page))}`);
    await page.screenshot({ path: path.join(OUT, `F-${WIN}-guest-zoom-390.png`) });
    await page.locator('.zoom-card .f-pick').tap();
    await sleep(1000);
    await page.locator('#join-shelf .js-field').fill('Sam');
    await sleep(300);
    note(`shelf: ${JSON.stringify(await page.locator('#join-shelf .js-actions button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.right), Math.round(r.height)]; })))}`);
    await page.screenshot({ path: path.join(OUT, `F-${WIN}-shelf-390.png`) });
    note(`errors ${JSON.stringify(errors)}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
fs.writeFileSync(path.join(HERE, `rig-report-${mode}.txt`), report.join('\n') + '\n');
