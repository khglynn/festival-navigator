// NOW, the jump to what is playing (Kevin, 2026-09-24): "an option to the
// left of the days … if you tap it goes to now. A use case I'm thinking about
// is like 'where is ross likely right now' — tapping ross on the top to
// highlight him and then clicking something in the scroll-to-time bar."
//
// What NOW lands on is the wall's decision (wall.js nowLanding), read off the
// wall the person is looking at, with the festival's clock pinned here:
//   · nothing live (no now line, no NOW mark) → no NOW at all;
//   · no highlight → the now line while the clock is inside the grid's
//     hours, or — past them (Pier 80 closed, the afters running) — the first
//     NOW-marked card in wall order;
//   · a highlight → that person's pick that is playing now, grid cell or
//     stack card: the highest level first (must), then the most recent start;
//     none live → the line (or the first NOW card) as above, the highlight
//     still dimming the rest, and the answer says it is no match.
// Where the page scrolls to (the line and the card in view together) is
// geometry, so it is the browser contract's (tests/browser/now-jump.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall, nowLanding, nowStops, nowStep, stillThere, nowPulseable, nowSaid, cardFor, roomOf, positionNowLines, positionNowMarks } = await import('../js/v3/wall.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' }, { id: 'lineup-now', status: 'lineup' });
state.FESTIVALS['portola-2026'] = portola;
// Saturday 10:30 PM at Pier 80: Soulwax (Crane) and Prospa (Warehouse) are on
// the grid; across town Milli Meng opens Public Works and Galen the Great
// Northern (the afters' own NOW marks). Ross is at the afters; Nhu is at
// Pier 80 for Soulwax, and has an afters pick live too.
const SELECTIONS = {
  'Milli Meng': { Ross: 3 },
  Galen: { Ross: 1, Nhu: 2 },
  Soulwax: { Nhu: 4 },
  Prospa: { Nhu: 2 },
  'Fcukers': { Ross: 4 }, // Sat afters, 1 AM: not live at 10:30
};
state.activateCrew('nowjumptesttoken_0123456789', {
  v: 4, meta: {}, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 } },
  festivals: { 'portola-2026': { selections: SELECTIONS } },
});
state.setActiveFestivalId('portola-2026');

const pt = (s) => new Date(`${s}-07:00`); // an instant whose Portola (PDT) wall clock reads s
const SAT_1030 = pt('2026-09-26T22:30:00');
const ctxAt = (date, filterPeople = []) => ({
  fid: 'portola-2026', meName: 'Kevin', picks: model.picksFor(state.crewDoc, 'portola-2026'), affinity: null, lowPower: true,
  sort: 'day', query: '', weekend: 'all', filterPeople, folded: [], now: date,
  onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null,
});
const render = (date, filterPeople = [], over = {}) => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx = { ...ctxAt(date, filterPeople), ...over };
  renderWall(root, ctx);
  return { root, ctx };
};
const artistOf = (landing) => landing && landing.card ? landing.card.dataset.artist : null;
const roomOfCard = (card) => card.closest('.room').dataset.room;

test('Saturday 10:30 PM with nobody highlighted: NOW lands on the now line', () => {
  const { root, ctx } = render(SAT_1030);
  const l = nowLanding(root, ctx, SAT_1030);
  assert.ok(l, 'something is live, so there is a NOW');
  assert.equal(l.kind, 'line');
  assert.equal(l.line, root.querySelector('.times-grid[data-iso="2026-09-26"] .now-line'), 'Saturday’s line');
  assert.ok(root.querySelectorAll('.venue-grid .card.now').length > 1, 'and the afters carry NOW marks too');
  root.remove();
});

test('“where is Ross right now”: Ross highlighted, his live pick in SAT AFTERS is where NOW lands', () => {
  const { root, ctx } = render(SAT_1030, ['Ross']);
  const l = nowLanding(root, ctx, SAT_1030);
  assert.equal(l.kind, 'card');
  assert.equal(artistOf(l), 'Milli Meng', 'his must-less best: Milli Meng (3) over Galen (1); Fcukers is at 1 AM');
  assert.equal(roomOfCard(l.card), 'Afters');
  assert.equal(l.line, null, 'a stack card: its NOW mark is the line');
  assert.equal(l.card.classList.contains('dim'), false, 'a highlighted card, never a dimmed one');
  root.remove();
});

test('Nhu highlighted: her MUST on the grid beats her afters pick — and it lands with the line', () => {
  const { root, ctx } = render(SAT_1030, ['Nhu']);
  const l = nowLanding(root, ctx, SAT_1030);
  assert.equal(artistOf(l), 'Soulwax', 'must (4) first, over Prospa (2) and Galen (2)');
  assert.ok(l.card.classList.contains('cell'), 'a grid cell');
  assert.equal(l.line, root.querySelector('.times-grid[data-iso="2026-09-26"] .now-line'), 'and the line it crosses comes with it');
  root.remove();
});

