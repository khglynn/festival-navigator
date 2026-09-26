// v90 item 3 walk (2026-09-25): a REAL service worker in Chromium, a local
// server that can "deploy" a new build (service-worker.js's CACHE_VERSION
// bumped on the fly), and Settings' "Get the latest version" row driven with
// real touch input — idle, nothing newer, a new build that the glue reloads,
// a new build held by work in progress (the row's "ready" tap), offline, and
// an offline reload afterwards. Never production: /api is answered here.
// Run from the repo: node claude-plans/2026-09-25-portola-live/v90-walk-update.mjs
// The report lands in v90-shots/item3-walk.txt (git-ignored, with the shots).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'v90-shots');
fs.mkdirSync(OUT, { recursive: true });
const { launchBrowser } = await import('../../tests/helpers/browser.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FID = 'portola-2026';
const TOKEN = 'v90walk_0123456789abcdef';
const doc = { v: 4, meta: { name: 'Walk', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 3 } }, festivals: { [FID]: { selections: {} } } };
// The build the repo carries now, and the two "deploys" after it.
const REAL = /'festival-nav-(v\d+)'/.exec(fs.readFileSync(path.join(WT, 'service-worker.js'), 'utf8'))[1];
const bump = (n) => `v${Number(REAL.slice(1)) + n}`;
let build = REAL;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const log = [];
const server = http.createServer((req, res) => {
  const p0 = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p0.startsWith('/api/crew')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(doc)); return; }
  if (p0.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{}'); return; }
  if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
  let p = p0 === '/' ? '/index.html' : p0;
  let file = path.join(WT, p);
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  let body = fs.readFileSync(file);
  if (p === '/service-worker.js') { body = Buffer.from(body.toString().replace(/'festival-nav-v\d+'/, `'festival-nav-${build}'`)); log.push(`sw script served as ${build}`); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser();
const report = [];
const note = (s) => { report.push(s); console.log(s); };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'allow' });
  await ctx.addInitScript(([t, f]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Walk' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN, FID]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(`PAGEERROR ${e.message}`));
  const loads = [];
  page.on('load', () => loads.push(Date.now()));
  await page.goto(`${origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  note(`controlled by a worker; loads so far ${loads.length}`);
  // A phone that has used the app before: its page loads under a worker.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  note(`reloaded under the worker: controlled from load = ${await page.evaluate(() => !!navigator.serviceWorker.controller)}`);
  await page.evaluate(() => { localStorage.setItem('fn_probe_v90', 'kept'); sessionStorage.setItem('fn_probe_v90', 'kept'); window.__same = true; });
  const openSettings = async () => { await page.tap('#gear-btn'); await page.waitForSelector('#settings-root .list-row', { timeout: 10000 }); };
  const row = () => page.locator('#settings-root button.list-row', { hasText: 'Get the latest version' });
  const words = () => row().locator('.row-sub').textContent();
  const shoot = async (name) => { await row().scrollIntoViewIfNeeded(); await sleep(150); const b = await row().boundingBox(); await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: Math.max(0, b.y - 70), width: 390, height: b.height + 140 } }); };
  await openSettings();
  await page.waitForFunction(() => /This phone runs v\d+/.test([...document.querySelectorAll('#settings-root .row-sub')].map((n) => n.textContent).join('|')), null, { timeout: 8000 });
  note(`1. idle: "${await words()}"; row height ${(await row().boundingBox()).height}px`);
  await shoot('item3-1-idle.png');

  await row().tap();
  await page.waitForFunction(() => /latest|unreachable|no-worker/.test(document.querySelector('#settings-root [data-update]').dataset.update), null, { timeout: 20000 });
  note(`2. nothing newer: "${await words()}"`);
  await shoot('item3-2-latest.png');

  // Deploy "v90".
  build = bump(1);
  const t0 = Date.now();
  const seen = [];
  const watch = setInterval(async () => { try { const w = await page.evaluate(() => { const r = document.querySelector('#settings-root [data-update]'); return r ? r.dataset.update + ' / ' + r.querySelector('.row-sub').textContent : 'no row'; }); if (seen[seen.length - 1] !== w) seen.push(w); } catch { /* reloading */ } }, 40);
  await row().tap();
  // Either the glue reloads the quiet page, or the row says ready.
  const outcome = await Promise.race([
    page.waitForEvent('load', { timeout: 30000 }).then(() => 'reloaded'),
    page.waitForFunction(() => { const r = document.querySelector('#settings-root [data-update]'); return r && /ready|failed|slow|unreachable/.test(r.dataset.update); }, null, { timeout: 30000 }).then(() => 'row-settled'),
  ]).catch((e) => `timeout: ${e.message}`);
  clearInterval(watch);
  note(`3. new build: ${outcome} after ${Date.now() - t0}ms; row states seen: ${seen.join(' → ')}`);
  if (outcome === 'row-settled') {
    await shoot('item3-3-ready.png');
    note(`   row says "${await words()}" — tapping it`);
    const re = page.waitForEvent('load', { timeout: 15000 });
    await row().tap();
    await re;
    note('   reloaded');
  }
  await page.waitForFunction(() => ['screen-app', 'screen-settings'].some((id) => { const n = document.getElementById(id); return n && n.style.display !== 'none' && n.getClientRects().length; }), null, { timeout: 20000 });
  await sleep(500);
  const after = await page.evaluate(async () => ({
    same: window.__same === true,
    probe: localStorage.getItem('fn_probe_v90'),
    sprobe: sessionStorage.getItem('fn_probe_v90'),
    crews: localStorage.getItem('fn_crews_v3') !== null,
    caches: await caches.keys(),
    dataHasFest: !!(await (await caches.open('festival-nav-data-v1')).match('/data/festivals/portola-2026.json')),
    screen: ['screen-app', 'screen-settings'].find((id) => document.getElementById(id).style.display !== 'none'),
  }));
  note(`4. after the switch: ${JSON.stringify(after)}`);
  if (after.screen !== 'screen-settings') await openSettings();
  await page.waitForFunction(() => /This phone runs v\d+/.test([...document.querySelectorAll('#settings-root .row-sub')].map((n) => n.textContent).join('|')), null, { timeout: 8000 }).catch(() => {});
  note(`5. the row now: "${await words()}"`);
  await shoot('item3-4-after.png');

  // Phase 2: something IS in progress (words in a field on screen), so the
  // glue holds the reload; the row must say ready, and its tap switches.
  const field = await page.evaluate(() => {
    const f = [...document.querySelectorAll('#settings-root input, #settings-root textarea')].find((n) => !n.readOnly && n.getClientRects().length);
    if (!f) return null;
    f.id = f.id || 'walk-field';
    return { id: f.id, label: f.getAttribute('aria-label') || f.placeholder || f.name };
  });
  note(`8. a free-text field on Settings main: ${JSON.stringify(field)} (none, so the in-progress case uses the busy mark)`);
  if (true) {
    // No field on Settings' own page, so the in-progress mark a Spotify scan
    // wears (index.html's quiet() reads body[data-busy]).
    await page.evaluate(() => { document.body.dataset.busy = 'spotify-scan'; window.__same = true; });
    build = bump(2);
    await row().tap();
    const r2 = await Promise.race([
      page.waitForEvent('load', { timeout: 30000 }).then(() => 'RELOADED (should have waited)'),
      page.waitForFunction(() => { const r = document.querySelector('#settings-root [data-update]'); return r && /ready|failed|slow|unreachable/.test(r.dataset.update); }, null, { timeout: 30000 }).then(() => 'row-settled'),
    ]).catch((e) => `timeout: ${e.message}`);
    note(`9. with a Spotify scan in progress (body[data-busy]): ${r2}; row "${await words().catch(() => '?')}"; strip up: ${await page.evaluate(() => !!document.getElementById('new-build-strip')).catch(() => '?')}`);
    if (r2 === 'row-settled') {
      await shoot('item3-3-ready.png');
      const re = page.waitForEvent('load', { timeout: 15000 });
      await row().tap();
      await re;
      await page.waitForFunction(() => ['screen-app', 'screen-settings'].some((id) => { const n = document.getElementById(id); return n && n.style.display !== 'none' && n.getClientRects().length; }), null, { timeout: 20000 });
      if (!(await page.evaluate(() => document.getElementById('screen-settings').style.display !== 'none'))) await openSettings();
      await page.waitForFunction(() => /This phone runs v\d+/.test([...document.querySelectorAll('#settings-root .row-sub')].map((n) => n.textContent).join('|')), null, { timeout: 8000 }).catch(() => {});
      note(`10. tapped ready → reloaded; the row now: "${await words()}"`);
    }
  }

  await ctx.setOffline(true);
  await row().tap();
  await sleep(300);
  note(`6. offline tap: "${await words()}"`);
  await shoot('item3-5-offline.png');
  // Still boots offline after all that: nothing the offline app needs was thrown away.
  await page.reload({ waitUntil: 'load' }).catch((e) => note(`   offline reload error ${e.message}`));
  const offlineBoot = await page.waitForFunction(() => document.querySelector('#wall-root') && document.querySelector('#wall-root').children.length > 0, null, { timeout: 20000 }).then(() => 'the wall rendered offline', (e) => `NO WALL: ${e.message}`);
  note(`7. offline reload: ${offlineBoot}`);
  await ctx.setOffline(false);
  note(`server log: ${log.join('; ')}`);
  await ctx.close();
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, 'item3-walk.txt'), report.join('\n') + '\n');
}
