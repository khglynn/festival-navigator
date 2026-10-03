// The day row (v103, Kevin 2026-09-26: "move the now to the far left in the
// day bar — just not pinned over everything — don't have it move between
// days"): NOW is the row's FIRST item, in one place whatever the day, and it
// scrolls with the days. (v93's D1 put it right after the live day, `SAT ·
// NOW`, which moved it every day; v90 pinned it before the row.) Where a row
// that cannot show every tab comes to rest is one rule (wall.js restingLeft):
//   the day you are in whole > NOW whole > no sliver at an edge > those clear
//   of the edge fades > as centred as the rest allows —
// and it centres on NOW and the day together only where the two fit the row
// together; otherwise on the day alone, so NOW rests past the edge whole or
// not at all. The pure rule is tested with the numbers Chromium draws
// Portola's dock in (tab widths, the 24px gap, the 18px fade); the geometry
// itself is the browser contract's (tests/browser/now-jump.test.mjs). The
// shell half boots the real app on a pinned Portola Saturday night and
// checks where NOW lives.
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
    first: days.firstElementChild === now,
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
  const L = restingLeft({ items, width, max: Math.max(0, end - width), fade: 18, active: idx(active), now: idx(now) });
  const shows = Object.fromEntries(items.map((it) => [it.n, Math.round(seen(it, L, width))]));
  return { L, shows, items };
};
const LIVE = ['NOW', 'THU', 'FRI', 'SAT', 'SUN'];
const DAYS = ['THU', 'FRI', 'SAT', 'SUN'];

test('390, Friday live: NOW THU FRI from the row\'s start — NOW whole beside the day you are in', () => {
  // The row is 213px at 390 with the avatar and PORTOLA '26 beside it.
  const { L, shows } = rest(LIVE, 213, { active: 'FRI', now: 'NOW' });
  assert.equal(L, 0, 'the row rests at its start');
  assert.deepEqual([shows.NOW, shows.THU, shows.FRI], [W.NOW, W.THU, W.FRI]);
});

test('390, Saturday live: the day you are in whole, and NOW past the edge — whole days, no violet tail', () => {
  // NOW to SAT is 217px: one row of 213 cannot hold both whole, and the day
  // you are in outranks NOW. The row centres on SAT alone, so it rests on
  // whole days — THU all but its edge, FRI SAT SUN whole — and NOW shows
  // nothing (a 6px hint of its W read as a stray violet mark).
  const { shows } = rest(LIVE, 213, { active: 'SAT', now: 'NOW' });
  assert.equal(shows.SAT, W.SAT, 'the day you are in, whole');
  assert.equal(shows.NOW, 0, 'NOW past the edge, not a hint of it');
  assert.equal(shows.FRI, W.FRI);
  assert.equal(shows.SUN, W.SUN);
  assert.ok(shows.THU >= W.THU - 6, `THU all but its edge: ${shows.THU}`);
});

test('320, Saturday live: SAT whole, no sliver, NOW nowhere in view', () => {
  const { shows, items, L } = rest(LIVE, 143, { active: 'SAT', now: 'NOW' });
  assert.equal(shows.SAT, W.SAT);
  assert.equal(shows.NOW, 0);
  for (const it of items) {
    const s2 = seen(it, L, 143);
    assert.ok(s2 <= 6 || it.w - s2 <= 6, `${it.n} is not a sliver: ${s2}/${it.w}`);
  }
});

test('the last day: SUN whole at the row\'s end, NOW at its start past the edge — it never moves to follow the day', () => {
  const { shows, L, items } = rest(LIVE, 213, { active: 'SUN', now: 'NOW' });
  assert.equal(shows.SUN, W.SUN);
  assert.equal(L, items.at(-1).x + items.at(-1).w - 213, 'the row rests at its end');
  assert.equal(shows.NOW, 0);
});

test('a day with no festival room (Portola Thursday): NOW THU FRI at the start of the row', () => {
  const { L, shows } = rest(LIVE, 213, { active: 'THU', now: 'NOW' });
  assert.equal(L, 0, 'the row rests at its start');
  assert.deepEqual([shows.NOW, shows.THU, shows.FRI], [W.NOW, W.THU, W.FRI]);
});

