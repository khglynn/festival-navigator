// Everything of the festival's that is NOT on its grid lives in the
// festival's own room, under the grid, as venue groups (MODEL-V4 §1.3): a set
// whose stage is not a column, a name billed with no set time yet, and the
// day's activities. Electric Forest carries activities on every day — a
// 9:30 AM yoga beside 5 PM sets read wrong as a column on a clock its items
// were not on (Kevin, 2026-09-02: "a cards section with our header"). There
// is no "Everything else" heading any more: it is the same room, and an
// activity is a card like any other.
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
const { renderWall, computeTimesLayout } = await import('../js/v3/wall.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ef = JSON.parse(readFileSync(join(ROOT, 'data/festivals/electric-forest-2026.json'), 'utf8'));
FESTIVAL_INDEX.push({ id: 'electric-forest-2026', status: 'archived' }, { id: 'stray-fest', status: 'scheduled' }, { id: 'plain-fest', status: 'scheduled' });
FESTIVALS['electric-forest-2026'] = ef;
// A set on a stage that is not a column, and a day with nothing off the clock.
FESTIVALS['stray-fest'] = {
  id: 'stray-fest', name: 'Stray Fest', status: 'scheduled', subtitle: 'The Field', timezone: 'America/Chicago',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' }, Saturday: { wd: 'Sat', date: 'Oct 3', iso: '2026-10-03' } },
  artists: [{ name: 'One', day: 'Friday' }, { name: 'Secret Set', day: 'Friday' }, { name: 'Not Yet', day: 'Friday' }, { name: 'Two', day: 'Saturday' }],
  days: {
    Friday: { stages: ['A', 'B'], artists: [{ name: 'One', stage: 'A', time: '8:00 PM - 9:00 PM' }, { name: 'Secret Set', stage: 'Secret Stage', time: '9:30 PM - 10:30 PM' }] },
    Saturday: { stages: ['A', 'B'], artists: [{ name: 'Two', stage: 'B', time: '9:00 PM - 10:00 PM' }] },
  },
  activities: { Saturday: [{ name: 'Morning Yoga', time: '9:00 AM - 10:00 AM', venue: 'The Lawn' }, { name: 'Late Crafters', time: '2:00 AM - 5:00 AM', venue: 'The Brainery' }, { name: 'Sunrise Ceremony', time: '6:30 AM - 7:00 AM', venue: 'The Lawn' }] },
};
FESTIVALS['plain-fest'] = {
  id: 'plain-fest', name: 'Plain Fest', status: 'scheduled',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2' } },
  artists: [{ name: 'One', day: 'Friday' }],
  days: { Friday: { stages: ['A'], artists: [{ name: 'One', stage: 'A', time: '8:00 PM - 9:00 PM' }] } },
};
const TOKEN = 'festroomtoken_0123456789';
state.activateCrew(TOKEN, { v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { 'electric-forest-2026': { selections: {} } }, affinity: {} }, 'electric-forest-2026');

const ctxFor = (fid, over = {}) => ({
  fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
  filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
  picks: model.picksFor(state.crewDoc, fid), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {}, onTap: () => {},
  ...over,
});
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  renderWall(root, ctxFor(fid, over));
  return root;
};
// The festival room of each day, and what hangs off its grid.
const festRooms = (root) => [...root.querySelectorAll('.room[data-room=":fest"]')].map((room) => ({
  groups: [...room.querySelectorAll('.venue-group')].map((g) => ({
    venue: g.querySelector('.stage-head .label').textContent,
    cards: [...g.querySelectorAll('.stack > .card')].map((c) => ({
      name: c.dataset.artist,
      time: c.querySelector('.time')?.textContent,
      occ: c.dataset.occ ? JSON.parse(c.dataset.occ) : null,
    })),
  })),
}));

