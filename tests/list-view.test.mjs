// THE LIST (Phase 1, 2026-09-26): the show menu's Board · List row. In the
// List every room is a time list of rows — the festival's grid on hours, a
// run of afters on hours, a section that declared by-time (Folsom) on its own
// night ladder — and each card is the same card, drawn full width. Rendered
// by the real modules in jsdom on the real Portola and ACL files; the look is
// the frames' and the walk's job (claude-plans/2026-09-26-unified-build/).
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
const { renderWall, refreshCard, positionNowMarks, listOffered, nowLanding } = await import('../js/v3/wall.js');
const { hourBandOf, bandOf, timeBandsOf, TIME_TBA } = await import('../js/v3/events.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));
const PORTOLA = 'portola-2026';
const ACL = 'acl-2026';
FESTIVALS[PORTOLA] = load(PORTOLA);
FESTIVALS[ACL] = load(ACL);
FESTIVALS['seismic-9'] = load('seismic-9');
for (const id of [PORTOLA, ACL, 'seismic-9']) if (!FESTIVAL_INDEX.some((f) => f.id === id)) FESTIVAL_INDEX.push({ id, status: 'scheduled' });

const TOKEN = 'listviewtesttoken_0123456';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Ross: { colorIndex: 5 } },
  festivals: { [PORTOLA]: { selections: { 'Gelli Haha': { Kevin: 3, Maya: 2, Ross: 1 }, Robyn: { Maya: 4 }, 'Milli Meng': { Kevin: 2 } } } },
  affinity: {},
}, PORTOLA);

const ctxFor = (fid, over = {}) => {
  const ctx = {
    fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: new Date('2026-09-20T12:00:00-07:00'), view: 'list',
    taps: [], picks: model.picksFor(state.crewDoc, fid),
    onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {},
    ...over,
  };
  ctx.onTap = (artist, el) => { ctx.taps.push(artist); return refreshCard(el, artist, ctx); };
  return ctx;
};
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid, over);
  renderWall(root, ctx);
  return { root, ctx };
};
const room = (root, day, key) => root.querySelector(`.day-block[data-day="${day}"] .room[data-room="${key}"]`);
const bands = (r) => [...r.querySelectorAll(':scope > .time-list > .time-band')].map((b) => b.querySelector('.band-head .label').textContent);
const rowOf = (r, name) => r.querySelector(`.card[data-artist="${CSS.escape(name)}"]`);
const words = (c) => [(c.querySelector(':scope > .time') || {}).textContent || null, [...c.querySelectorAll(':scope > .place > .phrase')].map((s) => s.textContent)];

test('the hour ladder: an hour a band, After-hours from 2 AM, no clock last — on the festival-day clock', () => {
  assert.deepEqual(hourBandOf(13 * 60 + 30), { key: 'h13', label: '1 PM', from: 780, to: 840 });
  assert.equal(hourBandOf(23 * 60 + 59).label, '11 PM');
  assert.equal(hourBandOf(24 * 60 + 15).label, '12 AM', 'past midnight is the same night');
  assert.equal(hourBandOf(25 * 60 + 59).label, '1 AM');
  assert.equal(hourBandOf(26 * 60).key, 'after', 'bar close: the night ladder\'s own After-hours');
  assert.equal(hourBandOf(null), TIME_TBA);
  assert.equal(bandOf(22 * 60 + 30).label, '10 PM', 'the night ladder is untouched');
  // Bands come out in clock order, Time TBA last, whichever ladder.
  const out = timeBandsOf([
    { name: 'Late', venue: 'X', time: '1:15 AM' },
    { name: 'Early', venue: 'Y', time: '9:30 PM' },
    { name: 'Nobody knows', venue: 'Z' },
    { name: 'Dawn', venue: 'X', time: '3 AM' },
  ], { ladder: 'hours' });
  assert.deepEqual(out.map((b) => b.label), ['9 PM', '1 AM', 'After-hours', 'Time TBA']);
});

test('listOffered: only a festival with a clock can be read as a List', () => {
  assert.equal(listOffered(FESTIVALS[PORTOLA]), true);
  assert.equal(listOffered(FESTIVALS[ACL]), true);
  assert.equal(listOffered(FESTIVALS['seismic-9']), false, 'a lineup has no times to put in order');
});

test('SAT PORTOLA as a List: every grid set a row, on hours, time · STAGE — and no grid at all', () => {
  const { root } = render(PORTOLA);
  assert.equal(root.dataset.view, 'list', 'the wall says which view it is (v3.css draws the column from it)');
  const r = room(root, 'Saturday', ':fest');
  assert.ok(r, 'the festival room');
  assert.equal(r.querySelector('.times-grid, .stage-strip'), null, 'no stage grid, no strip');
  assert.ok(r.querySelector(':scope > .room-head'), 'the room keeps its head (the note door)');
  assert.deepEqual(bands(r).slice(0, 4), ['1 PM', '2 PM', '3 PM', '4 PM']);
  const sets = state.getDayArtists('Saturday', null);
  const rows = [...r.querySelectorAll('.card.row')];
  for (const a of sets) assert.ok(rows.some((c) => c.dataset.artist === a.name), `${a.name} is a row`);
  assert.ok(rows.every((c) => !c.classList.contains('cell') && !c.classList.contains('timed')), 'a row, never a cell or a search card');
  assert.deepEqual(words(rowOf(r, 'Tricky')), ['3:30 – 4:30 PM', ['Crane']], 'the stage by its short name (v3.css draws it in capitals)');
  assert.deepEqual(words(rowOf(r, 'Despacio')), ['2:45 – 9:45 PM', []], 'a place that only repeats the name says nothing');
  // Start order inside an hour, whatever the stage.
  const two = [...r.querySelectorAll('.time-band[data-band="h14"] .card')].map((c) => c.dataset.artist);
  assert.deepEqual(two, ['Gelli Haha', 'Ranger Trucco b2b Alisha', 'Despacio', 'MGNA Crrrta']);
});