test('a row too narrow for NOW beside the day (ACL at 320: 82px) keeps the day you are in, and NOW is not a sliver', () => {
  // NOW 41, FRI 2 38, SAT 3 44, SUN 4 46 — standing in SAT 3.
  const items = [{ x: 0, w: 41 }, { x: 65, w: 38 }, { x: 127, w: 44 }, { x: 195, w: 46 }];
  const L = restingLeft({ items, width: 82, max: 241 - 82, fade: 18, active: 2, now: 0 });
  assert.equal(Math.round(seen(items[2], L, 82)), 44, 'SAT 3 whole');
  assert.ok(seen(items[0], L, 82) <= 6, `NOW is not a sliver: ${seen(items[0], L, 82)}`);
});

test('a tab that ends half a pixel past the scroll range is still whole (widths are whole pixels, the range rounds)', () => {
  // SUN at the end of a 320 row once read 0.5px short and the rule hid it.
  const items = [{ x: 0, w: 41 }, { x: 65, w: 38 }, { x: 127, w: 30 }, { x: 181, w: 36 }, { x: 241, w: 38 }];
  const L = restingLeft({ items, width: 143, max: 135.5, fade: 18, active: 4, now: 0 });
  assert.ok(L >= 135, `rested at the row's end, within the pixel of slack: ${L}`);
  assert.ok(seen(items[4], L, 143) >= 38 - 1, 'SUN whole');
});

test('inside the row there is no pixel of slack: the day you are in is never cut, even by one (ACL at 430 on Linux, CI v103)', () => {
  // NOW 43, FRI 2 39, SAT 3 46, SUN 4 47 … — NOW to SAT 3 is one pixel wider than the row.
  const items = [{ x: 0, w: 43 }, { x: 60, w: 39 }, { x: 116, w: 46 }, { x: 179, w: 47 }, { x: 243, w: 39 }];
  const width = 161;
  const L = restingLeft({ items, width, max: 282 - width, fade: 18, active: 2, now: 0 });
  assert.equal(seen(items[2], L, width), 46, `SAT 3 whole to the pixel: rested at ${L}`);
  assert.ok(seen(items[0], L, width) >= 42, 'and NOW whole within the pixel the row’s start forgives');
});

test('a row that fits does not scroll', () => {
  assert.equal(restingLeft({ items: row(DAYS), width: 253, max: 0, fade: 18, active: 2 }), 0);
  assert.equal(restingLeft({ items: row(LIVE), width: 300, max: 0, fade: 18, active: 3, now: 0 }), 0);
  assert.equal(restingLeft({ items: [], width: 100, max: 0 }), 0);
});

// The rule's promise, checked over every row width a phone's dock can have:
// whenever SOME resting place is as good on rules 1-2 (the day you are in,
// NOW — whole) and leaves no sliver at either edge, the place the rule picks
// leaves none either. And NOW is whole at rest wherever it CAN be whole beside
// the day you are in.
test('no sliver whenever a place without one exists, and NOW whole wherever it fits — every dock row from 90 to 290px, every day', () => {
  const cases = [[LIVE, 'THU', 'NOW'], [LIVE, 'FRI', 'NOW'], [LIVE, 'SAT', 'NOW'], [LIVE, 'SUN', 'NOW'], [DAYS, 'SAT', null], [DAYS, 'SUN', null]];
  for (const [names, active, now] of cases) {
    for (let width = 90; width <= 290; width += 1) {
      const items = row(names);
      const end = items.at(-1).x + items.at(-1).w;
      const max = Math.max(0, end - width);
      if (!max) continue;
      const clean = (L) => items.every((it) => { const s2 = seen(it, L, width); return s2 <= 6 || it.w - s2 <= 6; });
      const whole = (n, L) => n == null || seen(items[names.indexOf(n)], L, width) >= W[n] - 1;
      const tier = (L) => [whole(active, L), whole(now, L)].map(Number).join('');
      const { L } = rest(names, width, { active, now });
      assert.ok(whole(active, L), `${names.join(' ')} @${width}: the day you are in is whole`);
      const pairFits = now && (items[names.indexOf(active)].x + W[active]) <= width + 1;
      if (pairFits) assert.ok(whole(now, L), `${names.join(' ')} @${width} (${active}): NOW fits beside the day you are in, so it is whole`);
      const better = [];
      for (let x = 0; x <= max; x += 1) if (clean(x) && tier(x) >= tier(L)) better.push(x);
      if (!better.length) continue;
      assert.ok(clean(L), `${names.join(' ')} @${width} (${active}${now ? ' + NOW' : ''}): rested at ${L} with a sliver, though ${better[0]} has none and is as whole`);
    }
  }
});

