// The wall — v3's main screen (atlas 21c/21d, lineup mode). Renders day
// sections of aura cards from the live crew doc, owns the tap cycle, the
// toasts, search/sort, and the mobile dock's scrollspy.
//
// SECURITY RULE (Codex P2 gate, finding 6): every artist name, person name,
// and note text in this file goes through textContent / createElement — no
// innerHTML interpolation of doc-derived strings, ever.
import * as state from '../state.js';
import * as model from './model.js';
import { LEVEL_LABELS_V4 } from '../parse.js';
import { computeLanes } from '../overlap.js';
import { dayLabelParts } from '../time.js';
import { aboutCorner, fitCorners, GIVE_WAY, CLEAR } from './aura.js';
import { BOARD } from './palette.js';
import { dayWhisper, festWhisper, dayTargetLabel } from './notes.js'; // runtime-only cycle with this module (colorIndexOf) — safe
import { factsFor, timeRange } from './card-facts.js'; // same runtime-only cycle: the card's ONE model
import { passesPeople, COL, FEST_ROOM } from './filters.js';
import { nowOnDay, nowOffsetPx, clockLabel, festivalClock } from './now.js';
import { eventModelOf, venueGroupsOf, dateRuleLabel, occOf, hourLabelOf, approxMark, parseEventTime, weekdayOfIso, shortDate } from './events.js';
import { reduced, canAnimate, GROW_MS, OUT_MS, STAGGER_MS, EASE_ARRIVE, EASE_SURFACE } from './motion.js';
import { isCancelled } from './events.js'; // a cancelled act (2026-09-23) — its own line, so the list above can grow without a merge

// ---- person -> board color ---------------------------------------------------
// v4 people carry colorIndex. Legacy people carry a "R, G, B" string from the
// old 12-color palette; map its palette position onto the board (both are
// hue-spread, positions correspond) — deterministic on every device, no
// writes needed. Unknown strings hash the name (stable, collision-tolerable).
export function colorIndexOf(name, personObj) {
  if (Number.isInteger(personObj?.colorIndex)) return personObj.colorIndex;
  const legacyIdx = state.COLOR_PALETTE.indexOf(personObj?.color);
  if (legacyIdx >= 0) return legacyIdx % BOARD.length;
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % BOARD.length;
}

const BOOKMARK_PATH = 'M1 1h8v11l-4-3-4 3z';

function svgBookmark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '7'); svg.setAttribute('height', '9'); svg.setAttribute('viewBox', '0 0 10 13');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', BOOKMARK_PATH); path.setAttribute('fill', '#fff');
  svg.appendChild(path);
  return svg;
}

export function renderCard(artistName, ctx, opts = {}) {
  // opts.occ = { day, stage, time }: the occurrence THIS card is (an artist
  // can appear twice — a grid set and an afters event, or two EF days). The
  // zoom, the peek, and the sheet all tell this card's story, never the
  // first match's (Codex gate, 2026-08-29).
  // ONE model for the resting card, the zoom and the sheet header
  // (card-facts.js factsFor) — a detail cannot exist in one and not another.
  const facts = factsFor(artistName, ctx, opts.occ || null);
  const people = facts.people;
  const el = document.createElement('div');
  el.className = 'card' + (opts.cell ? ' cell' : '') + (opts.time && !opts.cell ? ' timed' : '');
  // A cancelled act (2026-09-23) is a card like any other — it picks, zooms
  // and carries the crew's marks — worn quieter and struck through (v3.css
  // .card.cancelled). The caller says "Cancelled" where the time goes.
  if (facts.cancelled) el.classList.add('cancelled');
  // The people filter dims a card nobody selected has picked. Computed here,
  // from ctx, so refreshCard (a single-card repaint after a tap) reproduces
  // it without being told — a dimmed card you tap stays dimmed until the
  // filtered person picks it, which is exactly what the filter means.
  if (ctx.filterPeople && ctx.filterPeople.length && !passesPeople(ctx.picks, artistName, ctx.filterPeople)) el.classList.add('dim');
  el.dataset.artist = artistName;
  // Keyboard-first card (AX-1): real button semantics, and the accessible
  // name carries what SIGHTED users see — your level, the crew's picks, note
  // count, Spotify badge (audit 4.3). The explicit label overrides children,
  // so anything not folded in here is invisible to AT.
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  const myLevel = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  const crewCount = people.filter((p) => !p.isYou).length;
  const labelParts = [`${artistName}${facts.cancelled ? ' (cancelled)' : ''} — ${myLevel === 4 ? 'must' : (LEVEL_LABELS_V4[myLevel] || 'not picked').toLowerCase()}`];
  if (crewCount) labelParts.push(`picked by ${crewCount} other${crewCount === 1 ? '' : 's'}`);
  if (facts.noteCount) labelParts.push(`${facts.noteCount} note${facts.noteCount === 1 ? '' : 's'}`);
  if (facts.spotify) labelParts.push('in your Spotify');
  el.setAttribute('aria-label', labelParts.join(', '));
  el.title = artistName; // lane-split cells truncate hard — hover recovers (audit 9.2)
  el.addEventListener('keydown', (e) => {
    // Only the CARD's own focus picks: Enter on the notes button nested in the
    // grown block bubbles here too, and the browser then activates the button
    // — a pick and an open from one keypress (Codex gate, 2026-08-29).
    if (e.target !== el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.onTap(artistName, el); }
  });
  // Stash render opts on the node so refreshCard can reproduce this exact
  // render — a single-card refresh must preserve every invariant the full
  // render established (CORE-1/CORE-3).
  if (opts.time) el.dataset.time = opts.time;
  if (opts.occ) el.dataset.occ = JSON.stringify(opts.occ);
  if (opts.tag) {
    el.dataset.tag = opts.tag;
    const tag = document.createElement('span');
    tag.className = 'chip-weekend';
    tag.textContent = opts.tag;
    el.appendChild(tag);
  }
  el.style.background = facts.background;
  if (facts.animated && !ctx.lowPower) {
    el.classList.add('animated');
    const grain = document.createElement('span');
    grain.className = 'card-grain';
    el.appendChild(grain);
  }
  const nm = document.createElement('span');
  nm.className = 'name';
  nm.style.color = facts.nameColor;
  nm.textContent = artistName;
  el.appendChild(nm);
  if (opts.time) {
    const t = document.createElement('span');
    t.className = 'time';
    t.style.color = facts.subColor;
    t.textContent = opts.time;
    el.appendChild(t);
  }
  if (opts.tall) {
    el.classList.add('tall');
    el.dataset.tall = '1'; // refreshCard replays this exact render (a pick must not un-tall Despacio)
    if (opts.until) el.dataset.until = opts.until;
    if (opts.until) {
      const u = document.createElement('span');
      u.className = 'until';
      u.style.color = facts.subColor;
      u.textContent = `until ${opts.until}`;
      el.appendChild(u);
    }
  }

  // The two bottom corners: YOUR meter, the notes door and Spotify on the
  // left; everyone else on the right (drawCorners). The card keeps their
  // model so it can fit them to its width once it has one (fitCard).
  const you = people.find((p) => p.isYou) || null;
  el._corners = { people, about: aboutCorner({ noteCount: facts.noteCount, spotify: facts.spotify, you }) };
  drawCorners(el, el._corners, {
    artistName,
    openNotes: ctx.onOpenNotes ? () => ctx.onOpenNotes(artistName, opts.occ || null) : null,
  });

  // Long-press (touch) ZOOMS the card (~500ms, 10px slop — the OS constants;
  // 2026-08-29 round): the grown card carries the notes chip, so the sheet
  // stays one tap away.
  // Digitizer jitter fires pointermove even on a still finger, so cancel only
  // past a real movement threshold (10px) — a genuine scroll-drag cancels,
  // a held finger does not (Codex P3 trail, finding 1).
  if (ctx.onPeek) {
    let pressTimer = null;
    let longPressed = false;
    let startX = 0, startY = 0;
    el.addEventListener('pointerdown', (e) => {
      // A finger (or a pen) holds; a mouse hovers. A held mouse button used
      // to arm this too and open a touch-style zoom — one that ignores
      // hover-out and swallows its next click (found 2026-09-02).
      if (e.pointerType === 'mouse') return;
      longPressed = false;
      startX = e.clientX; startY = e.clientY;
      // If a poll repaint detached this node mid-press, the new node owns the
      // gesture — a fire from the orphan would zoom a card that is gone.
      pressTimer = setTimeout(() => {
        // isConnected covers repaint detachment; offsetParent covers a screen
        // change hiding the wall mid-press (audit 10.2) — a zoom must never
        // pop over Settings or the landing after the fact.
        if (!el.isConnected || el.offsetParent === null) return;
        longPressed = true;
        ctx.onPeek(artistName, el, opts.occ || null);
      }, 500);
    });
    const cancel = () => clearTimeout(pressTimer);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
    });
    el.addEventListener('click', (e) => { if (longPressed) { e.stopImmediatePropagation(); longPressed = false; } }, true);
  }

  el.addEventListener('click', (e) => {
    // Belt over the chips' own stopPropagation (the research's Ant Design
    // lesson): a real button inside the card (the notes chip) is its own
    // control, never a pick. Everything else on the face — the name, the
    // time, the marks, the Spotify badge — is the card, and a tap on the card
    // means pick. (The 2026-08-29 version excluded a whole grown block here,
    // which is how a zoomed card stopped taking picks.)
    if (e.target !== el && e.target.closest && e.target.closest('button')) return;
    ctx.onTap(artistName, el);
  });
  if (ctx.wireZoom) ctx.wireZoom(el, artistName, opts.occ || null);
  watchFit(el);
  return el;
}

// YOUR meter (aura.js meterOf): three bars lit one per tap, and at must the
// word. ONE builder — the card's corner and How it works both draw it, so the
// lesson can never show a chip the wall does not. aria-hidden: the card's
// own label already says your level (renderCard), and a screen reader should
// hear it once.
export function meterChip(chip) {
  const c = document.createElement('span');
  c.className = 'chip-meter' + (chip.level === 4 ? ' is-must' : '');
  c.dataset.kind = 'meter';
  c.dataset.level = String(chip.level);
  c.style.background = chip.fill;
  c.style.borderColor = chip.stroke;
  c.setAttribute('aria-hidden', 'true');
  if (chip.level === 4) {
    const w = document.createElement('span');
    w.className = 'must';
    w.textContent = chip.label;
    c.appendChild(w);
  } else {
    const bars = document.createElement('span');
    bars.className = 'bars';
    for (let i = 1; i <= 3; i++) {
      const b = document.createElement('span');
      b.className = 'bar' + (i <= chip.bars ? ' on' : '');
      bars.appendChild(b);
    }
    c.appendChild(bars);
  }
  return c;
}

// A crew mark (aura.js whoCorner): a lettered must, a tick, or the "+n".
// Exported for How it works, which draws the real thing.
export function crewMark(m) {
  const s = document.createElement('span');
  s.className = 'mark' + (m.kind === 'ghost' ? ' ghost' : '');
  if (m.kind !== 'ghost') {
    s.style.width = m.width + 'px';
    s.style.background = m.fill;
    s.style.border = '1px solid ' + m.stroke;
    s.style.fontSize = m.kind === 'must' ? '7.5px' : '0px';
  }
  s.textContent = m.label;
  return s;
}

// The corners, drawn whole (a card that has not been laid out yet has no
// width to fit to), then fitted: applyFit hides what gives way and redraws
// the crew corner with its "+n" counting whoever it folded.
function drawCorners(el, parts, { artistName, openNotes }) {
  const about = document.createElement('span');
  about.className = 'corner-about';
  for (const chip of parts.about) {
    let c;
    if (chip.kind === 'meter') {
      c = meterChip(chip);
    } else if (chip.kind === 'notes') {
      // The clickable note-count chip is a real button (audit 4.4).
      c = document.createElement(openNotes ? 'button' : 'span');
      c.className = 'chip-notes';
      c.textContent = chip.label;
      if (openNotes) {
        c.style.cursor = 'pointer';
        c.setAttribute('aria-label', `${chip.label} note${chip.label === '1' ? '' : 's'} for ${artistName}`);
        c.addEventListener('click', (e) => { e.stopPropagation(); openNotes(); });
      }
    } else {
      // The Spotify chip stays a passive span. Its count sits in its own
      // span because the count is the first thing to give way (GIVE_WAY).
      c = document.createElement('span');
      c.className = 'chip-spotify';
      if (chip.label) {
        const n = document.createElement('span');
        n.className = 'n';
        n.textContent = chip.label;
        c.appendChild(n);
      }
      if (chip.followed) c.appendChild(svgBookmark());
      // Corner glow for high-affinity artists (followed + 5+ songs): a soft
      // Spotify-green mini-aura behind the badge corner — same visual language
      // as the people-auras, card geometry untouched (Kevin picked this over
      // rings/outlines 2026-07-13; thicker outlines broke pixel rhythm before).
      if (chip.hot) {
        const glow = document.createElement('span');
        glow.className = 'spot-glow';
        glow.setAttribute('aria-hidden', 'true');
        el.appendChild(glow);
      }
    }
    c.dataset.kind = chip.kind;
    about.appendChild(c);
  }
  el.appendChild(about);
  const who = document.createElement('span');
  who.className = 'corner-who';
  el.appendChild(who);
  applyFit(el, fitCorners(parts, 0));
}

function applyFit(el, fit) {
  el.dataset.fit = String(fit.step);
  el._fit = fit; // what the read-back needs to know: whether the band's time is still shown
  for (const c of el.querySelector(':scope > .corner-about').children) {
    const kind = c.dataset.kind;
    c.hidden = (kind === 'spotify' && !fit.spot) || (kind === 'notes' && !fit.notes) || (kind === 'meter' && !fit.meter);
    if (kind === 'spotify') {
      const n = c.querySelector('.n');
      if (n) n.hidden = !fit.spotCount;
    }
  }
  const glow = el.querySelector(':scope > .spot-glow');
  if (glow) glow.hidden = !fit.spot; // the glow rises from the pill; no pill, no glow
  // The last thing a cell gives way: the text in the band. Its space is kept
  // (visibility, not display), so the name never moves when it steps back.
  for (const t of el.querySelectorAll(':scope > .time, :scope > .until')) t.style.visibility = fit.time ? '' : 'hidden';
  el.querySelector(':scope > .corner-who').replaceChildren(...fit.marks.map(crewMark));
}

// Fit one card's corners to `width`, the px of its padding box, around the
// centred text in their band (`band`, from bandText). aura.js fitCorners
// holds the order things give way in; `from`, the step the read-back says
// the corners need at least (confirmFit). A no-op when nothing moves.
export function fitCard(el, width, band = null, from = 0) {
  const parts = el._corners;
  if (!parts) return;
  const fit = fitCorners(parts, width, { cell: el.classList.contains('cell'), ...(band || {}), from });
  if (el.dataset.fit !== String(fit.step)) applyFit(el, fit);
}

