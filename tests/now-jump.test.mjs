// NOW, the jump to what is playing (Kevin, 2026-09-24): "an option to the
// left of the days … if you tap it goes to now. A use case I'm thinking about
// is like 'where is ross likely right now' — tapping ross on the top to
// highlight him and then clicking something in the scroll-to-time bar."
//
// What NOW lands on is the wall's decision (wall.js nowLanding), read off the
// wall the person is looking at, with the festival's clock pinned here:
//   · nothing live (no now line, no NOW mark) → no NOW at all;
//   · no highlight → the now line, or — no line (Pier 80 closed, the afters
//     running) — the first NOW-marked card in wall order;
//   · a highlight → that person's pick that is playing now, grid cell or
//     stack card: the highest level first (must), then the earliest start;
//     none live → the line (or the first NOW card) as above, the highlight
//     still dimming the rest.
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
const { renderWall, nowLanding, positionNowLines, positionNowMarks } = await import('../js/v3/wall.js');

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

test('two people highlighted: the best live pick of either; equal levels go to whoever started first', () => {
  const { root, ctx } = render(SAT_1030, ['Ross', 'Nhu']);
  assert.equal(artistOf(nowLanding(root, ctx, SAT_1030)), 'Soulwax', 'Nhu’s must outranks Ross’s 3');
  root.remove();
  // Level ties: Prospa (Nhu 2, 9:45 PM) against Galen (Nhu 2, ~10:30 PM).
  const { root: r2, ctx: c2 } = render(SAT_1030, ['Nhu'], { picks: { Prospa: { Nhu: 2 }, Galen: { Nhu: 2 } } });
  assert.equal(artistOf(nowLanding(r2, c2, SAT_1030)), 'Prospa', 'the one that started first');
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