test('two people highlighted: the best live pick of either; equal levels go to the set that started most recently', () => {
  const { root, ctx } = render(SAT_1030, ['Ross', 'Nhu']);
  assert.equal(artistOf(nowLanding(root, ctx, SAT_1030)), 'Soulwax', 'Nhu’s must outranks Ross’s 3');
  root.remove();
  // Level ties: Prospa (Nhu 2, 9:45 PM, 45 minutes in) against Galen (Nhu 2,
  // ~10:30 PM, just on). "Where is Nhu right now" is the set that just began.
  const { root: r2, ctx: c2 } = render(SAT_1030, ['Nhu'], { picks: { Prospa: { Nhu: 2 }, Galen: { Nhu: 2 } } });
  assert.equal(artistOf(nowLanding(r2, c2, SAT_1030)), 'Galen', 'the one that started most recently');
  r2.remove();
});

test('a highlight with nothing live lands on the line, the dim rule untouched — and says it is no match', () => {
  const { root, ctx } = render(SAT_1030, ['Kevin']); // Kevin picked nothing
  const l = nowLanding(root, ctx, SAT_1030);
  assert.equal(l.kind, 'line');
  assert.equal(l.match, false, 'the line is what is on, not Kevin');
  assert.ok(root.querySelector('.card.dim'), 'everything Kevin did not pick is still dimmed');
  root.remove();
});

// The review's repro (2026-09-24): Sat 11:45 PM, Kevin highlighted with no
// picks — NOW landed on Parcels, dimmed, and pulsed it: "here", on the wrong
// answer. The landing may stay (it is what is on); the answer must say it is
// not a match, so the app neither pulses it nor lets it pass for Kevin's.
test('no match is said out loud: a highlight whose people have nothing on gets match:false; a real answer true; nobody null', () => {
  const at = pt('2026-09-26T23:45:00');
  const { root, ctx } = render(at, ['Kevin']);
  const l = nowLanding(root, ctx, at);
  assert.equal(l.kind, 'card');
  assert.equal(l.match, false);
  assert.ok(l.card.classList.contains('dim'), 'the card it lands on is not theirs — dimmed, as the highlight says');
  root.remove();
  const { root: r2, ctx: c2 } = render(SAT_1030, ['Ross']);
  assert.equal(nowLanding(r2, c2, SAT_1030).match, true, 'Milli Meng is Ross’s');
  r2.remove();
  const { root: r3, ctx: c3 } = render(SAT_1030);
  assert.equal(nowLanding(r3, c3, SAT_1030).match, null, 'nobody asked about anyone');
  r3.remove();
});

test('no line (the grid has closed), the afters running: NOW lands on the first NOW-marked card in wall order', () => {
  const at = pt('2026-09-26T23:45:00'); // Pier 80 closed at 11
  const { root, ctx } = render(at);
  assert.equal(root.querySelector('.now-line'), null, 'no line after the grid');
  const l = nowLanding(root, ctx, at);
  assert.equal(l.kind, 'card');
  assert.equal(l.card, root.querySelector('.venue-grid .card.now'), 'the first NOW card in the wall’s order');
  root.remove();
});

// The line stays drawn two rows past the grid's close, pinned to its bottom
// (nowOffsetPx) — but from 11:00 to 11:30 PM that is the bottom of a closed
// Pier 80 while the afters are on (review, 2026-09-24). The line answers only
// inside the grid's own hours; before doors, with nothing marked, it still
// does (the top of the grid: "doors soon").
test('just after the grid closes, the line is still drawn but the afters are the answer; before doors the line is', () => {
  const probe = render(SAT_1030);
  const g = probe.root.querySelector('.times-grid[data-iso="2026-09-26"]');
  const close = (Number(g.dataset.startRow) + Number(g.dataset.rows)) * 15;
  const doors = Number(g.dataset.startRow) * 15;
  probe.root.remove();
  const clock = (min) => pt(`2026-09-26T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`);
  for (const after of [10, 25]) {
    const at = clock(close + after);
    const { root, ctx } = render(at);
    assert.ok(root.querySelector('.times-grid[data-iso="2026-09-26"] .now-line'), `${after} min past close the line is still drawn`);
    const l = nowLanding(root, ctx, at);
    assert.equal(l.kind, 'card', `${after} min past close: a NOW card, not the bottom of the grid`);
    assert.equal(l.card, root.querySelector('.venue-grid[data-iso] .card.now'), 'the first in the wall’s order');
    root.remove();
  }
  const early = clock(doors - 20);
  const { root, ctx } = render(early);
  assert.ok(root.querySelector('.now-line'), 'twenty minutes before doors the line is drawn');
  assert.equal(root.querySelectorAll('.venue-grid .card.now').length, 0, 'and nothing is marked');
  assert.equal(nowLanding(root, ctx, early).kind, 'line', 'so the top of the grid is the answer');
  root.remove();
});

