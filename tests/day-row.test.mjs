// The day row (v93, Kevin's D1 — 2026-09-25): NOW is a tab in the row, right
// after the day that is live (`SAT · NOW`), never pinned before the days and
// never shrunk to a dot; and where a row that cannot show every tab comes to
// rest is one rule (wall.js restingLeft):
//   the day you are in whole > NOW whole > its day whole > those clear of the
//   edge fades > no sliver at an edge > as centred as the rest allows.
// The pure rule is tested with the numbers Chromium draws Portola's dock in
// (tab widths, the 24px gap, the 18px fade); the geometry itself — the
// frames Kevin approved, 390 FRI SAT NOW SUN and 320 SAT NOW — is the browser
// contract's (tests/browser/now-jump.test.mjs). The shell half boots the real
// app on a pinned Portola Saturday night and checks where NOW lives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- a clock this file can move (before anything reads Date) -----------------------
// Like tests/helpers/night-clock.mjs, but ours to set, and it wins over it.
const RealDate = globalThis.Date;
let offset = 0;
const setClock = (iso) => { offset = RealDate.parse(iso) - RealDate.now(); };
function ShiftedDate(...args) {
  if (!new.target) return new RealDate(RealDate.now() + offset).toString();
  const nt = new.target === ShiftedDate ? RealDate : new.target;
  return Reflect.construct(RealDate, args.length === 0 ? [RealDate.now() + offset] : args, nt);
}
Object.setPrototypeOf(ShiftedDate, RealDate);
Object.defineProperty(ShiftedDate, 'prototype', { value: RealDate.prototype, writable: false });
Object.defineProperty(ShiftedDate, 'now', { value: () => RealDate.now() + offset, writable: true, configurable: true });
globalThis.Date = ShiftedDate;
const SAT_1030 = '2026-09-27T05:30:00Z'; // Portola Saturday 10:30 PM PDT: Soulwax on the grid, the afters open
const MON_5AM = '2026-09-28T12:00:00Z';  // the week is over: nothing live
const SUN_3PM = '2026-09-27T22:00:00Z';  // the last day's grid
setClock(SAT_1030);

