// A section read BY TIME (v94), in a real browser: the gallery's Folsom, which
// declares `layout: "by-time"`. jsdom has no layout, so the two things only a
// layout engine can answer are checked here:
//
// 1. A phrase never breaks inside itself (Kevin, 2026-09-25 — "Mayes Oyster
//    House · Polk / Gulch" split the neighbourhood). A card's time is one
//    line. Its place is phrases — the venue, the area — sharing one line with
//    a dot between only when every phrase fits whole; otherwise one phrase a
//    line and no dot (wall.js fitPlaces). A venue too long for a line on its
//    own may wrap between its words, as a name does; an area never wraps.
// 2. The geometry: one card width, the list's own edge for its band heads,
//    nothing past the shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await serveStatic(ROOT);
const browser = await launchBrowser();
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: that case skips */ }
test.after(async () => { if (browser) await browser.close(); if (webkit) await webkit.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

// Every by-time card's text, line by line as drawn.
const read = (page) => page.evaluate(() => {
  const lines = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))].length;
  };
  // A phrase's width on one line, whatever it is drawn as now (a wrapped
  // venue's own box is only as wide as its longest line).
  const natural = (s) => {
    const probe = s.cloneNode(true);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;max-width:none;width:auto;display:inline-block';
    s.parentElement.appendChild(probe);
    const wd = probe.getBoundingClientRect().width;
    probe.remove();
    return wd;
  };
  const cards = [...document.querySelectorAll('#events-wall .time-list .card')];
  return {
    count: cards.length,
    cards: cards.map((c) => {
      const place = c.querySelector(':scope > .place');
      const segs = place ? [...place.querySelectorAll(':scope > .phrase')] : [];
      const sep = place && place.querySelector(':scope > .pdot');
      const w = place ? place.clientWidth : 0;
      return {
        artist: c.dataset.artist,
        time: c.querySelector(':scope > .time') ? lines(c.querySelector(':scope > .time')) : null,
        stacked: !!place && place.classList.contains('stacked'),
        sepShown: !!sep && sep.getBoundingClientRect().width > 0,
        oneLineW: segs.reduce((n, s) => n + s.scrollWidth, 0) + (segs.length > 1 ? 11 * (segs.length - 1) : 0),
        placeW: w,
        segs: segs.map((s) => ({ text: s.textContent, lead: s.classList.contains('lead'), lines: lines(s), top: Math.round(s.getBoundingClientRect().top), fitsAlone: natural(s) <= w + 0.5, cut: s.scrollWidth > s.clientWidth + 0.5 })),
        width: Math.round(c.getBoundingClientRect().width * 2) / 2,
        right: c.getBoundingClientRect().right,
      };
    }),
    heads: [...new Set([...document.querySelectorAll('#events-wall .time-list')].map((l) => {
      const first = l.querySelector('.card').getBoundingClientRect().left;
      return [...l.querySelectorAll('.band-head')].every((h) => Math.abs(h.getBoundingClientRect().left - first) < 0.75);
    }))],
    shellRight: document.querySelector('#events-wall').getBoundingClientRect().right,
  };
});

const cases = [
  ...[320, 390, 1280].map((width) => ({ width, engine: browser, name: `${width}px`, skip })),
  { width: 390, engine: webkit, name: 'WebKit 390px', skip: webkit ? false : 'WebKit not installed (npx playwright install webkit)' },
];
for (const { width, engine, name, skip: why } of cases) {
  test(`${name}: a by-time card's time is one line, and no phrase of its place breaks inside itself — one line with a dot while they fit, else a phrase a line`, { skip: why }, async () => {
    const touch = width < 720 && engine === browser;
    const ctx = await engine.newContext({ viewport: { width, height: 900 }, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
    const page = await ctx.newPage();
    try {
      await page.goto(`${server.origin}/gallery.html`);
      await page.waitForSelector('#events-wall .time-list .card');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300); // the fit observer's pass after the fonts
      const g = await read(page);
      assert.ok(g.count >= 10, `the gallery's Folsom reads by time (${g.count} cards)`);
      let stackedSeen = 0;
      for (const c of g.cards) {
        if (c.time !== null) assert.equal(c.time, 1, `${c.artist}: the time is one line`);
        for (const s of c.segs) {
          if (!s.lead) assert.equal(s.lines, 1, `${c.artist}: "${s.text}" never breaks`);
          else if (s.lines > 1) assert.ok(c.stacked && !s.fitsAlone, `${c.artist}: the venue wraps only when it is longer than a line on its own`);
        }
        if (c.segs.length > 1) {
          assert.equal(c.stacked, c.oneLineW > c.placeW + 0.5, `${c.artist}: stacked exactly when the phrases do not fit one line (${c.oneLineW} vs ${c.placeW})`);
          assert.ok(c.segs.every((s) => !s.cut), `${c.artist}: no phrase is cut short (${c.segs.map((s) => s.text).join(' / ')})`);
          if (c.stacked) {
            stackedSeen += 1;
            assert.ok(!c.sepShown, `${c.artist}: no dot once the phrases stack`);
            assert.ok(c.segs[1].top > c.segs[0].top, `${c.artist}: the area on its own line`);
          } else {
            assert.ok(c.sepShown, `${c.artist}: a dot between phrases on one line`);
            assert.equal(new Set(c.segs.map((s) => s.top)).size, 1, `${c.artist}: one line`);
            assert.ok(c.segs.every((s) => !s.cut), `${c.artist}: nothing cut`);
          }
        }
        assert.ok(c.right <= g.shellRight + 0.5, `${c.artist}: nothing past the shell`);
      }
      if (width === 320) {
        assert.ok(stackedSeen > 0, 'a narrow phone stacks at least one place (Mayes Oyster House / Polk Gulch)');
        const long = g.cards.find((c) => c.segs[0] && c.segs[0].text === 'Folsom Street Community Center');
        assert.ok(long && long.stacked && long.segs[0].lines === 2 && long.segs[1].lines === 1,
          `a venue longer than the card wraps between its words; its area keeps a line of its own (${JSON.stringify(long && long.segs)})`);
      }
      assert.equal(new Set(g.cards.map((c) => c.width)).size, 1, `one card width (${[...new Set(g.cards.map((c) => c.width))]})`);
      assert.deepEqual(g.heads, [true], 'every band head on its list\'s edge');
    } finally {
      await ctx.close();
    }
  });
}
