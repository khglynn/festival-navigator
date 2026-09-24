// The zoom's who-chips, in a real browser (2026-09-23): the width rule is
// layout, and layout is exactly what the Node suite cannot see.
//
// One chip per level anyone chose; inside it the meter's glyph, then first
// names (two at most, then "+n"). A name never wraps, and a chip never
// outgrows its row: at worst its names ellipsize, and the glyph and the "+n"
// always show. The stress case is Kevin's: a crew of fifteen with thirteen in,
// on a 390 phone, held with a real finger — plus one absurdly long name.
//
// It runs with `npm run test:browser`, against the real index.html on
// Portola, with a made-up crew and /api answered inside the page (nothing
// leaves it). The unit twin is tests/zoom-chips.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FID = 'portola-2026';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

// Fifteen people; Kevin is you. The long name sits where it is shown (second
// in the ×2 chip, after You), so the chip has to hold it.
const LONG = 'Bartholomew-Maximiliana';
const CREW = ['Kevin', 'Drew', 'Kat', 'Nhu', 'Pegah', 'Ross', 'Sam', 'Hal', 'Ivy', 'Jo', 'Lou', LONG, 'Mary Jane', 'Oli', 'Tess'];
const ROBYN = { Hal: 4, Drew: 4, Lou: 4, Kat: 3, 'Mary Jane': 3, Jo: 3, Kevin: 2, [LONG]: 2, Ivy: 2, Nhu: 2, Pegah: 1, Oli: 1, Tess: 1 };
const doc = () => ({
  v: 4, meta: { name: 'Chips', inviteFestId: FID }, spotify: {}, affinity: {},
  people: Object.fromEntries(CREW.map((n, i) => [n, { colorIndex: i }])),
  festivals: { [FID]: { selections: { Robyn: ROBYN } } },
});

async function openWall() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const TOKEN = 'chipscontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Chips' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN, FID]);
  const body = JSON.stringify(doc());
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.setFixedTime(new Date('2026-09-23T19:00:00-07:00'));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(250);
  return { ctx, page };
}

test('a crew of fifteen at 390: four chips, one line each, none past its row, the long name ellipsized', { skip }, async () => {
  const { ctx, page } = await openWall();
  try {
    const at = await page.evaluate(() => {
      const el = [...document.querySelectorAll('#wall-root .card.cell')].find((c) => c.dataset.artist === 'Robyn');
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await sleep(200);
    // A real hold: the app's long-press ignores mouse pointers by design.
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
    await sleep(650);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForSelector('#zoom-layer .zoom-slot.shown .f-who', { timeout: 4000 });
    await sleep(700);
    const m = await page.evaluate(() => {
      const row = document.querySelector('#zoom-layer .zoom-slot.shown .f-who');
      const rr = row.getBoundingClientRect();
      return [...row.children].map((c) => {
        const r = c.getBoundingClientRect();
        const more = c.querySelector('.f-more');
        const glyph = c.querySelector('.bars, .must');
        return {
          level: c.dataset.level, label: c.getAttribute('aria-label'), you: c.classList.contains('you'),
          h: r.height, inRow: r.left >= rr.left - 0.5 && r.right <= rr.right + 0.5,
          // One line = every name's centre on the chip's own centre line (the
          // "+n" is set a size smaller, so tops differ; centres do not).
          lines: [...c.querySelectorAll('.f-nm, .f-more')].every((n) => { const b = n.getBoundingClientRect(); return Math.abs((b.top + b.bottom) / 2 - (r.top + r.bottom) / 2) <= 2; }) ? 1 : 2,
          ellipsized: [...c.querySelectorAll('.f-nm')].some((n) => n.scrollWidth > n.clientWidth + 0.5),
          moreShown: more ? more.getBoundingClientRect().width > 0 && more.getBoundingClientRect().right <= r.right : null,
          glyphShown: glyph.getBoundingClientRect().width > 0,
        };
      });
    });
    assert.deepEqual(m.map((c) => c.level), ['4', '3', '2', '1'], `four chips, loudest first: ${JSON.stringify(m)}`);
    for (const c of m) {
      assert.equal(c.lines, 1, `a chip's names sit on one line: ${JSON.stringify(c)}`);
      assert.ok(c.h <= 24, `a chip is one line tall (22px): ${JSON.stringify(c)}`);
      assert.ok(c.inRow, `a chip never outgrows its row: ${JSON.stringify(c)}`);
      assert.ok(c.glyphShown, `the meter's glyph always shows: ${JSON.stringify(c)}`);
      assert.equal(c.moreShown, true, `every chip here has a "+n", and it always shows: ${JSON.stringify(c)}`);
    }
    const mine = m.find((c) => c.you);
    assert.equal(mine.level, '2', 'your chip is the ×2 chip');
    assert.equal(mine.label, `Picked ×2: You, ${'Bartholomew-Maximiliana'}, Ivy and Nhu`, 'the label names everyone in full, even past the ellipsis');
    assert.ok(mine.ellipsized, 'the long name gives way with an ellipsis rather than pushing the chip out');
  } finally {
    await ctx.close();
  }
});
