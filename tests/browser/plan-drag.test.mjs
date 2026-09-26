// Our plan's peek, with real input (2026-09-26 — Kevin's call #5). The peek is
// the day plan's own NOW row seen through a window above the dock; a finger
// drags the window open, a slow release decides by distance, a flick by its
// direction, and the open plan drags back down by its grabber. What jsdom
// cannot see is held here: the row really sits in the window above the dock,
// the wall's end clears the peek, a finger on the peek never reaches the card
// behind it, a drag marks the page busy (a new build never reloads under the
// hand) and gives the mark back, and Reduce Motion settles at once.
// The real app, the made-up nine (tests/fixtures/plan-crew-nine.json), /api
// answered in the page, every write refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NINE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const FID = 'portola-2026';
const SAT_940 = new Date('2026-09-26T21:40:00-07:00'); // Dog Blood on the Pier Stage, 8 picked

async function openPhone(engine, { reduced = false, desk = false, fontDelayMs = 0, guest = false } = {}) {
  const CREW = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, isMobile: !desk && engine === chromium, deviceScaleFactor: 2,
    timezoneId: 'America/Los_Angeles', serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await lateStarts(ctx);
  const doc = {
    v: 4, meta: { name: 'Nine', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(NINE.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: NINE.picks } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  // A slow network's fonts: the peek is measured in the fallback face, and
  // the real one lands after it (the stylesheet itself is not held).
  if (fontDelayMs) await ctx.route('**/assets/fonts/*.woff2', async (r) => { await sleep(fontDelayMs); await r.continue(); });
  await ctx.addInitScript(([t, asGuest]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Nine' }]));
    if (!asGuest) localStorage.setItem(`fn_me_v3_${t}`, 'Gus'); // a guest (no name here) is welcomed first
    localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
  }, [CREW, guest]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(SAT_940);
  // A held font holds Chromium's load event too (fonts requested before it
  // count), so that case waits only for the document.
  await page.goto(`${server.origin}/#g=${CREW}&f=${FID}`, { waitUntil: fontDelayMs ? 'domcontentloaded' : 'load' });
  // A guest's peek waits under the welcome card (one thing at a time).
  await page.waitForSelector(guest ? '#welcome-card' : '#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
  const fontsAtPeek = await page.evaluate(() => document.fonts.status);
  await sleep(900);
  await motionDone(page, { within: guest ? '#welcome-card' : '#plan' }); // the peek (or the card) has arrived
  return { ctx, page, errors, fontsAtPeek };
}

// Measure the window only once it has stopped. A fixed beat after a tap or a
// release is a guess about the machine, and CI's loaded Linux WebKit held
// the settles on their first frame past it: the next grab was aimed at a
// window still on its way, and the panel was read at the corner card's
// place (runs 36266741642 and 36266745098, 2026-09-26). Every settle starts
// in the handler of the input that asked for it, so it is already there to
// wait for when the input returns. And the shelf's quiet time with it: the
// click that follows a tap or a drag within that time is the same hand's,
// and swallowed (plan-shelf.js quietUntil), so the next deliberate click
// waits it out as a person's would.
const settled = (page) => Promise.all([motionDone(page, { within: '#plan' }), sleep(QUIET_MS + 50)]);

const geometry = (page) => page.evaluate(() => {
  const el = document.getElementById('plan');
  const row = el.querySelector('.plan-row.tagged');
  const dock = document.getElementById('dock').getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width * 0.3, r.top + r.height / 2);
  return {
    state: el.dataset.state, planTop: el.getBoundingClientRect().top, dockTop: dock.top,
    rowTop: r.top, rowBottom: r.bottom, hitInRow: !!(hit && row.contains(hit)),
    grabBottom: el.querySelector('.plan-grab').getBoundingClientRect().bottom,
    busy: document.body.dataset.busy || null,
    // The window's own motion (Web Animations), not the nodes' endless aura drift.
    running: el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && !(a instanceof CSSAnimation)).length,
  };
});
// Hold every motion the window starts from here on at a fraction of its
// run (paused there), until unheld: a late frame on a loaded phone, made
// the same on every machine. What a hand does next must start from what is
// on screen.
const holdSettles = (page, at) => page.evaluate((f) => {
  const animate = Element.prototype.animate;
  window.__unholdSettles = () => { Element.prototype.animate = animate; };
  Element.prototype.animate = function held(...args) {
    const a = animate.apply(this, args);
    if (document.getElementById('plan').contains(this)) { a.pause(); a.currentTime = a.effect.getComputedTiming().duration * f; }
    return a;
  };
}, at);
const unholdSettles = (page) => page.evaluate(() => window.__unholdSettles());
const grabAt = (page) => page.evaluate(() => {
  const g = document.querySelector('#plan .plan-grab').getBoundingClientRect();
  const el = document.getElementById('plan');
  return { x: g.left + g.width / 2, y: g.top + g.height / 2, range: el.offsetHeight - Number(el.dataset.peekH) };
});
// A mouse drag: down, a slow walk of `steps`, an optional hold, up. A held
// drag reports where the window got to before the hand lets go; a flick
// (no hold) lets go at once — a page round trip between the last move and
// the release reads as a hand that stopped, which is no flick at all (a
// loaded machine once made that gap longer than the flick's 80ms).
async function drag(page, from, dy, { steps = 12, stepMs = 16, holdMs = 250 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) { await page.mouse.move(from.x, from.y + dy * (k / steps)); if (k < steps || holdMs) await sleep(stepMs); }
  if (holdMs) await sleep(holdMs);
  const mid = holdMs ? await geometry(page) : null;
  await page.mouse.up();
  return mid;
}

// A flick, and a check that the page really received one (2026-09-26). The
// shelf reads a flick from its events' times: the speed over its last moves,
// and none at all if the hand stopped more than STILL_MS before letting go.
// Under page.clock those times are the fake performance.now() at the moment
// each listener ran (Playwright redefines Event.prototype.timeStamp), so
// they are exactly as far apart as the machine made them: with other
// sessions holding the load average at 17, Chromium's release landed past
// 80 ms after the last move and a flick up read as a short slow drag (twice
// in about ten runs). No protocol timestamp can undo that. So the test reads
// back what the page's own listeners saw and asks the shelf's question of
// it; a gesture the machine did not deliver as a flick settles back where it
// began (it is short) and is sent again, up to three times. What is asserted
// is the rule: every gesture the page received as a flick decided by its
// direction.
const SHELF_SRC = readFileSync(path.join(ROOT, 'js/v3/plan-shelf.js'), 'utf8');
const FLING = Number(SHELF_SRC.match(/const FLING = ([\d.]+);/)[1]);
const STILL_MS = Number(SHELF_SRC.match(/const still = e\.timeStamp - b\.t > (\d+);/)[1]);
const QUIET_MS = Number(SHELF_SRC.match(/quietUntil = performance\.now\(\) \+ (\d+);/)[1]);
const asTheShelfSees = (seen) => {
  const down = seen.findIndex((e) => e[0] === 'pointerdown');
  const up = seen.find((e) => e[0] === 'pointerup');
  // From the press on, as the shelf keeps them (the move to the start point
  // before the press is not part of the gesture).
  const samples = seen.slice(Math.max(0, down)).filter((e) => e[0] === 'pointerdown' || e[0] === 'pointermove').slice(-5);
  if (!up || samples.length < 2) return { flick: false, seen };
  const a = samples[0];
  const b = samples[samples.length - 1];
  const v = b[1] > a[1] ? Math.abs(a[2] - b[2]) / (b[1] - a[1]) : 0;
  return { flick: down >= 0 && up[1] - b[1] <= STILL_MS && v > FLING, v, still: up[1] - b[1], seen };
};
async function flick(page, from, dy) {
  let got;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.evaluate(() => {
      window.__flick = [];
      if (window.__flickWired) return;
      window.__flickWired = true;
      for (const t of ['pointerdown', 'pointermove', 'pointerup']) {
        document.addEventListener(t, (e) => { if (window.__flick) window.__flick.push([t, e.timeStamp, e.clientY]); }, true);
      }
    });
    await drag(page, from, dy, { steps: 3, stepMs: 0, holdMs: 0 });
    got = asTheShelfSees(await page.evaluate(() => window.__flick));
    if (got.flick) return got;
    await settled(page); // not a flick as delivered: it goes back where it began
  }
  assert.fail(`the machine never delivered a flick in three tries (last: ${JSON.stringify(got)})`);
}

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name}: the peek is the NOW row in a window on the dock — seen whole, and what a finger touches`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      const g = await geometry(page);
      assert.equal(g.state, 'peek');
      // Half a pixel, not one: a 1px allowance once hid the shelf's hairline border
      // pushing the row's last pixel under the dock (and failed only when float
      // error tipped it past 1.0).
      assert.ok(Math.abs(g.rowBottom - g.dockTop) <= 0.5, `the row ends at the dock's top edge: ${JSON.stringify(g)}`);
      assert.ok(g.rowTop >= g.grabBottom - 0.5, `and starts under the grabber: ${JSON.stringify(g)}`);
      assert.ok(g.hitInRow, 'a finger on the row touches the row (nothing paints over it)');
      assert.equal(await page.locator('#plan .plan-row.tagged').getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 8 picked');
      // NOW sits level with the name and its time on the place's line — the
      // pill had hung below the name and pushed the time down (Kevin,
      // 2026-09-26, "not slid down a bit like they are now").
      const lines = await page.evaluate(() => {
        const row = document.querySelector('#plan .plan-row.tagged');
        const box = (sel) => row.querySelector(sel).getBoundingClientRect();
        const [nm, pl, tag, t] = ['.nm', '.pl', '.plan-tag', '.plan-when .t'].map(box);
        return { tagMid: (tag.top + tag.bottom) / 2, nmMid: (nm.top + nm.bottom) / 2, tTop: t.top, plTop: pl.top, tBottom: t.bottom, plBottom: pl.bottom };
      });
      assert.ok(Math.abs(lines.tagMid - lines.nmMid) <= 1, `NOW is centred on the name's line: ${JSON.stringify(lines)}`);
      assert.ok(Math.abs(lines.tTop - lines.plTop) <= 1 && Math.abs(lines.tBottom - lines.plBottom) <= 1, `the time shares the place's line: ${JSON.stringify(lines)}`);
      // The wall's end clears the peek: scrolled to the bottom, the last room
      // ends above the peek's top.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(300);
      const end = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('#wall-root .card')];
        const last = Math.max(...blocks.map((c) => c.getBoundingClientRect().bottom));
        return { last, peekTop: document.getElementById('plan').getBoundingClientRect().top };
      });
      assert.ok(end.last <= end.peekTop + 0.5, `the last card is not under the peek: ${JSON.stringify(end)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a slow drag past a third opens it, short of a third it goes back, and the page is busy only while the hand is down`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      let from = await grabAt(page);
      const short = await drag(page, from, -from.range * 0.2);
      assert.equal(short.busy, 'plan-drag', 'the hand is down: the page is marked busy');
      await settled(page);
      let g = await geometry(page);
      assert.equal(g.state, 'peek', 'short of a third: back to the peek');
      assert.equal(g.busy, null, 'and the mark is given back');
      from = await grabAt(page);
      const mid = await drag(page, from, -from.range * 0.55);
      assert.ok(mid.planTop < from.y - from.range * 0.4, `mid-drag the window follows the finger: ${JSON.stringify(mid)}`);
      await settled(page);
      g = await geometry(page);
      assert.equal(g.state, 'open', 'past a third: open');
      assert.equal(g.running, 0, 'and settled');
      const head = await page.evaluate(() => {
        const h = document.querySelector('#plan .plan-head').getBoundingClientRect();
        const at = document.elementFromPoint(h.left + 40, h.top + h.height / 2);
        return { inHead: !!(at && document.querySelector('#plan .plan-head').contains(at)), opacity: getComputedStyle(document.querySelector('#plan .plan-head')).opacity };
      });
      assert.deepEqual(head, { inHead: true, opacity: '1' }, 'the head is there, whole');
      // Back down by the grabber, past a third of the way.
      from = await grabAt(page);
      await drag(page, from, from.range * 0.5);
      await settled(page);
      assert.equal((await geometry(page)).state, 'peek');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a flick decides by its direction; a tap on the peek opens it and never reaches the card behind`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      let from = await grabAt(page);
      // Short: 28% of the way, under the third a slow release needs, so only
      // its speed can open it — and long enough to stay fast on a slow machine.
      await flick(page, from, -from.range * 0.28);
      await settled(page);
      assert.equal((await geometry(page)).state, 'open', 'a flick up opens it, short as it was');
      from = await grabAt(page);
      await flick(page, from, from.range * 0.28);
      await settled(page);
      assert.equal((await geometry(page)).state, 'peek', 'a flick down closes it');
      // A tap on the peek's row: the plan opens; the wall behind hears nothing.
      const picksBefore = await page.evaluate(() => document.querySelectorAll('#wall-root .card.picked, #wall-root .card[data-level]:not([data-level="0"])').length);
      const b = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.touchscreen.tap(b.x + b.width * 0.4, b.y + b.height / 2);
      await settled(page);
      assert.equal((await geometry(page)).state, 'open');
      const picksAfter = await page.evaluate(() => document.querySelectorAll('#wall-root .card.picked, #wall-root .card[data-level]:not([data-level="0"])').length);
      assert.equal(picksAfter, picksBefore, 'no pick went through the peek');
      assert.equal(await page.evaluate(() => { const z = document.getElementById('zoom-layer'); return z ? z.childElementCount : 0; }), 0, 'and no zoom');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The grabber's tap is taken where the pointer lifts: the drag captures the
  // pointer, and a captured mouse's click lands on the shelf, not on the
  // grabber — before 2026-09-26 a mouse could neither open nor close the plan
  // by its handle, and only a finger worked (in Chromium).
  test(`${name}: a tap on the grabber, by mouse or by finger, opens it and closes it — once each`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      const tapGrab = async (how) => {
        const g = await grabAt(page);
        if (how === 'finger') await page.touchscreen.tap(g.x, g.y); else await page.mouse.click(g.x, g.y);
        await settled(page);
        return (await geometry(page)).state;
      };
      assert.equal(await tapGrab('mouse'), 'open', 'a mouse click on the grabber opens it');
      assert.equal(await tapGrab('mouse'), 'peek', 'and closes it');
      assert.equal(await tapGrab('finger'), 'open', 'a finger tap opens it');
      assert.equal(await tapGrab('finger'), 'peek', 'and closes it');
      assert.equal((await geometry(page)).busy, null);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Storyboard 8: a row tap grows that row's card and only the rows below make
  // room. Two ways it went wrong first: folding the NOW card above to grow the
  // tapped one, and the window growing with its content — each slid the tapped
  // row up by a card's height under the finger. Now the row stays put while
  // its card fits below it, and moves only as far as needed to show a card the
  // bottom edge would cut off.
  test(`${name}: a row tap grows its card where the finger is — still while it fits, and only as far as needed when it doesn't`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      const b = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.touchscreen.tap(b.x + b.width * 0.4, b.y + b.height / 2);
      await settled(page);
      const rowsBelowNow = () => page.evaluate(() => {
        const g = document.querySelector('#plan .plan-grow').getBoundingClientRect().bottom;
        return [...document.querySelectorAll('#plan .plan-row:not(.tagged):not(.earlier):not(.scattered):not(.or)')]
          .filter((r) => r.getBoundingClientRect().top >= g - 1)
          .map((r) => { const q = r.getBoundingClientRect(); return { key: r.dataset.stop, x: q.left + q.width * 0.4, y: q.top + 14 }; });
      });
      const look = (key) => page.evaluate((k) => {
        const row = document.querySelector(`#plan .plan-row[data-stop="${CSS.escape(k)}"]`);
        const card = document.querySelector(`#plan .plan-grow[data-stop="grow|${CSS.escape(k)}"]`);
        const list = document.querySelector('#plan .plan-list');
        const floor = list.getBoundingClientRect().bottom - parseFloat(getComputedStyle(list).paddingBottom);
        return { top: row.getBoundingClientRect().top, cardBottom: card ? card.getBoundingClientRect().bottom : null, floor,
          grown: [...document.querySelectorAll('#plan .plan-grow')].map((g) => g.dataset.stop) };
      }, key);
      const [near, , far] = await rowsBelowNow();
      // The first row under the NOW card: its card fits below it.
      const n0 = await look(near.key);
      await page.mouse.click(near.x, near.y);
      await settled(page);
      const n1 = await look(near.key);
      assert.ok(Math.abs(n1.top - n0.top) <= 1, `the tapped row did not move: ${JSON.stringify([n0, n1])}`);
      assert.ok(n1.cardBottom <= n1.floor + 1, 'its card is whole on screen');
      assert.deepEqual(n1.grown.sort(), ['grow|Pier Stage|1260', `grow|${near.key}`].sort(), 'and the NOW card above stayed grown');
      await page.mouse.click(near.x, near.y);
      await settled(page);
      const n2 = await look(near.key);
      assert.deepEqual(n2.grown, ['grow|Pier Stage|1260'], 'the same tap folds it');
      assert.ok(Math.abs(n2.top - n0.top) <= 1, `still where it was: ${JSON.stringify([n0, n1, n2])}`);
      // A row low in the window: its card would be cut off, so the row rises —
      // by the card's overflow and no more.
      const f0 = await look(far.key);
      await page.mouse.click(far.x, far.y);
      await settled(page);
      const f1 = await look(far.key);
      assert.ok(f1.cardBottom <= f1.floor + 1, `a card near the bottom is shown whole: ${JSON.stringify(f1)}`);
      assert.ok(f1.top <= f0.top + 1, 'the row never moves down');
      assert.ok(Math.abs(f1.cardBottom - f1.floor) <= 2 || Math.abs(f1.top - f0.top) <= 1, `it rose just enough (its card ends at the floor): ${JSON.stringify([f0, f1])}`);
      assert.equal((await geometry(page)).state, 'open');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // A settle still on its way when the hand comes back: the window is taken
  // where it is on screen. Before 2026-09-26 a grab read the settle's END
  // (the inline styles), so the window popped to where it was going and then
  // under the finger; a tap mid-settle started the next settle from that end
  // too. CI's loaded Linux WebKit held settles on their first frame for over
  // half a second, which is how this was found; here each settle is held
  // halfway (or at its start) on purpose, so the case is the same on every
  // machine.
  test(`${name}: a window caught mid-settle stays where it is on screen — a drag carries it from there, and a tap's settle starts there`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      let g = await grabAt(page);
      await page.mouse.click(g.x, g.y);
      await settled(page);
      const openTop = (await geometry(page)).planTop;
      g = await grabAt(page);
      // A short drag down lets go and the window settles back open — held a
      // tenth of the way in, about half its distance (the arrival curve is
      // quick at the start and nearly home by half time).
      await holdSettles(page, 0.1);
      const dragged = await drag(page, g, g.range * 0.2);
      await unholdSettles(page);
      const midTop = (await geometry(page)).planTop;
      assert.ok(midTop > openTop + 4 && midTop < dragged.planTop - 4, `the settle is held on its way: ${JSON.stringify({ openTop, midTop, dragged: dragged.planTop })}`);
      // The hand takes it there and moves 40px: the window moves 40px from where it was.
      const h = await grabAt(page);
      await page.mouse.move(h.x, h.y);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) { await page.mouse.move(h.x, h.y + 40 * (k / 8)); await sleep(16); }
      await sleep(120);
      const caughtTop = (await geometry(page)).planTop;
      await page.mouse.up();
      assert.ok(Math.abs(caughtTop - (midTop + 40)) <= 2, `the window stayed under the finger: ${JSON.stringify({ midTop, caughtTop })}`);
      await settled(page);
      if ((await geometry(page)).state !== 'open') { const q = await grabAt(page); await page.mouse.click(q.x, q.y); await settled(page); }
      // A tap on the grabber closes it — held halfway; a second tap opens it
      // again, and that settle starts where the first one was.
      await holdSettles(page, 0.5);
      let q = await grabAt(page);
      await page.mouse.click(q.x, q.y);
      await unholdSettles(page);
      const halfTop = (await geometry(page)).planTop;
      assert.ok(halfTop > openTop + 4, `the close is held on its way: ${JSON.stringify({ openTop, halfTop })}`);
      await holdSettles(page, 0);
      q = await grabAt(page);
      await page.mouse.click(q.x, q.y);
      await unholdSettles(page);
      const g2 = await geometry(page);
      assert.equal(g2.state, 'open', 'the second tap opens it');
      assert.ok(Math.abs(g2.planTop - halfTop) <= 1, `and its settle starts where the window was: ${JSON.stringify({ halfTop, startTop: g2.planTop })}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The same catch with a tap's pinned height in play: a row tap pins the
  // open window (storyboard 8) and the pin outlives the close, so a hand
  // that takes the window on its way down lets the pin go — and a window
  // anchored at the bottom moves its top edge by the height it gained. The
  // catch reads the top on screen before that happens.
  test(`${name}: a window grown by a row tap, caught on its way down, stays under the finger`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      let g = await grabAt(page);
      await page.mouse.click(g.x, g.y);
      await settled(page);
      const row = await page.evaluate(() => {
        const r = [...document.querySelectorAll('#plan .plan-list > button.plan-row:not(.tagged):not(.earlier)')][0].getBoundingClientRect();
        return { x: r.left + r.width * 0.4, y: r.top + 14 };
      });
      await page.mouse.click(row.x, row.y);
      await settled(page);
      const pinned = await page.evaluate(() => parseFloat(document.getElementById('plan').style.height) || 0);
      assert.ok(pinned > 0, 'the row tap pinned the window');
      await holdSettles(page, 0.5);
      g = await grabAt(page);
      await page.mouse.click(g.x, g.y);
      await unholdSettles(page);
      const mid = await geometry(page);
      assert.equal(mid.state, 'peek', 'the grabber closes it (held on its way)');
      const h = await grabAt(page);
      await page.mouse.move(h.x, h.y);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) { await page.mouse.move(h.x, h.y - 40 * (k / 8)); await sleep(16); }
      await sleep(120);
      const caught = await page.evaluate(() => { const el = document.getElementById('plan'); const r = el.getBoundingClientRect(); return { top: r.top, height: r.height, pin: el.style.height }; });
      await page.mouse.up();
      assert.equal(caught.pin, '', 'the hand let the pin go');
      assert.ok(Math.abs(caught.height - pinned) > 4, `and the window's height changed with it (the case under test): ${JSON.stringify({ pinned, caught })}`);
      assert.ok(Math.abs(caught.top - (mid.planTop - 40)) <= 2, `the window stayed under the finger: ${JSON.stringify({ mid: mid.planTop, caught })}`);
      await settled(page);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}, Reduce Motion: the settle after a drag is instant; the drag itself still follows the finger`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { reduced: true });
    try {
      const from = await grabAt(page);
      const mid = await drag(page, from, -from.range * 0.6);
      assert.ok(mid.planTop < from.y - from.range * 0.4, 'direct manipulation is kept');
      const g = await geometry(page);
      assert.equal(g.state, 'open');
      assert.equal(g.running, 0, 'nothing animates after the hand lets go');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  // The window's numbers are measured from its boxes, and a late font resizes
  // them. WebKit's `loadingdone` came before the font's layout did, so the
  // refit it drove measured the old face and the peek sat 27px above the
  // dock — every time the fonts were slower than the first paint
  // (2026-09-26). The shelf watches its own boxes now.
  test(`${name}: a late font — the peek measures again from its own boxes, and its row still ends on the dock`, { skip }, async () => {
    const { ctx, page, errors, fontsAtPeek } = await openPhone(get(), { fontDelayMs: 2500 });
    try {
      assert.equal(fontsAtPeek, 'loading', 'the peek arrived before the fonts (the case under test)');
      await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15000 });
      await sleep(700);
      await settled(page);
      const g = await geometry(page);
      assert.equal(g.state, 'peek');
      assert.ok(Math.abs(g.rowBottom - g.dockTop) <= 0.5, `the row ends at the dock's top edge: ${JSON.stringify(g)}`);
      assert.ok(g.rowTop >= g.grabBottom - 0.5, `and starts under the grabber: ${JSON.stringify(g)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The open plan's handle is its grabber and its head together: the bar is
  // 13px tall, and the head (which opens nothing of its own) already drags.
  test(`${name}: in the open plan a tap on the head closes it, like the grabber; the ✕ still closes it`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      let g = await grabAt(page);
      await page.touchscreen.tap(g.x, g.y);
      await settled(page);
      assert.equal((await geometry(page)).state, 'open');
      const head = await page.locator('#plan .plan-head .room-head .label').boundingBox();
      await page.touchscreen.tap(head.x + head.width / 2, head.y + head.height / 2);
      await settled(page);
      assert.equal((await geometry(page)).state, 'peek', 'a finger on the head closes it');
      g = await grabAt(page);
      await page.mouse.click(g.x, g.y);
      await settled(page);
      const x = await page.locator('#plan .plan-head .sheet-close').boundingBox();
      await page.mouse.click(x.x + x.width / 2, x.y + x.height / 2);
      await settled(page);
      assert.equal((await geometry(page)).state, 'peek', 'the ✕ closes it (once, not a close and a reopen)');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The people menu is the other way in: "Our picks ›" first below its line.
  // A finger on the avatar, a finger on the row — the menu gives way and the
  // plan rises from its peek; no history entry, and the busy mark is given back.
  test(`${name}: the people menu’s Our picks row — a finger opens the menu, a finger on the row raises the plan`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      const before = await page.evaluate(() => ({ len: history.length, hash: location.hash }));
      const you = await page.locator('#dock-you').boundingBox();
      await page.touchscreen.tap(you.x + you.width / 2, you.y + you.height / 2);
      const menu = () => page.evaluate(() => {
        const pop = document.querySelector('#dock-you-wrap .hl-pop');
        return { open: document.getElementById('dock-you').getAttribute('aria-expanded') === 'true',
          shown: !!pop && getComputedStyle(pop).display !== 'none',
          acts: pop ? [...pop.querySelectorAll('[data-act]')].map((b) => b.dataset.act) : [] };
      });
      // The menu's own motion first: a finger aimed at a row still arriving misses it.
      await motionDone(page, { within: '#dock-you-wrap' });
      let m = await menu();
      assert.ok(m.open && m.shown, `the menu is up: ${JSON.stringify(m)}`);
      assert.deepEqual(m.acts.slice(0, 2), ['plan', 'pick-as'], 'Our picks first, above Pick as someone else');
      const row = await page.locator('#dock-you-wrap .hl-pop [data-act="plan"]').boundingBox();
      assert.ok(row && row.height >= 44, `a real row, on the touch floor: ${JSON.stringify(row)}`);
      await page.touchscreen.tap(row.x + row.width * 0.3, row.y + row.height / 2);
      // Gone, not a beat: the menu's leaving is its own motion (Linux WebKit
      // held it past 800 ms). Then the plan's rise.
      await page.waitForFunction(() => { const p = document.querySelector('#dock-you-wrap .hl-pop'); return !p || getComputedStyle(p).display === 'none'; }, null, { timeout: 4000 }).catch(() => {});
      await settled(page);
      m = await menu();
      assert.ok(!m.open && !m.shown, `the menu gave way: ${JSON.stringify(m)}`);
      const g = await geometry(page);
      assert.equal(g.state, 'open', 'the plan rose');
      assert.equal(g.running, 0, 'and has settled');
      assert.equal(g.busy, null, 'nothing is left holding the page busy');
      assert.deepEqual(await page.evaluate(() => ({ len: history.length, hash: location.hash })), before, 'no history entry');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // A tap pins the phone's open window at its height (so the tapped row stays
  // put); that pin is the phone's. Widened to a laptop, the panel reaches the
  // bottom again and is the panel (it bounds the zoom); narrowed back, the
  // open plan stands on the dock.
  test(`${name}: a card grown in the open plan, then the window widened to a laptop and back — the panel is whole, then the plan`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get());
    try {
      const g = await grabAt(page);
      await page.mouse.click(g.x, g.y);
      await settled(page);
      const row = await page.evaluate(() => {
        const r = [...document.querySelectorAll('#plan .plan-list > button.plan-row:not(.tagged):not(.earlier)')][0].getBoundingClientRect();
        return { x: r.left + r.width * 0.4, y: r.top + 14 };
      });
      await page.mouse.click(row.x, row.y);
      await settled(page);
      assert.ok(await page.evaluate(() => !!document.getElementById('plan').style.height), 'the tap pinned the window');
      await page.setViewportSize({ width: 1280, height: 800 });
      await sleep(900);
      await settled(page);
      const wide = await page.evaluate(() => {
        const el = document.getElementById('plan');
        const r = el.getBoundingClientRect();
        const rail = document.getElementById('day-rail').getBoundingClientRect();
        return { state: el.dataset.state, side: el.dataset.side || null, top: r.top, bottom: r.bottom, width: r.width, railBottom: rail.bottom, pinned: el.style.height };
      });
      assert.equal(wide.state, 'open');
      assert.equal(wide.side, 'open', 'it is the panel: the zoom keeps left of it');
      assert.equal(wide.pinned, '', 'the phone\'s pin is gone');
      assert.ok(Math.abs(wide.top - wide.railBottom) <= 1 && Math.abs(wide.bottom - 800) <= 1 && Math.abs(wide.width - 400) <= 1,
        `a 400px panel from the rail to the bottom: ${JSON.stringify(wide)}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await sleep(900);
      await settled(page);
      const narrow = await page.evaluate(() => {
        const el = document.getElementById('plan');
        return { state: el.dataset.state, side: el.dataset.side || null, bottom: el.getBoundingClientRect().bottom, dockTop: document.getElementById('dock').getBoundingClientRect().top };
      });
      assert.equal(narrow.state, 'open');
      assert.equal(narrow.side, null, 'no panel on a phone');
      assert.ok(Math.abs(narrow.bottom - narrow.dockTop) <= 0.5, `the open plan stands on the dock: ${JSON.stringify(narrow)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('Chromium touch: a finger drag opens it, and a finger drag on the open list scrolls the list, never the plan', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await openPhone(chromium);
  try {
    const cdp = await ctx.newCDPSession(page);
    const from = await grabAt(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ x: from.x, y: from.y + 30 }]);
    for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: from.x, y: from.y + 30 - (from.range * 0.6) * (k / 12) }]); await sleep(16); }
    await sleep(250);
    await touch('touchEnd', []);
    await settled(page);
    assert.equal((await geometry(page)).state, 'open');
    const list = await page.evaluate(() => {
      const l = document.querySelector('#plan .plan-list');
      const r = l.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.7, scrolls: l.scrollHeight > l.clientHeight + 4 };
    });
    if (list.scrolls) {
      await touch('touchStart', [{ x: list.x, y: list.y }]);
      for (let k = 1; k <= 8; k++) { await touch('touchMove', [{ x: list.x, y: list.y - k * 15 }]); await sleep(16); }
      await touch('touchEnd', []);
      await settled(page);
      const after = await page.evaluate(() => ({ state: document.getElementById('plan').dataset.state, top: document.querySelector('#plan .plan-list').scrollTop }));
      assert.equal(after.state, 'open', 'the list scrolled; the plan stayed open');
      assert.ok(after.top > 0, 'and the list moved');
    }
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// ---- the laptop: the corner card that grows into the side panel ----------------------
const hitPlan = (page, x, y) => page.evaluate(([xx, yy]) => {
  const at = document.elementFromPoint(xx, yy);
  return !!(at && document.getElementById('plan').contains(at));
}, [x, y]);

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name} 1280: the corner card is 20px in from both edges; a click grows it into the panel under the rail, the wall usable beside it; Escape puts it back`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true });
    try {
      const row = await page.locator('#plan .plan-row.tagged').boundingBox();
      const y = row.y + row.height / 2;
      assert.equal(await hitPlan(page, 1280 - 25, y), true, 'inside the card, near its right edge');
      assert.equal(await hitPlan(page, 1280 - 15, y), false, 'the 20px gap to the window edge is the wall');
      assert.equal(await hitPlan(page, 1280 - 380 - 25, y), false, 'the card is 380px wide');
      const bottom = await page.evaluate(() => {
        const r = document.querySelector('#plan .plan-row.tagged').getBoundingClientRect();
        return innerHeight - r.bottom;
      });
      assert.ok(bottom >= 18 && bottom <= 24, `its row sits just above the 20px gap at the bottom (${bottom})`);
      assert.equal(await page.evaluate(() => document.getElementById('rail-now').hidden), true, 'the corner says NOW: the rail steps aside');
      await page.mouse.click(row.x + row.width * 0.4, y);
      await settled(page);
      const open = await page.evaluate(() => {
        const el = document.getElementById('plan');
        const r = el.getBoundingClientRect();
        const rail = document.getElementById('day-rail').getBoundingClientRect();
        return { state: el.dataset.state, side: el.dataset.side, left: r.left, top: r.top, railBottom: rail.bottom, width: r.width };
      });
      assert.equal(open.state, 'open');
      assert.equal(open.side, 'open');
      assert.ok(Math.abs(open.left - 880) <= 1 && Math.abs(open.width - 400) <= 1, `a 400px panel on the right: ${JSON.stringify(open)}`);
      assert.ok(Math.abs(open.top - open.railBottom) <= 1, `from under the rail: ${JSON.stringify(open)}`);
      assert.equal(await hitPlan(page, 1280 - 15, 400), true, 'the panel reaches the edge');
      assert.equal(await hitPlan(page, 870, 400), false, 'and the wall beside it is the wall (no backdrop)');
      assert.equal(await page.evaluate(() => document.body.classList.contains('sheet-open') || !!document.querySelector('.sheet-backdrop')), false);
      await page.keyboard.press('Escape');
      await settled(page);
      assert.equal(await page.evaluate(() => document.getElementById('plan').dataset.state), 'peek', 'Escape puts it back in the corner');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The laptop's mirror of the phone's mid-settle catch: a click on the card
  // while Escape's settle is still on its way grows the panel from where the
  // card is on screen, not from the corner it was going to.
  test(`${name} 1280: a click while the panel is still going back to the corner grows it from where it is`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true });
    try {
      const row = await page.locator('#plan .plan-row.tagged').boundingBox();
      const cornerTop = await page.evaluate(() => { const el = document.getElementById('plan'); return new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 + el.offsetTop; });
      await page.mouse.click(row.x + row.width * 0.4, row.y + row.height / 2);
      await settled(page);
      const openTop = await page.evaluate(() => { const el = document.getElementById('plan'); return new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 + el.offsetTop; });
      await holdSettles(page, 0.5);
      await page.keyboard.press('Escape');
      await unholdSettles(page);
      // The window's own transform, not its box: the card lifts 2px under a
      // hovering mouse (v3.css, the separate `translate`), and the click
      // below brings the mouse over it.
      const lift = () => page.evaluate(() => {
        const el = document.getElementById('plan');
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const r = el.getBoundingClientRect();
        return { state: el.dataset.state, top: m.m42 + el.offsetTop, x: r.left + 60, y: r.top + 30 };
      });
      const half = await lift();
      assert.equal(half.state, 'peek');
      assert.ok(half.top > openTop + 4 && half.top < cornerTop - 4, `the way back is held halfway: ${JSON.stringify({ openTop, half: half.top, cornerTop })}`);
      await holdSettles(page, 0);
      await page.mouse.click(half.x, half.y);
      await unholdSettles(page);
      const start = await lift();
      assert.equal(start.state, 'open', 'the click grows it again');
      assert.ok(Math.abs(start.top - half.top) <= 1, `from where it was: ${JSON.stringify({ half: half.top, start: start.top })}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The Spotify scan pill (settings.js scanPill, mounted the same way) beside
  // the welcome card: the pill must stand clear above it (Sol, 2026-09-26 —
  // in the corner the card covered it on a laptop, and above the dock it
  // always had on a phone).
  const pillOverCard = (page) => page.evaluate(() => {
    const pill = document.createElement('div');
    pill.id = 'spot-scan-pill';
    pill.className = 'spot-pill';
    pill.textContent = 'Reading your library… 1,200 songs';
    document.body.appendChild(pill);
    const p = pill.getBoundingClientRect();
    const c = document.querySelector('#welcome-card .bring-card').getBoundingClientRect();
    pill.remove();
    return { pillBottom: p.bottom, pillLeft: p.left, pillRight: innerWidth - p.right, cardTop: c.top };
  });
  const clearAbove = (at) => at.pillBottom <= at.cardTop - 6 && at.pillLeft >= 0 && at.pillRight >= 0;

  test(`${name} 390: the Spotify pill stands above the welcome card, not under it`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { guest: true });
    try {
      const at = await pillOverCard(page);
      assert.ok(clearAbove(at), JSON.stringify(at));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Kevin, 2026-09-26, on the welcome frame: "all the cards like that should
  // be lower right justified in the same spot as our now … where that card
  // floats right now is so awk".
  test(`${name} 1280: the welcome card waits in the corner card's own box, and the plan rises in the same place when it goes`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true, guest: true });
    try {
      const card = await page.evaluate(() => {
        const r = document.querySelector('#welcome-card .bring-card').getBoundingClientRect();
        return { right: innerWidth - r.right, bottom: innerHeight - r.bottom, width: r.width };
      });
      assert.ok(Math.abs(card.right - 20) <= 1 && Math.abs(card.bottom - 20) <= 1 && Math.abs(card.width - 380) <= 1,
        `380px wide, 20px in from the right and the bottom: ${JSON.stringify(card)}`);
      assert.equal(await page.evaluate(() => document.getElementById('plan').hidden), true, 'the plan waits under it');
      const at = await pillOverCard(page);
      assert.ok(clearAbove(at), `the Spotify pill stands above the card: ${JSON.stringify(at)}`);
      await page.locator('#welcome-card button', { hasText: 'Look around' }).click();
      await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 5000 });
      await settled(page);
      const row = await page.locator('#plan .plan-row.tagged').boundingBox();
      const y = row.y + row.height / 2;
      assert.equal(await hitPlan(page, 1280 - 25, y), true, 'the corner card is where the welcome card was');
      assert.equal(await hitPlan(page, 1280 - 15, y), false);
      assert.equal(await hitPlan(page, 1280 - 380 - 25, y), false);
      // WebKit reports "ResizeObserver loop completed with undelivered
      // notifications" as the card leaves and the plan arrives — with the card
      // centred as before too (checked 2026-09-26): the shelf's refit resizes
      // a box it watches within the frame, and the rest is delivered on the
      // next. A browser notice, not an error: errlog.js drops it as noise.
      assert.deepEqual(errors.filter((e) => !/^ResizeObserver loop/.test(e)), []);
    } finally { await ctx.close(); }
  });

  test(`${name} 1280: with the panel open, a zoom keeps left of it`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true });
    try {
      const row = await page.locator('#plan .plan-row.tagged').boundingBox();
      await page.mouse.click(row.x + row.width * 0.4, row.y + row.height / 2);
      await settled(page);
      const at = await page.evaluate(() => {
        const side = document.getElementById('plan').getBoundingClientRect().left;
        const hit = [...document.querySelectorAll('#wall-root .card')].map((c) => ({ a: c.dataset.artist, r: c.getBoundingClientRect() }))
          .find(({ r }) => r.right > side - 140 && r.right <= side && r.top > 140 && r.bottom < innerHeight - 60);
        return hit ? { x: hit.r.left + hit.r.width / 2, y: hit.r.top + hit.r.height / 2, side } : null;
      });
      assert.ok(at, 'a card beside the panel');
      await page.mouse.move(at.x, at.y, { steps: 5 });
      await page.waitForSelector('#zoom-layer .zoom-card', { timeout: 5000 }).catch(() => {});
      await motionDone(page, { within: '#zoom-layer' });
      const z = await page.evaluate(() => { const c = document.querySelector('#zoom-layer .zoom-card'); if (!c) return null; const r = c.getBoundingClientRect(); return { left: r.left, right: r.right }; });
      assert.ok(z, 'it zoomed');
      assert.ok(z.right <= at.side - 7.5, `its right edge clears the panel by 8px: ${JSON.stringify({ z, side: at.side })}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // A keyboard reaches everything a pointer does: the card (a button), then
  // the panel's stops (buttons while it is open), Enter growing a card with
  // the focus kept on its row; Escape back to the card. Chromium only: WebKit
  // keeps Safari's convention (Tab skips buttons unless Full Keyboard Access
  // is on), as it does for every button in the app.
  test(`${name} 1280: a keyboard reaches the card just after the rail, opens it, Tabs to a stop, grows its card with Enter, and Escape puts the focus back on the card`, { skip: skip || (name === 'WebKit' && 'Safari Tabs past buttons by default') }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true });
    try {
      // It comes right after the rail: one Tab from the rail's last control,
      // not the wall's hundred cards later.
      await page.evaluate(() => document.getElementById('rail-fest-link').focus());
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('plan-grab')), true,
        'the card is the next stop after the rail');
      await page.keyboard.press('Enter');
      await settled(page);
      assert.equal((await geometry(page)).state, 'open');
      const focus = () => page.evaluate(() => {
        const f = document.activeElement;
        return { stop: (f && f.dataset && f.dataset.stop) || null, expanded: f && f.getAttribute('aria-expanded'), grab: !!(f && f.classList.contains('plan-grab')),
          tagged: !!(f && f.classList.contains('tagged')), ring: !!(f && f.matches(':focus-visible')) };
      });
      let f = null;
      for (let k = 0; k < 8; k++) {
        await page.keyboard.press('Tab');
        f = await focus();
        if (f.stop && f.stop !== 'earlier' && !f.tagged && !f.stop.includes('|grow')) break;
      }
      assert.ok(f && f.stop && f.expanded === 'false', `Tab reaches a folded stop in the panel: ${JSON.stringify(f)}`);
      assert.ok(f.ring, 'and shows the ring');
      const key = f.stop;
      await page.keyboard.press('Enter');
      await settled(page);
      f = await focus();
      assert.equal(f.stop, key, 'the focus stays on the same stop');
      assert.equal(f.expanded, 'true', 'its card is grown');
      assert.equal(await page.evaluate((k) => !!document.querySelector(`#plan .plan-grow[data-stop="grow|${CSS.escape(k)}"]`), key), true);
      await page.keyboard.press('Escape');
      await settled(page);
      assert.equal((await geometry(page)).state, 'peek');
      assert.equal((await focus()).grab, true, 'the focus is back on the card');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // From the rail's people menu, by keyboard: Enter on the avatar opens it,
  // Enter on "Our picks" grows the corner card into the panel and the focus
  // comes along to its grabber (a mouse click there leaves the focus alone).
  // The focus is put on each control by script — Safari's Tab skips buttons
  // — and every activation is a real key.
  test(`${name} 1280: Enter on the avatar, Enter on Our picks — the panel opens and the focus is on its grabber`, { skip }, async () => {
    const { ctx, page, errors } = await openPhone(get(), { desk: true });
    try {
      await page.evaluate(() => document.getElementById('rail-you').focus());
      await page.keyboard.press('Enter');
      await motionDone(page, { within: '#rail-you-wrap' });
      assert.equal(await page.evaluate(() => document.getElementById('rail-you').getAttribute('aria-expanded')), 'true', 'the menu is open');
      await page.evaluate(() => document.querySelector('#rail-you-wrap .hl-pop [data-act="plan"]').focus());
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('rail-you').getAttribute('aria-expanded') === 'false', null, { timeout: 4000 }).catch(() => {});
      await settled(page);
      const at = await page.evaluate(() => {
        const el = document.getElementById('plan');
        const r = el.getBoundingClientRect();
        return { side: el.dataset.side || null, width: Math.round(r.width), menu: document.getElementById('rail-you').getAttribute('aria-expanded'),
          grab: !!(document.activeElement && document.activeElement.classList.contains('plan-grab')) };
      });
      assert.equal((await geometry(page)).state, 'open');
      assert.deepEqual(at, { side: 'open', width: 400, menu: 'false', grab: true });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
