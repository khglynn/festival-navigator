// NOW, in a real browser with a pinned clock (2026-09-24). Kevin: "where is
// ross likely right now … tapping ross on the top to highlight him and then
// clicking something in the scroll-to-time bar", and then: "the line and
// highlight combo" — the answer is the now line and Ross's highlighted card
// seen TOGETHER.
//
// Saturday 10:30 PM PDT at Portola: Soulwax and Prospa are on the grid, and
// across town the afters have opened (Milli Meng at Public Works, Galen at the
// Great Northern). Ross is at the afters; Nhu is at Pier 80 for Soulwax. The
// app is booted for real against a made-up crew; /api never leaves the page.
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
// NOW is for a phone in a field, so the landings run in WebKit too (the
// iPhone's engine: no scrollend, its own smooth scroll) where it is installed.
let webkit = null;
try { webkit = await (await import('playwright')).webkit.launch({ headless: true }); } catch { /* not installed: those cases skip */ }
test.after(async () => { if (browser) await browser.close(); if (webkit) await webkit.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;
const skipWebkit = webkit ? false : 'Playwright WebKit is not installed (npx playwright install webkit)';

const SAT_1030 = new Date('2026-09-26T22:30:00-07:00');
const SAT_9AM = new Date('2026-09-26T09:00:00-07:00');
// Kat is only at the Warehouse (Prospa): the third column, off a phone's
// screen until the grid scrolls to it. Ross's early evening is Despacio — a
// set hours long, over by 9:45, so it never competes at 10:30.
// Dee, at 7:00 PM, has two sets on at once three columns apart: DJ Shadow
// (Crane Stage) and Despacio (the last column) — off each other's screen on
// a phone.
const SELECTIONS = { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Prospa: { Nhu: 2, Kat: 3 }, Despacio: { Ross: 3, Dee: 4 }, 'DJ Shadow': { Dee: 2 } };

// `fold`: rooms folded away before the app opens (the show menu's own
// device-local setting, filters.js), e.g. ['Afters'] for the festival's room only.
async function openApp({ width = 390, height = 844, touch = true, now = SAT_1030, fest = 'portola-2026', engine = browser, wide = null, fold = null } = {}) {
  const ctx = await engine.newContext({ viewport: { width, height }, hasTouch: touch, serviceWorkers: 'block' });
  const TOKEN = 'nowjumpcontract_0123456789'; // a made-up crew, never a real link
  // `wide`: every glyph in the dock drawn this much wider than
  // this engine draws it — a stand-in for an engine whose Inter and Anton
  // are wider (CI's Linux Chromium put ACL's dock row 15px narrower than a
  // Mac at every width, 2026-09-24; Android draws like Linux). The meter
  // contract's trick, aimed at the dock.
  if (wide) {
    await ctx.addInitScript((w) => {
      // Added to what each face already carries (the fest name's .04em).
      const css = `.dock .day-tab, .dock .now-tab .word { letter-spacing: ${w} !important; }
        .dock .fest-name { letter-spacing: calc(.04em + ${w}) !important; }`;
      const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };
      if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
    }, wide);
  }
  await ctx.addInitScript(([t, f, folded]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Now' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
    if (folded) localStorage.setItem(`fn_fold_v1_${f}`, JSON.stringify(folded));
    // Every scroll the app asks of the dock's days row, for a failure message.
    window.__rowLog = [];
    const scrollToWas = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (...args) {
      if (this.id === 'dock-days') window.__rowLog.push([Math.round(performance.now()), JSON.stringify(args[0]), this.scrollLeft, this.clientWidth, (this.querySelector('.active') || {}).textContent, (new Error().stack.split('\n')[3] || '').trim().replace(/https?:\/\/[^/]+/, '')]);
      return scrollToWas.apply(this, args);
    };
    // NOW's pulse, told apart from every other animation a card runs (a
    // picked card's aura, an arrival): a running scale on the card itself.
    // Every card NOW pulses, in order, as it starts (a pulse is a scale).
    window.__pulses = [];
    // And the now line's own pulse (a tap that moved nothing): the line and
    // its time label on the rail, by class name.
    window.__linePulses = [];
    const animateWas = Element.prototype.animate;
    Element.prototype.animate = function (kf, opts) {
      if (this.classList && this.classList.contains('card') && JSON.stringify(kf).includes('scale(')) window.__pulses.push(this);
      if (this.classList && (this.classList.contains('now-line') || this.classList.contains('now-label')) && JSON.stringify(kf).includes('scale')) window.__linePulses.push(this.className);
      return animateWas.call(this, kf, opts);
    };
    window.__pulsing = (c) => c.getAnimations().some((a) => a.playState === 'running' && a.effect
      && a.effect.target === c && a.effect.getKeyframes().some((k) => /scale\(/.test(k.transform || '')));
  }, [TOKEN, fest, fold]);
  // Each page gets its OWN copy of the picks: a test that changes `doc` (a
  // remote un-pick) must not change them for every test after it — sharing
  // SELECTIONS by reference turned Ross's Milli Meng to 0 for the Reduce
  // Motion case three tests later (CI, 2026-09-24).
  const doc = {
    v: 4, meta: { name: 'Now', inviteFestId: fest }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 }, Kat: { colorIndex: 6 }, Dee: { colorIndex: 2 } },
    festivals: { [fest]: { selections: fest === 'portola-2026' ? structuredClone(SELECTIONS) : {} } },
  };
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.setFixedTime(now);
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  // The fonts first: on the full Folsom wall (v94) a late font reflowed the
  // days above Saturday's grid between one tap and the next, and two landings
  // meant to share a height came out 3px apart. Every tap measures at rest.
  await page.evaluate(() => document.fonts.ready);
  await sleep(600); // the day-of open's own landing
  // `doc` is the crew the route serves: change it, then `pull(page)`, and the
  // app takes it as a real remote change (a poll that repaints the wall).
  return { ctx, page, doc, door: width >= 720 ? 'rail' : 'dock' };
}
const pull = (page) => page.evaluate(() => import('/js/sync.js').then((s) => s.pollSync()));

// Where things are now, against the part of the window a person can see:
// under the sticky chrome (and a grid's pinned stage strip), above the dock.
// `where` narrows the card — 'cell' for the grid's, else a room's name —
// because an artist can play twice (Soulwax is Thursday's afters AND
// Saturday's grid).
const view = (page, artist, where = null) => page.evaluate(([a, w]) => {
  const dock = document.getElementById('dock');
  const dockTop = dock && getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect().top : innerHeight;
  const rail = document.getElementById('day-rail');
  const railBottom = rail && getComputedStyle(rail).display !== 'none' ? rail.getBoundingClientRect().bottom : 0;
  const line = document.querySelector('#wall-root .now-line');
  const lr = line ? line.getBoundingClientRect() : null;
  const block = line ? line.closest('.tt-block') : null;
  const strip = block ? block.querySelector('.stage-strip').getBoundingClientRect() : null;
  const card = a ? [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a && !c.classList.contains('dim')
    && (!w || (w === 'cell' ? c.classList.contains('cell') : c.closest('.room').dataset.room === w))) : null;
  const cr = card ? card.getBoundingClientRect() : null;
  return {
    dockTop, railBottom, innerWidth,
    line: lr && { top: lr.top, left: lr.left, right: lr.right }, stripBottom: strip ? strip.bottom : null,
    card: cr && { top: cr.top, bottom: cr.bottom, left: cr.left, right: cr.right, cell: card.classList.contains('cell'), room: card.closest('.room').dataset.room },
  };
}, [artist, where]);