test('outside the live window there is no NOW: a Saturday morning, a week early, a lineup fest with no clock', () => {
  for (const at of [pt('2026-09-26T09:00:00'), pt('2026-09-19T22:30:00')]) {
    const { root, ctx } = render(at);
    assert.equal(nowLanding(root, ctx, at), null, `nothing live at ${at.toISOString()}`);
    root.remove();
  }
  state.FESTIVALS['lineup-now'] = { id: 'lineup-now', name: 'Lineup Now', status: 'lineup', artists: [{ name: 'Solo', day: 'Saturday' }] };
  state.setActiveFestivalId('lineup-now');
  const { root, ctx } = render(SAT_1030, [], { fid: 'lineup-now', picks: {} });
  assert.equal(nowLanding(root, ctx, SAT_1030), null, 'no clock, nothing live');
  root.remove();
  state.setActiveFestivalId('portola-2026');
});

test('the ticker is enough: as the line and the marks move, NOW’s answer follows without a repaint', () => {
  const { root, ctx } = render(pt('2026-09-26T09:00:00'));
  assert.equal(nowLanding(root, ctx, pt('2026-09-26T09:00:00')), null);
  const later = SAT_1030;
  positionNowLines(root, later);
  positionNowMarks(root, later);
  const l = nowLanding(root, ctx, later);
  assert.equal(l && l.kind, 'line', 'the same wall, ticked into the evening');
  root.remove();
});

test('past midnight is still Saturday night: Ross at 1:15 AM lands on his must in SAT AFTERS', () => {
  const at = pt('2026-09-27T01:15:00'); // the calendar says Sunday; the festival night says Saturday
  const { root, ctx } = render(at, ['Ross']);
  const l = nowLanding(root, ctx, at);
  assert.equal(artistOf(l), 'Fcukers', 'his must, playing at ~1 AM');
  assert.equal(l.card.closest('.day-block').dataset.day, 'Saturday', 'under Saturday, where the night belongs');
  assert.equal(l.line, null);
  root.remove();
});

// ---- tap after tap: the stops (Kevin, 2026-09-24) ---------------------------------
// "multiple taps … should move the user to the next now item if there are
// multiple at different heights on the page. if filtered to a person it
// should only go to nows for that person … by height because if items are
// side by side multiple now clicks won't scroll that that'll be weird."
// jsdom lays nothing out, so the wall's geometry is handed in: a phone-ish
// layout where the now line sits at y 1000, the first row of afters venues
// (two venues a row) at 2000, the next at 2600, and so on; each stack card is
// 150px tall with 10px between. What a person can see is 40 → 800.
const layout = (root, { band = { top: 40, bottom: 800 }, scrollY = 0, perRow = 2, across = false } = {}) => {
  const box = new Map();
  const line = root.querySelector('.times-grid .now-line');
  if (line) box.set(line, { top: 1000, bottom: 1002, left: 60 });
  let y = 2000;
  for (const vg of root.querySelectorAll('.venue-grid[data-iso]')) {
    const groups = [...vg.querySelectorAll('.venue-group')];
    const rows = Math.ceil(groups.length / perRow);
    groups.forEach((g, i) => {
      const top = y + Math.floor(i / perRow) * 600;
      [...g.querySelectorAll('.card')].forEach((c, k) => box.set(c, { top: top + k * 160, bottom: top + k * 160 + 150, left: 16 + (i % perRow) * 180 }));
    });
    y += rows * 600 + 200;
  }
  // Grid cells cross the line: a cell's top a little above it. With `across`,
  // they sit in their columns of a phone's sideways-scrolling grid (176px
  // columns, 4px apart, a 322px window at x 56 scrolled to 0, 584px of scroll).
  if (line) {
    for (const c of line.closest('.times-grid').querySelectorAll('.card')) {
      const left = across ? 56 + (Number(c.style.gridColumn) - 1) * 180 : 60;
      box.set(c, { top: 940, bottom: 1060, left, right: left + 176 });
    }
  }
  const geo = { scrollY, maxY: 100000, band: () => band, box: (el) => box.get(el) || { top: 0, bottom: 0, left: 0, right: 0 } };
  if (across && line) {
    const el = line.closest('.times-scroll');
    geo.scroller = (cell) => (cell.closest('.times-scroll') === el ? { el, x: 56, left: 0, width: 322, max: 584 } : null);
  }
  return geo;
};
const namesOf = (stop) => stop.members.map((m) => (m.card ? m.card.dataset.artist : 'LINE'));

