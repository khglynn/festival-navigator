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

// Day-first (MODEL-V3, 2026-09-01): a lineup fest whose sections say which
// NIGHT each show is on composes by day — FRIDAY, SATURDAY, SUNDAY, each
// holding that night's billing and sections. Inside a day the tile is CLEAN
// (name + time; the venue lives in the zoom), because the day is the day.
// The old two-line "night · time / venue" label survives where no day
// implies the night: the flat sorts (A → Z, my picks, most picked).
const AFTERS_FEST = {
  id: 'afters-fest', name: 'Afters Fest', status: 'lineup',
  dayMeta: { Sunday: { wd: 'Sun', date: 'Sep 27' }, Afters: { date: 'Sep 24-27' }, Folsom: { date: 'Sep 25-27' } },
  artists: [
    { name: 'Overmono', day: 'Sunday' },
    { name: 'Overmono', day: 'Afters', stage: 'Sun · Public Works', time: '10 PM - 2 AM' },
    { name: 'Horse Meat Disco', day: 'Afters & Folsom', stage: 'Fri · Public Works', time: '9 PM - 3 AM' },
    { name: 'Groove Armada', day: 'Afters', stage: 'Sat · The Great Northern' },
  ],
};

test('lineup wall, day-first: one day holds its billing and its sections; tiles say the time only; a timeless show shows no clock', () => {
  state.FESTIVALS['afters-fest'] = AFTERS_FEST;
  state.setActiveFestivalId('afters-fest');
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, ctx);

  const rules = [...root.querySelectorAll('.day-rule')].map((r) => r.querySelector('.day').textContent);
  assert.deepEqual(rules, ['FRIDAY', 'SATURDAY', 'SUNDAY'], 'the days are the union of the billing day and the event nights, in week order');

  const cards = [...root.querySelectorAll('.card')];
  const subOf = (el) => el.querySelector('.time')?.textContent || '';

  const overmonos = cards.filter((c) => c.dataset.artist === 'Overmono');
  assert.equal(overmonos.length, 2, 'one card per appearance, same pick identity');
  assert.deepEqual(overmonos.map(subOf).sort(), ['', '10 PM – 2 AM'],
    'the billing card stays bare; the afters tile says the time only — the venue is in the zoom');

  const hmds = cards.filter((c) => c.dataset.artist === 'Horse Meat Disco');
  assert.equal(hmds.length, 2, 'combined "Afters & Folsom" splits into both sections');
  for (const c of hmds) {
    assert.equal(subOf(c), '9 PM – 3 AM');
    assert.ok(c.classList.contains('timed'), 'sub-label cards get the stacked layout');
    assert.equal(JSON.parse(c.dataset.occ).stage, 'Fri · Public Works', 'the occurrence still knows the night and the venue');
  }

  const ga = cards.find((c) => c.dataset.artist === 'Groove Armada');
  assert.equal(subOf(ga), '', 'a show with no confirmed time wears no clock — the zoom says where');
  assert.equal(ga.closest('.room').dataset.bucket, 'Afters');

  root.remove();
});

test('lineup wall, a flat sort: one list, and the event card carries night · time then venue (no day implies the night)', () => {
  state.FESTIVALS['afters-fest'] = AFTERS_FEST;
  state.setActiveFestivalId('afters-fest');
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, { ...ctx, sort: 'az' });
  assert.deepEqual([...root.querySelectorAll('.day-rule')].map((r) => r.querySelector('.day').textContent), ['THE LINEUP']);
  const hmd = [...root.querySelectorAll('.card')].find((c) => c.dataset.artist === 'Horse Meat Disco');
  assert.equal(hmd.querySelector('.time').textContent, 'Fri · 9 PM - 3 AM\nPublic Works', 'the two-line label (2026-08-29) is the list form');
  root.remove();
});
