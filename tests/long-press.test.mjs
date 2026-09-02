// The long-press is a FINGER gesture. It used to arm on any pointerdown, so a
// mouse held on a resting card for half a second opened a touch-style zoom —
// one that ignores hover-out and swallows its next click — and on a card the
// hover intent had put away (dismissedEl) that was the only zoom a mouse
// could get. Found while tracing the 2026-09-02 hover report; the hover
// intent usually won the race and hid it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, makeCtx, pointerEvent, wait, renderCard } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
const HOLD = 520; // wall.js arms the peek at 500ms

function mount(ctx) {
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  const card = renderCard('GRiZ', ctx, { occ: OCC });
  wall.appendChild(card);
  // jsdom has no layout: offsetParent is null, which the press timer reads as
  // "the wall is hidden". Give it a parent so the gesture can fire.
  Object.defineProperty(card, 'offsetParent', { value: wall, configurable: true });
  return card;
}

test('a finger held on a card peeks it', async () => {
  const ctx = makeCtx();
  const peeks = [];
  ctx.onPeek = (artist) => peeks.push(artist);
  const card = mount(ctx);
  card.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
  await wait(HOLD);
  assert.deepEqual(peeks, ['GRiZ']);
});

test('a mouse held on a card never peeks — hover is the mouse route', async () => {
  const ctx = makeCtx();
  const peeks = [];
  ctx.onPeek = (artist) => peeks.push(artist);
  const card = mount(ctx);
  card.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }));
  await wait(HOLD);
  assert.deepEqual(peeks, [], 'a held mouse button is a slow click, not a hold');
});

test('a pen held on a card peeks like a finger', async () => {
  const ctx = makeCtx();
  const peeks = [];
  ctx.onPeek = (artist) => peeks.push(artist);
  const card = mount(ctx);
  card.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'pen', bubbles: true }));
  await wait(HOLD);
  assert.deepEqual(peeks, ['GRiZ']);
});

test('a lift inside the hold cancels it', async () => {
  const ctx = makeCtx();
  const peeks = [];
  ctx.onPeek = (artist) => peeks.push(artist);
  const card = mount(ctx);
  card.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
  await wait(120);
  card.dispatchEvent(pointerEvent('pointerup', { pointerType: 'touch', bubbles: true }));
  await wait(HOLD);
  assert.deepEqual(peeks, []);
});
