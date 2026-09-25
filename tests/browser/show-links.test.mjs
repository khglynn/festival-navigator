// A show's doors out, in a real browser (2026-09-24). The zoom of an afters
// card reads "Tix @ AXS · Info @ DoTheBay" on one line under the place, at a
// phone's width and a laptop's; a real mouse click on a door opens its page in
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
        ['Channel Tres', ['Tix @ AXS', 'Info @ DoTheBay']],
        ['Overmono', ['Tix @ Ticketmaster', 'Info @ Do512']],
        ['DEVIANTS', ['Tix @ Eventbrite']],
        ['No Show', ['Info @ DoTheBay']],
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
