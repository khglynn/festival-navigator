// ST-1 regression: a multi-day artist appears under EACH of its real days —
// never as a combined "Saturday & Sunday" section (spec F4). splitDays only
// splits strings that are clean combinations of known day names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const { splitDays, groupByDay, knownDaysOf } = await import('../js/v3/wall.js');

const DAYS = ['Friday', 'Saturday', 'Sunday'];

test('splitDays: clean combinations of known days split; anything else stays', () => {
  assert.deepEqual(splitDays('Saturday & Sunday', DAYS), ['Saturday', 'Sunday']);
  assert.deepEqual(splitDays('saturday and sunday', DAYS), ['Saturday', 'Sunday']);
  assert.deepEqual(splitDays('Friday, Saturday & Sunday', DAYS), ['Friday', 'Saturday', 'Sunday']);
  assert.equal(splitDays('Saturday', DAYS), null, 'single day is not a combination');
  assert.equal(splitDays('Saturday & Someday', DAYS), null, 'unknown part = literal group');
  assert.equal(splitDays('', DAYS), null);
  assert.equal(splitDays('Saturday & Sunday', []), null, 'no known days = no split');
});

test('groupByDay: multi-day artists land under each day, order follows known days', () => {
  const artists = [
    { name: 'Headliner', day: 'Saturday' },
    { name: 'BothDays', day: 'Saturday & Sunday' },
    { name: 'Opener', day: 'Friday' },
    { name: 'NoDay' },
  ];
  const groups = groupByDay(artists, DAYS);
  assert.deepEqual([...groups.keys()], ['', 'Friday', 'Saturday', 'Sunday']);
  assert.deepEqual(groups.get('Saturday').map((a) => a.name), ['Headliner', 'BothDays']);
  assert.deepEqual(groups.get('Sunday').map((a) => a.name), ['BothDays']);
  assert.deepEqual(groups.get('').map((a) => a.name), ['NoDay']);
});

test('groupByDay without known days keeps the old literal behavior', () => {
  const artists = [{ name: 'A', day: 'Saturday & Sunday' }];
  const groups = groupByDay(artists, []);
  assert.deepEqual([...groups.keys()], ['Saturday & Sunday']);
});

test('knownDaysOf: dayMeta keys win; else atomic day values in order', () => {
  assert.deepEqual(knownDaysOf({ dayMeta: { Friday: {}, Saturday: {} } }), ['Friday', 'Saturday']);
  assert.deepEqual(
    knownDaysOf({ artists: [{ day: 'Saturday' }, { day: 'Saturday & Sunday' }, { day: 'Sunday' }] }),
    ['Saturday', 'Sunday'],
  );
});
