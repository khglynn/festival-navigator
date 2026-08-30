// The card's facts — one component, three homes (2026-08-29 round):
//   · the ZOOMED card on the wall (hover with intent delay on a pointer,
//     hold on touch) — the card grows around its centre and every resting
//     piece becomes its long form; nothing new appears,
//   · the notes sheet's HEADER — the same card, larger, still centred,
//   · the compact sub lines the day/fest sheets carry.
// Pure data + DOM builders. aura.js owns the gradient math; this file never
// invents a colour. The runtime-only import cycle with wall.js (for
// colorIndexOf) is the same safe shape notes.js already uses.
import * as state from '../state.js';
import * as model from './model.js';
import { ordered, auraBackground } from './aura.js';
import { hslOf } from './palette.js';
import { colorIndexOf } from './wall.js';

// "9:00 PM - 10:15 PM" -> "9:00 – 10:15 PM" (the shared meridiem said once).
export function timeRange(t) {
  if (!t) return '';
  const [s, e] = t.split(' - ');
  if (!e) return t;
  const ps = s.trim().split(' '), pe = e.trim().split(' ');
  return ps[1] === pe[1] ? `${ps[0]} – ${e.trim()}` : `${s.trim()} – ${e.trim()}`;
}

const shortDay = (fest, day) => (fest.dayMeta && fest.dayMeta[day] && fest.dayMeta[day].wd) || day;

// Everything the grown card says, computed once from ctx (never the DOM).
// `occ` is the occurrence the CARD represents ({day, stage, time}) — an
// artist can play twice (a grid set AND an afters event, two grid days at
// EF), and the first match is the wrong story for every card but the first
// (Codex gate, 2026-08-29). Without one, the first scheduled/listed
// occurrence stands in.
export function factsFor(artistName, ctx, occ = null) {
  const fest = state.fest();
  let day = occ ? occ.day || null : null;
  let stage = occ ? occ.stage || null : null;
  let time = occ ? occ.time || null : null;
  if (!occ) {
    for (const d of Object.keys(fest.days || {})) {
      const hit = (fest.days[d].artists || []).find((a) => a.name === artistName);
      if (hit) { day = d; stage = hit.stage || null; time = hit.time || null; break; }
    }
    if (!time) {
      const a = (fest.artists || []).find((x) => x.name === artistName);
      if (a) { day = a.day || day; stage = a.stage || stage; time = a.time || time; }
    }
  }
  const picksMap = ctx.picks[artistName] || {};
  const peopleObj = state.people();
  const people = ordered(Object.entries(picksMap)
    .filter(([n, lvl]) => lvl >= 1 && state.isActivePerson(peopleObj[n]))
    .map(([n, lvl]) => ({ name: n, level: lvl, colorIndex: colorIndexOf(n, peopleObj[n]), isYou: n === ctx.meName })));
  const { background, animated } = auraBackground(people);
  const aff = ctx.affinity ? ctx.affinity[artistName.toLowerCase()] : null;
  const spotify = aff && (aff.songs > 0 || aff.followed) ? { songs: aff.songs || 0, followed: !!aff.followed } : null;
  // An EVENT's stage carries "Thu · Venue" — say when, then where, once.
  let sub;
  if (stage && stage.includes(' · ')) {
    const bits = stage.split(' · ');
    sub = [bits[0], timeRange(time), bits.slice(1).join(' · ')].filter(Boolean).join(' · ');
  } else {
    sub = [timeRange(time), day ? shortDay(fest, day) : null, stage].filter(Boolean).join(' · ');
  }
  return {
    name: artistName, day, stage, time, sub,
    people, background, animated,
    noteCount: model.noteCount(state.crewDoc, ctx.fid, 'artist', artistName),
    spotify,
  };
}

// The who-row: borderless washes, You capitalised like a name, MUST on the
// baseline. Same pills at both sizes — the sheet header only scales them.
export function whoPills(facts) {
  const row = document.createElement('div');
  row.className = 'f-who';
  for (const p of facts.people) {
    const w = document.createElement('span');
    w.className = 'f-pill' + (p.isYou ? ' you' : '');
    w.style.background = hslOf(p.colorIndex, 0.42);
    w.append(p.isYou ? 'You' : p.name);
    if (p.level === 4) {
      const b = document.createElement('b');
      b.textContent = 'MUST';
      w.appendChild(b);
    }
    row.appendChild(w);
  }
  return row;
}