// What the corners REALLY drew, read back after a fit is written: each
// corner's own box as laid out (hidden chips gone, the crew corner's "+n"
// as it is now) against the card's edges and the centred text in its band.
// aura.js's width table is Chromium-on-macOS; Linux draws Inter wider and so
// will real phones, and a table that guesses short left Robyn's corners
// 1.4px apart in CI (2026-09-23). The law is the table's own: CLEAR between
// the two corners, and between each corner and the band's text — with half
// a pixel for sub-pixel layout. A card with no layout (a hidden screen,
// jsdom) is taken at the table's word: there is nothing to read.
const LAST_STEP = GIVE_WAY.length - 1;
function cornersClear(el, band) {
  const card = el.getBoundingClientRect();
  if (!card.width) return true;
  const drawn = (sel) => {
    const n = el.querySelector(sel);
    const r = n ? n.getBoundingClientRect() : null;
    return r && r.width ? r : null;
  };
  const about = drawn(':scope > .corner-about');
  const who = drawn(':scope > .corner-who');
  const air = CLEAR - 0.5;
  if (about && about.right > card.right - 1) return false;
  if (who && who.left < card.left + 1) return false;
  if (about && who && who.left - about.right < air) return false;
  if (band) {
    // The band's text as it stands after the fit: a time the fit stepped
    // back takes no room; the name always does.
    const spans = [band.nm, (!el._fit || el._fit.time) ? band.mid : null].filter(Boolean);
    if (spans.length) {
      const left = Math.min(...spans.map((x) => x[0]));
      const right = Math.max(...spans.map((x) => x[1]));
      if (about && about.right + air > left) return false;
      if (who && who.left - air < right) return false;
    }
  }
  return true;
}

// The table's guess, then the read-back: every card's corners are read (all
// reads first — one layout for the batch), each one that crowds gives way one
// more step (all writes), and only those are read again, until every card is
// clear or at its last step. A handful of passes at most, and no observer
// loop: the corners are absolute, so no step ever resizes a card.
function fitAll(todo) {
  for (const [el, width, band] of todo) fitCard(el, width, band);
  let pending = todo;
  for (let pass = 0; pending.length && pass < GIVE_WAY.length; pass += 1) {
    const crowded = pending.filter(([el, , band]) => el.isConnected && Number(el.dataset.fit) < LAST_STEP && !cornersClear(el, band));
    for (const [el, width, band] of crowded) fitCard(el, width, band, Number(el.dataset.fit) + 1);
    pending = crowded;
  }
}

// The centred text a timetable cell carries down in its corners' band,
// measured line by line (the text, not its box — "until" spans the card):
// `middle`, a 30-minute set's start time (its 44px cell has no room above the
// band: wall.js's display floor) or a tall set's "until" on the bottom edge;
// `name`, the artist's name where it runs to a second line in a narrow short
// cell. Every other card keeps its text well above the band: null.
const CELL_BAND = 16; // .card.cell corners: 3px up, 13px tall
function bandText(card) {
  if (!card.classList.contains('cell')) return null;
  const box = card.getBoundingClientRect();
  if (!box.height) return null;
  const top = box.bottom - CELL_BAND;
  // The lines of `el` that sit down in the band: their widest width (the
  // table's input) and where they reach, left and right (the read-back's).
  const lines = (el) => {
    const out = { w: 0, x: null };
    const range = document.createRange();
    range.selectNodeContents(el);
    if (typeof range.getClientRects !== 'function') return out;
    const own = el.getBoundingClientRect(); // a clamped name's hidden lines are not text anyone sees
    for (const r of range.getClientRects()) {
      if (!(r.width && r.bottom > top && r.top < Math.min(box.bottom, own.bottom) - 1)) continue;
      out.w = Math.max(out.w, r.width);
      out.x = out.x ? [Math.min(out.x[0], r.left), Math.max(out.x[1], r.right)] : [r.left, r.right];
    }
    return out;
  };
  let middle = 0, name = 0, mid = null, nmX = null;
  for (const t of card.querySelectorAll(':scope > .time, :scope > .until')) {
    const l = lines(t);
    middle = Math.max(middle, l.w);
    if (l.x) mid = mid ? [Math.min(mid[0], l.x[0]), Math.max(mid[1], l.x[1])] : l.x;
  }
  const nm = card.querySelector(':scope > .name');
  if (nm) { const l = lines(nm); name = l.w; nmX = l.x; }
  return middle || name ? { middle, name, mid, nm: nmX } : null;
}

// A card learns its width only once it is laid out — and again on a rotation
// or a lane split — so the fit rides a ResizeObserver, whose callback runs
// after layout and before paint: no frame ever shows the two corners
// colliding. The corners are absolute, so a fit never resizes the card (no
// observer loop). Width is the border box less the card's 1px edge each side.
// Observed cards are held strongly, so each full render sweeps the ones it
// replaced (renderWall), and a refresh lets go of the node it swaps out.
const fitting = new Set();
const fitWatch = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
  // Every read first, then every write: layout is clean when the callback
  // starts, and a write between two reads would force it again per card.
  const todo = [];
  for (const { target, borderBoxSize } of entries) {
    if (!target.isConnected) { unwatchFit(target); continue; }
    const box = borderBoxSize && borderBoxSize[0];
    todo.push([target, (box ? box.inlineSize : target.getBoundingClientRect().width) - 2, bandText(target)]);
  }
  fitAll(todo);
}) : null;
// A late font changes every width without resizing a single card, so no
// observer fires: refit every watched card when the fonts land — once when
// the set is ready, and again whenever a font finishes loading after that.
function refitAll() {
  const todo = [];
  for (const el of fitting) {
    if (!el.isConnected) continue;
    const width = el.getBoundingClientRect().width;
    if (width > 0) todo.push([el, width - 2, bandText(el)]);
  }
  fitAll(todo);
}
try {
  if (fitWatch && typeof document !== 'undefined' && document.fonts) {
    if (document.fonts.ready && typeof document.fonts.ready.then === 'function') document.fonts.ready.then(refitAll, () => {});
    if (typeof document.fonts.addEventListener === 'function') document.fonts.addEventListener('loadingdone', refitAll);
  }
} catch { /* a font set that cannot be asked is a font set the observer already covers */ }
function watchFit(el) {
  if (!fitWatch) return;
  fitWatch.observe(el, { box: 'border-box' });
  fitting.add(el);
}
function unwatchFit(el) {
  if (!fitWatch) return;
  fitWatch.unobserve(el);
  fitting.delete(el);
}
function sweepFit() {
  for (const el of fitting) if (!el.isConnected) unwatchFit(el);
}

// Re-render one card in place after a pick change (no full-wall repaint).
// The fresh card must land exactly where the old one was: same render opts
// (cell variant, time line) AND the placement the full render computed —
// grid position and lane split live as inline styles on the node (CORE-1).
const PLACEMENT_PROPS = ['grid-column', 'grid-row', 'width', 'margin-left', 'min-height'];
export function refreshCard(el, artistName, ctx, { onSwap = null } = {}) {
  const fresh = renderCard(artistName, ctx, {
    cell: el.classList.contains('cell'),
    time: el.dataset.time || undefined,
    tag: el.dataset.tag || undefined,
    tall: el.dataset.tall === '1',
    until: el.dataset.until || null,
    occ: el.dataset.occ ? JSON.parse(el.dataset.occ) : undefined,
  });
  for (const prop of PLACEMENT_PROPS) {
    const v = el.style.getPropertyValue(prop);
    if (v) fresh.style.setProperty(prop, v);
  }
  // The now window rides the NODE (venueGroups stamps it from the model), so a
  // refresh that dropped it would put the ring out on whoever is playing the
  // moment you picked them, until the next full repaint.
  if (el.dataset.nowFrom) {
    fresh.dataset.nowFrom = el.dataset.nowFrom;
    fresh.dataset.nowTo = el.dataset.nowTo;
  }
  // The fresh node is fitted to the width the old one had before it lands,
  // so it never draws a frame unfitted, and the old corners are read for the
  // level change's motion — both are reads of the old node, taken together
  // before anything is written.
  const width = el.getBoundingClientRect().width;
  const band = bandText(el);
  const before = canAnimate(el, ctx) ? cornersNow(el) : null;
  if (width > 0) fitCard(fresh, width - 2, band);
  // Keyboard users keep their place: replacing a focused node silently dumps
  // focus to <body>, forcing a full re-Tab per pick tap (audit 4.1).
  const hadFocus = document.activeElement === el;
  // The fresh node lands FIRST and any standing zoom is handed to it BEFORE
  // the old node goes. Chrome fires the old node's blur from inside the
  // removal steps (node still attached, relatedTarget null), and while the
  // zoom still pointed at the old node its focusout guard read that blur as
  // "focus left the card" and closed the zoom — then the hover intent re-grew
  // it a beat later. Every pick made on a focused card blinked, on
  // production too (Kevin's journal, 2026-09-01: "focus left the card" ×2
  // within a second of each overlay press). Once the zoom already owns the
  // fresh node, the old node's blur is a stale node's blur and is ignored.
  el.before(fresh);
  if (onSwap) onSwap(fresh);
  el.remove();
  unwatchFit(el);
  if (hadFocus) fresh.focus();
  if (before) meterMoves(fresh, before);
  return fresh;
}

// Where the about corner's chips sat on the old card (card-relative), your
// level there, and the chip itself — the one a clear lets recede.
function cornersNow(card) {
  const box = card.getBoundingClientRect();
  const at = new Map();
  for (const c of card.querySelectorAll(':scope > .corner-about > [data-kind]')) {
    if (c.hidden) continue;
    const r = c.getBoundingClientRect();
    at.set(c.dataset.kind, { x: r.left - box.left, y: r.top - box.top, w: r.width });
  }
  const m = card.querySelector(':scope > .corner-about > .chip-meter');
  return { at, level: m ? Number(m.dataset.level) : 0, meter: m && !m.hidden ? m : null };
}

