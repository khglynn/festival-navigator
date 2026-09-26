// A show's doors out, in a real browser (2026-09-24; prices 2026-09-26). The
// zoom of an afters card reads "Tix $45 · Info" on one line under the
// place — never the seller's name; a real mouse click on a door opens its page in
// a new tab and never picks (a click on the zoom picks, by design, so the door
// must stop the click). The jsdom twin is tests/show-links.test.mjs and the
// no-pick case in tests/events-wall.test.mjs; this is the one that sees the
// row actually drawn and a real pointer on it. Runs with `npm run
// test:browser`, on gallery.html's events wall, nothing leaves the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

async function zoomOf(page, name) {
  const card = page.locator(`#events-gallery .card[data-artist="${name}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await sleep(250);
  const b = await card.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await sleep(700);
  return page.locator('#zoom-layer .zoom-card');
}

for (const width of [390, 1280]) {
  test(`at ${width}px the doors sit on one line under the place, in the order and words the data gives`, { skip }, async () => {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${server.origin}/gallery.html`);
      await page.evaluate(() => document.fonts.ready);
      const cases = [
        ['Channel Tres', ['Tix $45', 'Info']],
        ['Overmono', ['Tix', 'Info']],
        ['DEVIANTS', ['Tix']],
        ['No Show', ['Info']],
      ];
      for (const [name, want] of cases) {
        const z = await zoomOf(page, name);
        const got = await z.evaluate((el) => {
          const row = el.querySelector('.f-links');
          const where = el.querySelector('.f-where');
          const r = row.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return {
            texts: [...row.querySelectorAll('a.f-link')].map((a) => a.textContent),
            oneLine: r.height < 22,
            inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5,
            afterWhere: !!where && (where.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          };
        });
        assert.deepEqual(got.texts, want, `${name}: the doors`);
        assert.ok(got.oneLine, `${name}: one line at ${width}px`);
        assert.ok(got.inside, `${name}: inside the zoom`);
        assert.ok(got.afterWhere, `${name}: under the place line`);
        await page.mouse.move(2, 2);
        await sleep(400);
      }
    } finally { await ctx.close(); }
  });
}

test('a real click on a door opens its page in a new tab and does not pick', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${server.origin}/gallery.html`);
    await page.evaluate(() => document.fonts.ready);
    const label = () => page.evaluate(() => document.querySelector('#events-gallery .card[data-artist="Channel Tres"]').getAttribute('aria-label'));
    const before = await label();
    const z = await zoomOf(page, 'Channel Tres');
    for (const door of await z.locator('.f-links a.f-link').all()) {
      const b = await door.boundingBox();
      const popup = page.waitForEvent('popup', { timeout: 3000 });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      const tab = await popup;
      assert.match(tab.url(), /example\.test|chrome-error/, 'the door opened a new tab');
      await tab.close();
    }
    assert.equal(await label(), before, 'the pick did not move');
  } finally { await ctx.close(); }
});

// The review of #29 (2026-09-25): a pick re-centres the zoom as its chip
// arrives, which can slide the links row under a pointer that is still
// clicking its way to MUST. For DOOR_SETTLE_MS after a pick, a click on a door
// picks and opens nothing; after that, doors are doors again.
test('a door a pick just slid under the pointer picks instead of opening a tab', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${server.origin}/gallery.html`);
    await page.evaluate(() => document.fonts.ready);
    const label = () => page.evaluate(() => document.querySelector('#events-gallery .card[data-artist="Channel Tres"]').getAttribute('aria-label'));
    const z = await zoomOf(page, 'Channel Tres');
    const name = await z.locator('.f-name').boundingBox();
    await page.mouse.click(name.x + name.width / 2, name.y + name.height / 2);
    const afterPick = await label();
    await sleep(120); // the chip has arrived and the rows have moved; well inside the settle beat
    const door = await z.locator('.f-links a.f-link').first().boundingBox();
    let opened = false;
    page.on('popup', () => { opened = true; });
    await page.mouse.click(door.x + door.width / 2, door.y + door.height / 2);
    await sleep(400);
    assert.equal(opened, false, 'no tab opened');
    assert.notEqual(await label(), afterPick, 'the click picked');
    await sleep(900); // settled
    const settled = await label();
    const again = await z.locator('.f-links a.f-link').first().boundingBox();
    const popup = page.waitForEvent('popup', { timeout: 3000 });
    await page.mouse.click(again.x + again.width / 2, again.y + again.height / 2);
    await (await popup).close();
    assert.equal(await label(), settled, 'a settled door opens its page and picks nothing');
  } finally { await ctx.close(); }
});

// The v88 walk (2026-09-25), in the real app rather than the gallery: a door
// takes focus on its own mousedown, and when a settle-window tap turns it into
// a pick, the pick's refresh rebuilds the door row. The focused door vanished,
// focusout read that as "focus left the zoom", and the zoom closed mid-pick.
// The gallery case above never saw it (no crew, no resting-card focus). A
// pinned clock keeps Date.now() inside the settle beat for every tap.
test('in the app, a door tapped just after a pick picks and the zoom stays open', { skip }, async () => {
  const { randomBytes } = await import('node:crypto');
  const FID = 'portola-2026';
  const CREW = randomBytes(20).toString('base64url'); // a made-up crew, never a real link
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
  try {
    await ctx.addInitScript(([t, f]) => {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Doors' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_welcome_v1', '1');
    }, [CREW, FID]);
    const doc = { v: 4, meta: { name: 'Doors', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
      : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
    await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-09-26T22:30:00-07:00'));
    await page.goto(`${server.origin}/#g=${CREW}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
    const at = await page.evaluate(() => {
      const el = document.querySelector('#wall-root .card[data-artist="Boys Noize"]');
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const cdp = await ctx.newCDPSession(page); // a real held finger: Playwright's tap cannot hold
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    for (let i = 0; i < 40 && !(await page.$('#zoom-layer .zoom-slot.shown')); i++) await sleep(50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach().catch(() => {});
    await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
    await sleep(700);
    const centre = (sel) => page.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, sel);
    const label = () => page.evaluate(() => document.querySelector('#wall-root .card[data-artist="Boys Noize"]').getAttribute('aria-label'));
    const open = () => page.evaluate(() => !!document.querySelector('#zoom-layer .zoom-slot.shown'));
    const n = await centre('#zoom-layer .zoom-slot.shown .f-name');
    await page.touchscreen.tap(n.x, n.y);
    await sleep(300);
    const afterPick = await label();
    assert.equal(await open(), true, 'a pick on the zoom keeps it open');
    const d = await centre('#zoom-layer .zoom-slot.shown .f-links a.f-link');
    await page.touchscreen.tap(d.x, d.y);
    await sleep(300);
    assert.notEqual(await label(), afterPick, 'the door tap picked');
    assert.equal(await open(), true, 'and the zoom is still open');
    const journal = await page.evaluate(() => import('/js/errlog.js').then((m) => m.recent()));
    assert.deepEqual(journal.filter((e) => e.kind === 'zoom-close-after-click'), [], 'nothing closed the zoom');
  } finally { await ctx.close(); }
});
