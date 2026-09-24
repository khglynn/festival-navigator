// Where the overlay goes and how big it is (2026-09-01 review, coverage rows
// "place()", "sizeSlot" and the four unpinned inner guards of "Scroll and
// resize FOLLOW, never dismiss"). jsdom returns all-zero rects, so the clamp
// arithmetic degenerates to constants and never once did anything in any test:
// the viewport clamp, the NaN fallback and the size floors were all inert.
//
// The rule these pin is a design law, not an implementation detail. The
// screen's LEFT and RIGHT edges push the box inward; the top never moves it,
// because a card by the day rail must grow where it lives; and the phone
// dock, when it is showing, is a floor the box is moved up from (Kevin,
// 2026-09-24) — the screen's own bottom edge still is not. And the follow
// path closes on exactly one condition — the card genuinely left the viewport
// — because dismissing on any scroll event read as "hover is fully broken" on
// a trackpad, where micro-deltas fire constantly under a resting hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig, stubRect } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, window, zoom, makeCtx, mountCard } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
const slot = () => document.querySelector('.zoom-slot');
const VW = window.innerWidth;

// The overlay's own box has to be measurable before it is placed; jsdom gives
// it zeros, so every test that cares about the clamp says how wide it is.
function sizedSlot(width, height) {
  const proto = window.Element.prototype;
  const real = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function () {
    if (this.classList.contains('zoom-slot')) {
      return { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 };
    }
    return real.call(this);
  };
  return () => { proto.getBoundingClientRect = real; };
}

const setViewport = (w, h) => {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
};

test.afterEach(() => zoom.unzoom({ instant: true }));

test('the overlay centres on its card, and only the LEFT and RIGHT edges ever push it', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    // Comfortably mid-screen: centred, nothing clamped.
    let card = mountCard(ctx);
    stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.left, '330px', 'centred: 400 + 80 − 150');
    assert.equal(slot().style.top, '280px', 'centred: 300 + 50 − 70');
    zoom.unzoom({ instant: true });

    // Hard against the right edge: pushed in to exactly the 8px gutter.
    card = mountCard(ctx);
    stubRect(card, { left: VW - 40, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.left, `${VW - 8 - 300}px`, 'an overlay cannot be read off the right edge');
    zoom.unzoom({ instant: true });

    // Hard against the left edge: same gutter, other side.
    card = mountCard(ctx);
    stubRect(card, { left: -20, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.left, '8px', 'nor off the left');
  } finally {
    undo();
  }
});

