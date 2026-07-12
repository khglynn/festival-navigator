// CORE-1/CORE-3 regression (jsdom): a single-card refresh must preserve every
// invariant the full render established — grid placement, lane split, the
// cell variant, and the time line. The original bug: refreshCard rebuilt the
// card bare, so non-topmost set-times cards auto-placed into a phantom column
// and visually vanished on tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderCard, refreshCard } = await import('../js/v3/wall.js');

FESTIVAL_INDEX.push({ id: 'test-fest', status: 'scheduled' });
const TOKEN = 'walltesttoken_0123456789';
state.activateCrew(TOKEN, {
  v: 4,
  meta: {},
  spotify: {},
  people: { Kevin: { colorIndex: 3 } },
  festivals: { 'test-fest': { selections: { GRiZ: { Kevin: 2 } } } },
  affinity: {},
});

const ctx = {
  fid: 'test-fest',
  meName: 'Kevin',
  picks: { GRiZ: { Kevin: 2 } },
  affinity: null,
  lowPower: true,
  onTap: () => {},
  onOpenNotes: null,
};

test('refreshCard preserves grid placement, lane split, and the time line', () => {
  const grid = document.createElement('div');
  const card = renderCard('GRiZ', ctx, { cell: true, time: '9:15 PM' });
  card.style.setProperty('grid-column', '3');
  card.style.setProperty('grid-row', '14 / span 5');
  card.style.setProperty('width', 'calc(50.000% - 2px)');
  card.style.setProperty('margin-left', '50.000%');
  card.style.setProperty('min-height', '0');
  grid.appendChild(card);
  // Compare against what the node actually stored (the engine may normalize
  // numeric serialization, e.g. 50.000% -> 50%).
  const props = ['grid-column', 'grid-row', 'width', 'margin-left', 'min-height'];
  const before = Object.fromEntries(props.map((p) => [p, card.style.getPropertyValue(p)]));
  assert.ok(before.width, 'precondition: width was set on the old card');

  const fresh = refreshCard(card, 'GRiZ', ctx);

  assert.equal(fresh.parentNode, grid, 'refreshed card stays in the grid');
  for (const p of props) assert.equal(fresh.style.getPropertyValue(p), before[p], p);
  assert.ok(fresh.classList.contains('cell'), 'cell variant survives');
  assert.equal(fresh.querySelector('.time')?.textContent, '9:15 PM', 'time line survives');
});

test('renderCard renders its time opt (CORE-3) and skips it when absent', () => {
  const timed = renderCard('GRiZ', ctx, { time: 'Tripolee · 9:15 PM' });
  assert.equal(timed.querySelector('.time')?.textContent, 'Tripolee · 9:15 PM');
  assert.ok(timed.classList.contains('timed'));
  const plain = renderCard('GRiZ', ctx);
  assert.equal(plain.querySelector('.time'), null);
});

test('refreshCard of a plain wall card stays plain', () => {
  const host = document.createElement('div');
  const card = renderCard('GRiZ', ctx);
  host.appendChild(card);
  const fresh = refreshCard(card, 'GRiZ', ctx);
  assert.ok(!fresh.classList.contains('cell'));
  assert.equal(fresh.querySelector('.time'), null);
  assert.equal(fresh.style.getPropertyValue('grid-column'), '');
});
