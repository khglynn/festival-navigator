import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeToMinutes, absMinToLabel, activityMinutes, computeDayArtists } from '../js/time.js';

test('timeToMinutes: PM afternoon', () => {
  assert.equal(timeToMinutes('6:30 PM'), 18 * 60 + 30);
  assert.equal(timeToMinutes('12:00 PM'), 12 * 60);
});

test('timeToMinutes: AM reads as after-midnight', () => {
  assert.equal(timeToMinutes('12:30 AM'), 24 * 60 + 30);
  assert.equal(timeToMinutes('2:45 AM'), 24 * 60 + 2 * 60 + 45);
});

test('timeToMinutes: after-midnight sorts after late PM', () => {
  assert.ok(timeToMinutes('1:00 AM') > timeToMinutes('11:45 PM'));
});

test('absMinToLabel round-trips hours', () => {
  assert.equal(absMinToLabel(18 * 60), '6:00 PM');
  assert.equal(absMinToLabel(24 * 60), '12:00 AM');
  assert.equal(absMinToLabel(26 * 60), '2:00 AM');
});

test('activityMinutes: 9 AM boundary', () => {
  // 8:59 AM reads as after-midnight (next morning); 9:00 AM is a morning workshop.
  assert.ok(activityMinutes('8:59 AM') > activityMinutes('11:00 PM'));
  assert.ok(activityMinutes('9:00 AM') < activityMinutes('1:00 PM'));
});

test('computeDayArtists: fills missing ends from next set on same stage (clamped 30..120)', () => {
  const day = {
    artists: [
      { name: 'A', stage: 'Main', time: '6:00 PM' },
      { name: 'B', stage: 'Main', time: '9:00 PM' },  // gap 180 -> A clamped to 120
      { name: 'C', stage: 'Main', time: '9:15 PM' },  // gap 15 -> B clamped to 30
    ],
  };
  const out = computeDayArtists(day);
  const byName = Object.fromEntries(out.map(a => [a.name, a]));
  assert.equal(byName.A.endMin - byName.A.startMin, 120);
  assert.equal(byName.B.endMin - byName.B.startMin, 30);
  assert.equal(byName.C.endMin - byName.C.startMin, 75); // last set default
});

test('computeDayArtists: explicit range and "close" handling', () => {
  const day = {
    artists: [
      { name: 'A', stage: 'Main', time: '6:00 PM - 7:30 PM' },
      { name: 'B', stage: 'Main', time: '11:00 PM - Close' },
    ],
  };
  const out = computeDayArtists(day);
  const byName = Object.fromEntries(out.map(a => [a.name, a]));
  assert.equal(byName.A.endMin - byName.A.startMin, 90);
  assert.equal(byName.B.endMin - byName.B.startMin, 75); // "Close" = unknown end -> default
});
