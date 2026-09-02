// The animated paths (2026-09-01 review, coverage rows "The cascade's shape",
// "refreshZoom's animated re-entrance", "In-flight anims ... LEFT RUNNING" and
// "canAnimate gate"). jsdom has no Element.animate and all-zero layout, so
// every one of these branches is dead in CI until a test installs both — which
// is how roughly fifty lines of the refresh block came to run only on Kevin's
// machine.
//
// Two stubs, both scoped and both restored:
//   · a recording Element.animate, so the timeline can be read back;
//   · a fake layout, because the FLIP half of the refresh is arithmetic on
//     rects and jsdom's are all zero — with real zeros a surviving part hits
//     neither branch of the loop and only arrivals ever animate.
// The fake layout is a pure function of (what the element is, where it sits
// among its siblings), so adding a pill shifts the ones after it exactly the
// way a real reflow would.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig, recordAnimations } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, zoom, state, makeCtx, mountCard, click, FID } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };

const PART_SEL = '.f-name, .f-sub, .f-where, .f-pill, .f-chip.notes, .f-chip.spot';
function fakeBox(el) {
  const cls = el.classList;
  if (cls.contains('zoom-slot')) {
    // The box grows with what it has to hold, so a pick that adds a pill
    // genuinely re-sizes the overlay and the surface clip has work to do.
    const pills = el.querySelectorAll('.f-pill').length;
    return { left: 120, top: 200, width: 240 + pills * 20, height: 140 };
  }
  if (cls.contains('card') && !cls.contains('zoom-card')) return { left: 100, top: 220, width: 160, height: 96 };
  if (cls.contains('zoom-card') || cls.contains('z-surface')) return { left: 120, top: 200, width: 240, height: 140 };
  // A part stacks under the parts before it, the way a real block reflows: add
  // a pill and everything below it moves down. Without that, jsdom's identical
  // zero-rects put every survivor exactly where it was and the whole FLIP half
  // of the loop stays unreachable.
  const host = el.closest('.zoom-card') || el.closest('.card') || el.ownerDocument.body;
  const parts = [...host.querySelectorAll(PART_SEL)];
  const stack = Math.max(0, parts.indexOf(el));
  const p = el.parentNode;
  const across = p && p.children ? Math.max(0, [...p.children].indexOf(el)) : 0;
  return { left: 130 + across * 44, top: 210 + stack * 22, width: 40, height: 18 };
}
function fakeLayout() {
  const proto = rig.window.Element.prototype;
  const real = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function () {
    const b = fakeBox(this);
    return { ...b, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top };
  };
  return () => { proto.getBoundingClientRect = real; };
}

const setMyLevel = (n) => { state.crewDoc.festivals[FID].selections.GRiZ.Kevin = n; };
const overlay = () => document.querySelector('#zoom-layer .zoom-card');
const onTarget = (calls, sel) => calls.filter((c) => c.target.matches && c.target.matches(sel));
const firstTranslate = (call) => call.keyframes[0].transform || '';

test.afterEach(() => zoom.unzoom({ instant: true }));

// ---- the bloom's cascade ----------------------------------------------------

test('the cascade arrives in family order, each line from its own corner', () => {
  setMyLevel(1);
  const ctx = makeCtx();
  // A Spotify chip so the chips row has TWO members and the beat between them
  // is observable — with one chip the stagger assertion would be vacuous.
  ctx.affinity = { griz: { songs: 7, followed: true } };
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: { day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM' } });
    const sub = onTarget(rec.calls, '.f-sub')[0];
    const where = onTarget(rec.calls, '.f-where')[0];
    const pills = onTarget(rec.calls, '.f-pill');
    const chips = onTarget(rec.calls, '.f-chip');
    assert.ok(sub && where, 'WHEN and WHERE animate in');
    assert.ok(pills.length >= 2 && chips.length >= 2, 'two of each, so "a beat apart" has something to measure');

    // The name has no animation of its own — it IS the card and rides the scale.
    assert.equal(onTarget(rec.calls, '.f-name').length, 0, 'the name never animates separately');

    // WHEN, then WHERE, then the rest: a beat apart, in family order.
    assert.ok(sub.options.delay < where.options.delay, 'WHERE follows WHEN');
    assert.ok(where.options.delay < pills[0].options.delay, 'the people follow WHERE');
    for (const group of [pills, chips]) {
      for (let i = 1; i < group.length; i++) {
        assert.ok(group[i].options.delay > group[i - 1].options.delay, 'each arrival is a beat after the last');
      }
    }

    // Each from its own corner: WHEN and WHERE rise; the people slide in from
    // the RIGHT where the colour marks live; notes and Spotify from the LEFT
    // where their numbers sit.
    assert.match(firstTranslate(sub), /^translate\(0px, \d+px\)$/, 'WHEN rises');
    assert.match(firstTranslate(where), /^translate\(0px, \d+px\)$/, 'WHERE rises');
    for (const p of pills) assert.match(firstTranslate(p), /^translate\(\d+px, 0px\)$/, 'a person arrives from the right');
    for (const c of chips) assert.match(firstTranslate(c), /^translate\(-\d+px, 0px\)$/, 'a chip arrives from the left');
  } finally {
    rec.off();
  }
});