test('stops, nobody highlighted: the line, then each row of afters top to bottom — side-by-side cards are one stop', () => {
  const { root, ctx } = render(SAT_1030);
  const plan = nowStops(root, ctx, SAT_1030, layout(root));
  assert.ok(plan.stops.length >= 3, `the line and at least two rows: ${plan.stops.map(namesOf).join(' / ')}`);
  assert.deepEqual(namesOf(plan.stops[0]), ['LINE'], 'the line first — it is highest');
  assert.equal(plan.bestAt, 0, 'and it is the first tap’s answer');
  const targets = plan.stops.map((st) => st.target);
  assert.deepEqual(targets, [...targets].sort((x, y) => x - y), 'top to bottom');
  for (let i = 1; i < targets.length; i++) assert.ok(targets[i] - targets[i - 1] > 400, 'every next stop really moves the page');
  // Two venues a row: the first row's live cards are one stop.
  const all = [...root.querySelectorAll('.venue-grid[data-iso] .card.now')];
  assert.equal(plan.stops.reduce((n, st) => n + st.members.filter((m) => m.card).length, 0), all.length, 'every NOW card is somewhere, once');
  assert.ok(plan.stops.some((st) => st.members.length > 1), 'and side by side is one stop, not two taps that go nowhere');
  root.remove();
});

test('stops fold together whatever one landing already shows — a tall window is one stop', () => {
  const { root, ctx } = render(SAT_1030);
  const tall = nowStops(root, ctx, SAT_1030, layout(root, { band: { top: 40, bottom: 20000 } }));
  assert.equal(tall.stops.length, 1, 'everything is on screen at once: one stop, a repeat tap pulses in place');
  root.remove();
});

test('stops with a highlight are that person’s live picks only; the first tap’s answer is the best of them', () => {
  const { root, ctx } = render(SAT_1030, ['Nhu']);
  const plan = nowStops(root, ctx, SAT_1030, layout(root));
  const names = plan.stops.flatMap(namesOf);
  assert.deepEqual(names.sort(), ['Galen', 'Prospa', 'Soulwax'], 'Soulwax and Prospa on the grid, Galen at the Great Northern — nothing else');
  assert.deepEqual(namesOf(plan.stops[0]).sort(), ['Prospa', 'Soulwax'], 'both grid picks cross one line: one stop');
  assert.equal(plan.bestAt, 0, 'the must (Soulwax) is the first answer');
  assert.equal(plan.best.card.dataset.artist, 'Soulwax');
  assert.deepEqual(namesOf(plan.stops[1]), ['Galen'], 'then down to the afters');
  root.remove();
});

test('stops for a highlight with nothing on are every live thing, as for nobody — and the answer says no match', () => {
  const { root, ctx } = render(SAT_1030, ['Kevin']);
  const plan = nowStops(root, ctx, SAT_1030, layout(root));
  const { root: r2, ctx: c2 } = render(SAT_1030);
  const nobody = nowStops(r2, c2, SAT_1030, layout(r2));
  assert.equal(plan.best.match, false);
  assert.deepEqual(plan.stops.map(namesOf), nobody.stops.map(namesOf), 'the same stops anyone gets');
  root.remove(); r2.remove();
});

test('stops after the grid closes: the afters only, first NOW card first; before doors: the line alone', () => {
  const late = pt('2026-09-26T23:10:00');
  const { root, ctx } = render(late);
  const plan = nowStops(root, ctx, late, layout(root));
  assert.ok(plan.stops.every((st) => st.members.every((m) => m.card)), 'no line stop: it sits on a closed grid');
  assert.equal(plan.best.card, root.querySelector('.venue-grid[data-iso] .card.now'));
  assert.ok(plan.stops[plan.bestAt].keys.includes(plan.best.key));
  root.remove();
  const probe = render(SAT_1030).root;
  const doors = Number(probe.querySelector('.times-grid[data-iso="2026-09-26"]').dataset.startRow) * 15;
  probe.remove();
  const early = pt(`2026-09-26T${String(Math.floor((doors - 20) / 60)).padStart(2, '0')}:${String((doors - 20) % 60).padStart(2, '0')}:00`);
  const { root: r2, ctx: c2 } = render(early);
  const pre = nowStops(r2, c2, early, layout(r2));
  assert.deepEqual(pre.stops.map(namesOf), [['LINE']], 'twenty minutes before doors: the top of the grid, nothing else');
  r2.remove();
});

