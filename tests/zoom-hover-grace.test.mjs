// The hover boundary handlers, which rested on Kevin's browser alone until now
// (2026-09-01 review, coverage rows "Overlay hover bookkeeping", "Hover
// intent", "wireCardZoom's pointerleave", "dismissedEl" and "Instant restore
// under a moved-away mouse"). The existing suite drives only the document-level
// pointermove BELT; the enter/leave pair under it, the intent timer, the
// dismissed mark and the born-under-a-moved-away-hand close had no assertions.
//
// Two of these matter more than their size. The grace close's WHY string is
// the payload of the zoom-close-after-click journal added 2026-08-31 while
// Kevin's "every click closes the hover" was still open — a merge of the leave
// and the belt would silently re-label it, which is exactly the evidence that
// would identify the culprit. And the dismissed mark is a POINTER rule: it is
// cleared by a leave and deliberately not consulted on the keyboard route.
//
// jsdom has no elementFromPoint, so any test that stubs it MUST restore it in a
// finally: `lastMouse` is never cleared once fed, and a live stub plus a set
// lastMouse turns every later instant mouse zoom into a self-closing one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, zoom, makeCtx, mountCard, pointerEvent, feedMouse, wait, errlog } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
const GRACE = zoom.ZOOM_OUT_MS;
const overlay = () => document.querySelector('#zoom-layer .zoom-card');
const slot = () => document.querySelector('.zoom-slot');

test.afterEach(() => zoom.unzoom({ instant: true }));

test('leaving the overlay closes it after the grace — not on the instant of the crossing', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  assert.ok(slot(), 'grown');

  overlay().dispatchEvent(pointerEvent('pointerleave', { relatedTarget: document.body }));
  await wait(GRACE / 2);
  assert.ok(slot(), 'the grace is real — a leave does not close on the spot');
  await wait(GRACE);
  assert.equal(slot(), null, 'and the close lands after ZOOM_OUT_MS');
});

test('coming back inside cancels a pending grace close', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  overlay().dispatchEvent(pointerEvent('pointerleave', { relatedTarget: document.body }));
  await wait(GRACE / 2);
  overlay().dispatchEvent(pointerEvent('pointerenter'));
  await wait(GRACE + 80);
  assert.ok(slot(), 'the re-entry cancelled the close');
  assert.equal(zoom.zoomedCard(), card);
});

test('a leave onto the resting card underneath is not a leave at all', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  overlay().dispatchEvent(pointerEvent('pointerleave', { relatedTarget: card }));
  await wait(GRACE + 80);
  assert.ok(slot(), 'the zoom is two nodes; crossing between them is staying put');
});

test('a non-mouse leave, and a leave from a zoom nobody hovered, are both ignored', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  overlay().dispatchEvent(pointerEvent('pointerleave', { pointerType: 'touch', relatedTarget: document.body }));
  await wait(GRACE + 80);
  assert.ok(slot(), 'a finger crossing the overlay never closes a mouse zoom');
  zoom.unzoom({ instant: true });

  // A keyboard zoom stands until focus says otherwise — hover-out is not its
  // signal, or Tabbing to a card the mouse happens to sit near would flicker.
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, source: 'keyboard' });
  overlay().dispatchEvent(pointerEvent('pointerleave', { relatedTarget: document.body }));
  await wait(GRACE + 80);
  assert.ok(slot(), 'a keyboard zoom does not close on hover-out');
});

test('the leave close and the belt close name themselves differently in the crash journal', async () => {
  // The journal only fires within 1s of an overlay press, which is the
  // suspicious pattern it was added for (2026-08-31). Both close paths are
  // legitimate; telling them apart is the whole point of the instrument.
  const ctx = makeCtx();
  const card = mountCard(ctx);

  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  overlay().dispatchEvent(new rig.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  overlay().dispatchEvent(pointerEvent('pointerleave', { relatedTarget: document.body }));
  await wait(GRACE + 80);
  assert.equal(slot(), null);
  let last = errlog.recent().at(-1);
  assert.equal(last.kind, 'zoom-close-after-click');
  assert.equal(last.msg, 'pointer left the overlay', 'the boundary crossing owns this label');

  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  overlay().dispatchEvent(new rig.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  document.body.dispatchEvent(pointerEvent('pointermove', { bubbles: true }));
  await wait(GRACE + 80);
  assert.equal(slot(), null);
  last = errlog.recent().at(-1);
  assert.equal(last.kind, 'zoom-close-after-click');
  assert.equal(last.msg, 'mouse moved outside (belt)', 'and the belt owns this one — two mechanisms, two witnesses');
});

// ---- the resting card's side: intent, the leave that cancels it, the mark ---

test('hover intent is a dwell, and a leave inside the dwell cancels it outright', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  card.dispatchEvent(pointerEvent('pointerenter'));
  await wait(zoom.ZOOM_IN_MS / 3);
  assert.equal(slot(), null, 'nothing grows before the dwell is served');
  card.dispatchEvent(pointerEvent('pointerleave'));
  await wait(zoom.ZOOM_IN_MS + 120);
  assert.equal(slot(), null, 'a leave inside the dwell cancels the intent — cards must not pop like crazy');
});

test('a dwell that is served grows the card', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  card.dispatchEvent(pointerEvent('pointerenter'));
  await wait(zoom.ZOOM_IN_MS + 120);
  assert.ok(slot(), 'the ordinary pointerenter route grows the card');
  assert.equal(zoom.zoomedCard(), card);
});

