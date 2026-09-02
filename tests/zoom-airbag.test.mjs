// Recovery and stage bookkeeping (2026-09-01 review, coverage rows "The airbag
// on refresh and on shrink", "The close journal", "zoomLayer() rebuilds", "One
// zoom on stage" and "The exit ghost belt").
//
// The airbag exists because of Kevin's Safari recording (2026-08-31): an
// exception thrown MIDWAY through a zoom left a resting card content-invisible
// with no overlay, and a slot stuck unplaced at the viewport's top. The suite
// was green and no tool saw it. Only ONE of the three entry points was tested —
// zoomCard's. A broken refresh or a broken exit could strand the wall exactly
// the same way and nothing would have said so.
//
// Order matters in one place and is called out where it does: the close
// journal's negative case has to run before anything in this file presses the
// overlay, because `lastOverlayPress` is module state that starts at 0 and is
// never reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig, recordAnimations } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, zoom, makeCtx, mountCard, click, wait, errlog } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
const slot = () => document.querySelector('.zoom-slot');
const overlay = () => document.querySelector('#zoom-layer .zoom-card');
const mousedown = (node) => node.dispatchEvent(new rig.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
const swept = () => {
  assert.equal(document.querySelectorAll('.zoom-slot').length, 0, 'no stranded overlay');
  assert.equal(document.querySelectorAll('.card.zoom-source').length, 0, 'no content-invisible card left behind');
  assert.equal(zoom.zoomedCard(), null, 'state zeroed');
};

test.afterEach(() => zoom.unzoom({ instant: true }));

// ---- the close journal (2026-08-31) ---------------------------------------
// FIRST in the file on purpose: lastOverlayPress starts at 0 and is never
// reset, so this is the only moment a "no press has happened" case is honest
// without burning a second of wall clock.
test('a close with no overlay press behind it is not worth a journal slot', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const before = errlog.recent().length;
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  zoom.unzoom({ why: 'nobody pressed anything' });
  assert.equal(errlog.recent().length, before, 'the journal has 20 slots; ordinary closes do not get one');
});

test('a close right after an overlay press records its named cause', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  mousedown(overlay().querySelector('.f-name'));
  zoom.unzoom({ why: 'the cause this close would name' });
  const last = errlog.recent().at(-1);
  assert.equal(last.kind, 'zoom-close-after-click');
  assert.equal(last.msg, 'the cause this close would name', 'the WHY is the payload — that is the whole instrument');
});

test('the press-adjacency window is one second wide, not forever', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  mousedown(overlay().querySelector('.f-name'));
  await wait(1100);
  const before = errlog.recent().length;
  zoom.unzoom({ why: 'a close long after the press' });
  assert.equal(errlog.recent().length, before, 'a close a second later is not click-adjacent and stays out of the journal');
});

// ---- the airbag on the two entry points nobody had tested ------------------

test('the airbag on REFRESH: a throw mid-pick is journalled and the stage swept', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  // The instant path first — it short-circuits canAnimate, so the zoom itself
  // survives the stub that is about to be installed. (Installing it before the
  // zoom means zoomCard throws and there is no zoom left to refresh.)
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, instant: true });
  assert.ok(slot(), 'grown');
  const proto = rig.window.Element.prototype;
  proto.animate = function animate() { throw new Error('WAAPI said no on the refresh (test)'); };
  try {
    click(overlay()); // a pick while zoomed → refreshCard → refreshZoom
    const last = errlog.recent().at(-1);
    assert.equal(last.kind, 'zoom:refresh', 'the crash journal names the entry point that failed');
    assert.match(last.msg, /WAAPI said no on the refresh/);
    swept();
    // And the app keeps working afterwards — a missed zoom is a non-event.
    delete proto.animate;
    zoom.zoomCard(document.querySelector('#wall-root .card'), 'GRiZ', ctx, { occ: OCC, instant: true });
    assert.ok(slot(), 'life goes on');
  } finally {
    delete proto.animate;
  }
});

test('the airbag on SHRINK: a throw on the way out is journalled and the stage swept', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC, instant: true });
  const proto = rig.window.Element.prototype;
  proto.animate = function animate() { throw new Error('WAAPI said no on the way out (test)'); };
  try {
    zoom.unzoom({ why: 'an exit that throws' }); // animated: canAnimate now says yes
    const last = errlog.recent().at(-1);
    assert.equal(last.kind, 'zoom:shrink');
    assert.match(last.msg, /WAAPI said no on the way out/);
    swept();
  } finally {
    delete proto.animate;
  }
});

