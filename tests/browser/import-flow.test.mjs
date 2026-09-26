// Import from the Portola app's schedule export (2026-09-26), walked in a
// real engine with a finger: Settings → "Import from the Portola app" →
// choose two day images → each is shrunk on the phone and read (the reader
// answered here, inside the page) → the days arrive as the wall's own cards
// at level 2 → taps land the levels (1 → 2 → 3 → must → off) → "Add N picks"
// writes them for YOU, through the ordinary pick path, then the wall.
//
// What it pins, beyond the happy path: the crew token rides a header and
// never the URL; the phone sends at most 1080px wide; a pick you already had
// is shown at your level and never touched; a name the lineup lacks is
// listed, never dropped; a set on another day is flagged and still imported;
// nothing is written before Add, and nothing but your own picks after.
//
// The images are made here (flat colours, two sizes) — Kevin's real exports
// stay out of this public repo. The reads answered below are the real
// model's own output for them (IMPORT-BUILD.md), plus two lines to test with.
// WebKit whenever it is installed (iPhones); Chromium with touch always.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER } from '../helpers/browser.mjs';
import { deepMerge } from '../../js/merge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
let webkit = null;
let devices = {};
devices = (await import('playwright')).devices;
webkit = await launchWebkit(); // CI installs WebKit and requires it (tests/helpers/browser.mjs)
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

const FID = 'portola-2026';

// A flat JPEG, w × h.
function jpegOf(w, h, [r, g, b]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return jpeg.encode({ data, width: w, height: h }, 80).data;
}
// The width a JPEG says in its frame header (SOF0/1/2) — what the phone sent.
function jpegWidth(buf) {
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc2) return buf.readUInt16BE(i + 7);
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return 0;
}
// Saturday is a big image (the phone must shrink it to 1080 wide); Sunday a
// small one (sent at its own width). The reader tells them apart by width.
const SAT_IMG = jpegOf(1440, 2560, [44, 62, 160]);
const SUN_IMG = jpegOf(540, 960, [60, 70, 170]);
const SAT = {
  festival: 'Portola', day: 'Saturday 9/26', items: [
    { name: 'Despacio', start: '2:45 PM', end: '9:45 PM', stage: 'DESPACIO' },
    { name: 'Ranger Trucco b2b Alisha', start: '2:45 PM', end: '3:45 PM', stage: 'WAREHOUSE' },
    { name: 'Airwolf Paradise', start: '1:30 PM', end: '2:30 PM', stage: 'PIER' },
    { name: 'Erika b2b sfcowboy', start: '1:30 PM', end: '3:10 PM', stage: 'CRANE' },
  ],
};
const SUN = {
  festival: 'Portola', day: 'Sunday 9/27', items: [
    { name: 'Overmono', start: '8:20 PM', end: '9:20 PM', stage: 'WAREHOUSE' },
    { name: 'underscores', start: '5:50 PM', end: '6:40 PM', stage: 'CRANE' },
    { name: 'VTSS', start: '4:30 PM', end: '5:30 PM', stage: 'WAREHOUSE' },
    { name: 'Silva Bumpa', start: '2:30 PM', end: '3:30 PM', stage: 'WAREHOUSE' },
    { name: 'Mystery Guest', start: '1:00 PM', end: '2:00 PM', stage: 'SHIP' }, // not on the lineup
    { name: 'Tove Lo', start: '5:40 PM', end: '6:30 PM', stage: 'PIER' },       // on Saturday here
  ],
};

