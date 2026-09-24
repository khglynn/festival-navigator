// The who-chips, in motion (2026-09-23). Storyboard:
// claude-plans/2026-09-23-zoom-chips-motion.md — read it before touching this.
//
// Kevin: "you'd morph into and out of your left and right friend's rankings as
// you tap and your colors would merge and separate all like bloop bloop".
//
// The zoom's refresh (card-facts.js refreshZoomInner) rebuilds the grown block
// on every pick. This module owns ONLY the who-row's side of that: before the
// rebuild the refresh takes `whoSnapshot(card)`; after it, `whoMotion(card,
// before)` returns the animations, which the refresh keeps with its own (so
// the next pick cancels them together). The bloom, the way out, hover and the
// long-press never pass through here.
//
// The law (2026-08-30): one rendering of every fact. A name is a fact; a chip's
// fill is not. So a name that is still shown is FLIPped as the new row's node,
// from where that person's name stood; a name that stops being shown is its
// OLD node, taken back out of the discarded row and parked where it stood,
// leaving. Never two nodes for one person. The only crossfade is a chip's fill
// (the old blend, laid over the new one inside the fill, thinning away), and a
// chip's width change is its fill's scale, so a name is never stretched.
// Transforms and opacity only; everything this adds to the page removes itself
// when its animation finishes OR is cancelled.
import { REFRESH_MS, GROW_MS, OUT_MS, CASCADE_MS, EASE_ARRIVE, EASE_LEAVE, EASE_SURFACE } from './motion.js';

