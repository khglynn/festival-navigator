// The fest-first landing (fests × circles × you): landingPairs turns the
// device's known crews into FESTIVAL rows, and otherFestPeople powers the
// + Add sheet's one-tap picker of recurring humans. Pure functions — these
// are the testable heart of the reshape; the DOM around them is walked live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingPairs, festLabelFor, otherFestPeople } from '../js/v3/model.js';

const INDEX = [
  // Deliberately NOT in date order — the sort must come from startsOn.
  { id: 'seismic-2026', name: 'Seismic Dance Event 9.0', year: "'26", startsOn: '2026-11-13', accent: '250, 204, 21' },
  { id: 'portola-2026', name: 'Portola', year: "'26", startsOn: '2026-09-26', accent: '56, 189, 248' },
  { id: 'ef-2026', name: 'Electric Forest', year: "'26", startsOn: '2026-06-25' },
  { id: 'lolla-2025', name: 'Lollapalooza', year: "'25", startsOn: '2025-07-31', status: 'archived' },
  { id: 'wicked-2025', name: 'Wicked Oaks', year: "'25", startsOn: '2025-10-25', status: 'archived' },
];

const docs = {
  crewA: { people: { Kevin: { colorIndex: 0 }, Rosss: { colorIndex: 1 } },
           festivals: { 'portola-2026': {}, 'seismic-2026': {} } },
  crewB: { people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 2 }, Gone: { removed: true } },
           festivals: { 'ef-2026': {} } },
};
const docFor = (t) => docs[t] || null;

test('landingPairs: every (crew, fest) pair becomes a row, DATE-sorted, past sinking muted-last', () => {
  const crews = [{ token: 'crewA', name: 'Portola 26' }, { token: 'crewB', name: 'EF Crew' }];
  docs.crewB.festivals['lolla-2025'] = {};
  docs.crewB.festivals['wicked-2025'] = {};
  const pairs = landingPairs(crews, docFor, INDEX);
  assert.deepEqual(pairs.map((p) => p.fid),
    ['ef-2026', 'portola-2026', 'seismic-2026', 'wicked-2025', 'lolla-2025'],
    'upcoming soonest-first by startsOn (registry order must not leak through); past fests last, most recent first');
  assert.deepEqual(pairs.map((p) => p.past), [false, false, false, true, true]);
  assert.equal(pairs[1].token, 'crewA', 'each fest row points back at its crew');
  assert.deepEqual(pairs[0].people.map((x) => x.name), ['Kevin', 'Drew'], 'tombstoned people excluded');
  delete docs.crewB.festivals['lolla-2025'];
  delete docs.crewB.festivals['wicked-2025'];
});

test('landingPairs: an uncached crew falls back to one crew-named row, sorted last', () => {
  const crews = [{ token: 'unknown', name: 'Restored Crew' }, { token: 'crewB', name: 'EF Crew' }];
  const pairs = landingPairs(crews, docFor, INDEX);
  assert.equal(pairs[0].fid, 'ef-2026');
  assert.equal(pairs[1].fid, null, 'no cached doc, no fest claims');
  assert.equal(pairs[1].crewName, 'Restored Crew');
});

test('festLabelFor: month rides the year ("Sep \'26" — when, at a glance); slugs prettify', () => {
  const portola = festLabelFor('portola-2026', INDEX);
  assert.equal(portola.name, 'Portola');
  assert.equal(portola.year, "Sep '26", 'month from startsOn + the styled year');
  assert.equal(portola.accent, '56, 189, 248');
  const noStart = festLabelFor('x', [{ id: 'x', name: 'X Fest', year: "'27" }]);
  assert.equal(noStart.year, "'27", 'no startsOn — year alone, never NaN-month');
  const custom = festLabelFor('amish-acl-2026', INDEX);
  assert.equal(custom.name, 'Amish Acl 2026', 'a slug never renders raw');
  assert.equal(custom.accent, null);
});

test('otherFestPeople: recurring humans from other crews, deduped, minus me and existing members', () => {
  const crews = [{ token: 'crewA', name: 'Portola 26' }, { token: 'crewB', name: 'EF Crew' }];
  const here = { Caitlin: { colorIndex: 3 } };
  const picks = otherFestPeople('crewC', crews, docFor, here, 'Kevin');
  assert.deepEqual(picks.map((p) => p.name), ['Rosss', 'Drew'],
    'me excluded, tombstones excluded, Caitlin already here');
  assert.equal(picks[0].fromCrew, 'Portola 26');
  // Case-insensitive dedupe across crews and against current members.
  const picksCase = otherFestPeople('crewC', crews, docFor, { drew: {} }, 'KEVIN');
  assert.deepEqual(picksCase.map((p) => p.name), ['Rosss']);
});