test('the bloom starts from the resting card\'s own centre, at a scale inside the clamp', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  const undo = fakeLayout();
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { occ: OCC });
    const slot = document.querySelector('.zoom-slot');
    const grow = rec.calls.find((c) => c.target === slot && /scale/.test(firstTranslate(c)));
    assert.ok(grow, 'the slot grows');
    const k = Number(firstTranslate(grow).match(/scale\(([\d.]+)\)/)[1]);
    // resting height 96 over grown height 140 = 0.686, floored at 0.7 — the
    // clamp is what stops the materialise reading as tiny text blowing up.
    assert.ok(k >= 0.7 && k <= 0.95, `the starting scale is clamped to 0.7–0.95 (got ${k})`);
    assert.equal(grow.keyframes[1].transform, 'scale(1)');

    // transform-origin is the resting centre EXPRESSED INSIDE THE PLACED box —
    // not the box's own pre-placement rect — so the card grows from the spot it
    // lives on the wall. Resting centre (180, 268); the placed box lands at
    // (40, 198) after centring; 180−40 = 140, 268−198 = 70.
    assert.equal(slot.style.left, '40px', 'the box is centred on the card, not left where it was built');
    assert.equal(slot.style.top, '198px');
    assert.equal(slot.style.transformOrigin, '140px 70px');
  } finally {
    undo();
    rec.off();
  }
});

// ---- the gate: Low Power and reduced motion both mean instant ---------------

test('Low Power and reduced motion each force the instant path, and still build a whole card', () => {
  const rec = recordAnimations(rig.window);
  const realMM = rig.window.matchMedia;
  try {
    for (const mode of ['lowPower', 'reduced']) {
      const ctx = makeCtx();
      const card = mountCard(ctx);
      ctx.lowPower = mode === 'lowPower';
      rig.window.matchMedia = () => ({ matches: mode === 'reduced', addEventListener() {}, removeEventListener() {} });
      rec.calls.length = 0;
      zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
      assert.equal(rec.calls.length, 0, `${mode}: not one animation — CSS cannot reach Element.animate(), so the gate lives here`);
      const grown = overlay();
      assert.ok(grown, `${mode}: the overlay is still there`);
      assert.ok(grown.querySelector('.f-name') && grown.querySelector('.z-surface') && grown.querySelector('button.f-chip.notes'),
        `${mode}: instant is not broken — every part is built`);
      zoom.unzoom({ instant: true });
    }
  } finally {
    rig.window.matchMedia = realMM;
    rec.off();
  }
});

// ---- the animated refresh: fifty lines CI had never executed ----------------

test('a pick while zoomed re-enters: the old wash unclips away, survivors slide, an arrival grows in', () => {
  setMyLevel(0); // so my first tap CREATES the You pill — a genuine arrival
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  const undo = fakeLayout();
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
    const oldSurface = overlay().querySelector('.z-surface');
    rec.calls.length = 0;
    click(overlay()); // the pick: refreshCard, then refreshZoom on the fresh node

    const fade = rec.calls.find((c) => c.target === oldSurface);
    assert.ok(fade, 'the old wash lingers over the new one and thins away');
    assert.equal(fade.keyframes[0].opacity, 1);
    assert.equal(fade.keyframes[1].opacity, 0);
    assert.equal(fade.keyframes[0].clipPath, 'inset(0px round 8px)', 'it starts showing all of itself');
    assert.match(fade.keyframes[1].clipPath, /^inset\(\d+(\.\d+)?px \d+(\.\d+)?px \d+(\.\d+)?px \d+(\.\d+)?px round 8px\)$/,
      'and ends clipped to exactly the new box out of the old one');

    const arrivals = rec.calls.filter((c) => /scale\(\.55\)/.test(firstTranslate(c)));
    assert.equal(arrivals.length >= 1, true, 'the pill that just arrived grows in with a little overshoot');
    assert.ok(arrivals[0].target.matches('.f-pill'), 'and it is a pill');
    assert.equal(arrivals[0].keyframes[0].opacity, 0);

    const slides = rec.calls.filter((c) => /^translate\(-?[\d.]+px, -?[\d.]+px\)$/.test(firstTranslate(c)) && c.keyframes.at(-1).transform === 'none');
    assert.ok(slides.length >= 1, 'every piece that stayed slides from where it was to where it is');
    assert.ok(slides.every((s) => s.keyframes.length === 2), 'a survivor slides, it does not re-arrive');
  } finally {
    undo();
    rec.off();
  }
});

