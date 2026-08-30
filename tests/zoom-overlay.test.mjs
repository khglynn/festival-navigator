// The zoom is an overlay, never a reflow (2026-08-30). Against the real
// modules in jsdom: the grown card lives in #zoom-layer, not inside the wall;
// the resting card's box is never written to; a click on the grown card is a
// pick (the 2026-08-29 version swallowed every click after the first — the
// P0 the survey found); its notes chip is the one control that is not; a
// pick while zoomed keeps the zoom on the fresh card; a hold's release
// cannot pick. jsdom has no Element.animate, so every path here is the
// instant one — the morph itself is a real-browser walk's job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderCard, refreshCard } = await import('../js/v3/wall.js');
const zoom = await import('../js/v3/card-facts.js');

const FID = 'zoom-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = { id: FID, name: 'Zoom', artists: [{ name: 'GRiZ', day: 'Saturday' }, { name: 'Rezz', day: 'Saturday' }] };
const TOKEN = 'zoomtesttoken_0123456789';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 } },
  festivals: { [FID]: { selections: { GRiZ: { Kevin: 1, Drew: 4 } } } },
  affinity: {},
}, FID);

function makeCtx() {
  const ctx = {
    fid: FID, meName: 'Kevin', affinity: null, lowPower: false,
    picks: model.picksFor(state.crewDoc, FID),
    taps: [], opened: [],
    onOpenNotes: (a) => ctx.opened.push(a),
  };
  // What app.js's handleTap does, minus sync: advance my level, mirror it
  // into the doc, refresh the card, and keep the zoom on the fresh node.
  ctx.onTap = (artist, el) => {
    ctx.taps.push(artist);
    const cur = (ctx.picks[artist] || {})[ctx.meName] || 0;
    const next = model.nextTapLevel(cur);
    const sels = state.crewDoc.festivals[FID].selections;
    (sels[artist] = sels[artist] || {})[ctx.meName] = next;
    ctx.picks = model.picksFor(state.crewDoc, FID);
    const fresh = refreshCard(el, artist, ctx);
    if (zoom.zoomedCard() === el) zoom.refreshZoom(fresh, ctx);
    return fresh;
  };
  return ctx;
}

function mountCard(ctx, name = 'GRiZ') {
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  const card = renderCard(name, ctx, { occ: { day: 'Saturday', stage: null, time: null } });
  wall.appendChild(card);
  return card;
}
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

test.afterEach(() => zoom.unzoom({ instant: true }));

test('the grown card is an overlay: outside the wall, and the resting card is never resized', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const facts = zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday' } });
  assert.equal(facts.name, 'GRiZ');
  const layer = document.getElementById('zoom-layer');
  assert.ok(layer && layer.parentNode === document.body, 'the layer hangs off <body>');
  const grown = layer.querySelector('.zoom-card');
  assert.ok(grown, 'one grown card in the layer');
  assert.equal(card.querySelector('.zoom-card'), null, 'nothing grown inside the wall card');
  for (const prop of ['width', 'margin-left', 'min-height', 'height']) {
    assert.equal(card.style.getPropertyValue(prop), '', `resting card ${prop} untouched`);
  }
  assert.ok(card.classList.contains('zoom-source'), 'the resting card steps back (opacity, via class)');
  assert.equal(zoom.zoomedCard(), card);
  assert.ok(zoom.zoomContains(grown.querySelector('.f-name')), 'the overlay counts as inside the zoom');
  assert.ok(zoom.zoomContains(card));
  assert.ok(!zoom.zoomContains(document.body));
  assert.equal(grown.querySelector('.f-name').textContent, 'GRiZ');
  assert.deepEqual([...grown.querySelectorAll('.f-pill')].map((p) => p.textContent), ['DrewMUST', 'You']);
});

test('a click on the grown card PICKS; its notes chip opens notes and never picks', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes });
  const grown = document.querySelector('#zoom-layer .zoom-card');
  click(grown.querySelector('.f-sub') || grown.querySelector('.f-who') || grown);
  assert.deepEqual(ctx.taps, ['GRiZ'], 'a click on the grown lines is a pick');
  const fresh = document.querySelector('#wall-root .card');
  assert.notEqual(fresh, card, 'the resting card was refreshed');
  assert.equal(zoom.zoomedCard(), fresh, 'the zoom moved to the fresh card');
  assert.ok(fresh.classList.contains('zoom-source'));
  assert.ok(!card.classList.contains('zoom-source'));
  assert.equal(document.querySelectorAll('#zoom-layer .zoom-card').length, 1, 'still one overlay');
  click(document.querySelector('#zoom-layer button.f-chip.notes'));
  assert.deepEqual(ctx.opened, ['GRiZ'], 'the chip is the door to notes');
  assert.deepEqual(ctx.taps, ['GRiZ'], 'and it is not a pick');
});