// A level change is a small event (Kevin, 2026-08-30: things grow from where
// they already are; the way in has a little life, the way out is quick and
// plain; nothing vanishes in place). Your chip arrives by growing out of the
// corner's edge; each tap lights the next bar, rising from the baseline;
// MUST rises in as a word WHILE the chip widens to hold it (a word that
// waited left an empty pill on screen for four or five frames — the review
// round's slowed filmstrip, 2026-09-23); clearing lets the chip you saw
// recede into that same edge as the neighbours close the gap (meterLeaves).
// The notes and Spotify chips travel from where they were whenever the
// meter moves them. Transform and opacity only, and only when canAnimate
// says so — Low Power and reduced motion get the finished card at once
// (refreshCard only calls this when it may animate). Nothing here runs when
// your level did not change (a note, a crew-mate's pick).
function meterMoves(card, before) {
  const meter = card.querySelector(':scope > .corner-about > .chip-meter');
  const to = meter ? Number(meter.dataset.level) : 0;
  const from = before.level;
  if (to === from) return;
  const left = card.getBoundingClientRect().left;
  const slide = to ? { duration: GROW_MS, easing: EASE_ARRIVE } : { duration: OUT_MS, easing: EASE_SURFACE };
  for (const c of card.querySelectorAll(':scope > .corner-about > [data-kind]:not(.chip-meter)')) {
    const was = before.at.get(c.dataset.kind);
    if (!was || c.hidden) continue;
    const dx = was.x - (c.getBoundingClientRect().left - left);
    if (Math.abs(dx) > 0.5) c.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], slide);
  }
  if (!meter) {
    const was = before.at.get('meter');
    if (before.meter && was) meterLeaves(card, before.meter, was);
    return;
  }
  if (!from) {
    // A beat after its neighbours start making room, so it grows into space.
    meter.animate([
      { transform: 'scale(.4)', opacity: 0 },
      { opacity: 1, offset: 0.45 },
      { transform: 'none', opacity: 1 },
    ], { duration: GROW_MS, delay: STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
    return;
  }
  if (to === 4 || from === 4) {
    const was = before.at.get('meter');
    const w = meter.getBoundingClientRect().width;
    if (was && w > 0 && Math.abs(was.w - w) > 0.5) {
      meter.animate([{ transform: `scaleX(${was.w / w})` }, { transform: 'none' }], { duration: GROW_MS, easing: EASE_ARRIVE });
    }
    meter.firstElementChild.animate([
      { transform: 'translateY(3px)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: GROW_MS, easing: EASE_ARRIVE });
    return;
  }
  const bars = meter.querySelectorAll('.bar');
  if (to > from) {
    for (let i = from; i < to; i++) {
      bars[i].animate([
        { transform: 'scaleY(.35)', opacity: 0.3 },
        { transform: 'none', opacity: 1 },
      ], { duration: GROW_MS, delay: (i - from) * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
    }
  } else {
    for (let i = to; i < from; i++) bars[i].animate([{ opacity: 1 }, { opacity: 0.3 }], { duration: OUT_MS, easing: EASE_SURFACE });
  }
}

// A clear: the chip you just saw recedes into the corner's edge it grew from
// (.chip-meter's transform-origin), quick and plain, in lockstep with its
// neighbours closing the gap — the same duration and curve, and all the way
// to nothing, so the pill sliding in chases the chip's right edge and never
// covers it (an ease-in to .4 left a near-whole MUST under the incoming pill
// at 40ms; the fix round's filmstrip). The old card is already gone, so it leaves as a
// copy drawn on the fresh card where it stood: before the corners (they
// pass over it), outside .corner-about and without a data-kind, so the fit,
// the next tap's cornersNow and every corner query never see it. It removes
// itself when done, and a belt removes it anyway — a backgrounded tab may
// never finish an animation (the zoom's own way out does the same).
function meterLeaves(card, was, at) {
  const ghost = was.cloneNode(true);
  ghost.classList.add('leaving');
  delete ghost.dataset.kind;
  card.insertBefore(ghost, card.querySelector(':scope > .corner-about'));
  // Placed at the card's padding-box origin by v3.css, then moved onto the
  // spot the chip had: one read, one write.
  const box = card.getBoundingClientRect();
  const r = ghost.getBoundingClientRect();
  ghost.style.left = `${at.x - (r.left - box.left)}px`;
  ghost.style.top = `${at.y - (r.top - box.top)}px`;
  const out = ghost.animate([
    { transform: 'none', opacity: 1 },
    { transform: 'scale(0)', opacity: 0 },
  ], { duration: OUT_MS, easing: EASE_SURFACE, fill: 'forwards' });
  let done = false;
  const finish = () => { if (!done) { done = true; ghost.remove(); } };
  out.onfinish = finish;
  out.oncancel = finish;
  setTimeout(finish, OUT_MS * 4 + 80);
}

// The card a zoom should be restored onto after a repaint: the one carrying
// this artist AND this occurrence. Both facts are needed — in Portola one
// name can be two cards (a grid billing and an event), and the wrong one is
// the wrong story.
//
// `room` breaks the one remaining tie. A combined-day show (Portola's Horse
// Meat Disco, day "Afters & Folsom") is ONE occurrence rendered in TWO rooms
// — that is deliberate, one show and one pick key (review round finding 19) —
// so its two cards carry byte-identical `data-occ` and the plain lookup
// returns whichever comes first in document order. A zoom standing on the
// Folsom tile then came back on the Afters cell: the overlay jumped rooms,
// which is one way "hover shows some other random looking card" happens.
// Passing the room the zoom was in keeps it where the person left it, and
// costs nothing when there is only one match.
export function cardFor(root, artist, occ, { room = null } = {}) {
  const want = occ ? JSON.stringify(occ) : '';
  const all = [...root.querySelectorAll('.card[data-artist]')]
    .filter((el) => el.dataset.artist === artist && (el.dataset.occ || '') === want);
  if (all.length > 1 && room) {
    const here = all.find((el) => roomOf(el) === room);
    if (here) return here;
  }
  return all[0] || null;
}
// Which room a card is in, for the tie-break above: the key of the room
// block it sits in, or null on the wall itself.
export function roomOf(el) {
  const room = el && el.closest ? el.closest('.room') : null;
  return (room && room.dataset.room) || null;
}

// ---- day grouping (lineup mode) -----------------------------------------------
// Split a combined day string ("Saturday & Sunday") into real days. Returns
// null unless EVERY part matches a known day name — an unrecognized part means
// the string isn't a clean combination and stays a literal group (ST-1).
export function splitDays(dayStr, knownDays) {
  if (!dayStr || !knownDays?.length) return null;
  // No comma in the separator set: real combinations use & / + / "and", while
  // commas live inside single-day labels ("Wednesday, Sept 16 (pre-party)").
  const parts = String(dayStr).split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const canon = new Map(knownDays.map((d) => [d.toLowerCase(), d]));
  const mapped = parts.map((p) => canon.get(p.toLowerCase()));
  return mapped.every(Boolean) ? mapped : null;
}

// The festival's real days, in intended order: dayMeta keys when curated,
// else the atomic (non-combined) day values in first-appearance order.
export function knownDaysOf(fest) {
  const meta = Object.keys(fest.dayMeta || {});
  if (meta.length) return meta;
  const days = [];
  for (const a of fest.artists || []) {
    if (!a.day || /[&+/]|\s+and\s+/i.test(a.day)) continue;
    if (!days.includes(a.day)) days.push(a.day);
  }
  return days;
}

// Artists keep billing order inside each group. Groups follow known-day order
// first, then first appearance; artists with no day form THE LINEUP block.
// A multi-day artist appears under EACH of its days (spec F4), never as a
// combined "Day X & Day Y" section.
export function groupByDay(artists, knownDays = []) {
  const groups = new Map();
  const add = (key, a) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  };
  for (const a of artists) {
    const split = splitDays(a.day, knownDays);
    if (split) for (const d of split) add(d, a);
    else add(a.day || '', a);
  }
  if (!knownDays.length) return groups;
  const ordered = new Map();
  if (groups.has('')) ordered.set('', groups.get(''));
  for (const d of knownDays) if (groups.has(d)) ordered.set(d, groups.get(d));
  for (const [k, v] of groups) if (!ordered.has(k)) ordered.set(k, v);
  return ordered;
}


// One lineup-style section: a list head and a card grid. This is the SEARCH
// and flat-sort shape — a list of answers, not a night — and the composed
// wall's day-less blocks (THE LINEUP, EVERYTHING ELSE). A named day's answers
// sit in the block its tab lands on; the day-less blocks are not tabs.
function renderLineupGroup(root, day, list, ctx, fest, { header, sub } = {}) {
  const meta = (fest.dayMeta || {})[day];
  // A day KEY is frozen pick data and can be verbose ("Wednesday, Sept 16
  // (Early Arrival Pre-Party)"); the head shows the weekday and moves the
  // aside to its sub line — the same split the day tab and the day sheet use.
  const parts = day ? dayLabelParts(day) : null;
  const host = day ? dayBlock(day) : root;
  host.appendChild(listHead(
    header || (parts && parts.head) || 'THE LINEUP',
    sub !== undefined ? sub : (day ? [dayRuleSub(meta), parts.aside].filter(Boolean).join(' · ') : (ctx.sort === 'billing' ? 'BILLING ORDER' : '')),
  ));
  renderCardGrid(host, list, ctx, { day, subLabelOf: lineupSubLabel });
  if (host !== root) root.appendChild(host);
}

// A lineup entry can be an EVENT (afters, Folsom) — venue rides in `stage`,
// hours in `time`. In a LIST (a lineup group, a flat sort, search) day and
// time share the first line and the venue takes its own (one crammed line
// hid both — Kevin, 2026-08-29); the .time element renders pre-line, so the
// newline is the break. Inside a day-first day the tile says only the time
// (the day is the day, the venue lives in the zoom) — see eventTileSubLabel.
function lineupSubLabel(a) {
  // A cancelled act answers with its place and the word, never a clock.
  if (isCancelled(a)) return [a.stage || a.venue || '', 'Cancelled'].filter(Boolean).join(' · ');
  const time = a.time ? approxMark(a, a.time) : ''; // the tilde travels with `approx`
  // A dated show says where in `venue`; the legacy afters shape says it in
  // `stage` ("Sun · The Midway"). Either way the answer names its room.
  const where = a.stage || a.venue || '';
  let subLabel = [where, time].filter(Boolean).join(' · ');
  if (where && time) {
    const bits = where.split(' · ');
    subLabel = bits.length > 1
      ? `${bits[0]} · ${time}\n${bits.slice(1).join(' · ')}`
      : `${time}\n${where}`;
  }
  return subLabel || undefined;
}

// The card grid every list section shares. The people filter never hides a
// card here or anywhere (Kevin, 2026-09-17: highlighting picks "shouldn't
// work as a filter"): every entry renders, and renderCard dims the ones the
// selected people did not pick.
function renderCardGrid(root, list, ctx, { day = null, subLabelOf = lineupSubLabel, className = 'wall-grid' } = {}) {
  const grid = document.createElement('div');
  grid.className = className;
  const showTags = !ctx.weekend || ctx.weekend === 'all';
  // A cancelled act sorts last in its list, as it does in a stack.
  for (const a of [...list.filter((x) => !isCancelled(x)), ...list.filter(isCancelled)]) {
    const tag = showTags && (a.weekends === 'W1' || a.weekends === 'W2') ? a.weekends : undefined;
    // The occurrence comes from the model (events.js occOf), so a card found
    // in a search is the SAME card as the one on the wall — a dated show's
    // two nights included. Only the day falls back to the group's, for a
    // list whose entries carry none.
    grid.appendChild(renderCard(a.name, ctx, { tag, time: subLabelOf(a), occ: { ...occOf(a), day: a.day || day || null } }));
  }
  root.appendChild(grid);
  return list;
}

// Where a day tab lands: one block per day — on the composed wall, holding
// the day's rooms; in a list (a search, a lineup fest's by-day list), holding
// that day's answers — and one per tab that hangs off the end of the week
// (ACL's Late nights). `data-day` is the tab's key, so a verbose day key
// ("Wednesday, Sept 16 (Early Arrival Pre-Party)") is found by its key while
// its head shows the weekday. `data-iso` is the day's date where it is one:
// the day-of open lands there before doors (scrollToNowLine). Every jump,
// the scrollspy and the fold address this one shape (DAY_ANCHOR).
function dayBlock(key, iso = null) {
  const block = document.createElement('div');
  block.className = 'day-block';
  if (key) block.dataset.day = key;
  if (iso) block.dataset.iso = iso;
  return block;
}

// A LIST's head: one line over a list of answers — a day's in a search or a
// lineup fest's by-day list, and the day-less blocks (THE LINEUP, EVERYTHING
// ELSE · NO SET TIME YET, NOTES · <FEST>). It is never a door and never an
// anchor (the day's block is). The composed wall does not draw one: every
// room there wears its own head (roomHead), which names the day itself.
function listHead(label, sub) {
  const head = document.createElement('div');
  head.className = 'list-head';
  const l = document.createElement('span');
  l.className = 'label';
  l.textContent = String(label).toUpperCase();
  const s = document.createElement('span');
  s.className = 'sub';
  s.textContent = sub || '';
  const line = document.createElement('span');
  line.className = 'line';
  head.append(l, s, line);
  return head;
}

// A LIST's day head subtitle: real dates beat internal numbering (ST-4). A
// dated day says its own date — that sub comes composed from the model
// (events.js), which is the only place a weekend is still a thing.
function dayRuleSub(meta) {
  if (!meta) return '';
  return [meta.wd, meta.date || (meta.num ? `Day ${meta.num}` : '')].filter(Boolean).join(' · ');
}

// ---- search / sort / weekend -----------------------------------------------------
// Fold both sides of a search, never a stored name (names are pick keys): so
// "tiesto" finds Tiësto, "mull" finds MÜLL, "chloe" finds Chloé Caillet, and
// the other way round — nobody hunts for the ë on a phone keyboard in a
// field. NFD splits an accented letter into letter + mark and the marks go;
// the letters NFD leaves whole (a stroke or a ligature, not a mark: CØNTRA,
// Łaszewo, DØMINA) get their plain spelling from FOLD_LETTERS. And iOS types
// a curly ’ for ' (Smart Punctuation), so "it’s murph" finds It's Murph.
// Every search in the app matches through searchMatches — there were two,
// and the scheduled-fest one (Portola's) had never folded at all (v91,
// 2026-09-25: friends at Portola typed "mull" and found nothing).
const FOLD_LETTERS = { 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'ħ': 'h', 'ı': 'i', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'þ': 'th' };
export function searchFold(s) {
  return String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øłđðħıßæœþ]/g, (c) => FOLD_LETTERS[c])
    .replace(/[\u2018\u2019\u02bc]/g, "'");
}
// The one match every search uses: does this name answer this query? An
// empty (or all-space) query answers everything.
export function searchMatches(name, query) {
  const q = searchFold(query).trim();
  return !q || searchFold(name).includes(q);
}
export function applyFilter(artists, query) {
  if (!searchFold(query).trim()) return artists;
  return artists.filter((a) => searchMatches(a.name, query));
}

// Multi-weekend fests (ST-3): 'all' shows everyone; W1/W2 shows that
// weekend's lineup (artists playing both always stay).
export function applyWeekend(artists, weekend) {
  if (!weekend || weekend === 'all') return artists;
  return artists.filter((a) => !a.weekends || a.weekends === 'both' || a.weekends === weekend);
}

export function applySort(artists, mode, ctx) {
  const arr = [...artists];
  const myLevel = (a) => (ctx.picks[a.name] || {})[ctx.meName] || 0;
  const crewHeat = (a) => Object.values(ctx.picks[a.name] || {}).reduce((s, l) => s + l, 0);
  if (mode === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === 'mine') arr.sort((a, b) => myLevel(b) - myLevel(a));
  else if (mode === 'crew') arr.sort((a, b) => crewHeat(b) - crewHeat(a));
  return arr; // 'billing' and 'day' keep source order; day grouping handles days
}

// ---- set-times grid (atlas 21d: the same cards, on a clock) ---------------------
// One vertical page: every grid day's festival room gets a clock grid under
// its head. Mobile shows ~2 stages and swipes; desktop fits them all.
//
// The stage columns are CANONICAL across days (model.canonicalStages): every
// day renders the same columns in the same order on the same template, all
// day scrollers mirror ONE horizontal position, and a single sticky strip
// carries the stage names for the whole page — so scrolling straight down a
// column stays on one stage from Thursday to Sunday. The strip lives OUTSIDE
// the horizontal scrollers because position:sticky can't escape an
// overflow-x container (the same physics that put the hour rail outside).
export function computeTimesLayout(fest) {
  const stages = model.canonicalStages(fest);
  // The columns are the festival's stages and nothing else, every one at the
  // ONE card column (filters.js COL). Anything that is not a stage set on
  // the clock — activities, a set whose stage is not a column — renders as
  // a venue group under the grid, in the festival's own room (MODEL-V4
  // §1.3), never in a reserved column: a 9:30 AM yoga row beside 5 PM sets
  // was a column on a clock its items were not on (Kevin, Electric Forest,
  // 2026-09-02: "a cards section with our header"). The same template feeds
  // the strip and every day, so a column is the same column all the way
  // down.
  return { stages, colsTemplate: stages.map(() => COL).join(' ') };
}

// A stage header names its column and takes no tap (ship round, 2026-09-17:
// the tap-to-see-only-this-stage it used to carry was cut whole — a feature
// nobody could find from the screen). The same component heads a venue's
// stack (venueGroups). The text sits in an inner label so the ellipsis clips
// THAT, not the head.
function stageHead(label) {
  const h = document.createElement('div');
  h.className = 'stage-head';
  h.title = label; // long names ellipsize — hover recovers
  const text = document.createElement('span');
  text.className = 'label';
  text.textContent = label;
  h.appendChild(text);
  return h;
}

function renderStageStrip(layout) {
  const strip = document.createElement('div');
  strip.className = 'times-wrap stage-strip';
  const spacer = document.createElement('div');
  spacer.className = 'strip-rail'; // matches the hour rail's width for column alignment
  const scroll = document.createElement('div');
  scroll.className = 'times-scroll';
  const grid = document.createElement('div');
  grid.className = 'times-grid';
  grid.style.gridTemplateColumns = layout.colsTemplate;
  grid.style.gridTemplateRows = '32px';
  for (const s of layout.stages) grid.appendChild(stageHead(s));
  scroll.appendChild(grid);
  strip.append(spacer, scroll);
  return strip;
}

// ---- the now line --------------------------------------------------------------
// Rows are 15 minutes; a row is ROW_PX tall plus ROW_GAP between rows, so the
// pitch per row is their sum. Kept here beside the grid that uses them.
const ROW_PX = 20;
const ROW_GAP = 4;
const ROW_PITCH = ROW_PX + ROW_GAP;

// The hour rail beside a grid, where the now line's time label sits.
const railOf = (grid) => (grid && grid.parentElement && grid.parentElement.parentElement
  ? grid.parentElement.parentElement.querySelector('.times-rail') : null);
// The now line's time label ("7:00 PM" on the rail), for whatever answers
// with the line (NOW's repeat tap pulses both).
export function nowLabelOf(line) {
  const rail = railOf(line && line.closest('.times-grid'));
  return rail ? rail.querySelector('.now-label') : null;
}

// Draw (or move) the now line on every timetable grid whose day is today.
// Each grid carries its geometry as data attributes, so this can run from
// a one-minute ticker without a repaint. Removes a line whose day has ended.
export function positionNowLines(root, date = new Date()) {
  for (const grid of root.querySelectorAll('.times-grid[data-iso]')) {
    const clock = festivalClock(date, grid.dataset.tz || null); // the grid knows its festival's zone
    const rail = railOf(grid);
    const isToday = grid.dataset.iso === clock.iso;
    const top = isToday ? nowOffsetPx(clock.minutes, {
      startRow: Number(grid.dataset.startRow), rows: Number(grid.dataset.rows), pitch: ROW_PITCH,
    }) : null;
    let line = grid.querySelector('.now-line');
    let label = rail ? rail.querySelector('.now-label') : null;
    if (top == null) {
      if (line) line.remove();
      if (label) label.remove();
      continue;
    }
    if (!line) {
      line = document.createElement('div');
      line.className = 'now-line';
      line.setAttribute('aria-hidden', 'true');
      grid.appendChild(line);
    }
    line.style.top = `${top - 1}px`;
    line.dataset.minutes = String(clock.minutes);
    if (rail && !label) {
      label = document.createElement('span');
      label.className = 'now-label';
      rail.appendChild(label);
    }
    if (label) {
      label.style.top = `${top}px`;
      label.textContent = clockLabel(clock.minutes);
      label.setAttribute('aria-label', `Now, ${clockLabel(clock.minutes)}`);
    }
  }
}

// The day-of open: land the now line about a third of the way down the
// viewport so the next hour is in view. Before doors on festival day there
// is no line yet — land on today's block instead, whose first head names the
// day. A dated section's date is a festival day too (2026-09-23): on an ACL
// night between the weekends, today is a room inside the Late nights block,
// and the open lands on its head — but a real day block today (a grid day,
// Oct 3) always wins, and a hidden section renders nothing to land on.
// Returns the target it scrolled to ('now' | 'day') or null when today is not
// on this wall.
export function scrollToNowLine(root, { date = new Date(), viewportHeight = window.innerHeight, scrollTo = (y) => window.scrollTo({ top: y, behavior: 'auto' }), timeZone = null } = {}) {
  const pageY = (el) => el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
  const line = root.querySelector('.now-line');
  if (line) {
    scrollTo(Math.max(0, pageY(line) - viewportHeight * 0.33));
    return 'now';
  }
  // "Today" in the festival's zone — the grids carry it; the caller may too.
  const zoned = root.querySelector('.times-grid[data-tz]');
  const todayIso = festivalClock(date, timeZone || (zoned ? zoned.dataset.tz : null)).iso;
  const day = root.querySelector(`.day-block[data-iso="${todayIso}"]`)
    || root.querySelector(`.day-block .room[data-iso="${todayIso}"]`);
  if (!day) return null;
  // The block's scroll-margin-top is the sticky chrome's height (app.js
  // measures it into --jump-offset); land below it like a day-tab jump does —
  // a room inside a block lands against its block's.
  const block = day.closest('.day-block') || day;
  const offset = (typeof window !== 'undefined' && window.getComputedStyle)
    ? parseFloat(window.getComputedStyle(block).scrollMarginTop) || 0 : 0;
  scrollTo(Math.max(0, pageY(day) - offset));
  return 'day';
}

// Mirror one horizontal position across the strip and every day's scroller.
// Setting scrollLeft programmatically fires a scroll event on the target; the
// lastSet map recognizes that echo (same element, same value) and drops it
// instead of ping-ponging.
// Scrollers mirror within their GROUP (`data-sync`): the main grid's strip
// and days are one group; on a day-first wall every events timetable is its
// own (its venues are not the grid's stages, so its position is its own).
// Scrollers with no group — the grid-only wall — are one group, as before.
//
// The STRIP is not a scroller any more (2026-09-02). Mirroring it with
// scrollLeft from scroll events put it a frame behind the grid on every
// event — on a phone, where the grid scrolls on the compositor and the
// event lands on the main thread afterwards, that read as a stuttering,
// delayed slide of the stage names above a butter-smooth grid (Kevin's
// iPhone, 2026-09-02). Now the strip's own row FOLLOWS the group's lead
// grid: where the browser has scroll-driven animations the follow is a
// CSS animation on the grid's scroll timeline — the compositor moves both
// in the same frame and no script runs — and elsewhere a transform set
// from the lead's scroll event (still one frame late, but a transform, not
// a second scroll). Day scrollers keep mirroring each other as before.
export const isStripScroller = (s) => !!(s.closest && s.closest('.stage-strip'));
// Whether the engine has scroll timelines, asked once (the CSSOM must know the
// properties — jsdom's CSS.supports says yes to anything).
const SCROLL_TIMELINES = (() => {
  try {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || typeof window === 'undefined') return false;
    // The engine exposes the timeline as an object too; a DOM shim never does.
    if (typeof window.ScrollTimeline !== 'function') return false;
    return CSS.supports('animation-timeline: scroll()') && CSS.supports('timeline-scope: --a');
  } catch { return false; }
})();
// What a wall render wires beyond its own nodes — size observers, timeline
// names on a scope that outlives the render — undone by renderWall before the
// next render replaces it.
const teardowns = new WeakMap();
const undoOnRepaint = (root, undo) => {
  if (!teardowns.has(root)) teardowns.set(root, []);
  teardowns.get(root).push(undo);
};
let timelineSeq = 0;
// The strip element (`.stage-strip`) around a strip's scroller — where the
// route taken is written down.
const stripOf = (scroller) => (scroller.closest && scroller.closest('.stage-strip')) || scroller;
function followStrip(strip, lead, root) {
  const row = strip.querySelector('.times-grid');
  if (!row) return;
  strip.classList.add('follows');
  // The timeline wherever the engine has one — under Reduce Motion and the
  // app's Low power too (2026-09-23). A strip that tracks your finger is
  // direct manipulation, not decorative motion: the people who turned motion
  // off need the stage names over the right columns as much as anyone, and
  // the transform route below trails the grid by a frame on a phone (Kevin's
  // "stuttered delayed slide"). The two kill rules in the tokens file would
  // still freeze it — their `animation` shorthand resets `animation-timeline`
  // — so the follow's animation lives in v3.css, out-ranking them, and reads
  // the timeline's name from `--strip-tl`, which no shorthand can reset.
  // Still decided per render, as every wiring here is.
  if (SCROLL_TIMELINES) {
    // The timeline is named on the lead and scoped on the nearest ancestor
    // both share (a day's .tt-block, or the wall for the one-strip page).
    // The far keyframe is the lead's maximum scroll in px (--strip-max): the
    // row's own box is only as wide as the strip, its tracks overflow it,
    // so a percentage of the row would be a percentage of the wrong thing.
    // Re-measured whenever the lead or its grid changes size.
    const name = `--tt-${(timelineSeq += 1)}`;
    const setMax = () => row.style.setProperty('--strip-max', `${Math.max(0, lead.scrollWidth - lead.clientWidth)}px`);
    setMax();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(setMax) : null;
    if (ro) {
      ro.observe(lead);
      if (lead.firstElementChild) ro.observe(lead.firstElementChild);
    }
    lead.style.scrollTimeline = `${name} x`;
    row.style.setProperty('--strip-tl', name);
    row.classList.add('rides');
    stripOf(strip).dataset.follow = 'timeline'; // what Diagnostics reports (js/errlog.js)
    const scope = strip.closest('.tt-block') || root;
    scope.style.timelineScope = [scope.style.timelineScope, name].filter(Boolean).join(', ');
    undoOnRepaint(root, () => {
      if (ro) ro.disconnect();
      scope.style.timelineScope = '';
    });
    return;
  }
  // No scroll timelines in this engine (iOS before 26): a transform set on
  // the spot. Scroll events already arrive at most once a frame, and a
  // transform write is a compositor update, not a layout.
  stripOf(strip).dataset.follow = 'transform';
  const follow = () => { row.style.transform = `translateX(${-lead.scrollLeft}px)`; };
  lead.addEventListener('scroll', follow, { passive: true });
  follow();
}
// The grid a strip follows is the one it SITS ABOVE — its own `.tt-block`'s.
// Every day's grid and its strip share `data-sync="grid"` so the days mirror
// one scroll position, and the wiring used to hand EVERY strip the group's
// first grid: the second call overwrote that grid's scroll-timeline name, and
// the second day's name ended up declared outside its own `timeline-scope`, so
// on any fest with two grid days BOTH strips froze while the columns slid
// under them and a stage name sat over another stage's set (real-browser walk,
// 2026-09-17, Portola). One rule: the lead is the grid underneath.
const gridUnderStrip = (strip) => {
  const block = strip.closest('.tt-block');
  return block ? [...block.querySelectorAll('.times-scroll')].find((s) => !isStripScroller(s)) : null;
};

export function wireTimesScrollSync(root) {
  const groups = new Map();
  for (const s of root.querySelectorAll('.times-scroll')) {
    const key = s.dataset.sync || '*';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const all of groups.values()) {
    const scrollers = all.filter((s) => !isStripScroller(s));
    if (!scrollers.length) continue;
    for (const strip of all) {
      if (!isStripScroller(strip)) continue;
      const lead = gridUnderStrip(strip);
      if (lead) followStrip(strip, lead, root);
    }
    if (scrollers.length < 2) continue;
    const lastSet = new Map();
    for (const s of scrollers) {
      s.addEventListener('scroll', () => {
        if (lastSet.get(s) === s.scrollLeft) { lastSet.delete(s); return; }
        for (const o of scrollers) {
          if (o !== s && o.scrollLeft !== s.scrollLeft) {
            lastSet.set(o, s.scrollLeft);
            o.scrollLeft = s.scrollLeft;
          }
        }
      }, { passive: true });
    }
  }
}

// The day's clock: rail + grid, inside its own `.tt-block` with a sticky
// stage strip — the festival room's body on a grid day. True when it drew
// one: a day with no timed sets has no clock for a stack to line up with.
function renderScheduledDayBody(root, day, ctx, layout, weekend, { strip = false } = {}) {
  const fest = state.fest();
  const computed = state.getDayArtists(day, weekend);
  const stages = layout.stages;
  const meta = (fest.dayMeta || {})[day];

  // A day with no timed sets must not mint a NaN grid (Math.min of nothing
  // is Infinity). Its billed names still render as the room's cards (the
  // caller's venue groups); a day with nothing at all says so.
  if (!computed.length) {
    if (!((fest.activities || {})[day] || []).length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; padding: 6px 0 2px;';
      empty.textContent = 'No set times for this day yet.';
      root.appendChild(empty);
    }
    return false;
  }

  // Cards are laid out on DISPLAY extents: every set gets at least 30 visual
  // minutes (2 rows) so its name + time always fit. The lane math further
  // down runs on these same extents — the readability floor can make two
  // sets overlap VISUALLY that never overlap in time, and they need lanes
  // exactly like real overlaps (Codex arc gate, P1).
  const drawn = computed.map((a) => ({
    ...a, endMin: Math.max(a.endMin ?? a.startMin + 60, a.startMin + 30),
    // The set's REAL window, before the display floor: what NOW asks when it
    // looks for a highlighted person's pick that is playing (nowLanding).
    liveTo: a.endMin ?? a.startMin + 60,
  }));
  // The grid spans the WHOLE festival day — its doors to its close when the
  // file says them, else whole hours around the sets (MODEL-V4 §1.1). A now
  // line always has somewhere to sit, and empty rows at the day's edges are
  // the honest cost of that (Kevin, 2026-09-17: "otherwise the now line is
  // weird").
  const atMin = (t) => { const p = parseEventTime(t); return p ? p.startMin : null; };
  const firstSet = Math.min(...drawn.map((a) => a.startMin));
  const lastSet = Math.max(...drawn.map((a) => a.endMin));
  const dayStart = Math.min(atMin(meta && meta.doors) ?? firstSet, firstSet);
  const dayEnd = Math.max(atMin(meta && meta.close) ?? lastSet, lastSet);
  const startRow = Math.floor(dayStart / 60) * 4;
  const rows = Math.ceil(dayEnd / 60) * 4 - startRow;

  // Rail and grid are siblings sharing one rows template: the hour axis stays
  // pinned at the left while stage columns scroll (CORE-2). Stage names live
  // in the shared sticky strip above, not in per-day header rows.
  const rowsTemplate = `repeat(${rows}, 20px)`;
  const wrap = document.createElement('div');
  wrap.className = 'times-wrap';
  const rail = document.createElement('div');
  rail.className = 'times-rail';
  rail.style.gridTemplateRows = rowsTemplate;
  const scroll = document.createElement('div');
  scroll.className = 'times-scroll';
  scroll.dataset.day = day;
  const grid = document.createElement('div');
  grid.className = 'times-grid';
  grid.style.gridTemplateRows = rowsTemplate;
  grid.style.gridTemplateColumns = layout.colsTemplate;

  for (let r = startRow; r < startRow + rows; r++) {
    if (r % 4 !== 0) continue; // hour marks only
    const label = document.createElement('div');
    label.className = 'hour-label';
    label.style.gridRow = String(r - startRow + 1);
    label.textContent = hourLabelOf(r * 15);
    rail.appendChild(label);
  }
  // Same-stage overlaps split their column into side-by-side lanes (the old
  // grid's fix, dropped in the first v3 pass — the Codex P6 sweep surfaced
  // that EF genuinely has these; js/overlap.js is very much alive). Lanes are
  // computed on the drawn extents above, so display-floored collisions split
  // the column too.
  // The grid remembers its own geometry so the now line can be placed and
  // moved by the ticker without a repaint.
  grid.dataset.startRow = String(startRow);
  grid.dataset.rows = String(rows);
  const iso = (meta && (weekend && meta.isos ? meta.isos[weekend] : meta.iso)) || null;
  if (iso) grid.dataset.iso = iso;
  if (fest.timezone) grid.dataset.tz = fest.timezone;

  const lanes = computeLanes(drawn);
  for (const a of drawn) {
    const col = stages.indexOf(a.stage);
    if (col === -1) continue; // not a column: the festival room's venue groups under this grid carry it (festRoomExtras)
    const row = Math.floor(a.startMin / 15) - startRow + 1;
    // endMin here IS the display extent — minimum 2 rows (44px), below which
    // the name + time can't fit (Kevin's screenshot, 2026-07-12).
    const span = Math.max(1, Math.ceil((a.endMin - a.startMin) / 15));
    // A set three hours or longer (Despacio runs seven) is a TALL cell: its
    // name sits at the top edge like a printed grid and the bottom edge says
    // when it ends — centred content put the name three screens down and the
    // column read as an empty slab (Kevin's screenshot, 2026-08-31).
    const tall = span >= 12;
    const cell = renderCard(a.name, ctx, { cell: true, tall, until: tall ? a.endStr || null : null, time: a.startStr, occ: { day, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null } });
    cell.style.gridColumn = String(col + 1);
    cell.style.gridRow = `${row} / span ${span}`;
    cell.style.minHeight = '0';
    // Its window on the festival day's clock, the same data a stack card
    // carries (positionNowMarks leaves grid cells alone: the grid has its
    // line). NOW reads it to find who is playing (nowLanding).
    cell.dataset.nowFrom = String(a.startMin);
    cell.dataset.nowTo = String(a.liveTo);
    const lane = lanes.get(a);
    if (lane && lane.lanes > 1) {
      // Lane math assumes border-box sizing (v3.css sets it on .card):
      // width% + margin-left% ≤ 100% keeps every lane inside its own column.
      cell.style.width = `calc(${(100 / lane.lanes).toFixed(3)}% - 2px)`;
      cell.style.marginLeft = `${((lane.lane * 100) / lane.lanes).toFixed(3)}%`;
    }
    grid.appendChild(cell);
  }

  scroll.appendChild(grid);
  wrap.append(rail, scroll);
  if (strip) {
    const block = document.createElement('div');
    block.className = 'tt-block';
    const stripEl = renderStageStrip(layout);
    stripEl.querySelector('.times-scroll').dataset.sync = 'grid';
    scroll.dataset.sync = 'grid';
    block.append(stripEl, wrap);
    root.appendChild(block);
  } else {
    root.appendChild(wrap);
  }
  // Today's grid gets the now line on first paint (the ticker keeps it moving).
  if (iso && nowOnDay(fest, day, weekend, ctx.now || new Date()) != null) positionNowLines(wrap, ctx.now || new Date());
  return true;
}

// ---- the composed wall (MODEL-V4, 2026-09-16) ------------------------------------
// ONE RULE: stage columns on a clock only where the festival publishes a
// stage grid; everything else is a stack of cards under the place it
// happens, in play order.
//
// A day is a block of ROOMS, in order: the festival's own first — its
// timetable on a grid day, then anything of the festival's that is not on
// that grid (a set whose stage is not a column, a billed name with no set
// time yet, the day's activities) as venue groups — then each section that
// plays that night. Every room wears ONE head naming when and what (`SAT
// PORTOLA`, `SAT AFTERS` — one-line heads, 2026-09-23); there is no day line
// above them. The show menu decides which rooms are hidden (wallPlanFor
// applies it), and a hidden room renders nothing.


// Which weekends a scheduled fest renders. A two-weekend one (ACL) gets six
// dated tabs — a weekend is not a filter any more, it is which day you are
// looking at (MODEL-V4 §2).
export function weekendsOf(fest) {
  const days = (fest && fest.days) || {};
  const tagged = Object.keys(days).some((d) =>
    (days[d].artists || []).some((a) => a.weekend === 'W1' || a.weekend === 'W2'));
  return tagged ? ['W1', 'W2'] : [null];
}
// A weekend's key in the folded list (Kevin, 2026-09-17: "ACL needs options in
// the show/hide menu to hide weekend 1 or weekend 2"). The colon keeps it out
// of the space a data file's day labels live in, like FEST_ROOM.
export const weekendRoom = (w) => `weekend:${w}`;

// The whole wall's plan. Null only where the wall is not a week at all — a
// flat sort or a search, which are lists of answers.
//
// The plan applies the fold (ship round, 2026-09-17). A hidden room
// contributes nothing: a hidden section is absent from every day it played,
// a hidden extra (Late nights) is absent, the festival's own room takes its
// grid, its billed names and its day-less names with it — and a day whose
// visible rooms are all empty is not a day: no block, no tab, never the open
// (Kevin: "if all events for a day are hidden, don't show that day at all —
// not empty shells"). The show menu reads the same plan with nothing folded
// (roomsOf), which is where the hidden state stays visible.
export function wallPlanFor(fest, ctx) {
  const scheduled = !!(fest.days && Object.keys(fest.days).length);
  if (!scheduled && !(ctx.sort === 'billing' || ctx.sort === 'day')) return null;
  const weekends = scheduled ? weekendsOf(fest) : [null];
  // A scheduled fest filters per DAY (each tab is its own weekend); a lineup
  // fest still filters the whole list.
  const artists = applyWeekend(fest.artists || [], scheduled ? null : ctx.weekend);
  const gridDays = scheduled ? Object.keys(fest.days) : [];
  const whole = eventModelOf(fest, groupByDay(artists, knownDaysOf(fest)), { gridDays, weekends });
  // A whole lineup with no day on it (EDC Orlando) is still a lineup — the
  // wall draws it as THE LINEUP and the exporter offers it. Only a fest with
  // nothing at all has no plan; a fest with everything hidden still has one
  // (an empty week), so the flat lineup never leaks through in its place.
  if (!whole.days.length && !whole.extras.length && !whole.looseNoDay.length) return null;
  // A fest with ONE room has no show menu at all (the fest name opens
  // Settings), so no key can mean anything on it (2026-09-23) — the rule
  // below, taken to its end.
  const hidden = roomsIn(fest, whole, weekends).length > 1 ? new Set(ctx.folded || []) : new Set();
  // A key the show menu does not offer is inert here, or a stored setting
  // could hide something with nothing on the screen to bring it back. On a
  // two-weekend fest the weekend rows ARE the festival room (roomsOf offers
  // them in its place), so `:fest` means nothing there — a stale one from
  // before the file gained its weekend tags would otherwise blank both
  // weekends with both rows reading ✓ (skeptic, 2026-09-17). The mirror holds
  // by construction: a one-weekend fest's days carry no weekend, so a
  // `weekend:` key never matches one.
  const festRoom = weekends.length > 1 || !hidden.has(FEST_ROOM);
  const sections = whole.sections.filter((s) => !hidden.has(s.key));
  const extras = whole.extras.filter((e) => !hidden.has(e.key));
  // A hidden weekend takes its dated days whole (a set tagged for both
  // weekends keeps playing on the other); the days that stay are the ones
  // with something visible on them.
  const days = whole.days
    .filter((d) => !(d.weekend && hidden.has(weekendRoom(d.weekend))))
    .filter((d) => (festRoom && (d.grid || d.billing)) || sections.some((s) => s.byDay.has(d.key)));
  const looseNoDay = festRoom ? whole.looseNoDay : [];
  return { model: { ...whole, days, sections, extras, looseNoDay }, festRoom, scheduled, weekends, gridDays };
}

// The rooms of the festival week, in the wall's order and whether or not
// they are hidden — the show menu's list. Read off the FEST through the same
// plan with nothing folded, never off the wall: a hidden room renders
// nothing, and the menu still has to offer it back. The festival's own room
// leads wherever it first appears (Portola's Thursday and Friday are other
// people's warehouses), then each section, then the tabs off the end.
export function roomsOf(fest, ctx) {
  const plan = fest ? wallPlanFor(fest, { ...ctx, query: '', folded: [] }) : null;
  if (!plan) return [];
  return roomsIn(fest, plan.model, plan.weekends);
}
// The same list, off a model — wallPlanFor asks it how many rooms there are
// before it lets any key hide one.
function roomsIn(fest, { days, sections, extras, looseNoDay }, weekends) {
  const rooms = [];
  if (days.some((d) => d.grid || d.billing) || looseNoDay.length) {
    // A two-weekend fest offers a row per weekend in place of its own room:
    // hiding a weekend is the thing a person wants to do there.
    if (weekends.length > 1) weekends.forEach((w, i) => rooms.push({ key: weekendRoom(w), label: `Weekend ${i + 1}` }));
    else rooms.push({ key: FEST_ROOM, label: fest.name });
  }
  for (const s of sections) rooms.push({ key: s.key, label: s.label });
  for (const e of extras) rooms.push({ key: e.key, label: e.label });
  return rooms;
}

// The words on the fest link at the end of the dock (phone) and the rail
// (desktop) — the show menu's door. One builder, because the wall names that
// door when everything is hidden and must say exactly what is written on it.
export const festLinkLabel = (fest) => `${String(fest.name || '').toUpperCase()} ${fest.year || ''}`.trim();

// Everything hidden (a real-engine walk, 2026-09-23): the show menu unchecked
// every room, so the week has no day and the dock no tab — right by the 09-17
// rule, and a blank screen that told a friend nothing. The wall says why, in
// the app's quiet voice, and where the switch is: the fest link's own words,
// below on a phone (the dock) and up top on a desktop (the rail). No box and
// no button — the fest name is the one door; a second would be a second
// control for one state. It arrives with the beat and leaves before the week
// comes back (app.js toggleFoldFlow).
function allHiddenNotice(root, fest) {
  const n = mk('div', 'wall-empty');
  n.setAttribute('role', 'status');
  const hint = mk('p', 'hint');
  const name = festLinkLabel(fest);
  hint.append(
    mk('span', 'on-phone', `Tap ${name} below to bring parts back.`),
    mk('span', 'on-desk', `Click ${name} up top to bring parts back.`),
  );
  n.append(mk('p', 'lead', 'Everything\u2019s hidden.'), hint);
  root.appendChild(n);
}
// A plan whose visible week is empty: no day, no tab off the end, nothing
// day-less. Only the show menu can do that.
const nothingVisible = (plan) => !!plan && !plan.model.days.length && !plan.model.extras.length && !plan.model.looseNoDay.length;

// What the day tabs (dock + rail) should list, in the wall's own order: the
// days, then the tabs that hang off the end (a dated section like ACL's Late
// nights). `key` is the jump id the wall stamps on the day's block.
// `dayKey` is the day WITHOUT its weekend suffix ("Friday", not "Friday|W1"):
// the key the file wrote and the heads bill. The suffix is an axis detail, so
// anything naming the day for a person reads this, not `key`.
// `grid` says the day has a timetable, so the shell can pick the first VISIBLE
// grid day as the open without asking the fest (a hidden grid day is not here).
const dayTab = (d) => ({ key: d.key, dayKey: d.dayKey || d.key, short: d.short, num: d.num, long: d.long, iso: d.iso, dates: d.iso ? [d.iso] : [], dated: false, grid: !!d.grid });
// A group header a search draws for a section, or a lineup fest's own day.
const groupTab = (fest) => (day) => {
  const meta = (fest.dayMeta || {})[day];
  return {
    key: day,
    dayKey: day,
    short: (meta?.wd || day).slice(0, 3).toUpperCase(),
    num: null,
    dates: [],
    // Rail tabs stay compact: a verbose day key shows its weekday only —
    // the same split the wall's heads and the day sheet use.
    long: (meta?.wd ? `${meta.wd} ${meta.num || ''}`.trim() : dayLabelParts(day).head).toUpperCase(),
    iso: null,
    dated: false,
  };
};

// `wallRoot` is the wall this nav sits over. Hand it in and a SEARCH's tabs
// are read off it; leave it out and the answer is the plan's whole axis.
export function dayNavOf(fest, ctx, wallRoot = null) {
  const plan = wallPlanFor(fest, ctx);
  // A scheduled fest's SEARCH is its own week with the misses taken out, so
  // the tabs are the same axis either way — one list, and the keys match what
  // the wall stamps on its day blocks, or a tab jumps to nothing. Only a
  // lineup fest's flat search keeps its own groups.
  const tabs = plan && (!ctx.query || plan.scheduled)
    ? [
      ...plan.model.days.map(dayTab),
      // A dated section is one tab over many dates, and each of those dates
      // is its own note thread (§4) — so the tab carries them all.
      ...plan.model.extras.map((e) => ({ key: e.key, dayKey: e.key, short: e.short, num: null, long: e.long, iso: null, dates: [...(e.byDate || new Map()).keys()], dated: true })),
    ]
    : [...groupByDay(fest.artists || [], knownDaysOf(fest)).keys()].filter(Boolean).map(groupTab(fest));
  // While a query is on, the wall is that axis with the days that answered
  // nothing left off — so the nav is the days that ANSWERED, read off the
  // wall itself rather than recomputed, because a second copy of "did this
  // day match?" is a second thing to drift. ACL searched for Kings of Leon
  // renders one day and used to keep all seven tabs: six jumped nowhere, and
  // at scroll 0 the dock lit FRI 2 — a Weekend 1 tab, over a Weekend 2
  // answer. Filtering fixes the tab it lights too, because the first tab is
  // now the first answer, which is where the scrollspy starts.
  if (!ctx.query || !wallRoot) return tabs;
  const answered = new Set([...wallRoot.querySelectorAll(DAY_ANCHOR)].map((h) => h.dataset.day));
  return tabs.filter((t) => answered.has(t.anchor || t.key));
}

const mk = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
// The same card twice is the same ARTIST in the same OCCURRENCE — the pair
// `cardFor` restores a zoom by, name plus the day/date/venue/stage/time
// identity `occOf` builds. A name alone is not it: an artist who plays Room A
// at 9 and Room B at 1 AM is two shows on one night, and folding them into one
// answer loses the second outright. An occurrence alone is not it either —
// every name billed on a day with no set yet shares one (day, no stage, no
// time). The one thing that IS a single show reached twice is a combined-day
// entry — Portola's Horse Meat Disco, day "Afters & Folsom", the same object
// handed to two rooms — and it comes back as the same pair, so it stays one,
// the same tie `cardFor` breaks with the room.
const dedupeByCard = (list, occFor = occOf) => {
  const seen = new Set();
  return list.filter((a) => {
    const key = JSON.stringify([a.name, occFor(a)]);
    return seen.has(key) ? false : (seen.add(key), true);
  });
};

// The card's time label in a stack: the range the venue posted, else the
// start with the tilde a guess wears. No time, no time line.
const stackTime = (m) => {
  if (m.cancelled) return 'Cancelled';
  if (m.endStr) return timeRange(m.e.time);
  return m.startStr ? approxMark(m.e, m.startStr) : undefined;
};

// THE LIST (MODEL-V4 §1.2). One `.venue-group` per venue: the venue's own
// stage header, its doors/close line, then the night's cards stacked top to
// bottom in play order. The people filter dims here exactly as it does on
// the clock — renderCard's one rule — and never takes a card or a group away.
//
// `clock` says a timetable sits above these stacks on the same day, so their
// columns line up with its columns (Kevin at Portola, 2026-09-25: "times on
// the left, and the items that don't have them don't line up"): 'room' when
// the stacks are the clock's own room (a cancelled act, a set off the
// columns, a name with no time yet), 'day' when they are another room on that
// day (SAT AFTERS). How far each one moves is v3.css's call.
//
// A clocked row also sits in its own sideways scroller, `.stack-scroll` (v91):
// on a phone the rail's 40px is lead space inside it — the columns start
// where the clock's do and keep their full width, and the lead scrolls away
// under a swipe (Kevin: "a little bit of extra padding that obviously scrolls
// away if you left scroll"). One scroller per room on a day, never per day:
// the room's head between two rooms is a door and stays put. It is not a
// `.times-scroll` on purpose — nothing that mirrors the timetable's position
// may take it for one; its own position survives a repaint by its own key
// (stackRowKey). From 720 up it is an ordinary box (v3.css).
export function venueGroups(root, entries, ctx, { day = null, fest = null, fallbackVenue = null, clock = null } = {}) {
  const grid = mk('div', 'venue-grid');
  if (day && day.iso) grid.dataset.iso = day.iso;
  if (fest && fest.timezone) grid.dataset.tz = fest.timezone;
  if (clock) grid.dataset.clock = clock;
  let shown = 0;
  const groups = venueGroupsOf(entries, { fallbackVenue });
  // Where one room published its doors, the line holds its place across the
  // whole grid — otherwise the stacks in a row start on different lines and
  // the row reads ragged.
  const anySub = groups.some((g) => g.sub);
  for (const g of groups) {
    const group = mk('div', 'venue-group');
    // A venue head IS a stage header — the festival accent's third home.
    const head = stageHead(g.venue);
    head.classList.add('venue');
    group.appendChild(head);
    if (anySub) group.appendChild(mk('div', 'venue-sub', g.sub || ''));
    const stack = mk('div', 'stack');
    for (const m of g.members) {
      const card = renderCard(m.e.name, ctx, { time: stackTime(m), occ: occOf(m.e) });
      // A stack has no clock to draw a line on, so the card of whoever is
      // playing carries the mark instead. The window is the model's
      // (events.js): the ticker only reads it.
      if (m.nowFrom != null && m.nowTo != null) {
        card.dataset.nowFrom = String(m.nowFrom);
        card.dataset.nowTo = String(m.nowTo);
      }
      stack.appendChild(card);
      shown += 1;
    }
    group.appendChild(stack);
    grid.appendChild(group);
  }
  if (!shown) return 0;
  if (clock) {
    // How many columns the row asks for is v3.css's to decide; one venue
    // fits the phone beside the lead space and never scrolls.
    grid.dataset.venues = String(groups.length);
    const row = mk('div', 'stack-scroll');
    row.appendChild(grid);
    root.appendChild(row);
  } else {
    root.appendChild(grid);
  }
  return shown;
}

// The now mark on a stack (MODEL-V4 §1.2) — the now line's twin, same violet,
// same one-minute ticker, no repaint. A card is "now" when the festival's
// clock is inside the window venueGroupsOf gave it. The mark is the ring and
// its glow, and nothing else: the "NOW" tag that sat in the card's corner went
// with the NOW button (Kevin, 2026-09-24: "since we have the now button now I
// don't think we need the now … tags. users can figure out what the highlight
// means from the auto-scroll"). A screen reader still hears it — the card's
// own name ends "playing now" while it is.
export const PLAYING_NOW = ', playing now';
export function positionNowMarks(root, date = new Date()) {
  const here = root.matches && root.matches('.venue-grid[data-iso]') ? [root] : [];
  for (const grid of [...here, ...root.querySelectorAll('.venue-grid[data-iso]')]) {
    const clock = festivalClock(date, grid.dataset.tz || null);
    const today = grid.dataset.iso === clock.iso;
    for (const card of grid.querySelectorAll('.card[data-now-from]')) {
      const from = Number(card.dataset.nowFrom);
      const to = Number(card.dataset.nowTo);
      const on = today && clock.minutes >= from && clock.minutes < to;
      card.classList.toggle('now', on);
      const name = card.getAttribute('aria-label') || '';
      if (on && !name.endsWith(PLAYING_NOW)) card.setAttribute('aria-label', name + PLAYING_NOW);
      else if (!on && name.endsWith(PLAYING_NOW)) card.setAttribute('aria-label', name.slice(0, -PLAYING_NOW.length));
    }
  }
}

// What NOW lands on (Kevin, 2026-09-24: "where is ross likely right now"),
// read off the wall the person is looking at — hidden rooms render nothing,
// so they are never an answer. Null when nothing is live: no now line on a
// grid and no NOW mark on a stack (the NOW tab is absent then).
//   · A highlight (the people filter) → that person's pick that is playing
//     now, a grid cell or a stack card: the highest level first (must), then
//     the most recent start — "where is Ross right now" is the set that just
//     began, not a room live since doors or a set half over (review call,
//     2026-09-24). A grid cell brings its line with it: the answer to
//     "where is Ross" is the line and his card seen together.
//   · Otherwise, or no highlighted pick is live → the now line while the
//     clock is inside the grid's hours; past them (the grid closed, the
//     afters running) the first NOW-marked card in the wall's order; before
//     doors, with nothing marked, the line at the top of the grid. The
//     highlight keeps dimming the rest either way.
// { kind: 'line' | 'card', line, card, match }. `match` says whether the
// landing answers the highlight: true — it is their pick; false — someone is
// highlighted and nothing of theirs is on, so this is what IS on, not them
// (the app must not pulse it as though it were: a dimmed card pulsing read
// as "Ross is here", review 2026-09-24); null — nobody is highlighted.
// What is live on the wall, read once for nowLanding and nowStops alike: the
// now lines (with whether the clock is inside their grid's own hours), the
// stack cards wearing the mark, and — with a highlight — the highlighted
// people's live picks, best first.
function liveOnWall(root, ctx, date) {
  const lines = [...root.querySelectorAll('.times-grid .now-line')].map((line) => {
    const grid = line.closest('.times-grid');
    const { minutes } = festivalClock(date, grid.dataset.tz || null);
    // The line is an answer only while the clock is inside the grid's own
    // hours. nowOffsetPx keeps it drawn two rows either side, pinned to the
    // edge — fine to look at, but from 11:00 to 11:30 PM it sat on the bottom
    // of a closed Pier 80 while eight afters were on (review, 2026-09-24).
    // Past the grid, the marks win when there are any; before doors there are
    // none, and the top of the grid is the honest answer.
    const onGrid = Number(grid.dataset.startRow) * 15 <= minutes
      && minutes < (Number(grid.dataset.startRow) + Number(grid.dataset.rows)) * 15;
    return { line, grid, minutes, onGrid };
  });
  const marks = [...root.querySelectorAll('.venue-grid[data-iso] .card.now')];
  const people = ctx.filterPeople || [];
  let picks = [];
  if (people.length) {
    const live = [...marks];
    for (const { grid, minutes } of lines) {
      for (const cell of grid.querySelectorAll('.card[data-now-from]')) {
        if (Number(cell.dataset.nowFrom) <= minutes && minutes < Number(cell.dataset.nowTo)) live.push(cell);
      }
    }
    const level = (card) => Math.max(0, ...people.map((p) => (((ctx.picks || {})[card.dataset.artist] || {})[p]) || 0));
    picks = live.filter((c) => !c.classList.contains('dim') && level(c) > 0)
      .sort((a, b) => level(b) - level(a) || Number(b.dataset.nowFrom) - Number(a.dataset.nowFrom));
  }
  return { lines, marks, people, picks };
}
const lineOf = (lines, card) => (lines.find((l) => l.grid.contains(card)) || {}).line || null;

export function nowLanding(root, ctx, date = new Date()) {
  const { lines, marks, people, picks } = liveOnWall(root, ctx, date);
  if (!lines.length && !marks.length) return null;
  if (picks.length) return { kind: 'card', card: picks[0], line: lineOf(lines, picks[0]), match: true };
  const match = people.length ? false : null;
  const first = lines[0];
  if (first && (first.onGrid || !marks.length)) return { kind: 'line', line: first.line, card: null, match };
  return { kind: 'card', card: marks[0], line: null, match };
}

// ---- NOW, tap after tap (Kevin, 2026-09-24) --------------------------------------
// "multiple taps on that scroll should move the user to the next now item if
// there are multiple at different heights on the page. if filtered to a person
// it should only go to nows for that person. if there's no now pick for that
// person normal now behavior … by height because if items are side by side
// multiple now clicks won't scroll that that'll be weird."
//
// The STOPS a NOW tap can take you to, top to bottom, read off the wall as it
// is at the tap (never a list kept from the last one — the ticker and a
// repaint move things between taps):
//   · a highlight with live picks → those picks only: a grid cell with its
//     grid's line, a stack card on its own;
//   · otherwise (nobody highlighted, or a highlight with nothing on) → every
//     live thing: each now line while the clock is inside its grid's hours
//     (before doors, with nothing marked, the line anyway — nowLanding's own
//     rule), and every stack card wearing the mark. Hidden rooms render
//     nothing, so they are never stops.
// Each is landed exactly as the first tap lands it (landingTarget). Then BY
// HEIGHT: going down the page, a candidate that a stop already shows — inside
// the band a person can see, 8px in from the sticky chrome and the dock —
// joins that stop instead of making one, so no tap ever scrolls to where you
// already are: side-by-side cards, a row of afters under the line fold into
// one. AND ACROSS, for grid cells: a grid scrolls sideways on a phone, so
// "side by side" can mean off screen. A stop frames its cells in one sideways
// slide; a cell that does not fit that frame beside them (Nhu's DJ Shadow in
// column 2 and Despacio in column 5 at 390 — review, 2026-09-24) is its own
// stop at the same height, reached by the slide alone. So every live pick is
// reachable by tapping, and every tap still moves something into view. Stops
// run top to bottom, then left to right within a height. The first stop that
// contains nowLanding's answer is `bestAt`. With nobody highlighted the line
// is one stop, whatever the columns: it crosses them all.
//
// `geo` is the page's geometry, handed in so the rule is testable without a
// layout engine: { scrollY, maxY, box(el) → viewport rect, band(grid|null) →
// { top, bottom } of what can be seen (under a grid's pinned stage strip for a
// grid, under the sticky chrome otherwise; above the dock on a phone),
// scroller(cell) → { el, x, left, width, max } of the grid's own sideways
// scroll (its viewport x, scrollLeft, clientWidth, and the most it scrolls) }.
export const NOW_PAD = 8;
export function landingTarget(m, geo) {
  const pad = NOW_PAD;
  let dy;
  if (m.line) {
    const band = geo.band(m.line.closest('.times-grid'));
    const h = band.bottom - band.top;
    const lineTop = geo.box(m.line).top;
    dy = lineTop - (band.top + h / 3);
    if (m.card) {
      const cardTop = geo.box(m.card).top;
      // The card's top on screen too — when the two fit: the line no lower
      // than two-thirds of the way down. A set too tall for that (Despacio's
      // hours on a 320x568 phone) keeps the line a third of the way down, the
      // rule everywhere else (review, 2026-09-24).
      if (lineTop - cardTop <= h * (2 / 3) && cardTop - dy < band.top + pad) dy = cardTop - (band.top + pad);
      if (lineTop - dy > band.bottom - pad) dy = lineTop - (band.bottom - pad);
    }
  } else {
    const band = geo.band(null);
    const h = band.bottom - band.top;
    const r = geo.box(m.card);
    dy = r.top - (band.top + h / 4);
    if (r.bottom - dy > band.bottom - pad && r.bottom - r.top < h - 2 * pad) dy = r.bottom - (band.bottom - pad);
  }
  return Math.min(geo.maxY, Math.max(0, geo.scrollY + dy));
}
// Whether a landing at `target` already shows m: a line (a cell's included —
// the line is what says it is playing) anywhere in its band; a card from its
// top down, as much of it as a band can hold.
function showsAt(m, target, geo) {
  const pad = NOW_PAD;
  const shift = target - geo.scrollY;
  if (m.line) {
    const band = geo.band(m.line.closest('.times-grid'));
    const y = geo.box(m.line).top - shift;
    return y >= band.top + pad - 1 && y <= band.bottom - pad + 1;
  }
  const band = geo.band(null);
  const r = geo.box(m.card);
  const top = r.top - shift;
  const bottom = Math.min(r.bottom, r.top + (band.bottom - band.top) - 2 * pad) - shift;
  return top >= band.top + pad - 1 && bottom <= band.bottom - pad + 1;
}
const keyOf = (m) => (m.card
  ? `${m.line ? 'cell' : 'card'}:${m.card.dataset.artist}|${m.card.dataset.occ || ''}|${roomOf(m.card) || ''}`
  : `line:${m.line.closest('.times-grid').dataset.iso || ''}`);

// A grid cell's place in its grid's sideways scroll, in the scroll's own
// coordinates (so it does not depend on where the grid happens to sit).
// `iso` names the grid by its day — the one identity of a grid that survives
// a repaint (see stillThere).
function spanIn(m, geo) {
  if (!m.card || !m.line || !geo.scroller) return null;
  const sc = geo.scroller(m.card);
  if (!sc) return null;
  const r = geo.box(m.card);
  const lo = r.left - sc.x + sc.left;
  return { sc, lo, hi: lo + (r.right - r.left), iso: m.line.closest('.times-grid').dataset.iso || null };
}
// The one sideways slide that frames a stop's cells: their middle in the
// middle, as far as the grid scrolls.
export function frameSlide(frame) {
  const { sc, lo, hi } = frame;
  return Math.min(sc.max, Math.max(0, (lo + hi) / 2 - sc.width / 2));
}
export function nowStops(root, ctx, date, geo) {
  const best = nowLanding(root, ctx, date);
  if (!best) return null;
  const { lines, marks, picks } = liveOnWall(root, ctx, date);
  // One show, one member: a show billed to two rooms ("Afters & Folsom" —
  // Horse Meat Disco, Friday) renders a card in each, byte-identical in
  // data-occ, and the cycle landed on it twice (the phone walk, 2026-09-24).
  // The first in wall order stands for it — the one nowLanding would answer
  // with; the other still shows wherever its room is on screen.
  const shows = new Set();
  const once = (card) => {
    const show = `${card.dataset.artist}|${card.dataset.occ || ''}`;
    return shows.has(show) ? false : (shows.add(show), true);
  };
  const members = best.match === true
    ? picks.filter(once).map((card) => ({ card, line: lineOf(lines, card) }))
    : [
      ...lines.filter((l) => l.onGrid || !marks.length).map((l) => ({ card: null, line: l.line })),
      ...marks.filter(once).map((card) => ({ card, line: null })),
    ];
  for (const m of members) {
    m.key = keyOf(m);
    m.target = landingTarget(m, geo);
    m.span = spanIn(m, geo);
    m.x = m.span ? m.span.lo : geo.box(m.card || m.line).left;
  }
  members.sort((a, b) => a.target - b.target || a.x - b.x);
  // Room across: a frame holds its cells side by side with 8px either side.
  const fits = (frame, span) => !frame || (frame.sc.el === span.sc.el
    && Math.max(frame.hi, span.hi) - Math.min(frame.lo, span.lo) <= span.sc.width - 2 * NOW_PAD);
  const stops = [];
  for (const m of members) {
    const home = stops.find((st) => showsAt(m, st.target, geo) && (!m.span || fits(st.frame, m.span)));
    if (home) {
      home.members.push(m);
      if (m.span) home.frame = home.frame ? { ...home.frame, lo: Math.min(home.frame.lo, m.span.lo), hi: Math.max(home.frame.hi, m.span.hi) } : { ...m.span };
      continue;
    }
    // A stop of its own. Where a stop already shows it at that height and
    // only its column is out of frame, it lands at the same height — the
    // tap's move is the sideways slide.
    const beside = m.span ? stops.find((st) => showsAt(m, st.target, geo)) : null;
    stops.push({ target: beside ? beside.target : m.target, members: [m], frame: m.span ? { ...m.span } : null });
  }
  for (const st of stops) {
    st.keys = st.members.map((m) => m.key);
    st.x = Math.min(...st.members.map((m) => m.x));
    st.slide = st.frame ? frameSlide(st.frame) : null;
  }
  stops.sort((a, b) => a.target - b.target || a.x - b.x);
  const bestKey = keyOf(best);
  const bestAt = Math.max(0, stops.findIndex((st) => st.keys.includes(bestKey)));
  return { best: { ...best, key: bestKey, target: landingTarget(best, geo) }, stops, bestAt };
}

// What NOW may pulse at this moment, by the rule that chose it (the app pulses
// only when the glide lands, and the wall can change under a glide — the 25 s
// poll, a pick, the highlight, the clock): with a live match, the highlighted
// people's live picks as they stand now; with nobody highlighted, the NOW
// cards; with no match, nothing. A repaint mid-glide that dropped Ross's pick
// used to pulse the fresh, dimmed card anyway — "Ross is here" on a card he
// had just left (Codex, 2026-09-24).
export function nowPulseable(root, ctx, date, match) {
  const { marks, people, picks } = liveOnWall(root, ctx, date);
  if (match === true) return picks;
  if (match === null && !people.length) return marks;
  return [];
}

// What a NOW landing says to a screen reader (the app puts it in the page's
// polite status region; focus stays on NOW). Sighted people see where the
// page went; this says it: the line's time and what crosses it, the cards by
// name and where they are ("Milli Meng at Public Works" — the answer to
// "where is Ross"), and which stop of how many, so a repeat tap has somewhere
// to go. "Now, 10:30 PM. Playing now: Soulwax at Crane Stage and Prospa at
// Warehouse. 1 of 5." A card's place is its occurrence's venue (a stack) or
// stage (the grid); one show named once, even where it renders in two rooms.
export function nowSaid(plan, stop) {
  const names = [];
  const add = (card) => {
    let occ = null;
    try { occ = card.dataset.occ ? JSON.parse(card.dataset.occ) : null; } catch { occ = null; }
    const where = occ && (occ.venue || occ.stage);
    const name = where ? `${card.dataset.artist} at ${where}` : card.dataset.artist;
    if (!names.includes(name)) names.push(name);
  };
  let time = null;
  for (const m of stop.members) {
    if (m.card) { add(m.card); continue; }
    const minutes = Number(m.line.dataset.minutes);
    if (!Number.isFinite(minutes)) continue;
    time = time || clockLabel(minutes);
    for (const cell of m.line.closest('.times-grid').querySelectorAll('.card[data-now-from]')) {
      if (Number(cell.dataset.nowFrom) <= minutes && minutes < Number(cell.dataset.nowTo)) add(cell);
    }
  }
  const list = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const parts = [];
  if (time) parts.push(`Now, ${time}.`);
  if (names.length) parts.push(`Playing now: ${list}.`);
  const n = plan.stops.length;
  if (n > 1) parts.push(`${plan.stops.indexOf(stop) + 1} of ${n}.`);
  return parts.join(' ');
}

// ---- the next tap ------------------------------------------------------------------
// Where the last NOW tap left the page, for the next one — the app keeps it as
// `cycle`: { lead, y, grid, sl, until } — the lead key of the stop it went to,
// the scroll it landed at, the day (`data-iso`) of the grid it slid and that
// grid's sideways scroll after the slide (grid null when it slid none), and
// until when (on geo.now's clock) a glide was still on its way there.
//
// The page still sits where the last NOW left it while that glide runs, or
// while the page is within 4px of y and — if a grid slid — that grid within
// 4px of sl. The grid is named by its DAY, never held as a node: a repaint
// (the 25 s poll, a pick, a highlight) replaces every scroller, and a held
// node, once detached, went on reading "unchanged" — so after one repaint a
// sideways hand scroll no longer made the next tap fresh (Codex, 2026-09-24).
// A repaint puts the sideways scroll back (restoreEphemera), so a page
// nobody moved keeps its cycle through one; a grid that is gone (its day
// hidden) ends it.
//
// geo adds two readings to nowStops' own: now (the clock `until` is on) and
// gridLeft(iso) → that day's grid's sideways scroll, or null with no such grid.
export function stillThere(cycle, geo) {
  if (!cycle) return false;
  if (geo.now < cycle.until) return true;
  if (Math.abs(geo.scrollY - cycle.y) > 4) return false;
  if (cycle.grid == null) return true;
  const left = geo.gridLeft(cycle.grid);
  return left != null && Math.abs(left - cycle.sl) <= 4;
}
// The tap itself: the stop it goes to, the member it leads with, and the
// scroll it lands at. Still there, and the last stop is still live → the next
// stop, wrapping after the last; anything else is a fresh "take me to now" —
// the best answer's stop. A stop lands the same way every time it is reached
// (its own landing, which shows every member — that is what made them one
// stop); its lead is the answer when the stop holds it — the column a grid
// slides to, the key the next tap starts from — else its top member.
//
// The one stop, tapped again, stays where the last tap left it — while that
// landing still shows it (every member, by showsAt). The clock moves a stop
// without moving the page: tap at 3 PM, tap again at 7 PM, and the line has
// walked four hours down the grid (at 320x568, 198px → 582px, under the dock
// at 523). The page is exactly where NOW left it, so this was "still there",
// and the old landing stood with the line off screen (Codex, 2026-09-24).
// Now it lands afresh — the stop's own landing, as its first tap would.
export function nowStep(plan, cycle, geo) {
  const { best, stops, bestAt } = plan;
  let at = -1;
  if (stillThere(cycle, geo)) {
    const was = stops.findIndex((st) => st.keys.includes(cycle.lead));
    if (was >= 0) at = (was + 1) % stops.length;
  }
  const fresh = at < 0;
  if (fresh) at = bestAt;
  const stop = stops[at];
  const lead = stop.keys.includes(best.key) ? best : stop.members[0];
  const stays = !fresh && stops.length === 1 && stop.members.every((m) => showsAt(m, cycle.y, geo));
  return { fresh, at, stop, lead, target: stays ? cycle.y : stop.target };
}

// One room on a date: its head and body travel together, tagged with the key
// the show menu hides it by (app.js animates the fold).
function roomBlock(key) {
  const room = mk('div', 'room');
  room.dataset.room = key;
  return room;
}

// The festival's own room says where it is: "SAT PORTOLA  Pier 80" — the
// venue festPlaceLine leads with, as text.
function festRoomSub(fest) {
  const venue = (fest.subtitle || '').split(' · ')[0].trim();
  return venue || fest.location || '';
}

// THE head every room on the wall wears — one line that names when, then what
// (Kevin, 2026-09-23: "combine the double lines (for day and then event) into
// one line each like 'Sat Portola' 'Sat Afters'"). Before it, a day was two
// kinds of line stacked — a day rule, then a header per room — and Portola's
// Thursday took two lines to say one thing.
//
//   .room-head   > .name (.wd "SAT" + " " + .label "PORTOLA") · .sub · .line
//
// The sub is the room's own ("Pier 80"), led by the date only on a day's FIRST
// head — whichever room renders first, so hiding the festival hands the date
// to SAT AFTERS (renderComposed decides it, per render). A head that opens a
// thread is a button — that is where its 44px floor comes from — and the
// thread is where you are standing (MODEL-V4 §3a.3); a head that opens nothing
// is a div with the same look. It never folds its room (§3a.2): no chevron,
// no aria-expanded, no "<n> shows" — the show menu is the one way to hide a
// part of the week, and a hidden room never gets here.
function roomHead({ weekday = null, label, sub = '', onOpen = null, aria = null }) {
  const h = mk(onOpen ? 'button' : 'div', 'room-head');
  const name = mk('span', 'name');
  if (weekday) name.append(mk('span', 'wd', weekday), ' ');
  name.append(mk('span', 'label', String(label).toUpperCase()));
  h.append(name, mk('span', 'sub', sub || ''), mk('span', 'line'));
  if (onOpen) {
    h.type = 'button';
    h.setAttribute('aria-label', `Notes for ${aria || label}`);
    h.addEventListener('click', onOpen);
  }
  return h;
}
const joinSub = (...parts) => parts.filter(Boolean).join(' · ');

// The weekday a day's heads lead with: `SAT`. A day whose key names no weekday
// and whose file gives none (a bare "Day 1") says its own label instead — the
// head never guesses a weekday.
const headWeekday = (day) => (day.wd ? day.wd : dayLabelParts(day.dayKey).head).toUpperCase();

// The door to a DATE's notes, called what the axis calls that date: its own
// head, unless two dates would answer to it (a two-weekend fest's two
// Fridays), in which case the date says itself. One naming rule, decided once
// in the shell, so the door, the sheet's title and the sheet's row can never
// disagree. No date, no door: a label is not a date.
function dateDoor(ctx, iso, fallback = null) {
  if (!iso || !ctx.onOpenDayNotes) return null;
  const label = dayTargetLabel(ctx, iso, fallback);
  return { onOpen: () => ctx.onOpenDayNotes(iso, label), aria: label };
}

// A set whose stage is not one of the grid's columns is still the festival's
// — it goes in the festival's room as a card under its own place, never in a
// reserved column (Kevin, Electric Forest, 2026-09-02).
function straysOf(fest, day, weekend, stages) {
  return state.getDayArtists(day, weekend)
    // A computed set knows its stage and its clock but not its day key — the
    // occurrence needs both, or the zoom tells another card's story.
    .filter((a) => stages.indexOf(a.stage) === -1)
    .map((a) => ({ ...a, day, venue: a.stage || null }));
}
// The festival's activities (yoga, a workshop, the Brainery) are cards like
// any other now — one venue group per place, in the order venueGroupsOf puts
// them, which is the same clock every other card reads.
function activitiesOf(fest, day) {
  return ((fest.activities || {})[day] || [])
    .map((a) => ({ name: a.name, day, venue: a.venue || null, time: a.time || null }));
}

// Everything of the festival's that is not on this day's grid.
function festRoomExtras(fest, day, layout) {
  const onGrid = new Set(state.getDayArtists(day.dayKey, day.weekend).map((a) => a.name));
  const billed = dedupeByCard(applyWeekend(day.billing || [], day.weekend)).filter((a) => !onGrid.has(a.name));
  return [...straysOf(fest, day.dayKey, day.weekend, layout.stages), ...billed, ...activitiesOf(fest, day.dayKey)];
}

// The plan already holds only what is visible (wallPlanFor applies the fold):
// every day here has something to show, every section and extra here is on.
function renderComposed(root, ctx, fest, { model: plan, scheduled, festRoom }) {
  const layout = scheduled ? computeTimesLayout(fest) : null;

  // A lineup wall's day-less block (THE LINEUP) leads, as it always has.
  if (!scheduled && plan.looseNoDay.length) renderLineupGroup(root, '', plan.looseNoDay, ctx, fest);

  for (const day of plan.days) {
    const block = dayBlock(day.key, day.iso);
    const weekday = headWeekday(day);
    // Whether this day drew a clock (the festival's timetable): every stack
    // under it lines up with its columns. A hidden festival room, or a grid
    // day with no set times yet, has none.
    let clocked = false;
    // The date rides the day's FIRST head and no other, whichever room that
    // turns out to be — so it is spent by the first head made, never assigned
    // to a room by name.
    let when = day.when;
    const head = (label, ownSub, door) => {
      const h = roomHead({ weekday, label, sub: joinSub(when, ownSub), ...(door || {}) });
      when = '';
      return h;
    };
    // 1. the festival's own room: its timetable on a grid day, then anything
    //    of the festival's that is not on that grid; a lineup day's billing
    //    has no venue and no clock, so it stays the day's card grid. On a
    //    date, its head IS the door to that date's notes — the bare ISO, the
    //    thread the day line used to open: on a Portola Saturday the date and
    //    the festival's day are the same thing (spec 2026-09-23).
    if (festRoom && (day.grid || day.billing)) {
      const room = roomBlock(FEST_ROOM);
      const door = dateDoor(ctx, day.iso, dayLabelParts(day.dayKey).head);
      room.appendChild(head(fest.name, festRoomSub(fest), door));
      if (door) dayNoteWhisper(room, day.iso, door.aria, ctx);
      if (day.grid) {
        const extras = festRoomExtras(fest, day, layout);
        clocked = renderScheduledDayBody(room, day.dayKey, ctx, layout, day.weekend, { strip: true });
        if (extras.length) venueGroups(room, extras, ctx, { day, fest, fallbackVenue: festRoomSub(fest), clock: clocked ? 'room' : null });
      } else {
        renderCardGrid(room, day.billing, ctx, { day: day.dayKey });
      }
      block.appendChild(room);
    }
    // 2. each section that plays that night. Its head on THIS day is the door
    //    to that night's thread (§3a.3): Folsom on Friday, not Folsom, and not
    //    Friday — even when it is the day's first head and carries the date. A
    //    date with no festival room (Portola's Thursday) has no bare-date door;
    //    a note already written there is still in the all-notes sheet.
    for (const sec of plan.sections) {
      const list = sec.byDay.get(day.key);
      if (!list) continue;
      const room = roomBlock(sec.key);
      const target = day.iso && ctx.onOpenDayNotes ? model.sectionDateKey(day.iso, sec.key) : null;
      const label = target ? dayTargetLabel(ctx, target, dayLabelParts(day.dayKey).head) : null;
      room.appendChild(head(sec.label, sectionSub(fest, sec), target ? { onOpen: () => ctx.onOpenDayNotes(target, label), aria: label } : null));
      if (target) dayNoteWhisper(room, target, label, ctx);
      venueGroups(room, list, ctx, { day, fest, clock: clocked ? 'day' : null });
      block.appendChild(room);
    }
    root.appendChild(block);
  }

  // The tabs that hang off the end: a dated section (ACL's Late nights), and
  // any section whose entries never said which night.
  for (const extra of plan.extras) renderExtra(root, ctx, fest, extra);

  if (nothingVisible({ model: plan })) allHiddenNotice(root, fest);

  // A scheduled fest's day-less names that sit on no grid.
  if (scheduled && plan.looseNoDay.length) {
    const onAnyGrid = new Set();
    for (const d of plan.days) if (d.grid) for (const a of state.getDayArtists(d.dayKey, d.weekend)) onAnyGrid.add(a.name);
    const loose = dedupeByCard(plan.looseNoDay.filter((a) => !onAnyGrid.has(a.name)));
    if (loose.length) renderLineupGroup(root, '', loose, ctx, fest, { header: 'EVERYTHING ELSE', sub: 'NO SET TIME YET' });
  }
  festNotesFoot(root, ctx, fest);
  wireTimesScrollSync(root);
  positionNowMarks(root, ctx.now || new Date());
}

// The newest note on a day target, pinned directly under the head that opens
// it. Every day note the wall opens is keyed by where you were standing
// (MODEL-V4 §4, §3a.3) — the DATE under the festival's head on that date (or a
// dated section's head on its date), `<iso>|<section>` under a section's head
// on that day — so the wall is the one place a key is chosen. A note written
// under the old weekday label still belongs to the date's conversation;
// mapping it on the way in is the notes layer's job (notes.js, model.js).
function dayNoteWhisper(root, target, label, ctx) {
  if (!ctx.onOpenDayNotes) return;
  const w = dayWhisper(target, label, ctx, () => ctx.onOpenDayNotes(target, label));
  if (w) root.appendChild(w);
}

// A section's own sub line, when the file gives it one.
function sectionSub(fest, sec) {
  const meta = (fest.dayMeta || {})[sec.key] || {};
  return meta.sub || '';
}

// A tab off the end of the week (MODEL-V4 §2), in the block the tab lands on.
// A dated section (ACL's Late nights) is a room ON each of its dates — one
// head per date, `TUE LATE NIGHTS  Sep 29 · around Austin`, each the first
// head of its date and the door to that date's notes (the bare ISO, as the
// date rule it replaced) — so the tab lands on its first date. The section
// itself has no head: its label is not a note target, and a head over the
// heads was the second line this change exists to remove. A section whose
// entries never said when is one room under a head with no weekday: it has no
// day to name.
function renderExtra(root, ctx, fest, extra) {
  const block = dayBlock(extra.key);
  const ownSub = sectionSub(fest, extra);
  if (!extra.byDate) {
    const room = roomBlock(extra.key);
    room.appendChild(roomHead({ label: extra.label, sub: ownSub }));
    venueGroups(room, extra.entries || [], ctx, { fest });
    block.appendChild(room);
  } else {
    for (const [iso, list] of extra.byDate) {
      const room = roomBlock(extra.key);
      room.dataset.iso = iso; // the day-of open lands here when tonight is one of these dates
      const door = dateDoor(ctx, iso);
      const wd = weekdayOfIso(iso);
      room.appendChild(roomHead({ weekday: wd ? wd.toUpperCase() : null, label: extra.label, sub: joinSub(shortDate(iso), ownSub), ...(door || {}) }));
      if (door) dayNoteWhisper(room, iso, door.aria, ctx);
      venueGroups(room, list, ctx, { day: { iso }, fest });
      block.appendChild(room);
    }
  }
  root.appendChild(block);
}

// ---- the wall ------------------------------------------------------------------
// The repaint boundary preserves ephemeral client state (audit Class 1): a
// remote sync tearing down #wall-root must never cost the user their scroll
// position or a half-typed note. Harvest before teardown, restore after.
// A stack row's sideways position belongs to that row alone — no other
// scroller shares it — so it is kept by where the row stands: its day, its
// room, and which of that room's rows it is.
function stackRowKey(row) {
  const room = row.closest('.room');
  const rows = room ? [...room.querySelectorAll('.stack-scroll')] : [row];
  const day = row.closest('.day-block');
  return `${day ? day.dataset.day : ''}|${room ? room.dataset.room : ''}|${rows.indexOf(row)}`;
}

function harvestEphemera(root) {
  const scrolls = new Map();
  // Every timetable scroller mirrors one shared position within its sync
  // group (the grid-only wall is one group) — harvest one per group.
  for (const s of root.querySelectorAll('.times-scroll')) {
    const key = s.dataset.sync || '*';
    if (!scrolls.has(key) && s.scrollLeft) scrolls.set(key, s.scrollLeft);
  }
  // A crew-mate's pick repaints the wall; a phone that had swiped SAT AFTERS
  // sideways must not have it snap back under its thumb.
  const rows = new Map();
  for (const s of root.querySelectorAll('.stack-scroll')) {
    if (s.scrollLeft) rows.set(stackRowKey(s), s.scrollLeft);
  }
  const drafts = new Map();
  for (const input of root.querySelectorAll('.composer input[data-draft-key]')) {
    if (input.value) {
      drafts.set(input.dataset.draftKey, {
        value: input.value,
        focused: document.activeElement === input,
        caret: input.selectionStart,
      });
    }
  }
  return { scrolls, rows, drafts };
}

function restoreEphemera(root, { scrolls, rows, drafts }) {
  for (const s of root.querySelectorAll('.times-scroll')) {
    if (isStripScroller(s)) continue; // the strip follows its grid; it is never scrolled itself
    const left = scrolls.get(s.dataset.sync || '*');
    if (left) s.scrollLeft = left;
  }
  for (const s of root.querySelectorAll('.stack-scroll')) {
    const left = rows.get(stackRowKey(s));
    if (left) s.scrollLeft = left;
  }
  for (const input of root.querySelectorAll('.composer input[data-draft-key]')) {
    const d = drafts.get(input.dataset.draftKey);
    if (!d) continue;
    input.value = d.value;
    if (d.focused) {
      input.focus();
      try { input.setSelectionRange(d.caret, d.caret); } catch { /* type quirks */ }
    }
  }
}

export function renderWall(root, ctx) {
  const ephemera = harvestEphemera(root);
  for (const undo of teardowns.get(root) || []) undo();
  teardowns.delete(root);
  renderWallInner(root, ctx);
  restoreEphemera(root, ephemera);
  sweepFit(); // the cards this render replaced stop being watched
}

function renderWallInner(root, ctx) {
  root.textContent = '';
  const fest = state.fest();
  const scheduled = fest.days && Object.keys(fest.days).length;

  // The composed wall (MODEL-V4, 2026-09-16): a week of days, each holding
  // its rooms. One path for every fest that has days at all — a search and a
  // flat sort are lists of answers and take the paths below.
  if (!ctx.query) {
    const plan = wallPlanFor(fest, ctx);
    if (plan) { renderComposed(root, ctx, fest, plan); return; }
  }

  // Searching a scheduled fest must still answer "where and when" (CORE-4) —
  // and WHICH NIGHT, so a search is the wall's own week with everything that
  // does not match taken out. The same dated day axis the wall and the tabs
  // walk: a two-weekend fest is six days, so a Weekend 2 headliner answers
  // under the Friday they play (it used to ask a weekend preference that had
  // no selector left, default to W1, and say "No artists match"), and a room's
  // show answers under its night rather than under its section's name, which
  // is not a place any more (MODEL-V4 §2).
  if (scheduled) {
    // Every name that matches answers; the people filter dims the answers
    // the selected people did not pick (renderCard), the same as on the wall.
    // The same folded match as a lineup fest's search (searchMatches).
    const wanted = (name) => searchMatches(name, ctx.query);
    const plan = wallPlanFor(fest, ctx);
    // A search is a LIST: each answer group is a list head over a card grid,
    // and a day's groups sit in the block its tab lands on (dayBlock).
    const answers = (host, cards, label, sub) => {
      if (!cards.length) return false;
      host.appendChild(listHead(label, sub));
      const grid = mk('div', 'wall-grid');
      for (const c of cards) grid.appendChild(c);
      host.appendChild(grid);
      return true;
    };
    const answered = (block, hit) => { if (hit) root.appendChild(block); return hit; };
    let any = false;
    // The plan is the visible week (wallPlanFor applies the fold), so a
    // hidden part never answers a search either.
    for (const day of (plan ? plan.model.days : [])) {
      const cards = [];
      const onGrid = new Set();
      if (day.grid && plan.festRoom) {
        const computed = state.getDayArtists(day.dayKey, day.weekend);
        computed.forEach((a) => onGrid.add(a.name));
        for (const a of computed.filter((a) => wanted(a.name)).sort((x, y) => x.startMin - y.startMin)) {
          cards.push(renderCard(a.name, ctx, { time: `${a.stage} · ${a.startStr}`, occ: { day: day.dayKey, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null } }));
        }
      }
      // Then everything else of that night's, in the wall's order: the names
      // billed on the day with no set on its grid, then each room that plays.
      // One pass over both, deduped by the occurrence the card will carry: a
      // combined-day show is one entry reached through two rooms and answers
      // once, while two rooms on one night are two shows and answer twice.
      const billed = plan.festRoom ? applyWeekend(day.billing || [], day.weekend).filter((a) => !onGrid.has(a.name)) : [];
      const rooms = plan.model.sections.flatMap((s) => s.byDay.get(day.key) || []);
      const occHere = (a) => ({ ...occOf(a), day: a.day || day.dayKey });
      for (const a of dedupeByCard([...billed, ...rooms].filter((a) => wanted(a.name)), occHere)) {
        cards.push(renderCard(a.name, ctx, { time: lineupSubLabel(a), occ: occHere(a) }));
      }
      const block = dayBlock(day.key);
      any = answered(block, answers(block, cards, dayLabelParts(day.dayKey).head, day.sub)) || any;
    }
    // A dated section's answers sit under their dates too — the date leads and
    // the section is the aside, because days are the days. They are all the
    // one tab, so they share its one block, and a jump lands on the first date
    // that answered.
    for (const extra of (plan ? plan.model.extras : [])) {
      const block = dayBlock(extra.key);
      let hit = false;
      for (const [iso, list] of (extra.byDate || new Map([[null, extra.entries || []]]))) {
        const cards = list.filter((a) => wanted(a.name))
          .map((a) => renderCard(a.name, ctx, { time: lineupSubLabel(a), occ: occOf(a) }));
        hit = answers(block, cards, iso ? dateRuleLabel(iso) : extra.label,
          iso ? extra.label.toUpperCase() : (extra.sub || '')) || hit;
      }
      any = answered(block, hit) || any;
    }
    // Names the festival bills on no day at all — not a tab, so no block.
    if (plan) {
      const onAnyGrid = new Set();
      for (const d of plan.model.days) if (d.grid) for (const a of state.getDayArtists(d.dayKey, d.weekend)) onAnyGrid.add(a.name);
      const loose = dedupeByCard(plan.model.looseNoDay.filter((a) => !onAnyGrid.has(a.name) && wanted(a.name)));
      any = answers(root, loose.map((a) => renderCard(a.name, ctx, { time: lineupSubLabel(a), occ: occOf(a) })),
        'EVERYTHING ELSE', 'NO SET TIME YET') || any;
    }
    // Nothing answered because nothing is SHOWN: say that, not "no match" —
    // the artist is hidden, not missing.
    if (!any && nothingVisible(plan)) allHiddenNotice(root, fest);
    else if (!any) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 30px 0;';
      empty.textContent = 'No artists match — try fewer letters.';
      root.appendChild(empty);
    }
    return;
  }

  const artists = applySort(applyFilter(applyWeekend(fest.artists || [], ctx.weekend), ctx.query), ctx.sort, ctx);

  if (!artists.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 30px 0;';
    empty.textContent = ctx.query ? 'No artists match — try fewer letters.' : 'Lineup coming soon — notes work now.';
    root.appendChild(empty);
    if (ctx.query) return;
    festNotesFoot(root, ctx, fest, { invite: true });
    return;
  }

  const grouped = ctx.sort === 'billing' || ctx.sort === 'day'
    ? groupByDay(artists, knownDaysOf(fest))
    : new Map([['', artists]]);
  for (const [day, list] of grouped) renderLineupGroup(root, day, list, ctx, fest);

  festNotesFoot(root, ctx, fest);
}

// Fest-wide notes close the wall (21c bottom) — as the whisper once anyone
// has written. On a lineup-less fest (when planning notes matter MOST,
// CORE-10) a quiet add-first door keeps the invitation alive.
function festNotesFoot(root, ctx, fest, { invite = false } = {}) {
  if (!ctx.onOpenFestNotes) return;
  const has = model.noteCount(state.crewDoc, ctx.fid, 'fest', null) > 0;
  if (!has && !invite) return;
  root.appendChild(listHead(`NOTES · ${fest.name.toUpperCase()}`, ''));
  const w = festWhisper(ctx, () => ctx.onOpenFestNotes());
  if (w) { root.appendChild(w); return; }
  const add = document.createElement('button');
  add.className = 'btn-ghost add-first-note';
  add.style.cssText = 'font-size: 12px; padding: 9px 14px;';
  add.textContent = '+ Add a note';
  add.addEventListener('click', () => ctx.onOpenFestNotes());
  root.appendChild(add);
}

let toastTimer = null;

// A toast with no action — for states the user can't undo (migration gate,
// offline explanations). Never render a button that does nothing (CORE-17).
export function showToast(container, message, ms = 4000) {
  container.textContent = '';
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);
  container.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { container.textContent = ''; }, ms);
}