// ---- the real app, booted on that night (first: its modules need a window) -------------
const { bootShell, settle } = await import('./helpers/shell-rig.mjs');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'dayrowtesttoken_0123456789'; // a made-up crew, never a real link
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DOC = {
  v: 4, meta: { name: 'The Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 } },
  festivals: { [FID]: { selections: { Soulwax: { Ross: 3 } } } },
};
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'The Crew' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_welcome_v1: '1',
  },
  fetch: async (url) => {
    const u = String(url);
    if (u === '/data/festivals/index.json') return json(INDEX);
    if (u === `/data/festivals/${FID}.json`) return json(FEST);
    if (u.startsWith('/api/crew?')) return json(DOC);
    if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
    return json({ error: 'not in this test' }, 503);
  },
});
test.after(() => shell.close());
const { $, dom } = shell;
for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
// The minute ticker's other door: the page shown again re-reads the clock.
// jsdom reports "prerender" unless told, and the app only ticks when visible.
Object.defineProperty(dom.window.document, 'visibilityState', { value: 'visible', configurable: true });
const tick = async (iso) => { setClock(iso); dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')); await settle(20); };
const where = (door) => {
  const now = $(`${door}-now`);
  const days = $(`${door}-days`);
  return {
    hidden: now.hidden,
    inRow: now.parentElement === days,
    after: now.previousElementSibling && now.previousElementSibling.dataset ? now.previousElementSibling.dataset.day || null : null,
    parked: now.nextElementSibling === days,
    nows: days.querySelectorAll('.now-tab').length,
    kids: [...days.children].map((k) => (k.classList.contains('now-tab') ? 'NOW' : k.dataset.day)),
  };
};

const { restingLeft } = await import('../js/v3/wall.js'); // the SAME instance the page booted

// ---- the rule, in numbers ---------------------------------------------------------------
// Portola's dock row as Chromium on a Mac draws it: THU 38, FRI 30, SAT 36,
// SUN 38, NOW 41 (its dot, a 5px gap, the word; no side padding — the frame's
// 30px of air around it), 24px apart, an 18px fade at each edge that has more.
const W = { THU: 38, FRI: 30, SAT: 36, SUN: 38, NOW: 41 };
const row = (names, gap = 24) => {
  let x = 0;
  return names.map((n) => { const it = { n, x, w: W[n] }; x += W[n] + gap; return it; });
};
const seen = (it, L, width) => Math.max(0, Math.min(it.x + it.w, L + width) - Math.max(it.x, L));
const rest = (names, width, { active, now = null } = {}) => {
  const items = row(names);
  const end = items.at(-1).x + items.at(-1).w;
  const idx = (n) => (n == null ? -1 : names.indexOf(n));
  const L = restingLeft({ items, width, max: Math.max(0, end - width), fade: 18, active: idx(active), now: idx(now), live: now == null ? -1 : idx(now) - 1 });
  const shows = Object.fromEntries(items.map((it) => [it.n, Math.round(seen(it, L, width))]));
  return { L, shows, items };
};
const SAT_LIVE = ['THU', 'FRI', 'SAT', 'NOW', 'SUN'];

test('390: FRI SAT NOW SUN — the frame Kevin approved; THU is past the edge, not a sliver of it', () => {
  // The row is 213px at 390 with the avatar and PORTOLA '26 beside it.
  const { shows } = rest(SAT_LIVE, 213, { active: 'SAT', now: 'NOW' });
  assert.deepEqual([shows.SAT, shows.NOW], [W.SAT, W.NOW], 'the pair whole');
  assert.equal(shows.FRI, W.FRI, 'FRI whole');
  assert.ok(shows.SUN >= W.SUN - 6, `SUN all but its edge: ${shows.SUN}`);
  assert.equal(shows.THU, 0, 'and THU past the edge');
});

test('320: SAT NOW, exactly — the pair in the middle, nothing else in the row', () => {
  const { shows, L, items } = rest(SAT_LIVE, 143, { active: 'SAT', now: 'NOW' });
  assert.deepEqual(shows, { THU: 0, FRI: 0, SAT: W.SAT, NOW: W.NOW, SUN: 0 });
  const sat = items[2]; const now = items[3];
  assert.ok(sat.x - L >= 18 && now.x + now.w - L <= 143 - 18, 'and clear of both fades');
});

test('the last day: NOW is the last tab, and the row rests at its end with the pair whole', () => {
  const { shows } = rest(['THU', 'FRI', 'SAT', 'SUN', 'NOW'], 143, { active: 'SUN', now: 'NOW' });
  assert.equal(shows.SUN, W.SUN);
  assert.equal(shows.NOW, W.NOW, 'NOW whole at the end of the row');
});

test('a day with no festival room (Portola Thursday): THU NOW at the start of the row', () => {
  const { L, shows } = rest(['THU', 'NOW', 'FRI', 'SAT', 'SUN'], 213, { active: 'THU', now: 'NOW' });
  assert.equal(L, 0, 'the row rests at its start');
  assert.deepEqual([shows.THU, shows.NOW, shows.FRI], [W.THU, W.NOW, W.FRI]);
});

test('the day you are in outranks NOW: standing in Friday on a 320 dock while Saturday is live', () => {
  const { shows } = rest(SAT_LIVE, 143, { active: 'FRI', now: 'NOW' });
  assert.equal(shows.FRI, W.FRI, 'the day you are in, whole');
  assert.equal(shows.SAT, W.SAT, 'then the live day');
  assert.ok(shows.NOW <= 6 || shows.NOW === W.NOW, `NOW whole or past the edge, never a sliver: ${shows.NOW}`);
});

test('a row too narrow for the pair (ACL at 320: 82px) keeps the day you are in, and NOW is past the edge, not a sliver', () => {
  const items = [{ x: 0, w: 38 }, { x: 62, w: 44 }, { x: 130, w: 41 }, { x: 195, w: 46 }];
  const L = restingLeft({ items, width: 82, max: 241 - 82, fade: 18, active: 1, now: 2, live: 1 });
  assert.equal(Math.round(seen(items[1], L, 82)), 44, 'SAT 3 whole');
  assert.ok(seen(items[2], L, 82) <= 6, `NOW is not a sliver: ${seen(items[2], L, 82)}`);
});

test('a tab that ends half a pixel past the scroll range is still whole (widths are whole pixels, the range rounds)', () => {
  // NOW after SUN at 320 once read 0.5px short and the rule hid it.
  const items = [{ x: 0, w: 38 }, { x: 62, w: 30 }, { x: 116, w: 36 }, { x: 176, w: 38 }, { x: 238, w: 41 }];
  const L = restingLeft({ items, width: 143, max: 135, fade: 18, active: 3, now: 4, live: 3 });
  assert.equal(L, 135, 'the end of the row');
});

test('a row that fits does not scroll', () => {
  assert.equal(restingLeft({ items: row(['THU', 'FRI', 'SAT', 'SUN']), width: 253, max: 0, fade: 18, active: 2 }), 0);
  assert.equal(restingLeft({ items: [], width: 100, max: 0 }), 0);
});

// The rule's promise, checked over every row width a phone's dock can have:
// whenever SOME resting place is as good on rules 1-2 (the day you are in,
// NOW, its day — whole) and leaves no sliver at either edge, the place the
// rule picks leaves none either. (Where NOW can only be whole at the row's
// end, a few px of the day before it may show: NOW whole outranks a hint.)
test('no sliver whenever a place without one exists — every dock row from 90 to 290px, live and not, every day', () => {
  const cases = [
    [SAT_LIVE, 'SAT', 'NOW'], [['THU', 'FRI', 'SAT', 'SUN', 'NOW'], 'SUN', 'NOW'], [['THU', 'NOW', 'FRI', 'SAT', 'SUN'], 'THU', 'NOW'],
    [SAT_LIVE, 'FRI', 'NOW'], [SAT_LIVE, 'THU', 'NOW'], [['THU', 'FRI', 'SAT', 'SUN'], 'SAT', null], [['THU', 'FRI', 'SAT', 'SUN'], 'SUN', null],
  ];
  for (const [names, active, now] of cases) {
    for (let width = 90; width <= 290; width += 1) {
      const items = row(names);
      const end = items.at(-1).x + items.at(-1).w;
      const max = Math.max(0, end - width);
      if (!max) continue;
      const clean = (L) => items.every((it) => { const s = seen(it, L, width); return s <= 6 || it.w - s <= 6; });
      const whole = (n, L) => n == null || seen(items[names.indexOf(n)], L, width) >= W[n] - 1;
      const live = now ? names[names.indexOf(now) - 1] : null;
      const tier = (L) => [whole(active, L), whole(now, L), whole(live, L)].map(Number).join('');
      const { L } = rest(names, width, { active, now });
      assert.ok(whole(active, L), `${names.join(' ')} @${width}: the day you are in is whole`);
      const better = [];
      for (let x = 0; x <= max; x += 1) if (clean(x) && tier(x) >= tier(L)) better.push(x);
      if (!better.length) continue;
      assert.ok(clean(L), `${names.join(' ')} @${width} (${active}${now ? ' + NOW' : ''}): rested at ${L} with a sliver, though ${better[0]} has none and is as whole`);
    }
  }
});

// ---- the shell: where NOW lives -------------------------------------------------------------
test('something live: NOW is a tab in the row, right after the day that is live — the dock and the rail alike', () => {
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.equal(w.hidden, false, `${door}: live, so NOW is there`);
    assert.ok(w.inRow, `${door}: in the day row, not pinned before it`);
    assert.equal(w.after, 'Saturday', `${door}: after SAT`);
    assert.deepEqual(w.kids, ['Thursday', 'Friday', 'Saturday', 'NOW', 'Sunday']);
    const now = $(`${door}-now`);
    assert.equal(now.classList.contains('day-tab'), false, 'not a day: the scrollspy never lights it');
    assert.equal(now.getAttribute('aria-label'), 'Jump to what is playing now');
    assert.equal(now.classList.contains('compact'), false, 'and there is no dot form any more');
  }
  assert.equal($('dock').classList.contains('squeezed'), false, 'nor a squeeze: the fest name never gives way');
});