// The landing is a smooth scroll (the page, and a grid sideways): wait for it
// to come to rest rather than for a fixed time — under a loaded CI box a
// glide can outlast any sleep (a 1.1 s sleep flaked once in the full suite).
const settled = (page) => page.evaluate(() => new Promise((resolve) => {
  const where = () => scrollY + [...document.querySelectorAll('.times-scroll, .stack-scroll')].reduce((s, e) => s + e.scrollLeft * 1e-3, 0);
  let last = NaN, still = 0;
  const t0 = performance.now();
  const step = () => {
    const w = where();
    still = w === last ? still + 1 : 0;
    last = w;
    if (still >= 12 || performance.now() - t0 > 6000) resolve();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}));
const tapNow = async (page, door) => {
  await page.locator(`#${door}-now`).click();
  await sleep(150); // the glide starts
  await settled(page);
};
const highlight = async (page, name) => {
  await page.locator('#person-chips .person-chip', { hasText: name }).first().click();
  await sleep(400);
};

for (const [width, height, touch, engine, name] of [[390, 844, true, browser, ''], [1280, 800, false, browser, ''], [390, 844, true, webkit, 'WebKit ']]) {
  const skip = engine === webkit ? skipWebkit : browser ? false : NO_BROWSER;
  test(`${name}${width}: NOW sits before the days, is not a day, and a tap lands the now line in view`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch, engine });
    try {
      const tab = await page.evaluate((d) => {
        const now = document.getElementById(`${d}-now`);
        const days = document.getElementById(`${d}-days`);
        const r = now.getBoundingClientRect();
        return {
          shown: !now.hidden && r.width > 0, text: now.textContent.trim(), left: r.right <= days.getBoundingClientRect().left + 1,
          day: now.dataset.day || null, color: getComputedStyle(now).color, dot: !!now.querySelector('.live'),
        };
      }, door);
      assert.ok(tab.shown, 'something is live, so NOW is there');
      assert.equal(tab.text, 'NOW');
      assert.ok(tab.left, 'to the left of the days');
      assert.equal(tab.day, null, 'not a day: the scrollspy never lights it');
      assert.ok(tab.dot, 'with its live dot');
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      await tapNow(page, door);
      const v = await view(page, null);
      assert.ok(v.line, 'the line is on the wall');
      assert.ok(v.line.top > v.stripBottom && v.line.top < v.dockTop, `the line is in view: ${JSON.stringify(v)}`);
      assert.equal(await page.evaluate((d) => document.getElementById(`${d}-now`).classList.contains('active'), door), false);
    } finally { await ctx.close(); }
  });

  test(`${name}${width}: Ross highlighted — NOW lands on his live pick in SAT AFTERS`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch, engine });
    try {
      await highlight(page, 'Ross');
      await tapNow(page, door);
      const v = await view(page, 'Milli Meng', 'Afters');
      assert.ok(v.card, 'his card is on the wall, undimmed');
      assert.equal(v.card.room, 'Afters');
      const top = Math.max(v.railBottom, 0);
      assert.ok(v.card.top >= top && v.card.bottom <= v.dockTop, `his card sits in view below the chrome: ${JSON.stringify(v)}`);
      // Tap again, already there: nothing moves, and the card pulses at once.
      // With a mouse, the first click was made while the rail still sat below
      // the header; the jump stuck the rail to the top and left the pointer
      // over the wall, where hover grows whatever card is under it — and a
      // zoom blooms OVER the rail by design (z 36 > 25), covering NOW. A hand
      // moves off it first (Playwright would otherwise scroll to dodge it).
      await page.mouse.move(8, 8);
      await sleep(1000); // the zoom's grace close, and the first landing's pulse, are over
      const y = await page.evaluate(() => scrollY);
      await page.locator(`#${door}-now`).click();
      await sleep(80);
      const again = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#wall-root .room[data-room="Afters"] .card')].find((x) => x.dataset.artist === 'Milli Meng');
        return { y: scrollY, pulsing: window.__pulsing(c) };
      });
      assert.ok(Math.abs(again.y - y) < 1, `a second tap does not move the page: ${y} -> ${again.y}`);
      assert.ok(again.pulsing, 'and the card pulses straight away — the pulse is the whole answer');
    } finally { await ctx.close(); }
  });

  test(`${name}${width}: Nhu highlighted — her live pick on the grid and the now line are in view together`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch, engine });
    try {
      await highlight(page, 'Nhu');
      await tapNow(page, door);
      const v = await view(page, 'Soulwax', 'cell');
      assert.ok(v.card && v.card.cell, 'Soulwax, on the grid');
      assert.ok(v.line.top > v.stripBottom && v.line.top < v.dockTop, `the line is in view: ${JSON.stringify(v)}`);
      assert.ok(v.card.top >= v.stripBottom - 1 && v.card.top < v.dockTop, `the card's top is in view: ${JSON.stringify(v)}`);
      assert.ok(v.card.top <= v.line.top && v.card.bottom >= v.line.top, 'and it crosses the line — it is playing now');
      assert.ok(v.card.left >= 0 && v.card.right <= v.innerWidth, `and across, its column is on screen: ${JSON.stringify(v)}`);
      assert.ok(v.line.left <= v.card.left + 1 && v.line.right >= v.card.right - 1, `and the line runs right across the card: ${JSON.stringify(v)}`);
    } finally { await ctx.close(); }
  });
}

// The line runs under EVERY column (Kevin's local demo, 2026-09-24: at 430
// the line stopped partway across the grid, and scrolled to Warehouse / Ship
// Tent there was none). It was `left:0; right:0` on a grid whose BOX was only
// the scroller's width while its tracks overflowed it — so it spanned the
// view at scroll 0, not the columns.
const lineVsColumns = (page) => page.evaluate(() => {
  const line = document.querySelector('#wall-root .now-line');
  const grid = line.closest('.times-grid');
  const scroller = grid.closest('.times-scroll');
  const cells = [...grid.querySelectorAll('.card.cell')];
  const col = (c) => Number(c.style.gridColumn) || 0;
  const lastCol = Math.max(...cells.map(col));
  const last = cells.find((c) => col(c) === lastCol).getBoundingClientRect();
  const l = line.getBoundingClientRect(), s = scroller.getBoundingClientRect();
  return { lastCol, line: [l.left, l.right], last: [last.left, last.right], seen: [s.left, s.right], scrollLeft: scroller.scrollLeft, max: scroller.scrollWidth - scroller.clientWidth };
});
for (const [width, height] of [[390, 844], [430, 932]]) {
  test(`${width}: the grid scrolled to its right end — the now line still crosses the last column`, { skip }, async () => {
    const { ctx, page } = await openApp({ width, height });
    try {
      await page.evaluate(() => {
        const s = document.querySelector('#wall-root .now-line').closest('.times-scroll');
        s.scrollLeft = s.scrollWidth;
      });
      await sleep(250);
      const r = await lineVsColumns(page);
      assert.ok(r.max > 0 && Math.abs(r.scrollLeft - r.max) < 2, `the grid really is at its right end: ${JSON.stringify(r)}`);
      assert.ok(r.line[0] <= r.last[0] + 1 && r.line[1] >= r.last[1] - 1, `the line crosses the last column (${r.lastCol}): ${JSON.stringify(r)}`);
      assert.ok(r.line[0] <= r.seen[0] + 1 && r.line[1] >= r.seen[1] - 1, `and runs the whole visible width: ${JSON.stringify(r)}`);
    } finally { await ctx.close(); }
  });
}

test('390: Kat highlighted — NOW scrolls to her pick in the third column, and the line crosses it there', { skip }, async () => {
  const { ctx, page, door } = await openApp();
  try {
    await highlight(page, 'Kat');
    await tapNow(page, door);
    const v = await view(page, 'Prospa', 'cell');
    assert.ok(v.card && v.card.cell, 'Prospa, on the grid');
    assert.ok(v.card.left >= 0 && v.card.right <= v.innerWidth, `the grid scrolled her column on screen: ${JSON.stringify(v)}`);
    assert.ok(v.card.top <= v.line.top && v.card.bottom >= v.line.top, 'the card crosses the line — it is playing now');
    assert.ok(v.line.left <= v.card.left + 1 && v.line.right >= v.card.right - 1, `and the line runs right across it: ${JSON.stringify(v)}`);
  } finally { await ctx.close(); }
});

