// Stacks under a clock line up with it (v90, Kevin at Portola, 2026-09-25):
// "Sometimes on the timelines we have times on the left, and the items that
// don't have them don't line up. I'd like them to line up vertically all the
// way down." A day's timetable starts its columns past the hour rail; the
// card stacks on that day (Skepta's cancelled card under Saturday's grid, SAT
// AFTERS) started at the shell's edge. wall.js tags every stack on a day that
// drew a clock — 'room' for the clock's own room, 'day' for the day's other
// rooms — and v3.css steps them in by the rail with the clock's track gap:
// the clock's own room at every width, the other rooms from 720 up (a phone's
// two columns fill the shell exactly, so the rail would cost SAT AFTERS a
// column). A day with no clock never carries the tag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall } = await import('../js/v3/wall.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' }, { id: 'unset-fest', status: 'scheduled' });
FESTIVALS['portola-2026'] = portola;
// A grid day with no set times yet: no clock is drawn, so its billed names
// have nothing to line up with.
FESTIVALS['unset-fest'] = {
  id: 'unset-fest', name: 'Unset Fest', status: 'scheduled', subtitle: 'The Field',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' } },
  artists: [{ name: 'Not Yet', day: 'Friday' }],
  days: { Friday: { stages: ['A', 'B'], artists: [] } },
};
const TOKEN = 'clockstackstoken_0123456789';
state.activateCrew(TOKEN, { v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { 'portola-2026': { selections: {} } }, affinity: {} }, 'portola-2026');

const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  renderWall(root, {
    fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
    picks: model.picksFor(state.crewDoc, fid), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {}, onTap: () => {},
    ...over,
  });
  return root;
};
// Every stack on the wall: which room, on which day, and its tag.
const stacks = (root) => [...root.querySelectorAll('.venue-grid')].map((g) => ({
  day: g.closest('.day-block').dataset.day,
  room: g.closest('.room').dataset.room,
  clock: g.dataset.clock || null,
}));

test('Portola: Saturday\'s cancelled Skepta lines up with the clock it belongs to, the afters and Folsom on a clock day are tagged, Thursday and Friday are not', () => {
  const all = stacks(render('portola-2026'));
  const on = (day, room) => all.filter((s) => s.day === day && s.room === room).map((s) => s.clock);
  // Saturday's festival room: the grid, then Skepta under Crane Stage.
  assert.deepEqual(on('Saturday', ':fest'), ['room'], 'the clock\'s own room');
  assert.ok(document.querySelector('.venue-grid[data-clock="room"] .card[data-artist="Skepta"]'), 'Skepta is the stack that moves');
  assert.deepEqual(on('Saturday', 'Afters'), ['day']);
  assert.deepEqual(on('Saturday', 'Folsom'), ['day']);
  assert.deepEqual(on('Sunday', 'Afters'), ['day']);
  // Sunday has everything on its grid: no stack in its festival room at all.
  assert.deepEqual(on('Sunday', ':fest'), []);
  // No clock on Thursday or Friday (other people's warehouses): as they were.
  for (const day of ['Thursday', 'Friday']) {
    const here = all.filter((s) => s.day === day);
    assert.ok(here.length, `${day} has stacks`);
    assert.ok(here.every((s) => s.clock === null), `${day}: no clock, no tag`);
  }
});

test('hiding the festival hides its clock, and the day\'s stacks go back to the shell\'s edge', () => {
  const all = stacks(render('portola-2026', { folded: [':fest'] }));
  const sat = all.filter((s) => s.day === 'Saturday');
  assert.ok(sat.length && sat.every((s) => s.room !== ':fest'), 'the festival room is gone');
  assert.ok(sat.every((s) => s.clock === null), 'nothing above them to line up with');
});

test('a grid day with no set times draws no clock, so its billed names are not stepped in', () => {
  const root = render('unset-fest');
  assert.equal(root.querySelectorAll('.times-rail').length, 0, 'no clock');
  const all = stacks(root);
  assert.equal(all.length, 1, 'the billed name is a stack');
  assert.equal(all[0].clock, null);
});

test('the CSS: one rail width and one track gap for the clock and every stack under it; another room steps in from 720 up only', () => {
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  const tokens = readFileSync(join(ROOT, 'assets/v3-tokens.css'), 'utf8');
  assert.match(tokens, /--hour-rail-w:\s*40px;/);
  assert.match(tokens, /--clock-gap:\s*4px;/);
  // The clock itself reads the tokens, so the stacks can never drift from it.
  assert.match(css, /\.times-rail \{[^}]*width: var\(--hour-rail-w\)[^}]*row-gap: var\(--clock-gap\)/);
  assert.match(css, /\.times-grid \{[^}]*gap: var\(--clock-gap\)/);
  assert.match(css, /\.strip-rail \{[^}]*width: var\(--hour-rail-w\)/);
  // The clock's own room: every width, outside any media block.
  const room = /(^|\n)\.venue-grid\[data-clock="room"\] \{([^}]*)\}/.exec(css);
  assert.ok(room, 'the room rule is at the top level');
  assert.match(room[2], /padding-inline-start: var\(--hour-rail-w\)/);
  assert.match(room[2], /column-gap: var\(--clock-gap\)/);
  // Another room: only inside a min-width 720 block.
  const day = /@media \(min-width: 720px\) \{\s*\.venue-grid\[data-clock="day"\] \{([^}]*)\}/.exec(css);
  assert.ok(day, 'the day rule lives under 720 and up');
  assert.match(day[1], /padding-inline-start: var\(--hour-rail-w\)/);
  assert.match(day[1], /column-gap: var\(--clock-gap\)/);
  assert.doesNotMatch(css.replace(day[0], ''), /data-clock="day"\]\s*\{/, 'and nowhere else');
});