// ---- the air between the tabs (v112) ------------------------------------------------------
// ACL's name went from ACL MUSIC FESTIVAL to ACL (Kevin, 2026-10-03), the
// dock's row grew, and at 375 and 390 its start — NOW, FRI 2, SAT 3, the
// row's resting place while you stand in Saturday — ended half way through
// SUN 4 (CI, Linux Chromium: SUN 4 33 of 47 at 390, 17 of 47 at 375). No
// resting place fixes that: NOW must stay whole, so the row cannot move. The
// gaps can: before the row leaves a sliver, the air between its tabs gives,
// down to --gap-min or up to --gap-max, as little as clears it — the cut tab
// comes in whole, or goes out to a hint inside the fade. A row with no sliver
// at its own gap keeps it, so a gap moves only where one would be.
const ACL = [['NOW', 43], ['FRI 2', 39], ['SAT 3', 46], ['SUN 4', 47], ['FRI 9', 39], ['SAT 10', 48], ['SUN 11', 48], ['LATE', 43]]; // Linux Chromium (CI), the last four estimated
const lay = (tabs, gap) => { let x = 0; return tabs.map(([n, w]) => { const it = { n, x, w }; x += w + gap; return it; }); };
const geoAt = (tabs, gap, width, active, now = 0) => {
  const items = lay(tabs, gap);
  const end = items.at(-1).x + items.at(-1).w;
  return { items, width, max: Math.max(0, end - width), fade: 18, active, now };
};
const sliversAt = (g, L) => g.items.filter((it) => { const s2 = seen(it, L, g.width); return s2 > 6 && it.w - s2 > 6; }).map((it) => `${it.n} ${Math.round(seen(it, L, g.width))}/${it.w}`);
const wall = await import('../js/v3/wall.js');
const fitGap = (tabs, width, active, now = 0) => {
  assert.equal(typeof wall.restingGap, 'function', 'wall.js has a rule for the air between the tabs');
  const g = wall.restingGap({ ...geoAt(tabs, 24, width, active, now), gap: 24, gapMin: 15, gapMax: 30 });
  const geo = geoAt(tabs, g, width, active, now);
  return { g, geo, L: restingLeft(geo) };
};

for (const [width, label] of [[232, '390'], [216, '375']]) {
  test(`ACL at ${label} on Linux (CI): standing in SAT 3, the row would end in a sliver of SUN 4 — its gaps give instead, and NOW stays whole`, () => {
    const old = geoAt(ACL, 24, width, 2);
    assert.ok(sliversAt(old, restingLeft(old)).length, 'at the 24px gap no resting place is clean (the bug)');
    const { g, geo, L } = fitGap(ACL, width, 2);
    assert.ok(g >= 15 && g <= 30 && g !== 24, `the gap moved, within its bounds: ${g}`);
    assert.deepEqual(sliversAt(geo, L), [], `no sliver at ${g}px`);
    assert.ok(seen(geo.items[2], L, width) >= 46 - 1, 'SAT 3 whole');
    assert.ok(seen(geo.items[0], L, width) >= 43 - 1, 'NOW whole');
  });
}

test('ACL at 430 (this machine\'s Linux Chromium): FRI 9 would show 13 of 38 past SUN 4 — the gaps give, as little as clears it', () => {
  const tabs = [['NOW', 41], ['FRI 2', 38], ['SAT 3', 44], ['SUN 4', 46], ['FRI 9', 38], ['SAT 10', 47], ['SUN 11', 47], ['LATE', 42]];
  const old = geoAt(tabs, 24, 278, 2);
  assert.deepEqual(sliversAt(old, restingLeft(old)), ['FRI 9 13/38']);
  const { g, geo, L } = fitGap(tabs, 278, 2);
  assert.deepEqual(sliversAt(geo, L), [], `no sliver at ${g}px`);
  // Pushing FRI 9 out takes ~2px a gap; pulling it in whole takes ~6.
  assert.ok(g > 24 && g <= 27, `the nearest clean gap, not the first one found: ${g}`);
});