test('stops are read off the wall at the tap: the ticker moves them, nothing is remembered', () => {
  const { root, ctx } = render(pt('2026-09-26T09:00:00'));
  assert.equal(nowStops(root, ctx, pt('2026-09-26T09:00:00'), layout(root)), null, 'a morning: nothing live, no stops');
  positionNowLines(root, SAT_1030);
  positionNowMarks(root, SAT_1030);
  const plan = nowStops(root, ctx, SAT_1030, layout(root));
  assert.ok(plan && plan.stops.length >= 2, 'the same wall, ticked into the evening, has its stops');
  root.remove();
});

// The review's finding (2026-09-24): by height alone, all of a highlighted
// person's live grid picks were one stop, so on a phone a pick in another
// column was never slid into view. Across counts too: a stop frames its cells
// in one sideways slide, and a cell that does not fit beside them is its own
// stop at the same height, ordered left to right.
test('stops across: live picks in columns that do not fit a phone together are stops of their own, at one height, left to right', () => {
  const at7 = pt('2026-09-26T19:00:00');
  const { root, ctx } = render(at7, ['Nhu'], { picks: { 'DJ Shadow': { Nhu: 2 }, Despacio: { Nhu: 4 } } });
  const cols = Object.fromEntries(['DJ Shadow', 'Despacio'].map((a) => [a, Number(root.querySelector(`.times-grid .card.cell[data-artist="${a}"]`).style.gridColumn)]));
  assert.ok(cols.Despacio - cols['DJ Shadow'] >= 2, `columns apart: ${JSON.stringify(cols)}`);
  const plan = nowStops(root, ctx, at7, layout(root, { across: true }));
  assert.deepEqual(plan.stops.map(namesOf), [['DJ Shadow'], ['Despacio']], 'two stops, left to right');
  assert.equal(plan.stops[0].target, plan.stops[1].target, 'at one height: the move between them is the slide');
  assert.equal(plan.best.card.dataset.artist, 'Despacio', 'the must is the first answer');
  assert.equal(plan.bestAt, 1);
  const [a, b] = plan.stops;
  assert.ok(a.slide < b.slide, `each frames its own column: ${a.slide} / ${b.slide}`);
  for (const st of plan.stops) {
    assert.ok(st.frame.lo >= st.slide + 8 - 1 && st.frame.hi <= st.slide + 322 - 8 + 1 || st.slide === 584, `the slide shows the whole cell: ${JSON.stringify({ lo: st.frame.lo, hi: st.frame.hi, slide: st.slide })}`);
  }
  root.remove();
  // Nobody highlighted: the line is one stop whatever the columns — it crosses them all.
  const { root: r2, ctx: c2 } = render(at7);
  const open = nowStops(r2, c2, at7, layout(r2, { across: true }));
  assert.equal(open.stops.filter((st) => st.members.some((m) => !m.card)).length, 1, 'one line stop');
  assert.equal(open.stops[0].frame, null, 'and it slides nothing');
  r2.remove();
});

test('stops across: two picks that fit one window side by side share a stop and its slide', () => {
  // At 1280 the grid shows every column: nothing is out of frame.
  const { root, ctx } = render(SAT_1030, ['Nhu']);
  const geo = layout(root, { across: true });
  const el = root.querySelector('.times-grid .now-line').closest('.times-scroll');
  geo.scroller = (cell) => (cell.closest('.times-scroll') === el ? { el, x: 56, left: 0, width: 1100, max: 0 } : null);
  const plan = nowStops(root, ctx, SAT_1030, geo);
  assert.deepEqual(plan.stops.map(namesOf).map((n) => n.sort()), [['Prospa', 'Soulwax'], ['Galen']], 'Soulwax and Prospa together, then the afters');
  assert.equal(plan.stops[0].slide, 0);
  // At 390 the same two columns (2 x 176px) do not fit a 322px window: two stops.
  const phone = nowStops(root, ctx, SAT_1030, layout(root, { across: true }));
  assert.deepEqual(phone.stops.map(namesOf), [['Soulwax'], ['Prospa'], ['Galen']], 'across, then down');
  root.remove();
});

