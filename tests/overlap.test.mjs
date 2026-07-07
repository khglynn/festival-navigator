import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLanes } from '../js/overlap.js';

const set = (name, stage, startMin, endMin) => ({ name, stage, startMin, endMin });

test('non-overlapping sets get full width (lanes=1)', () => {
  const a = set('A', 'Main', 0, 60), b = set('B', 'Main', 60, 120);
  const lanes = computeLanes([a, b]);
  assert.deepEqual(lanes.get(a), { lane: 0, lanes: 1 });
  assert.deepEqual(lanes.get(b), { lane: 0, lanes: 1 });
});

test('two overlapping sets split the column', () => {
  const a = set('A', 'Main', 0, 90), b = set('B', 'Main', 60, 120);
  const lanes = computeLanes([a, b]);
  assert.deepEqual(lanes.get(a), { lane: 0, lanes: 2 });
  assert.deepEqual(lanes.get(b), { lane: 1, lanes: 2 });
});

test('same start time on same stage (the EF Silent Disco case)', () => {
  const a = set('A', 'Honeycomb', 1200, 1320), b = set('B', 'Honeycomb', 1200, 1320);
  const lanes = computeLanes([a, b]);
  assert.equal(lanes.get(a).lanes, 2);
  assert.notEqual(lanes.get(a).lane, lanes.get(b).lane);
});

test('chain overlap forms one cluster; lane reuse after a set ends', () => {
  // A 0-60, B 30-90, C 60-120: A-B overlap, B-C overlap, A-C do NOT.
  // One cluster of width 2; C reuses A's freed lane.
  const a = set('A', 'M', 0, 60), b = set('B', 'M', 30, 90), c = set('C', 'M', 60, 120);
  const lanes = computeLanes([a, b, c]);
  assert.equal(lanes.get(a).lanes, 2);
  assert.equal(lanes.get(c).lanes, 2);
  assert.equal(lanes.get(c).lane, lanes.get(a).lane); // reused
});

test('triple simultaneous = three lanes', () => {
  const sets = [set('A', 'M', 0, 60), set('B', 'M', 0, 60), set('C', 'M', 0, 60)];
  const lanes = computeLanes(sets);
  assert.equal(lanes.get(sets[0]).lanes, 3);
  assert.equal(new Set(sets.map((s) => lanes.get(s).lane)).size, 3);
});

test('different stages never interact', () => {
  const a = set('A', 'M1', 0, 60), b = set('B', 'M2', 0, 60);
  const lanes = computeLanes([a, b]);
  assert.equal(lanes.get(a).lanes, 1);
  assert.equal(lanes.get(b).lanes, 1);
});