// Honest with a highlight (review, 2026-09-24): Kat's only pick (Prospa) is
// long over at 11:45 PM. NOW lands where it would for nobody — the first
// NOW card — pulses nothing, and says so in one quiet line on the app's
// toast. The same for you: "Nothing of yours".
for (const [who, says] of [['Kat', 'Nothing of Kat’s is on right now — here’s what is.'], ['Kevin', 'Nothing of yours is on right now — here’s what is.']]) {
  test(`${who} highlighted, nothing of theirs on (Sat 11:45 PM): no pulse, the quiet line, the landing anyone would get`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ now: new Date('2026-09-26T23:45:00-07:00') });
    try {
      await highlight(page, who);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(150);
      await page.locator(`#${door}-now`).click();
      await sleep(150);
      await settled(page);
      await sleep(900); // past the 750 ms pulse fallback
      const r = await page.evaluate(() => {
        const first = document.querySelector('#wall-root .venue-grid[data-iso] .card.now, #wall-root .time-list[data-iso] .card.now');
        const b = first.getBoundingClientRect();
        return {
          toast: (document.querySelector('#toast-root') || {}).textContent || '',
          pulsing: [...document.querySelectorAll('#wall-root .card')].filter((c) => window.__pulsing(c)).map((c) => c.dataset.artist),
          first: first.dataset.artist, top: b.top, bottom: b.bottom, dockTop: document.getElementById('dock').getBoundingClientRect().top,
        };
      });
      assert.equal(r.toast.trim(), says);
      assert.deepEqual(r.pulsing, [], 'nothing pulses — no stranger’s card passes for theirs');
      assert.ok(r.top >= 0 && r.bottom <= r.dockTop, `it lands on what IS on, the first NOW card (${r.first}): ${JSON.stringify(r)}`);
    } finally { await ctx.close(); }
  });
}

// The wall can replace the landing card mid-glide (a poll repaint, a pick).
// The pulse used to return early on the detached node — before it removed its
// scrollend listener, which then lived on the window for the life of the page
// with the old card in its closure (review, 2026-09-24). Now it cleans up
// first and pulses whatever node stands there when the glide lands.
test('390: the card is replaced mid-glide — the fresh one pulses, and no scrollend listener is left behind', { skip }, async () => {
  const { ctx, page, door } = await openApp();
  try {
    await highlight(page, 'Ross');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(150);
    const cdp = await ctx.newCDPSession(page);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
    const scrollends = async () => (await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId }))
      .listeners.filter((l) => l.type === 'scrollend').length;
    const before = await scrollends();
    await page.locator(`#${door}-now`).click();
    const swapped = await page.evaluate(() => {
      const old = [...document.querySelectorAll('#wall-root .room[data-room="Afters"] .card')].find((c) => c.dataset.artist === 'Milli Meng');
      const fresh = old.cloneNode(true);
      fresh.id = 'swapped-in';
      old.replaceWith(fresh);
      return !old.isConnected && document.getElementById('swapped-in').isConnected;
    });
    assert.ok(swapped, 'the landing card was replaced while the page glided');
    await sleep(150);
    await settled(page);
    const pulsing = await page.evaluate(() => window.__pulsing(document.getElementById('swapped-in')));
    assert.ok(pulsing, 'the node that stands there when the glide lands is the one that pulses');
    await sleep(900);
    assert.equal(await scrollends(), before, 'no scrollend listener outlives the landing');
  } finally { await ctx.close(); }
});

