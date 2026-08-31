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
  assert.equal(facts.when, '9:00 – 10:15 PM · Saturday · W2', 'WHEN carries the weekend as plain words — a tag flipped sides (Kevin, 2026-08-30)');
  assert.equal(facts.where, 'Pier Stage', 'WHERE is its own row');
  assert.equal(grown.querySelector('.f-sub').textContent, facts.when);
  assert.equal(grown.querySelector('.f-where').textContent, 'Pier Stage');
  assert.equal(grown.querySelectorAll('.f-pill').length, facts.people.length);
  assert.equal(card.querySelectorAll('.corner-who .mark:not(.ghost)').length, Math.min(facts.people.length, 4));
});

test('a venue the festival maps becomes a door to the map — and never a pick', () => {
  FESTIVALS[FID].venues = { 'The Midway': 'https://maps.google.com/?q=The+Midway' };
  FESTIVALS[FID].artists.push({ name: 'Late Night', day: 'Folsom', stage: 'Sat · The Midway', time: '10 PM - 6 AM' });
  const ctx = makeCtx();
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  const card = renderCard('Late Night', ctx, { occ: { day: 'Folsom', stage: 'Sat · The Midway', time: '10 PM - 6 AM' } });
  wall.appendChild(card);
  const facts = zoom.zoomCard(card, 'Late Night', ctx, { occ: { day: 'Folsom', stage: 'Sat · The Midway', time: '10 PM - 6 AM' } });
  assert.equal(facts.when, 'Sat · 10 PM – 6 AM'); // different meridiems keep both — timeRange only merges a shared one
  assert.equal(facts.where, 'The Midway');
  const link = document.querySelector('#zoom-layer a.f-where');
  assert.ok(link, 'the where row is a link');
  assert.ok(link.href.includes('maps.google.com'));
  assert.equal(link.target, '_blank');
  click(link);
  assert.equal(ctx.taps.length, 0, 'opening the map is never a pick');
});

// ---- the animated path, pinned (Codex gate, 2026-08-30) --------------------
// jsdom has no Element.animate, so every test above takes the instant path —
// which let three motion defects sail through green. A recording stub opens
// the animated path just far enough to pin the bloom's contracts; the FEEL
// stays a real-browser walk's job.
test('the bloom keeps its laws: compositor-only, WHEN waits out the content fade, exit from live opacity, exit slots swept', () => {
  const calls = [];
  const proto = dom.window.Element.prototype;
  proto.animate = function animate(keyframes, options) {
    calls.push({ target: this, keyframes, options });
    return { cancel() {}, play() {}, pause() {}, onfinish: null, oncancel: null };
  };
  try {
    const ctx = makeCtx();
    const card = mountCard(ctx);
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });

    // One easing vocabulary, one budget: every keyframe animates transform
    // and opacity only — a layout property here is a wall reflow waiting.
    for (const c of calls) {
      for (const kf of c.keyframes) {
        for (const k of Object.keys(kf)) {
          assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(k),
            `compositor-only: unexpected keyframe property "${k}"`);
        }
      }
    }

    // ONE rendering of every fact: the grown WHEN line must not begin until
    // the resting content's CSS fade (90ms, v3.css .card > *) has finished —
    // the resting time and the grown time are the same fact.
    const sub = calls.find((c) => c.target.classList && c.target.classList.contains('f-sub'));
    assert.ok(sub, 'the WHEN line animates in');
    assert.ok(sub.options.delay >= 90, `WHEN waits out the content fade (delay ${sub.options.delay} < 90)`);

    // A dismissal on the bloom's first frame leaves from opacity 0 — the
    // `|| 1` bug flashed the overlay fully opaque on its way out.
    const slot = document.querySelector('.zoom-slot');
    slot.style.opacity = '0';
    calls.length = 0;
    zoom.unzoom();
    const out = calls.find((c) => c.target === slot);
    assert.ok(out, 'the exit animates the slot');
    assert.equal(out.keyframes[0].opacity, 0, 'the exit starts from the live opacity, not 1');

    // The animated exit parks the slot until its animation finishes (the
    // stub never finishes it) — and a NEW zoom must sweep every parked slot.
    assert.ok(slot.isConnected, 'the exiting slot lingers for its animation');
    const card2 = mountCard(ctx, 'Rezz');
    zoom.zoomCard(card2, 'Rezz', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
    assert.ok(!slot.isConnected, 'a new zoom sweeps the exiting slot');
    assert.equal(document.querySelectorAll('.zoom-slot').length, 1, 'one overlay on stage');
  } finally {
    delete proto.animate;
  }
});

test('a scroll never kills the zoom — the overlay follows its card (trackpads jiggle)', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
  assert.ok(document.querySelector('.zoom-slot'), 'grown');
  window.dispatchEvent(new dom.window.Event('scroll'));
  assert.ok(document.querySelector('.zoom-slot'), 'a scroll repositions the overlay instead of dismissing it');
  // and the card is NOT poisoned: hovering it again is still allowed
  zoom.unzoom({ instant: true });
  const again = zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
  assert.ok(again, 'the card re-grows after a scroll (no dismissedEl poisoning)');
});

