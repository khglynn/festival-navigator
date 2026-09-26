// Portola 2026 as shipped with set times (2026-08-27): the invariants a bad
// re-import would break. The poster is the ground truth these encode — doors
// 1 PM, music ends by 11 PM, five columns, every billed artist on the grid.
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
globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall } = await import('../js/v3/wall.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');
const { timeToMinutes } = await import('../js/time.js');
const { sectionLayoutOf, BY_TIME } = await import('../js/v3/events.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));

const STAGES = ['Pier Stage', 'Crane Stage', 'Warehouse', 'Ship Tent', 'Despacio'];

test('portola-2026: scheduled in both the file and the index, zero validator errors AND zero warnings', () => {
  assert.equal(portola.status, 'scheduled');
  assert.equal(index.find((f) => f.id === 'portola-2026').status, 'scheduled');
  const r = validateFestivalDoc(portola, { filename: 'portola-2026.json' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, [], 'every billed artist has a set; no dupes');
});

// Saturday lost Skepta on 2026-09-21 (cancelled, off the grid — tests/cancelled-acts.test.mjs).
const SETS = { Saturday: 31, Sunday: 32 };
test('portola-2026: the poster shape — 32 sets a day (31 on Saturday since Skepta\'s cancellation) on the five printed columns, inside doors-to-close', () => {
  for (const day of ['Saturday', 'Sunday']) {
    const d = portola.days[day];
    assert.deepEqual(d.stages, STAGES, `${day} columns as printed`);
    assert.equal(d.artists.length, SETS[day], `${day}: ${SETS[day] - 1} acts + Despacio`);
    for (const a of d.artists) {
      const [s, e] = a.time.split(' - ');
      assert.ok(timeToMinutes(s) >= timeToMinutes('1:00 PM'), `${day} ${a.name} starts after doors`);
      assert.ok(timeToMinutes(e) <= timeToMinutes('11:00 PM'), `${day} ${a.name} ends by 11 PM`);
      assert.ok(timeToMinutes(e) > timeToMinutes(s), `${day} ${a.name} has a positive length`);
    }
    assert.equal(d.artists.filter((a) => a.stage === 'Despacio').length, 1, `${day}: Despacio is one continuous block`);
  }
  assert.deepEqual(portola.days.Saturday.artists.find((a) => a.name === 'Despacio').time, '2:45 PM - 9:45 PM');
  assert.deepEqual(portola.days.Sunday.artists.find((a) => a.name === 'Despacio').time, '3:30 PM - 10:30 PM');
});

test('portola-2026: spot-check anchors against the official posters', () => {
  const at = (day, name) => portola.days[day].artists.find((a) => a.name === name);
  assert.deepEqual(at('Saturday', 'Dog Blood'), { name: 'Dog Blood', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM' });
  assert.deepEqual(at('Saturday', 'Prospa'), { name: 'Prospa', stage: 'Warehouse', time: '9:45 PM - 11:00 PM' });
  assert.deepEqual(at('Saturday', 'Melanie C'), { name: 'Melanie C', stage: 'Ship Tent', time: '9:50 PM - 10:30 PM' });
  assert.deepEqual(at('Sunday', 'Swedish House Mafia'), { name: 'Swedish House Mafia', stage: 'Pier Stage', time: '8:45 PM - 10:00 PM' });
  assert.deepEqual(at('Sunday', 'Four Tet'), { name: 'Four Tet', stage: 'Warehouse', time: '9:30 PM - 11:00 PM' });
  assert.deepEqual(at('Sunday', 'Tiësto'), { name: 'Tiësto', stage: 'Warehouse', time: '6:45 PM - 8:15 PM' });
  assert.deepEqual(at('Sunday', 'Kaytree'), { name: 'Kaytree', stage: 'Ship Tent', time: '1:40 PM - 2:55 PM' });
  assert.deepEqual(at('Sunday', 'horsegiirL'), { name: 'horsegiirL', stage: 'Crane Stage', time: '8:10 PM - 9:00 PM' });
});

test('portola-2026: the crew\'s live pick keys (as of 2026-08-27) all sit on the grid — or are marked cancelled, never gone', () => {
  // The 49 names the "Portola 26" crew had picked before set times dropped.
  const PICKED = ['Adéla', 'Azzecca', 'Bassvictim', 'Beltran b2b Ben Sterling', 'Ben UFO', 'Brunello', 'Channel Tres',
    'Chloé Caillet', 'DJ Shadow', 'Daphni', 'Dean Turnley', 'Despacio', 'Dog Blood', 'Fatboy Slim', 'Fcukers', 'Four Tet',
    'Gelli Haha', 'Groove Armada', 'Jigitz', 'Kelela', 'Kettama', 'MGNA Crrrta', 'Marlon Hoffstadt', 'Max Styler',
    'Melanie C', 'Mochakk', 'Nate Sib', 'Nimino', 'Ninajirachi', 'Oskar Med K', 'Overmono', 'Parcels', 'Prospa', 'Robyn',
    'SG Lewis', 'Silva Bumpa', 'Six Sex', 'Skepta', 'Soulwax', 'Swedish House Mafia', 'Tiësto', 'Tove Lo', 'VTSS',
    'Zara Larsson', 'Zulan', 'ear', 'horsegiirL', 'riria', 'underscores'];
  const onGrid = new Set(Object.values(portola.days).flatMap((d) => d.artists.map((a) => a.name)));
  // A cancelled act (Skepta, 2026-09-21) comes off the grid but keeps its
  // entry, so its card — and the picks on it — still render.
  const cancelled = new Set(portola.artists.filter((a) => a.cancelled).map((a) => a.name));
  for (const n of PICKED) assert.ok(onGrid.has(n) || cancelled.has(n), `${n} has live picks and must be on the grid under that exact name, or marked cancelled`);
});

// Day-first (MODEL-V3, 2026-09-01): the days are THU FRI SAT SUN — the union
// of the two grid days and Portola Week's four nights — and each day holds
// the Pier 80 grid (Sat, Sun) then that night's AFTERS and FOLSOM.
test('portola-2026: the wall is day-first — THU FRI SAT SUN, the grid inside its day, AFTERS and FOLSOM under it, nothing in EVERYTHING ELSE', () => {
  FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
  state.activateCrew('portolatesttoken_01234567', {
    v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 3 } },
    festivals: { 'portola-2026': { selections: {} } }, affinity: {},
  });
  state.FESTIVALS['portola-2026'] = portola;
  state.setActiveFestivalId('portola-2026');
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, {
    fid: 'portola-2026', meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
    sort: 'day', query: '', weekend: 'all', onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null,
  });
  const days = [...root.querySelectorAll('.day-block')].map((b) => b.dataset.day);
  assert.deepEqual(days, ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.deepEqual([...root.querySelectorAll('.room[data-room=":fest"] .room-head .name')].map((n) => n.textContent),
    ['SAT PORTOLA', 'SUN PORTOLA'], 'the festival\'s own room names its day: one line');
  const gridCells = root.querySelectorAll('.room[data-room=":fest"] .card.cell').length;
  assert.equal(gridCells, 63, 'every timed set is a grid cell, inside the festival\'s own room');
  assert.equal(root.querySelectorAll('.room[data-room=":fest"] .stage-strip').length, 2, 'each grid day carries its own sticky strip');
  assert.equal([...root.querySelectorAll('.room-head .label, .list-head .label')].filter((l) => l.textContent === 'EVERYTHING ELSE').length, 0);
  const hmd = [...root.querySelectorAll('.card')].filter((c) => c.dataset.artist === 'Horse Meat Disco');
  assert.equal(hmd.length, 2, 'Horse Meat Disco under Friday\'s Afters AND Friday\'s Folsom');
  assert.deepEqual(hmd.map((c) => c.closest('.room').dataset.room), ['Afters', 'Folsom']);
  // As stacks, the venue heads its group and the card says the time only; as a
  // by-time list (v94, once the file declares it) the card says its place too.
  const hmdEntry = portola.artists.find((a) => a.name === 'Horse Meat Disco');
  assert.equal(hmd[1].dataset.time, sectionLayoutOf(portola, 'Folsom') === BY_TIME
    ? `9 PM – 3 AM\n${[hmdEntry.venue, hmdEntry.area].filter(Boolean).join(' · ')}`
    : '9 PM – 3 AM', 'a Folsom card says its time, and its place when no venue head says it');
  root.remove();
});

test('portola-2026: a set of three hours or more is a TALL cell — name at the top edge, "until" at the bottom (Despacio, 2026-08-31)', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, {
    fid: 'portola-2026', meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
    sort: 'day', query: '', weekend: 'all', onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null,
  });
  const gridCells = [...root.querySelectorAll('.room[data-room=":fest"] .card.cell')];
  const despacio = gridCells.filter((c) => c.dataset.artist === 'Despacio');
  assert.equal(despacio.length, 2, 'one Despacio block per grid day');
  assert.deepEqual(despacio.map((c) => c.classList.contains('tall')), [true, true]);
  assert.deepEqual(despacio.map((c) => c.querySelector('.until').textContent), ['until 9:45 PM', 'until 10:30 PM']);
  const dogBlood = gridCells.find((c) => c.dataset.artist === 'Dog Blood');
  assert.ok(!dogBlood.classList.contains('tall'), 'a 75-minute set is not tall');
  assert.equal(dogBlood.querySelector('.until'), null);
  // A stack has no clock to be tall on: Friday's Despacio at Pier 80 is a
  // card like any other, and its printed window is its time line.
  const friday = [...root.querySelectorAll('.room[data-room="Afters"] .stack > .card')].find((c) => c.dataset.artist === 'Despacio');
  assert.ok(friday && !friday.classList.contains('tall') && !friday.classList.contains('cell'));
  assert.equal(friday.querySelector('.time').textContent, '5 – 11 PM');
  root.remove();
});

