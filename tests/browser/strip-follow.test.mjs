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
// Which route the first overflowing strip is on, as the ENGINE sees it: the
// computed animation (so a kill rule that froze it would show), the timeline
// it rides against the one its grid declares, and any inline transform a
// scroll handler wrote.
const route = () => page.evaluate(() => {
  const block = [...document.querySelectorAll('#events-wall .tt-block')].find((b) => {
    const lead = b.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
    return lead && lead.scrollWidth - lead.clientWidth > 120;
  });
  const lead = block.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
  const row = block.querySelector('.stage-strip .times-grid');
  const cs = getComputedStyle(row);
  return {
    follow: block.querySelector('.stage-strip').dataset.follow,
    animation: cs.animationName,
    rides: cs.animationTimeline,
    declared: (lead.style.scrollTimeline || '').split(' ')[0],
    inline: row.style.transform,
    hasTimelines: typeof window.ScrollTimeline === 'function',
  };
});
// Where the engine has scroll timelines, the follow is the timeline — Low
// Power and Reduce Motion included (2026-09-23): tracking a finger is direct
// manipulation, and the transform route trails the grid by a frame on a phone.
const onTimeline = (r, why) => {
  if (!r.hasTimelines) return;
  assert.equal(r.follow, 'timeline', `${why}: the timeline route — ${JSON.stringify(r)}`);
  assert.equal(r.animation, 'strip-follow', `${why}: and the kill rules did not freeze it — ${JSON.stringify(r)}`);
  assert.equal(r.rides, r.declared, `${why}: riding its own grid's timeline — ${JSON.stringify(r)}`);
  assert.equal(r.inline, '', `${why}: no script moves the row — ${JSON.stringify(r)}`);
};
const wheel = async (dx) => {
  const at = await settle();
  assert.ok(at, 'an overflowing timetable with an empty spot is on screen');
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(dx, 0);
  await sleep(400);
  return follow();
};

test('the strip follows its columns — and still does, on the timeline, under Low Power and Reduce Motion', { skip }, async () => {
  let f = await wheel(140);
  assert.ok(f.scrollLeft > 60, `the columns scrolled: ${JSON.stringify(f)}`);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `the venue names moved with them: ${JSON.stringify(f)}`);
  onTimeline(await route(), 'motion on');

  // Low Power, the way the app gets it: the setting flips and the wall repaints.
  await page.click('#events-lowpower');
  assert.equal(await page.evaluate(() => document.body.classList.contains('low-power')), true);
  f = await wheel(-90);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `under Low Power the names still sit over their columns: ${JSON.stringify(f)}`);
  f = await wheel(160);
  assert.ok(f.scrollLeft > 60, `the columns scrolled again: ${JSON.stringify(f)}`);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `and the names followed: ${JSON.stringify(f)}`);
  onTimeline(await route(), 'Low Power');

  await page.click('#events-lowpower');
  f = await wheel(-120);
  assert.ok(Math.abs(f.strip - f.grid) <= 1, `Low Power off, the follow is unchanged: ${JSON.stringify(f)}`);

  // Reduce Motion (the OS setting): the tokens file's kill rule applies to the
  // whole page, and the follow is the one animation that out-ranks it.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    f = await wheel(150);
    assert.ok(f.scrollLeft > 60, `the columns scrolled under Reduce Motion: ${JSON.stringify(f)}`);
    assert.ok(Math.abs(f.strip - f.grid) <= 1, `and the names followed them: ${JSON.stringify(f)}`);
    onTimeline(await route(), 'Reduce Motion');
    const others = await page.evaluate(() => [...document.querySelectorAll('.card.animated, .hero-grain')]
      .map((el) => getComputedStyle(el).animationName).filter((n) => n && n !== 'none'));
    assert.deepEqual(others, [], 'everything else is still still: only the follow is exempt');
  } finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
});

// Two grid days is the shape every real scheduled fest has, and one grid day
// hid this: every day's grid and its strip carry data-sync="grid" so the days
// mirror one scroll position, and the wiring handed EVERY strip the group's
// first grid as its lead. The second call overwrote the lead's scroll-timeline
// name, and the second day's name was declared outside its own timeline-scope
// — so on Portola BOTH strips froze while the columns slid under them, and
// "Pier Stage" sat over a Warehouse set (real-browser walk, 2026-09-17). A
// strip follows the grid it sits above. Nothing else.
test('two grid days: each strip is bound to its OWN columns, and both follow a real scroll', { skip }, async () => {
  const blocks = () => page.evaluate(() => [...document.querySelectorAll('#events-wall .tt-block')].map((b) => {
    const lead = b.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
    const row = b.querySelector('.stage-strip .times-grid');
    const off = (scroller) => scroller.querySelector('.times-grid').getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    return {
      day: lead.dataset.day,
      scrollLeft: lead.scrollLeft,
      grid: off(lead),
      strip: off(b.querySelector('.stage-strip .times-scroll')),
      timeline: (lead.style.scrollTimeline || '').split(' ')[0],
      boundTo: getComputedStyle(row).animationTimeline || '',
      stripMax: row.style.getPropertyValue('--strip-max'),
      leadMax: `${Math.max(0, lead.scrollWidth - lead.clientWidth)}px`,
    };
  }));

  const before = await blocks();
  assert.equal(before.length, 2, 'the gallery fest has two grid days');
  for (const b of before) {
    assert.equal(b.boundTo, b.timeline, `${b.day}: its strip rides the timeline its OWN grid declares`);
    assert.ok(b.timeline, `${b.day}: a timeline name`);
    assert.equal(b.stripMax, b.leadMax, `${b.day}: --strip-max is its own grid's maximum scroll`);
  }
  assert.notEqual(before[0].timeline, before[1].timeline, 'two days, two timelines');

  // One real wheel over the first day. The days mirror scrollLeft, so BOTH
  // days' columns move — and both days' stage names have to move with them.
  const after = await wheel(180).then(() => blocks());
  assert.ok(after[0].scrollLeft > 60, `the columns scrolled: ${JSON.stringify(after)}`);
  for (const b of after) {
    assert.ok(Math.abs(b.strip - b.grid) <= 1, `${b.day}: the stage names sit over their own columns — ${JSON.stringify(b)}`);
  }
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
