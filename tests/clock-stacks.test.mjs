// Stacks under a clock line up with it (v90, Kevin at Portola, 2026-09-25):
// "Sometimes on the timelines we have times on the left, and the items that
// don't have them don't line up. I'd like them to line up vertically all the
// way down." A day's timetable starts its columns past the hour rail; the
// card stacks on that day (Skepta's cancelled card under Saturday's grid, SAT
// AFTERS) started at the shell's edge. wall.js tags every stack on a day that
// drew a clock — 'room' for the clock's own room, 'day' for the day's other
// rooms — and v3.css steps them in by the rail with the clock's track gap:
// the clock's own room at every width, the other rooms from 720 up. On a
// phone (v91, 2026-09-25) a clocked row sits in its own sideways scroller,
// `.stack-scroll`, with the rail's 40px as lead space inside it: stepped in
// within the shell, two columns would only fit as one, so instead they keep
// their width, start at the clock's first column, and the lead scrolls away
// under a swipe (Kevin: "a little bit of extra padding that obviously scrolls
// away if you left scroll"). A day with no clock never carries the tag.
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

test('the CSS: one rail width and one track gap for the clock and every stack under it; another room steps in by padding from 720 up only', () => {
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

// ---- the phone's sideways row (v91) ------------------------------------------------

test('a clocked row sits in its own .stack-scroll, says how many venues it has, and is never a timetable scroller', () => {
  const root = render('portola-2026');
  const clocked = [...root.querySelectorAll('.venue-grid[data-clock]')];
  assert.ok(clocked.length >= 5, 'Saturday\'s leftovers, afters and Folsom, and Sunday\'s afters and Folsom');
  for (const g of clocked) {
    const row = g.parentElement;
    const where = `${g.closest('.day-block').dataset.day} ${g.closest('.room').dataset.room}`;
    assert.ok(row.classList.contains('stack-scroll'), `${where}: wrapped in its row`);
    assert.equal(row.children.length, 1, `${where}: the row holds the one grid`);
    assert.equal(row.parentElement, g.closest('.room'), `${where}: the row is the room's own child, under its head`);
    assert.equal(g.dataset.venues, String(g.querySelectorAll('.venue-group').length), `${where}: data-venues counts its venues`);
    assert.ok(!row.classList.contains('times-scroll') && !row.closest('.times-scroll') && !row.querySelector('.times-scroll'),
      `${where}: nothing that mirrors the timetable can take it for one`);
  }
  const sat = (room) => root.querySelector(`.day-block[data-day="Saturday"] .room[data-room="${room}"] .venue-grid`);
  assert.equal(sat(':fest').dataset.venues, '1', 'Skepta\'s Crane Stage: one venue, which fits beside the lead space');
  assert.ok(Number(sat('Afters').dataset.venues) > 2, 'SAT AFTERS wraps two across inside its row');
  // A day with no clock is exactly as it was: no row, no count.
  for (const g of root.querySelectorAll('.venue-grid:not([data-clock])')) {
    assert.ok(g.parentElement.classList.contains('room'), 'an unclocked grid is the room\'s own child');
    assert.equal(g.dataset.venues, undefined);
  }
  assert.equal(root.querySelectorAll('.stack-scroll').length, clocked.length, 'one row per clocked grid, and no other');
});

test('a repaint keeps each row where it was swiped, and nothing else moves it: not the timetable\'s position, not its neighbour\'s', () => {
  const rowOf = (root, day, room) => root.querySelector(`.day-block[data-day="${day}"] .room[data-room="${room}"] .stack-scroll`);
  const gridOf = (root, day) => root.querySelector(`.day-block[data-day="${day}"] .tt-block .times-wrap:not(.stage-strip) .times-scroll`);
  let root = render('portola-2026');
  rowOf(root, 'Saturday', 'Afters').scrollLeft = 38;
  gridOf(root, 'Saturday').scrollLeft = 120;
  // A crew-mate's pick arrives: the whole wall is replaced.
  root = render('portola-2026');
  assert.equal(rowOf(root, 'Saturday', 'Afters').scrollLeft, 38, 'SAT AFTERS is still swiped');
  assert.equal(rowOf(root, 'Saturday', 'Folsom').scrollLeft, 0, 'SAT FOLSOM never was');
  assert.equal(rowOf(root, 'Sunday', 'Afters').scrollLeft, 0, 'nor SUN AFTERS');
  assert.equal(rowOf(root, 'Saturday', ':fest').scrollLeft, 0, 'nor the clock\'s own leftovers');
  assert.equal(gridOf(root, 'Saturday').scrollLeft, 120, 'the timetable keeps its own position, as before');
  // The timetable's mirror (wall.js wireTimesScrollSync): Saturday's swipe
  // reaches Sunday's timetable and no stack row.
  const g = gridOf(root, 'Saturday');
  g.scrollLeft = 200;
  g.dispatchEvent(new window.Event('scroll'));
  assert.equal(gridOf(root, 'Sunday').scrollLeft, 200, 'the days mirror');
  for (const row of root.querySelectorAll('.stack-scroll')) {
    const where = `${row.closest('.day-block').dataset.day} ${row.closest('.room').dataset.room}`;
    assert.equal(row.scrollLeft, where === 'Saturday Afters' ? 38 : 0, `${where}: untouched by the timetable's swipe`);
  }
  // Hiding the festival takes the clock, and with it the row: the stacks go
  // back to the shell's edge, and no position is carried onto a bare grid.
  root = render('portola-2026', { folded: [':fest'] });
  assert.equal(root.querySelectorAll('.stack-scroll').length, 0);
});

test('the CSS: on a phone a clocked row scrolls sideways with the rail as lead space; from 720 up it is an ordinary box', () => {
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  const phone = /@media \(max-width: 719\.98px\) \{\s*\.stack-scroll \{([^}]*)\}\s*\.stack-scroll > \.venue-grid\[data-clock\] \{([^}]*)\}\s*\.stack-scroll > \.venue-grid\[data-clock\]\[data-venues="1"\] \{([^}]*)\}\s*\}/.exec(css);
  assert.ok(phone, 'the three phone rules, together, under 720');
  const [, row, grid, one] = phone;
  assert.match(row, /overflow-x: auto/);
  assert.match(row, /overflow-y: hidden/);
  assert.match(row, /padding-block: 8px; margin-block: -8px/, 'room for a NOW card\'s glow, taken back so nothing shifts');
  assert.match(grid, /width: max-content/);
  assert.match(grid, /grid-template-columns: repeat\(2, var\(--col-w\)\)/, 'two across at full --col-w, the one card width');
  assert.match(grid, /padding-inline-start: var\(--hour-rail-w\)/, 'the lead space is the clock\'s own rail');
  assert.match(grid, /column-gap: var\(--clock-gap\)/, 'and its track gap, so column two sits under column two');
  assert.match(one, /grid-template-columns: var\(--col-w\)/, 'one venue: one column, and nothing to scroll');
  // The row is inert everywhere else: no other rule names it (comments aside).
  const rules = css.split(phone[0]).join('').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(rules.includes('.stack-scroll'), false, '.stack-scroll is styled only in the phone block');
});