test('a List row is the grid cell\'s own card: the same occurrence and the same now window', () => {
  const board = render(PORTOLA, { view: 'board' }).root;
  const cells = new Map([...board.querySelectorAll('.day-block[data-day="Saturday"] .times-grid .card')]
    .map((c) => [c.dataset.artist, { occ: c.dataset.occ, from: c.dataset.nowFrom, to: c.dataset.nowTo }]));
  assert.ok(cells.size > 20, 'the board drew the grid');
  assert.equal(board.dataset.view, undefined, 'a board says nothing');
  const list = render(PORTOLA).root;
  for (const c of list.querySelectorAll('.day-block[data-day="Saturday"] .room[data-room=":fest"] .card.row')) {
    const cell = cells.get(c.dataset.artist);
    if (!cell) continue; // billed-only names have no cell
    assert.equal(c.dataset.occ, cell.occ, `${c.dataset.artist}: the same occurrence (zoom, notes, route key)`);
    assert.deepEqual([c.dataset.nowFrom, c.dataset.nowTo], [cell.from, cell.to], `${c.dataset.artist}: the same ring window`);
  }
});

test('Afters reads on hours, and a run member says its start, never the room\'s close', () => {
  const { root } = render(PORTOLA);
  const r = room(root, 'Saturday', 'Afters');
  assert.deepEqual(bands(r), ['9 PM', '10 PM', '11 PM', '12 AM', '1 AM']);
  const [time, place] = words(rowOf(r, 'Milli Meng'));
  assert.equal(time, '~10:30 PM', 'a run member: its start only');
  assert.deepEqual(place, ['Public Works'], 'a venue in normal case');
  assert.equal(r.querySelector('.venue-grid, .stack-scroll'), null, 'no stacks');
});

test('Folsom keeps its night ladder in the List — what friends liked there is untouched', () => {
  const { root } = render(PORTOLA);
  const r = room(root, 'Saturday', 'Folsom');
  assert.deepEqual(bands(r).slice(0, 2), ['Daytime', 'Evening']);
  assert.ok(r.querySelector('.time-list.rows .card.row'), 'as rows');
  assert.equal(r.querySelector('.time-list[data-clock]'), null, 'no clock above it in the List');
});

test('the Board is the wall as it was: a grid, stacks, and Folsom\'s two-up list', () => {
  const { root } = render(PORTOLA, { view: 'board' });
  assert.ok(room(root, 'Saturday', ':fest').querySelector('.times-grid'));
  assert.ok(room(root, 'Saturday', 'Afters').querySelector('.venue-grid'));
  assert.equal(root.querySelector('.card.row'), null, 'no rows anywhere');
  assert.equal(root.querySelector('.time-list.rows'), null);
});

test('a pick on a row refreshes it as a row, window and all', () => {
  const { root, ctx } = render(PORTOLA);
  const card = rowOf(room(root, 'Saturday', ':fest'), 'Tricky');
  const from = card.dataset.nowFrom;
  const fresh = ctx.onTap('Tricky', card);
  assert.ok(fresh.classList.contains('row'), 'still a row');
  assert.equal(fresh.dataset.nowFrom, from);
  assert.deepEqual(words(fresh), ['3:30 – 4:30 PM', ['Crane']]);
});

test('NOW lands on a row: the ring is the row\'s, with no line to sit on', () => {
  const now = new Date('2026-09-26T16:15:00-07:00');
  const { root, ctx } = render(PORTOLA, { now });
  positionNowMarks(root, now);
  const lit = [...room(root, 'Saturday', ':fest').querySelectorAll('.card.now')].map((c) => c.dataset.artist);
  assert.ok(lit.includes('Chloé Caillet') && lit.includes('Despacio'), `the sets on at 4:15 wear the ring (${lit})`);
  assert.ok(!lit.includes('Gelli Haha'), 'a set that ended does not');
  const landing = nowLanding(root, ctx, now);
  assert.equal(landing.kind, 'card', 'NOW lands on a card');
  assert.ok(landing.card.classList.contains('row'));
});

test('ACL as a List: a grid day on hours, both weekends, and Late nights on hours by its doors', () => {
  const { root } = render(ACL, { now: new Date('2026-09-20T12:00:00-05:00') });
  const fri = root.querySelector('.day-block .room[data-room=":fest"]');
  assert.ok(fri && fri.querySelector('.time-list.rows .card.row'), 'the grid day as rows');
  assert.ok(bands(fri).includes('1 PM'));
  assert.deepEqual(words(rowOf(fri, 'Turnstile')), ['6:15 – 7:15 PM', ['T-Mobile']]);
  const late = [...root.querySelectorAll('.room[data-room="Late nights"]')];
  assert.ok(late.length > 3, 'a room per Late night');
  assert.ok(late.every((r) => r.querySelector('.time-list.rows')), 'each on hours');
  assert.ok(bands(late[0]).every((l) => /PM|AM|Time TBA|After-hours/.test(l)), `hours (${bands(late[0])})`);
});

test('a search is a list of answers in either view: the view does not reach it', () => {
  const { root } = render(PORTOLA, { query: 'robyn' });
  assert.equal(root.dataset.view, undefined);
  assert.equal(root.querySelector('.card.row'), null);
  assert.ok(root.querySelector('.card[data-artist="Robyn"]'));
});
