#!/usr/bin/env node
// Real-input walk (2026-09-23): after adding a second crew at a festival you
// already picked in, the share moment comes first and the bring-your-picks
// offer only after it closes — never both at once, and a real tap on the
// offer lands on the offer.
//
//   node claude-plans/2026-09-23-crew-join-build/share-then-offer-walk.mjs [chromium|webkit|both] [shots-dir]
//
// /api is answered here (page.route); the crews are made up; nothing reaches
// production. Screenshots go to shots-dir (default: the OS temp dir) — never
// into the repo, which denies images by default.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const which = process.argv[2] || 'both';
const SHOTS = process.argv[3] || os.tmpdir();
const FID = 'portola-2026';
const PID = 'pid_walk_share_01';
const ROSS = 'walkshare_ross_0123456789';
const NEW = 'walkshare_new_01234567890';
const crewDoc = (people, selections) => ({ v: 4, meta: { name: '', inviteFestId: FID }, spotify: {}, affinity: {}, people, festivals: { [FID]: { selections } } });
const ROSS_DOC = crewDoc({ Kev: { colorIndex: 0, pid: PID }, Ross: { colorIndex: 3 } }, { Robyn: { Kev: 4 }, Soulwax: { Kev: 1 }, Kettama: { Kev: 2 } });
const NEW_DOC = { ...crewDoc({ Kevin: { colorIndex: 0, pid: PID } }, {}), meta: { name: 'Portola 2026', inviteFestId: FID } };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p.startsWith('/f/')) p = '/index.html';
  const file = path.join(ROOT, p);
  if (p.includes('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const type = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
  }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

async function walk(name) {
  const engine = { chromium, webkit }[name];
  const browser = await engine.launch({ headless: true });
  const phone = name === 'webkit' ? { ...devices['iPhone 15'] } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
  const context = await browser.newContext({ ...phone, serviceWorkers: 'block' });
  await context.addInitScript(({ PID, ROSS, ROSS_DOC }) => {
    if (localStorage.getItem('walk-seeded')) return;
    localStorage.setItem('walk-seeded', '1');
    localStorage.setItem('fn_person_v1', JSON.stringify({ token: 'walkshare_person_01234567', id: PID, name: 'Kevin', crews: {} }));
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: ROSS, name: '' }]));
    localStorage.setItem(`fn_me_v3_${ROSS}`, 'Kev');
    localStorage.setItem(`fn_crew_doc_v3_${ROSS}`, JSON.stringify(ROSS_DOC));
    localStorage.setItem('fn_coach_v1', '1');
  }, { PID, ROSS, ROSS_DOC });
  const page = await context.newPage();
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/api/crew' && req.method() === 'POST' && !u.searchParams.get('t')) return reply({ token: NEW, doc: NEW_DOC }, 201);
    if (u.pathname === '/api/crew') return reply(NEW_DOC);
    if (u.pathname === '/api/person') return reply({ id: PID, doc: { v: 1, name: 'Kevin', crews: {} } });
    if (u.pathname === '/api/festival-add') return reply({ festivals: [] });
    return reply({}, 503);
  });
  const out = { engine: name };
  await page.goto(`${origin}/#new`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-create', { state: 'visible' });
  await page.locator('#create-fests button', { hasText: /^PORTOLA/ }).first().tap();
  await page.locator('#create-go-multi').tap();
  await page.waitForSelector('#artist-sheet', { state: 'visible' });
  await page.waitForTimeout(900); // longer than the offer's arrival beat
  out.offerWhileSheetUp = await page.evaluate(() => !!document.getElementById('bring-offer'));
  await page.screenshot({ path: path.join(SHOTS, `${name}-1-share-moment.png`) });
  await page.locator('#artist-sheet button', { hasText: 'Later' }).tap();
  await page.waitForSelector('#artist-sheet', { state: 'detached' });
  await page.waitForSelector('#bring-offer .bring-card', { state: 'visible' });
  await page.waitForTimeout(700); // let the arrival finish
  out.offerLine = await page.locator('#bring-offer .bring-line').textContent();
  await page.screenshot({ path: path.join(SHOTS, `${name}-2-offer-after-share.png`) });
  // A real tap at the button's centre — what the WebKit walk could not do before.
  const yes = page.locator('#bring-offer .bring-actions .btn-tonal');
  const box = await yes.boundingBox();
  out.hitIsTheButton = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('#bring-offer .btn-tonal'));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  out.after = await page.evaluate(() => document.querySelector('#bring-offer .bring-line')?.textContent || '(gone)');
  await page.screenshot({ path: path.join(SHOTS, `${name}-3-brought.png`) });
  await browser.close();
  return out;
}

for (const e of which === 'both' ? ['chromium', 'webkit'] : [which]) console.log(JSON.stringify(await walk(e)));
server.close();
process.exit(0);