test('a row with no sliver at its own gap keeps it — every Portola row from 90 to 290px, every day', () => {
  const tabs = LIVE.map((n) => [n, W[n]]);
  for (let width = 90; width <= 290; width += 1) {
    for (let active = 1; active < tabs.length; active += 1) {
      const geo = geoAt(tabs, 24, width, active);
      if (!(geo.max > 0.5) || sliversAt(geo, restingLeft(geo)).length) continue;
      assert.equal(wall.restingGap({ ...geo, gap: 24, gapMin: 15, gapMax: 30 }), 24, `@${width}, ${tabs[active][0]}`);
    }
  }
});

test('wherever some gap in bounds rests clean, the chosen one does, with the day you are in and NOW as whole — ACL, every dock row from 90 to 300px, every day', () => {
  for (let width = 90; width <= 300; width += 1) {
    for (let active = 1; active < ACL.length; active += 1) {
      const { g, geo, L } = fitGap(ACL, width, active);
      const tier = (gg, LL) => [gg.active, gg.now].map((i) => Number(seen(gg.items[i], LL, gg.width) >= gg.items[i].w - 1)).join('');
      const base = geoAt(ACL, 24, width, active);
      const at24 = restingLeft(base);
      assert.ok(tier(geo, L) >= tier(base, at24), `@${width} ${ACL[active][0]}: the gap never costs the day you are in or NOW (${g}px)`);
      if (!sliversAt(geo, L).length) continue;
      for (let gg = 15; gg <= 30; gg += 0.5) {
        const other = geoAt(ACL, gg, width, active);
        const LL = restingLeft(other);
        assert.ok(sliversAt(other, LL).length || tier(other, LL) < tier(geo, L), `@${width} ${ACL[active][0]}: ${g}px rests with a sliver (${sliversAt(geo, L)}), though ${gg}px rests clean`);
      }
    }
  }
});

// ---- the shell: where NOW lives -------------------------------------------------------------
test('something live: NOW is the row\'s first item — the dock and the rail alike', () => {
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.equal(w.hidden, false, `${door}: live, so NOW is there`);
    assert.ok(w.first, `${door}: the row's first item, not pinned before it`);
    assert.deepEqual(w.kids, ['NOW', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    const now = $(`${door}-now`);
    assert.equal(now.classList.contains('day-tab'), false, 'not a day: the scrollspy never lights it');
    assert.equal(now.getAttribute('aria-label'), 'Jump to what is playing now');
    assert.equal(now.classList.contains('compact'), false, 'and there is no dot form any more');
  }
  assert.equal($('dock').classList.contains('squeezed'), false, 'nor a squeeze: the fest name never gives way');
});

test('a repaint (a search, a friend\'s pick on the poll) rebuilds the days after NOW — the same NOW, never lifted out', async () => {
  const before = { dock: $('dock-now'), rail: $('rail-now') };
  const days = $('dock-days').querySelector('.day-tab[data-day="Saturday"]');
  const search = (q) => { $('search-input').value = q; $('search-input').dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  search('soulwax');
  await settle(20);
  search('');
  await settle(20);
  assert.notEqual($('dock-days').querySelector('.day-tab[data-day="Saturday"]'), days, 'the day tabs are rebuilt');
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.ok(w.first && w.nows === 1 && !w.hidden, `${door}: ${JSON.stringify(w)}`);
    assert.deepEqual(w.kids, ['NOW', 'Thursday', 'Friday', 'Saturday', 'Sunday'], `${door}: once, first`);
    assert.equal($(`${door}-now`), before[door], `${door}: the same element — it never left the row`);
  }
});

test('nothing live: NOW stays first in the row, hidden; it comes back in the same place on Sunday and on Saturday', async () => {
  await tick(MON_5AM);
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.ok(w.hidden && w.first, `${door}: first in the row, hidden: ${JSON.stringify(w)}`);
    assert.deepEqual(w.kids, ['NOW', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'nothing moved: it is just not shown');
  }
  await tick(SUN_3PM);
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.ok(!w.hidden && w.first, `${door}: first on Sunday: ${JSON.stringify(w)}`);
  }
  await tick(SAT_1030);
  for (const door of ['dock', 'rail']) {
    const w = where(door);
    assert.ok(!w.hidden && w.first, `${door}: and first on Saturday: ${JSON.stringify(w)}`);
  }
});