// ---- the next tap: where the last one left the page (wall.js nowStep) -------------
// A tap's cycle names the grid it slid by its DAY, never by the node: the 25 s
// poll (or any pick) repaints the wall and replaces every scroller. The first
// cut held the node, and a detached node read as "unchanged" forever — so
// after one repaint a sideways hand scroll no longer made the next tap fresh
// (Codex, 2026-09-24). Nhu at 7 PM on a phone: DJ Shadow and Despacio, three
// columns apart.
test('the next tap across a repaint: a page nobody moved keeps its cycle; a sideways hand scroll, or a grid that is gone, makes it fresh', () => {
  const at7 = pt('2026-09-26T19:00:00');
  const picks = { 'DJ Shadow': { Nhu: 2 }, Despacio: { Nhu: 4 } };
  const { root, ctx } = render(at7, ['Nhu'], { picks });
  const geo = { ...layout(root, { across: true }), now: 0, gridLeft: () => null };
  const first = nowStep(nowStops(root, ctx, at7, geo), null, geo);
  assert.equal(first.fresh, true);
  assert.deepEqual(namesOf(first.stop), ['Despacio'], 'the must first');
  assert.equal(first.stop.frame.iso, '2026-09-26', 'its frame names its grid by day');
  const cycle = { lead: first.lead.key, y: first.target, grid: first.stop.frame.iso, sl: first.stop.slide, until: 0 };
  const slidScroller = root.querySelector('.times-grid[data-iso="2026-09-26"]').closest('.times-scroll');
  root.remove();
  // The wall repaints: every node is new, and the grid's scroll is put back.
  const { root: again } = render(at7, ['Nhu'], { picks });
  assert.notEqual(again.querySelector('.times-grid[data-iso="2026-09-26"]').closest('.times-scroll'), slidScroller, 'the scroller the first tap slid is gone');
  const here = (left) => ({ ...layout(again, { across: true }), scrollY: cycle.y, now: 0, gridLeft: (iso) => (iso === '2026-09-26' ? left : null) });
  const plan = (g) => nowStops(again, ctx, at7, g);
  const unmoved = here(cycle.sl);
  assert.equal(stillThere(cycle, unmoved), true, 'nobody moved the page: still there');
  assert.deepEqual(namesOf(nowStep(plan(unmoved), cycle, unmoved).stop), ['DJ Shadow'], 'so the next tap goes on to the next stop');
  const swiped = here(110); // the hand swipes the new grid back to DJ Shadow's column
  assert.equal(stillThere(cycle, swiped), false, 'the new grid moved: not where NOW left it');
  const fresh = nowStep(plan(swiped), cycle, swiped);
  assert.equal(fresh.fresh, true);
  assert.deepEqual(namesOf(fresh.stop), ['Despacio'], 'a fresh "take me to now": the best answer again');
  const gone = { ...here(cycle.sl), gridLeft: () => null }; // its day hidden: no such grid
  assert.equal(stillThere(cycle, gone), false, 'a grid that is gone ends the cycle');
  // A glide still on its way holds the cycle whatever the page reads.
  assert.equal(stillThere({ ...cycle, until: 100 }, { ...swiped, now: 50 }), true, 'mid-glide: still going there');
  assert.equal(stillThere(null, unmoved), false, 'no last tap, nothing to continue');
  again.remove();
});

// The one stop, tapped again, stays put — but only while it still shows the
// stop. Codex's case (2026-09-24): 320x568, the festival's room only; a tap at
// 3 PM, a tap at 7 PM. The page never moved, so the cycle held, and the old
// landing stood while the line had walked 384px down the grid (198 → 582, the
// dock's top at 523). A phone's geometry here: the band under the rail and the
// stage strip down to the dock; the line at page y 1000 at 3 PM.
test('one stop, tapped again: it stays while its landing still shows it; once the clock walks it off screen, the tap brings it back', () => {
  const at3 = pt('2026-09-26T15:00:00');
  const at7 = pt('2026-09-26T19:00:00');
  const { root, ctx } = render(at3, [], { folded: ['Afters'] });
  const line = root.querySelector('.times-grid[data-iso="2026-09-26"] .now-line');
  const band = { top: 150, bottom: 523 };
  const phone = (lineY, scrollY) => ({
    scrollY, maxY: 100000, now: 0, gridLeft: () => null, band: () => band,
    box: (el) => (el === line ? { top: lineY - scrollY, bottom: lineY - scrollY + 2, left: 60, right: 380 } : { top: 0, bottom: 0, left: 0, right: 0 }),
  });
  const g3 = phone(1000, 0);
  const plan3 = nowStops(root, ctx, at3, g3);
  assert.deepEqual(plan3.stops.map(namesOf), [['LINE']], 'at 3 PM only the line is live: one stop');
  const first = nowStep(plan3, null, g3);
  const third = band.top + (band.bottom - band.top) / 3;
  assert.ok(Math.abs(1000 - first.target - third) < 1, 'the first tap puts the line a third of the way down');
  const cycle = { lead: first.lead.key, y: first.target, grid: null, sl: 0, until: 0 };
  // A minute later, the page untouched: the line moved 1.6px — still shown, so the tap stays.
  const at301 = pt('2026-09-26T15:01:00');
  positionNowLines(root, at301);
  const g301 = phone(1001.6, first.target);
  assert.equal(nowStep(nowStops(root, ctx, at301, g301), cycle, g301).target, cycle.y, 'still showing it: the repeat tap stays (and pulses in place)');
  // 7 PM, the page untouched: four hours down the grid, under the dock.
  positionNowLines(root, at7);
  positionNowMarks(root, at7);
  const g7 = phone(1000 + 384, first.target);
  assert.ok(g7.box(line).top > band.bottom, `the line walked off screen: ${g7.box(line).top}px, the dock at ${band.bottom}`);
  const plan7 = nowStops(root, ctx, at7, g7);
  assert.equal(plan7.stops.length, 1, 'still one stop');
  const next = nowStep(plan7, cycle, g7);
  assert.equal(next.fresh, false, 'the page is where NOW left it — it is the same stop, tapped again');
  assert.notEqual(next.target, cycle.y, 'but the old landing no longer shows it: the tap moves');
  assert.ok(Math.abs(1384 - next.target - third) < 1, `the line comes back a third of the way down: ${1384 - next.target}`);
  root.remove();
});

