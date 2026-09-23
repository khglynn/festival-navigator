// A scheduled wall still owes the crew the lineup-list sections the grid
// doesn't carry (Portola set-times drop, 2026-08-27): afters and Folsom cards
// live in artists[] under non-grid days, and flipping the fest to `scheduled`
// used to delete every one of them from the wall AND from the tab bar. Now the
// grid renders the festival days and the extra sections follow — same cards,
// same sub-labels, same day notes — in both the browse and search paths. The
// validator side: grid names must be lineup names, byte for byte.
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
const { renderWall } = await import('../js/v3/wall.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const FEST = {
  id: 'sections-fest', name: 'Sections Fest', status: 'scheduled',
  artists: [
    { name: 'Headliner', day: 'Saturday' },
    { name: 'Overmono', day: 'Saturday' },
    { name: 'Late Add', day: 'Saturday' }, // billed, but no set on the grid yet
    { name: 'Overmono', day: 'Afters', stage: 'Sat · Public Works', time: '10 PM - 2 AM' },
    { name: 'Only Afters', day: 'Afters', stage: 'Sat · Monarch', time: '10 PM' },
    { name: 'Horse Meat Disco', day: 'Afters & Folsom', stage: 'Fri · Public Works', time: '9 PM - 3 AM' },
    { name: 'The Fair', day: 'Folsom', stage: 'Sun · Folsom St', time: '11 AM - 6 PM' },
  ],
  dayMeta: {
    Saturday: { wd: 'Sat', date: 'Sep 26' },
    Afters: { date: 'Sep 24-27' },
    Folsom: { date: 'Sep 25-27' },
  },
  days: {
    Saturday: {
      stages: ['Main', 'Warehouse'],
      artists: [
        { name: 'Headliner', stage: 'Main', time: '9:00 PM - 10:15 PM' },
        { name: 'Overmono', stage: 'Warehouse', time: '8:20 PM - 9:20 PM' },
      ],
    },
  },
};

FESTIVAL_INDEX.push({ id: 'sections-fest', status: 'scheduled' });
state.activateCrew('sectionstesttoken_0123456', {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 3 } },
  festivals: { 'sections-fest': { selections: { Overmono: { Kevin: 4 } } } }, affinity: {},
});
state.FESTIVALS['sections-fest'] = FEST;
state.setActiveFestivalId('sections-fest');

const mkCtx = (query = '') => ({
  fid: 'sections-fest', meName: 'Kevin', picks: { Overmono: { Kevin: 4 } }, affinity: null, lowPower: true,
  sort: 'day', query, weekend: 'all', onTap: () => {}, onOpenNotes: null,
  onNotesChange: null, onOpenDayNotes: null,
});

// A search is a LIST: each answered day keeps its one-line list header.
const rulesOf = (root) => [...root.querySelectorAll('.list-head')].map((r) => r.querySelector('.label').textContent);
// The composed wall: a `.day-block` per day, a room per part of it, each room
// under its one head (one-line heads, 2026-09-23).
const daysOf = (root) => [...root.querySelectorAll('.day-block')].map((b) => b.dataset.day);
const cardsUnder = (root, dayLabel) => {
  const rule = [...root.querySelectorAll('.list-head')].find((r) => r.querySelector('.label').textContent === dayLabel);
  assert.ok(rule, `no day rule ${dayLabel}`);
  const grid = rule.nextElementSibling;
  return [...grid.querySelectorAll('.card')].map((c) => ({ name: c.dataset.artist, time: c.dataset.time }));
};
// The rooms of a day's block, by key.
const roomsUnder = (root, dayKey) => {
  const block = [...root.querySelectorAll('.day-block')].find((b) => b.dataset.day === dayKey);
  assert.ok(block, `no day block ${dayKey}`);
  return [...block.querySelectorAll(':scope > .room')].map((n) => ({
    room: n.dataset.room,
    label: n.querySelector(':scope > .room-head .name').textContent,
    cards: [...n.querySelectorAll('.card')].map((c) => ({ name: c.dataset.artist, time: c.dataset.time })),
  }));
};

