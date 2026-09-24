// The who-chips in motion — the mechanics (storyboard:
// claude-plans/2026-09-23-zoom-chips-motion.md). Which nodes move where, what
// is parked and when it goes, and the law: one rendering of every fact — never
// two nodes for one person at once, whatever the taps do.
//
// jsdom has no Element.animate and no layout, so both are stubbed (recorded
// animations; a fake box model where a chip's box follows its place in the
// row and a name's follows its place in its chip, so a reflow really moves
// things). The FEEL is a real-browser job (gallery.html's chip-motion row);
// this file pins the mechanics so a later fix cannot quietly break them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig, recordAnimations } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, zoom, state, makeCtx, mountCard, click, FID } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
state.crewDoc.people.Pegah = { colorIndex: 2 };
state.crewDoc.people.Nhu = { colorIndex: 3 };

const CARD = { left: 100, top: 200 };
function fakeBox(el) {
  const c = el.classList;
  if (c.contains('zoom-slot') || c.contains('zoom-card') || c.contains('z-surface')) return { left: CARD.left, top: CARD.top, width: 320, height: 180 };
  if (c.contains('card')) return { left: 120, top: 240, width: 160, height: 96 };
  if (c.contains('f-parked')) {
    // Parked in the card, or inside the chip it left (then the chip's box is the origin).
    const host = el.parentElement && el.parentElement.classList.contains('f-pill') ? fakeBox(el.parentElement) : CARD;
    return { left: host.left + parseFloat(el.style.left), top: host.top + parseFloat(el.style.top), width: parseFloat(el.style.width), height: parseFloat(el.style.height) };
  }
  const chip = el.closest('.f-pill');
  if (!chip) return { left: 0, top: 0, width: 0, height: 0 };
  const row = chip.parentElement;
  const i = row && !chip.classList.contains('f-parked') ? [...row.children].indexOf(chip) : 0;
  const n = JSON.parse(chip.dataset.people || '[]').length;
  const box = chip.classList.contains('f-parked')
    ? fakeBox(chip)
    : { left: 110 + i * 90, top: 300, width: 40 + 24 * Math.min(n, 2), height: 22 };
  if (el === chip || c.contains('f-fill')) return box;
  if (c.contains('bars') || c.contains('must')) return { left: box.left + 6, top: box.top + 6, width: 12, height: 10 };
  const k = [...chip.querySelectorAll('.f-nm, .f-more')].indexOf(el);
  if (k >= 0) return { left: box.left + 22 + k * 26, top: box.top + 4, width: 22, height: 14 };
  return { left: box.left + 6, top: box.top + 8, width: 3, height: 8 };
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

const overlay = () => document.querySelector('#zoom-layer .zoom-card');
const chipAt = (lv) => overlay().querySelector(`.f-who > .f-pill[data-level="${lv}"]`);
const parked = () => [...overlay().querySelectorAll('.f-parked')];
const on = (calls, node) => calls.filter((c) => c.target === node);
const first = (c) => c.keyframes[0].transform || '';
// THE LAW: at no moment are there two nodes for one person anywhere in the zoom.
function oneEach() {
  const seen = new Map();
  for (const nm of overlay().querySelectorAll('.f-nm[data-person]')) seen.set(nm.dataset.person, (seen.get(nm.dataset.person) || 0) + 1);
  for (const [who, n] of seen) assert.equal(n, 1, `${who} is rendered ${n} times at once`);
}

// Zoom GRiZ with these picks, then tap once while recording.
function scene(picks) {
  state.crewDoc.festivals[FID].selections.GRiZ = { ...picks };
  const ctx = makeCtx();
  const card = mountCard(ctx);
  const rec = recordAnimations(rig.window);
  const undo = fakeLayout();
  zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  rec.calls.length = 0;
  return {
    ctx, rec,
    // The zoom's own animations: the resting card's meter animates on the
    // same refresh (wall.js), and the zoom does not own those.
    tap() { rec.calls.length = 0; click(overlay().querySelector('.f-name')); oneEach(); return rec.calls.filter((c) => c.target.closest && c.target.closest('#zoom-layer')); },
    done() { undo(); rec.off(); zoom.unzoom({ instant: true }); },
  };
}

test('alone → alone: the chip is carried — a bar rises, the glow deepens, nothing dissolves or regrows', () => {
  const s = scene({ Kevin: 2 });
  try {
    const was = chipAt(2);
    const calls = s.tap(); // 2 → 3
    const now = chipAt(3);
    assert.ok(now && !chipAt(2), 'one chip, now at ×3');
    assert.notEqual(now, was, 'a new node (the refresh rebuilds) …');
    assert.equal(parked().length, 0, '… but nothing is parked: the ×2 chip did not die, it was carried');
    assert.equal(on(calls, now).filter((c) => /scale\(\.55\)/.test(first(c))).length, 0, 'no regrow');
    const fill = now.querySelector(':scope > .f-fill');
    assert.ok(on(calls, fill).some((c) => /scale\(/.test(first(c)) && c.keyframes.length === 3), 'the fill bloops');
    const remix = fill.querySelector('.f-fill');
    assert.ok(remix, 'the old ×2 glow is laid over the new ×3 one …');
    assert.deepEqual(on(calls, remix)[0].keyframes.map((k) => k.opacity), [1, 0], '… and thins away');
    const bar = now.querySelectorAll('.bars .bar')[2];
    assert.equal(on(calls, bar)[0].keyframes[0].transform, 'scaleY(0)', 'the third bar rises from its foot');
    for (const c of calls) c.finish();
    assert.equal(fill.querySelector('.f-fill'), null, 'the remix layer removes itself when done');

    const calls2 = s.tap(); // 3 → MUST
    const must = chipAt(4);
    const oldBars = parked().find((p) => p.classList.contains('bars'));
    assert.ok(oldBars, 'the bars step out where they stood …');
    assert.equal(oldBars.parentElement, must, '… inside the carried chip, so they ride its slide and keep its look');
    assert.deepEqual(on(calls2, oldBars)[0].keyframes.map((k) => k.opacity), [1, 0]);
    const word = must.querySelector('.must');
    assert.equal(on(calls2, word)[0].keyframes[0].opacity, 0, '… and MUST arrives as the word');
    for (const c of calls2) c.finish();
    assert.equal(parked().length, 0, 'nothing parked outlives its animation');
  } finally { s.done(); }
});

test('split: your chip pinches off from where your name stood; the chip you left contracts around your friend', () => {
  const s = scene({ Kevin: 2, Pegah: 2 });
  try {
    const youWas = chipAt(2).querySelector('.f-nm.you').getBoundingClientRect();
    const calls = s.tap(); // you 2 → 3, Pegah stays at 2
    const born = chipAt(3);
    const left = chipAt(2);
    assert.equal(parked().length, 0, 'nobody dies in a split');
    const t = on(calls, born).find((c) => /^translate/.test(first(c)));
    assert.ok(t, 'the new chip travels to its slot …');
    const bornBox = born.getBoundingClientRect();
    const [dx] = first(t).match(/-?[\d.]+/g).map(Number);
    assert.equal(dx, (youWas.left + youWas.width / 2) - (bornBox.left + bornBox.width / 2), '… from exactly where your name stood');
    assert.ok(on(calls, born.querySelector(':scope > .f-fill')).some((c) => c.keyframes.length === 3), 'and stretches out of it with the bloop');
    const pegahFill = left.querySelector(':scope > .f-fill');
    assert.ok(on(calls, pegahFill).some((c) => c.keyframes.length === 3), 'the chip you left contracts, with the bloop');
    assert.ok(pegahFill.querySelector('.f-fill'), 'and its blend re-mixes to Pegah\'s own colour');
    assert.equal(born.querySelector('.f-bud'), null, 'no bud: the new chip itself is the bud');
  } finally { s.done(); }
});

test('merge: your chip flows into your friend\'s; your name travels as itself, with a bud of your colour', () => {
  const s = scene({ Kevin: 2, Drew: 3 });
  try {
    const calls = s.tap(); // you 2 → 3, into Drew's chip
    const joined = chipAt(3);
    assert.equal(chipAt(2), null);
    const ghost = parked().find((p) => p.classList.contains('f-pill') && !p.classList.contains('f-ghost'));
    assert.ok(ghost, 'the ×2 chip\'s body is parked where it stood …');
    assert.equal(ghost.querySelector('.f-nm'), null, '… emptied of your name, which lives on in Drew\'s chip');
    assert.match(on(calls, ghost)[0].keyframes[1].transform, /^translate\(.+\) scaleX\(\.4\)$/, '… flowing toward the chip it joins');
    const you = joined.querySelector('.f-nm.you');
    assert.ok(on(calls, you).some((c) => /^translate/.test(first(c))), 'your name travels from where it stood');
    const bud = you.querySelector('.f-bud');
    assert.ok(bud, 'with a bud of your colour under it');
    const probe = document.createElement('span');
    probe.style.background = you.dataset.color;
    assert.equal(bud.style.background, probe.style.background, 'your own colour');
    assert.ok(you.classList.contains('f-travel'), 'above its neighbours in flight');
    assert.ok(joined.classList.contains('f-carrying'), '… and the chip it lands in rides over the chips beside it until it does');
    assert.ok(joined.querySelector(':scope > .f-fill > .f-fill'), 'Drew\'s colour re-mixes into the blend of both');
    // The level glyph is the chip's own fact: as the chip widens it slides from
    // where it stood (less the chip's own slide), riding the fill's edge.
    const glyph = joined.querySelector(':scope > .bars');
    assert.ok(on(calls, glyph).some((c) => /^translate/.test(first(c))), 'the glyph slides from where it stood, never jumps');
    for (const c of calls) c.finish();
    assert.equal(overlay().querySelectorAll('.f-parked, .f-bud, .f-fill .f-fill, .f-travel, .f-carrying').length, 0, 'everything temporary is gone at the end');
  } finally { s.done(); }
});

test('split + merge: both chips stay; you leave one friend and join the other in one move', () => {
  const s = scene({ Kevin: 2, Pegah: 2, Drew: 3 });
  try {
    const calls = s.tap(); // you 2 → 3
    assert.equal(parked().length, 0, 'no chip dies, none is born');
    assert.ok(chipAt(2) && chipAt(3));
    assert.ok(chipAt(2).querySelector(':scope > .f-fill > .f-fill') && chipAt(3).querySelector(':scope > .f-fill > .f-fill'), 'both blends re-mix');
    const you = chipAt(3).querySelector('.f-nm.you');
    assert.ok(on(calls, you).some((c) => /^translate/.test(first(c))) && you.querySelector('.f-bud'), 'your name crosses with its bud');
  } finally { s.done(); }
});

test('first pick: a level nobody held grows in; joining a level somebody holds grows your name in', () => {
  const s = scene({ Drew: 4 });
  try {
    const calls = s.tap(); // you 0 → 1: nobody at ×1
    const born = chipAt(1);
    assert.ok(on(calls, born).some((c) => /scale\(\.55\)/.test(first(c))), 'the zoom\'s own arrival');
    assert.equal(parked().length, 0);
  } finally { s.done(); }
  const s2 = scene({ Drew: 1 });
  try {
    const calls = s2.tap(); // you 0 → 1: Drew is at ×1
    const you = chipAt(1).querySelector('.f-nm.you');
    assert.ok(on(calls, you).some((c) => /scale\(\.3\)/.test(first(c))), 'your name grows in at the lead');
    assert.ok(chipAt(1).querySelector(':scope > .f-fill > .f-fill'), 'and the blend takes your colour');
  } finally { s2.done(); }
});

test('clear: alone, the MUST chip goes where it stood; shared, only your name goes', () => {
  const s = scene({ Kevin: 4 });
  try {
    const calls = s.tap(); // MUST → 0
    assert.equal(overlay().querySelector('.f-who'), null, 'nobody left: no row');
    const ghost = parked().find((p) => p.classList.contains('f-pill') && !p.classList.contains('f-ghost'));
    assert.ok(ghost && ghost.querySelector('.f-nm.you'), 'the chip leaves with your name in it — its one rendering');
    assert.deepEqual(on(calls, ghost)[0].keyframes.map((k) => k.opacity), [1, 0], 'quick and plain');
  } finally { s.done(); }
  const s2 = scene({ Kevin: 4, Drew: 4 });
  try {
    const calls = s2.tap();
    const gone = parked().find((p) => p.classList.contains('f-nm'));
    assert.ok(gone && gone.dataset.person === 'Kevin', 'your name is parked where it stood and steps away …');
    assert.equal(gone.parentElement, chipAt(4), '… inside the chip it left, riding that chip\'s slide');
    assert.equal(gone.getAttribute('aria-hidden'), 'true', 'a leaver is hidden from the reader (the chip\'s label says who is there)');
    // Where it stood: the chip's first frame is its box plus its slide, so the
    // parked offset is measured from there.
    const slide = on(calls, chipAt(4))[0];
    const [sx, sy] = slide ? (first(slide).match(/-?[\d.]+/g) || [0, 0]).map(Number) : [0, 0];
    const chipBox = chipAt(4).getBoundingClientRect();
    assert.equal(chipBox.left + sx + parseFloat(gone.style.left), 110 + 22, 'its first frame is exactly where it stood (x)');
    assert.equal(chipAt(4).querySelector('.f-names .f-nm.you'), null, 'the MUST chip no longer lists you');
    assert.ok(on(calls, gone)[0].keyframes[1].opacity === 0);
  } finally { s2.done(); }
});

test('rapid taps never strand anything: each refresh cancels the last, and everything temporary goes with it', async () => {
  const s = scene({ Kevin: 1, Pegah: 2, Drew: 3 });
  try {
    let prev = [];
    for (let i = 0; i < 9; i++) {
      const calls = s.tap(); // 2, 3, 4, 0, 1, 2, … through every case, never letting one finish
      assert.ok(prev.every((a) => a.cancelled), `tap ${i + 1}: the previous refresh's animations were all cancelled`);
      const temp = overlay().querySelectorAll('.f-parked, .f-bud, .f-fill .f-fill, .f-travel, .f-carrying');
      const live = new Set(calls.map((c) => c.target));
      for (const t of temp) {
        const mine = live.has(t) || [...live].some((n) => n.contains && n.contains(t)) || t.classList.contains('f-travel');
        assert.ok(mine, `tap ${i + 1}: every temporary node belongs to this refresh, none is left from the last`);
      }
      prev = calls;
    }
    for (const a of prev) a.cancel();
    await Promise.resolve(); // cancel reports late, as in a browser (zoom-rig recordAnimations)
    assert.equal(overlay().querySelectorAll('.f-parked, .f-bud, .f-fill .f-fill, .f-travel, .f-carrying').length, 0, 'after the last one: nothing');
    for (const host of overlay().querySelectorAll('.f-names')) assert.equal(host.style.overflow, '', 'no lifted clip left behind');
  } finally { s.done(); }
});

// Storyboard case 5 right after case 6, while your name is still stepping
// away. The re-pick cancels the clear's animations, but a browser reports a
// cancelled animation on the NEXT frame, so the clear's parked name was still
// inside Nhu's chip when the re-pick read the row, was taken for you, and the
// new ×1 chip flew ~180px out of Nhu's MUST chip (review, 2026-09-24, both
// engines). The rig's cancel() reports late now, so this is that browser.
test('clear, then a quick re-pick: the new level grows in where the row makes room — never out of the chip you left', () => {
  const s = scene({ Kevin: 4, Nhu: 4 });
  try {
    s.tap(); // MUST → 0: your name is parked inside Nhu's chip, stepping away
    assert.ok(parked().some((p) => p.classList.contains('f-nm')), 'the clear parked your name (the leftover the re-pick must not read)');
    const calls = s.tap(); // 0 → 1 before the cancel report lands
    const born = chipAt(1);
    assert.ok(born && born.classList.contains('you'), 'you are at ×1');
    assert.ok(on(calls, born).some((c) => /scale\(\.55\)/.test(first(c))), 'the ×1 chip is born in place — the zoom\'s own arrival');
    assert.ok(!on(calls, born).some((c) => /^translate/.test(first(c))), 'it does not travel from anywhere: nobody was at ×1, and you were at nothing');
    assert.equal(parked().length, 0, 'the clear\'s leftovers were taken down before the re-pick read the row');
  } finally { s.done(); }
});

test('the two defences, each on its own: whoSettle takes every leftover down; whoSnapshot never reads a parked piece as live', async () => {
  const { whoSettle, whoSnapshot } = await import('../js/v3/who-motion.js');
  const s = scene({ Kevin: 4, Nhu: 4 });
  try {
    s.tap(); // MUST → 0 with Nhu: your name parked inside Nhu's chip
    const card = overlay();
    // Stand in everything a pick can leave behind, all at once.
    const chip = chipAt(4);
    const bud = document.createElement('span'); bud.className = 'f-bud'; chip.querySelector('.f-nm').appendChild(bud);
    const layer = document.createElement('span'); layer.className = 'f-fill'; chip.querySelector(':scope > .f-fill').appendChild(layer);
    chip.classList.add('f-carrying');
    chip.querySelector('.f-nm').classList.add('f-travel');
    chip.querySelector('.f-names').style.overflow = 'visible';
    const snap = whoSnapshot(card);
    assert.ok(!snap.names.has('Kevin'), 'the snapshot reads only the row\'s own names: your parked name is not a fact');
    assert.equal(snap.you, null, 'and so you are nowhere — you cleared');
    assert.ok(snap.names.has('Nhu'), 'Nhu is');
    whoSettle(card);
    assert.equal(card.querySelectorAll('.f-parked, .f-bud, .f-fill .f-fill, .f-travel, .f-carrying').length, 0, 'whoSettle: nothing temporary left');
    for (const host of card.querySelectorAll('.f-names')) assert.equal(host.style.overflow, '', 'whoSettle: no lifted clip');
    assert.ok(chip.querySelector('.f-nm[data-person="Nhu"]'), 'and the live row is untouched');
  } finally { s.done(); }
});

test('Low Power and reduced motion: no snapshot, nothing moves, nothing is parked — the new row just stands', () => {
  for (const mode of ['lowPower', 'reduced']) {
    state.crewDoc.festivals[FID].selections.GRiZ = { Kevin: 2, Drew: 3 };
    const ctx = makeCtx();
    ctx.lowPower = mode === 'lowPower';
    const realMM = rig.window.matchMedia;
    rig.window.matchMedia = () => ({ matches: mode === 'reduced', addEventListener() {}, removeEventListener() {} });
    const card = mountCard(ctx);
    const rec = recordAnimations(rig.window);
    const undo = fakeLayout();
    try {
      zoom.zoomCard(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
      click(overlay().querySelector('.f-name'));
      assert.equal(rec.calls.length, 0, `${mode}: not one animation`);
      assert.equal(parked().length, 0, `${mode}: nothing parked`);
      assert.deepEqual([...overlay().querySelectorAll('.f-who > .f-pill')].map((c) => c.dataset.level), ['3'], `${mode}: you and Drew in one chip, at once`);
    } finally {
      undo(); rec.off(); rig.window.matchMedia = realMM; zoom.unzoom({ instant: true });
    }
  }
});
