// A day's "Everything else" is a SECTION under the grid, not a column on it
// (2026-09-02). Electric Forest carries activities on every day — a 9:30 AM
// yoga beside 5 PM sets read wrong as a column on a clock its items were not
// on (Kevin: "a cards section with our header — more standard"). The classic
// scheduled wall and the day-first wall render the same shape.
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
  id: 'stray-fest', name: 'Stray Fest', status: 'scheduled', timezone: 'America/Chicago',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' }, Saturday: { wd: 'Sat', date: 'Oct 3', iso: '2026-10-03' } },
  artists: [{ name: 'One', day: 'Friday' }, { name: 'Secret Set', day: 'Friday' }, { name: 'Two', day: 'Saturday' }],
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
const TOKEN = 'offclocktoken_0123456789';
state.activateCrew(TOKEN, { v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { 'electric-forest-2026': { selections: {} } }, affinity: {} }, 'electric-forest-2026');

const ctxFor = (fid, over = {}) => ({
  fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
  filterPeople: [], soloStage: null, bucketsOff: [], now: new Date('2026-01-01T12:00:00'),
  picks: model.picksFor(state.crewDoc, fid), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {}, onSoloStage: () => {}, onTap: () => {},
  ...over,
});
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  renderWall(root, ctxFor(fid, over));
  return root;
};
// The Everything else sections in document order, each with what follows it up to the next rule/section.
const sectionsOf = (root) => [...root.querySelectorAll('.sec-head')].filter((h) => h.querySelector('.sec-label').textContent === 'EVERYTHING ELSE').map((h) => {
  const cards = [], acts = [];
  for (let n = h.nextElementSibling; n && !n.classList.contains('sec-head') && !n.classList.contains('day-rule'); n = n.nextElementSibling) {
    cards.push(...[...n.querySelectorAll('.card')].map((c) => ({ name: c.dataset.artist, time: c.querySelector('.time')?.textContent, occ: c.dataset.occ ? JSON.parse(c.dataset.occ) : null })));
    acts.push(...[...n.querySelectorAll('.ee-item')].map((r) => r.querySelector('.ee-name').textContent));
  }
  return { sub: h.querySelector('.sec-sub').textContent, cards, acts };
});

test('Electric Forest: one section per day under its grid, every activity a quiet row in time order, no column and no muted head', () => {
  const root = render('electric-forest-2026');
  const days = Object.keys(ef.days);
  const secs = sectionsOf(root);
  assert.equal(secs.length, days.length, 'one Everything else per day (every EF day carries activities)');
  days.forEach((d, i) => {
    const expected = ef.activities[d].map((a) => a.name);
    assert.equal(secs[i].acts.length, ef.activities[d].length, `${d}: every activity present`);
    assert.deepEqual(new Set(secs[i].acts), new Set(expected), `${d}: the same activities`);
    assert.equal(secs[i].sub, 'Off the clock');
  });
  // The activities are rows, never cards — an activity is not a pick key.
  assert.equal(root.querySelectorAll('.ee-item .card').length, 0);
  assert.ok(!root.querySelector('.ee-item[data-artist]'));
  // No column reserved: the strip names exactly the canonical stages and the grid template has exactly that many tracks.
  const heads = [...root.querySelectorAll('.stage-strip .stage-head')].map((h) => h.textContent.trim());
  assert.ok(!heads.includes('EVERYTHING ELSE'), 'no muted head on the strip');
  const layout = computeTimesLayout(ef, (d) => state.getDayArtists(d, null), null);
  assert.equal((layout.colsTemplate.match(/minmax\(/g) || []).length, layout.stages.length, 'columns are the stages, nothing more');
  assert.equal(root.querySelectorAll('.times-grid .ee-col').length, 0, 'nothing off the clock inside a grid');
  // The section sits AFTER the day's grid, before the next day's rule.
  const firstRule = root.querySelector('.day-rule');
  const firstGrid = root.querySelector('.times-wrap:not(.stage-strip)');
  const firstSec = [...root.querySelectorAll('.sec-head')].find((h) => h.querySelector('.sec-label').textContent === 'EVERYTHING ELSE');
  assert.ok(firstRule.compareDocumentPosition(firstGrid) & 4 && firstGrid.compareDocumentPosition(firstSec) & 4, 'rule, then grid, then the section');
});

test('a set on a stage that is not a column is a CARD in the section — its occurrence carries the stage for the zoom, its face the time', () => {
  const root = render('stray-fest');
  const secs = sectionsOf(root);
  assert.equal(secs.length, 2, 'Friday (a stray) and Saturday (activities)');
  assert.deepEqual(secs[0].cards.map((c) => [c.name, c.time]), [['Secret Set', '9:30 – 10:30 PM']]);
  assert.deepEqual(secs[0].cards[0].occ, { day: 'Friday', stage: 'Secret Stage', time: '9:30 PM - 10:30 PM', weekend: null });
  assert.deepEqual(secs[0].acts, []);
  assert.equal(root.querySelectorAll('.card[data-artist="Secret Set"]').length, 1, 'the stray renders once — in the section, not on the grid');
  assert.deepEqual(secs[1].cards, []);
  assert.deepEqual(secs[1].acts, ['Sunrise Ceremony', 'Morning Yoga', 'Late Crafters'], 'activities in time order, whatever the file order — the day turns over at 6 AM, so a 2 AM crafter hour is the tail of the night');
});

test('a day with nothing off the clock has no section; a stage solo hides the section', () => {
  let root = render('plain-fest');
  assert.equal(sectionsOf(root).length, 0);
  root = render('stray-fest', { soloStage: 'A' });
  assert.equal(sectionsOf(root).length, 0, 'solo promises just that stage');
});

test('the people filter and search reach the section like any card grid', () => {
  state.crewDoc.festivals['stray-fest'] = { selections: { 'Secret Set': { Kevin: 3 } } };
  let root = render('stray-fest', { filterPeople: ['Kevin'], picks: model.picksFor(state.crewDoc, 'stray-fest') });
  let secs = sectionsOf(root);
  assert.deepEqual(secs[0].cards.map((c) => c.name), ['Secret Set'], 'a picked stray passes the filter');
  root = render('stray-fest', { filterPeople: ['Nobody'], picks: model.picksFor(state.crewDoc, 'stray-fest') });
  secs = sectionsOf(root);
  assert.deepEqual(secs[0].cards, [], 'an unpicked stray is filtered out');
  assert.ok(secs[0] && root.textContent.includes('No picks here from Nobody'), 'and the section says so');
});