test('a repaint (a highlight, a friend\'s pick on the poll) rebuilds the row with NOW back in its place, once', async () => {
  click([...$('person-chips').querySelectorAll('.person-chip')].find((c) => c.textContent === 'Ross'));
  await settle(20);
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.ok(w.inRow && w.after === 'Saturday' && w.nows === 1, `${door}: ${JSON.stringify(w)}`);
  }
  click([...$('person-chips').querySelectorAll('.person-chip')].find((c) => c.textContent === 'Ross'));
  await settle(20);
});

test('nothing live: NOW leaves the row and waits, hidden, just outside it; it comes back after the live day', async () => {
  await tick(MON_5AM);
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.ok(w.hidden && !w.inRow && w.parked, `${door}: parked before the row, hidden: ${JSON.stringify(w)}`);
    assert.deepEqual(w.kids, ['Thursday', 'Friday', 'Saturday', 'Sunday'], 'the row is only days');
  }
  await tick(SUN_3PM);
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.ok(!w.hidden && w.inRow && w.after === 'Sunday', `${door}: after SUN: ${JSON.stringify(w)}`);
    assert.deepEqual(w.kids.slice(-2), ['Sunday', 'NOW'], 'the last tab of the row');
  }
  await tick(SAT_1030);
  for (const door of ['dock', 'rail']) assert.equal(where(door).after, 'Saturday', `${door}: and back after SAT when the clock says so`);
});
