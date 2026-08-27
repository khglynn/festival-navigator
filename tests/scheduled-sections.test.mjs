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
const { renderWall, extraSectionsOf } = await import('../js/v3/wall.js');
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

const rulesOf = (root) => [...root.querySelectorAll('.day-rule')].map((r) => r.querySelector('.day').textContent);
const cardsUnder = (root, dayLabel) => {
  const rule = [...root.querySelectorAll('.day-rule')].find((r) => r.querySelector('.day').textContent === dayLabel);
  assert.ok(rule, `no day rule ${dayLabel}`);
  const grid = rule.nextElementSibling;
  return [...grid.querySelectorAll('.card')].map((c) => ({ name: c.dataset.artist, time: c.dataset.time }));
};

test('extraSectionsOf: non-grid days become sections in known-day order, leftovers last, deduped', () => {
  const scheduledNames = new Set(['Headliner', 'Overmono']);
  const sections = extraSectionsOf(FEST, scheduledNames, 'all');
  assert.deepEqual([...sections.keys()], ['Afters', 'Folsom', '']);
  assert.deepEqual(sections.get('Afters').map((a) => a.name), ['Overmono', 'Only Afters', 'Horse Meat Disco']);
  assert.deepEqual(sections.get('Folsom').map((a) => a.name), ['Horse Meat Disco', 'The Fair'], 'a combined day lands in each');
  assert.deepEqual(sections.get('').map((a) => a.name), ['Late Add'], 'billed on a grid day, not on the grid = everything else');
});

test('scheduled wall: the grid, then AFTERS, FOLSOM and EVERYTHING ELSE — the afters card keeps its venue sub-label', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, mkCtx());
  assert.deepEqual(rulesOf(root), ['SATURDAY', 'AFTERS', 'FOLSOM', 'EVERYTHING ELSE']);
  const afters = cardsUnder(root, 'AFTERS');
  assert.deepEqual(afters.map((a) => a.name), ['Overmono', 'Only Afters', 'Horse Meat Disco']);
  assert.equal(afters[0].time, 'Sat · Public Works · 10 PM - 2 AM', 'venue · hours ride on the card');
  assert.deepEqual(cardsUnder(root, 'FOLSOM').map((a) => a.name), ['Horse Meat Disco', 'The Fair']);
  assert.deepEqual(cardsUnder(root, 'EVERYTHING ELSE').map((a) => a.name), ['Late Add']);
  const overmonoCards = [...root.querySelectorAll('.card')].filter((c) => c.dataset.artist === 'Overmono');
  assert.equal(overmonoCards.length, 2, 'one on the grid, one under Afters — same pick key');
  assert.ok(overmonoCards.every((c) => c.getAttribute('aria-label').includes('must')), 'both cards wear the same pick');
  root.remove();
});

test('searching a scheduled wall finds the afters card too, under its own section', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, mkCtx('overmono'));
  assert.deepEqual(rulesOf(root), ['SATURDAY', 'AFTERS']);
  assert.deepEqual(cardsUnder(root, 'SATURDAY').map((a) => a.time), ['Warehouse · 8:20 PM']);
  assert.deepEqual(cardsUnder(root, 'AFTERS').map((a) => a.time), ['Sat · Public Works · 10 PM - 2 AM']);
  renderWall(root, mkCtx('late'));
  assert.deepEqual(rulesOf(root), ['EVERYTHING ELSE'], 'an untimed lineup act is still findable');
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

test('validator: two sets on one stage cannot overlap; a set cannot end before it starts', () => {
  const overlap = validateFestivalDoc({
    ...FEST,
    days: { Saturday: { stages: ['Main'], artists: [
      { name: 'Headliner', stage: 'Main', time: '9:00 PM - 10:15 PM' },
      { name: 'Overmono', stage: 'Main', time: '10:00 PM - 11:00 PM' },
    ] } },
  });
  assert.ok(overlap.errors.some((e) => e.includes('overlap')), `overlap is an error: ${overlap.errors}`);
  const inverted = validateFestivalDoc({
    ...FEST,
    days: { Saturday: { stages: ['Main'], artists: [{ name: 'Headliner', stage: 'Main', time: '10:00 PM - 9:00 PM' }] } },
  });
  assert.ok(inverted.errors.some((e) => e.includes('ends before it starts')), `inverted is an error: ${inverted.errors}`);
  // Different weekends on a two-weekend grid are not a clash.
  const weekends = validateFestivalDoc({
    ...FEST,
    days: { Saturday: { stages: ['Main'], artists: [
      { name: 'Headliner', stage: 'Main', time: '9:00 PM - 10:15 PM', weekend: 'W1' },
      { name: 'Overmono', stage: 'Main', time: '9:00 PM - 10:15 PM', weekend: 'W2' },
    ] } },
  });
  assert.ok(!weekends.errors.some((e) => e.includes('overlap')), `W1 vs W2 is not a clash: ${weekends.errors}`);
});
