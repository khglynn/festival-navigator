// The zoom's KEYBOARD route, which had zero assertions anywhere in tests/
// until now (2026-09-01 review, coverage row "Keyboard route inside the
// overlay"). The route exists so the door to a FIRST note needs no pointer:
// Tab from the resting card reaches the overlay's notes chip, Tab again
// continues past the card and closes the zoom, Shift+Tab comes back — and a
// pick while zoomed swaps the resting node underneath, so the handoff has to
// follow the swap.
//
// What this file deliberately does NOT claim: where Tab-moves-on LANDS.
// nextFocusableAfter filters on `offsetParent !== null` and jsdom reports null
// for every element, so the candidate list is always empty and the function
// always returns null. The CLOSE half is pinned here; the destination is a
// real-browser walk's job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, zoom, makeCtx, mountCard, click, keydown, FESTIVALS, FID } = rig;

const chip = () => document.querySelector('#zoom-layer button.f-chip.notes');
const restingCard = () => document.querySelector('#wall-root .card');

test.afterEach(() => zoom.unzoom({ instant: true }));

test('Tab from the resting card reaches the overlay notes chip (the door to a first note needs no pointer)', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  // Production wires both routes on every card; the focus route's own
  // focusout must not read "focus moved into the overlay" as "focus left".
  zoom.wireCardFocusZoom(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
  card.focus();
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  assert.ok(chip(), 'the overlay carries a real button chip when onOpenNotes is wired');

  const handled = !keydown(card, 'Tab');
  assert.equal(handled, true, 'the card swallows the Tab (preventDefault) instead of letting the browser move on');
  assert.equal(document.activeElement, chip(), 'focus is on the overlay chip');
  assert.equal(zoom.zoomedCard(), card, 'and the zoom is still standing — focus moving INTO the overlay is not focus leaving');
});

test('Shift+Tab on the resting card is left to the browser — the handoff is forward only', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  card.focus();
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  const notPrevented = keydown(card, 'Tab', { shiftKey: true });
  assert.equal(notPrevented, true, 'Shift+Tab is not intercepted');
  assert.equal(document.activeElement, card, 'focus did not jump into the overlay');
  assert.ok(zoom.zoomedCard(), 'and nothing closed');
});

test('a key that is not Tab never moves focus into the overlay', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  card.focus();
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  for (const key of ['ArrowRight', 'Home', 'a']) {
    assert.equal(keydown(card, key), true, `${key} is not intercepted`);
    assert.equal(document.activeElement, card, `${key} leaves focus alone`);
  }
  // Enter and Space are deliberately absent from that list: they ARE claimed
  // on a resting card, by wall.js's own keydown, and they mean pick.
  assert.equal(keydown(card, 'Enter'), false, 'Enter is wall.js\'s pick key, swallowed there');
  assert.deepEqual(ctx.taps, ['GRiZ'], 'and it picked');
  // The pick replaced the resting node and handed focus to the fresh one
  // (wall.js refreshCard keeps keyboard users in place) — still a card, never
  // the overlay's chip.
  assert.equal(document.activeElement, restingCard(), 'focus stayed on the resting card, not the overlay');
});

test('Shift+Tab from the chip returns to the resting card and the zoom stands', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.wireCardFocusZoom(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
  card.focus();
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  keydown(card, 'Tab');
  assert.equal(document.activeElement, chip());

  const handled = !keydown(chip(), 'Tab', { shiftKey: true });
  assert.equal(handled, true, 'the overlay swallows Shift+Tab');
  assert.equal(document.activeElement, card, 'focus is back on the resting card');
  assert.equal(zoom.zoomedCard(), card, 'the zoom survived the round trip');
});

test('Tab from the chip moves on: the zoom closes and the close names itself', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  card.focus();
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  keydown(card, 'Tab');
  const c = chip();
  assert.equal(document.activeElement, c);

  const handled = !keydown(c, 'Tab');
  assert.equal(handled, true, 'the overlay swallows the forward Tab and moves focus itself');
  assert.equal(zoom.zoomedCard(), null, 'the zoom is gone');
  assert.equal(document.querySelector('.zoom-slot'), null, 'and so is the overlay');
  // WHERE focus lands is not asserted: nextFocusableAfter filters on
  // offsetParent, which jsdom reports null for every element, so the candidate
  // list is empty here and the function returns null. Real-browser walk owns it.
});

test('a Tab from anywhere else in the overlay is not the handoff', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  card.focus();
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  const name = document.querySelector('#zoom-layer .f-name');
  assert.equal(keydown(name, 'Tab'), true, 'a Tab on the name is left alone');
  assert.ok(zoom.zoomedCard(), 'and it certainly does not close the zoom');
});