test('the airbag sweeps overlays it never knew about — including ghosts mid-exit', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    const ghost = slot();
    zoom.unzoom({ why: 'an exit whose animation never finishes' });
    assert.ok(ghost.isConnected, 'the exiting slot lingers for an animation the stub never finishes');
    // Now a zoom throws with a ghost still parked on stage.
    rec.off();
    rig.window.Element.prototype.animate = function animate() { throw new Error('and now the grow fails (test)'); };
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    assert.ok(!ghost.isConnected, 'the bail cleared the parked ghost too — a stranded wall is a broken app');
    swept();
  } finally {
    rec.off();
    delete rig.window.Element.prototype.animate;
  }
});

// ---- the layer, and one zoom on stage --------------------------------------

test('the zoom layer is rebuilt when something took it away', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  zoom.unzoom({ instant: true });
  const layer = document.getElementById('zoom-layer');
  assert.ok(layer, 'a layer exists after the first zoom');
  layer.remove();
  assert.equal(document.getElementById('zoom-layer'), null);

  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  const fresh = document.getElementById('zoom-layer');
  assert.ok(fresh, 'a fresh layer was built');
  assert.notEqual(fresh, layer, 'and it is not the detached one the module had cached');
  assert.equal(fresh.parentNode, document.body, 'it hangs off <body>');
  assert.equal(fresh.querySelectorAll('.zoom-slot').length, 1, 'with exactly one overlay in it');
});

test('a layer the page already provides is adopted, never duplicated', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  zoom.unzoom({ instant: true });
  const old = document.getElementById('zoom-layer');
  if (old) old.remove();
  const mine = document.createElement('div');
  mine.id = 'zoom-layer';
  document.body.appendChild(mine);

  zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  assert.equal(document.querySelectorAll('#zoom-layer').length, 1, 'one layer, not two');
  assert.equal(slot().parentNode, mine, 'the overlay went into the page\'s own layer');
});

test('re-zooming the SAME card is a no-op that keeps the standing overlay', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const first = zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  assert.equal(first.name, 'GRiZ', 'the first grow reports its facts');
  const standing = slot();

  const again = zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
  assert.equal(again, null, 'a second grow of the same card reports nothing');
  assert.equal(slot(), standing, 'and the overlay on stage is the SAME node — never rebuilt under the hand resting on it');
  assert.equal(document.querySelectorAll('.zoom-slot').length, 1);
});

// ---- the exit's ghost belt --------------------------------------------------

test('an exit animation that never finishes still has its slot reaped', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    const ghost = slot();
    zoom.unzoom({ why: 'a backgrounded tab never finishes an animation' });
    assert.ok(ghost.isConnected, 'the slot waits for its way out');
    await wait(300);
    assert.ok(ghost.isConnected, 'the belt is generous on purpose — the gallery watches exits at 4x slow motion');
    await wait(500);
    assert.ok(!ghost.isConnected, 'and it does eventually reap the ghost');
  } finally {
    rec.off();
  }
});

test('an exit reaps its slot whether the animation finishes or is cancelled', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  const exitAnim = (ghost) => {
    const out = rec.calls.find((c) => c.target === ghost);
    assert.ok(out, 'the exit animates the slot');
    return out;
  };
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    let ghost = slot();
    rec.calls.length = 0;
    zoom.unzoom({ why: 'an exit that finishes' });
    exitAnim(ghost).finish();
    assert.ok(!ghost.isConnected, 'onfinish takes the slot off stage');

    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    ghost = slot();
    rec.calls.length = 0;
    zoom.unzoom({ why: 'an exit that is cancelled' });
    const out = exitAnim(ghost);
    out.cancel();
    assert.ok(!ghost.isConnected, 'oncancel reaps it too — a cancelled way out must not strand a ghost');
    // A browser that fires both, or a timeout landing on top of a finish, runs
    // the teardown once: it is guarded, not merely idempotent-by-luck.
    assert.doesNotThrow(() => { out.finish(); out.cancel(); }, 'a second report is harmless');
  } finally {
    rec.off();
  }
});