const BOOKMARK_PATH = 'M1 1h8v11l-4-3-4 3z';
function bookmark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '7'); svg.setAttribute('height', '9'); svg.setAttribute('viewBox', '0 0 10 13');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', BOOKMARK_PATH); path.setAttribute('fill', '#fff');
  svg.appendChild(path);
  return svg;
}

// The chips line: the SAME notes door the resting card carries (grown), and
// the Spotify chip with its flag sitting left of the word "following".
export function factChips(facts, { onOpenNotes = null } = {}) {
  const row = document.createElement('div');
  row.className = 'f-chips';
  const notes = document.createElement(onOpenNotes ? 'button' : 'span');
  notes.className = 'f-chip notes';
  notes.textContent = facts.noteCount ? `${facts.noteCount} note${facts.noteCount === 1 ? '' : 's'}` : '+ note';
  if (onOpenNotes) {
    notes.setAttribute('aria-label', facts.noteCount
      ? `${facts.noteCount} note${facts.noteCount === 1 ? '' : 's'} for ${facts.name}`
      : `Add a note for ${facts.name}`);
    notes.addEventListener('click', (e) => { e.stopPropagation(); onOpenNotes(facts.name); });
  }
  row.appendChild(notes);
  if (facts.spotify) {
    const sp = document.createElement('span');
    sp.className = 'f-chip spot';
    if (facts.spotify.songs) sp.append(`${facts.spotify.songs} liked song${facts.spotify.songs === 1 ? '' : 's'}`);
    if (facts.spotify.followed) {
      if (facts.spotify.songs) sp.append(' · ');
      sp.appendChild(bookmark());
      sp.append(' following');
    }
    row.appendChild(sp);
  }
  return row;
}

// The sheet header: the grown card once more, larger, breathing only when the
// card would (.animated — reduced-motion and low-power still win globally).
export function sheetCard(facts, { onClose, onOpenNotes = null } = {}) {
  const card = document.createElement('div');
  card.className = 'sheet-card' + (facts.animated ? ' animated' : '');
  card.style.background = facts.background;
  const grain = document.createElement('span');
  grain.className = 'card-grain';
  card.appendChild(grain);
  if (onClose) {
    const close = document.createElement('button');
    close.className = 'sheet-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '✕';
    close.addEventListener('click', onClose);
    card.appendChild(close);
  }
  const name = document.createElement('div');
  name.className = 'f-name';
  name.textContent = facts.name;
  card.appendChild(name);
  if (facts.sub) {
    const sub = document.createElement('div');
    sub.className = 'f-sub';
    sub.textContent = facts.sub;
    card.appendChild(sub);
  }
  if (facts.people.length) card.appendChild(whoPills(facts));
  card.appendChild(factChips(facts, { onOpenNotes }));
  return card;
}

// ---- the zoom (one at a time) ------------------------------------------------------
// The grown state is the SAME card. On the way in the box is set to its final
// size at once and REVEALED by an animated clip (no stretching aura), while
// every piece that exists at rest travels to its grown twin as a shared
// element — translate + scale, one ease-in-out, the resting piece riding
// along and dissolving over the last third. Nothing appears from nowhere and
// nothing vanishes in place (Kevin, 2026-08-29: "things aren't sliding into
// their new positions gracefully"). Width hugs the grown content (measured);
// at the scrollport's edges the growth clamps inward like any tooltip.
let zoomed = null; // { el, artist, source, grown, prev, anims, rest }

// The intent numbers (research round, 2026-08-29): open slower than you
// close, never symmetric (NN/g 300-500ms in; Radix/Zag agree), and gestures
// key off the EVENT's pointer type, never a media query — (hover:none) lies
// on a touchscreen laptop that is using a real mouse.
export const ZOOM_IN_MS = 350;
export const ZOOM_OUT_MS = 300;
export const MORPH_MS = 320;
const EASE = 'cubic-bezier(.45, 0, .2, 1)';

export function zoomedCard() { return zoomed ? zoomed.el : null; }
export function zoomSource() { return zoomed ? zoomed.source : null; }

const canAnimate = (el) => typeof el.animate === 'function'
  && !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const rect = (el) => el.getBoundingClientRect();