test('a pick while zoomed carries the Tab handoff to the FRESH resting card, and the replaced node goes quiet', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  // A click on the grown card picks; ctx.onTap replaces the resting node
  // (refreshCard) and hands the fresh one to the standing overlay.
  click(document.querySelector('#zoom-layer .zoom-card'));
  const fresh = restingCard();
  assert.notEqual(fresh, card, 'the resting card really was replaced');
  assert.equal(zoom.zoomedCard(), fresh, 'the zoom followed the swap');

  // The stale node is detached and must do nothing at all.
  assert.equal(keydown(card, 'Tab'), true, 'the replaced node no longer claims Tab');
  assert.notEqual(document.activeElement, chip(), 'and it certainly does not move focus');

  fresh.focus();
  const handled = !keydown(fresh, 'Tab');
  assert.equal(handled, true, 'the FRESH card claims Tab — the handoff followed the node swap');
  assert.equal(document.activeElement, chip(), 'and reaches the rebuilt chip');
  assert.equal(zoom.zoomedCard(), fresh, 'still one zoom, on the fresh card');
});

test('the overlay focusout closes only when focus truly left both nodes', () => {
  // A venue the festival maps gives the overlay a SECOND focusable (the map
  // door), so "focus moved inside the overlay" can be exercised as a real
  // focus move rather than a synthetic event.
  FESTIVALS[FID].venues = { 'The Midway': 'https://maps.google.com/?q=The+Midway' };
  FESTIVALS[FID].artists.push({ name: 'Late Night', day: 'Folsom', stage: 'Sat · The Midway', time: '10 PM - 6 AM' });
  const occ = { day: 'Folsom', stage: 'Sat · The Midway', time: '10 PM - 6 AM' };
  const ctx = makeCtx();
  const card = mountCard(ctx, 'Late Night', { occ });
  zoom.zoomCard(card, 'Late Night', ctx, { onOpenNotes: ctx.onOpenNotes, occ });
  const door = document.querySelector('#zoom-layer a.f-where');
  assert.ok(door, 'the mapped venue is a link, so it is focusable');

  chip().focus();
  door.focus(); // inside the overlay
  assert.ok(zoom.zoomedCard(), 'focus moving WITHIN the overlay is not focus leaving');

  door.blur(); // focus falls to <body> — truly outside both nodes
  assert.equal(zoom.zoomedCard(), null, 'focus leaving both the card and the overlay closes the zoom');
});

test('the overlay focusout ignores focus falling back to the resting card', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
  chip().focus();
  card.focus();
  assert.equal(zoom.zoomedCard(), card, 'the resting card is the zoom\'s other half, not "outside"');
});

// The trap the 2026-09-01 review's skeptic demonstrated and could not catch
// with the suite as it stood: a keyboard handoff wired to a captured node
// instead of to `z.el` leaks one live listener per pick. Behaviour hides it —
// every handler re-checks `zoomed === z`, so a leaked listener is inert — so
// this counts listeners instead. It passes on the two-listener shape the file
// carries today and on any correct rewrite; it goes red on a leak.
test('the keyboard wiring leaves nothing behind: no zoom-era keydown listener outlives the zoom', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);

  const proto = rig.window.EventTarget.prototype;
  const realAdd = proto.addEventListener;
  const realRemove = proto.removeEventListener;
  const live = new Set();
  const key = (t, fn, opts) => ({ t, fn, capture: !!(opts === true || (opts && opts.capture)) });
  const same = (a, b) => a.t === b.t && a.fn === b.fn && a.capture === b.capture;
  const track = (set, rec) => { for (const e of set) if (same(e, rec)) return e; return null; };
  proto.addEventListener = function (type, fn, opts) {
    if (type === 'keydown') live.add(key(this, fn, opts));
    return realAdd.call(this, type, fn, opts);
  };
  proto.removeEventListener = function (type, fn, opts) {
    if (type === 'keydown') { const hit = track(live, key(this, fn, opts)); if (hit) live.delete(hit); }
    return realRemove.call(this, type, fn, opts);
  };
  try {
    // Baseline: what one freshly-rendered card registers on its own (wall.js
    // gives every card an Enter/Space keydown). Anything above this after a
    // full zoom/pick/unzoom cycle came from the zoom and was not undone.
    live.clear();
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: null, time: null } });
    click(document.querySelector('#zoom-layer .zoom-card')); // a pick swaps the resting node
    click(document.querySelector('#zoom-layer .zoom-card')); // and again, for a second swap
    zoom.unzoom({ instant: true });

    const stranded = [...live].filter((e) => e.t === document || (e.t.isConnected && e.t.classList && e.t.classList.contains('card')));
    // Each refreshCard renders a new card, and that card's own keydown is a
    // fair passenger — but only ONE card is connected at the end.
    const ownCardListeners = stranded.filter((e) => e.t !== document).length;
    assert.equal(ownCardListeners, 1, `the connected resting card carries exactly its own keydown listener (found ${ownCardListeners})`);
    assert.equal(stranded.filter((e) => e.t === document).length, 0, 'the zoom left no document-level keydown listener behind');
  } finally {
    proto.addEventListener = realAdd;
    proto.removeEventListener = realRemove;
  }
});