// A tall pick on a small phone (review, 2026-09-24): at 9:15 PM Ross is at
// Despacio, a set hours long. Its top and the line cannot both fit a 320x568
// band, and the old landing pinned the line to the bottom of the band — just
// above the dock — with the card's top still off screen. The line keeps its
// third of the way down (the rule everywhere else: the strip names the
// stage), and the pulse on a card that tall is scaled down to a few pixels.
test('320x568, Ross at Despacio (a tall set): the line stays a third of the way down, and the pulse is small', { skip }, async () => {
  const { ctx, page, door } = await openApp({ width: 320, height: 568, now: new Date('2026-09-26T21:15:00-07:00') });
  try {
    await highlight(page, 'Ross');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(150);
    await tapNow(page, door);
    const v = await view(page, 'Despacio', 'cell');
    assert.ok(v.card && v.card.cell, 'Despacio, on the grid');
    const band = v.dockTop - v.stripBottom;
    assert.ok(v.card.top < v.stripBottom, `a card taller than the band can show with its line: ${JSON.stringify(v)}`);
    const at = (v.line.top - v.stripBottom) / band;
    assert.ok(at > 0.2 && at < 0.45, `the line a third of the way down (${at.toFixed(2)}), not pinned above the dock: ${JSON.stringify(v)}`);
    assert.ok(v.card.bottom >= v.line.top && v.card.top <= v.line.top, 'and the card crosses it');
    const grow = await page.evaluate(() => {
      const c = [...document.querySelectorAll('#wall-root .card.cell')].find((x) => x.dataset.artist === 'Despacio');
      const a = c.getAnimations().find((x) => x.effect && x.effect.getKeyframes().some((k) => /scale\(/.test(k.transform || '')));
      const h = c.getBoundingClientRect().height;
      return a ? { scale: Math.max(...a.effect.getKeyframes().map((k) => parseFloat((/scale\(([\d.]+)\)/.exec(k.transform || '') || [0, 1])[1]))), h } : null;
    });
    assert.ok(grow, 'it pulses');
    assert.ok((grow.scale - 1) * grow.h <= 13, `a few pixels of growth on a ${Math.round(grow.h)}px card, not ${Math.round((grow.scale - 1) * grow.h)}px`);
  } finally { await ctx.close(); }
});

// ---- tap after tap (Kevin, 2026-09-24) -------------------------------------------
// "multiple taps on that scroll should move the user to the next now item if
// there are multiple at different heights on the page. if filtered to a person
// it should only go to nows for that person … by height because if items are
// side by side multiple now clicks won't scroll that that'll be weird."
// One tap: where the page came to rest, what pulsed (and whether each pulsed
// card is live, in view, and whose), where the line is, what the toast says.
// Where the page stands, down and across (every grid's sideways scroll).
const place = (page) => page.evaluate(() => `${Math.round(scrollY)}|${[...document.querySelectorAll('#wall-root .times-scroll, #wall-root .stack-scroll')].map((s) => Math.round(s.scrollLeft)).join(',')}`);
// `pulse`: 'maybe' polls for a pulse and returns as soon as one starts (a
// line's stop has none, so it waits the whole 1.5 s); 'none' holds a fixed
// window, for the checks that nothing pulses. Every wait is polled from here
// in real time — the page's own timers run on the pinned clock.
const tapAndLook = async (page, door, { pulse = 'maybe' } = {}) => {
  await page.evaluate(() => { window.__pulses = []; });
  const from = await place(page);
  await page.locator(`#${door}-now`).click();
  // The move starts (down or across) — or, for a tap with nowhere to go, the
  // deadline passes.
  for (let t = 0; t < 15 && (await place(page)) === from; t++) await sleep(100);
  await settled(page);
  if (pulse === 'none') await sleep(900);
  else for (let t = 0; t < 15 && !(await page.evaluate(() => window.__pulses.length)); t++) await sleep(100);
  return page.evaluate(() => {
    const dock = document.getElementById('dock');
    const bottom = dock && getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect().top : innerHeight;
    const line = document.querySelector('#wall-root .now-line');
    const lr = line && line.getBoundingClientRect();
    // A show is its artist and its occurrence: one show billed to two rooms
    // is one show (two cards, one data-occ).
    const show = (c) => `${c.dataset.artist}|${c.dataset.occ || ''}`;
    const pulsed = [...new Set(window.__pulses)].map((c) => {
      const r = c.getBoundingClientRect();
      return { artist: c.dataset.artist, show: show(c), top: Math.round(r.top), now: c.classList.contains('now') || c.classList.contains('cell'), inView: r.top >= 0 && r.top < bottom, across: r.left >= -1 && r.right <= innerWidth + 1, dim: c.classList.contains('dim') };
    });
    // Every live stack card a person can actually see right now, pulsed or
    // not: hit-tested near its top and a little further down, so a card under
    // the dock, the sticky chrome or off the side counts as not seen.
    const visible = (c) => {
      const r = c.getBoundingClientRect();
      const x = Math.min(innerWidth - 2, Math.max(1, r.left + r.width / 2));
      return [r.top + 4, r.top + Math.min(r.height - 4, 40)].every((y) => {
        if (y < 0 || y >= innerHeight) return false;
        const hit = document.elementFromPoint(x, y);
        return !!hit && c.contains(hit);
      });
    };
    const seen = [...document.querySelectorAll('#wall-root .venue-grid[data-iso] .card.now, #wall-root .time-list[data-iso] .card.now')].filter(visible).map(show);
    const sc = line && line.closest('.times-scroll');
    return { y: Math.round(scrollY), sl: sc ? Math.round(sc.scrollLeft) : null, pulsed, seen, line: lr ? Math.round(lr.top) : null, lineInView: !!lr && lr.top > 0 && lr.top < bottom, toast: ((document.getElementById('toast-root') || {}).textContent || '').trim() };
  });
};
// Tap until the page comes back to where the first tap put it (the wrap).
const cycle = async (page, door, max = 7) => {
  const taps = [await tapAndLook(page, door)];
  while (taps.length < max) {
    const t = await tapAndLook(page, door);
    taps.push(t);
    if (Math.abs(t.y - taps[0].y) <= 2 && (t.sl == null || Math.abs(t.sl - taps[0].sl) <= 2)) break;
  }
  return taps;
};
const stopsOf = (taps) => taps.slice(0, -1);

for (const [width, height, touch, engine, name] of [[390, 844, true, browser, ''], [430, 932, true, browser, ''], [1280, 800, false, browser, ''], [390, 844, true, webkit, 'WebKit ']]) {
  const skip = engine === webkit ? skipWebkit : browser ? false : NO_BROWSER;
  test(`${name}${width}, nobody highlighted: NOW taps go down the page stop by stop — the line, then the afters — and wrap to the top`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width, height, touch, engine });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(200);
      const taps = await cycle(page, door);
      const stops = stopsOf(taps);
      assert.ok(Math.abs(taps[taps.length - 1].y - taps[0].y) <= 2, `it wraps back to the first stop: ${taps.map((t) => t.y).join(' → ')}`);
      assert.ok(stops.length >= 2, `more than one stop at 10:30 PM: ${taps.map((t) => t.y).join(' → ')}`);
      assert.ok(taps[0].lineInView && !taps[0].pulsed.length, 'the first tap is the line, as ever — and a line does not pulse');
      for (let i = 1; i < stops.length; i++) {
        assert.ok(stops[i].y > stops[i - 1].y + 100, `each tap goes further down: ${taps.map((t) => t.y).join(' → ')}`);
        assert.ok(stops[i].pulsed.length, `stop ${i + 1} pulses what it landed on`);
        for (const c of stops[i].pulsed) assert.ok(c.now && c.inView, `${c.artist}: live, and in view: ${JSON.stringify(stops[i])}`);
      }
      // Side by side is one stop: every pair of live cards at one height on
      // the page lands together, in one tap (pulsed there, or seen there
      // without a pulse). Read off the page rather than assumed: on a phone
      // the afters rows always hold such a pair; at 1280 whether one exists
      // is the night's own shape (v94: Folsom reads by time, so Magnitude and
      // PERVERT XXL are two bands, one above the other, not two stacks side
      // by side).
      const livePos = await page.evaluate(() => [...document.querySelectorAll('#wall-root .venue-grid[data-iso] .card.now, #wall-root .time-list[data-iso] .card.now')]
        .map((c) => ({ show: `${c.dataset.artist}|${c.dataset.occ || ''}`, top: Math.round(c.getBoundingClientRect().top + scrollY) })));
      const pairs = livePos.flatMap((a, i) => livePos.slice(i + 1).filter((b) => b.show !== a.show && Math.abs(a.top - b.top) <= 1).map((b) => [a.show, b.show]));
      if (width < 720) assert.ok(pairs.length, 'a phone has live cards side by side at 10:30 PM');
      const at = (st, show) => st.pulsed.some((c) => c.show === show) || st.seen.includes(show);
      for (const [a, b] of pairs) assert.ok(stops.some((st) => at(st, a) && at(st, b)), `side by side, one tap: ${a} / ${b}`);
      // Every live show is brought into view by some tap — pulsed at its own
      // stop, or seen without a pulse where a stop (the line's, say) already
      // shows it — exactly the live ones, and none pulses twice. (The first cut
      // only checked that no more cards pulsed than were live, which passes
      // with a show never reached at all — Codex, 2026-09-24.)
      const live = await page.evaluate(() => [...new Set([...document.querySelectorAll('#wall-root .venue-grid[data-iso] .card.now, #wall-root .time-list[data-iso] .card.now')]
        .map((c) => `${c.dataset.artist}|${c.dataset.occ || ''}`))].sort());
      assert.ok(live.length >= 4, `the afters are on at 10:30 PM: ${live.length} live shows`);
      const seen = [...new Set(stops.flatMap((st) => st.seen))].sort();
      assert.ok(stops.every((st) => st.seen.length < live.length), `no one landing shows them all — the taps are what reach them: ${stops.map((st) => st.seen.length).join(', ')} of ${live.length}`);
      assert.deepEqual(seen, live, `every live show is seen at some stop: ${JSON.stringify(stops.map((st) => st.seen))}`);
      for (const st of stops) for (const c of st.pulsed) assert.ok(st.seen.includes(c.show), `${c.artist} pulses where it can be seen: ${JSON.stringify(st)}`);
      const pulsedShows = stops.flatMap((st) => st.pulsed.map((c) => c.show));
      assert.equal(new Set(pulsedShows).size, pulsedShows.length, `no show is a stop twice: ${JSON.stringify(pulsedShows)}`);
    } finally { await ctx.close(); }
  });
}

test('390, Nhu highlighted: the stops are her live picks only — Soulwax, then Prospa beside it, then Galen, then back', { skip }, async () => {
  const { ctx, page, door } = await openApp();
  try {
    await highlight(page, 'Nhu');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const taps = await cycle(page, door);
    const names = stopsOf(taps).map((t) => t.pulsed.map((c) => c.artist).sort());
    // Two columns side by side are wider than a 390 phone's grid (2 x 176px
    // in a 322px window): the must first, then the grid slides to Prospa at
    // the same height, then down to the afters.
    assert.deepEqual(names, [['Soulwax'], ['Prospa'], ['Galen']], `her picks, the must first, across then down: ${JSON.stringify(names)}`);
    assert.ok(taps[0].lineInView && taps[1].lineInView, 'the grid stops bring the line with them');
    assert.equal(taps[1].y, taps[0].y, 'Prospa is at the same height — the tap moves the grid across');
    assert.notEqual(taps[1].sl, taps[0].sl, 'and it does move');
    for (const t of taps) for (const c of t.pulsed) assert.ok(!c.dim && c.across, `${c.artist} is hers, and on screen across: ${JSON.stringify(c)}`);
  } finally { await ctx.close(); }
});