test('the fest place line: the venue is a door when the file knows the address, the aside and dates stay text', async () => {
  const { festPlaceLine } = await import('../js/v3/card-facts.js');
  const text = (frag) => { const d = document.createElement('div'); d.appendChild(frag); return d; };
  // The no-address case on a CLONE — the real file carries Pier 80's address
  // (venue round, 2026-08-31), and a test that assumed it didn't blocked the
  // data from landing.
  const plain = text(festPlaceLine({ ...portola, locationUrl: undefined }));
  assert.equal(plain.textContent, 'Pier 80 · September 26–27, 2026 · Doors 1 PM');
  assert.equal(plain.querySelector('a'), null, 'no address, no door');
  assert.equal(plain.querySelector('span.fest-place').textContent, 'Pier 80');
  assert.match(portola.locationUrl, /^https:\/\/maps\.google\.com\/\?q=Pier\+80/, 'the shipped file knows where Pier 80 is');
  const linked = text(festPlaceLine(portola));
  const door = linked.querySelector('a.fest-place');
  assert.equal(door.getAttribute('href'), portola.locationUrl);
  assert.equal(door.textContent, 'Pier 80');
  assert.equal(door.getAttribute('target'), '_blank');
  assert.equal(linked.textContent, 'Pier 80 · September 26–27, 2026 · Doors 1 PM');
  // A subtitle with an aside: only the venue is the door.
  const acl = text(festPlaceLine({ subtitle: 'Zilker Park · both weekends', dates: 'Oct 2–4', locationUrl: 'https://maps.google.com/?q=Zilker+Park' }));
  assert.equal(acl.querySelector('a.fest-place').textContent, 'Zilker Park');
  assert.equal(acl.textContent, 'Zilker Park · both weekends · Oct 2–4');
  // No subtitle at all: the location stands in, as text.
  assert.equal(text(festPlaceLine({ location: 'Rothbury, MI', dates: 'Jun 25–28' })).textContent, 'Rothbury, MI · Jun 25–28');
});
