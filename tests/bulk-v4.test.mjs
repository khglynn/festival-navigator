// CORE-8 regression: bulk paste is an integrity gate, not a hopeful parser.
// Unknown level labels never coerce to level 1; unknown artists never count
// as applied; a migration-gated crew applies NOTHING and says so.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const { parseBulkLineV4 } = await import('../js/parse.js');
const state = await import('../js/state.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { applyBulkText } = await import('../js/v3/tools.js');

test('parseBulkLineV4: unknown level labels return null, known ones map', () => {
  assert.equal(parseBulkLineV4('K: A (definitely going)'), null);
  assert.equal(parseBulkLineV4('K: A (must)').level, 4);
  assert.equal(parseBulkLineV4('K: A (Must See)').level, 4);
  assert.equal(parseBulkLineV4('K: A (Picked ×3)').level, 3);
  assert.equal(parseBulkLineV4('K: A (Picked x2)').level, 2);
  assert.equal(parseBulkLineV4('K: A (Highlight)').level, 2);
  assert.equal(parseBulkLineV4('K: A (Picked)').level, 1);
  assert.equal(parseBulkLineV4('K: A (Nice to See)').level, 1);
});

FESTIVAL_INDEX.push({ id: 'bulk-fest', status: 'lineup' });
FESTIVALS['bulk-fest'] = {
  id: 'bulk-fest',
  name: 'Bulk Fest',
  artists: [{ name: 'GRiZ' }, { name: 'Zeds Dead' }],
};
const TOKEN = 'bulktesttoken_0123456789';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 }, Gone: { colorIndex: 2, removed: true } },
  festivals: {}, affinity: {},
}, 'bulk-fest');

test('applyBulkText: only known people + lineup artists apply, all skips reported', () => {
  const recorded = [];
  const text = [
    'Kevin: GRiZ (Must)',
    'Kevin: griz (Picked)',            // case-insensitive, canonical spelling recorded
    'Kevin: Not A Real Artist (Must)', // unknown artist — skipped, reported
    'Stranger: GRiZ (Must)',           // unknown person — skipped, reported
    'Gone: GRiZ (Must)',               // removed person — skipped
    'Drew: Zeds Dead (banana)',        // unknown level — bad line
    'not a line at all',
  ].join('\n');
  const r = applyBulkText(text, (artist, person, level) => { recorded.push([artist, person, level]); return true; });
  assert.equal(r.applied, 2);
  assert.equal(r.blocked, false);
  assert.deepEqual(recorded, [['GRiZ', 'Kevin', 4], ['GRiZ', 'Kevin', 1]]);
  assert.deepEqual(r.unknownArtists, ['Not A Real Artist']);
  assert.deepEqual(r.unknownPeople.sort(), ['Gone', 'Stranger']);
  assert.equal(r.badLines, 2);
});

test('applyBulkText: a gated recorder blocks the whole batch', () => {
  const r = applyBulkText('Kevin: GRiZ (Must)\nDrew: Zeds Dead (Must)', () => false);
  assert.equal(r.blocked, true);
  assert.equal(r.applied, 0);
});