// The composed wall (MODEL-V4, 2026-09-16): the sections say which NIGHT each
// show is on, so the wall composes by day — FRIDAY (afters + Folsom),
// SATURDAY (the festival's own room, holding its grid AND the name billed on
// it with no set time yet, then that night's afters), SUNDAY (Folsom). The
// afters entries never lost their venue: it heads their group and rides the
// occurrence into the zoom, and the card itself says only the time.
test('scheduled wall, composed: each day holds its grid and its sections; an afters card keeps its pick and its venue', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, mkCtx());
  assert.deepEqual(daysOf(root), ['Friday', 'Saturday', 'Sunday']);
  assert.equal(root.querySelectorAll('.day-block .list-head').length, 0, 'the composed wall draws no day line: each room\'s head says the day');
  const fri = roomsUnder(root, 'Friday');
  assert.deepEqual(fri.map((r) => [r.room, r.label]), [['Afters', 'FRI AFTERS'], ['Folsom', 'FRI FOLSOM']]);
  assert.deepEqual(fri[0].cards, [{ name: 'Horse Meat Disco', time: '9 PM – 3 AM' }]);
  const sat = roomsUnder(root, 'Saturday');
  assert.deepEqual(sat.map((r) => [r.room, r.label]), [[':fest', 'SAT SECTIONS FEST'], ['Afters', 'SAT AFTERS']]);
  assert.deepEqual(sat[0].cards.map((c) => c.name), ['Headliner', 'Overmono', 'Late Add'],
    'the grid, then the name billed on Saturday with no set on Saturday\'s grid — one room, no "everything else"');
  assert.deepEqual(sat[1].cards, [{ name: 'Overmono', time: '10 PM – 2 AM' }, { name: 'Only Afters', time: '10 PM' }],
    'the afters, venue group by venue group, in opening order');
  const sun = roomsUnder(root, 'Sunday');
  assert.deepEqual(sun.map((r) => r.room), ['Folsom']);
  assert.deepEqual(sun[0].cards, [{ name: 'The Fair', time: '11 AM – 6 PM' }]);
  const overmonoCards = [...root.querySelectorAll('.card')].filter((c) => c.dataset.artist === 'Overmono');
  assert.equal(overmonoCards.length, 2, 'one on the grid, one under Afters — same pick key');
  assert.ok(overmonoCards.every((c) => c.getAttribute('aria-label').includes('must')), 'both cards wear the same pick');
  assert.equal(JSON.parse(overmonoCards[1].dataset.occ).stage, 'Sat · Public Works', 'the afters card\'s occurrence carries the venue for the zoom');
  root.remove();
});

// A search is the same week, filtered — so an answer sits under the DAY it
// plays, like everything else on the wall. Results used to be headed by the
// SECTION a show belongs to ("AFTERS · Sep 24-27"), which is the one label V4
// stopped using as a place (MODEL-V4 §2, days are the days) and which cannot
// say which night you would be going out.
test('searching a scheduled wall answers under the DAY each show plays', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, mkCtx('overmono'));
  assert.deepEqual(rulesOf(root), ['SATURDAY'], 'one day, not one day and a section');
  assert.deepEqual(cardsUnder(root, 'SATURDAY'),
    [{ name: 'Overmono', time: 'Warehouse · 8:20 PM' }, { name: 'Overmono', time: 'Sat · 10 PM - 2 AM\nPublic Works' }],
    'the set on the grid and the afters show that night, in the wall\'s order');

  // A combined-day show is one entry in two rooms; a list of answers shows it
  // once, under its night.
  renderWall(root, mkCtx('horse'));
  assert.deepEqual(rulesOf(root), ['FRIDAY']);
  assert.deepEqual(cardsUnder(root, 'FRIDAY').map((a) => a.name), ['Horse Meat Disco']);

  // Billed on Saturday with no set on Saturday's grid: still Saturday, the
  // same room the wall puts it in.
  renderWall(root, mkCtx('late'));
  assert.deepEqual(rulesOf(root), ['SATURDAY'], 'an untimed lineup act is still findable, under its day');
  assert.deepEqual(cardsUnder(root, 'SATURDAY').map((a) => a.name), ['Late Add']);
  root.remove();
});

