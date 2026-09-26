// The zoom's notes chip in Safari's engine (2026-09-25). Safari does not focus
// a button it is pressed on, so a press on the chip moved focus from the
// resting card (focused by the last pick) to nowhere, the focusout guard read
// that as the person leaving, and the zoom closed before the chip's click
// landed. Kevin, on v88: "clicking notes was harder this time"; his phone's
// reports showed two "focus left the card" closes, then the sheet on the
// third tap. Desktop WebKit under Playwright does not reproduce iOS's
// focus-to-nowhere (this passes with or without the fix), so the guard itself
// is pinned in tests/zoom-overlay.test.mjs; this is the real-engine smoke that
// the chip flow opens the notes on the first click after a pick. The app
// boots for real against a made-up crew; /api never leaves the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchWebkit } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
let webkit = null;
webkit = await launchWebkit();
test.after(async () => { if (webkit) await webkit.close(); await server.close(); });

test('WebKit: after a pick, one click on the zoom\'s notes chip opens the notes, and the zoom does not close first', { skip: webkit ? false : 'WebKit not installed' }, async () => {
  const FID = 'portola-2026';
  const CREW = randomBytes(20).toString('base64url'); // a made-up crew, never a real link
  const ctx = await webkit.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Los_Angeles' });
  try {
    await ctx.addInitScript(([t, f]) => {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Chip' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_welcome_v1', '1');
    }, [CREW, FID]);
    const doc = { v: 4, meta: { name: 'Chip', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
      : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
    await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-09-26T15:00:00-07:00'));
    await page.goto(`${server.origin}/#g=${CREW}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
    const at = await page.evaluate(() => {
      const el = document.querySelector('#wall-root .card[data-artist="Boys Noize"]');
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(at.x - 40, at.y - 40);
    await page.mouse.move(at.x, at.y, { steps: 6 }); // a real move: the still-hand rule arms hover
    await page.waitForSelector('#zoom-layer .zoom-slot.shown', { timeout: 4000 });
    await sleep(500);
    const centre = (sel) => page.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, sel);
    const n = await centre('#zoom-layer .zoom-slot.shown .f-name');
    await page.mouse.move(n.x, n.y, { steps: 3 });
    await page.mouse.click(n.x, n.y); // a pick: refreshCard hands focus to the fresh resting card
    await sleep(900);
    assert.equal(await page.evaluate(() => !!document.querySelector('#zoom-layer .zoom-slot.shown')), true, 'the pick kept the zoom');
    const chip = await centre('#zoom-layer .zoom-slot.shown button.f-chip.notes');
    await page.mouse.move(chip.x, chip.y, { steps: 3 });
    await page.mouse.click(chip.x, chip.y);
    await sleep(600);
    const journal = await page.evaluate(() => import('/js/errlog.js').then((m) => m.recent()));
    assert.deepEqual(journal.filter((e) => /focus left/.test(e.msg || '')).map((e) => e.msg), [], 'no close on the way to the chip');
    // The notes sheet itself, by the id every sheet path owns — not a journal
    // line: a close that was meant (the chip opening its sheet) records
    // nothing since v92, which only reports a close nobody asked for.
    assert.equal(await page.evaluate(() => {
      const s = document.getElementById('artist-sheet');
      return !!s && !s.classList.contains('join-shelf');
    }), true, 'the notes opened on the first click');
  } finally { await ctx.close(); }
});
