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

// One builder, two homes: the name on the wash, then the grown lines (sub,
// who-row, chips) in one block so the zoom can fade them as a group. The
// zoomed card sits OVER the resting card, whose wash is translucent, so it
// paints the page colour under its aura (`opaque`); the sheet header keeps
// the sheet showing through.
function factsCard(facts, { className, onClose = null, onOpenNotes = null, opaque = false }) {
  const card = document.createElement('div');
  card.className = className + (facts.animated ? ' animated' : '');
  card.style.background = opaque ? `${facts.background}, var(--page)` : facts.background;
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
  const grown = document.createElement('div');
  grown.className = 'f-grown';
  if (facts.sub) {
    const sub = document.createElement('div');
    sub.className = 'f-sub';
    sub.textContent = facts.sub;
    grown.appendChild(sub);
  }
  if (facts.people.length) grown.appendChild(whoPills(facts));
  grown.appendChild(factChips(facts, { onOpenNotes }));
  card.appendChild(grown);
  return card;
}

// The sheet header: the grown card once more, larger, breathing only when the
// card would (.animated — reduced-motion and low-power still win globally).
export function sheetCard(facts, { onClose, onOpenNotes = null } = {}) {
  return factsCard(facts, { className: 'sheet-card', onClose, onOpenNotes });
}

// ---- the zoom: an overlay, never a reflow (2026-08-30) ---------------------------
// The grown card is drawn in its own fixed layer, centred on the resting
// card's centre and clamped to what a person can see; the resting card goes
// transparent underneath (never visibility:hidden — it keeps focus and its
// accessible name). The wall's layout is untouched, so siblings never move
// and nothing reflows: three compositor-friendly animations carry the morph
// (a clip reveal of the grown card, the name's glide, one fade for the grown
// lines). A tap or click on the grown card PICKS, exactly like the resting
// one, and the pills update in place; the notes chip inside is the door to
// the sheet. The previous version (2026-08-29) grew the card in flow —
// Kevin: "the whole row animates and resizes… like it's just punching out…
// too heavy" — and its grown block swallowed every click after the first.

// The intent numbers (research round, 2026-08-29): open slower than you
// close, never symmetric (NN/g 300–500 ms in; Radix/Zag agree), and gestures
// key off the EVENT's pointer type, never a media query — (hover:none) lies
// on a touchscreen laptop that is using a real mouse.
export const ZOOM_IN_MS = 350;
export const ZOOM_OUT_MS = 300;
export const MORPH_MS = 320;
const MORPH_OUT_MS = 220;
const EASE = 'cubic-bezier(.45, 0, .2, 1)';
const RADIUS = 8; // --r-card
const MIN_W = 216, MAX_W = 360, MIN_H = 132;

let zoomed = null;      // { el, artist, ctx, occ, source, onOpenNotes, slot, card, anims, cleanup }
let dismissedEl = null; // a zoom put away on purpose waits for the pointer to leave the card
let layer = null;
const exits = new WeakMap(); // resting card -> its overlay still shrinking away

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Low Power promises "no animation" and CSS cannot reach Element.animate() —
// the gate lives here (survey, 2026-08-30).
const canAnimate = (node, ctx) => typeof node.animate === 'function' && !reduced() && !(ctx && ctx.lowPower);
const rect = (n) => n.getBoundingClientRect();
const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

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

// Centre the overlay on the resting card, then clamp: the viewport, and in
// the timetable the visible part of `.times-scroll` (content hidden off to
// the side is not somewhere a card can grow into). One read of each rect.
function place(slot, el) {
  const r0 = rect(el);
  const box = rect(slot);
  const vw = window.innerWidth, vh = window.innerHeight;
  let minX = 8, maxX = vw - 8;
  const scroller = el.closest('.times-scroll');
  if (scroller) {
    const s = rect(scroller);
    minX = Math.max(minX, s.left + 4);
    maxX = Math.min(maxX, s.right - 4);
  }
  let left = Math.round(r0.left + r0.width / 2 - box.width / 2);
  let top = Math.round(r0.top + r0.height / 2 - box.height / 2);
  left = Math.max(minX, Math.min(left, maxX - box.width));
  top = Math.max(8, Math.min(top, vh - 8 - box.height));
  if (!Number.isFinite(left)) left = r0.left;
  if (!Number.isFinite(top)) top = r0.top;
  slot.style.left = `${left}px`;
  slot.style.top = `${top}px`;
  return { r0, r1: { left, top, width: box.width, height: box.height, right: left + box.width, bottom: top + box.height } };
}