test('a card at the very top grows where it is — the top edge never clamps', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    const card = mountCard(ctx);
    stubRect(card, { left: 400, top: 4, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    // 4 + 50 − 70 = −16: deliberately negative. A card by the day rail grows
    // where it lives; nudging it down would break the "grows from its own
    // centre" illusion the whole bloom rests on.
    assert.equal(slot().style.top, '-16px', 'the top is left exactly where the arithmetic put it');
    zoom.unzoom({ instant: true });

    const low = mountCard(ctx);
    stubRect(low, { left: 400, top: window.innerHeight - 20, width: 160, height: 100 });
    zoom.zoomCard(low, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${window.innerHeight - 20 + 50 - 70}px`, 'and the bottom edge does not clamp either');
  } finally {
    undo();
  }
});

// The phone dock (fixed at the bottom under 720px) as the zoom layer sees it.
function showDock(top) {
  const dock = document.createElement('div');
  dock.id = 'dock';
  document.body.appendChild(dock);
  dock.getClientRects = () => [{}];
  stubRect(dock, { left: 0, top, width: VW, height: window.innerHeight - top });
  return () => dock.remove();
}

test('the phone dock is a floor: a zoom that would hang over it is MOVED up to clear it by 8px — same size, same card', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  const DOCK = window.innerHeight - 45;
  const hide = showDock(DOCK);
  try {
    // A card just above the dock: centred, its zoom would reach 21px past the dock's top.
    const low = mountCard(ctx);
    stubRect(low, { left: 400, top: DOCK - 104, width: 160, height: 100 });
    zoom.zoomCard(low, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${DOCK - 8 - 140}px`, 'moved up until its bottom sits 8px above the dock');
    assert.equal(slot().style.left, '330px', 'and only up: its left is where centring put it');
    assert.equal(slot().style.minHeight, '132px', 'never shrunk or reshaped: the size floors are the design defaults');
    zoom.unzoom({ instant: true });

    // Mid-screen, clear of the dock: exactly as before.
    const mid = mountCard(ctx);
    stubRect(mid, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(mid, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '280px', 'nothing else moves');
    zoom.unzoom({ instant: true });

    // A card near the top by the dock rule's other side: the top still never clamps.
    const top = mountCard(ctx);
    stubRect(top, { left: 400, top: 4, width: 160, height: 100 });
    zoom.zoomCard(top, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '-16px', 'the dock never pushes anything down');
  } finally {
    hide();
    undo();
  }
});

test('a zoom taller than the space above the dock stays where the arithmetic put it, and a hidden dock is no floor', () => {
  const ctx = makeCtx();
  const DOCK = 200;
  const undo = sizedSlot(300, DOCK - 10); // 190 tall: more than the 184 between 8px and the dock's 8px
  const hide = showDock(DOCK);
  try {
    const card = mountCard(ctx);
    stubRect(card, { left: 400, top: 120, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${120 + 50 - 95}px`, 'moving it up would push it off the top: today\'s place stands');
    zoom.unzoom({ instant: true });
  } finally {
    hide();
    undo();
  }
  // The dock hidden (display:none above 720px, or while search has focus): no client rects, no floor.
  const undo2 = sizedSlot(300, 140);
  const dock = document.createElement('div');
  dock.id = 'dock';
  document.body.appendChild(dock);
  dock.getClientRects = () => [];
  stubRect(dock, { left: 0, top: window.innerHeight - 45, width: VW, height: 45 });
  try {
    const low = mountCard(ctx);
    stubRect(low, { left: 400, top: window.innerHeight - 104, width: 160, height: 100 });
    zoom.zoomCard(low, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${window.innerHeight - 104 + 50 - 70}px`, 'a dock that is not showing moves nothing');
  } finally {
    dock.remove();
    undo2();
  }
});

test('geometry that has not resolved yet falls back to the resting card rather than to NaN', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(Number.NaN, Number.NaN);
  try {
    const card = mountCard(ctx);
    stubRect(card, { left: 250, top: 175, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.left, '250px', 'an unlaid-out box lands on the card it grew from');
    assert.equal(slot().style.top, '175px');
    assert.ok(!slot().style.left.includes('NaN'), 'never a NaN in a style string — that is a slot stuck at the viewport corner');
  } finally {
    undo();
  }
});

test('the overlay never grows smaller than the card it grew out of', () => {
  const ctx = makeCtx();
  // A big resting card raises every floor to its own size.
  let card = mountCard(ctx);
  stubRect(card, { left: 100, top: 100, width: 400, height: 200 });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  assert.equal(slot().style.minWidth, '400px');
  assert.equal(slot().style.maxWidth, '400px', 'the max is raised too, or the box would be forced NARROWER than the card');
  assert.equal(slot().style.minHeight, '200px');
  zoom.unzoom({ instant: true });

  // An ordinary card leaves the design defaults standing.
  card = mountCard(ctx);
  stubRect(card, { left: 100, top: 100, width: 90, height: 44 });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  assert.equal(slot().style.minWidth, '216px');
  assert.equal(slot().style.maxWidth, '360px');
  assert.equal(slot().style.minHeight, '132px');
});

// ---- follow, and the three things that are NOT "the card scrolled away" -----
// One scroll per zoom on purpose: the rAF throttle is per-overlay state, and
// the rig's synchronous requestAnimationFrame leaves the handle latched after
// the first frame. A fresh zoom is a fresh throttle.

test('a scroll re-places the overlay instead of dismissing it', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    const card = mountCard(ctx);
    stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '280px');
    stubRect(card, { left: 400, top: 120, width: 160, height: 100 }); // the wall scrolled up
    window.dispatchEvent(new window.Event('scroll'));
    assert.ok(slot(), 'still standing — trackpads jiggle, and a jiggle is not a decision');
    assert.equal(slot().style.top, '100px', 'the overlay followed its card');
  } finally {
    undo();
  }
});

test('a card that truly scrolled off screen takes its overlay with it', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  stubRect(card, { left: 400, top: -400, width: 160, height: 100 }); // gone above the fold
  window.dispatchEvent(new window.Event('scroll'));
  assert.equal(slot(), null, 'the overlay is anchored to a card that is no longer there');
});

test('a zero-size viewport is a transient, not a card that scrolled away', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  const w = window.innerWidth, h = window.innerHeight;
  try {
    // A DevTools metrics override mid-screenshot, or a backgrounded window:
    // every rect collapses and every card looks off screen at once.
    setViewport(0, 0);
    window.dispatchEvent(new window.Event('scroll'));
    assert.ok(slot(), 'the zoom survives a viewport that momentarily has no size');
  } finally {
    setViewport(w, h);
  }
});

test('a card that left the DOM under a scroll closes its overlay at once', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  card.remove();
  window.dispatchEvent(new window.Event('scroll'));
  assert.equal(slot(), null, 'an overlay anchored to nothing is a stranded overlay');
  assert.equal(zoom.zoomedCard(), null);
});

test('an inner scroller is heard too — scroll does not bubble, so the listener is capture-phase', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    const card = mountCard(ctx);
    const scroller = document.createElement('div'); // a day column with its own overflow
    card.parentNode.appendChild(scroller);
    scroller.appendChild(card);
    stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '280px');

    stubRect(card, { left: 400, top: 120, width: 160, height: 100 });
    // bubbles:false is the real shape of a scroll event. Only a capture-phase
    // listener on window sees this at all.
    scroller.dispatchEvent(new window.Event('scroll', { bubbles: false }));
    assert.equal(slot().style.top, '100px', 'the overlay followed a scroll that never reached window by bubbling');
  } finally {
    undo();
  }
});

test('a resize follows the card the same way a scroll does', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    const card = mountCard(ctx);
    stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    stubRect(card, { left: 200, top: 300, width: 160, height: 100 });
    window.dispatchEvent(new window.Event('resize'));
    assert.ok(slot(), 'a resize is not a dismissal either');
    assert.equal(slot().style.left, '130px', 'and the box re-centres on where the card ended up');
  } finally {
    undo();
  }
});
