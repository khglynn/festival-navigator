// Afters/Folsom events on a lineup wall (Portola 2026 mechanism, 2026-08-23):
// an afters or Folsom appearance is its OWN artists[] entry — same name as a
// lineup artist means picks/auras/notes unify by exact name on purpose. The
// card must show where-and-when (venue in `stage`, hours in `time`) as a
// sub-label, and the validator must not cry duplicate for a same-name entry
// on a DIFFERENT day (that is a reappearance, not a typo).
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
const { renderWall, groupByDay, knownDaysOf } = await import('../js/v3/wall.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

// ---- validator: day-aware duplicate detection -------------------------------------

test('validator: same name on a different day is a reappearance, not a dupe', () => {
  const r = validateFestivalDoc({
    id: 'x', name: 'X', status: 'lineup',
    artists: [
      { name: 'Overmono', day: 'Sunday' },
      { name: 'Overmono', day: 'Afters', stage: 'Sun · Public Works', time: '10 PM - 2 AM' },
    ],
  });
  assert.equal(r.errors.length, 0);
  assert.ok(!r.warnings.some((w) => w.includes('duplicate')), `no dupe warning, got: ${r.warnings}`);
});

test('validator: same name on the SAME day (or with no day) still warns', () => {
  const sameDay = validateFestivalDoc({
    id: 'x', name: 'X', status: 'lineup',
    artists: [{ name: 'Overmono', day: 'Sunday' }, { name: 'Overmono', day: 'Sunday' }],
  });
  assert.ok(sameDay.warnings.some((w) => w.includes('duplicate')), 'same-day dupe warns');
  const noDay = validateFestivalDoc({
    id: 'x', name: 'X', status: 'lineup',
    artists: [{ name: 'Overmono' }, { name: 'Overmono', day: 'Afters' }],
  });
  assert.ok(noDay.warnings.some((w) => w.includes('duplicate')), 'day-less twin warns — nothing tells them apart');
});

// ---- the real Portola file ---------------------------------------------------------

test('portola-2026: validates clean; Afters and Folsom are real sections', () => {
  const r = validateFestivalDoc(portola, { filename: 'portola-2026.json' });
  assert.equal(r.errors.length, 0, `errors: ${r.errors}`);
  assert.ok(!r.warnings.some((w) => w.includes('duplicate')), `no dupe warnings: ${r.warnings}`);
  assert.deepEqual(knownDaysOf(portola), ['Saturday', 'Sunday', 'Afters', 'Folsom'],
    'dayMeta drives section order: fest days first, then Afters, then Folsom');
});

test('portola-2026: Horse Meat Disco renders under BOTH Afters and Folsom', () => {
  const groups = groupByDay(portola.artists, knownDaysOf(portola));
  const names = (day) => (groups.get(day) || []).map((a) => a.name);
  assert.ok(names('Afters').includes('Horse Meat Disco'), 'HMD in Afters');
  assert.ok(names('Folsom').includes('Horse Meat Disco'), 'HMD in Folsom');
  // A lineup artist's afters appearance lands in Afters WITHOUT leaving its fest day.
  assert.ok(names('Sunday').includes('Overmono'), 'Overmono still a Sunday fest act');
  assert.ok(names('Afters').includes('Overmono'), 'Overmono also an afters act');
  assert.ok(names('Folsom').includes('Folsom Street Fair'), 'the fair itself is listed');
});

// ---- the wall: event cards say where-and-when -------------------------------------

FESTIVAL_INDEX.push({ id: 'afters-fest', status: 'lineup' });
state.activateCrew('afterstesttoken_012345678', {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 3 } },
  festivals: { 'afters-fest': { selections: { 'Horse Meat Disco': { Kevin: 4 } } } },
  affinity: {},
});

const ctx = {
  fid: 'afters-fest', meName: 'Kevin',
  picks: { 'Horse Meat Disco': { Kevin: 4 } },
  affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
  onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null,
};

test('lineup wall: event entries carry a venue · time sub-label; plain entries stay bare', () => {
  state.FESTIVALS['afters-fest'] = {
    id: 'afters-fest', name: 'Afters Fest', status: 'lineup',
    dayMeta: { Sunday: { wd: 'Sun', date: 'Sep 27' }, Afters: { date: 'Sep 24-27' }, Folsom: { date: 'Sep 25-27' } },
    artists: [
      { name: 'Overmono', day: 'Sunday' },
      { name: 'Overmono', day: 'Afters', stage: 'Sun · Public Works', time: '10 PM - 2 AM' },
      { name: 'Horse Meat Disco', day: 'Afters & Folsom', stage: 'Fri · Public Works', time: '9 PM - 3 AM' },
      { name: 'Groove Armada', day: 'Afters', stage: 'Sat · The Great Northern' },
    ],
  };
  state.setActiveFestivalId('afters-fest');
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, ctx);

  const cards = [...root.querySelectorAll('.card')];
  const subOf = (el) => el.querySelector('.time')?.textContent || '';

  const overmonos = cards.filter((c) => c.dataset.artist === 'Overmono');
  assert.equal(overmonos.length, 2, 'one card per appearance, same pick identity');
  assert.deepEqual(overmonos.map(subOf).sort(), ['', 'Sun · Public Works · 10 PM - 2 AM'],
    'fest card stays bare; the afters card says where and when');

  const hmds = cards.filter((c) => c.dataset.artist === 'Horse Meat Disco');
  assert.equal(hmds.length, 2, 'combined "Afters & Folsom" splits into both sections');
  for (const c of hmds) {
    assert.equal(subOf(c), 'Fri · Public Works · 9 PM - 3 AM');
    assert.ok(c.classList.contains('timed'), 'sub-label cards get the stacked layout');
  }

  const ga = cards.find((c) => c.dataset.artist === 'Groove Armada');
  assert.equal(subOf(ga), 'Sat · The Great Northern', 'a venue with no confirmed time shows venue only');

  root.remove();
});
