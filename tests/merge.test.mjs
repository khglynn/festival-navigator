import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepMerge } from '../js/merge.js';

test('overlay leaves win', () => {
  assert.deepEqual(deepMerge({ a: 1, b: 2 }, { b: 3 }), { a: 1, b: 3 });
});

test('objects merge recursively without clobbering siblings', () => {
  const base = { fest: { selections: { GRiZ: { Kevin: 3 } } } };
  const overlay = { fest: { selections: { GRiZ: { Drew: 1 } } } };
  assert.deepEqual(deepMerge(base, overlay), {
    fest: { selections: { GRiZ: { Kevin: 3, Drew: 1 } } },
  });
});

test('tombstone semantics: removed:true overlays, removed:false revives', () => {
  const withPerson = { people: { Rob: { color: 'c1' } } };
  const tombstoned = deepMerge(withPerson, { people: { Rob: { removed: true } } });
  assert.equal(tombstoned.people.Rob.removed, true);
  assert.equal(tombstoned.people.Rob.color, 'c1'); // merge keeps other leaves
  const revived = deepMerge(tombstoned, { people: { Rob: { color: 'c1', removed: false } } });
  assert.equal(revived.people.Rob.removed, false);
});

test('level 0 carries through merge (pick removal syncs)', () => {
  const base = { selections: { GRiZ: { Kevin: 3 } } };
  assert.equal(deepMerge(base, { selections: { GRiZ: { Kevin: 0 } } }).selections.GRiZ.Kevin, 0);
});

test('null/undefined overlay returns base', () => {
  const base = { a: 1 };
  assert.equal(deepMerge(base, undefined), base);
  assert.equal(deepMerge(base, null), base);
});

test('does not mutate base', () => {
  const base = { a: { b: 1 } };
  deepMerge(base, { a: { c: 2 } });
  assert.deepEqual(base, { a: { b: 1 } });
});

// THE REGRESSION (2026-07-13): an array landing on a key that held nothing
// walked the object path and came out as {"0":..,"1":..}. persistPending
// wrote that to disk, every push re-sent it, the server validator refused it
// ("artists must be an array"), and the device was sync-blocked forever.
test('an array landing where nothing existed STAYS an array', () => {
  const merged = deepMerge(undefined, ['GRiZ', 'Lane 8']);
  assert.ok(Array.isArray(merged));
  assert.deepEqual(merged, ['GRiZ', 'Lane 8']);
  const nested = deepMerge({}, { spotify: { playlists: { ef: { artists: ['GRiZ'] } } } });
  assert.ok(Array.isArray(nested.spotify.playlists.ef.artists));
});

test('arrays replace wholesale — same semantics as jsonb_deep_merge', () => {
  // No index-merge: a shorter overlay must not keep the base's stale tail.
  assert.deepEqual(deepMerge({ a: ['x', 'y', 'z'] }, { a: ['q'] }), { a: ['q'] });
  // Type flips replace in both directions, like the SQL's non-object branch.
  assert.deepEqual(deepMerge({ a: ['x'] }, { a: { k: 1 } }), { a: { k: 1 } });
  assert.deepEqual(deepMerge({ a: { k: 1 } }, { a: ['x'] }), { a: ['x'] });
});