function buildCard(z, facts) {
  const card = factsCard(facts, { className: 'zoom-card', onOpenNotes: z.onOpenNotes, opaque: true });
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${facts.name} details`);
  return card;
}

// The overlay never grows smaller than the card it grows out of.
function sizeSlot(slot, r0) {
  slot.style.minWidth = `${Math.max(MIN_W, Math.ceil(r0.width))}px`;
  slot.style.maxWidth = `${Math.max(MAX_W, Math.ceil(r0.width))}px`;
  slot.style.minHeight = `${Math.max(MIN_H, Math.ceil(r0.height))}px`;
}

export function zoomCard(el, artistName, ctx, { onOpenNotes = null, source = 'mouse', occ = null, instant = false } = {}) {
  if (zoomed && zoomed.el === el) return null;
  unzoom({ instant: true });
  // This card's own overlay may still be shrinking away (a quick re-entry) —
  // it ends now, or two overlays would stack.
  const exiting = exits.get(el);
  if (exiting) { exiting.remove(); exits.delete(el); }

  const facts = factsFor(artistName, ctx, occ);
  const slot = document.createElement('div');
  slot.className = 'zoom-slot';
  const z = { el, artist: artistName, ctx, occ, source, onOpenNotes, slot, card: null, anims: [], cleanup: [], unwireSource: () => {} };
  z.card = buildCard(z, facts);
  slot.appendChild(z.card);

  // READS first (resting card, its name), then the writes.
  const r0 = rect(el);
  const restName = el.querySelector('.name');
  const nameFrom = restName ? rect(restName) : null;
  sizeSlot(slot, r0);
  zoomLayer().appendChild(slot);
  const { r1 } = place(slot, el);
  el.classList.add('zoom-source');
  zoomed = z;
  wireSlot(z);

  if (instant || !canAnimate(z.card, ctx)) { slot.classList.add('shown'); return facts; }

  const nameEl = z.card.querySelector('.f-name');
  const nameTo = nameEl ? rect(nameEl) : null;
  const anims = [];
  anims.push(z.card.animate(
    [{ clipPath: insetFor(r0, r1) }, { clipPath: `inset(0px round ${RADIUS}px)` }],
    { duration: MORPH_MS, easing: EASE },
  ));
  if (nameEl && nameFrom && nameTo && nameFrom.height && nameTo.height) {
    const a = mid(nameFrom), b = mid(nameTo);
    anims.push(nameEl.animate(
      [{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${nameFrom.height / nameTo.height})` }, { transform: 'none' }],
      { duration: MORPH_MS, easing: EASE },
    ));
  }
  const grown = z.card.querySelector('.f-grown');
  if (grown) anims.push(grown.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: MORPH_MS, easing: EASE }));
  slot.classList.add('shown'); // the shadow eases in through CSS
  z.anims = anims;
  return facts;
}

// A pick while zoomed keeps the zoom: the person is resting on the card,
// cycling to MUST while watching the pills. The fresh resting node takes the
// overlay's place underneath and the overlay's lines are rebuilt in place —
// no intent delay, no morph replay.
export function refreshZoom(fresh, ctx) {
  if (!zoomed || !fresh) return;
  const z = zoomed;
  z.el.classList.remove('zoom-source');
  z.unwireSource();
  z.el = fresh;
  z.ctx = ctx;
  z.unwireSource = wireSource(z, fresh);
  fresh.classList.add('zoom-source');
  const facts = factsFor(z.artist, ctx, z.occ);
  const next = buildCard(z, facts);
  z.card.className = next.className;
  z.card.style.background = next.style.background;
  z.card.replaceChildren(...next.childNodes);
  sizeSlot(z.slot, rect(fresh));
  place(z.slot, fresh); // more pills may have widened it — stay centred
}

export function unzoom({ instant = false } = {}) {
  if (!zoomed) return;
  const z = zoomed;
  zoomed = null;
  for (const a of z.anims) { try { a.cancel(); } catch { /* finished */ } }
  for (const off of z.cleanup) off();
  z.el.classList.remove('zoom-source');
  if (instant || !z.el.isConnected || !canAnimate(z.card, z.ctx)) { z.slot.remove(); return; }
  // The way out: the overlay clips back to the resting rect while the name
  // glides home and the grown lines fade; the resting card is already back
  // underneath, so the shrink reveals it. Shorter than the way in.
  const r0 = rect(z.el), r1 = rect(z.slot);
  const nameEl = z.card.querySelector('.f-name');
  const restName = z.el.querySelector('.name');
  z.card.style.pointerEvents = 'none';
  z.slot.classList.remove('shown');
  const out = z.card.animate(
    [{ clipPath: `inset(0px round ${RADIUS}px)` }, { clipPath: insetFor(r0, r1) }],
    { duration: MORPH_OUT_MS, easing: EASE, fill: 'forwards' },
  );
  if (nameEl && restName) {
    const from = rect(restName), to = rect(nameEl);
    if (from.height && to.height) {
      const a = mid(from), b = mid(to);
      nameEl.animate(
        [{ transform: 'none' }, { transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${from.height / to.height})` }],
        { duration: MORPH_OUT_MS, easing: EASE, fill: 'forwards' },
      );
    }
  }
  const grown = z.card.querySelector('.f-grown');
  if (grown) grown.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MORPH_OUT_MS * 0.5, easing: 'ease-out', fill: 'forwards' });
  exits.set(z.el, z.slot);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    z.slot.remove();
    if (exits.get(z.el) === z.slot) exits.delete(z.el);
  };
  out.onfinish = finish;
  out.oncancel = finish;
  // An animation that never finishes (a backgrounded tab) must not leave a ghost.
  setTimeout(finish, MORPH_OUT_MS + 80);
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
    const arm = () => { card.style.pointerEvents = ''; };
    document.addEventListener('pointerup', arm, { once: true, capture: true });
    document.addEventListener('pointercancel', arm, { once: true, capture: true });
    z.cleanup.push(() => {
      document.removeEventListener('pointerup', arm, true);
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
    if (dismissedEl === el) return; // Escape put it away; re-focusing must not bring it back
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