test('taps while zoomed cycle 1 → 2 → 3 → 4 → 0 and the pills follow', () => {
  state.crewDoc.festivals[FID].selections.GRiZ.Kevin = 1; // the doc carries over between tests
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes });
  const levels = [];
  const mine = () => (ctx.picks.GRiZ || {}).Kevin || 0; // picksFor drops a cleared pick
  const youPill = () => [...document.querySelectorAll('#zoom-layer .f-pill')].find((p) => p.classList.contains('you'));
  for (let i = 0; i < 4; i++) {
    click(document.querySelector('#zoom-layer .zoom-card'));
    levels.push(mine());
  }
  assert.deepEqual(levels, [2, 3, 4, 0]);
  assert.equal(youPill(), undefined, 'at 0 the You pill is gone');
  click(document.querySelector('#zoom-layer .zoom-card'));
  assert.equal(mine(), 1);
  assert.equal(youPill().textContent, 'You');
  click(document.querySelector('#zoom-layer .zoom-card'));
  click(document.querySelector('#zoom-layer .zoom-card'));
  click(document.querySelector('#zoom-layer .zoom-card'));
  assert.equal(youPill().textContent, 'YouMUST', 'four taps = MUST, shown live in the overlay');
  assert.equal(zoom.zoomedCard(), document.querySelector('#wall-root .card'), 'the zoom never left');
});

test('a hold on touch: the lift and its own click cannot pick; the NEXT tap does', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, source: 'touch' });
  const grown = document.querySelector('#zoom-layer .zoom-card');
  assert.equal(grown.style.pointerEvents, 'none', 'deaf while the holding finger is down');
  document.dispatchEvent(new dom.window.Event('pointerup', { bubbles: true }));
  assert.equal(grown.style.pointerEvents, 'none', 'still deaf through the lift — arming on pointerup let the lift\'s own click pick (phone walk, 2026-08-30)');
  // The lift's synthetic click (it passes through the deaf overlay to the
  // resting card, whose longPressed swallow eats it in production).
  document.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(ctx.taps.length, 0, 'the lift picked nothing');
  assert.equal(grown.style.pointerEvents, '', 'armed after the lift click has passed');
  click(grown);
  assert.deepEqual(ctx.taps, ['GRiZ'], 'the next tap picks — one grammar on both surfaces');
});

test('unzoom removes the overlay and restores the card; the snapshot survives a repaint', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday' } });
  const snap = zoom.zoomSnapshot();
  assert.equal(snap.artist, 'GRiZ');
  assert.deepEqual(snap.occ, { day: 'Saturday' });
  zoom.unzoom({ instant: true });
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null);
  assert.ok(!card.classList.contains('zoom-source'));
  assert.equal(zoom.zoomedCard(), null);
  assert.equal(zoom.zoomSnapshot(), null);
  // The repaint path: a fresh wall, the same zoom back on the matching card.
  const again = mountCard(ctx);
  zoom.zoomCard(again, snap.artist, ctx, { ...snap, instant: true });
  assert.equal(zoom.zoomedCard(), again);
  assert.equal(document.querySelectorAll('#zoom-layer .zoom-card').length, 1);
});

test('zooming a second card replaces the first — one zoom at a time', () => {
  const ctx = makeCtx();
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  const a = renderCard('GRiZ', ctx), b = renderCard('Rezz', ctx);
  wall.append(a, b);
  zoom.zoomCard(a, 'GRiZ', ctx, {});
  zoom.zoomCard(b, 'Rezz', ctx, {});
  assert.equal(zoom.zoomedCard(), b);
  assert.ok(!a.classList.contains('zoom-source'));
  assert.equal(document.querySelectorAll('#zoom-layer .zoom-card').length, 1);
  assert.equal(document.querySelector('#zoom-layer .f-name').textContent, 'Rezz');
});

test('the grown card and the resting card render from ONE model: same aura, every detail carried', () => {
  const ctx = makeCtx();
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  const card = renderCard('GRiZ', ctx, { tag: 'W2', occ: { day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM', weekend: 'W2' } });
  wall.appendChild(card);
  const facts = zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM', weekend: 'W2' } });
  const grown = document.querySelector('#zoom-layer .zoom-card');
  const surface = grown.querySelector('.z-surface');
  assert.equal(surface.style.background, card.style.background, 'the zoom wears the card\'s aura (a second colour layer once made this invalid and black)');
  assert.ok(surface.style.background.includes('radial-gradient'), 'and the aura is really there');
  assert.equal(facts.sub, '9:00 – 10:15 PM · Saturday · Pier Stage · Weekend 2', 'the details view shows the details, weekend included');
  assert.equal(grown.querySelector('.f-sub').textContent, facts.sub);
  assert.equal(grown.querySelectorAll('.f-pill').length, facts.people.length);
  assert.equal(card.querySelectorAll('.corner-who .mark:not(.ghost)').length, Math.min(facts.people.length, 4));
});