test('a touch pointerenter never arms the mouse intent', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  card.dispatchEvent(pointerEvent('pointerenter', { pointerType: 'touch' }));
  await wait(zoom.ZOOM_IN_MS + 120);
  assert.equal(slot(), null, 'pointer-fine is judged by the EVENT, never a media query');
});

test('a zoom put away on purpose stays away until the pointer leaves the card', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  zoom.dismissZoom(); // Escape: the hand is still on the card
  assert.equal(slot(), null, 'the dismissal closed it');

  card.dispatchEvent(pointerEvent('pointerenter'));
  await wait(zoom.ZOOM_IN_MS + 120);
  assert.equal(slot(), null, 'and a pointer that never left cannot re-grow it');

  card.dispatchEvent(pointerEvent('pointerleave'));
  card.dispatchEvent(pointerEvent('pointerenter'));
  await wait(zoom.ZOOM_IN_MS + 120);
  assert.ok(slot(), 'leaving clears the mark, so the next dwell grows it again');
});

test('the overlay appearing over the card is not the pointer leaving it — the mark survives', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  zoom.dismissZoom();
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC }); // the mark outlives a fresh grow
  const inside = document.querySelector('#zoom-layer .f-name');

  // The browser reports the overlay covering the card as a pointerleave. It is
  // not one: the person never moved. Were it treated as one, the mark would be
  // cleared by the app's own overlay.
  card.dispatchEvent(pointerEvent('pointerleave', { relatedTarget: inside }));
  zoom.unzoom({ instant: true });
  card.dispatchEvent(pointerEvent('pointerenter'));
  // Waiting out the full dwell is what makes this bite: the mark is read when
  // the intent ARMS, so an assertion on the same tick passes either way.
  await wait(zoom.ZOOM_IN_MS + 120);
  assert.equal(slot(), null, 'the dismissed mark survived — the overlay did not clear it on the card\'s behalf');
});

// ---- the Codex gate of 2026-08-31, which has never once executed in Node ----
// Kept LAST in the file and wrapped in a finally: jsdom has no
// elementFromPoint, `lastMouse` is never cleared, and a stub left installed
// would make every later instant mouse zoom close itself.

test('an instant restore lands under a hand that moved on, and puts itself away', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const realEFP = document.elementFromPoint;
  try {
    feedMouse(40, 40);
    // The hand is elsewhere. No pointermove is coming — a still hand sends
    // none — so the belt will never hear about it; asking the browser is the
    // only way to know.
    document.elementFromPoint = () => document.body;
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, instant: true, source: 'mouse' });
    assert.equal(slot(), null, 'the restored overlay saw an empty hand and left');
    assert.equal(zoom.zoomedCard(), null);
  } finally {
    document.elementFromPoint = realEFP;
  }
});

test('an instant restore under a hand that is still ON the card stays', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const realEFP = document.elementFromPoint;
  try {
    feedMouse(40, 40);
    document.elementFromPoint = () => card;
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, instant: true, source: 'mouse' });
    assert.ok(slot(), 'the hand never moved — the zoom is exactly where it belongs');
    // And the same when the browser answers with the OVERLAY, which is what it
    // usually hits, the overlay being on top of the card it grew from.
    zoom.unzoom({ instant: true });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, instant: true, source: 'mouse' });
    document.elementFromPoint = () => document.querySelector('#zoom-layer .f-name');
    zoom.unzoom({ instant: true });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, instant: true, source: 'mouse' });
    assert.ok(slot(), 'a hand over the overlay is a hand on the zoom');
  } finally {
    document.elementFromPoint = realEFP;
  }
});

test('a touch restore never asks where the mouse is', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const realEFP = document.elementFromPoint;
  let asked = 0;
  try {
    feedMouse(40, 40);
    document.elementFromPoint = () => { asked += 1; return document.body; };
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, instant: true, source: 'touch' });
    assert.ok(slot(), 'a held finger is not a mouse that wandered off');
    assert.equal(asked, 0, 'and the probe is gated on source === mouse, so it never even ran');
  } finally {
    document.elementFromPoint = realEFP;
  }
});
