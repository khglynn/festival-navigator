// The card's facts — one component, three homes (2026-08-29 round, rebuilt
// 2026-08-30):
//   · the ZOOMED card on the wall (hover with intent on a mouse, hold on
//     touch, focus on a keyboard) — an OVERLAY that grows around the resting
//     card's centre; the wall never reflows,
//   · the notes sheet's HEADER — the same card, larger, still centred,
//   · the compact sub lines the day/fest sheets carry.
// Pure data + DOM builders. aura.js owns the gradient math; this file never
// invents a colour. The runtime-only import cycle with wall.js (for
// colorIndexOf) is the same safe shape notes.js already uses.
import * as state from '../state.js';
import * as model from './model.js';
import { ordered, auraBackground, nameColor, subColor } from './aura.js';
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

// THE card model — everything a card says, resting or grown, computed once
// from ctx (never the DOM). wall.js renderCard and the zoom/sheet header both
// render from this object, so a detail the resting card carries cannot go
// missing from the grown one (Kevin, 2026-08-30: two rounds dropped details
// because two renderers derived them separately).
// `occ` is the occurrence the CARD represents ({day, stage, time, weekend})
// — an artist can play twice (a grid set AND an afters event, two grid days
// at EF), and the first match is the wrong story for every card but the
// first (Codex gate, 2026-08-29). Without one, the first scheduled/listed
// occurrence stands in.
export function factsFor(artistName, ctx, occ = null) {
  const fest = state.fest() || {}; // a card can render before its fest file is known (tests, a stale index)
  let day = occ ? occ.day || null : null;
  let stage = occ ? occ.stage || null : null;
  let time = occ ? occ.time || null : null;
  const weekend = occ && (occ.weekend === 'W1' || occ.weekend === 'W2') ? occ.weekend : null;
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
  const spotify = aff && (aff.songs > 0 || aff.followed)
    ? { songs: aff.songs || 0, followed: !!aff.followed, hot: !!aff.followed && (aff.songs || 0) >= 5 }
    : null;
  // The long form: when · day · where · which weekend. An EVENT's stage
  // carries "Thu · Venue" — say when, then where, once.
  let when, where;
  if (stage && stage.includes(' · ')) {
    const bits = stage.split(' · ');
    when = [bits[0], timeRange(time)].filter(Boolean).join(' · ');
    where = bits.slice(1).join(' · ');
  } else {
    when = [timeRange(time), day ? shortDay(fest, day) : null].filter(Boolean).join(' · ');
    where = stage || '';
  }
  // The weekend rides WHEN as plain text — a tag at the row's end read as the
  // resting chip flipping sides (Kevin, 2026-08-30); words don't flip.
  if (weekend) when = [when, weekend].filter(Boolean).join(' · ');
  const mapUrl = (where && fest.venues && fest.venues[where]) || null;
  return {
    name: artistName, day, stage, time, weekend, when, where, mapUrl,
    people, background, animated, nameColor: nameColor(people), subColor: subColor(people),
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

// The grown lines — WHEN (with the weekend's quiet tag) · WHERE (a door to
// the map when the festival names the venue) · the who-row · the chips — in
// ONE builder, because the sheet header and the zoomed card must never
// drift apart again (the two-renderers disease, 2026-08-30).
function grownBlock(facts, { onOpenNotes = null } = {}) {
  const grown = document.createElement('div');
  grown.className = 'f-grown';
  if (facts.when) {
    const sub = document.createElement('div');
    sub.className = 'f-sub';
    sub.textContent = facts.when;
    grown.appendChild(sub);
  }
  if (facts.where) {
    const w = document.createElement(facts.mapUrl ? 'a' : 'div');
    w.className = 'f-where';
    if (facts.mapUrl) {
      w.href = facts.mapUrl;
      w.target = '_blank';
      w.rel = 'noopener';
      w.setAttribute('aria-label', `${facts.where} — open the map`);
      // A door, never a pick — same discipline as the notes chip.
      w.addEventListener('click', (e) => e.stopPropagation());
      const pin = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      pin.setAttribute('class', 'pin'); pin.setAttribute('width', '9'); pin.setAttribute('height', '12'); pin.setAttribute('viewBox', '0 0 10 14');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M5 0C2.2 0 0 2.2 0 5c0 3.7 5 9 5 9s5-5.3 5-9c0-2.8-2.2-5-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z');
      path.setAttribute('fill', 'currentColor');
      pin.appendChild(path);
      w.appendChild(pin);
    }
    w.append(facts.where);
    grown.appendChild(w);
  }
  if (facts.people.length) grown.appendChild(whoPills(facts));
  grown.appendChild(factChips(facts, { onOpenNotes }));
  return grown;
}

// One builder, two homes: the name on the wash, then the grown lines (sub,
// who-row, chips) in one block so the zoom can fade them as a group. The
// aura string already ends in the opaque card base, so the same background
// covers whatever sits under the grown card. (Appending a second colour
// layer made the shorthand invalid and every zoomed card went black —
// caught on the 2026-08-30 preview.)
function factsCard(facts, { className, onClose = null, onOpenNotes = null }) {
  const card = document.createElement('div');
  card.className = className + (facts.animated ? ' animated' : '');
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
  const grown = grownBlock(facts, { onOpenNotes });
  card.appendChild(grown);
  return card;
}

// The sheet header: the grown card once more, larger, breathing only when the
// card would (.animated — reduced-motion and low-power still win globally).
export function sheetCard(facts, { onClose, onOpenNotes = null } = {}) {
  return factsCard(facts, { className: 'sheet-card', onClose, onOpenNotes });
}

// ---- the zoom: the bloom (2026-08-30 rebuild — the storyboard lives in
// claude-plans/2026-08-30-zoom-storyboard.md) --------------------------------
// The grown card is drawn in its own fixed layer, centred on the resting
// card's centre; only the screen's left and right edges push the BOX inward,
// and even then it still GROWS from the resting centre (true
// transform-origin). The wall's layout is untouched, so siblings never move.
//
// The law with teeth: ONE rendering of every fact, ever. The overlay
// measures exactly one thing about the resting card — its box. Nothing
// inside it is measured, cloned or crossfaded. (The v53–v58 morph did all
// three — resting pieces cloned into the overlay and crossfaded against
// their grown twins — and every double-printed time, mis-registered line
// and stutter came from keeping two renderings of one fact in flight.)
// What carries the "same card growing" illusion instead: the overlay wears
// the SAME aura background and blooms from the same centre — colour and
// origin are what the eye reads, never glyph registration.
//
// The bloom: the overlay materialises fast (opacity) while it grows k→1
// (scale, a touch of overshoot); underneath, the resting card's CONTENT
// steps back through CSS while its wash stays (no hole in the wall).
// Inside, the grown lines cascade a beat apart, each from its own corner —
// WHEN and WHERE rise, the people slide in from the right where the colour
// marks live, notes and Spotify from the left where their numbers live.
// The way out is quick and plain. Transform and opacity only; one easing
// in, one easing out. A tap on the grown card PICKS from the first frame;
// its notes chip and the maps door are the only other controls.
export const ZOOM_IN_MS = 300;   // hover intent — open slower than you close
export const ZOOM_OUT_MS = 260;  // hover-out grace before the close
const GROW_MS = 240;             // the box, k→1
const MATERIALIZE_MS = 90;       // the overlay's fade-in (the CSS content fade matches)
const OUT_MS = 130;              // the way out: quick and plain
const CASCADE_MS = 170;          // each grown line's arrival
const STAGGER_MS = 30;           // the beat between arrivals
const EASE_ARRIVE = 'cubic-bezier(.2, 1.15, .35, 1)';    // in: a 4% overshoot, then settle
const EASE_LEAVE = 'cubic-bezier(.4, 0, 1, 1)';          // out: quick, no flourish
const EASE_SURFACE = 'cubic-bezier(.4, 0, .2, 1)';       // refresh crossfades: crisp, no bounce
const RADIUS = 8; // --r-card
const MIN_W = 216, MAX_W = 360, MIN_H = 132;

let zoomed = null;      // { el, artist, ctx, occ, source, onOpenNotes, slot, card, anims, cleanup, unwireSource }
let dismissedEl = null; // a zoom put away on purpose waits for the pointer to leave the card
let layer = null;
const exitingSlots = new Set(); // overlays still shrinking away — a NEW zoom clears them ALL

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Low Power promises "no animation" and CSS cannot reach Element.animate() —
// the gate lives here (survey, 2026-08-30).
const canAnimate = (node, ctx) => typeof node.animate === 'function' && !reduced() && !(ctx && ctx.lowPower);
const rect = (n) => n.getBoundingClientRect();
const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

function zoomLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.getElementById('zoom-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'zoom-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

export function zoomedCard() { return zoomed ? zoomed.el : null; }
// The zoom is two nodes — the resting card and its overlay. "Outside" means
// outside both (a tap on the overlay is a pick, never a dismiss).
export function zoomContains(node) {
  return !!(zoomed && node && (zoomed.el.contains(node) || zoomed.slot.contains(node)));
}
// What a full-wall repaint needs to bring the same zoom back on the fresh
// card — a crew-mate's pick must not eat the card you are resting on.
export function zoomSnapshot() {
  return zoomed ? { artist: zoomed.artist, occ: zoomed.occ, source: zoomed.source, onOpenNotes: zoomed.onOpenNotes } : null;
}
export function dismissZoom() {
  if (zoomed) { dismissedEl = zoomed.el; unzoom(); }
}

// The clip that shows exactly the resting card's rect out of the overlay's.
function insetFor(r0, r1) {
  const t = Math.max(0, r0.top - r1.top), l = Math.max(0, r0.left - r1.left);
  const b = Math.max(0, r1.bottom - r0.bottom), r = Math.max(0, r1.right - r0.right);
  return `inset(${t}px ${r}px ${b}px ${l}px round ${RADIUS}px)`;
}

// Centre the overlay on the resting card. Only the screen's left and right
// edges push it inward (an overlay cannot be read off-screen); top and
// bottom never move it — a card by the day rail grows where it is.
function place(slot, el) {
  const r0 = rect(el);
  const b = rect(slot);
  const vw = window.innerWidth;
  let left = Math.round(r0.left + r0.width / 2 - b.width / 2);
  const top = Math.round(r0.top + r0.height / 2 - b.height / 2);
  left = Math.max(8, Math.min(left, vw - 8 - b.width));
  slot.style.left = `${Number.isFinite(left) ? left : r0.left}px`;
  slot.style.top = `${Number.isFinite(top) ? top : r0.top}px`;
  return { r0, r1: box(left, top, b.width, b.height) };
}

// The grown card's parts: a SURFACE (the wash and the border) under an
// unclipped hit target, so the whole grown box takes a tap from the first
// frame while the card is still blooming.
function buildParts(z, facts) {
  const surface = document.createElement('div');
  surface.className = 'z-surface' + (facts.animated ? ' animated' : '');
  surface.style.background = facts.background;
  const grain = document.createElement('span');
  grain.className = 'card-grain';
  surface.appendChild(grain);
  const name = document.createElement('div');
  name.className = 'f-name';
  name.textContent = facts.name;
  const grown = grownBlock(facts, { onOpenNotes: z.onOpenNotes });
  return [surface, name, grown];
}

// The overlay never grows smaller than the card it grows out of.
function sizeSlot(slot, r0) {
  slot.style.minWidth = `${Math.max(MIN_W, Math.ceil(r0.width))}px`;
  slot.style.maxWidth = `${Math.max(MAX_W, Math.ceil(r0.width))}px`;
  slot.style.minHeight = `${Math.max(MIN_H, Math.ceil(r0.height))}px`;
}

// Where the resting card's centre sits inside the overlay's box — the
// bloom's transform-origin, so the card grows from (and recedes toward) the
// spot it lives on the wall, even when a viewport edge nudged the box.
function originFor(slot, r0, r1) {
  slot.style.transformOrigin = `${r0.left + r0.width / 2 - r1.left}px ${r0.top + r0.height / 2 - r1.top}px`;
}
// The bloom's starting scale: resting height over grown height, clamped so
// the materialise never reads as tiny text blowing up.
const scaleFor = (r0, r1) => Math.min(0.95, Math.max(0.7, r0.height / r1.height));

export function zoomCard(el, artistName, ctx, { onOpenNotes = null, source = 'mouse', occ = null, instant = false } = {}) {
  if (zoomed && zoomed.el === el) return null;
  unzoom({ instant: true });
  // EVERY overlay still shrinking away ends now — not just this card's.
  // Skimming across cards queued a ghost per leave, and clearing only the
  // re-entered card's ghost let grown surfaces overlap while a fresh one
  // grew (Kevin's GIF, 2026-08-30). New attention clears the stage.
  for (const g of exitingSlots) g.remove();
  exitingSlots.clear();

  const facts = factsFor(artistName, ctx, occ);
  const slot = document.createElement('div');
  slot.className = 'zoom-slot';
  const card = document.createElement('div');
  card.className = 'zoom-card';
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${facts.name} details`);
  slot.appendChild(card);
  const z = { el, artist: artistName, ctx, occ, source, onOpenNotes, slot, card, anims: [], cleanup: [], unwireSource: () => {} };
  card.append(...buildParts(z, facts));

  // The ONE read of the resting card: its box. Then the writes.
  const animate = !instant && canAnimate(card, ctx);
  const r0 = rect(el);
  sizeSlot(slot, r0);
  zoomLayer().appendChild(slot);
  const { r1 } = place(slot, el);
  el.classList.add('zoom-source'); // the resting CONTENT steps back; its wash stays
  zoomed = z;
  wireSlot(z);
  slot.classList.add('shown'); // the shadow eases in through CSS
  if (!animate) return facts;

  // The bloom: materialise fast while growing k→1 from the resting centre.
  // At the start the overlay is resting-card-sized in the resting card's
  // place, wearing the same wash — the crossfade is two card-shaped washes
  // of one gradient in one spot, which is all the connection the eye needs.
  originFor(slot, r0, r1);
  const anims = [
    slot.animate([{ transform: `scale(${scaleFor(r0, r1)})` }, { transform: 'scale(1)' }], { duration: GROW_MS, easing: EASE_ARRIVE }),
    slot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MATERIALIZE_MS, easing: 'ease-out' }),
  ];
  // The cascade: each grown line a beat apart, each from its own corner —
  // WHEN and WHERE rise, the people from the RIGHT where the colour marks
  // live, notes and Spotify from the LEFT where their numbers sit. All
  // relative to the CARD; wall coordinates are never consulted. The name
  // has no animation of its own — it IS the card and rides the scale.
  const arrive = (piece, x, y, delay) => anims.push(piece.animate(
    [{ transform: `translate(${x}px, ${y}px)`, opacity: 0 }, { opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }],
    { duration: CASCADE_MS, delay, easing: EASE_ARRIVE, fill: 'both' },
  ));
  // WHEN waits out the content fade: the resting time line and the grown
  // one are the same fact, and the law says never two renderings at once —
  // the resting text is gone (MATERIALIZE_MS) before its grown self begins
  // (Codex gate, 2026-08-30). WHERE and the rest follow in family order.
  const sub = card.querySelector('.f-sub');
  const where = card.querySelector('.f-where');
  if (sub) arrive(sub, 0, 6, MATERIALIZE_MS + 5);
  if (where) arrive(where, 0, 6, MATERIALIZE_MS + 35);
  [...card.querySelectorAll('.f-pill')].forEach((p, i) => arrive(p, 14, 0, MATERIALIZE_MS + 55 + i * (STAGGER_MS - 2)));
  [...card.querySelectorAll('.f-chip')].forEach((c, i) => arrive(c, -14, 0, MATERIALIZE_MS + 55 + i * STAGGER_MS));
  z.anims = anims;
  return facts;
}

// A pick while zoomed keeps the zoom: the person is resting on the card,
// cycling to MUST while watching the pills. The fresh resting node takes the
// overlay's place underneath and the overlay's parts are rebuilt — and the
// rebuild is itself a small event (Kevin, 2026-08-30: "it should again
// animate in and slide things around"): the new wash fades in under the old,
// the box re-centres, every piece that stayed slides to its new spot, a pill
// that arrived grows in with a little overshoot, a MUST badge fades on.
// Transform and opacity only, inside the overlay.
const REFRESH_MS = 300;
function partKey(el) {
  if (el.classList.contains('f-name')) return 'name';
  if (el.classList.contains('f-sub')) return 'sub';
  if (el.classList.contains('f-where')) return 'where';
  if (el.classList.contains('f-pill')) return `pill:${el.firstChild ? el.firstChild.textContent : ''}`;
  if (el.classList.contains('notes')) return 'notes';
  if (el.classList.contains('spot')) return 'spot';
  return null;
}
function snapshotParts(card) {
  const out = new Map();
  for (const el of card.querySelectorAll('.f-name, .f-sub, .f-where, .f-pill, .f-chip.notes, .f-chip.spot')) {
    const k = partKey(el);
    if (k) out.set(k, { rect: rect(el), must: !!el.querySelector('b') });
  }
  return out;
}

export function refreshZoom(fresh, ctx) {
  if (!zoomed || !fresh) return;
  const z = zoomed;
  for (const a of z.anims) { try { a.cancel(); } catch { /* finished */ } }
  z.anims = [];
  z.el.classList.remove('zoom-source');
  z.unwireSource();
  z.el = fresh;
  z.ctx = ctx;
  z.unwireSource = wireSource(z, fresh);
  fresh.classList.add('zoom-source');
  const facts = factsFor(z.artist, ctx, z.occ);
  z.card.setAttribute('aria-label', `${facts.name} details`);

  const animate = canAnimate(z.card, ctx);
  // READS: where everything was.
  const before = animate ? snapshotParts(z.card) : null;
  const slotBefore = animate ? rect(z.slot) : null;
  const oldSurface = z.card.querySelector('.z-surface');
  // WRITES: the new parts, the box re-centred.
  z.card.replaceChildren(...buildParts(z, facts));
  sizeSlot(z.slot, rect(fresh));
  place(z.slot, fresh);
  if (!animate) return;

  // READS again (one layout): where everything is now.
  const slotAfter = rect(z.slot);
  const surface = z.card.querySelector('.z-surface');
  const anims = [];
  // The old wash lingers over the new one and thins away; the box's growth
  // is revealed by the new surface unclipping from the old box.
  if (oldSurface) {
    oldSurface.classList.add('z-surface-old');
    oldSurface.style.left = `${slotBefore.left - slotAfter.left}px`;
    oldSurface.style.top = `${slotBefore.top - slotAfter.top}px`;
    oldSurface.style.width = `${slotBefore.width}px`;
    oldSurface.style.height = `${slotBefore.height}px`;
    z.card.appendChild(oldSurface);
    const fade = oldSurface.animate(
      [{ opacity: 1, clipPath: 'inset(0px round 8px)' },
       { opacity: 0, clipPath: insetFor(slotAfter, slotBefore) }],
      { duration: REFRESH_MS * 0.5, easing: EASE_SURFACE, fill: 'forwards' },
    );
    fade.onfinish = () => oldSurface.remove();
    fade.oncancel = () => oldSurface.remove();
    anims.push(fade);
  }
  const moved = Math.abs(slotBefore.width - slotAfter.width) > 1 || Math.abs(slotBefore.height - slotAfter.height) > 1
    || Math.abs(slotBefore.left - slotAfter.left) > 1 || Math.abs(slotBefore.top - slotAfter.top) > 1;
  if (moved) {
    anims.push(surface.animate(
      [{ clipPath: insetFor(slotBefore, slotAfter) }, { clipPath: `inset(0px round ${RADIUS}px)` }],
      { duration: REFRESH_MS, easing: EASE_SURFACE },
    ));
  }
  // Every piece: the ones that stayed slide from where they were; the ones
  // that arrived grow in a beat later; a badge that appeared fades on.
  let arrivals = 0;
  for (const el of z.card.querySelectorAll('.f-name, .f-sub, .f-where, .f-pill, .f-chip.notes, .f-chip.spot')) {
    const k = partKey(el);
    const was = k ? before.get(k) : null;
    const now = rect(el);
    if (was && now.width && now.height) {
      const a = mid(was.rect), b = mid(now);
      if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5) {
        anims.push(el.animate([{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: 'none' }], { duration: REFRESH_MS, easing: EASE_ARRIVE }));
      }
      const badge = el.querySelector('b');
      if (badge && !was.must) anims.push(badge.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(1px)' }], { duration: REFRESH_MS, delay: 60, easing: EASE_ARRIVE, fill: 'both' }));
    } else if (!was) {
      anims.push(el.animate(
        [{ transform: 'scale(.55)', opacity: 0 }, { opacity: 1, offset: 0.45 }, { transform: 'none', opacity: 1 }],
        { duration: REFRESH_MS + 60, delay: 50 + arrivals * STAGGER_MS * 0.6, easing: EASE_ARRIVE, fill: 'both' },
      ));
      arrivals += 1;
    }
  }
  z.anims = anims;
}

export function unzoom({ instant = false } = {}) {
  if (!zoomed) return;
  const z = zoomed;
  zoomed = null;
  const animate = !instant && z.el.isConnected && canAnimate(z.card, z.ctx);
  // A dismissal mid-bloom leaves from wherever the bloom has got to — read
  // the live values BEFORE anything else, or a fast skim pops the card to
  // full size for one frame on its way out.
  let fromT = 'scale(1)', fromO = 1;
  if (animate) {
    const cs = window.getComputedStyle(z.slot);
    if (cs.transform && cs.transform !== 'none') fromT = cs.transform;
    // Number.isFinite, not `|| 1`: a dismissal on the bloom's very first
    // frame reads opacity 0, and `|| 1` would flash the overlay fully
    // opaque on its way out (Codex gate, 2026-08-30).
    const o = Number.parseFloat(cs.opacity);
    if (Number.isFinite(o)) fromO = o;
  }
  for (const off of z.cleanup) off();
  z.el.classList.remove('zoom-source');
  if (!animate) {
    for (const a of z.anims) { try { a.cancel(); } catch { /* finished */ } }
    z.slot.remove();
    return;
  }
  // The way out is quick and plain: the card recedes toward its resting
  // centre and dissolves while the resting content returns through the same
  // CSS fade underneath. No overshoot. The in-flight anims are left running
  // on purpose: the slot-level out below overrides the slot's own (newest
  // animation wins), an interior cascade simply keeps playing as the card
  // recedes, and everything dies with the slot's removal — cancelling here
  // instead snapped half-arrived lines to full opacity for a frame.
  // offset* not rect(): with the in-flight scale still running, rects are
  // the TRANSFORMED box, and the recede's origin would drift mid-skim.
  const r0 = rect(z.el);
  const r1 = box(z.slot.offsetLeft, z.slot.offsetTop, z.slot.offsetWidth, z.slot.offsetHeight);
  z.card.style.pointerEvents = 'none';
  z.slot.classList.remove('shown');
  originFor(z.slot, r0, r1);
  const kOut = scaleFor(r0, r1);
  const out = z.slot.animate(
    // Partway home, not all the way — receding, already gone before it lands.
    [{ transform: fromT, opacity: fromO }, { transform: `scale(${kOut + (1 - kOut) * 0.4})`, opacity: 0 }],
    { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' },
  );
  exitingSlots.add(z.slot);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    z.slot.remove();
    exitingSlots.delete(z.slot);
  };
  out.onfinish = finish;
  out.oncancel = finish;
  // An animation that never finishes (a backgrounded tab) must not leave a
  // ghost. Generous on purpose: the gallery watches exits at ×4 slow motion,
  // and a tight belt amputated the way out there; a stuck ghost living
  // ~600ms instead of ~200ms costs nothing (pointer-blind, and a new zoom
  // sweeps it instantly).
  setTimeout(finish, OUT_MS * 4 + 80);
}

// Everything the overlay listens for while it stands. `cleanup` undoes it.
// Always `z.el`, never a captured node: a pick swaps the resting card for a
// fresh one under the same overlay (refreshZoom), and a listener holding the
// old node would see it as gone.
function wireSlot(z) {
  const { slot, card } = z;

  // A hold's release must never pick: while the finger that grew the card is
  // still down, the overlay hears nothing; the NEXT tap is the first it takes
  // (Codex review, 2026-08-30). The resting card's own capture-phase swallow
  // (wall.js) handles the click the release synthesises.
  if (z.source === 'touch') {
    card.style.pointerEvents = 'none';
    let armT = null;
    const arm = () => { if (armT) { clearTimeout(armT); armT = null; } card.style.pointerEvents = ''; };
    // Arm AFTER the lift's synthetic click has come and gone — arming on
    // pointerup was one event too early: the click that follows the lift
    // landed on the freshly-armed overlay and recorded a pick nobody made
    // (real-phone walk, 2026-08-30). The timer is the belt for a lift that
    // synthesises no click (the finger slid); pointercancel for a cancelled
    // gesture.
    const afterLift = () => {
      document.addEventListener('click', arm, { once: true, capture: true });
      armT = setTimeout(arm, 350);
    };
    document.addEventListener('pointerup', afterLift, { once: true, capture: true });
    document.addEventListener('pointercancel', arm, { once: true, capture: true });
    z.cleanup.push(() => {
      if (armT) clearTimeout(armT);
      document.removeEventListener('pointerup', afterLift, true);
      document.removeEventListener('click', arm, true);
      document.removeEventListener('pointercancel', arm, true);
    });
  }

  // A tap or click on the grown card is a pick — the same thing it means on
  // the resting card. Its one button (the notes chip) is its own control.
  card.addEventListener('click', (e) => {
    if (zoomed !== z) return;
    if (e.target !== card && e.target.closest('button')) return;
    if (!z.el.isConnected) { unzoom({ instant: true }); return; }
    z.ctx.onTap(z.artist, z.el);
  });

  // Hover bookkeeping: the pointer lands on the overlay the instant it
  // appears (the card underneath gets a pointerleave for it — ignored in
  // wireCardZoom). Leaving the OVERLAY closes after the grace period; coming
  // back cancels it. Keyboard and touch zooms do not close on hover-out.
  let outT = null;
  card.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse' && outT) { clearTimeout(outT); outT = null; }
  });
  card.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || zoomed !== z || z.source !== 'mouse') return;
    if (e.relatedTarget && z.el.contains(e.relatedTarget)) return;
    if (outT) clearTimeout(outT);
    outT = setTimeout(() => { outT = null; if (zoomed === z) unzoom(); }, ZOOM_OUT_MS);
  });
  z.cleanup.push(() => { if (outT) { clearTimeout(outT); outT = null; } });

  // Scrolling anywhere (the page, the timetable) moves the card out from
  // under its overlay — put it away, like every tooltip. Capture phase so an
  // inner scroller's scroll (which does not bubble) is heard too.
  const onScroll = () => { if (zoomed === z) dismissZoom(); };
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('resize', onScroll);
  z.cleanup.push(() => {
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll);
  });

  // Keyboard: Tab from the zoomed card reaches the notes chip inside the
  // overlay (the door to a FIRST note needs no pointer); Tab again continues
  // after the card, Shift+Tab returns to it. Delegated on the overlay, so a
  // refreshZoom that rebuilds the chip keeps working; re-wired on the fresh
  // resting card by refreshZoom.
  z.unwireSource = wireSource(z, z.el);
  z.cleanup.push(() => z.unwireSource());
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || zoomed !== z || !e.target.matches('button.f-chip.notes')) return;
    e.preventDefault();
    if (e.shiftKey) { z.el.focus(); return; }
    const next = nextFocusableAfter(z.el);
    unzoom();
    if (next) next.focus();
  });
  card.addEventListener('focusout', (e) => {
    if (zoomed !== z) return;
    const to = e.relatedTarget;
    if (to && (to === z.el || z.el.contains(to) || slot.contains(to))) return;
    unzoom();
  });
}

function wireSource(z, el) {
  const onCardKey = (e) => {
    if (e.key !== 'Tab' || e.shiftKey || zoomed !== z || e.target !== el) return;
    const chip = z.card.querySelector('button.f-chip.notes');
    if (!chip) return;
    e.preventDefault();
    chip.focus();
  };
  el.addEventListener('keydown', onCardKey);
  return () => el.removeEventListener('keydown', onCardKey);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function nextFocusableAfter(el) {
  const all = [...document.querySelectorAll(FOCUSABLE)].filter((n) => !n.closest('#zoom-layer') && n.offsetParent !== null);
  const i = all.indexOf(el);
  return i >= 0 ? all[i + 1] || null : null;
}

// Hover wiring for one card (pointer-fine by EVENT, never by media query).
// Kevin's rule (2026-08-29): a real intent delay, or cards pop like crazy.
export function wireCardZoom(el, artistName, ctx, { onOpenNotes = null, occ = null } = {}) {
  let inT = null;
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (zoomed && zoomed.el === el) return;
    if (dismissedEl === el) return; // put away on purpose; a leave clears it
    if (inT) clearTimeout(inT);
    inT = setTimeout(() => {
      inT = null;
      if (el.isConnected) zoomCard(el, artistName, ctx, { onOpenNotes, source: 'mouse', occ });
    }, ZOOM_IN_MS);
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (inT) { clearTimeout(inT); inT = null; }
    // The overlay appearing over the card IS a leave to the browser — not to
    // the person. The overlay's own leave handles the close.
    if (zoomed && zoomed.el === el && e.relatedTarget && zoomed.slot.contains(e.relatedTarget)) return;
    if (dismissedEl === el) dismissedEl = null;
  });
}

// Keyboard route (2026-08-29): focusing a card grows it too, so Tab reaches
// the notes chip inside — the door to a FIRST note needs no pointer at all.
// focusout only unzooms when focus truly left the card and its overlay.
export function wireCardFocusZoom(el, artistName, ctx, { onOpenNotes = null, occ = null } = {}) {
  el.addEventListener('focusin', () => {
    if (zoomed && zoomed.el === el) return;
    // dismissedEl is a POINTER rule (a mouse resting on a card it dismissed);
    // deliberately not checked here — Tab is fresh intent, and gating it made
    // keyboard growth look off-by-one-card (real-browser walk, 2026-08-30).
    if (dismissedEl === el) dismissedEl = null;
    // KEYBOARD focus only: a mouse click and a finger tap also focus the
    // card, and zooming there would bypass the hover-intent delay and grow
    // the card under every pick. :focus-visible is the browsers' own
    // keyboard-vs-pointer call; engines without it just skip this route.
    try { if (!el.matches(':focus-visible')) return; } catch { return; }
    zoomCard(el, artistName, ctx, { onOpenNotes, source: 'keyboard', occ });
  });
  el.addEventListener('focusout', (e) => {
    if (dismissedEl === el) dismissedEl = null;
    if (!zoomed || zoomed.el !== el) return;
    const to = e.relatedTarget;
    if (to && (el.contains(to) || zoomed.slot.contains(to))) return;
    unzoom();
  });
}
