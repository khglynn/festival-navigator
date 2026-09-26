// Keeping your place while the wall changes shape (v93). A room folded or
// unfolded from the Show menu rebuilds the wall; the element at the top of
// what you see — a card or a room's head — stays where it was on screen.
// Until v93 the page landed on the top of your day instead, and once the menu
// stayed up for several ticks, every tick snapped a friend scrolled into
// Saturday evening back to "SAT PORTOLA · 1 PM" (the independent walk:
// 3400 -> 552 -> 2812 -> 552 -> 2812). The choice is pure, so it is tested with
// numbers here; the real page is the browser contract's
// (tests/browser/shell-contract.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
const { pickWallAnchor, resolveWallAnchor, wallAnchors } = await import('../js/v3/wall.js');

// Saturday evening on a phone, the band under the chrome starting at 6px:
// Thursday's and Friday's afters are far above, off screen.
const items = [
  { key: 'head|Thursday|Afters', top: -2900 },
  { key: 'card|Thursday|Afters|Soulwax|t', top: -2800 },
  { key: 'head|Friday|Afters', top: -2100 },
  { key: 'head|Saturday|:fest', top: -1400 },
  { key: 'card|Saturday|:fest|Tove Lo|s', top: -120 },
  { key: 'card|Saturday|:fest|Robyn|s', top: 40 },
  { key: 'card|Saturday|:fest|Fatboy Slim|s', top: 180 },
  { key: 'head|Saturday|Afters', top: 900 },
  { key: 'card|Saturday|Afters|Milli Meng|s', top: 980 },
  { key: 'head|Sunday|:fest', top: 2200 },
];

test('the element nearest the top of what you see holds your place — Robyn, not the day’s head 1400px up', () => {
  const a = pickWallAnchor(items, 6, 3400);
  assert.equal(a.key, 'card|Saturday|:fest|Robyn|s');
  assert.equal(a.top, 40, 'and where it stood on screen');
  assert.deepEqual(a.after.slice(0, 2), ['card|Saturday|:fest|Fatboy Slim|s', 'head|Saturday|Afters'], 'with what follows it, in order');
});

test('kept: after the fold the same element is the anchor, wherever the days above went', () => {
  const a = pickWallAnchor(items, 6, 3400);
  const afterFold = items.filter((it) => !it.key.includes('|Afters')).map((it) => it.key); // Afters hidden
  assert.equal(resolveWallAnchor(a, afterFold), 'card|Saturday|:fest|Robyn|s');
});

test('the anchor went with the room you hid: the next element after it that is left holds the place', () => {
  // Standing in Saturday's afters (scrolled 950px further), hiding Afters:
  // the next thing left is Sunday's head.
  const standingInAfters = pickWallAnchor(items.map((it) => ({ ...it, top: it.top - 950 })), 6, 5200);
  assert.equal(standingInAfters.key, 'card|Saturday|Afters|Milli Meng|s');
  const afterFold = items.filter((it) => !it.key.includes('|Afters')).map((it) => it.key);
  assert.equal(resolveWallAnchor(standingInAfters, afterFold), 'head|Sunday|:fest', 'the next room’s head');
});

test('nothing left below it: the last element left; nothing left at all: none (the page goes to the top)', () => {
  const last = pickWallAnchor(items, 6, 9000);
  assert.ok(last, 'an anchor');
  const onlyEarly = ['head|Thursday|Afters', 'head|Saturday|:fest'];
  const anchorLate = { key: 'head|Sunday|:fest', top: 10, after: [] };
  assert.equal(resolveWallAnchor(anchorLate, onlyEarly), 'head|Saturday|:fest', 'the last one left');
  assert.equal(resolveWallAnchor(anchorLate, []), null, 'everything hidden');
});

test('at the top of the page there is nothing to keep, and nothing moves', () => {
  assert.equal(pickWallAnchor(items, 6, 0), null);
  assert.equal(resolveWallAnchor(null, ['head|Saturday|:fest']), null);
});

test('scrolled past everything: the last element; a tie goes to the first in the wall’s order', () => {
  assert.equal(pickWallAnchor(items.map((it) => ({ ...it, top: it.top - 9000 })), 6, 12000).key, 'head|Sunday|:fest');
  const tie = [{ key: 'a', top: 20 }, { key: 'b', top: 20 }];
  assert.equal(pickWallAnchor(tie, 6, 100).key, 'a');
});

test('keys survive a rebuild: day, room, artist and occurrence, and the n-th of an artist playing one room twice', () => {
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="day-block" data-day="Saturday">
      <div class="room" data-room="Afters">
        <button class="room-head"></button>
        <div class="card" data-artist="Galen" data-occ="a"></div>
        <div class="card" data-artist="Galen" data-occ="a"></div>
      </div>
    </div>`;
  assert.deepEqual(wallAnchors(root).map((a) => a.key), [
    'head|Saturday|Afters',
    'card|Saturday|Afters|Galen|a',
    'card|Saturday|Afters|Galen|a|2',
  ]);
});
