// Where the overlay goes and how big it is (2026-09-01 review, coverage rows
// "place()", "sizeSlot" and the four unpinned inner guards of "Scroll and
// resize FOLLOW, never dismiss"). jsdom returns all-zero rects, so the clamp
// arithmetic degenerates to constants and never once did anything in any test:
// the viewport clamp, the NaN fallback and the size floors were all inert.
//
// The rule these pin is a design law, not an implementation detail. The
// screen's LEFT and RIGHT edges push the box inward. The chrome is kept
// clear (Kevin, 2026-09-24): the phone dock, when it shows, is a FLOOR the
// box moves up from, and the sticky chrome above the card — the desktop day
// rail and the card's own stage strip — is a CEILING it moves down from; when
// it cannot clear both, the ceiling wins. The screen's own top and bottom
// edges move nothing: a card with no chrome above it grows where it lives.
// (Until 2026-09-24 the top never moved it at all — "a card by the day rail
// grows where it is"; Kevin overruled that for the sticky headers.) And the
// follow path closes only when the card genuinely left the viewport or went
// entirely under that chrome — because dismissing on any scroll event read
// as "hover is fully broken" on a trackpad, where micro-deltas fire
// constantly under a resting hand.
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

test('with no sticky chrome above it, a card at the very top grows where it is — the screen\'s edges never clamp', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    const card = mountCard(ctx);
    stubRect(card, { left: 400, top: 4, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    // 4 + 50 − 70 = −16: deliberately negative. With nothing pinned above it
    // (a stack of cards on a phone, say) a card grows where it lives; only
    // real chrome is a ceiling (the next tests).
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

    // A card near the top, no sticky chrome above it: the dock never pushes anything down.
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

// The sticky chrome above a card as the zoom layer sees it: the desktop day
// rail (#day-rail) and the card's own timetable's stage strip (a .tt-block's
// .stage-strip), each with a real box.
function showChrome(card, { rail = null, strip = null } = {}) {
  const made = [];
  const box = (el, r) => { el.getClientRects = () => [{}]; stubRect(el, r); made.push(el); };
  if (rail) {
    const el = document.createElement('div');
    el.id = 'day-rail';
    document.body.prepend(el);
    box(el, { left: 0, top: rail.top ?? 0, width: VW, height: rail.height });
  }
  if (strip) {
    const block = document.createElement('div');
    block.className = 'tt-block';
    const el = document.createElement('div');
    el.className = 'times-wrap stage-strip';
    card.parentNode.insertBefore(block, card);
    block.append(el, card);
    box(el, { left: 0, top: strip.top, width: VW, height: strip.height });
    made.push(block);
  }
  return () => { for (const el of made) el.remove(); };
}

test('the sticky chrome is a ceiling: a zoom that would reach under it MOVES down to clear it by 8px — same size, same card', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    // A phone: the card's own stage strip pinned at the top (0–36), no rail.
    let card = mountCard(ctx);
    let hide = showChrome(card, { strip: { top: 0, height: 36 } });
    stubRect(card, { left: 400, top: 20, width: 160, height: 100 }); // its top under the strip
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${36 + 8}px`, 'moved down until its top sits 8px under the strip');
    assert.equal(slot().style.left, '330px', 'and only down: its left is where centring put it');
    assert.equal(slot().style.minHeight, '132px', 'never shrunk or reshaped');
    zoom.unzoom({ instant: true });
    hide();

    // A desktop: the rail (0–60) and the strip pinned under it (60–100); the lowest edge is the ceiling.
    card = mountCard(ctx);
    hide = showChrome(card, { rail: { height: 60 }, strip: { top: 60, height: 40 } });
    stubRect(card, { left: 400, top: 110, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${100 + 8}px`, 'rail and strip: clears the lower of the two by 8px');
    zoom.unzoom({ instant: true });
    hide();

    // A strip still at its natural spot, well above the card: the zoom is clear of it — nothing moves.
    card = mountCard(ctx);
    hide = showChrome(card, { strip: { top: 150, height: 36 } });
    stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '280px', 'clear of the chrome, centred on its card as ever');
    hide();
  } finally {
    undo();
  }
});