// The review's finding (2026-09-24): with a highlight, every live grid pick
// folded into one stop by height alone, so on a phone a pick three columns
// over was never slid into view — taps 2 and 3 stayed put and pulsed the one
// already showing. Sat 7:00 PM, Dee: DJ Shadow (Crane Stage) and Despacio
// (the last column), both on.
test('390, Dee highlighted at 7 PM: two live picks three columns apart are two stops — each tap slides the grid to the next', { skip }, async () => {
  const { ctx, page, door } = await openApp({ now: new Date('2026-09-26T19:00:00-07:00') });
  try {
    await highlight(page, 'Dee');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const taps = await cycle(page, door);
    const stops = stopsOf(taps);
    assert.deepEqual(stops.map((t) => t.pulsed.map((c) => c.artist)), [['Despacio'], ['DJ Shadow']], `the must first, then the other column: ${JSON.stringify(taps)}`);
    // One height, to the pixel the browser rounds a fractional landing to:
    // the full Folsom Friday above (v94) moved this grid by a fraction.
    assert.ok(Math.abs(stops[1].y - stops[0].y) <= 1, `one height: ${stops[1].y} vs ${stops[0].y}`);
    assert.ok(Math.abs(stops[1].sl - stops[0].sl) > 100, `the grid slid across: ${stops.map((t) => t.sl).join(' → ')}`);
    for (const t of stops) for (const c of t.pulsed) assert.ok(c.across && c.inView, `${c.artist} is on screen, down and across: ${JSON.stringify(c)}`);
    assert.ok(Math.abs(taps[taps.length - 1].sl - taps[0].sl) <= 2, 'and the third tap comes back to the first');
  } finally { await ctx.close(); }
});

test('390: a hand scroll between taps makes the next tap a fresh "take me to now", not "next"', { skip }, async () => {
  const { ctx, page, door } = await openApp();
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const first = await tapAndLook(page, door);
    const second = await tapAndLook(page, door);
    assert.ok(second.y > first.y + 100, 'the second tap went on down');
    await page.mouse.wheel(0, 400); // the hand moves the page
    await page.evaluate(() => window.scrollBy(0, 400));
    await sleep(400);
    const fresh = await tapAndLook(page, door);
    assert.ok(Math.abs(fresh.y - first.y) <= 2, `back to the best answer, the line: ${first.y} / ${second.y} / ${fresh.y}`);
    assert.ok(fresh.lineInView);
  } finally { await ctx.close(); }
});

test('390, Kat highlighted with nothing on: the stops are everyone’s, nothing pulses, and the quiet line shows once', { skip }, async () => {
  const { ctx, page, door } = await openApp({ now: new Date('2026-09-26T23:45:00-07:00') });
  try {
    await highlight(page, 'Kat');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const first = await tapAndLook(page, door, { pulse: 'none' });
    assert.equal(first.toast, 'Nothing of Kat’s is on right now — here’s what is.');
    await page.evaluate(() => { document.getElementById('toast-root').textContent = ''; });
    const second = await tapAndLook(page, door, { pulse: 'none' });
    assert.ok(second.y > first.y + 100, `tap two goes on down through what IS on: ${first.y} → ${second.y}`);
    assert.equal(second.toast, '', 'the line is said once, not on every tap');
    assert.deepEqual([...first.pulsed, ...second.pulsed], [], 'and no stranger’s card pulses, ever');
  } finally { await ctx.close(); }
});

// The phone walk (2026-09-24): Sat 7:00 PM, nobody highlighted, the afters not
// yet open — the now line is the only stop. Tap 1 landed it; tap 2 neither
// moved (3072 → 3072) nor pulsed, because a line never pulsed: a dead button,
// on every daytime grid. A tap that moves nothing now pulses the line and its
// time label on the rail — and under Reduce Motion, nothing moves at all.
test('390, Sat 7 PM, the line the only stop: a repeat tap that moves nothing pulses the line and its time label', { skip }, async () => {
  // The festival's clock alone: Folsom folds, since Saturday's daytime
  // parties (DREAM HOUSE to 8 PM at The Stud, Daddy Day Care at SF Eagle —
  // v94's full Folsom) are really on at 7 PM and would be a second stop.
  const { ctx, page, door } = await openApp({ now: new Date('2026-09-26T19:00:00-07:00'), fold: ['Folsom'] });
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const first = await tapAndLook(page, door);
    assert.ok(first.lineInView, 'tap 1 lands the line');
    await page.evaluate(() => { window.__linePulses = []; });
    const second = await tapAndLook(page, door);
    assert.equal(second.y, first.y, 'tap 2 has nowhere to go: the page stays');
    assert.equal(second.pulsed.length, 0, 'no card pulses — nothing is anyone’s');
    const lines = await page.evaluate(() => window.__linePulses);
    assert.ok(lines.includes('now-line') && lines.includes('now-label'), `but the line and its time label do: ${JSON.stringify(lines)}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { window.__linePulses = []; });
    await tapAndLook(page, door, { pulse: 'none' });
    assert.deepEqual(await page.evaluate(() => window.__linePulses), [], 'Reduce Motion: no pulse at all');
  } finally { await ctx.close(); }
});

// Codex (2026-09-24): a one-stop cycle parked at a stale time. 320x568, the
// festival's room only: a tap at 3 PM, a tap at 7 PM with the page untouched.
// The page was still where NOW left it, so the repeat tap kept the old landing
// while the line had walked four hours down the grid, under the dock. The
// repeat tap stays only while its landing still shows the stop.
test('320x568, the festival’s room only: a tap at 3 PM, the clock to 7 PM, a tap — the line comes back into view', { skip }, async () => {
  // The festival's room only: Folsom folds too, since Big Muscle (Sat 1-7 PM,
  // added 2026-09-25) is a live Folsom card at 3 PM.
  const { ctx, page, door } = await openApp({ width: 320, height: 568, now: new Date('2026-09-26T15:00:00-07:00'), fold: ['Afters', 'Folsom'] });
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const first = await tapAndLook(page, door);
    assert.ok(first.lineInView, `3 PM: the line in view (${first.line})`);
    await page.clock.setFixedTime(new Date('2026-09-26T19:00:00-07:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // the app's ticker, now
    await sleep(300);
    const moved = await view(page, null);
    assert.equal(Math.round(await page.evaluate(() => scrollY)), first.y, 'nobody touched the page');
    assert.ok(moved.line.top > moved.dockTop, `the clock walked the line under the dock: ${JSON.stringify(moved)}`);
    const second = await tapAndLook(page, door);
    const v = await view(page, null);
    assert.ok(second.y > first.y + 100, `the tap moved the page down to it: ${first.y} → ${second.y}`);
    assert.ok(v.line.top > v.stripBottom && v.line.top < v.dockTop, `7 PM: the line back in view, under the strip and above the dock: ${JSON.stringify(v)}`);
  } finally { await ctx.close(); }
});

// Codex (2026-09-24): a repaint mid-glide that CHANGES the answer. Ross
// highlighted, NOW gliding to Milli Meng — and the poll brings Ross's un-pick
// of it. The repaint dims the fresh card; the pulse found it by name and
// pulsed it anyway, "Ross is here" on a card he had just left. What pulses is
// decided again when the glide lands.
test('390: Ross drops the pick NOW is gliding to — the dimmed card does not pulse', { skip }, async () => {
  const { ctx, page, doc, door } = await openApp();
  try {
    await highlight(page, 'Ross');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(150);
    await page.evaluate(() => { window.__pulses = []; });
    doc.festivals['portola-2026'].selections['Milli Meng'] = { Ross: 0 }; // on the server, not yet here
    // The poll lands as the glide starts: the first scroll event of the glide asks for it.
    await page.evaluate(() => {
      window.__pulled = null;
      addEventListener('scroll', () => {
        import('/js/sync.js').then((s) => s.pollSync()).then(() => {
          const c = [...document.querySelectorAll('#wall-root .room[data-room="Afters"] .card')].find((x) => x.dataset.artist === 'Milli Meng');
          window.__pulled = { y: scrollY, dim: !!c && c.classList.contains('dim'), pulsesSoFar: window.__pulses.length };
        });
      }, { once: true });
    });
    await page.locator(`#${door}-now`).click();
    for (let t = 0; t < 30 && !(await page.evaluate(() => window.__pulled)); t++) await sleep(50);
    await settled(page);
    await sleep(900);
    const r = await page.evaluate(() => ({ pulled: window.__pulled, y: scrollY, pulses: window.__pulses.map((c) => ({ artist: c.dataset.artist, dim: c.classList.contains('dim') })) }));
    assert.ok(r.pulled && r.pulled.dim, `the un-pick arrived and the fresh card is dimmed: ${JSON.stringify(r)}`);
    assert.ok(r.pulled.pulsesSoFar === 0 && Math.abs(r.pulled.y - r.y) > 50, `and it arrived mid-glide, before any pulse: ${JSON.stringify(r)}`);
    assert.ok(!r.pulses.some((p) => p.artist === 'Milli Meng'), `the card Ross left does not pulse: ${JSON.stringify(r.pulses)}`);
    assert.ok(r.pulses.every((p) => !p.dim), `nothing dimmed pulses: ${JSON.stringify(r.pulses)}`);
  } finally { await ctx.close(); }
});