test('validator: the fixture is clean apart from the honest warning about the untimed act', () => {
  const r = validateFestivalDoc(FEST);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes('Late Add') && w.includes('no set')), `warns about Late Add: ${r.warnings}`);
});

test('validator: a grid name that only matches the lineup by case is an ERROR, not a warning', () => {
  const r = validateFestivalDoc({
    ...FEST,
    days: { Saturday: { stages: ['Main'], artists: [{ name: 'headliner', stage: 'Main', time: '9:00 PM - 10:00 PM' }] } },
  });
  assert.ok(r.errors.some((e) => e.includes('headliner') && e.includes('case')), `case drift is an error: ${r.errors}`);
  const missing = validateFestivalDoc({
    ...FEST,
    days: { Saturday: { stages: ['Main'], artists: [{ name: 'Nobody', stage: 'Main', time: '9:00 PM - 10:00 PM' }] } },
  });
  assert.ok(missing.errors.some((e) => e.includes('Nobody') && e.includes('missing from artists')), `grid-only names are errors: ${missing.errors}`);
});

test('validator: two acts on one stage at once WARN (renderer-resolved spans, point-times included); ending before starting is an ERROR', () => {
  const grid = (artists) => ({ ...FEST, days: { Saturday: { stages: ['Main'], artists } } });
  const overlap = validateFestivalDoc(grid([
    { name: 'Headliner', stage: 'Main', time: '9:00 PM - 10:15 PM' },
    { name: 'Overmono', stage: 'Main', time: '10:00 PM - 11:00 PM' },
  ]));
  assert.ok(overlap.warnings.some((w) => w.includes('overlap')), `overlap warns: ${overlap.warnings}`);
  assert.ok(!overlap.errors.some((e) => e.includes('overlap')), 'archived Lolla has real simultaneous listings — a warning, not a wall');
  const pointTimes = validateFestivalDoc(grid([
    { name: 'Headliner', stage: 'Main', time: '9:00 PM' },
    { name: 'Overmono', stage: 'Main', time: '9:00 PM' },
  ]));
  assert.ok(pointTimes.warnings.some((w) => w.includes('overlap')), `two point-times on one stage collide once the renderer fills the ends: ${pointTimes.warnings}`);
  const inverted = validateFestivalDoc(grid([{ name: 'Headliner', stage: 'Main', time: '10:00 PM - 9:00 PM' }]));
  assert.ok(inverted.errors.some((e) => e.includes('ends before it starts')), `inverted is an error: ${inverted.errors}`);
  // Different weekends on a two-weekend grid are not a clash.
  const weekends = validateFestivalDoc(grid([
    { name: 'Headliner', stage: 'Main', time: '9:00 PM - 10:15 PM', weekend: 'W1' },
    { name: 'Overmono', stage: 'Main', time: '9:00 PM - 10:15 PM', weekend: 'W2' },
  ]));
  assert.ok(!weekends.warnings.some((w) => w.includes('overlap')), `W1 vs W2 is not a clash: ${weekends.warnings}`);
});

test('validator: a clock time has 1–12 hours and 00–59 minutes', () => {
  const grid = (time) => ({ ...FEST, days: { Saturday: { stages: ['Main'], artists: [{ name: 'Headliner', stage: 'Main', time }] } } });
  for (const bad of ['13:00 PM - 14:00 PM', '99:00 PM - 99:59 PM', '0:00 PM - 1:00 PM', '9:60 PM']) {
    assert.ok(validateFestivalDoc(grid(bad)).errors.some((e) => e.includes('bad time')), `${bad} is rejected`);
  }
  for (const good of ['12:00 PM - 12:45 PM', '1:30 PM', '11:00 PM - Close', '12:30 AM']) {
    assert.ok(!validateFestivalDoc(grid(good)).errors.some((e) => e.includes('bad time')), `${good} is accepted`);
  }
});