const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// A shared-element hop: `to` is laid out at its final place; it starts where
// `from` was (translate + scale) and settles; `from` rides the same path and
// dissolves. Both rects were measured in the same frame.
function hop(toEl, fromRect, toRect, fromEl = null, ms = MORPH_MS) {
  if (!toRect.width || !toRect.height || !fromRect.width || !fromRect.height) return [];
  const a = mid(fromRect), b = mid(toRect);
  const sx = fromRect.width / toRect.width, sy = fromRect.height / toRect.height;
  const anims = [toEl.animate(
    [{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${sx}, ${sy})`, opacity: 0 },
     { opacity: 1, offset: 0.55 },
     { transform: 'none', opacity: 1 }],
    { duration: ms, easing: EASE, fill: 'both' },
  )];
  if (fromEl) {
    anims.push(fromEl.animate(
      [{ transform: 'none', opacity: 1 },
       { opacity: 1, offset: 0.3 },
       { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${1 / sx}, ${1 / sy})`, opacity: 0 }],
      { duration: ms, easing: EASE, fill: 'both' },
    ));
  }
  return anims;
}

// The resting pieces and their grown twins, in pairing order.
function restingPieces(el) {
  return {
    name: el.querySelector('.name'),
    time: el.querySelector('.time'),
    marks: [...el.querySelectorAll('.corner-who .mark:not(.ghost)')],
    ghosts: [...el.querySelectorAll('.corner-who .mark.ghost, .chip-weekend, .spot-glow')],
    notes: el.querySelector('.corner-about .chip-notes'),
    spot: el.querySelector('.corner-about .chip-spotify'),
  };
}
function grownPieces(grown) {
  return {
    sub: grown.querySelector('.f-sub'),
    pills: [...grown.querySelectorAll('.f-pill')],
    notes: grown.querySelector('.f-chip.notes'),
    spot: grown.querySelector('.f-chip.spot'),
  };
}

const exits = new WeakMap(); // el -> running exit animations (a re-entry cancels them)

