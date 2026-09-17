// Escape puts a hovered zoom away, and it stays away while the mouse rests on
// that card. The mark used to be the card NODE, and a wall repaint replaces
// every node: a crew-mate's pick arriving on the poll rebuilt the card under
// the still hand, the fresh node was not the marked one, its born-under-the-
// pointer check armed, and the zoom grew back 200 ms after it was put away
// (review, 2026-09-16). The mark is the card's identity now — artist,
// occurrence and room, the triple wall.js cardFor restores a zoom by — and it
// lifts when the mouse is over anything else.
//
// jsdom has no elementFromPoint; the stub below stands in for the browser's
// answer and is restored in a finally (see tests/helpers/zoom-rig.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, zoom, makeCtx, renderCard, pointerEvent, feedMouse, wait } = rig;
const SAT = { day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM' };
const SUN = { day: 'Sunday', stage: 'Tunnel', time: '4:00 PM - 5:00 PM' };
const DWELL = zoom.ZOOM_IN_MS + 120;
const slot = () => document.querySelector('.zoom-slot');
const wall = () => document.getElementById('wall-root');

test.afterEach(() => zoom.unzoom({ instant: true }));

// The wall, rebuilt from nothing the way renderWall does it: fresh nodes for
// the same cards, each wired the way app.js ctx.wireZoom wires them.
function paint(ctx, occs) {
  wall().replaceChildren();
  return occs.map((occ) => {
    const card = renderCard('GRiZ', ctx, { occ });
    wall().appendChild(card);
    zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ });
    return card;
  });
}
const cardOf = (occ) => [...wall().querySelectorAll('.card')].find((c) => c.dataset.occ === JSON.stringify(occ));

test('Escape, then a repaint under the still hand: the put-away zoom stays away', async () => {
  const ctx = makeCtx();
  const realEFP = document.elementFromPoint;
  try {
    document.elementFromPoint = () => cardOf(SAT); // the hand rests on Saturday's card
    const [sat] = paint(ctx, [SAT]);
    feedMouse(40, 40, sat);
    zoom.zoomCard(sat, 'GRiZ', ctx, { occ: SAT, source: 'mouse' });
    zoom.dismissZoom(); // Escape
    assert.equal(slot(), null);

    paint(ctx, [SAT]); // a crew-mate's pick lands
    await wait(DWELL);
    assert.equal(slot(), null, 'a fresh node for the same card is the same card');

    feedMouse(42, 41, cardOf(SAT)); // a hand at rest still jiggles
    paint(ctx, [SAT]);
    await wait(DWELL);
    assert.equal(slot(), null, 'moving on the card is not leaving it');

    feedMouse(400, 400, document.body); // the hand leaves…
    cardOf(SAT).dispatchEvent(pointerEvent('pointerenter')); // …and comes back
    await wait(DWELL);
    assert.equal(zoom.zoomedCard(), cardOf(SAT), 'leaving lifted the mark; the next dwell grows it');
  } finally {
    document.elementFromPoint = realEFP;
  }
});

test('the mark is one card, not the artist: their other set still grows', async () => {
  const ctx = makeCtx();
  const [sat, sun] = paint(ctx, [SAT, SUN]);
  feedMouse(40, 40, sat);
  zoom.zoomCard(sat, 'GRiZ', ctx, { occ: SAT, source: 'mouse' });
  zoom.dismissZoom();
  feedMouse(40, 140, sun);
  sun.dispatchEvent(pointerEvent('pointerenter'));
  await wait(DWELL);
  assert.equal(zoom.zoomedCard(), sun, 'Sunday was never put away');
});
