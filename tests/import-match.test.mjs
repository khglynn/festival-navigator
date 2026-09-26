// Import from a festival app's schedule export (2026-09-26): the matching
// contract. A match is a NAME match (picks are keyed by name) and the name
// that comes back is always the lineup's own bytes; day and stage only break
// ties and tell the person what matched. Nothing fuzzier than case, accents,
// punctuation and how a back-to-back is written — a near miss is shown to
// the person as "not on this fest's lineup", never guessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  importKey, stageKey, festDayOf, lineupIndex, matchItem, matchRead,
  startLevel, picksToWrite, IMPORT_START_LEVEL,
} from '../js/v3/import-match.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

// The two real exports Kevin sent from Portola (2026-09-26), as the endpoint
// returns them. The images themselves stay out of this public repo.
const SATURDAY = {
  festival: 'Portola', day: 'Saturday 9/26', items: [
    { name: 'Despacio', start: '2:45 PM', end: '9:45 PM', stage: 'DESPACIO' },
    { name: 'Ranger Trucco b2b Alisha', start: '2:45 PM', end: '3:45 PM', stage: 'WAREHOUSE' },
    { name: 'Airwolf Paradise', start: '1:30 PM', end: '2:30 PM', stage: 'PIER' },
    { name: 'Erika b2b sfcowboy', start: '1:30 PM', end: '3:10 PM', stage: 'CRANE' },
  ],
};
const SUNDAY = {
  festival: 'Portola', day: 'Sunday 9/27', items: [
    { name: 'Overmono', start: '8:20 PM', end: '9:20 PM', stage: 'WAREHOUSE' },
    { name: 'underscores', start: '5:50 PM', end: '6:40 PM', stage: 'CRANE' },
    { name: 'VTSS', start: '4:30 PM', end: '5:30 PM', stage: 'WAREHOUSE' },
    { name: 'Silva Bumpa', start: '2:30 PM', end: '3:30 PM', stage: 'WAREHOUSE' },
  ],
};

test('the eight names on Kevin\'s two Portola exports all match, under the lineup\'s own spelling', () => {
  const idx = lineupIndex(portola);
  const sat = matchRead(idx, SATURDAY);
  const sun = matchRead(idx, SUNDAY);
  assert.equal(sat.day, 'Saturday');
  assert.equal(sun.day, 'Sunday');
  assert.deepEqual(sat.unknown, []);
  assert.deepEqual(sun.unknown, []);
  assert.deepEqual(sat.matched.map((m) => m.name), ['Despacio', 'Ranger Trucco b2b Alisha', 'Airwolf Paradise', 'erika b2b sfcowboy']);
  assert.deepEqual(sun.matched.map((m) => m.name), ['Overmono', 'underscores', 'VTSS', 'Silva Bumpa']);
  // Every one is on the day the image says: nothing flagged.
  assert.ok([...sat.matched, ...sun.matched].every((m) => !m.offDay));
  // The review shows OUR set — the one on the image's day, on the grid.
  const erika = sat.matched.find((m) => m.name === 'erika b2b sfcowboy');
  assert.equal(erika.via, 'exact', 'case aside is still exact');
  assert.deepEqual(erika.occ, { day: 'Saturday', stage: 'Crane Stage', time: '1:30 PM - 3:10 PM', grid: true });
  const overmono = sun.matched.find((m) => m.name === 'Overmono');
  assert.equal(overmono.occ.day, 'Sunday', 'the grid set on Sunday, not its Afters show');
  assert.equal(overmono.occ.stage, 'Warehouse');
});

test('every name returned is byte-for-byte a lineup name (the pick key)', () => {
  const idx = lineupIndex(portola);
  const names = new Set(portola.artists.map((a) => a.name));
  for (const read of [SATURDAY, SUNDAY]) {
    for (const m of matchRead(idx, read).matched) assert.ok(names.has(m.name), `${m.name} is in artists[]`);
  }
});