// ---- what may pulse when the glide lands (wall.js nowPulseable) -------------------
// The pulse waits for the glide, and the wall can change under it. Codex's case
// (2026-09-24): Ross highlighted, NOW gliding to Milli Meng, and the poll
// brings Ross's un-pick of it — the repaint dims the fresh card, and the pulse
// found that fresh card by name and pulsed it anyway: "Ross is here", on a card
// he had just left. What pulses is decided again when it lands, by the rule
// that chose it.
test('what may pulse is decided again when the glide lands: a dropped pick, a new highlight, or a set that ended no longer answers', () => {
  const { root, ctx } = render(SAT_1030, ['Ross']);
  const plan = nowStops(root, ctx, SAT_1030, layout(root));
  assert.equal(plan.best.match, true);
  const milli = plan.best.card;
  assert.equal(milli.dataset.artist, 'Milli Meng');
  assert.ok(nowPulseable(root, ctx, SAT_1030, true).includes(milli), 'at the tap, his pick answers');
  const identity = { artist: milli.dataset.artist, occ: JSON.parse(milli.dataset.occ), room: roomOf(milli) };
  root.remove();
  // Mid-glide the poll brings the un-pick; the wall repaints under the glide.
  const dropped = { ...ctx.picks, 'Milli Meng': { Ross: 0 } };
  const { root: after, ctx: c2 } = render(SAT_1030, ['Ross'], { picks: dropped });
  const fresh = cardFor(after, identity.artist, identity.occ, { room: identity.room });
  assert.ok(fresh && fresh.classList.contains('dim'), 'the fresh card stands where the old one was, dimmed');
  assert.equal(nowPulseable(after, c2, SAT_1030, true).includes(fresh), false, 'it no longer answers: no pulse');
  assert.ok(nowPulseable(after, c2, SAT_1030, true).some((c) => c.dataset.artist === 'Galen'), 'his other live pick still would');
  after.remove();
  // Nobody highlighted at the tap (the NOW cards pulse) — then someone is:
  // a card pulsing now would read as theirs.
  const { root: open, ctx: c3 } = render(SAT_1030);
  const marks = nowPulseable(open, c3, SAT_1030, null);
  assert.ok(marks.length > 1 && marks.every((c) => c.classList.contains('now')), 'nobody highlighted: the NOW cards');
  assert.deepEqual(nowPulseable(open, { ...c3, filterPeople: ['Kat'] }, SAT_1030, null), [], 'a highlight arrived mid-glide: nothing');
  assert.deepEqual(nowPulseable(open, c3, SAT_1030, false), [], 'no match never pulses');
  open.remove();
  // The clock: the set ended while the page glided.
  const { root: late, ctx: c4 } = render(SAT_1030, ['Ross']);
  const card = nowPulseable(late, c4, SAT_1030, true).find((c) => c.dataset.artist === 'Milli Meng');
  const end = new Date(SAT_1030.getTime() + (Number(card.dataset.nowTo) - Number(card.dataset.nowFrom)) * 60000 + 3600000);
  positionNowMarks(late, end);
  assert.equal(nowPulseable(late, c4, end, true).includes(card), false, 'a set that has ended does not answer');
  late.remove();
});

