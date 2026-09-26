// Import walk (2026-09-26): every state of "Import from the Portola app", in a
// real Chromium — a finger at 390 (hasTouch + isMobile, touchscreen.tap), a
// mouse at 1280 — framed into v97-shots/ beside this file (PNGs: git-ignored).
//
// NEVER production: the app boots against a made-up crew, every /api answers
// inside the page (the crew from memory, the reader from the real model's own
// output for Kevin's two exports — IMPORT-BUILD.md), /fn-i is swallowed and
// the service worker is blocked. Writes are recorded, never kept.
//
// Kevin's two real exports make the truest frames, and they must never enter
// this public repo, so they are read from outside it:
//   IMPORT_SAMPLES=<dir with sat-9-26.jpg and sun-9-27.jpg> node claude-plans/2026-09-25-portola-live/import-walk.mjs [only]
// Without it, flat stand-in images are drawn (the reads are the same).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'v97-shots');
fs.mkdirSync(OUT, { recursive: true });
const { serveStatic } = await import('../../tests/helpers/static-server.mjs');
const { deepMerge } = await import('../../js/merge.js');
const pw = await import('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || null;
const FID = 'portola-2026';

// ---- the two images, and how the reader tells them apart --------------------
const SAMPLES = process.env.IMPORT_SAMPLES || null;
function flat(w, h, [r, g, b]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return jpeg.encode({ data, width: w, height: h }, 80).data;
}
const IMG = SAMPLES
  ? { sat: fs.readFileSync(path.join(SAMPLES, 'sat-9-26.jpg')), sun: fs.readFileSync(path.join(SAMPLES, 'sun-9-27.jpg')) }
  : { sat: flat(1080, 1920, [44, 62, 160]), sun: flat(540, 960, [60, 70, 170]) };
// Which day an arriving image is. Stand-ins differ in width; the real exports
// differ in their day chip — "Saturday 9/26" reaches x≈309 of 1080, "Sunday
// 9/27" stops at ≈288 — so the pixel at (298, 390) is the chip's dark fill on
// Saturday and the blue ground on Sunday.
function dayOf(b64) {
  const img = jpeg.decode(Buffer.from(b64, 'base64'), { useTArray: true, maxMemoryUsageInMB: 1024 });
  if (!SAMPLES) return img.width === 540 ? 'sun' : 'sat';
  const x = Math.round(298 * img.width / 1080), y = Math.round(390 * img.width / 1080);
  const i = (y * img.width + x) * 4;
  return img.data[i + 2] < 110 ? 'sat' : 'sun';
}
// The real model's answers for the two exports (read 2026-09-26, IMPORT-BUILD.md).
const READS = {
  sat: { festival: 'Portola', day: 'Saturday 9/26', items: [
    { name: 'Despacio', start: '2:45 PM', end: '9:45 PM', stage: 'DESPACIO' },
    { name: 'Ranger Trucco b2b Alisha', start: '2:45 PM', end: '3:45 PM', stage: 'WAREHOUSE' },
    { name: 'Airwolf Paradise', start: '1:30 PM', end: '2:30 PM', stage: 'PIER' },
    { name: 'Erika b2b sfcowboy', start: '1:30 PM', end: '3:10 PM', stage: 'CRANE' },
  ] },
  sun: { festival: 'Portola', day: 'Sunday 9/27', items: [
    { name: 'Overmono', start: '8:20 PM', end: '9:20 PM', stage: 'WAREHOUSE' },
    { name: 'underscores', start: '5:50 PM', end: '6:40 PM', stage: 'CRANE' },
    { name: 'VTSS', start: '4:30 PM', end: '5:30 PM', stage: 'WAREHOUSE' },
    { name: 'Silva Bumpa', start: '2:30 PM', end: '3:30 PM', stage: 'WAREHOUSE' },
  ] },
};
// The edges frame's Sunday: a name the lineup lacks, a set on another day,
// and a different festival's name on the image.
const EDGES = { ...READS.sun, festival: 'Portola Music Festival', items: [...READS.sun.items,
  { name: 'Mystery Guest', start: '1:00 PM', end: '2:00 PM', stage: 'SHIP' },
  { name: 'Tove Lo', start: '5:40 PM', end: '6:30 PM', stage: 'PIER' }] };

// ---- the phone ------------------------------------------------------------------
const server = await serveStatic(WT);
const browser = await pw.chromium.launch({ headless: true });
const TOKEN = 'importWALKcrewDEMO_0123'; // parser-shaped, obviously fake, never a real link
const baseDoc = (mine = {}) => ({
  v: 4, meta: { name: 'The Pier Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 } },
  festivals: { [FID]: { selections: deepMerge({
    Despacio: { Kevin: 4, Maya: 3 }, Overmono: { Maya: 4 }, underscores: { Jonah: 2 }, 'Silva Bumpa': { Maya: 2, Jonah: 3 },
  }, mine) } },
});

async function phone(width, { mine = {}, reader = {}, offline = false, welcome = true } = {}) {
  const touch = width < 720;
  const ctx = await browser.newContext({
    viewport: { width, height: touch ? 844 : 860 }, deviceScaleFactor: 2,
    hasTouch: touch, isMobile: touch, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles',
  });
  await ctx.addInitScript(([t, f, w]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Pier Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    if (w) localStorage.setItem('fn_welcome_v1', '1');
  }, [TOKEN, FID, welcome]);
  let doc = baseDoc(mine);
  const writes = [];
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => {
    if (r.request().method() !== 'GET') { const d = JSON.parse(r.request().postData() || '{}').data || {}; writes.push(d); doc = deepMerge(doc, d); }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) });
  });
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/api/import-schedule**', async (r) => {
    const b64 = String(JSON.parse(r.request().postData() || '{}').image || '').replace(/^data:[^,]*,/, '');
    const day = dayOf(b64);
    if (reader.hold) await reader.hold;
    const fail = reader.fail && reader.fail(day);
    if (fail) return r.fulfill({ status: fail, contentType: 'application/json', body: '{"error":"x"}' });
    const body = reader.answer ? reader.answer(day) : READS[day];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-09-26T15:15:00-07:00'));
  await page.goto(`${server.origin}/#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await sleep(500);
  if (offline) await ctx.setOffline(true);
  const tap = async (sel, { nth = 0, text = null } = {}) => {
    const loc = text ? page.locator(sel, { hasText: text }).nth(nth) : page.locator(sel).nth(nth);
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + Math.min(b.height / 2, 30));
    if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  };
  const tapCard = async (artist) => {
    const b = await page.evaluate((a) => {
      const el = document.querySelector(`.import-sheet .card[data-artist="${a}"]`);
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 22) };
    }, artist);
    if (touch) await page.touchscreen.tap(Math.round(b.x), Math.round(b.y)); else await page.mouse.click(b.x, b.y);
    await sleep(420);
  };
  const openImport = async () => {
    await tap('#gear-btn');
    await page.waitForSelector('#settings-main', { state: 'visible' });
    await sleep(250);
    await tap('#settings-main .list-row', { text: 'Import from the Portola app' });
    await page.waitForSelector('.import-sheet');
    await sleep(400);
  };
  const choose = (days) => page.setInputFiles('.import-sheet .imp-input',
    days.map((d) => ({ name: `${d}.jpg`, mimeType: 'image/jpeg', buffer: IMG[d] })));
  const frame = async (name, { full = false } = {}) => {
    const file = path.join(OUT, `${width}-${name}.png`);
    await page.screenshot({ path: file, fullPage: full });
    shots.push(path.relative(WT, file));
  };
  const scrollSheet = (to) => page.evaluate((y) => { const s = document.querySelector('.import-sheet'); if (s) s.scrollTop = y === 'end' ? s.scrollHeight : y; }, to);
  return { ctx, page, errors, writes, tap, tapCard, openImport, choose, frame, scrollSheet };
}

const shots = [];
const problems = [];
const walks = {
  // 1–5: the whole way through, on Kevin's two exports.
  async main(width) {
    let release;
    const reader = { hold: new Promise((r) => { release = r; }) };
    const p = await phone(width, { reader });
    try {
      await p.tap('#gear-btn');
      await p.page.waitForSelector('#settings-main', { state: 'visible' });
      await p.page.locator('#settings-main .list-row', { hasText: 'Import from the Portola app' }).scrollIntoViewIfNeeded();
      await sleep(300);
      await p.frame('01-settings-door');
      await p.tap('#settings-main .list-row', { text: 'Import from the Portola app' });
      await p.page.waitForSelector('.import-sheet');
      await sleep(500);
      await p.frame('02-choose');
      await p.choose(['sat', 'sun']);
      await p.page.waitForSelector('.import-sheet .imp-shot[data-state="reading"]');
      await sleep(450);
      await p.frame('03-reading');
      release();
      await p.page.waitForSelector('.import-sheet[data-import="review"]', { timeout: 15000 });
      await sleep(900);
      await p.scrollSheet(0);
      await sleep(150);
      await p.frame('04-review');
      await p.scrollSheet('end');
      await sleep(200);
      await p.frame('04b-review-foot');
      await p.tapCard('Airwolf Paradise');
      await p.tapCard('Overmono');
      await p.tapCard('Overmono');
      for (let i = 0; i < 3; i++) await p.tapCard('VTSS');
      await p.scrollSheet(0);
      await sleep(200);
      await p.frame('05-landed');
      await p.scrollSheet('end');
      await sleep(200);
      await p.frame('05b-landed-foot');
      await p.tap('.import-sheet .imp-go');
      await p.page.waitForSelector('.import-sheet', { state: 'detached' });
      await sleep(700);
      await p.frame('06-wall-after-add');
      if (p.errors.length) problems.push(`${width} main: ${p.errors.join(' | ')}`);
    } finally { await p.ctx.close(); }
  },
  // 7: a Sunday image with a name the lineup lacks, a set on Saturday, and
  // a festival name that is not quite ours — plus a pick you already had.
  async edges(width) {
    const p = await phone(width, { mine: { VTSS: { Kevin: 1 } }, reader: { answer: (d) => (d === 'sun' ? EDGES : READS.sat) } });
    try {
      await p.openImport();
      await p.choose(['sun']);
      await p.page.waitForSelector('.import-sheet[data-import="review"]', { timeout: 15000 });
      await sleep(900);
      await p.scrollSheet('end');
      await sleep(200);
      await p.frame('07-edges');
      if (p.errors.length) problems.push(`${width} edges: ${p.errors.join(' | ')}`);
    } finally { await p.ctx.close(); }
  },
  // 8: every set already yours — nothing new to add.
  async nothing(width) {
    const all = Object.fromEntries(READS.sat.items.map((i) => [i.name === 'Erika b2b sfcowboy' ? 'erika b2b sfcowboy' : i.name, { Kevin: 3 }]));
    const p = await phone(width, { mine: all });
    try {
      await p.openImport();
      await p.choose(['sat']);
      await p.page.waitForSelector('.import-sheet[data-import="review"]', { timeout: 15000 });
      await sleep(900);
      await p.frame('08-nothing-new');
      if (p.errors.length) problems.push(`${width} nothing: ${p.errors.join(' | ')}`);
    } finally { await p.ctx.close(); }
  },
  // 9: one image fails (a tap retries it), one had no sets on it.
  async errors(width) {
    const p = await phone(width, { reader: { fail: (d) => (d === 'sat' ? 502 : 0), answer: (d) => (d === 'sun' ? { festival: null, day: null, items: [] } : READS.sat) } });
    try {
      await p.openImport();
      await p.choose(['sat', 'sun']);
      await p.page.waitForSelector('.import-sheet .imp-shot[data-state="error"]', { timeout: 15000 });
      await p.page.waitForFunction(() => !document.querySelector('.import-sheet .imp-shot[data-state="reading"]'));
      await sleep(400);
      await p.frame('09-failed-and-empty');
      if (p.errors.length) problems.push(`${width} errors: ${p.errors.join(' | ')}`);
    } finally { await p.ctx.close(); }
  },
  // 10: no signal.
  async offline(width) {
    const p = await phone(width, { offline: true });
    try {
      await p.openImport();
      await p.choose(['sat', 'sun']);
      await p.page.waitForSelector('.import-sheet .imp-shot[data-state="error"]', { timeout: 15000 });
      await sleep(400);
      await p.frame('10-offline');
      if (p.errors.length) problems.push(`${width} offline: ${p.errors.join(' | ')}`);
    } finally { await p.ctx.close(); }
  },
  // 11: THE PROPOSED second door — a frame only, nothing built. The
  // just-joined welcome (a new member, nothing picked yet) gets one more
  // clause in the words it already says, as a link like its "More info".
  async door2(width) {
    const p = await phone(width, { welcome: true });
    try {
      await p.page.evaluate(async () => {
        const w = await import('/js/v3/welcome.js');
        const copy = w.welcomeCopy({ crewName: 'The Pier Crew', festName: 'Portola', people: ['Kevin', 'Maya', 'Jonah'], picked: true, guest: false, meName: 'Kevin' });
        const box = w.showWelcome(document.body, { copy, faces: [], ctx: { lowPower: true }, onGotIt() {}, onHow() {} });
        const sub = box.querySelector('.bring-sub');
        const more = sub.querySelector('.welcome-more');
        // The proposal: "Tap any artist to add yours — or bring your
        // schedule from the Portola app." with the last words a link.
        sub.textContent = '';
        sub.append('Every friend has a color — the more color on a card, the more of us want to go. Tap any artist to add yours, or ');
        const door = document.createElement('button');
        door.className = 'welcome-more';
        door.textContent = 'bring your Portola app schedule';
        sub.append(door, '. ', more);
      });
      await sleep(600);
      await p.frame('11-proposed-second-door');
      if (p.errors.length) problems.push(`${width} door2: ${p.errors.join(' | ')}`);
    } finally { await p.ctx.close(); }
  },
};

for (const width of [390, 1280]) {
  for (const [name, walk] of Object.entries(walks)) {
    if (only && only !== name) continue;
    await walk(width);
  }
}
await browser.close();
await server.close();
console.log(shots.join('\n'));
if (problems.length) { console.log('\nPROBLEMS:\n' + problems.join('\n')); process.exitCode = 1; }
