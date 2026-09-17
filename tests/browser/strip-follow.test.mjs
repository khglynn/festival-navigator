// The stage strip follows its grid, at phone width, with real wheel input
// against gallery.html's events wall (the production renderWall).
//
// The strip's row rides the grid's scroll timeline where the engine has one,
// and a transform from the grid's scroll event otherwise. Low Power kills
// every CSS animation (`.low-power * { animation: none !important }`), so on
// an engine WITH scroll timelines the venue names froze over sliding columns
// the moment Low Power was on (review, 2026-09-16) — Chrome and Safari 26
// both. No jsdom test can see that: jsdom has no ScrollTimeline and runs no
// CSS. What this asserts is what a person sees: the header over a column
// stays over that column after the columns scroll.
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

let page;
test.before(async () => {
  if (!browser) return;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(`${server.origin}/gallery.html`, { waitUntil: 'load' });
  await page.waitForSelector('#events-wall .tt-block .stage-strip', { timeout: 15000 });
});

// The first timetable on the events wall whose columns overflow a phone,
// centred on screen, and a point inside its scroller with no card under it
// (a card would grow a zoom, and a wheel over the overlay scrolls nothing).
const settle = () => page.evaluate(async () => {
  const block = [...document.querySelectorAll('#events-wall .tt-block')].find((b) => {
    const lead = b.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
    return lead && lead.scrollWidth - lead.clientWidth > 120;
  });
  if (!block) return null;
  const lead = block.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
  lead.scrollIntoView({ block: 'center' });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const r = lead.getBoundingClientRect();
  for (let y = Math.max(r.top, 0) + 8; y < Math.min(r.bottom, innerHeight) - 8; y += 12) {
    for (let x = r.left + 8; x < r.right - 8; x += 12) {
      const el = document.elementFromPoint(x, y);
      if (el && lead.contains(el) && !el.closest('.card')) return { x: Math.round(x), y: Math.round(y) };
    }
  }
  return null;
});
// How far the strip's row and the grid each sit from their own scroller's
// edge. Following means the two agree: both are -scrollLeft.
const follow = () => page.evaluate(() => {
  const block = [...document.querySelectorAll('#events-wall .tt-block')].find((b) => {
    const lead = b.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
    return lead && lead.scrollWidth - lead.clientWidth > 120;
  });
  const lead = block.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
  const strip = block.querySelector('.stage-strip .times-scroll');
  const off = (scroller) => scroller.querySelector('.times-grid').getBoundingClientRect().left - scroller.getBoundingClientRect().left;
  return { scrollLeft: lead.scrollLeft, grid: off(lead), strip: off(strip) };
});
const wheel = async (dx) => {
  const at = await settle();
  assert.ok(at, 'an overflowing timetable with an empty spot is on screen');
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(dx, 0);
  await sleep(400);
  return follow();
};

test('the strip follows its columns — and still does under Low Power', { skip }, async () => {
  let f = await wheel(140);
  assert.ok(f.scrollLeft > 60, `the columns scrolled: ${JSON.stringify(f)}`);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `the venue names moved with them: ${JSON.stringify(f)}`);

  // Low Power, the way the app gets it: the setting flips and the wall repaints.
  await page.click('#events-lowpower');
  assert.equal(await page.evaluate(() => document.body.classList.contains('low-power')), true);
  f = await wheel(-90);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `under Low Power the names still sit over their columns: ${JSON.stringify(f)}`);
  f = await wheel(160);
  assert.ok(f.scrollLeft > 60, `the columns scrolled again: ${JSON.stringify(f)}`);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `and the names followed: ${JSON.stringify(f)}`);

  await page.click('#events-lowpower');
  f = await wheel(-120);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `Low Power off, the timeline follow is back: ${JSON.stringify(f)}`);
});

// The first hour label straddles the top of its rail — every other one has a
// grid row above it, and that one has the sticky strip, which is opaque. It
// sat half under the stage names on every grid at every width (2026-09-17).
// The clearance belongs to the strip, so no grid ever needs its own patch.
test('the first hour label clears the sticky stage strip, at 390 and at 1440', { skip }, async () => {
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { throw e; });
    try {
      await p.goto(`${server.origin}/gallery.html`, { waitUntil: 'load' });
      await p.waitForSelector('#events-wall .tt-block .times-rail .hour-label', { timeout: 15000 });
      const covered = await p.evaluate(() => [...document.querySelectorAll('#events-wall .tt-block')].map((b) => {
        const strip = b.querySelector('.stage-strip').getBoundingClientRect();
        const label = b.querySelector('.times-rail .hour-label').getBoundingClientRect();
        return Math.round(strip.bottom - label.top);
      }));
      assert.ok(covered.length, 'a grid to measure');
      assert.ok(covered.every((n) => n <= 0), `${width}px: the strip covers ${covered.join(', ')} px of the first hour label`);
    } finally {
      await ctx.close();
    }
  }
});
