// The deck — three or more sets sharing one venue-slot on an events
// timetable (MODEL-V3 §4, 2026-09-01). Lane-splitting past two crushed names
// to two letters (Kevin's screenshot); instead the pile stacks as ONE deck:
// the earliest card on top, two ghost edges behind, a count pill naming the
// hour. A tap grows the deck in place — the zoom's own gesture and budget —
// into a panel of full, pickable cards. Escape, a press outside, or the deck
// leaving the viewport put it away. Instant under Low Power / reduced motion.
//
// Two laws carried over from the zoom:
//   · the panel is an OVERLAY in a fixed layer, never a reflow of the grid;
//   · one rendering of every card. The face card at rest is a real card
//     rendered through an inert ctx (a tap on it opens the deck, it never
//     picks or zooms); the cards in the panel are ordinary wall cards.
// The layer lives INSIDE the wall root so app.js's per-artist refresh
// (`#wall-root .card[data-artist]`) reaches the panel's cards, and a full
// repaint takes the panel with it — repaintWall restores it from a snapshot,
// the way it restores a zoom.
import { renderCard } from './wall.js';
import { timeRange, zoomContains, zoomedCard, unzoom } from './card-facts.js';
import { GROW_MS, MATERIALIZE_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, canAnimate } from './motion.js';

let open = null;               // { deck, slot, panel, ctx, key, anims, cleanup, fromKeyboard }
const decks = new WeakMap();   // deck element -> { items, ctx, venue, startStr, key, occOf, timeOf }

const rect = (n) => n.getBoundingClientRect();
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};

// The face never picks, never zooms, never long-presses: the whole deck is
// the button. refreshCard (wall.js) re-renders a face through this too, so a
// crew-mate's pick landing on the top card cannot quietly arm it.
export function faceCtxFor(ctx) {
  return { ...ctx, onTap: () => {}, wireZoom: null, onPeek: null, onOpenNotes: null };
}
export function decorateFace(card) {
  card.tabIndex = -1;
  card.removeAttribute('role');
  card.setAttribute('aria-hidden', 'true');
  card.dataset.deckFace = '1';
  card.style.minHeight = '0';
  card.style.height = '100%';
  return card;
}

// One deck cell. `items` are the timetable's timed entries ({ e, startStr,
// endStr, … }) in the order they sit in the cluster (earliest first).
export function renderDeck(items, ctx, { key, venue, col, row, span, occOf, timeOf }) {
  const top = items[0];
  const deck = el('div', 'deck');
  deck.dataset.deck = key;
  deck.setAttribute('role', 'button');
  deck.tabIndex = 0;
  deck.setAttribute('aria-expanded', 'false');
  deck.setAttribute('aria-label', `${items.length} sets at ${venue} from ${top.startStr} — open to see them all`);
  deck.title = items.map((it) => it.e.name).join(' · ');
  deck.style.gridColumn = String(col);
  deck.style.gridRow = `${row} / span ${span}`;
  deck.style.minHeight = '0';
  const tall = span >= 12;
  const face = decorateFace(renderCard(top.e.name, faceCtxFor(ctx), {
    cell: true, tall, until: tall ? top.endStr || null : null, time: timeOf(top), occ: occOf(top.e),
  }));
  const pill = el('span', 'deck-pill', `${items.length} · ${top.startStr}`);
  pill.setAttribute('aria-hidden', 'true');
  deck.append(el('span', 'deck-ghost g2'), el('span', 'deck-ghost g1'), face, pill);
  decks.set(deck, { items, ctx, venue, startStr: top.startStr, key, occOf, timeOf });
  // The face's own click (renderCard) is a no-op through the inert ctx and
  // bubbles here; one handler, one toggle. Keyboard opens arrive through
  // keydown below, so a click is a pointer's.
  deck.addEventListener('click', (e) => { e.stopPropagation(); toggleDeck(deck, { fromKeyboard: false }); });
  deck.addEventListener('keydown', (e) => {
    if (e.target !== deck) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDeck(deck, { fromKeyboard: true }); }
  });
  return deck;
}