const rect = (n) => n.getBoundingClientRect();
const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const people = (chip) => { try { return JSON.parse(chip.dataset.people || '[]'); } catch { return []; } };
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Where everything in the who-row stands, and the nodes themselves (the
// refresh is about to discard them; a leaving name is parked from here).
export function whoSnapshot(card) {
  const snap = { chips: new Map(), names: new Map(), more: new Map(), you: null };
  const row = card.querySelector('.f-who');
  if (!row) return snap;
  for (const chip of row.children) {
    if (!chip.classList.contains('f-pill')) continue;
    const level = chip.dataset.level;
    const fill = chip.querySelector(':scope > .f-fill');
    const glyph = chip.querySelector(':scope > .bars, :scope > .must');
    snap.chips.set(level, {
      node: chip, rect: rect(chip), fillWidth: fill ? rect(fill).width : rect(chip).width,
      bg: fill ? fill.style.background : '', people: people(chip), glyph, glyphRect: glyph ? rect(glyph) : null,
    });
    for (const nm of chip.querySelectorAll('.f-nm[data-person]')) {
      const entry = { node: nm, rect: rect(nm), level };
      snap.names.set(nm.dataset.person, entry);
      if (nm.classList.contains('you')) snap.you = { person: nm.dataset.person, level, rect: entry.rect };
    }
    const more = chip.querySelector(':scope .f-more');
    if (more) snap.more.set(level, { node: more, rect: rect(more) });
  }
  return snap;
}

export function whoMotion(card, before) {
  const anims = [];
  const R = REFRESH_MS;
  const row = card.querySelector('.f-who');
  const cardRect = rect(card);
  const after = new Map();
  if (row) for (const chip of row.children) if (chip.classList.contains('f-pill')) after.set(chip.dataset.level, chip);
  const youNew = row ? row.querySelector('.f-nm.you') : null;
  const fromL = before.you ? before.you.level : null;
  const toL = youNew ? youNew.closest('.f-pill').dataset.level : null;
  // Every READ of the new row happens here, before the first animation: a
  // FLIP's first frame applies the instant it starts, so a name measured after
  // its chip's slide began reads as already home and never travels (seen in
  // Chromium 2026-09-23; jsdom has no transforms to show it). Below this line
  // nothing in the new row is measured again.
  const now = new Map();
  if (row) for (const el of row.querySelectorAll('.f-pill, .f-fill, .f-nm[data-person], .f-more, .f-pill > .bars, .f-pill > .must')) now.set(el, rect(el));
  const at = (el) => now.get(el) || rect(el);
  // The new row's names and "+n"s, listed once, now: leavers are parked INSIDE
  // live chips below, and a later query of the row would take a parked ghost
  // for a live node and slide it (it did: a folded "+1" flew 73px, 2026-09-23).
  const liveNames = row ? [...row.querySelectorAll('.f-nm[data-person]')] : [];
  const liveMore = row ? [...row.querySelectorAll('.f-more')] : [];

  const run = (el, frames, opts, done) => {
    const a = el.animate(frames, opts);
    if (done) { let ran = false; const once = () => { if (!ran) { ran = true; done(); } }; a.onfinish = once; a.oncancel = once; }
    anims.push(a);
    return a;
  };
  const moveOf = new Map(); // new chip -> {dx, dy}: its own translate, which what is inside it compounds with
  // A node from the discarded row, parked where it stood. When the chip it
  // leaves lives on, it is parked INSIDE that chip, so it rides the chip's
  // slide: a name folding into "+n" while its chip moves goes with the chip
  // instead of hanging in the air where the chip used to be (the Crowd case,
  // Chromium 2026-09-23). The chip's first frame is its new box plus its
  // slide, so that is the origin. Otherwise it is parked in the card, a chip
  // as itself and anything smaller inside a bare .f-pill host — no fill, so no
  // box — because out of a chip it would lose the chip's type, colour and
  // shadow. What is animated and removed is what this returns.
  const park = (node, r, chip = null) => {
    let el = node;
    let host = card, ox = cardRect.left, oy = cardRect.top;
    if (chip) {
      const b = at(chip), m = moveOf.get(chip) || { dx: 0, dy: 0 };
      host = chip; ox = b.left + m.dx; oy = b.top + m.dy;
    } else if (!node.classList.contains('f-pill')) {
      el = document.createElement('span');
      el.className = 'f-pill f-ghost';
      el.appendChild(node);
    }
    el.classList.add('f-parked');
    el.setAttribute('aria-hidden', 'true'); // leaving: the chip's label already says who is there
    el.style.left = `${r.left - ox}px`;
    el.style.top = `${r.top - oy}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
    host.appendChild(el);
    return el;
  };
  // The chip a node leaves, if it lives on as the same chip (the carried chip
  // counts: it is the one you were alone in).
  const liveChip = (level) => {
    const was = before.chips.get(level);
    for (const [chip, old] of pairs) if (old === was) return chip;
    return null;
  };
  // A name (or "+n") in flight may cross its chip's clipped names box. A name
  // arriving from ANOTHER chip also lifts the chip it lands in above its
  // neighbours until it lands: a sliding chip is its own layer, so a
  // neighbour painted later would cover the name. Only arrivals raise: were
  // every chip with a name sliding inside it raised, the later one in the row
  // would win again (it did — Both, 2026-09-23).
  const lift = (el, raise = false) => {
    const host = el.parentElement;
    const chip = raise ? el.closest('.f-pill') : null;
    el.classList.add('f-travel');
    if (host) host.style.overflow = 'visible';
    if (chip) chip.classList.add('f-carrying');
    return () => {
      el.classList.remove('f-travel');
      if (host) host.style.overflow = '';
      if (chip) chip.classList.remove('f-carrying');
    };
  };

  // ---- chips: which old chip each new chip IS ----------------------------------------------
  const pairs = new Map(); // new chip -> old snapshot entry
  for (const [lv, chip] of after) if (before.chips.has(lv)) pairs.set(chip, before.chips.get(lv));
  // Alone → alone: the chip you were alone in and the chip you are alone in
  // are one object, carried (no dissolve, no regrow).
  let carried = null;
  if (fromL && toL && fromL !== toL && !before.chips.has(toL) && !after.has(fromL)) {
    const old = before.chips.get(fromL);
    const nu = after.get(toL);
    if (old.people.length === 1 && people(nu).length === 1) { pairs.set(nu, old); carried = nu; }
  }
  const matched = new Set(pairs.values());

  const bloop = (fill, k) => run(fill, [
    { transform: `scale(${k}, .92)` }, { transform: 'scale(1.03, 1.05)', offset: 0.6 }, { transform: 'none' },
  ], { duration: R, easing: EASE_SURFACE });
  const remix = (fill, oldBg) => {
    const layer = document.createElement('span');
    layer.className = 'f-fill';
    layer.style.background = oldBg;
    fill.appendChild(layer); // inside the fill, so it rides the fill's scale
    run(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: R * 0.8, easing: EASE_SURFACE, fill: 'forwards' }, () => layer.remove());
  };

  for (const [chip, old] of pairs) {
    const r = at(chip);
    const a = mid(old.rect), b = mid(r);
    const move = { dx: a.x - b.x, dy: a.y - b.y };
    moveOf.set(chip, move);
    if (Math.abs(move.dx) > 0.5 || Math.abs(move.dy) > 0.5) {
      run(chip, [{ transform: `translate(${move.dx}px, ${move.dy}px)` }, { transform: 'none' }], { duration: R, easing: EASE_ARRIVE });
    }
    const fill = chip.querySelector(':scope > .f-fill');
    if (!fill) continue;
    const k = old.fillWidth / (at(fill).width || old.fillWidth || 1);
    const joinedOrLeft = !sameSet(old.people, people(chip));
    if (joinedOrLeft || chip === carried) bloop(fill, k);
    else if (Math.abs(k - 1) > 0.01) run(fill, [{ transform: `scaleX(${k})` }, { transform: 'none' }], { duration: R, easing: EASE_ARRIVE });
    if (old.bg && old.bg !== fill.style.background) remix(fill, old.bg);
    // The level glyph is the chip's own fact: it slides from where it stood,
    // less the chip's own slide, so it rides the fill's edge as the chip
    // widens or narrows instead of starting outside it (Merge, Both, Clear —
    // Chromium 2026-09-23).
    const nowGlyph = chip.querySelector(':scope > .bars, :scope > .must');
    let g = { dx: 0, dy: 0 };
    if (nowGlyph && old.glyphRect) {
      const a0 = mid(old.glyphRect), b0 = mid(at(nowGlyph));
      g = { dx: a0.x - b0.x - move.dx, dy: a0.y - b0.y - move.dy };
    }
    const glyphMoves = Math.abs(g.dx) > 0.5 || Math.abs(g.dy) > 0.5;
    // The carried chip's level changed: the next bar rises from its foot, or
    // the bars step out and MUST arrives as the word.
    if (chip === carried && nowGlyph && nowGlyph.classList.contains('must') && old.glyph && old.glyph.classList.contains('bars')) {
      const parked = park(old.glyph, old.glyphRect, chip);
      run(parked, [{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' }, () => parked.remove());
      run(nowGlyph, [{ opacity: 0, transform: `translate(${g.dx}px, ${g.dy + 4}px)` }, { opacity: 1, transform: 'none' }], { duration: GROW_MS, delay: 60, easing: EASE_ARRIVE, fill: 'both' });
    } else {
      if (glyphMoves) run(nowGlyph, [{ transform: `translate(${g.dx}px, ${g.dy}px)` }, { transform: 'none' }], { duration: R, easing: EASE_ARRIVE });
      if (chip === carried && nowGlyph && nowGlyph.classList.contains('bars') && Number(toL) > Number(fromL)) {
        const bar = nowGlyph.children[Number(toL) - 1];
        if (bar) run(bar, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: R, delay: 40, easing: EASE_ARRIVE, fill: 'both' });
      }
    }
  }

  // ---- chips born: split (pinched off where your name stood) or first pick -------------------
  const bornInPlace = new Set();
  for (const [lv, chip] of after) {
    if (pairs.has(chip)) continue;
    const r = at(chip);
    const fill = chip.querySelector(':scope > .f-fill');
    if (lv === toL && before.you) {
      const a = mid(before.you.rect), b = mid(r);
      const move = { dx: a.x - b.x, dy: a.y - b.y };
      moveOf.set(chip, move);
      run(chip, [{ transform: `translate(${move.dx}px, ${move.dy}px)` }, { transform: 'none' }], { duration: R, easing: EASE_ARRIVE });
      if (fill) bloop(fill, Math.min(1, (before.you.rect.width + 16) / (at(fill).width || 1)));
      const glyph = chip.querySelector(':scope > .bars, :scope > .must');
      if (glyph) run(glyph, [{ opacity: 0 }, { opacity: 1 }], { duration: CASCADE_MS, delay: 90, easing: EASE_ARRIVE, fill: 'both' });
    } else {
      bornInPlace.add(chip);
      run(chip, [{ transform: 'scale(.55)', opacity: 0 }, { opacity: 1, offset: 0.45 }, { transform: 'none', opacity: 1 }],
        { duration: R + 60, delay: 50, easing: EASE_ARRIVE, fill: 'both' });
    }
  }

  // ---- chips that ended: flowed into the chip you joined, or gone where they stood ------------
  const newNames = new Set(liveNames.map((n) => n.dataset.person));
  const parkedWith = new Set(); // names that leave inside a parked chip
  for (const [lv, old] of before.chips) {
    if (matched.has(old)) continue;
    const target = toL && lv === fromL ? after.get(toL) : null;
    if (target && pairs.has(target)) {
      // Merge: the old body flows toward the chip it joined, emptied of the
      // names that live on there (they travel as themselves).
      for (const nm of [...old.node.querySelectorAll('.f-nm, .f-sep')]) nm.remove();
      const ghost = park(old.node, old.rect);
      const a = mid(old.rect), b = mid(at(target));
      run(ghost, [{ transform: 'none', opacity: 1 }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scaleX(.4)`, opacity: 0 }],
        { duration: R * 0.8, easing: EASE_SURFACE, fill: 'forwards' }, () => ghost.remove());
    } else {
      // Gone where it stood (a clear): quick and plain, names and all — for
      // any name in it that is shown nowhere else, this IS its one rendering.
      for (const nm of old.node.querySelectorAll('.f-nm[data-person]')) {
        if (newNames.has(nm.dataset.person)) nm.remove(); else parkedWith.add(nm.dataset.person);
      }
      const ghost = park(old.node, old.rect);
      run(ghost, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.6)', opacity: 0 }],
        { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' }, () => ghost.remove());
    }
  }

  // ---- names ---------------------------------------------------------------------------------
  if (row) {
    for (const nm of liveNames) {
      const chip = nm.closest('.f-pill');
      if (bornInPlace.has(chip)) continue; // it rides its chip's arrival
      const old = before.names.get(nm.dataset.person);
      if (!old) {
        run(nm, [{ transform: 'scale(.3)', opacity: 0 }, { opacity: 1, offset: 0.45 }, { transform: 'none', opacity: 1 }],
          { duration: R, delay: 50, easing: EASE_ARRIVE, fill: 'both' });
        continue;
      }
      const a = mid(old.rect), b = mid(at(nm));
      const m = moveOf.get(chip) || { dx: 0, dy: 0 };
      const dx = a.x - b.x - m.dx, dy = a.y - b.y - m.dy;
      if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) continue;
      const down = lift(nm, old.level !== chip.dataset.level);
      run(nm, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: R, easing: EASE_ARRIVE }, down);
      // Crossing from one chip into another that was already there: a bud of
      // its own colour travels under it (a fill, not a fact).
      const crossed = old.level !== chip.dataset.level && pairs.has(chip) && chip !== carried;
      if (crossed && nm.dataset.color) {
        const bud = document.createElement('span');
        bud.className = 'f-bud';
        bud.style.background = nm.dataset.color;
        nm.appendChild(bud);
        run(bud, [{ opacity: 0 }, { opacity: 0.85, offset: 0.2 }, { opacity: 0.85, offset: 0.65 }, { opacity: 0 }],
          { duration: R, easing: EASE_SURFACE, fill: 'forwards' }, () => bud.remove());
      }
    }
  }
  // A name no longer shown (and not leaving inside a parked chip): its old
  // node, parked where it stood, steps away.
  for (const [person, old] of before.names) {
    if (newNames.has(person) || parkedWith.has(person)) continue;
    const ghost = park(old.node, old.rect, liveChip(old.level));
    run(ghost, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.7)', opacity: 0 }],
      { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' }, () => ghost.remove());
  }

  // ---- "+n": slides by level; its count changes in place; one no longer needed steps away -----
  const moreNow = new Set(liveMore.map((m) => m.dataset.level));
  for (const [lv, old] of before.more) {
    if (moreNow.has(lv) || !after.has(lv)) continue; // a chip that ended took its "+n" with it
    const ghost = park(old.node, old.rect, liveChip(lv));
    run(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' }, () => ghost.remove());
  }
  if (row) {
    for (const more of liveMore) {
      const chip = more.closest('.f-pill');
      if (bornInPlace.has(chip)) continue;
      const old = before.more.get(more.dataset.level);
      if (!old) { run(more, [{ opacity: 0 }, { opacity: 1 }], { duration: CASCADE_MS, delay: 60, easing: EASE_ARRIVE, fill: 'both' }); continue; }
      const a = mid(old.rect), b = mid(at(more));
      const m = moveOf.get(chip) || { dx: 0, dy: 0 };
      const dx = a.x - b.x - m.dx, dy = a.y - b.y - m.dy;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const down = lift(more);
        run(more, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: R, easing: EASE_ARRIVE }, down);
      }
    }
  }
  return anims;
}