export function unzoom() {
  if (!zoomed) return;
  const { el, prev, grown, anims, rest } = zoomed;
  zoomed = null;
  for (const a of anims || []) { try { a.cancel(); } catch { /* finished */ } }
  const finishRest = () => { for (const p of rest) p.style.opacity = ''; };
  if (!el.isConnected) { if (grown && grown.isConnected) grown.remove(); finishRest(); return; }
  const r0 = rect(el);
  const nameEl = el.querySelector('.name');
  const nameBefore = nameEl ? rect(nameEl) : null;
  el.classList.remove('zoom');
  el.style.width = prev.width;
  el.style.marginLeft = prev.marginLeft;
  el.style.minHeight = prev.minHeight;
  el.style.zIndex = prev.zIndex;
  if (!grown || !canAnimate(el)) { if (grown && grown.isConnected) grown.remove(); finishRest(); return; }
  // The way out: the box shrinks back in PIXELS measured from both states
  // (a lane-split card's resting margin is a percentage — animating '50%' to
  // '50%' snapped; Codex gate, 2026-08-29), the grown block dissolves
  // quickly, the name hops home, and the resting pieces fade in over the
  // last half. Shorter than the way in. A re-entry cancels all of it.
  const r1 = rect(el);
  const restMargin = parseFloat(getComputedStyle(el).marginLeft) || 0;
  const ms = 260;
  const out = [];
  out.push(el.animate(
    [{ width: `${r0.width}px`, minHeight: `${r0.height}px`, marginLeft: `${restMargin + (r0.left - r1.left)}px` },
     { width: `${r1.width}px`, minHeight: `${r1.height}px`, marginLeft: `${restMargin}px` }],
    { duration: ms, easing: EASE },
  ));
  const fade = grown.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms * 0.45, easing: 'ease-out', fill: 'forwards' });
  fade.onfinish = () => { if (grown.isConnected) grown.remove(); };
  out.push(fade);
  if (nameEl && nameBefore) {
    const after = rect(nameEl);
    const a = mid(nameBefore), b = mid(after);
    out.push(nameEl.animate(
      [{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${nameBefore.height / (after.height || 1)})` }, { transform: 'none' }],
      { duration: ms, easing: EASE },
    ));
  }
  for (const p of rest) {
    const a = p.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: ms, easing: EASE });
    a.onfinish = () => { p.style.opacity = ''; };
    out.push(a);
  }
  exits.set(el, { out, grown, rest });
}

export function zoomCard(el, artistName, ctx, { onOpenNotes = null, source = 'mouse', occ = null } = {}) {
  if (zoomed && zoomed.el === el) return;
  unzoom();
  // An unfinished exit on this card (keyboard re-entry mid-shrink) ends now:
  // its animations cancel, its grown block goes, its resting pieces reset.
  const exit = exits.get(el);
  if (exit) {
    for (const a of exit.out) { try { a.cancel(); } catch { /* finished */ } }
    if (exit.grown && exit.grown.isConnected) exit.grown.remove();
    for (const p of exit.rest) p.style.opacity = '';
    exits.delete(el);
  }
  // A grown block from an unfinished teardown must never stack under a new one.
  for (const g of el.querySelectorAll('.facts-grown')) g.remove();
  const facts = factsFor(artistName, ctx, occ);
  const grown = document.createElement('div');
  grown.className = 'facts-grown';
  // NOT aria-hidden: the grown block holds a real button (the notes chip).
  // Interactive content inside aria-hidden is unreachable-but-visible — the
  // exact trap. AT users also keep the resting corner chip either way.
  if (facts.sub) {
    const sub = document.createElement('div');
    sub.className = 'f-sub';
    sub.textContent = facts.sub;
    grown.appendChild(sub);
  }
  const spring = document.createElement('div');
  spring.className = 'f-spring';
  grown.appendChild(spring);
  if (facts.people.length) grown.appendChild(whoPills(facts));
  grown.appendChild(factChips(facts, { onOpenNotes }));

  // Measure the grown content off-screen so the card hugs it.
  const probe = document.createElement('div');
  probe.className = 'facts-grown zoom-probe';
  probe.style.cssText = 'position: absolute; visibility: hidden; left: -9999px; top: 0; width: max-content;';
  probe.append(...[...grown.children].map((c) => c.cloneNode(true)));
  document.body.appendChild(probe);
  const nameW = Math.ceil(facts.name.length * 8.4) + 40;
  const target = Math.min(360, Math.max(216, Math.ceil(probe.getBoundingClientRect().width) + 26, nameW));
  probe.remove();

  const r0 = rect(el);
  const grid = el.closest('.times-grid, .wall-grid');
  let gridRect = grid ? rect(grid) : r0;
  // The timetable grid scrolls inside .times-scroll: clamp to what a person
  // can SEE, not to content hidden off-screen (Codex gate, 2026-08-29).
  const scroller = el.closest('.times-scroll');
  if (scroller) {
    const sr = rect(scroller);
    gridRect = { left: Math.max(gridRect.left, sr.left), right: Math.min(gridRect.right, sr.right) };
  }
  const growth = Math.max(0, target - r0.width);
  let shift = -growth / 2;
  shift = Math.max(shift, gridRect.left - r0.left - 4);            // never past the left edge
  shift = Math.min(shift, (gridRect.right - r0.right) - growth + 4); // nor the right
  if (!Number.isFinite(shift)) shift = 0;

  // FIRST: where every resting piece is.
  const R = restingPieces(el);
  const before = {
    name: R.name ? rect(R.name) : null,
    time: R.time ? rect(R.time) : null,
    marks: R.marks.map(rect),
    notes: R.notes ? rect(R.notes) : null,
    spot: R.spot ? rect(R.spot) : null,
  };
  const rest = [R.time, ...R.marks, ...R.ghosts, R.notes, R.spot].filter(Boolean);

  // LAST: the final layout, applied at once.
  zoomed = { el, artist: artistName, source, grown, anims: [], rest,
    prev: { width: el.style.width, marginLeft: el.style.marginLeft, minHeight: el.style.minHeight, zIndex: el.style.zIndex } };
  el.appendChild(grown);
  el.classList.add('zoom');
  el.style.width = `${target}px`;
  // A card already half-clipped at the scrollport's left edge needs a
  // POSITIVE shift to come back in — never discard it (Codex gate, 2026-08-29).
  el.style.marginLeft = `${Math.round(shift)}px`;
  el.style.minHeight = '132px';
  el.style.zIndex = '30';

  if (!canAnimate(el)) { for (const p of rest) p.style.opacity = '0'; return facts; }

  // INVERT + PLAY: the box is revealed by a clip from the resting rect; every
  // piece hops to its twin. One duration, one ease.
  const r1 = rect(el);
  const G = grownPieces(grown);
  const anims = [];
  anims.push(el.animate(
    [{ clipPath: `inset(0px ${Math.max(0, r1.right - r0.right)}px ${Math.max(0, r1.bottom - r0.bottom)}px ${Math.max(0, r0.left - r1.left)}px round 8px)` },
     { clipPath: 'inset(0px 0px 0px 0px round 8px)' }],
    { duration: MORPH_MS, easing: EASE },
  ));
  if (R.name && before.name) {
    const after = rect(R.name);
    const a = mid(before.name), b = mid(after);
    anims.push(R.name.animate(
      [{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${before.name.height / (after.height || 1)})` }, { transform: 'none' }],
      { duration: MORPH_MS, easing: EASE },
    ));
  }
  if (G.sub && before.time) anims.push(...hop(G.sub, before.time, rect(G.sub), R.time));
  else if (G.sub) anims.push(G.sub.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MORPH_MS, easing: EASE }));
  G.pills.forEach((pill, i) => {
    const from = before.marks[i], fromEl = R.marks[i];
    if (from) anims.push(...hop(pill, from, rect(pill), fromEl));
    else anims.push(pill.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 0, offset: .4 }, { opacity: 1, transform: 'none' }], { duration: MORPH_MS, easing: EASE }));
  });
  // Marks beyond the pills shown (never, in practice) and the ghosts dissolve.
  for (const extra of [...R.marks.slice(G.pills.length), ...R.ghosts]) {
    anims.push(extra.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MORPH_MS * 0.5, easing: EASE, fill: 'forwards' }));
  }
  if (G.notes) anims.push(...(before.notes ? hop(G.notes, before.notes, rect(G.notes), R.notes)
    : [G.notes.animate([{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1 }], { duration: MORPH_MS, easing: EASE })]));
  if (G.spot) anims.push(...(before.spot ? hop(G.spot, before.spot, rect(G.spot), R.spot)
    : [G.spot.animate([{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1 }], { duration: MORPH_MS, easing: EASE })]));
  // Once the hops land, the resting pieces stay away (their twins took over).
  const settle = () => { if (zoomed && zoomed.el === el) for (const p of rest) p.style.opacity = '0'; };
  const last = anims[anims.length - 1];
  if (last) last.onfinish = settle; else settle();
  zoomed.anims = anims;
  return facts;
}