export function openDeckEl() { return open ? open.deck : null; }
export function deckSnapshot() { return open ? { key: open.key, fromKeyboard: open.fromKeyboard } : null; }
export function restoreDeck(root, snap) {
  if (!snap || !root) return;
  const deck = [...root.querySelectorAll('.deck')].find((d) => d.dataset.deck === snap.key);
  if (deck) openDeck(deck, { instant: true, fromKeyboard: snap.fromKeyboard });
}

function toggleDeck(deck, opts) {
  if (open && open.deck === deck) closeDeck();
  else openDeck(deck, opts);
}

// The panel's layer hangs off the wall root the deck sits in (the wall marks
// it `data-deck-host`), created on first use. Every host gets its own layer,
// so two walls on one page (the gallery) never share one.
function layerFor(deck) {
  const host = deck.closest('[data-deck-host]') || document.body;
  let layer = [...host.children].find((c) => c.classList && c.classList.contains('deck-layer'));
  if (!layer) {
    layer = el('div', 'deck-layer');
    host.appendChild(layer);
  }
  return layer;
}

// Centre the panel on the deck; the viewport's edges push it inward on both
// axes (a panel must be readable whole, unlike the zoom which only yields
// left and right — a deck can hold a screen's worth of cards).
function place(slot, deck) {
  const r0 = rect(deck);
  const b = rect(slot);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = Math.round(r0.left + r0.width / 2 - b.width / 2);
  let top = Math.round(r0.top + r0.height / 2 - b.height / 2);
  left = Math.max(8, Math.min(left, vw - 8 - b.width));
  top = Math.max(8, Math.min(top, vh - 8 - b.height));
  slot.style.left = `${Number.isFinite(left) ? left : r0.left}px`;
  slot.style.top = `${Number.isFinite(top) ? top : r0.top}px`;
  return { r0, r1: box(left, top, b.width, b.height) };
}
function originFor(slot, r0, r1) {
  slot.style.transformOrigin = `${r0.left + r0.width / 2 - r1.left}px ${r0.top + r0.height / 2 - r1.top}px`;
}
const scaleFor = (r0, r1) => Math.min(0.95, Math.max(0.5, r1.height ? r0.height / r1.height : 0.7));

export function openDeck(deck, { instant = false, fromKeyboard = false } = {}) {
  const st = decks.get(deck);
  if (!st || !deck.isConnected) return;
  closeDeck({ instant: true });
  const { ctx } = st;
  const slot = el('div', 'deck-slot');
  const panel = el('div', 'deck-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `${st.venue} · ${st.startStr}`);
  const head = el('div', 'deck-panel-head');
  const title = el('span', 'deck-panel-title', `${st.venue} · ${st.startStr}`);
  const close = el('button', 'sheet-close deck-close', '✕');
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', (e) => { e.stopPropagation(); closeDeck(); });
  head.append(title, close);
  const grid = el('div', 'deck-panel-grid');
  for (const it of st.items) grid.appendChild(renderCard(it.e.name, ctx, { time: st.timeOf(it, { range: true }), occ: st.occOf(it.e) }));
  panel.append(head, grid);
  slot.appendChild(panel);
  layerFor(deck).appendChild(slot);
  deck.classList.add('open');
  deck.setAttribute('aria-expanded', 'true');
  const z = { deck, slot, panel, ctx, key: st.key, anims: [], cleanup: [], fromKeyboard };
  open = z;
  const r0 = rect(deck);
  const { r1 } = place(slot, deck);
  wire(z);
  slot.classList.add('shown');
  if (fromKeyboard) { const first = grid.querySelector('.card'); if (first) first.focus(); }
  if (instant || !canAnimate(slot, ctx)) return;
  // The bloom: materialise fast while growing k→1 from the deck's centre;
  // inside, the cards arrive a beat apart.
  originFor(slot, r0, r1);
  z.anims.push(slot.animate([{ transform: `scale(${scaleFor(r0, r1)})` }, { transform: 'scale(1)' }], { duration: GROW_MS, easing: EASE_ARRIVE }));
  z.anims.push(slot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MATERIALIZE_MS, easing: 'ease-out' }));
  [...grid.querySelectorAll('.card')].forEach((c, i) => z.anims.push(c.animate(
    [{ transform: 'translateY(6px)', opacity: 0 }, { opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }],
    { duration: CASCADE_MS, delay: MATERIALIZE_MS + i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'both' },
  )));
}

