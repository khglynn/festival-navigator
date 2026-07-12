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
const { renderCard, refreshCard, renderWall } = await import('../js/v3/wall.js');

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

// ---- the scheduled wall's cross-day contract (Kevin notes 1/1.2, 2026-07-12) ----
// One sticky strip carries the stage names; every day renders on the SAME
// canonical column template; all horizontal scrollers mirror one position;
// short sets keep a readable floor; an empty day never mints a NaN grid.
test('scheduled wall: one strip, canonical columns, mirrored scroll, guarded edges', () => {
  state.FESTIVALS['test-fest'] = {
    id: 'test-fest', name: 'Test Fest',
    days: {
      Friday: {
        stages: ['Alpha', 'Beta'],
        artists: [
          { name: 'Shorty', stage: 'Alpha', time: '2:00 PM - 2:15 PM' },
          { name: 'Two', stage: 'Beta', time: '3:00 PM' },
        ],
      },
      Saturday: {
        stages: ['Beta', 'Gamma'],
        artists: [{ name: 'Three', stage: 'Gamma', time: '5:00 PM' }],
      },
      Sunday: { stages: ['Alpha'], artists: [] },
    },
  };
  state.setActiveFestivalId('test-fest');
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, ctx);

  const strips = root.querySelectorAll('.stage-strip');
  assert.equal(strips.length, 1, 'exactly one stage strip for the whole page');
  assert.deepEqual(
    [...strips[0].querySelectorAll('.stage-head')].map((h) => h.textContent),
    ['Alpha', 'Beta', 'Gamma'],
    'strip carries the canonical union in first-appearance order',
  );

  const templates = new Set([...root.querySelectorAll('.times-grid')]
    .map((g) => g.style.gridTemplateColumns));
  assert.equal(templates.size, 1, 'every grid shares one column template');

  // Gamma is Saturday's 2nd authored stage but canonical column 3 — the
  // whole point: same stage, same column, every day.
  assert.equal(root.querySelector('.card[data-artist="Three"]').style.gridColumn, '3');

  // A 15-minute set gets the 2-row display floor (name + time must fit;
  // centered content used to shave the name at less than that).
  assert.match(root.querySelector('.card[data-artist="Shorty"]').style.gridRow, /span 2$/);

  // Empty day: an honest line, never NaN/Infinity in a grid template.
  assert.ok(!root.innerHTML.includes('NaN') && !root.innerHTML.includes('Infinity'));
  assert.ok(root.textContent.includes('No set times for this day yet.'));

  // Scroll mirroring: scrolling any one scroller moves all of them.
  const scrollers = [...root.querySelectorAll('.times-scroll')];
  assert.equal(scrollers.length, 3, 'strip + Friday + Saturday (empty Sunday has none)');
  scrollers[1].scrollLeft = 120;
  scrollers[1].dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(scrollers[0].scrollLeft, 120, 'strip follows the day scroller');
  assert.equal(scrollers[2].scrollLeft, 120, 'sibling day follows too');

  root.remove();
});