test('no ceiling is invented: a stack card has only the rail on a desktop, and nothing on a phone', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  try {
    // A stack card (no .tt-block) near the top of a phone: nothing above it but the screen edge.
    let card = mountCard(ctx);
    stubRect(card, { left: 400, top: 4, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '-16px', 'no strip, no rail: it grows where it lives');
    zoom.unzoom({ instant: true });

    // Another timetable's strip is not this card's ceiling.
    const other = document.createElement('div');
    other.className = 'tt-block';
    other.innerHTML = '<div class="times-wrap stage-strip"></div>';
    document.body.appendChild(other);
    const otherStrip = other.firstChild;
    otherStrip.getClientRects = () => [{}];
    stubRect(otherStrip, { left: 0, top: 0, width: VW, height: 36 });
    card = mountCard(ctx);
    stubRect(card, { left: 400, top: 4, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '-16px', 'only the card\'s own timetable\'s strip counts');
    zoom.unzoom({ instant: true });
    other.remove();

    // The same stack card on a desktop, under the rail (0–60): the rail is its ceiling.
    card = mountCard(ctx);
    const hide = showChrome(card, { rail: { height: 60 } });
    stubRect(card, { left: 400, top: 40, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${60 + 8}px`, 'the rail alone is a ceiling');
    hide();
  } finally {
    undo();
  }
});

test('too tall for the band between the ceiling and the dock: the ceiling wins, the dock gives way', () => {
  const ctx = makeCtx();
  const DOCK = 300;
  const undo = sizedSlot(300, 240); // the band is 36+8 … 300−8: 248 tall, the zoom 240 fits…
  const hideDock = showDock(DOCK);
  let hide = () => {};
  try {
    let card = mountCard(ctx);
    hide = showChrome(card, { strip: { top: 0, height: 36 } });
    stubRect(card, { left: 400, top: 200, width: 160, height: 100 }); // centred it would reach 370
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${DOCK - 8 - 240}px`, '…so it clears both: its bottom 8px above the dock');
    zoom.unzoom({ instant: true });
    hide();
  } finally {
    undo();
  }
  // Now taller than the band — and taller than the whole space above the dock,
  // where the dock rule alone would have left it centred on its card. With a
  // ceiling the rule is one continuous clamp (the ceiling applied last), so a
  // zoom kept open while a strip rides up to its pin never jumps between
  // "clamped" and "left where it was".
  const undo2 = sizedSlot(300, 290);
  try {
    const card = mountCard(ctx);
    hide = showChrome(card, { strip: { top: 0, height: 36 } });
    stubRect(card, { left: 400, top: 200, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, `${36 + 8}px`, 'cannot clear both: its top clears the stage names, its bottom hangs over the dock');
  } finally {
    hide();
    hideDock();
    undo2();
  }
});

test('a followed zoom glides against a pinned ceiling, and closes when its card has gone entirely under it', () => {
  const ctx = makeCtx();
  const undo = sizedSlot(300, 140);
  const card = mountCard(ctx);
  const hide = showChrome(card, { strip: { top: 0, height: 36 } });
  try {
    stubRect(card, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.equal(slot().style.top, '280px');
    stubRect(card, { left: 400, top: 10, width: 160, height: 100 }); // the wall scrolled; the card's top is under the strip
    window.dispatchEvent(new window.Event('scroll'));
    assert.equal(slot().style.top, `${36 + 8}px`, 'clamped under the strip, still open — part of its card still shows');
  } finally {
    zoom.unzoom({ instant: true });
    hide();
    undo();
  }
  // A fresh zoom (the rig's rAF throttle latches one scroll per zoom).
  const undo2 = sizedSlot(300, 140);
  const card2 = mountCard(ctx);
  const hide2 = showChrome(card2, { strip: { top: 0, height: 36 } });
  try {
    stubRect(card2, { left: 400, top: 300, width: 160, height: 100 });
    zoom.zoomCard(card2, 'GRiZ', ctx, { occ: OCC });
    stubRect(card2, { left: 400, top: -70, width: 160, height: 100 }); // bottom at 30: entirely under the strip, still on screen
    window.dispatchEvent(new window.Event('scroll'));
    assert.equal(slot(), null, 'a zoom whose card cannot be seen any more closes, as if it had left the screen');
  } finally {
    hide2();
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
