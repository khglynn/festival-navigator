// The fest-first landing (fests × circles × you): landingPairs turns the
// device's known crews into FESTIVAL rows, and otherFestPeople powers the
// + Add sheet's one-tap picker of recurring humans. Pure functions — these
// are the testable heart of the reshape; the DOM around them is walked live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingPairs, festLabelFor, otherFestPeople } from '../js/v3/model.js';

const INDEX = [
  { id: 'seismic-2026', name: 'Seismic Dance Event 9.0', year: "'26", accent: '250, 204, 21' },
  { id: 'portola-2026', name: 'Portola', year: "'26", accent: '56, 189, 248' },
  { id: 'ef-2026', name: 'Electric Forest', year: "'26" },
];

const docs = {
  crewA: { people: { Kevin: { colorIndex: 0 }, Rosss: { colorIndex: 1 } },
           festivals: { 'portola-2026': {}, 'seismic-2026': {} } },
  crewB: { people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 2 }, Gone: { removed: true } },
           festivals: { 'ef-2026': {} } },
};
const docFor = (t) => docs[t] || null;

test('landingPairs: every (crew, fest) pair becomes a row, in festival-index order', () => {
  const crews = [{ token: 'crewA', name: 'Portola 26' }, { token: 'crewB', name: 'EF Crew' }];
  const pairs = landingPairs(crews, docFor, INDEX);
  assert.deepEqual(pairs.map((p) => p.fid), ['seismic-2026', 'portola-2026', 'ef-2026'],
    'index order wins — NOT crew-registry order (the Portola-crew-opens-Seismic confusion, fixed)');
  assert.equal(pairs[0].token, 'crewA', 'both crewA fests point back at crewA');
  assert.deepEqual(pairs[2].people.map((x) => x.name), ['Kevin', 'Drew'], 'tombstoned people excluded');
});

test('landingPairs: an uncached crew falls back to one crew-named row, sorted last', () => {
  const crews = [{ token: 'unknown', name: 'Restored Crew' }, { token: 'crewB', name: 'EF Crew' }];
  const pairs = landingPairs(crews, docFor, INDEX);
  assert.equal(pairs[0].fid, 'ef-2026');
  assert.equal(pairs[1].fid, null, 'no cached doc, no fest claims');
  assert.equal(pairs[1].crewName, 'Restored Crew');
});

test('festLabelFor: catalog fests get real metadata; crew-private ids prettify', () => {
  assert.equal(festLabelFor('portola-2026', INDEX).name, 'Portola');
  assert.equal(festLabelFor('portola-2026', INDEX).accent, '56, 189, 248');
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