// Hover wiring for one card (pointer-fine by EVENT, never by media query).
// Kevin's rule (2026-08-29): a real intent delay, or cards pop like crazy.
export function wireCardZoom(el, artistName, ctx, { onOpenNotes = null, occ = null } = {}) {
  let inT = null, outT = null;
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (outT) { clearTimeout(outT); outT = null; }
    if (zoomed && zoomed.el === el) return;
    if (inT) clearTimeout(inT);
    inT = setTimeout(() => {
      inT = null;
      if (el.isConnected) zoomCard(el, artistName, ctx, { onOpenNotes, source: 'mouse', occ });
    }, ZOOM_IN_MS);
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (inT) { clearTimeout(inT); inT = null; }
    if (zoomed && zoomed.el === el) {
      if (outT) clearTimeout(outT);
      // Generation-exact: this timer closes the zoom it saw leave, never a
      // newer keyboard/touch zoom on the same card (Codex gate, 2026-08-29).
      const rec = zoomed;
      outT = setTimeout(() => { outT = null; if (zoomed === rec) unzoom(); }, ZOOM_OUT_MS);
    }
  });
}

// Keyboard route (2026-08-29): focusing a card grows it too, so Tab reaches
// the notes chip inside — the door to a FIRST note needs no pointer at all.
// focusout only unzooms when focus truly left the card (the chip is inside).
export function wireCardFocusZoom(el, artistName, ctx, { onOpenNotes = null, occ = null } = {}) {
  el.addEventListener('focusin', () => {
    if (zoomed && zoomed.el === el) return;
    // KEYBOARD focus only: a mouse click and a finger tap also focus the
    // card, and zooming there would bypass the hover-intent delay and grow
    // the card under every pick. :focus-visible is the browsers' own
    // keyboard-vs-pointer call; engines without it just skip this route.
    try { if (!el.matches(':focus-visible')) return; } catch { return; }
    zoomCard(el, artistName, ctx, { onOpenNotes, source: 'keyboard', occ });
  });
  el.addEventListener('focusout', (e) => {
    if (zoomed && zoomed.el === el && !(e.relatedTarget && el.contains(e.relatedTarget))) unzoom();
  });
}
