// The stage strip follows its grid (wall.js followStrip). Where the engine has
// scroll timelines it rides the grid's timeline as a CSS animation; everywhere
// else a transform follows the grid's scroll event. Two rules live here:
//   · the timeline is taken wherever the engine HAS one — under Reduce Motion
//     and Low Power too (2026-09-23). Tracking a finger is direct
//     manipulation, not decoration, and the transform route trails the grid
//     by a frame on a phone. The motion kill rules would still freeze the
//     follow (their `animation` shorthand resets `animation-timeline`), so
//     v3.css out-ranks them for the follow alone, from `--strip-tl`; that the
//     names really move under Low Power is the browser contract's job
//     (tests/browser/strip-follow.test.mjs). The choice is still made per
//     render.
//   · a render owns what it wires beyond its own nodes — the size observers
//     and the timeline names on the scope — and the next render undoes them.
//     They used to pile up: one more observer and one more name on #wall-root
//     per repaint of a classic scheduled wall.
// jsdom has no ScrollTimeline, so the engine is declared here before wall.js
// loads (it decides once whether the engine has timelines).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.cancelAnimationFrame = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
dom.window.ScrollTimeline = function ScrollTimeline() {};
// The strips' size observers, one per render. wall.js also keeps ONE observer
// for the module's life that watches cards (the corners' fit, watchFit) — it
// is not a strip's and is not counted here.
const observing = new Set();
globalThis.ResizeObserver = class {
  observe(el) { if (!(el.classList && el.classList.contains('card'))) observing.add(this); }
  unobserve() {}
  disconnect() { observing.delete(this); }
};

const state = await import('../js/state.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall } = await import('../js/v3/wall.js');

const FID = 'strip-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'scheduled' });
FESTIVALS[FID] = {
  id: FID, name: 'Strip Fest', status: 'scheduled',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2' } },
  artists: [{ name: 'One', day: 'Friday' }, { name: 'Two', day: 'Friday' }],
  days: { Friday: { stages: ['A', 'B', 'C'], artists: [
    { name: 'One', stage: 'A', time: '8:00 PM - 9:00 PM' },
    { name: 'Two', stage: 'C', time: '9:00 PM - 10:00 PM' },
  ] } },
};
state.activateCrew('stripfesttoken_0123456789', { v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } }, affinity: {} }, FID);

const root = document.getElementById('wall-root');
const ctx = (lowPower) => ({
  fid: FID, meName: 'Kevin', affinity: null, lowPower, sort: 'day', query: '', weekend: 'all',
  filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
  picks: {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null, onTap: () => {},
});
// What app.js applyLowPower does, then the repaint leaving Settings does.
const paint = (lowPower = false) => {
  document.body.classList.toggle('low-power', lowPower);
  renderWall(root, ctx(lowPower));
};
const stripRow = () => root.querySelector('.stage-strip .times-grid');
const lead = () => [...root.querySelectorAll('.times-scroll')].find((s) => !s.closest('.stage-strip'));
const names = (el) => ((el && el.style.timelineScope) || '').split(',').map((s) => s.trim()).filter(Boolean);
// The timeline is scoped on the nearest ancestor the strip and its grid
// share. Every day is its own `.tt-block` now (MODEL-V4 §1.3), so that is
// the block, not the wall.
const scope = () => root.querySelector('.tt-block');

// The name a row rides: a custom property, because the motion kill rules'
// `animation` shorthand resets `animation-timeline` — the CSS re-applies the
// follow from `--strip-tl` (v3.css), and the class says the row is on it.
const ridden = (row) => (row && row.classList.contains('rides') ? row.style.getPropertyValue('--strip-tl') : '');
const reducedMotion = (on) => {
  dom.window.matchMedia = (q) => ({ matches: on && /prefers-reduced-motion:\s*reduce/.test(q), addEventListener() {}, removeEventListener() {} });
};

test('where the engine has scroll timelines, the strip rides its grid\'s timeline', () => {
  paint(false);
  const row = stripRow();
  assert.ok(row, 'a classic scheduled wall has one stage strip');
  assert.match(ridden(row), /^--tt-\d+$/, 'the row is on a named timeline');
  assert.equal(lead().style.scrollTimeline, `${ridden(row)} x`, 'named on the grid it follows');
  assert.deepEqual(names(scope()), [ridden(row)], 'and scoped where both can see it');
  assert.equal(row.style.animation, '', 'the animation itself is the stylesheet\'s, so the kill rules can be out-ranked');
  assert.equal(root.querySelector('.stage-strip').dataset.follow, 'timeline', 'the route is written down for Diagnostics');
});

// A strip that tracks your finger is direct manipulation, not decorative
// motion (2026-09-23, Kevin's "stuttered delayed slide" note): the transform
// route trails the grid by a frame on a phone, and Reduce Motion / Low Power
// users need the stage names over the right columns as much as anyone. The
// timeline route is also the cheaper one — the compositor moves both.
test('under Low Power and under Reduce Motion the strip STILL rides the timeline', () => {
  paint(true);
  assert.match(ridden(stripRow()), /^--tt-\d+$/, 'Low Power: the timeline, not a transform trailing the grid');
  const grid = lead();
  grid.scrollLeft = 120;
  grid.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(stripRow().style.transform, '', 'no script moves the row — the timeline does');
  reducedMotion(true);
  try {
    paint(false);
    assert.match(ridden(stripRow()), /^--tt-\d+$/, 'Reduce Motion: the timeline too');
    paint(true);
    assert.match(ridden(stripRow()), /^--tt-\d+$/, 'both at once: the timeline');
  } finally {
    reducedMotion(false);
  }
});

test('each render undoes the last one\'s wiring: one observer and one timeline name, however many repaints', () => {
  for (let i = 0; i < 6; i++) paint(i % 2 === 0);
  assert.equal(observing.size, 1, 'the replaced walls\' size observers are disconnected');
  assert.deepEqual(names(scope()), [ridden(stripRow())], 'the day carries only the live strip\'s timeline');
});

// An engine without scroll timelines (iOS before 26, and jsdom as it ships)
// follows by a transform from the grid's scroll event — Low Power or not. The
// engine is asked once, when wall.js loads, so a second copy of the module is
// loaded here with ScrollTimeline taken away (the query string makes it a new
// module; state.js and the rest are shared).
test('an engine without scroll timelines follows by transform, under Low Power too', async () => {
  const had = dom.window.ScrollTimeline;
  delete dom.window.ScrollTimeline;
  let wall;
  try { wall = await import('../js/v3/wall.js?no-scroll-timeline'); } finally { dom.window.ScrollTimeline = had; }
  for (const lowPower of [false, true]) {
    document.body.classList.toggle('low-power', lowPower);
    wall.renderWall(root, ctx(lowPower));
    const row = stripRow();
    assert.equal(ridden(row), '', 'no timeline to ride');
    assert.equal(root.querySelector('.stage-strip').dataset.follow, 'transform');
    const grid = lead();
    grid.scrollLeft = 90;
    grid.dispatchEvent(new dom.window.Event('scroll'));
    assert.equal(row.style.transform, 'translateX(-90px)', `the stage names move with the columns (lowPower ${lowPower})`);
  }
  wall.renderWall(root, ctx(false)); // hand the wall back to a clean state
});