test('a badge that just appeared fades on, and one that was already there does not', () => {
  setMyLevel(3); // one tap from MUST
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  const undo = fakeLayout();
  const badgeFades = () => rec.calls.filter((c) => c.target.tagName === 'B');
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
    rec.calls.length = 0;
    click(overlay()); // 3 → 4: the You pill gains its MUST badge
    const fades = badgeFades();
    assert.equal(fades.length, 1, 'exactly the badge that just appeared fades on');
    assert.equal(fades[0].keyframes[0].opacity, 0);
    assert.equal(fades[0].keyframes[1].opacity, 1);
    assert.ok(fades[0].options.delay > 0, 'a beat after the pill it sits on has moved');

    // Drew has been MUST throughout; a re-render must not re-announce them.
    rec.calls.length = 0;
    click(overlay()); // 4 → 0
    click(overlay()); // 0 → 1: Drew's badge has never changed
    assert.equal(badgeFades().length, 0, 'a badge that was always there is not an event');
  } finally {
    undo();
    rec.off();
  }
});

test('the refresh keeps the compositor-only budget — clipPath is confined to the two surfaces', () => {
  setMyLevel(0); // a pick that ADDS a pill, so survivors slide and arrivals grow
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  const undo = fakeLayout();
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
    rec.calls.length = 0;
    click(overlay());
    for (const c of rec.calls) {
      const onSurface = c.target.matches('.z-surface, .z-surface-old');
      for (const kf of c.keyframes) {
        for (const k of Object.keys(kf)) {
          const allowed = ['transform', 'opacity', 'offset', 'easing'];
          if (onSurface) allowed.push('clipPath');
          assert.ok(allowed.includes(k),
            `${k} on ${c.target.className || c.target.tagName} — a layout property inside the overlay is a wall reflow waiting`);
        }
      }
    }
    // Not a vacuous pass: this scenario really does produce all three shapes
    // the budget applies to — a clipping surface, a survivor sliding, and an
    // arrival growing in.
    assert.ok(rec.calls.some((c) => c.keyframes.some((kf) => 'clipPath' in kf)), 'the surfaces really do clip');
    assert.ok(rec.calls.some((c) => !c.target.matches('.z-surface, .z-surface-old') && /^translate\(-?[\d.]+px, -?[\d.]+px\)$/.test(firstTranslate(c))),
      'and a survivor really does slide');
    assert.ok(rec.calls.some((c) => /scale\(\.55\)/.test(firstTranslate(c))), 'and something really does arrive');
  } finally {
    undo();
    rec.off();
  }
});

// ---- what happens to animations already in flight ---------------------------

test('an animated exit LEAVES the interior cascade running; an instant one cancels it', () => {
  setMyLevel(1);
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
    const cascade = onTarget(rec.calls, '.f-sub, .f-where, .f-pill, .f-chip');
    assert.ok(cascade.length, 'a bloom is in flight');
    zoom.unzoom({ why: 'the animated way out' });
    assert.ok(cascade.every((a) => !a.cancelled),
      'left running on purpose: the slot-level out overrides the slot\'s own, an interior line simply keeps playing as the card recedes, and cancelling here snapped half-arrived lines to full opacity for a frame');

    rec.calls.length = 0;
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
    const cascade2 = onTarget(rec.calls, '.f-sub, .f-where, .f-pill, .f-chip');
    assert.ok(cascade2.length, 'a second bloom is in flight');
    zoom.unzoom({ instant: true, why: 'the instant way out' });
    assert.ok(cascade2.every((a) => a.cancelled), 'nothing survives an instant teardown — the slot goes at once');
  } finally {
    rec.off();
  }
});

test('a pick cancels the bloom still in flight before it lays down the next one', () => {
  setMyLevel(1);
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  const undo = fakeLayout();
  try {
    zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
    const bloom = [...rec.calls];
    assert.ok(bloom.length, 'a bloom is in flight');
    rec.calls.length = 0;
    click(overlay());
    assert.ok(bloom.every((a) => a.cancelled), 'the refresh starts from a clean slate — two timelines on one node is the double-print disease');
    assert.ok(rec.calls.some((c) => !c.cancelled), 'and it lays down its own');
  } finally {
    undo();
    rec.off();
  }
});
