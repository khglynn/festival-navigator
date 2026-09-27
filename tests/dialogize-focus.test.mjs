// A sheet takes focus in the frame after it opens (notes.js dialogize), so a
// screen reader lands in the dialog. That frame used to take focus from
// whatever had it, including the sheet's own composer. A finger that reached
// the box before the frame ran lost the keyboard mid-word, and the rest of
// what it typed went to the sheet.
//
// CI caught it (2026-09-27): tap-shelf-contract's composer test failed about
// once in 80 browser jobs, its value cut to "Pier " or "Pi". An instrumented copy logged
// focus() on #artist-sheet from Playwright's clock in the middle of the
// typing: memberPhone's fixed clock holds requestAnimationFrame and lets it
// go late. On a phone the frame is late only after a long task, which makes
// the steal rare there, but it is real. Here the frame is held by hand, so
// the order is certain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const frames = [];
globalThis.requestAnimationFrame = (fn) => frames.push(fn);
const runFrames = () => frames.splice(0).forEach((fn) => fn());
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const { dialogize } = await import('../js/v3/notes.js');

// The tapped card keeps focus after the tap, as the probe's log showed.
function openSheet() {
  document.body.replaceChildren();
  const card = document.createElement('div');
  card.className = 'card';
  card.tabIndex = 0;
  const sheet = document.createElement('div');
  sheet.id = 'artist-sheet';
  const box = document.createElement('textarea');
  box.className = 'n-field';
  sheet.appendChild(box);
  document.body.append(card, sheet);
  card.focus();
  dialogize(sheet, 'Tove Lo');
  return { card, sheet, box };
}

test('the sheet takes focus from the card that opened it, in its first frame', () => {
  const { card, sheet } = openSheet();
  assert.equal(document.activeElement, card, 'nothing moves before the frame');
  runFrames();
  assert.equal(document.activeElement, sheet);
});

test('a finger that reached the composer before that frame keeps it, and what it typed', () => {
  const { box } = openSheet();
  box.focus();
  box.value = 'Pier ';
  runFrames();
  assert.equal(document.activeElement, box, 'the frame left the composer its focus');
  assert.equal(box.value, 'Pier ');
});

test('a sheet closed before its frame takes nothing', () => {
  const { card, sheet } = openSheet();
  sheet.remove();
  runFrames();
  assert.equal(document.activeElement, card);
});