async function memberPhone(engine) {
  const CREW = randomBytes(20).toString('base64url'); // a made-up crew, never a real link
  const profile = devices['iPhone 13'] || { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
  const opts = { ...profile, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' };
  if (engine === chromium) delete opts.defaultBrowserType;
  const ctx = await engine.newContext(opts);
  await ctx.addInitScript(([t, f]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Import Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
  }, [CREW, FID]);
  let crewDoc = {
    v: 4, meta: { name: 'Import Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
    festivals: { [FID]: { selections: { Despacio: { Kevin: 4 }, Overmono: { Maya: 4 } } } },
  };
  const writes = [];
  const reads = [];
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => {
    if (r.request().method() !== 'GET') {
      const data = JSON.parse(r.request().postData() || '{}').data || {};
      writes.push(data);
      crewDoc = deepMerge(crewDoc, data);
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(crewDoc) });
  });
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  // The reader: which image, how wide it arrived, and with what credential.
  const reader = { hold: null };
  await ctx.route('**/api/import-schedule**', async (r) => {
    const req = r.request();
    const body = JSON.parse(req.postData() || '{}');
    const bytes = Buffer.from(String(body.image || '').replace(/^data:[^,]*,/, ''), 'base64');
    const width = jpegWidth(bytes);
    reads.push({ url: req.url(), token: req.headers()['x-crew-token'], width, method: req.method() });
    if (reader.hold) await reader.hold;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(width === 540 ? SUN : SAT) });
  });
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-09-26T15:15:00-07:00'));
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await sleep(300);
  return { ctx, page, errors, writes, reads, reader, CREW, doc: () => crewDoc };
}

const tapAt = async (page, box) => page.touchscreen.tap(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
async function tapSel(page, sel) {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded();
  await tapAt(page, await loc.boundingBox());
}
// A card in the sheet, brought into the sheet's view first, tapped where a
// finger would: its middle, clear of the corners.
async function tapCard(page, artist) {
  const box = await page.evaluate((a) => {
    const el = document.querySelector(`.import-sheet .card[data-artist="${a}"]`);
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 44) };
  }, artist);
  await tapAt(page, box);
  await sleep(120);
}
const levelOf = (page, artist) => page.evaluate((a) => {
  // The corner's own chip — a clear leaves a receding copy of the old one on
  // the card for a moment (wall.js meterLeaves), and that copy is not a level.
  const m = document.querySelector(`.import-sheet .card[data-artist="${a}"] > .corner-about > .chip-meter`);
  return m ? Number(m.dataset.level) : 0;
}, artist);

