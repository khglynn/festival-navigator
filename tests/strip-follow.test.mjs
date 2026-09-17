// The stage strip follows its grid (wall.js followStrip). Where the engine has
// scroll timelines it rides the grid's timeline as a CSS animation; everywhere
// else a transform follows the grid's scroll event. The rule here:
//   · the CSS follow is chosen only where CSS animations RUN. Low Power's
//     `.low-power * { animation: none !important }` kills it, and the venue
//     names froze above sliding columns (review, 2026-09-16). The choice is
//     made per render, and leaving Settings repaints the wall.
// jsdom has no ScrollTimeline, so the engine is declared here before wall.js
// loads (it decides once whether the engine has timelines). Whether the
// follow actually MOVES under Low Power is the browser contract's job
// (tests/browser/strip-follow.test.mjs).
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
const observing = new Set();
globalThis.ResizeObserver = class {
  observe() { observing.add(this); }
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
  filterPeople: [], soloStage: null, bucketsOff: [], now: new Date('2026-01-01T12:00:00'),
  picks: {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null, onSoloStage: () => {}, onTap: () => {},
});
// What app.js applyLowPower does, then the repaint leaving Settings does.
const paint = (lowPower = false) => {
  document.body.classList.toggle('low-power', lowPower);
  renderWall(root, ctx(lowPower));
};
const stripRow = () => root.querySelector('.stage-strip .times-grid');
const lead = () => [...root.querySelectorAll('.times-scroll')].find((s) => !s.closest('.stage-strip'));
const names = (el) => (el.style.timelineScope || '').split(',').map((s) => s.trim()).filter(Boolean);

test('where animations run, the strip rides its grid\'s scroll timeline', () => {
  paint(false);
  const row = stripRow();
  assert.ok(row, 'a classic scheduled wall has one stage strip');
  assert.match(row.style.animationTimeline, /^--tt-\d+$/, 'the row is on a named timeline');
  assert.equal(lead().style.scrollTimeline, `${row.style.animationTimeline} x`, 'named on the grid it follows');
  assert.deepEqual(names(root), [row.style.animationTimeline], 'and scoped where both can see it');
});

test('under Low Power the strip follows by transform — the CSS follow would be frozen', () => {
  paint(true);
  const row = stripRow();
  assert.equal(row.style.animationTimeline, '', 'no animation Low Power would kill');
  const grid = lead();
  grid.scrollLeft = 120;
  grid.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(row.style.transform, 'translateX(-120px)', 'the stage names move with the columns');
  paint(false);
  assert.match(stripRow().style.animationTimeline, /^--tt-\d+$/, 'and Low Power off takes the timeline again on the next render');
});
