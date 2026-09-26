// A finger leaves a ghost of a mouse where it lifted (2026-09-23).
//
// The meter's real-input walk found a WebKit phone zooming a card nobody
// held. Traced in Playwright's WebKit with the whole event stream logged: a
// touch tap on a card is followed by a trusted `click` whose pointerType is
// "mouse", and ~200ms later — when the pick's refreshCard swaps a fresh card
// in under the spot the finger lifted from — by trusted `pointerover` /
// `pointerenter` events, pointerType "mouse", at that exact spot. The hover
// intent (wireCardZoom) believed them, and the card you had just TAPPED grew
// 200ms later as a mouse zoom — one that only closes on a hover-out a phone
// can never send. Scroll a new card under that spot and it grew instead
// (the walker's "wrong card"). WebKit's own tracker records the same family
// on iOS 26: mouse-type pointer boundary events around a node removed
// during a touch (bugs.webkit.org/show_bug.cgi?id=214609, comment 6,
// 2026-01-26). Chromium sends nothing of the kind.
//
// The rule (card-facts.js `touchAt`): after a touch or pen press, mouse
// events AT A SPOT A FINGER RECENTLY LANDED OR LIFTED are the ghost's and arm
// nothing; a mouse that really moves off them, or presses, is believed again
// at once. A desktop that never sees a finger never meets the rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, window, zoom, makeCtx, mountCard, pointerEvent, wait } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
const slot = () => document.querySelector('#zoom-layer .zoom-slot');
const wire = (card, ctx) => zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
const INTENT = zoom.ZOOM_IN_MS + 60;
const press = (target, pointerType, x, y) => target.dispatchEvent(pointerEvent('pointerdown', { pointerType, bubbles: true, clientX: x, clientY: y }));
const enter = (card, x, y) => card.dispatchEvent(pointerEvent('pointerenter', { clientX: x, clientY: y }));
const move = (x, y, target = document.body) => target.dispatchEvent(pointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));

test.afterEach(() => { zoom.unzoom({ instant: true }); press(document.body, 'mouse', 0, 0); });

test('the ghost of a tap never grows the card under it', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card, 'touch', 120, 300);   // a finger taps the card…
  move(120, 300, card);             // …and WebKit sends a "mouse" there
  enter(card, 120, 300);
  await wait(INTENT);
  assert.equal(slot(), null, 'a mouse-type enter at the spot a finger lifted is the ghost, not a hand');
  assert.equal(zoom.zoomedCard(), null);
});

test('the ghost may report from where the finger LIFTED — a real tap drifts a few px', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card, 'touch', 100, 100);
  card.dispatchEvent(pointerEvent('pointerup', { pointerType: 'touch', bubbles: true, clientX: 107, clientY: 104 }));
  enter(card, 107, 104);
  await wait(INTENT);
  assert.equal(slot(), null, 'the lift point is the ghost’s too');
});

test('an earlier tap’s ghost is still a ghost: every recent finger point counts', async () => {
  // Found replaying the meter walk: a synthetic press elsewhere moved a
  // single remembered point away from where the engine's ghost still sat.
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card, 'touch', 215, 422);
  press(document.body, 'touch', 30, 700);
  enter(card, 215, 422);
  await wait(INTENT);
  assert.equal(slot(), null);
});

test('a card swapped in under the ghost (every pick does it) is not grown either', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card, 'touch', 80, 60);
  const fresh = ctx.onTap('GRiZ', card); // the real pick: refreshCard swaps the node under the finger
  wire(fresh, ctx);
  enter(fresh, 80, 60);                  // the boundary event WebKit fires at the fresh node
  await wait(INTENT);
  assert.equal(slot(), null, 'the tapped card picked, and stayed resting');
});

test('the born-under check does not believe the ghost either', async () => {
  // A card rendered under a resting MOUSE grows (wireCardZoom's one-frame
  // check, 2026-08-31). A resting finger-ghost is not a resting mouse.
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const real = document.elementFromPoint;
  try {
    move(40, 40);                          // a real mouse was once here (a hybrid laptop)…
    press(document.body, 'touch', 40, 40); // …then a finger touched the same spot
    move(40, 40);                          // and the ghost reports from it
    document.elementFromPoint = () => card;
    wire(card, ctx);                       // the frame check runs now (the rig's rAF is synchronous)
    await wait(INTENT);
    assert.equal(slot(), null, 'no hover zoom from a spot only a finger has touched since');
  } finally {
    document.elementFromPoint = real;
  }
});

test('a real mouse that moves off the spot is believed at once — a hybrid laptop still hovers', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card, 'touch', 120, 300);
  move(180, 320);          // the trackpad moves the pointer away: a hand, not a ghost
  enter(card, 150, 310);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), card, 'hover intent grew it');
});

test('a hand that moves WITHIN the card the ghost entered grows it — the first real move is its entry', async () => {
  // The ghost's enter is ignored, and a pointer already inside a card gets
  // no second pointerenter — so a trackpad nudged on the card a finger just
  // tapped would never hover it until it left and came back.
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card, 'touch', 120, 300);
  enter(card, 120, 300);                 // the ghost's entry: ignored
  move(120, 300, card);                  // the ghost again: still nothing
  await wait(INTENT);
  assert.equal(slot(), null);
  move(135, 304, card);                  // the hand, over the same card
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), card, 'hover intent grew it');
});

test('a mouse press ends the ghost rule, even on the same spot', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card, 'touch', 120, 300);
  press(document.body, 'mouse', 120, 300);
  enter(card, 120, 300);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), card, 'a mouse button pressed is a mouse');
});

test('a desktop that never sees a finger hovers exactly as before', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  // A hand's entry as the engines send it: it comes from elsewhere, and the
  // enter at the new pixel precedes the move that reports it. (An enter at
  // the pixel the mouse last moved to is content sliding under a still hand
  // — tests/zoom-still-hand.test.mjs — which is not what this pins.)
  move(100, 300);
  enter(card, 120, 300);
  move(120, 300, card);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), card);
});

test('a finger held on a card, then lifted, grows nothing — and its ghost at the lift point grows nothing either', async () => {
  // The long-press went with the tap change (2026-09-26): a hold is a slow
  // tap, and the tap opens the card's shelf (app.js), never a zoom. What is
  // left for this module is the ghost rule, which matters more than ever: the
  // mouse-type events WebKit sends where the finger lifted must not grow the
  // card the finger just opened.
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  Object.defineProperty(card, 'offsetParent', { get: () => document.body });
  press(card, 'touch', 120, 300);
  await wait(560);
  card.dispatchEvent(pointerEvent('pointerup', { pointerType: 'touch', clientX: 120, clientY: 300 }));
  assert.equal(zoom.zoomedCard(), null, 'no long-press zoom');
  enter(card, 120, 300);
  move(120, 300, card);
  await wait(INTENT);
  assert.equal(zoom.zoomedCard(), null, 'the ghost at the lift point is not a hand');
});

void window;