const mini = {
  id: 'mini', name: 'Mini',
  days: {
    Saturday: { stages: ['Pier Stage', 'Warehouse'], artists: [
      { name: 'Chloé Caillet', stage: 'Warehouse', time: '6:00 PM - 7:00 PM' },
      { name: 'MÜLL', stage: 'Pier Stage', time: '3:00 PM - 4:00 PM' },
      { name: 'Ranger Trucco b2b Alisha', stage: 'Warehouse', time: '2:45 PM - 3:45 PM' },
      { name: "It's Murph", stage: 'Pier Stage', time: '1:00 PM - 2:00 PM' },
      { name: 'CØNTRA', stage: 'Warehouse', time: '9:00 PM - 10:00 PM' },
    ] },
    Sunday: { stages: ['Pier Stage'], artists: [
      { name: 'VTSS', stage: 'Pier Stage', time: '4:30 PM - 5:30 PM' },
    ] },
  },
  dayMeta: { Saturday: { wd: 'Sat', date: 'Sep 26', iso: '2026-09-26' }, Sunday: { wd: 'Sun', date: 'Sep 27', iso: '2026-09-27' } },
  artists: [
    { name: 'Chloé Caillet', day: 'Saturday' },
    { name: 'MÜLL', day: 'Saturday' },
    { name: 'Ranger Trucco b2b Alisha', day: 'Saturday' },
    { name: "It's Murph", day: 'Saturday' },
    { name: 'CØNTRA', day: 'Saturday' },
    { name: 'VTSS', day: 'Sunday' },
    { name: 'Night Owl', day: 'Afters', night: 'Sat', venue: 'The Midway', time: '11 PM' },
  ],
};

test('case: a name printed in any case matches exactly', () => {
  const idx = lineupIndex(mini);
  for (const printed of ['vtss', 'Vtss', '  VTSS  ']) {
    const m = matchItem(idx, { name: printed }, 'Sunday');
    assert.equal(m.name, 'VTSS');
    assert.equal(m.via, 'exact');
  }
});

test('accents: folded both ways, the way search folds them', () => {
  const idx = lineupIndex(mini);
  assert.equal(matchItem(idx, { name: 'Chloe Caillet' }, 'Saturday').name, 'Chloé Caillet');
  assert.equal(matchItem(idx, { name: 'Mull' }, 'Saturday').name, 'MÜLL');
  assert.equal(matchItem(idx, { name: 'CONTRA' }, 'Saturday').name, 'CØNTRA', 'a stroke letter NFD leaves whole');
  assert.equal(matchItem(idx, { name: 'Chloé Caillet' }, 'Saturday').name, 'Chloé Caillet', 'a decomposed é');
  assert.equal(matchItem(idx, { name: 'It’s Murph' }, 'Saturday').name, "It's Murph", 'iOS curly apostrophe');
  assert.equal(matchItem(idx, { name: 'Its Murph' }, 'Saturday').name, "It's Murph", 'no apostrophe at all');
  assert.equal(matchItem(idx, { name: 'Chloe Caillet' }, 'Saturday').via, 'folded');
});

test('a back-to-back written differently still matches: b2b, B2B, b 2 b, x, ×, &', () => {
  const idx = lineupIndex(mini);
  for (const printed of [
    'Ranger Trucco B2B Alisha', 'Ranger Trucco b 2 b Alisha', 'Ranger Trucco x Alisha',
    'Ranger Trucco × Alisha', 'Ranger Trucco & Alisha', 'Ranger  Trucco  b2b  Alisha',
  ]) {
    assert.equal(matchItem(idx, { name: printed }, 'Saturday').name, 'Ranger Trucco b2b Alisha', printed);
  }
  assert.equal(importKey('Malcolm X'), 'malcolm x', 'a name that ends in X is not a back-to-back');
});

test('an unknown name is not on the lineup — never guessed toward a near miss', () => {
  const idx = lineupIndex(mini);
  assert.equal(matchItem(idx, { name: 'Chloe Cailet' }, 'Saturday').name, null, 'one letter off is a miss');
  assert.equal(matchItem(idx, { name: 'Ranger Trucco' }, 'Saturday').name, null, 'half a b2b is a miss');
  assert.equal(matchItem(idx, { name: 'Somebody Else' }, 'Saturday').name, null);
  assert.equal(matchItem(idx, { name: '' }, 'Saturday').name, null);
  const read = matchRead(idx, { day: 'Saturday 9/26', items: [{ name: 'VTSS' }, { name: 'Somebody Else' }, { name: 'Somebody Else' }] });
  assert.deepEqual(read.unknown, ['Somebody Else'], 'listed once, never dropped');
});

test('a name on the wrong day still matches (picks are by name) and is flagged', () => {
  const idx = lineupIndex(mini);
  const m = matchItem(idx, { name: 'VTSS', stage: 'PIER' }, 'Saturday');
  assert.equal(m.name, 'VTSS');
  assert.equal(m.offDay, true);
  assert.deepEqual(m.where, ['Sunday']);
  assert.equal(m.occ.day, 'Sunday', 'the review shows where it really is');
  // Only at an afters here: flagged, and says where.
  const owl = matchItem(idx, { name: 'Night Owl' }, 'Saturday');
  assert.equal(owl.name, 'Night Owl');
  assert.equal(owl.offDay, true);
  assert.deepEqual(owl.where, ['Afters']);
  // No day named on the image: nothing to disagree with.
  assert.equal(matchItem(idx, { name: 'VTSS' }, null).offDay, false);
});