function wire(z) {
  const { slot, deck } = z;
  // A press outside the deck and its panel closes it. A press on a card's
  // zoom overlay (which hangs off <body>, not the panel) is inside.
  const onDown = (e) => {
    if (open !== z) return;
    const t = e.target;
    if (slot.contains(t) || deck.contains(t) || zoomContains(t)) return;
    closeDeck();
  };
  document.addEventListener('pointerdown', onDown, true);
  // Escape closes ONE layer: the zoom's own capture handler (registered
  // first, in app.js) eats the key while a zoom stands; otherwise this one
  // does, before any sheet or router handler.
  const onKey = (e) => {
    if (e.key !== 'Escape' || open !== z) return;
    closeDeck();
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey, true);
  // The panel follows its deck on scroll and resize; it closes only when the
  // deck has actually left the viewport (the zoom's law since 2026-08-31 —
  // dismissing on any scroll event read as broken on a trackpad).
  let raf = 0;
  const follow = () => {
    raf = 0;
    if (open !== z) return;
    if (!deck.isConnected) { closeDeck({ instant: true }); return; }
    if (!window.innerWidth || !window.innerHeight) return;
    const r = rect(deck);
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) { closeDeck({ instant: true }); return; }
    place(slot, deck);
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(follow); };
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('resize', onScroll);
  z.cleanup.push(() => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll);
    if (raf) cancelAnimationFrame(raf);
  });
}

export function closeDeck({ instant = false } = {}) {
  if (!open) return;
  const z = open;
  open = null;
  for (const off of z.cleanup) off();
  z.deck.classList.remove('open');
  z.deck.setAttribute('aria-expanded', 'false');
  // A zoom standing on one of the panel's cards leaves with the panel.
  const zc = zoomedCard();
  if (zc && z.slot.contains(zc)) unzoom({ instant: true, why: 'deck closed under the zoom' });
  // Focus goes home to the deck when it was inside the panel.
  const active = document.activeElement;
  if (z.deck.isConnected && ((active && z.slot.contains(active)) || z.fromKeyboard)) z.deck.focus();
  const animate = !instant && z.deck.isConnected && z.slot.isConnected && canAnimate(z.slot, z.ctx);
  if (!animate) {
    for (const a of z.anims) { try { a.cancel(); } catch { /* finished */ } }
    z.slot.remove();
    return;
  }
  // The way out: from wherever the bloom has got to, recede toward the deck
  // and dissolve. Quick and plain, no overshoot.
  let fromT = 'scale(1)';
  let fromO = 1;
  const cs = window.getComputedStyle(z.slot);
  if (cs.transform && cs.transform !== 'none') fromT = cs.transform;
  const o = Number.parseFloat(cs.opacity);
  if (Number.isFinite(o)) fromO = o;
  const r0 = rect(z.deck);
  const r1 = box(z.slot.offsetLeft, z.slot.offsetTop, z.slot.offsetWidth, z.slot.offsetHeight);
  z.panel.style.pointerEvents = 'none';
  z.slot.classList.remove('shown');
  originFor(z.slot, r0, r1);
  const k = scaleFor(r0, r1);
  const out = z.slot.animate(
    [{ transform: fromT, opacity: fromO }, { transform: `scale(${k + (1 - k) * 0.4})`, opacity: 0 }],
    { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' },
  );
  let done = false;
  const finish = () => { if (done) return; done = true; z.slot.remove(); };
  out.onfinish = finish;
  out.oncancel = finish;
  setTimeout(finish, OUT_MS * 4 + 80); // a backgrounded tab must not leave a ghost
}

// The panel's time line: the range when the entry has one, the tilde when
// the time is a guess — the same words the tile would wear.
export function panelTime(it, { range = false } = {}) {
  const base = range ? timeRange(it.e.time) : it.startStr;
  return it.e.approx === true ? `~${base}` : base;
}