for (const [name, get] of [['WebKit (iPhone)', () => webkit], ['Chromium (touch)', () => chromium]]) {
  test(`${name}: import two day images, land the levels, add them — for you only`, {
    skip: get() ? false : (name.startsWith('WebKit') ? 'WebKit not installed' : NO_BROWSER),
  }, async () => {
    const { ctx, page, errors, writes, reads, reader, CREW, doc } = await memberPhone(get());
    try {
      await tapSel(page, '#gear-btn');
      await page.waitForSelector('#settings-main', { state: 'visible' });
      const row = page.locator('#settings-main .list-row', { hasText: 'Import from the Portola app' });
      assert.equal(await row.count(), 1, 'the door sits in Settings');
      await row.scrollIntoViewIfNeeded();
      await tapAt(page, await row.boundingBox());
      await page.waitForSelector('.import-sheet[data-import="choose"]', { timeout: 4000 });
      assert.equal(await page.locator('.import-sheet .sheet-title').textContent(), 'FROM THE PORTOLA APP');
      assert.equal(await page.locator('.import-sheet .grabber').count(), 0, 'no grabber (Kevin, 2026-09-26): its ✕, Escape, Back and the dimmed wall close it');
      assert.equal(await page.locator('.import-sheet .imp-foot').isHidden(), true, 'nothing to add yet, so no button');

      // Hold the reader so the "reading" state is on screen for a moment.
      let release;
      reader.hold = new Promise((r) => { release = r; });
      await page.setInputFiles('.import-sheet .imp-input', [
        { name: 'sat.jpg', mimeType: 'image/jpeg', buffer: SAT_IMG },
        { name: 'sun.jpg', mimeType: 'image/jpeg', buffer: SUN_IMG },
      ]);
      await page.waitForSelector('.import-sheet[data-import="reading"] .imp-shot[data-state="reading"]', { timeout: 4000 });
      assert.equal(await page.locator('.import-sheet .imp-shot').count(), 2);
      assert.equal(await page.locator('.import-sheet .imp-go').isDisabled(), true, 'no adding while reading');
      assert.equal(writes.length, 0, 'nothing written');
      release();
      reader.hold = null;
      await page.waitForSelector('.import-sheet[data-import="review"]', { timeout: 15000 });
      await sleep(500);

      // The reads went out as they must.
      assert.equal(reads.length, 2);
      for (const r of reads) {
        assert.equal(r.method, 'POST');
        assert.equal(r.token, CREW, 'the crew token rides a header');
        assert.ok(!r.url.includes(CREW) && !r.url.includes('?'), 'and never the URL');
      }
      assert.deepEqual(reads.map((r) => r.width).sort((a, b) => a - b), [540, 1080], 'shrunk to 1080 wide; a small image sent at its own width');

      // Each image says what it was read as.
      const caps = await page.locator('.import-sheet .imp-shot-cap').allTextContents();
      assert.deepEqual(caps.sort(), ['SAT4 sets', 'SUN6 sets']);

      // The days, in the festival's order, as the wall's own cards at level 2.
      assert.deepEqual(await page.locator('.import-sheet .imp-day-title').allTextContents(), ['SATURDAY', 'SUNDAY']);
      const cards = await page.locator('.import-sheet .imp-grid .card').evaluateAll((els) => els.map((e) => e.dataset.artist));
      assert.deepEqual(cards, ['Ranger Trucco b2b Alisha', 'Airwolf Paradise', 'erika b2b sfcowboy', 'Overmono', 'underscores', 'VTSS', 'Silva Bumpa', 'Tove Lo']);
      for (const a of cards) assert.equal(await levelOf(page, a), 2, `${a} starts at 2`);
      assert.equal(await page.locator('.import-sheet .card[data-artist="Despacio"]').count(), 0, 'a pick you have is not in the import');
      const notes = (await page.locator('.import-sheet .imp-note').allTextContents()).join(' | ');
      assert.match(notes, /Already yours\s*Despacio/);
      assert.match(notes, /Not on Portola’s lineup here: Mystery Guest\./);
      assert.match(notes, /Tove Lo is on Saturday here, not Sunday\./);
      assert.equal(await page.locator('.import-sheet .imp-kept .chip-meter').getAttribute('data-level'), '4', 'shown at your level: MUST');
      // Maya's must on Overmono is on the card, as on the wall.
      assert.equal(await page.locator('.import-sheet .card[data-artist="Overmono"] .corner-who .mark').count() >= 1, true);
      assert.equal((await page.locator('.import-sheet .imp-go').textContent()).trim(), 'Add 8 picks');

      // Land the levels: a tap cycles the way the wall's does.
      await tapCard(page, 'Airwolf Paradise');
      assert.equal(await levelOf(page, 'Airwolf Paradise'), 3);
      await tapCard(page, 'Overmono');
      await tapCard(page, 'Overmono');
      assert.equal(await levelOf(page, 'Overmono'), 4, 'must');
      const seen = [];
      for (let i = 0; i < 3; i++) { await tapCard(page, 'VTSS'); seen.push(await levelOf(page, 'VTSS')); }
      assert.deepEqual(seen, [3, 4, 0], 'VTSS: 3, must, off');
      assert.equal((await page.locator('.import-sheet .imp-go').textContent()).trim(), 'Add 7 picks');
      assert.equal(writes.length, 0, 'still nothing written');

      await tapSel(page, '.import-sheet .imp-go');
      await page.waitForSelector('.import-sheet', { state: 'detached', timeout: 4000 });
      await page.waitForFunction(() => document.getElementById('screen-settings').style.display === 'none', null, { timeout: 4000 });
      assert.match(await page.locator('#toast-root').textContent(), /Added 7 picks from your Portola schedule\./);
      for (let i = 0; i < 60 && !writes.length; i++) await sleep(100);
      assert.ok(writes.length >= 1, 'one sync went out');

      const sels = doc().festivals[FID].selections;
      const kevin = Object.fromEntries(Object.entries(sels).filter(([, by]) => by.Kevin).map(([a, by]) => [a, by.Kevin]));
      assert.deepEqual(kevin, {
        Despacio: 4, // never lowered — never touched
        'Ranger Trucco b2b Alisha': 2, 'Airwolf Paradise': 3, 'erika b2b sfcowboy': 2,
        Overmono: 4, underscores: 2, 'Silva Bumpa': 2, 'Tove Lo': 2,
      });
      assert.equal(sels.Overmono.Maya, 4, 'Maya untouched');
      for (const w of writes) {
        for (const byP of Object.values(((w.festivals || {})[FID] || {}).selections || {})) {
          assert.deepEqual(Object.keys(byP), ['Kevin'], 'only your own picks are ever written');
        }
      }
      // The wall opens on the first set added, not at its top.
      await sleep(300);
      const first = await page.evaluate(() => {
        const r = document.querySelector('#wall-root .card[data-artist="Ranger Trucco b2b Alisha"]').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, h: innerHeight };
      });
      assert.ok(first.top >= 0 && first.bottom <= first.h, `the first added card is on screen (${JSON.stringify(first)})`);
      // And the wall wears them.
      assert.equal(await page.evaluate(() => document.querySelector('#wall-root .card[data-artist="Overmono"] > .corner-about > .chip-meter')?.dataset.level), '4');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('Chromium: a failed read is its own retry; closing the sheet writes nothing', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors, writes, reads } = await memberPhone(chromium);
  try {
    let fail = true;
    await page.route('**/api/import-schedule**', (r) => (fail
      ? r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"x"}' })
      : r.fulfill({ contentType: 'application/json', body: JSON.stringify(SUN) })));
    await tapSel(page, '#gear-btn');
    await page.waitForSelector('#settings-main', { state: 'visible' });
    const row = page.locator('#settings-main .list-row', { hasText: 'Import from the Portola app' });
    await row.scrollIntoViewIfNeeded();
    await tapAt(page, await row.boundingBox());
    await page.waitForSelector('.import-sheet');
    await page.setInputFiles('.import-sheet .imp-input', [{ name: 'sun.jpg', mimeType: 'image/jpeg', buffer: SUN_IMG }]);
    await page.waitForSelector('.import-sheet .imp-shot[data-state="error"]', { timeout: 8000 });
    assert.match(await page.locator('.import-sheet .imp-shot-cap').textContent(), /Couldn’t read — tap to retry/);
    assert.equal(await page.locator('.import-sheet .imp-go').isDisabled(), true);
    fail = false;
    await tapSel(page, '.import-sheet .imp-shot-face');
    await page.waitForSelector('.import-sheet[data-import="review"]', { timeout: 8000 });
    assert.equal(await page.locator('.import-sheet .imp-grid .card').count(), 5, 'Mystery Guest is not on the lineup');
    // The ✕: the sheet goes, Settings is where you were, nothing written.
    await tapSel(page, '.import-sheet .sheet-close');
    await page.waitForSelector('.import-sheet', { state: 'detached', timeout: 4000 });
    assert.equal(await page.locator('#settings-main').isVisible(), true);
    await sleep(1600);
    assert.equal(writes.length, 0, 'closing writes nothing');
    assert.equal(reads.length, 0, 'this test answered the reads itself');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// The review's P2 (2026-09-26): taking the sheet down while an image is
// being read must stop the upload, not let it run on to the model.
test('Chromium: the ✕ mid-read cancels the upload, and nothing is written', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors, writes, reader } = await memberPhone(chromium);
  try {
    const failed = [];
    page.on('requestfailed', (r) => { if (r.url().includes('/api/import-schedule')) failed.push(r.failure() && r.failure().errorText); });
    let release;
    reader.hold = new Promise((r) => { release = r; });
    await tapSel(page, '#gear-btn');
    await page.waitForSelector('#settings-main', { state: 'visible' });
    const row = page.locator('#settings-main .list-row', { hasText: 'Import from the Portola app' });
    await row.scrollIntoViewIfNeeded();
    await tapAt(page, await row.boundingBox());
    await page.waitForSelector('.import-sheet');
    await page.setInputFiles('.import-sheet .imp-input', [{ name: 'sun.jpg', mimeType: 'image/jpeg', buffer: SUN_IMG }]);
    await page.waitForSelector('.import-sheet .imp-shot[data-state="reading"]');
    await sleep(300); // the request is out and held
    await tapSel(page, '.import-sheet .sheet-close');
    await page.waitForSelector('.import-sheet', { state: 'detached', timeout: 4000 });
    for (let i = 0; i < 30 && !failed.length; i++) await sleep(100);
    release();
    assert.equal(failed.length, 1, 'the upload was cancelled');
    await sleep(1600);
    assert.equal(writes.length, 0);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