// Codex (2026-09-24): after a repaint, a sideways hand scroll stopped
// restarting the cycle — the cycle held the scroller node, a repaint replaced
// it, and the detached node read as "unchanged" forever. The cycle names the
// grid by its day now. Dee at 7 PM: Despacio (the must, the last column) and
// DJ Shadow (Crane Stage), three columns apart.
test('390, Dee at 7 PM: a repaint keeps the cycle; after one, a sideways hand scroll makes the next tap fresh', { skip }, async () => {
  const { ctx, page, doc, door } = await openApp({ now: new Date('2026-09-26T19:00:00-07:00') });
  try {
    await highlight(page, 'Dee');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const grid = () => page.evaluate(() => { const s = document.querySelector('#wall-root .now-line').closest('.times-scroll'); s.dataset.probe = s.dataset.probe || String(Math.random()); return s.dataset.probe; });
    const repaint = async (level) => {
      const before = await grid();
      doc.festivals['portola-2026'].selections.Prospa = { Nhu: 2, Kat: level }; // someone else's pick: nothing of Dee's moves
      await pull(page);
      await sleep(300);
      assert.notEqual(await grid(), before, 'the repaint replaced the grid’s scroller');
    };
    const t1 = await tapAndLook(page, door);
    assert.deepEqual(t1.pulsed.map((c) => c.artist), ['Despacio'], 'the must first');
    await repaint(4);
    assert.equal(Math.round(await page.evaluate(() => document.querySelector('#wall-root .now-line').closest('.times-scroll').scrollLeft)), t1.sl, 'the repaint put the grid back where NOW slid it');
    const t2 = await tapAndLook(page, door);
    assert.deepEqual(t2.pulsed.map((c) => c.artist), ['DJ Shadow'], 'a page nobody moved keeps its cycle through a repaint: on to the next stop');
    const t3 = await tapAndLook(page, door);
    assert.deepEqual(t3.pulsed.map((c) => c.artist), ['Despacio'], 'and wraps');
    await repaint(3);
    // The hand swipes the new grid back toward DJ Shadow's column — on the
    // grid itself, just under the line (the pinned stage strip above it is a
    // follower that never scrolls).
    const box = await page.evaluate(() => {
      const line = document.querySelector('#wall-root .now-line');
      const r = line.closest('.times-scroll').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: line.getBoundingClientRect().top + 12 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.wheel(-(t3.sl - t2.sl), 0);
    await settled(page);
    const swiped = Math.round(await page.evaluate(() => document.querySelector('#wall-root .now-line').closest('.times-scroll').scrollLeft));
    assert.ok(Math.abs(swiped - t3.sl) > 100, `the hand moved the grid: ${t3.sl} → ${swiped}`);
    const t4 = await tapAndLook(page, door);
    assert.deepEqual(t4.pulsed.map((c) => c.artist), ['Despacio'], `a fresh "take me to now": the best answer again, not the next stop (${JSON.stringify(t4)})`);
    assert.ok(Math.abs(t4.sl - t1.sl) <= 2, `the grid slid back to it: ${t4.sl} (first ${t1.sl})`);
  } finally { await ctx.close(); }
});

// Codex (2026-09-24): NOW announced nothing — the page moved under a screen
// reader in silence. A polite status region, there from the first paint and
// visually hidden, says where each tap landed (the quiet line first, when
// there is one); focus stays on NOW, and the visible toast is unchanged.
// Every text the region is given, in order (a live region speaks on change).
const listen = (page) => page.evaluate(() => {
  window.__said = [];
  const region = document.getElementById('now-status');
  new MutationObserver(() => { if (region.textContent) window.__said.push(region.textContent); })
    .observe(region, { childList: true, characterData: true, subtree: true });
});
const saidAfter = async (page, n) => {
  for (let t = 0; t < 30 && (await page.evaluate(() => window.__said.length)) < n; t++) await sleep(50);
  return page.evaluate(() => window.__said);
};
test('390: NOW says where it landed in a polite status region — the quiet line first; focus stays on NOW', { skip }, async () => {
  const { ctx, page, door } = await openApp({ now: new Date('2026-09-26T23:45:00-07:00') });
  try {
    const region = await page.evaluate(() => {
      const el = document.getElementById('now-status');
      const r = el && el.getBoundingClientRect();
      return el && { role: el.getAttribute('role'), live: el.getAttribute('aria-live'), atomic: el.getAttribute('aria-atomic'), w: r.width, h: r.height, text: el.textContent };
    });
    assert.deepEqual(region && { role: region.role, live: region.live, atomic: region.atomic, text: region.text }, { role: 'status', live: 'polite', atomic: 'true', text: '' }, 'there from the first paint, polite, empty');
    assert.ok(region.w <= 1 && region.h <= 1, `and visually hidden: ${JSON.stringify(region)}`);
    await highlight(page, 'Kat');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    await listen(page);
    const first = await tapAndLook(page, door, { pulse: 'none' });
    const [said1] = await saidAfter(page, 1);
    assert.ok(said1 && said1.startsWith(`${first.toast} Playing now: `), `the quiet line, then what is on: ${JSON.stringify(said1)} (toast ${JSON.stringify(first.toast)})`);
    assert.match(said1, / 1 of \d+\.$/, 'and which stop');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), `${door}-now`, 'focus stays on NOW');
    await tapAndLook(page, door, { pulse: 'none' });
    const said2 = (await saidAfter(page, 2))[1];
    assert.ok(said2 && said2.startsWith('Playing now: ') && / 2 of \d+\.$/.test(said2), `tap two: the next stop, the quiet line not again: ${JSON.stringify(said2)}`);
  } finally { await ctx.close(); }
});

test('390, Sat 7 PM, one stop: a repeat tap is said again, not swallowed as unchanged text', { skip }, async () => {
  // One stop needs the festival's clock alone: Folsom's daytime parties are
  // on at 7 PM (v94's full Folsom), so it folds.
  const { ctx, page, door } = await openApp({ now: new Date('2026-09-26T19:00:00-07:00'), fold: ['Folsom'] });
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    await listen(page);
    await tapAndLook(page, door);
    await tapAndLook(page, door);
    const said = await saidAfter(page, 2);
    assert.equal(said.length, 2, `said twice: ${JSON.stringify(said)}`);
    assert.equal(said[0], said[1], 'the same words — the region was emptied between, so it speaks again');
    assert.match(said[0], /^Now, 7:00 PM\. Playing now: .+\.$/, said[0]);
  } finally { await ctx.close(); }
});

test('Reduce Motion: NOW lands at once and nothing pulses; the live dot is still', { skip }, async () => {
  const { ctx, page, door } = await openApp();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await highlight(page, 'Ross');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(100);
    await page.locator(`#${door}-now`).click();
    await sleep(60);
    const r = await page.evaluate((d) => {
      const c = [...document.querySelectorAll('#wall-root .room[data-room="Afters"] .card')].find((x) => x.dataset.artist === 'Milli Meng');
      const b = c.getBoundingClientRect();
      const dot = getComputedStyle(document.querySelector(`#${d}-now .live`));
      return { y: scrollY, top: b.top, bottom: b.bottom, dockTop: document.getElementById('dock').getBoundingClientRect().top,
        pulsing: window.__pulsing(c), dotAnimation: dot.animationName };
    }, door);
    assert.ok(r.y > 0 && r.top >= 0 && r.bottom <= r.dockTop, `landed already, no glide: ${JSON.stringify(r)}`);
    assert.equal(r.pulsing, false, 'no pulse');
    assert.equal(r.dotAnimation, 'none', 'the dot does not breathe');
  } finally { await ctx.close(); }
});