// One show billed to two rooms — Horse Meat Disco, Friday, "Afters & Folsom" —
// renders a card in each (one occurrence, byte-identical data-occ; one pick
// key). The cycle landed on it twice (the phone walk, 2026-09-24: Fri 11:30 PM,
// taps 1 and 3). One show is one member; the first in wall order stands for it.
test('stops: a show that renders in two rooms is one stop member, not two taps', () => {
  const at = pt('2026-09-25T23:30:00');
  for (const people of [[], ['Ross']]) {
    const { root, ctx } = render(at, people, people.length ? { picks: { 'Horse Meat Disco': { Ross: 4 } } } : {});
    const hmd = [...root.querySelectorAll('.venue-grid[data-iso] .card.now')].filter((c) => c.dataset.artist === 'Horse Meat Disco');
    assert.equal(hmd.length, 2, 'two cards, one in each room');
    assert.equal(hmd[0].dataset.occ, hmd[1].dataset.occ, 'one occurrence');
    assert.notEqual(roomOf(hmd[0]), roomOf(hmd[1]), 'two rooms');
    const plan = nowStops(root, ctx, at, layout(root));
    const members = plan.stops.flatMap((st) => st.members.filter((m) => m.card));
    const shows = members.map((m) => `${m.card.dataset.artist}|${m.card.dataset.occ}`);
    assert.equal(new Set(shows).size, shows.length, `no show is a member twice (${people.join(',') || 'nobody'})`);
    const it = members.filter((m) => m.card.dataset.artist === 'Horse Meat Disco');
    assert.equal(it.length, 1, 'Horse Meat Disco once');
    assert.equal(it[0].card, hmd[0], 'the first in wall order');
    if (people.length) assert.equal(plan.best.card, hmd[0], 'and it is the answer the first tap lands on');
    root.remove();
  }
});

// ---- what NOW says (wall.js nowSaid) ----------------------------------------------
// Codex (2026-09-24): NOW announced nothing — the page moved under a screen
// reader in silence. The app puts this in a polite status region.
test('what NOW says: the line’s time and what crosses it, cards by name and place, which stop of how many', () => {
  const { root, ctx } = render(SAT_1030);
  const plan = nowStops(root, ctx, SAT_1030, layout(root));
  const n = plan.stops.length;
  const said = plan.stops.map((st) => nowSaid(plan, st));
  assert.match(said[0], /^Now, 10:30 PM\. Playing now: /, 'the line: its time, then the sets crossing it');
  assert.ok(said[0].includes('Soulwax at Crane Stage') && said[0].includes('Prospa at Warehouse'), said[0]);
  assert.ok(said[0].endsWith(` 1 of ${n}.`), 'and which stop, so a repeat tap has somewhere to go');
  assert.ok(said.slice(1).every((s, i) => s.startsWith('Playing now: ') && s.endsWith(` ${i + 2} of ${n}.`)), JSON.stringify(said));
  assert.ok(said.some((s) => s.includes('Milli Meng at Public Works')), 'a stack card is named with its venue');
  root.remove();
  const { root: r2, ctx: c2 } = render(SAT_1030, ['Ross']);
  const ross = nowStops(r2, c2, SAT_1030, layout(r2));
  assert.equal(nowSaid(ross, ross.stops[ross.bestAt]), 'Playing now: Milli Meng at Public Works. 1 of 2.', '“where is Ross right now”, out loud');
  r2.remove();
  // One stop: no "1 of 1". Before doors, nothing crosses the line: just the time.
  const { root: r3, ctx: c3 } = render(SAT_1030);
  const tall = nowStops(r3, c3, SAT_1030, layout(r3, { band: { top: 40, bottom: 20000 } }));
  assert.equal(tall.stops.length, 1);
  assert.ok(!/ of \d+\.$/.test(nowSaid(tall, tall.stops[0])), nowSaid(tall, tall.stops[0]));
  r3.remove();
  const probe = render(SAT_1030).root;
  const doors = Number(probe.querySelector('.times-grid[data-iso="2026-09-26"]').dataset.startRow) * 15;
  probe.remove();
  const hh = Math.floor((doors - 20) / 60);
  const mm = (doors - 20) % 60;
  const early = pt(`2026-09-26T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
  const { root: r4, ctx: c4 } = render(early);
  const pre = nowStops(r4, c4, early, layout(r4));
  assert.equal(nowSaid(pre, pre.stops[0]), `Now, ${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}.`, 'before doors: the time, and nothing claimed');
  r4.remove();
});

test('what NOW says names one show once, even where it renders in two rooms', () => {
  const a = document.createElement('div');
  a.className = 'card';
  a.dataset.artist = 'Horse Meat Disco';
  a.dataset.occ = JSON.stringify({ day: 'Afters & Folsom', venue: 'The Midway' });
  const b = a.cloneNode(true);
  const stop = { members: [{ card: a, line: null }, { card: b, line: null }] };
  assert.equal(nowSaid({ stops: [stop] }, stop), 'Playing now: Horse Meat Disco at The Midway.');
});
