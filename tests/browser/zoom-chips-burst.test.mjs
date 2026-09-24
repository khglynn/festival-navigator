// The who-chips under a thumb that will not wait (2026-09-24): real taps on
// the grown card, far faster than the 300ms move, in a real engine.
//
// The Node suite pins the motion's mechanics, but its animations are a
// recorder: nothing plays, nothing is painted, and until 2026-09-24 its
// cancel() reported at once where a browser reports a frame late. That gap
// hid a real bug — clear, then re-pick while your name was still stepping
// away (its 130ms), and the new ×1 chip flew ~180px out of the chip you had
// just left — which an independent review found in Chromium and WebKit. So
// the burst lives here, where frames are real:
//
//   1. A burst of ten taps 40–90ms apart, never letting a move finish: on
//      every painted frame nobody is rendered twice (live or parked); once it
//      settles, nothing temporary is left, no clip stays lifted, nothing in
//      the zoom is still animating, and the row agrees with the card.
//   2. Clear, then re-pick while your name is still stepping away (held,
//      so any machine hits the race) and at 0, 40 and 80ms: the new level
//      grows in where the row makes room (storyboard case 5), never out of
//      the chip you left.
//   3. A cut-off name stays cut off while it slides (it used to draw in full
//      for the 300ms of the move, then snap back to "…").
//
// Storyboard: claude-plans/2026-09-23-zoom-chips-motion.md. The layout
// contract (widths, descenders, 320, a pick's first frame) is its sibling,
// tests/browser/zoom-chips-contract.test.mjs; the fixture here is the same
// made-up crew, repeated rather than shared so the two files never edit each
// other. /api is answered inside the page; nothing leaves it.
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

const LONG = 'Bartholomew-Maximiliana';
const CREW = ['Kevin', 'Drew', 'Kat', 'Nhu', 'Pegah', 'Ross', 'Sam', 'Hal', 'Ivy', 'Jo', 'Lou', LONG, 'Mary Jane', 'Oli', 'Tess'];
// Robyn: busy, with "+n" on every chip; you at ×2 beside the long name.
const ROBYN = { Hal: 4, Drew: 4, Lou: 4, Kat: 3, 'Mary Jane': 3, Jo: 3, Kevin: 2, [LONG]: 2, Ivy: 2, Nhu: 2, Pegah: 1, Oli: 1, Tess: 1 };
// Soulwax: few enough people that every tap is a named case.
const SOULWAX = { Kevin: 1, Pegah: 3, Drew: 3, Nhu: 4 };
const doc = () => ({
  v: 4, meta: { name: 'Chips', inviteFestId: FID }, spotify: {}, affinity: {},
  people: Object.fromEntries(CREW.map((n, i) => [n, { colorIndex: i }])),
  festivals: { [FID]: { selections: { Robyn: ROBYN, Soulwax: SOULWAX } } },
});

