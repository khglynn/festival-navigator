// Content moving under a still pointer is not the hand arriving (2026-09-24).
//
// The v87 review, Chromium 1280×800 with a mouse: click NOW, the page glides
// down and the rail sticks at the top, so the resting pointer is now over the
// wall. The engine fires boundary events at the pointer's own pixel for
// whatever card slid under it; hover intent believed them, Skepta's zoom
// bloomed over the rail and covered NOW, and the next click on NOW picked
// Skepta — a write to the shared crew doc, on a cancelled act. Day-tab jumps,
// wheels and trackpads share the mechanism.
//
// The rule (card-facts.js `handCard`): the hand is on the card that was under
// the pointer the last time the mouse actually MOVED. An entry at the pixel
// the mouse last moved to arms a card only if the hand was already on it (a
// repaint swapping its node under a resting hand keeps hovering); any other
// card waits for the hand to move, and one small move over it arms it as
// usual. A pointermove restating the same pixel (WebKit sends one after a
// scroll) is not a move. The real-browser twin is
// tests/browser/zoom-still-hand.test.mjs.
//
// Event order matters and is the browsers': for a real entry the enter at
// the NEW pixel comes before the pointermove that reports it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, zoom, makeCtx, mountCard, pointerEvent, wait } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
const wire = (card, ctx, artist = 'GRiZ') => zoom.wireCardZoom(card, artist, ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
const INTENT = zoom.ZOOM_IN_MS + 60;
const enter = (el, x, y) => el.dispatchEvent(pointerEvent('pointerenter', { clientX: x, clientY: y }));
const move = (x, y, target = document.body) => target.dispatchEvent(pointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
const press = (target, x, y) => target.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true, clientX: x, clientY: y }));

test.afterEach(() => { zoom.unzoom({ instant: true }); press(document.body, 0, 0); move(1, 1); });

test('a card that slides under a still pointer does not grow; the first small move over it does', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  move(160, 132); // the hand, on NOW (not a card)
  // The page glides; the engine reports the card now under the pointer, at the pointer's own pixel.
  enter(card, 160, 132);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), null, 'content moving under a still hand is not the hand arriving');
  // WebKit restates the pointer after a scroll: a pointermove at the SAME pixel.
  move(160, 132, card);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), null, 'a pointermove at the pixel the mouse already stood on is not a move');
  // The hand nudges: one pixel is a hand.
  move(161, 132, card);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), card, 'one small real move over the card grows it, after the usual intent delay');
});

test('the card the hand was already on keeps hovering when its node is swapped under the still hand', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  move(100, 300); // coming from elsewhere…
  enter(card, 120, 300); // …the hand enters (a new pixel)
  move(120, 300, card);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), card, 'a real entry grows it');
  zoom.unzoom({ instant: true });
  // A fresh node with the same identity (a repaint) reports an enter at the resting pixel.
  const fresh = mountCard(ctx);
  wire(fresh, ctx);
  enter(fresh, 120, 300);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), fresh, 'the hand was on this card: a repaint under it keeps it hovering');
});

test('a hand resting on one card does not grow another that a scroll brings under it', async () => {
  const ctx = makeCtx();
  const a = mountCard(ctx);
  wire(a, ctx);
  move(100, 300);
  enter(a, 120, 300);
  move(120, 300, a); // the hand is on GRiZ
  zoom.unzoom({ instant: true });
  // A different card (another artist) slides under the same pixel.
  ctx.picks['Other Act'] = {};
  const b = mountCard(ctx);
  b.dataset.artist = 'Other Act';
  wire(b, ctx, 'Other Act');
  enter(b, 120, 300);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), null, 'another card under a still hand waits for the hand');
  move(118, 301, b);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), b, 'and grows the moment the hand moves on it');
});