// The squeeze is NOW's to undo: when the last set ends and NOW leaves, the
// days give back the room they claimed and the fest name is whole again.
test('ACL at 305: NOW squeezes the fest name while live, and gives the room back when it leaves', { skip }, async () => {
  const { ctx, page } = await openApp({ fest: 'acl-2026', width: 305, height: 640, now: new Date('2026-10-03T20:00:00-05:00') });
  // Poll (from here, in real time) until the state reads as asserted, or 5 s.
  const until = async (read, ok) => { let v = await read(); for (let t = 0; t < 50 && !ok(v); t++) { await sleep(100); v = await read(); } return v; };
  try {
    const state = () => page.evaluate(() => {
      const f = document.getElementById('dock-fest-name');
      return {
        now: !document.getElementById('dock-now').hidden, squeezed: document.getElementById('dock').classList.contains('squeezed'),
        minWidth: document.getElementById('dock-days').style.minWidth, cut: f.scrollWidth > f.clientWidth + 1,
      };
    });
    const live = await until(state, (v) => v.now && v.squeezed && v.cut);
    assert.ok(live.now && live.squeezed && live.cut, `live: squeezed, the name cut: ${JSON.stringify(live)}`);
    // Next morning, nothing on; the app re-reads the clock when the page is
    // shown again (the minute ticker's other door).
    await page.clock.setFixedTime(new Date('2026-10-04T09:00:00-05:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const after = await until(state, (v) => !v.now && !v.squeezed); // NOW's quick exit
    assert.deepEqual(after, { now: false, squeezed: false, minWidth: '', cut: false }, 'NOW gone, the room given back, the name whole');
  } finally { await ctx.close(); }
});

test('outside the live window there is no NOW (Saturday 9 AM)', { skip }, async () => {
  const { ctx, page, door } = await openApp({ now: SAT_9AM });
  try {
    const shown = await page.evaluate((d) => { const n = document.getElementById(`${d}-now`); return !n.hidden && n.getBoundingClientRect().width > 0; }, door);
    assert.equal(shown, false);
  } finally { await ctx.close(); }
});

// Past the festival clock's 5 AM rollover a night is not over (Sol's review of
// v94, 2026-09-26): Saturday's after-hours run to their own printed ends —
// PERVERT XXL to 6 AM, Aftershock to 10 AM Sunday. At 5:30 AM Sunday NOW is
// there, and a real tap lands on and pulses them, under Saturday. Before the
// fix their rings went out at 5:00 on the dot and NOW left with them.
test('390, Sunday 5:30 AM: Saturday\'s after-hours are still on — NOW is there and a tap lands on them, under Saturday', { skip }, async () => {
  const { ctx, page, door } = await openApp({ now: new Date('2026-09-27T05:30:00-07:00') });
  try {
    const shown = await page.evaluate((d) => { const n = document.getElementById(`${d}-now`); return !n.hidden && n.getBoundingClientRect().width > 0; }, door);
    assert.equal(shown, true, 'NOW is there: parties are open');
    const rings = await page.evaluate(() => [...document.querySelectorAll('#wall-root .card.now')].map((c) => `${c.dataset.artist}@${c.closest('.day-block').dataset.day}`));
    assert.deepEqual(rings.sort(), ['Aftershock@Saturday', 'PERVERT XXL@Saturday'], `exactly the two running past 5 AM: ${rings}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const t = await tapAndLook(page, door);
    assert.ok(t.pulsed.length > 0, `the tap lands on them and pulses: ${JSON.stringify(t)}`);
    for (const c of t.pulsed) assert.ok(c.now && c.inView && ['Aftershock', 'PERVERT XXL'].includes(c.artist), `${c.artist}: live and in view`);
  } finally { await ctx.close(); }
});

test('320: NOW fits the dock beside the days and the fest name, nothing overlapping', { skip }, async () => {
  const { ctx, page } = await openApp({ width: 320, height: 640 });
  try {
    const r = await page.evaluate(() => {
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const now = box('dock-now'), days = box('dock-days'), fest = box('dock-fest-link'), you = box('dock-you');
      return { now: [now.left, now.right], days: [days.left, days.right], fest: [fest.left, fest.right], you: [you.left, you.right], width: innerWidth };
    });
    assert.ok(r.you[1] <= r.now[0] && r.now[1] <= r.days[0] && r.days[1] <= r.fest[0], `in a row, no overlap: ${JSON.stringify(r)}`);
    assert.ok(r.fest[1] <= r.width, 'nothing off the right edge');
  } finally { await ctx.close(); }
});

// The dock's days keep the day you are in AND a glimpse of the days either
// side — the glimpse is what says the row scrolls. They already scroll on a
// phone (Portola's four overflow a 390 dock by a few px), and NOW narrows
// them. A neighbour shows only once the room beside the centred day clears
// the gap between tabs and the edge fade; short of that NOW keeps only its
// dot (review, 2026-09-24: the first cut left one lone day at Portola 320
// and ACL 375). ACL is measured on Saturday Oct 3, a day in the middle of
// its row — the first or last day has all the slack on one side.
const dockFit = (page) => page.evaluate(() => {
  const now = document.getElementById('dock-now');
  const row = document.getElementById('dock-days');
  const on = row.querySelector('.day-tab.active');
  const n = now.getBoundingClientRect(), r = row.getBoundingClientRect(), a = on.getBoundingClientRect();
  return {
    shown: !now.hidden && n.width > 0, compact: now.classList.contains('compact'), label: now.getAttribute('aria-label'),
    dot: !!now.querySelector('.live') && getComputedStyle(now.querySelector('.live')).display !== 'none',
    rowW: Math.round(r.width), active: on.dataset.day, activeWhole: a.left >= r.left - 1 && a.right <= r.right + 1,
    overflowing: row.classList.contains('overflowing'), clear: n.right <= r.left,
    squeezed: document.getElementById('dock').classList.contains('squeezed'),
    festRight: document.getElementById('dock-fest-wrap').getBoundingClientRect().right, innerWidth,
    festCut: (() => { const f = document.getElementById('dock-fest-name'); return f.scrollWidth > f.clientWidth + 1; })(),
    scrollLeft: row.scrollLeft, rowLog: window.__rowLog, at: Math.round(performance.now()),
    // Pixels of the other days inside the row, the fades included.
    others: Math.round([...row.children].filter((t) => t !== on).reduce((sum, t) => {
      const b = t.getBoundingClientRect();
      return sum + Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left));
    }, 0)),
  };
});
const ACL_SAT = new Date('2026-10-03T20:00:00-05:00');
// What NOW does at each width is asserted where the margin is wide; within a
// few px of the threshold (Portola 375, ACL 430) the engine's glyph widths
// decide — Linux draws Inter wider than a Mac — so there the CONTRACT is what
// is checked: NOW keeps its word only with a real glimpse of the other days.
for (const [fest, width, height, now, expect] of [
  ['portola-2026', 430, 932, SAT_1030, 'word'],
  ['portola-2026', 390, 844, SAT_1030, 'word'],
  ['portola-2026', 375, 667, SAT_1030, 'either'],
  ['portola-2026', 320, 640, SAT_1030, 'dot'],
  ['acl-2026', 430, 932, ACL_SAT, 'either'],
  ['acl-2026', 390, 844, ACL_SAT, 'dot'],
  ['acl-2026', 375, 667, ACL_SAT, 'dot'],
  // ACL's long fest name leaves 51px even beside the dot here (Linux draws
  // Inter wider: 36px in CI, narrower than the day's tab): the day you are in
  // stays whole, and there is no room for more. At 305 this engine is where
  // CI is at 320 — the row claims its widest tab and the fest name gives way.
  ['acl-2026', 320, 640, ACL_SAT, 'dot'],
  ['acl-2026', 305, 640, ACL_SAT, 'dot'],
]) for (const wide of [null, '0.7px']) {
  // Each case twice: as this engine draws, and with every dock glyph 0.7px
  // wider — which reproduces CI's Linux rows to the pixel (ACL beside the
  // dot: 146 / 106 / 91 / 36 at 430 / 390 / 375 / 320). With wider glyphs
  // only the contract is asserted: which form NOW takes is the engine's.
  const want = wide ? 'either' : expect;
  const says = { word: 'keeps its word', dot: 'keeps only its dot', either: 'keeps its word only with a real glimpse' }[want];
  test(`${fest} at ${width}${wide ? ', glyphs wider (as Linux draws them)' : ''}: NOW ${says}, and the day you are in stays whole`, { skip }, async () => {
    const { ctx, page } = await openApp({ fest, width, height, now, wide });
    try {
      // The day-of open lands, the scrollspy lights today, the row glides to
      // centre it: wait for today to be lit and the row to rest. (On ACL the
      // dock lights FRI 2 for about a second after the open before it finds
      // SAT 3 — v86 does the same; flagged, not NOW's.)
      // Polled from here, in real time: the page's own timers run on the
      // pinned clock, which let an in-page poll "rest" 26ms into the glide.
      const today = fest === 'acl-2026' ? 'Saturday|W1' : 'Saturday';
      const read = () => page.evaluate(() => {
        const row = document.getElementById('dock-days');
        return `${(row.querySelector('.active') || {}).dataset?.day}|${row.scrollLeft}|${row.clientWidth}`;
      });
      let last = await read(), still = 0;
      for (let i = 0; i < 80 && still < 4; i++) {
        await sleep(100);
        const cur = await read();
        still = cur === last && cur.startsWith(`${today}|`) ? still + 1 : 0;
        last = cur;
      }
      const f = await dockFit(page);
      assert.ok(f.shown, 'something is live');
      if (want !== 'either') assert.equal(f.compact, want === 'dot', JSON.stringify(f));
      assert.ok(f.dot, 'the live dot, either way');
      assert.equal(f.label, 'Jump to what is playing now');
      assert.ok(f.clear, 'NOW never sits over the days');
      assert.ok(f.activeWhole, `the day you are in is whole in the row: ${JSON.stringify(f)}`);
      assert.ok(f.overflowing, 'a row that scrolls says so at its edges (re-read when NOW took its room)');
      if (!f.compact) assert.ok(f.others >= 12, `the word only with a real glimpse of the other days: ${JSON.stringify(f)}`);
      assert.ok(f.festRight <= f.innerWidth + 0.5, `the fest name stays on screen: ${JSON.stringify(f)}`);
      if (f.squeezed) assert.ok(f.festCut, 'squeezed: the fest name is what gives way, with its ellipsis');
      else assert.equal(f.festCut, false, 'otherwise the fest name is whole');
      if (width === 305) assert.ok(f.squeezed, 'at 305 the days need the fest name to give way');
    } finally { await ctx.close(); }
  });
}

// A right-hand afters card on a small phone (review, 2026-09-25). On a phone
// a clocked stack row scrolls sideways by its lead space (v91), and at rest
// its right-hand card runs off the screen by it: at 320, Milli Meng's afters
// card ran to x=344 in a row ending at 306, and NOW landed there with its
// right 38px — the crew corner included — out of sight. NOW now slides the
// row just enough to show the card whole: smoothly, or at once under Reduce
// Motion, like the timetable's own framing; and not at all when it already is.
const AFTERS_ROW = '#wall-root .day-block[data-day="Saturday"] .room[data-room="Afters"] .stack-scroll';
const rowView = (page) => page.evaluate((sel) => {
  const row = document.querySelector(sel);
  const card = [...row.querySelectorAll('.card')].find((c) => c.dataset.artist === 'Milli Meng');
  const r = row.getBoundingClientRect(), c = card.getBoundingClientRect();
  const dock = document.getElementById('dock');
  const dockTop = dock && getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect().top : innerHeight;
  return {
    row: { left: r.left, right: r.right, scrollLeft: row.scrollLeft, max: row.scrollWidth - row.clientWidth },
    card: { left: c.left, right: c.right, top: c.top, bottom: c.bottom }, innerWidth, dockTop,
  };
}, AFTERS_ROW);
// Every sideways scroll the app asks of a stack row, as asked.
const watchRows = (page) => page.evaluate(() => {
  window.__rowScrolls = [];
  if (window.__rowWatch) return;
  window.__rowWatch = true;
  const was = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (...args) {
    if (this.classList && this.classList.contains('stack-scroll')) window.__rowScrolls.push(args[0]);
    return was.apply(this, args);
  };
});
for (const [engine, name] of [[browser, ''], [webkit, 'WebKit ']]) {
  const skip = engine === webkit ? skipWebkit : browser ? false : NO_BROWSER;
  test(`${name}320: Ross highlighted — NOW slides SAT AFTERS just enough that his right-hand card is whole inside its row`, { skip }, async () => {
    const { ctx, page, door } = await openApp({ width: 320, height: 568, engine });
    try {
      await highlight(page, 'Ross');
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(200);
      const rest = await rowView(page);
      assert.equal(rest.row.scrollLeft, 0, 'the row at rest');
      assert.ok(rest.row.max > 30, `the row scrolls by its lead space (${rest.row.max}px)`);
      assert.ok(rest.card.right > rest.row.right + 30, `at rest his card runs off its row: ${JSON.stringify(rest)}`);
      await watchRows(page);
      await tapNow(page, door);
      // Judge the card at rest, not mid-pulse: NOW's pulse scales the card it
      // lands on for ~460 ms, and a scaled card reads ~3px wider on each side.
      // tapNow waits for the scrolling to stop; on a longer wall (the
      // 2026-09-25 Folsom data) the pulse can still be running then.
      await page.waitForFunction((sel) => {
        const c = [...document.querySelector(sel).querySelectorAll('.card')].find((x) => x.dataset.artist === 'Milli Meng');
        return Math.abs(c.getBoundingClientRect().width - c.offsetWidth) < 0.5;
      }, AFTERS_ROW, { timeout: 3000 });
      const v = await rowView(page);
      assert.ok(v.card.left >= v.row.left - 0.5 && v.card.right <= v.row.right + 0.5, `the card is whole inside its row: ${JSON.stringify(v)}`);
      assert.ok(v.card.right <= v.innerWidth, 'and on the screen');
      assert.ok(Math.abs(v.row.scrollLeft - v.row.max) <= 1, `just enough: the far end of the row (${v.row.scrollLeft} of ${v.row.max})`);
      assert.ok(v.card.top >= 0 && v.card.bottom <= v.dockTop, `and in view top to bottom: ${JSON.stringify(v)}`);
      assert.deepEqual(await page.evaluate(() => window.__rowScrolls.map((a) => a.behavior)), ['smooth'], 'one slide, and a glide');
      // Again, already whole: the row is not asked to move.
      await page.mouse.move(4, 4);
      await sleep(900);
      await page.evaluate(() => { window.__rowScrolls = []; });
      await tapNow(page, door);
      assert.deepEqual(await page.evaluate(() => window.__rowScrolls), [], 'a card already whole moves no row');
    } finally { await ctx.close(); }
  });
}

test('320, Reduce Motion: NOW brings the right-hand afters card in at once', { skip }, async () => {
  const { ctx, page, door } = await openApp({ width: 320, height: 568 });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await highlight(page, 'Ross');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    await watchRows(page);
    await page.locator(`#${door}-now`).click();
    await sleep(60);
    const v = await rowView(page);
    assert.deepEqual(await page.evaluate(() => window.__rowScrolls.map((a) => a.behavior)), ['auto'], 'no glide');
    assert.ok(Math.abs(v.row.scrollLeft - v.row.max) <= 1 && v.card.right <= v.row.right + 0.5, `already whole, one frame after the tap: ${JSON.stringify(v)}`);
  } finally { await ctx.close(); }
});