test('an orphaned mouse zoom closes on the next outside movement (a repaint can restore a zoom after the hand moved on)', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null }, instant: true });
  assert.ok(document.querySelector('.zoom-slot'), 'grown');
  // moving INSIDE the zoom keeps it
  document.querySelector('.zoom-card').dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 320));
  assert.ok(document.querySelector('.zoom-slot'), 'movement inside never closes it');
  // moving OUTSIDE starts the grace close — no boundary event needed
  document.body.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 320));
  assert.equal(document.querySelector('.zoom-slot'), null, 'outside movement closes the orphan');
});

test('the overlay never steals focus: a click on its body picks even when the resting card holds focus (the 2026-08-31 "hover and click, it closes")', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  // Production wiring: the keyboard route's focusout closes the zoom when
  // focus truly leaves the card. A click on the RESTING card focuses it
  // (role=button), and refreshCard hands that focus to the fresh node.
  zoom.wireCardFocusZoom(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
  card.focus();
  assert.equal(document.activeElement, card);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null }, instant: true, onOpenNotes: ctx.onOpenNotes });
  const overlay = document.querySelector('.zoom-slot .zoom-card');
  // The real click: mousedown's default action would move focus off the card
  // (blur → focusout → unzoom, before the click arrives). Cancelling it is the
  // fix; jsdom performs no focus default, so the assertion IS the pin.
  const down = new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  overlay.querySelector('.f-name').dispatchEvent(down);
  assert.equal(down.defaultPrevented, true, 'mousedown on the overlay body is cancelled — focus stays on the card');
  assert.equal(document.activeElement, card, 'no focusout, so no close');
  // The controls keep their own defaults.
  const onChip = new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  document.querySelector('.zoom-slot button.f-chip.notes').dispatchEvent(onChip);
  assert.equal(onChip.defaultPrevented, false, 'the notes chip keeps its mousedown default');
  // The failure the fix prevents, spelled out on the live handler: were focus
  // to leave the card anyway (an unprevented mousedown in a real browser),
  // the keyboard route's focusout closes the zoom before any click arrives.
  card.blur();
  assert.equal(document.querySelector('.zoom-slot'), null, 'a real blur closes the zoom — which is exactly why the overlay must not cause one');
  // Focus kept, the click is a pick and the zoom stays.
  card.focus();
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null }, instant: true, onOpenNotes: ctx.onOpenNotes });
  click(document.querySelector('.zoom-slot .f-name'));
  assert.deepEqual(ctx.taps, ['GRiZ'], 'the click is a pick');
  assert.ok(document.querySelector('.zoom-slot'), 'and the zoom is still up');
});

test('a card rendered under a resting pointer arms its hover intent one frame after insertion (a repaint under a still hand)', async () => {
  const ctx = makeCtx();
  // Production shape: renderCard wires the card BEFORE inserting it, so the
  // :hover check must wait a frame. jsdom has no :hover; stand in for the
  // browser's record on exactly this node, and give rAF real (async) timing.
  const syncRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  // Feed the module's last-known mouse position, and answer elementFromPoint
  // with this card — the browser-truth the re-arm asks for (it never trusts
  // :hover: Safari's stale hover chains after DOM swaps grew far-away cards).
  const move = new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40 });
  Object.defineProperty(move, 'pointerType', { value: 'mouse' });
  document.dispatchEvent(move);
  const realEFP = document.elementFromPoint;
  try {
    const wall = document.getElementById('wall-root');
    wall.replaceChildren();
    const card = renderCard('GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
    document.elementFromPoint = () => card;
    zoom.wireCardZoom(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } }); // still detached
    wall.appendChild(card);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(document.querySelector('.zoom-slot'), null, 'not before the intent delay');
    await new Promise((r) => setTimeout(r, zoom.ZOOM_IN_MS + 40));
    assert.ok(document.querySelector('.zoom-slot'), 'grown without any pointerenter');
    assert.equal(zoom.zoomedCard(), card);
  } finally {
    globalThis.requestAnimationFrame = syncRaf;
    document.elementFromPoint = realEFP;
  }
});

test('the airbag: a throw mid-zoom is recorded and sweeps the stage — no stranded slot, no invisible card (the Safari recording, 2026-08-31)', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const proto = dom.window.Element.prototype;
  proto.animate = function animate() { throw new Error('WAAPI said no (test)'); };
  try {
    const out = zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
    assert.equal(out, null, 'a failed zoom reports nothing');
    assert.equal(document.querySelectorAll('.zoom-slot').length, 0, 'no stranded overlay');
    assert.equal(document.querySelectorAll('.card.zoom-source').length, 0, 'no invisible card left behind');
    assert.equal(zoom.zoomedCard(), null, 'state is zeroed');
    const { recent } = await import('../js/errlog.js');
    const last = recent().at(-1);
    assert.equal(last.kind, 'zoom:grow', 'the crash journal has the witness');
    assert.match(last.msg, /WAAPI said no/);
    // And the card still works afterwards: the instant path zooms fine.
    delete proto.animate;
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null }, instant: true });
    assert.ok(document.querySelector('.zoom-slot'), 'life goes on');
  } finally {
    delete proto.animate;
  }
});