test('two lineup spellings of one act: the one on the image\'s day and stage wins', () => {
  const twin = {
    days: {
      Friday: { artists: [{ name: 'DJ Tennis', stage: 'Main Stage', time: '5:00 PM' }] },
      Saturday: { artists: [
        { name: 'DJ-Tennis', stage: 'Main Stage', time: '6:00 PM' },
        { name: 'D.J. Tennis', stage: 'Tent', time: '9:00 PM' },
      ] },
    },
    artists: [{ name: 'DJ Tennis', day: 'Friday' }, { name: 'DJ-Tennis', day: 'Saturday' }, { name: 'D.J. Tennis', day: 'Saturday' }],
  };
  const idx = lineupIndex(twin);
  assert.equal(matchItem(idx, { name: 'Dj Tennis!', stage: 'TENT' }, 'Saturday').name, 'D.J. Tennis', 'day and stage');
  assert.equal(matchItem(idx, { name: 'Dj Tennis!', stage: 'MAIN' }, 'Saturday').name, 'DJ-Tennis', 'day and stage, "Stage" aside');
  assert.equal(matchItem(idx, { name: 'Dj Tennis!' }, 'Friday').name, 'DJ Tennis', 'the day alone');
  // An exact spelling always beats a fold, whatever the day says.
  assert.equal(matchItem(idx, { name: 'dj tennis' }, 'Saturday').name, 'DJ Tennis');
});

test('the image\'s day chip names a festival day by date first, then by weekday', () => {
  assert.equal(festDayOf(portola, 'Saturday 9/26'), 'Saturday');
  assert.equal(festDayOf(portola, 'Sunday 9/27'), 'Sunday');
  assert.equal(festDayOf(portola, 'SUN'), 'Sunday');
  assert.equal(festDayOf(portola, 'Friday 9/25'), null, 'no festival room that day');
  assert.equal(festDayOf(portola, ''), null);
  const ef = { days: { 'Day 1': {}, 'Day 2': {} }, dayMeta: { 'Day 1': { wd: 'Thu', date: 'Jun 25' }, 'Day 2': { wd: 'Fri', date: 'Jun 26' } } };
  assert.equal(festDayOf(ef, 'Friday'), 'Day 2', 'a numbered day by its weekday');
  assert.equal(festDayOf(ef, 'Thursday 6/25'), 'Day 1', 'or its date');
  const acl = {
    days: { Friday: {}, Saturday: {} },
    dayMeta: { Friday: { wd: 'Fri', isos: { W1: '2026-10-02', W2: '2026-10-09' } }, Saturday: { wd: 'Sat', isos: { W1: '2026-10-03', W2: '2026-10-10' } } },
  };
  assert.equal(festDayOf(acl, 'Saturday 10/10'), 'Saturday', 'either weekend of a two-weekend fest');
});

test('stage keys fold case and the word "stage"', () => {
  assert.equal(stageKey('PIER'), stageKey('Pier Stage'));
  assert.equal(stageKey('CRANE'), stageKey('Crane Stage'));
  assert.equal(stageKey('WAREHOUSE'), stageKey('Warehouse'));
  assert.notEqual(stageKey('SHIP'), stageKey('Pier Stage'));
});

test('one image naming a set twice is one pick', () => {
  const idx = lineupIndex(mini);
  const read = matchRead(idx, { day: 'Sunday', items: [{ name: 'VTSS' }, { name: 'vtss' }] });
  assert.deepEqual(read.matched.map((m) => m.name), ['VTSS']);
});

test('levels: start at 2 (mid), never lower what you already picked', () => {
  assert.equal(IMPORT_START_LEVEL, 2);
  assert.equal(startLevel(0), 2);
  assert.equal(startLevel(undefined), 2);
  assert.equal(startLevel(1), 1, 'yours at 1 stays 1');
  assert.equal(startLevel(4), 4, 'a must stays a must');
});

test('the write: new sets at their landed level; already-yours, off and unknown are skipped; a name twice is one pick', () => {
  const out = picksToWrite([
    { name: 'A', level: 2 },
    { name: 'B', level: 4 },
    { name: 'C', level: 0 },                 // tapped off
    { name: 'D', level: 3, already: true },  // theirs already: not the import's
    { name: null, level: 2 },                // not on the lineup
    { name: 'A', level: 3 },                 // on two images: the higher level
  ]);
  assert.deepEqual(out, [{ name: 'A', level: 3 }, { name: 'B', level: 4 }]);
});
