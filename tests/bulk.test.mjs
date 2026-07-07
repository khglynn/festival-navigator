import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkLine } from '../js/parse.js';

test('basic line', () => {
  assert.deepEqual(parseBulkLine('Kevin: GRiZ (Must See)'), { person: 'Kevin', artistName: 'GRiZ', level: 3 });
});

test('levels map correctly', () => {
  assert.equal(parseBulkLine('K: A (Nice to See)').level, 1);
  assert.equal(parseBulkLine('K: A (Highlight)').level, 2);
  assert.equal(parseBulkLine('K: A (New Discovery)').level, 2);
  assert.equal(parseBulkLine('K: A (Must See)').level, 3);
  assert.equal(parseBulkLine('K: A (unknown level)').level, 1); // default
});

test('artist names with parentheses survive (greedy + end anchor)', () => {
  const p = parseBulkLine('Drew: Suzanne (Opening) (Must See)');
  assert.equal(p.artistName, 'Suzanne (Opening)');
  assert.equal(p.level, 3);
});

test('garbage lines return null', () => {
  assert.equal(parseBulkLine('not a valid line'), null);
  assert.equal(parseBulkLine(''), null);
});