// ---- action toast: a line and one button ---------------------------------------
// "Welcome back — Not me" rides it. (The must-cleared undo toast it was built
// for was dropped on 2026-09-25, Kevin: "unnecessary".) A toast always goes
// away on its own — a notice that must
// outlive the glance is a strip, not a toast (see the new-build strip in
// app.js).
export function showActionToast(container, message, label, onAction, ms = 5000) {
  container.textContent = '';
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  const msg = document.createElement('span');
  msg.textContent = message;
  const btn = document.createElement('button');
  btn.className = 'undo-btn';
  btn.textContent = label;
  btn.addEventListener('click', () => { clearTimeout(toastTimer); container.textContent = ''; onAction(); });
  toast.append(msg, btn);
  container.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { container.textContent = ''; }, ms);
}

// ---- day-nav scrollspy ------------------------------------------------------------
// Where a day tab lands: its day's block (dayBlock) — on the wall, in a
// search, and for a tab off the end of the week alike. Never a grid scroller,
// which carries data-day to name its own day.
export const DAY_ANCHOR = '.day-block[data-day]';
// How far below --jump-offset a day's block may sit and still be the day you
// are standing in. A jump lands its block AT the offset on Chromium and about
// 24px below it on WebKit; both are the same arrival.
const LANDED_WITHIN = 32;
// One rule drives every tab container (mobile dock + desktop rail): the
// active day is a single fact rendered in two places.
export function wireScrollspy(containers, wallRoot) {
  const list = Array.isArray(containers) ? containers : [containers];
  const tabs = list.flatMap((c) => [...c.querySelectorAll('.day-tab')]);
  if (!tabs.length) return () => {};
  const tabDays = new Set(tabs.map((t) => t.dataset.day));
  // Read ONLY the blocks that correspond to a tab — the NOTES / EVERYTHING
  // ELSE pseudo-headers used to de-highlight every tab when they scrolled past
  // (audit 1.3), and they are not blocks now at all. A tab's landing is its
  // day's block (a tab off the end of the week has one too) — and NOT a grid
  // scroller, which carries data-day for its own reasons.
  const headers = [...wallRoot.querySelectorAll(DAY_ANCHOR)]
    .filter((h) => tabDays.has(h.dataset.day));
  // A tab row that cannot fit its days scrolls, and the day you are standing
  // in has to be IN it: ACL's seven tabs leave four off the end of a phone
  // dock, and the row stayed where it was, so it showed FRI 2 / SAT 3 while
  // the wall was in LATE NIGHTS (real-browser walk, 2026-09-17). This is the
  // one place the active day changes, so it is the one place the row moves.
  // The ROW scrolls, never the page (it is not ours to scroll), to a spot
  // worked out from layout positions, not rects: the tabs can be mid-slide
  // while NOW arrives or leaves (a transform, app.js slideTabs), and
  // scrollIntoView would aim at the transformed box.
  const centre = (t, behavior) => {
    const c = t.parentElement;
    if (!c) return;
    const x = t.offsetParent === c ? t.offsetLeft : t.offsetLeft - c.offsetLeft - c.clientLeft;
    const left = Math.max(0, Math.min(x - (c.clientWidth - t.offsetWidth) / 2, c.scrollWidth - c.clientWidth));
    if (typeof c.scrollTo === 'function') c.scrollTo({ left, behavior });
    else c.scrollLeft = left;
  };
  let active = null;
  const setActive = (day) => {
    if (day === active) return;
    active = day;
    const glide = !reduced() && !document.body.classList.contains('low-power');
    tabs.forEach((t) => {
      const on = t.dataset.day === day;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
      if (on) centre(t, glide ? 'smooth' : 'auto');
    });
  };
  // …and the eye is told there is more, on the side there is more ON: a row
  // that fits is never dimmed, and the end of the row is never dimmed once you
  // are at it — which matters, because the tab you are standing in is often
  // the last one.
  const markOverflow = () => {
    for (const c of list) {
      const over = c.scrollWidth - c.clientWidth > 1;
      c.classList.toggle('overflowing', over);
      c.classList.toggle('more-left', over && c.scrollLeft > 1);
      c.classList.toggle('more-right', over && c.scrollLeft < c.scrollWidth - c.clientWidth - 1);
    }
  };
  markOverflow();
  for (const c of list) c.addEventListener('scroll', markOverflow, { passive: true });

  // ONE authority, and it is geometry: the active day is the last day block
  // whose top you have scrolled past. rAF-throttled, and it reads the same
  // --jump-offset the day-tab jump lands against, so the two agree.
  //
  // There used to be an IntersectionObserver beside this, selecting any header
  // that entered a band at 10–20% of the viewport. It came first, and the
  // geometry rule was added under it because the band is the thing a fling
  // clears in one frame: a scrollbar drag, End, Page-Down or a hard flick on a
  // 6,000px page never tripped the observer, so the tab pointed at Thursday
  // while you stood in Sunday's grid until a header happened to drift back
  // through. Two rules over one fact means the second one to speak wins, and
  // they do not agree — a probe watched geometry choose Saturday and the
  // observer then choose Sunday without the page moving at all. Since the dock
  // now scrolls itself to the active tab, a disagreement moves the row too.
  // The band answers nothing geometry does not, so it is gone rather than
  // taught to defer.
  let ticking = false;
  const syncFromGeometry = () => {
    ticking = false;
    if (!headers.length) return;
    const offset = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue('--jump-offset'),
    ) || 8;
    // The tolerance is not slop: a jump parks its block NEAR the offset, and
    // WebKit parks it ~24px below where Chromium lands it exactly — so an
    // at-or-above test lit the day ABOVE the one filling the screen, on the
    // iPhone only (real-browser walk, 2026-09-17). A block this close is the
    // day you are in, on every engine.
    let current = headers[0];
    for (const h of headers) {
      if (h.getBoundingClientRect().top <= offset + LANDED_WITHIN) current = h;
      else break; // headers are in document order
    }
    setActive(current.dataset.day);
  };
  // The initial claim. At load the first day is on screen — say so instead
  // of nothing. But this also runs on every re-wire (a people filter or the
  // show menu repaints the wall), and there the page may be scrolled deep
  // into Sunday: claiming "Saturday" was a lie the tab wore until the next
  // scroll event (UI walk, 2026-08-27). Read the geometry whenever there is
  // scroll to read; position 0 keeps the first-day shortcut so a fresh load
  // never depends on layout having settled.
  let frame = 0;
  if (window.scrollY > 0) {
    syncFromGeometry();
    // …and once more next frame: the caller measures the sticky chrome
    // (--jump-offset) AFTER wiring, and entering or leaving search adds or
    // drops the stage strip, so the first read can be against the old
    // offset (Codex round 4, 2026-08-27).
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(syncFromGeometry);
  } else setActive(tabs[0].dataset.day);
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(syncFromGeometry);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  // A resize moves both facts this row shows: which tabs fit it, and where the
  // day blocks sit under a --jump-offset the sticky chrome has just remeasured.
  // A phone's URL bar sliding away is a resize, and it must not leave the row
  // naming a day you scrolled past three screens ago.
  const onResize = () => { markOverflow(); syncFromGeometry(); };
  window.addEventListener('resize', onResize);
  // The row can change width with the window standing still: NOW arrives
  // before the days and leaves again (app.js, 2026-09-24). Its edges are
  // re-read then, and a row that has just started to overflow keeps the day
  // you are in on screen.
  let rows = null;
  if (typeof ResizeObserver === 'function') {
    rows = new ResizeObserver(() => {
      // A row that changed width (NOW came or went, a rotation) and scrolls
      // centres the day you are in again, at once — not only when it is
      // clipped: a glide setActive started was aimed for the old width, and
      // an instant scroll aborts it (CSSOM View: a new scroll aborts any
      // smooth one).
      for (const c of list) {
        const on = [...c.querySelectorAll('.day-tab')].find((t) => t.dataset.day === active);
        if (on && c.scrollWidth - c.clientWidth > 1) centre(on, 'auto');
      }
      markOverflow();
    });
    for (const c of list) rows.observe(c);
  }

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    if (rows) rows.disconnect();
    for (const c of list) c.removeEventListener('scroll', markOverflow);
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  };
}