async function openWall({ width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const TOKEN = 'chipsburst_0123456789abc'; // a made-up crew, never a real link
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

// A real hold on an artist's resting card (the long-press ignores mouse
// pointers by design); returns the touch channel the taps go through.
async function holdOpen(ctx, page, artist) {
  const at = await page.evaluate((a) => {
    const el = [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a);
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, artist);
  await sleep(200);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
  await sleep(650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForSelector('#zoom-layer .zoom-slot.shown .f-who', { timeout: 4000 });
  await sleep(700);
  return cdp;
}

// One quick finger tap on the grown card's title (a pick). Straight through
// the touch channel: a Playwright locator tap waits for the element to be
// stable, which a card mid-move never is.
async function tap(page, cdp) {
  const at = await page.evaluate(() => {
    const r = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card .f-name').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// Every painted frame: who is rendered where. A person twice LIVE, or live
// and parked at once, breaks the law (one rendering of every fact).
const startSampler = (page) => page.evaluate(() => {
  window.__frames = [];
  window.__sampling = true;
  const tick = () => {
    const card = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
    if (card) {
      const live = {}, parked = {};
      for (const nm of card.querySelectorAll('.f-nm[data-person]')) {
        const bag = nm.closest('.f-parked') ? parked : live;
        bag[nm.dataset.person] = (bag[nm.dataset.person] || 0) + 1;
      }
      const twice = [
        ...Object.entries(live).filter(([, n]) => n > 1).map(([p, n]) => `${p} live ×${n}`),
        ...Object.keys(live).filter((p) => parked[p]).map((p) => `${p} live and parked`),
        ...Object.entries(parked).filter(([, n]) => n > 1).map(([p, n]) => `${p} parked ×${n}`),
      ];
      window.__frames.push(twice);
    }
    if (window.__sampling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const stopSampler = (page) => page.evaluate(() => { window.__sampling = false; return window.__frames; });

const settledState = (page, artist) => page.evaluate((a) => {
  const card = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
  const resting = [...document.querySelectorAll('#wall-root .card')].find((c) => c.dataset.artist === a);
  const you = card.querySelector('.f-who .f-pill.you');
  const names = [...card.querySelectorAll('.f-nm[data-person]')].map((n) => n.dataset.person);
  return {
    temp: [...card.querySelectorAll('.f-parked, .f-bud, .f-fill .f-fill, .f-travel, .f-carrying')].map((n) => n.className),
    lifted: [...card.querySelectorAll('.f-names')].filter((n) => n.style.overflow).length,
    running: document.getAnimations().filter((x) => !(x instanceof CSSAnimation) && x.playState === 'running'
      && x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest('#zoom-layer')).length,
    names, unique: new Set(names).size === names.length,
    youLevel: you ? you.dataset.level : null,
    restingLabel: resting.getAttribute('aria-label'),
  };
}, artist);

// The resting card's label says your level in words; the zoom's row must agree.
const WORDS = { null: 'not picked', 1: 'picked', 2: 'picked ×2', 3: 'picked ×3', 4: 'must' };
function assertSettled(s, what) {
  assert.deepEqual(s.temp, [], `${what}: nothing temporary is left once it settles`);
  assert.equal(s.lifted, 0, `${what}: every lifted clip is put back`);
  assert.equal(s.running, 0, `${what}: nothing in the zoom is still animating`);
  assert.ok(s.unique, `${what}: one rendering of every person (${s.names})`);
  const words = WORDS[s.youLevel];
  assert.ok(new RegExp(` — ${words.replace('×', '\\u00d7')}(,|$)`).test(s.restingLabel),
    `${what}: the zoom's row agrees with the card (you at ${s.youLevel}; card says "${s.restingLabel}")`);
}

const GAPS = [40, 90, 55, 70, 40, 85, 60, 45, 90, 50]; // ten taps, never a move's 300ms apart

for (const [artist, width, height] of [['Soulwax', 390, 844], ['Robyn', 320, 640]]) {
  test(`a burst of ten taps 40–90ms apart on ${artist} at ${width}: never a person twice on any frame, nothing left once it settles`, { skip }, async () => {
    const { ctx, page } = await openWall({ width, height });
    try {
      const cdp = await holdOpen(ctx, page, artist);
      await startSampler(page);
      for (const gap of GAPS) { await tap(page, cdp); await sleep(gap); }
      await sleep(900);
      const frames = await stopSampler(page);
      assert.ok(frames.length >= 20, `sampled the burst frame by frame (${frames.length} frames)`);
      const bad = frames.map((f, i) => [i, f]).filter(([, f]) => f.length);
      assert.deepEqual(bad, [], 'on every frame, nobody is rendered twice — live or parked');
      assertSettled(await settledState(page, artist), `${artist} at ${width}`);
    } finally {
      await ctx.close();
    }
  });
}

// Storyboard case 6 then case 5, fast. At MUST beside Nhu, clear, then
// re-pick while your name is still stepping away inside Nhu's chip: the ×1
// chip must grow in where the row makes room. It used to fly ~180px out of
// Nhu's MUST chip — the re-pick cancels the clear's animations, but a
// cancelled animation reports a frame late, so the parked name was still
// there when the new snapshot read the row, and was read as you (review,
// 2026-09-24, Chromium and WebKit).
//
// These wait on STATE, never on a clock (2026-09-24): the first cut caught
// "the next change to the card's children" and asserted a ×1 chip in it —
// but the clear's old wash leaves the card 150ms after the clear, and on a
// slow CI runner the 80ms case's re-pick landed after that, so the observer
// caught the wash leaving and saw no ×1 chip at all (flaky in CI from the
// v87 merges on; never an app fault — see the zoom-chips build log). Now the
// catch waits for the change that brings the ×1 chip in, and the case that
// must exercise the race HOLDS the clear's move, so the leaving name is
// certainly still parked when the re-pick lands, however slow the machine.
const repickFirstFrame = (page) => page.evaluate(() => {
  const card = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
  window.__first = new Promise((res) => {
    const mo = new MutationObserver(() => {
      const chip = card.querySelector('.f-who > .f-pill[data-level="1"]');
      if (!chip) return; // not the re-pick's rebuild (the clear's wash leaving, say): keep watching
      mo.disconnect();
      queueMicrotask(() => {
        const anims = document.getAnimations().filter((x) => !(x instanceof CSSAnimation));
        const m = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
        for (const x of anims) { x.pause(); x.currentTime = 0; }
        const start = m(chip);
        const frames = chip.getAnimations().map((x) => x.effect.getKeyframes()[0].transform || '');
        for (const x of anims) { x.currentTime = 10000; }
        const end = m(chip);
        for (const x of anims) { try { x.finish(); } catch { x.play(); } }
        res({ start, end, frames });
      });
    });
    mo.observe(card, { childList: true });
  });
});

for (const when of ['held', 0, 40, 80]) {
  const held = when === 'held';
  const title = held
    ? 'clear, then re-pick while the leaving name is still parked (the clear\'s move held): the new level grows in where the row makes room — never out of the chip you left'
    : `clear, then re-pick ${when}ms later: the new level grows in where the row makes room — never out of the chip you left`;
  test(title, { skip }, async () => {
    const { ctx, page } = await openWall();
    try {
      const cdp = await holdOpen(ctx, page, 'Soulwax');
      for (let i = 0; i < 3; i++) { await tap(page, cdp); await sleep(450); } // 1 → 4: MUST beside Nhu
      let s = await settledState(page, 'Soulwax');
      assert.equal(s.youLevel, '4', 'set up: you are at MUST, beside Nhu');
      if (held) {
        // Freeze the clear's move the moment its rebuild lands: every
        // animation it started stays mid-flight until the re-pick cancels it.
        await page.evaluate(() => {
          const card = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
          window.__cleared = new Promise((res) => {
            const mo = new MutationObserver(() => {
              if (card.querySelector('.f-who .f-pill.you')) return;
              mo.disconnect();
              queueMicrotask(() => { for (const x of document.getAnimations()) if (!(x instanceof CSSAnimation)) x.pause(); res(true); });
            });
            mo.observe(card, { childList: true });
          });
        });
      }
      await tap(page, cdp); // MUST → nothing: your name steps away inside Nhu's chip
      if (held) {
        await page.evaluate(() => window.__cleared);
        const parked = await page.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-card .f-pill[data-level="4"] > .f-nm.f-parked').length);
        assert.equal(parked, 1, 'held: your leaving name is parked inside Nhu\'s chip as the re-pick lands — the race this case exists for');
      } else if (when) {
        await sleep(when);
      }
      await repickFirstFrame(page);
      await tap(page, cdp); // nothing → ×1: nobody was at ×1
      const f = await Promise.race([
        page.evaluate(() => window.__first),
        sleep(4000).then(() => null),
      ]);
      assert.ok(f, 'the re-pick brought a ×1 chip into the row');
      assert.ok(f.frames.some((t) => /scale\(0?\.55\)/.test(t)), `it arrives the zoom's own way, growing in (${JSON.stringify(f.frames)})`);
      assert.ok(!f.frames.some((t) => /translate/.test(t)), `it does not travel from anywhere (${JSON.stringify(f.frames)})`);
      assert.ok(Math.abs(f.start.x - f.end.x) < 2 && Math.abs(f.start.y - f.end.y) < 2,
        `its first frame is its own place, not Nhu's chip: ${JSON.stringify(f)}`);
      await page.waitForFunction(() => !document.querySelector('#zoom-layer .zoom-card .f-parked, #zoom-layer .zoom-card .f-travel')
        && document.getAnimations().every((x) => x instanceof CSSAnimation || x.playState !== 'running' || !x.effect?.target?.closest?.('#zoom-layer')), null, { timeout: 3000 });
      s = await settledState(page, 'Soulwax');
      assert.equal(s.youLevel, '1');
      assertSettled(s, `clear then re-pick (${held ? 'held' : `${when}ms`})`);
    } finally {
      await ctx.close();
    }
  });
}

// A cut-off name stays cut off in flight. You leave the ×2 chip, so the long
// name slides into its lead — it used to draw in full, 12px past its chip, for
// the whole move (.f-nm.f-travel lifted the name's own clip), then snap back
// to "…" (review, 2026-09-24). And the bud under a crossing name fits inside
// the name's padding, so it never needed that clip lifted.
test('a cut-off name stays cut off while it slides, and a crossing name\'s bud sits inside its own clip', { skip }, async () => {
  const { ctx, page } = await openWall();
  try {
    const cdp = await holdOpen(ctx, page, 'Robyn');
    await page.evaluate((long) => {
      const card = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card');
      window.__mid = new Promise((res) => {
        const mo = new MutationObserver(() => {
          mo.disconnect();
          queueMicrotask(() => {
            const anims = document.getAnimations().filter((x) => !(x instanceof CSSAnimation));
            for (const x of anims) { x.pause(); x.currentTime = 150; }
            const names = [...card.querySelectorAll('.f-who .f-nm[data-person]')].map((n) => {
              const b = n.getBoundingClientRect();
              const bud = n.querySelector('.f-bud');
              const u = bud && bud.getBoundingClientRect();
              return {
                who: n.dataset.person, travel: n.classList.contains('f-travel'),
                overflow: getComputedStyle(n).overflowX, cut: n.scrollWidth > n.clientWidth + 0.5,
                bud: u ? { inside: u.left >= b.left - 0.5 && u.right <= b.right + 0.5 && u.top >= b.top - 0.5 && u.bottom <= b.bottom + 0.5 } : null,
              };
            });
            for (const x of anims) { try { x.finish(); } catch { x.play(); } }
            res({ names, long: names.find((n) => n.who === long) });
          });
        });
        mo.observe(card, { childList: true });
      });
    }, LONG);
    await tap(page, cdp); // you ×2 → ×3: the long name takes the ×2 chip's lead
    const mid = await page.evaluate(() => window.__mid);
    assert.ok(mid.long && mid.long.travel, `the long name is in flight (${JSON.stringify(mid.long)})`);
    assert.ok(mid.long.cut, 'and it is cut off (the ellipsis)');
    for (const n of mid.names) {
      assert.equal(n.overflow, 'hidden', `mid-move, "${n.who}" keeps its own clip: ${JSON.stringify(n)}`);
      if (n.bud) assert.ok(n.bud.inside, `"${n.who}"'s bud sits inside the name's own box, so the clip never hides it: ${JSON.stringify(n)}`);
    }
    assert.ok(mid.names.some((n) => n.bud), 'somebody crossed chips (you, into ×3), so a bud was checked');
  } finally {
    await ctx.close();
  }
});