test('Electric Forest: every day\'s activities are venue groups under that day\'s grid, and each one is a card you can pick', () => {
  const root = render('electric-forest-2026');
  const days = Object.keys(ef.days);
  const rooms = festRooms(root);
  assert.equal(rooms.length, days.length, 'one festival room per day');
  days.forEach((d, i) => {
    const names = rooms[i].groups.flatMap((g) => g.cards.map((c) => c.name));
    assert.deepEqual(new Set(names), new Set(ef.activities[d].map((a) => a.name)), `${d}: every activity present, and nothing else`);
    assert.deepEqual(new Set(rooms[i].groups.map((g) => g.venue)), new Set(ef.activities[d].map((a) => a.venue)), `${d}: one group per place`);
  });
  // An activity is a card like any other — a pick key of its own, with the
  // day on its occurrence (MODEL-V4 §1.3; new keys are additive and safe).
  const one = root.querySelector('.venue-group .stack .card');
  assert.equal(one.getAttribute('role'), 'button');
  assert.equal(JSON.parse(one.dataset.occ).day, 'Day 1');
  assert.equal(root.querySelectorAll('.ee-col, .ee-item').length, 0, 'the quiet rows are gone with the heading');
  // No column is reserved for any of it: the strip names exactly the stages.
  const heads = [...root.querySelectorAll('.stage-strip .stage-head')].map((h) => h.textContent.trim());
  assert.ok(!heads.includes('EVERYTHING ELSE'), 'no muted head on the strip');
  const layout = computeTimesLayout(ef, null);
  assert.equal((layout.colsTemplate.match(/var\(--col-w\)/g) || []).length, layout.stages.length, 'columns are the stages, nothing more');
  assert.equal(root.querySelectorAll('.times-grid .venue-grid').length, 0, 'nothing off the clock inside a grid');
  // The groups sit AFTER the day's grid, inside the same room.
  const firstRule = root.querySelector('.day-rule');
  const firstGrid = root.querySelector('.tt-block');
  const firstGroups = root.querySelector('.venue-grid');
  assert.ok(firstRule.compareDocumentPosition(firstGrid) & 4 && firstGrid.compareDocumentPosition(firstGroups) & 4, 'rule, then grid, then the groups');
});

test('a set on a stage that is not a column is a card under that stage — its occurrence carries the stage for the zoom, its face the time', () => {
  const root = render('stray-fest');
  const rooms = festRooms(root);
  assert.deepEqual(rooms[0].groups, [
    {
      venue: 'Secret Stage',
      cards: [{ name: 'Secret Set', time: '9:30 – 10:30 PM', occ: { day: 'Friday', stage: 'Secret Stage', time: '9:30 PM - 10:30 PM', weekend: null, date: null, venue: 'Secret Stage' } }],
    },
    // Billed for the day with no set time yet: the place IS the festival's
    // site — it is not a show with nowhere to be, so it is never Venue TBA.
    // Its occurrence says so honestly: no room of its own, no date.
    {
      venue: 'The Field',
      cards: [{ name: 'Not Yet', time: undefined, occ: { day: 'Friday', stage: null, time: null, weekend: null, date: null, venue: null } }],
    },
  ]);
  assert.equal(root.querySelectorAll('.card[data-artist="Secret Set"]').length, 1, 'the stray renders once — under its place, not on the grid');
  // Saturday's activities, one group per place, each stack on the festival's
  // own clock: 9 AM opens the day, so a 2 AM crafter hour and a 6:30 AM
  // sunrise both belong to the tail of that night. One clock, every card.
  assert.deepEqual(rooms[1].groups, [
    { venue: 'The Lawn', cards: [
      { name: 'Morning Yoga', time: '9:00 – 10:00 AM', occ: { day: 'Saturday', stage: null, time: '9:00 AM - 10:00 AM', weekend: null, date: null, venue: 'The Lawn' } },
      { name: 'Sunrise Ceremony', time: '6:30 – 7:00 AM', occ: { day: 'Saturday', stage: null, time: '6:30 AM - 7:00 AM', weekend: null, date: null, venue: 'The Lawn' } },
    ] },
    { venue: 'The Brainery', cards: [
      { name: 'Late Crafters', time: '2:00 – 5:00 AM', occ: { day: 'Saturday', stage: null, time: '2:00 AM - 5:00 AM', weekend: null, date: null, venue: 'The Brainery' } },
    ] },
  ]);
});

test('a day with nothing off its grid has no groups', () => {
  const root = render('plain-fest');
  assert.deepEqual(festRooms(root).map((r) => r.groups.length), [0]);
});

test('the people filter reaches the festival room\'s groups like any stack: it dims, and never empties a room', () => {
  state.crewDoc.festivals['stray-fest'] = { selections: { 'Secret Set': { Kevin: 3 } } };
  const lit = (root) => [...root.querySelectorAll('.room[data-room=":fest"] .venue-group .card')].map((c) => [c.dataset.artist, !c.classList.contains('dim')]);
  let root = render('stray-fest', { filterPeople: ['Kevin'], picks: model.picksFor(state.crewDoc, 'stray-fest') });
  assert.deepEqual(lit(root).slice(0, 2), [['Secret Set', true], ['Not Yet', false]], 'a picked stray is lit, an unpicked one dimmed');
  root = render('stray-fest', { filterPeople: ['Nobody'], picks: model.picksFor(state.crewDoc, 'stray-fest') });
  assert.deepEqual(festRooms(root)[0].groups.map((g) => g.cards.length), [1, 1], 'every group keeps its cards');
  assert.ok(lit(root).every(([, on]) => !on), 'all dimmed');
  assert.equal(festRooms(root)[0].empty, null, 'and nothing says the room is empty');
});