test('validator: malformed days{} is a rejection, never a throw (festival-add validates LLM candidates through here)', () => {
  const asArray = validateFestivalDoc({ ...FEST, days: [{ stages: ['Main'], artists: [{ name: 'Headliner', stage: 'Main', time: '9:00 PM' }] }] });
  assert.ok(asArray.errors.some((e) => e.includes('days must be an object')), `array days rejected: ${asArray.errors}`);
  let r;
  assert.doesNotThrow(() => { r = validateFestivalDoc({ ...FEST, days: { Friday: null } }); });
  assert.ok(r.errors.some((e) => e.includes('Friday') && e.includes('must be an object')), `null day rejected: ${r.errors}`);
  assert.doesNotThrow(() => { r = validateFestivalDoc({ ...FEST, days: { Friday: { stages: ['Main'], artists: [null, 'x'] } } }); });
  assert.ok(r.errors.some((e) => e.includes('must be an object')), `non-object set rejected: ${r.errors}`);
});

test('validator: an ARCHIVED grid with a case-drifted name warns instead of erroring — its picks already live under the grid spelling', () => {
  const r = validateFestivalDoc({
    ...FEST, status: 'archived', year: "'25", dates: 'then',
    days: { Saturday: { stages: ['Main'], artists: [{ name: 'headliner', stage: 'Main', time: '9:00 PM - 10:00 PM' }] } },
  });
  assert.ok(!r.errors.some((e) => e.includes('headliner')), `no error: ${r.errors}`);
  assert.ok(r.warnings.some((w) => w.includes('headliner') && w.includes('case')), `but a warning: ${r.warnings}`);
});

test('validator: a malformed stages value is diagnosed without throwing; lowercase "pm" parses as evening in the renderer too', async () => {
  for (const stages of [{}, 7, 'Main', null]) {
    let r;
    assert.doesNotThrow(() => { r = validateFestivalDoc({ ...FEST, days: { Saturday: { stages, artists: [{ name: 'Headliner', stage: 'Main', time: '9:00 PM' }] } } }); }, `stages=${JSON.stringify(stages)}`);
    assert.ok(r.errors.some((e) => e.includes('missing stages')), `stages=${JSON.stringify(stages)} is an error: ${r.errors}`);
  }
  const { timeToMinutes, activityMinutes } = await import('../js/time.js');
  assert.equal(timeToMinutes('9 pm'), 21 * 60, 'TIME_RE is case-insensitive, so the parser must be too');
  assert.equal(timeToMinutes('12:30 am'), 24 * 60 + 30);
  assert.equal(activityMinutes('9 pm'), 21 * 60);
});

test('validator: duplicate detection compares RENDERED days — "Saturday" vs "Saturday & Sunday" is two cards on one wall', () => {
  // Both parts must be KNOWN days for the renderer to split the label at all.
  const r = validateFestivalDoc({
    id: 'x', name: 'X', status: 'lineup',
    artists: [{ name: 'Other', day: 'Sunday' }, { name: 'Despacio', day: 'Saturday' }, { name: 'Despacio', day: 'Saturday & Sunday' }],
  });
  assert.ok(r.warnings.some((w) => w.includes('duplicate') && w.includes('Despacio')), `combined-day dupe warns: ${r.warnings}`);
  const clean = validateFestivalDoc({
    id: 'x', name: 'X', status: 'lineup',
    artists: [{ name: 'A', day: 'Saturday' }, { name: 'B', day: 'Sunday' }, { name: 'Despacio', day: 'Saturday & Sunday' }, { name: 'Despacio', day: 'Afters', stage: 'Fri · Pier 80', time: '5 PM' }],
  });
  assert.ok(!clean.warnings.some((w) => w.includes('duplicate')), `disjoint days are a reappearance: ${clean.warnings}`);
  // Split exactly like the renderer: a combination with an UNKNOWN part stays
  // one literal section, so it does not collide with the plain day.
  const literal = validateFestivalDoc({
    id: 'x', name: 'X', status: 'lineup',
    artists: [{ name: 'Despacio', day: 'Saturday' }, { name: 'Despacio', day: 'Saturday & Mystery' }],
  });
  assert.ok(!literal.warnings.some((w) => w.includes('duplicate')), `an unsplittable label is its own section: ${literal.warnings}`);
});
