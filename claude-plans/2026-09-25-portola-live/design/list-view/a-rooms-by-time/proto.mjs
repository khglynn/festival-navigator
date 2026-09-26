// Direction A — Rooms by time — the prototype, run INSIDE the real v95 app
// (2026-09-26). Loaded by the rig before app.js (patch.mjs puts the tag in
// index.html), it defines `globalThis.__lv`, which the patched wall.js asks:
//
//   list        is the wall in List mode? (the Show menu's new row; here the
//               rig sets it through localStorage `lv_view`)
//   bandOf(el)  which ladder a room reads on: the festival room (a published
//               stage grid) on HOURS, every section on the night ladder v94
//               shipped for Folsom — except side by side on a wide screen,
//               where every room shares the hours so the rows line up
//   isHour(b)   an hour band's head is a door (the time pin); a word band
//               (Daytime, Late …) names no hour, so it is not
//   asEntry     a grid set as a list entry: its stage as its place
//   after       once per render: re-apply the time pin, line rooms up
//
// Everything here reuses the app's own pieces: the card (untouched), the
// people filter's dim value, the motion tokens (motion.js), --brand.
import { TIME_BANDS, hourLabelOf } from '/js/v3/events.js';
import { reduced, GROW_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE } from '/js/v3/motion.js';

const FEST_ROOM = ':fest';
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const wide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 1100px)').matches;
const H = 60;

// ---- the ladders ----------------------------------------------------------------
// HOURS: one band per clock hour from 9 AM to 2 AM, then After-hours — the
// night ladder's own last rung, so the two ladders agree wherever they meet
// ("9 PM" is 9 PM in both). Fixed boundaries, never fitted to the data; an hour
// with nothing starting in it is not drawn.
const AFTER = TIME_BANDS.find((b) => b.key === 'after');
export function hourBandOf(startMin) {
  if (startMin == null) return { key: 'tba', label: 'Time TBA', from: null, to: null };
  if (startMin >= AFTER.from) return AFTER;
  const h = Math.floor(startMin / H);
  return { key: `h${h}`, label: hourLabelOf(h * H), from: h * H, to: h * H + H };
}
const nightBandOf = (startMin) => (startMin == null ? { key: 'tba', label: 'Time TBA', from: null, to: null }
  : TIME_BANDS.find((b) => startMin >= b.from && startMin < b.to) || { key: 'tba', label: 'Time TBA', from: null, to: null });
const fromOfKey = (key) => {
  if (/^h\d+$/.test(key)) return Number(key.slice(1)) * H;
  const b = TIME_BANDS.find((x) => x.key === key);
  return b ? b.from : 1e9;
};
const toOfKey = (key) => {
  if (/^h\d+$/.test(key)) return Number(key.slice(1)) * H + H;
  const b = TIME_BANDS.find((x) => x.key === key);
  return b ? b.to : 1e9;
};

// ---- the stage as a place ---------------------------------------------------------
// Three readings were rendered (frames stage-*.png): the file's name ("Pier
// Stage"), the name without the word every stage shares ("Pier"), and that
// short name in the room head's register — capitals, tracked ("PIER"). The
// last is the pick: a Folsom card's place is somewhere in the city, a
// Portola card's is a room inside Pier 80, and the capitals say so without
// a colour (the accent has four homes and a card is not one of them).
const STAGE = read('lv_stage', 'caps'); // full | short | caps
const shortStage = (s) => String(s || '').replace(/\s+stage$/i, '').trim();

const LV = {
  list: read('lv_view', 'list') === 'list',
  pin: null, // { day, from } — the hour you are asking about
  bandOf(root) {
    if (wide()) return hourBandOf;
    return root && root.dataset && root.dataset.room === FEST_ROOM ? hourBandOf : nightBandOf;
  },
  isHour(band) { return /^h\d+$/.test(band.key); },
  asEntry(a, day) {
    return {
      ...a,
      day: day.dayKey,
      venue: STAGE === 'full' ? a.stage : shortStage(a.stage),
      __occ: { day: day.dayKey, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null },
    };
  },
  after(root) {
    document.body.classList.toggle('lv-list', LV.list);
    document.body.classList.toggle('lv-stage-caps', STAGE === 'caps');
    document.body.classList.toggle('lv-1up', read('lv_1up', '') === '1');
    if (!LV.list) return;
    for (const block of root.querySelectorAll('.day-block')) {
      align(block);
      for (const h of block.querySelectorAll('button.band-head')) {
        h.onclick = () => togglePin(block, Number(h.dataset.from));
        h.setAttribute('aria-label', `What's on at ${h.querySelector('.label').textContent}, every room`);
      }
      applyPin(block, { animate: false });
    }
  },
};
globalThis.__lv = LV;

// ---- the time pin ("Sunday at 2 — Folsom or Portola?") --------------------------------
// Tap an hour's head and the day answers for that hour in every room at once:
// what is ON between 2:00 and 3:00 stays lit (a set that started at 1:30 and
// runs to 3:10 counts — that is the one you would walk into), everything else
// takes the people filter's dim. In each room the band where that hour falls
// wears the pin: its head in --brand, and at its line's end a word that
// jumps to the next room's answer ("FOLSOM ↓", and back "PORTOLA ↑").
// Tap the head again to let go.
const lit = (card, lo, hi) => {
  const f = Number(card.dataset.nowFrom);
  const t = Number(card.dataset.nowTo);
  return card.dataset.nowFrom != null && card.dataset.nowTo != null && f < hi && t > lo;
};
function roomLabel(room) {
  const l = room.querySelector('.room-head .label');
  return l ? l.textContent.trim() : '';
}
function clearPin(block) {
  block.querySelectorAll('.lv-off').forEach((c) => c.classList.remove('lv-off'));
  block.querySelectorAll('.lv-at').forEach((h) => h.classList.remove('lv-at'));
  block.querySelectorAll('.lv-jump, .lv-hour, .lv-draw').forEach((e) => e.remove());
}
export function togglePin(block, from) {
  const same = LV.pin && LV.pin.day === block.dataset.day && LV.pin.from === from;
  LV.pin = same ? null : { day: block.dataset.day, from };
  for (const b of document.querySelectorAll('.day-block')) applyPin(b, { animate: true });
}
function applyPin(block, { animate }) {
  const was = block.querySelectorAll('.lv-off').length;
  clearPin(block);
  const pin = LV.pin;
  if (!pin || pin.day !== block.dataset.day) {
    if (animate && was && !reduced()) for (const c of block.querySelectorAll('.card')) c.animate([{ opacity: 0.28 }, { opacity: 1 }], { duration: OUT_MS, easing: EASE_LEAVE });
    return;
  }
  const lo = pin.from;
  const hi = pin.from + H;
  const rooms = [...block.querySelectorAll(':scope > .room')];
  const targets = [];
  for (const room of rooms) {
    let first = null;
    for (const card of room.querySelectorAll('.card')) {
      if (lit(card, lo, hi)) { if (!first) first = card; } else card.classList.add('lv-off');
    }
    if (!first) continue;
    // The band the hour falls in, else the band of the first lit card.
    const bands = [...room.querySelectorAll('.time-band')];
    const band = bands.find((b) => fromOfKey(b.dataset.band) <= lo && lo < toOfKey(b.dataset.band)) || first.closest('.time-band');
    targets.push({ room, band });
  }
  // Side by side, the hour is one row: its one visible head wears the pin.
  if (wide() && block.classList.contains('lv-aligned')) {
    const vis = [...block.querySelectorAll('.time-band > .band-head')].find((h) => !h.hidden && fromOfKey(h.parentElement.dataset.band) <= lo && lo < toOfKey(h.parentElement.dataset.band));
    targets.length = 0;
    if (vis) targets.push({ room: vis.closest('.room'), band: vis.parentElement });
  }
  targets.forEach(({ room, band }, i) => {
    const head = band.querySelector('.band-head');
    head.classList.add('lv-at');
    const label = head.querySelector('.label');
    const hour = hourLabelOf(lo);
    if (label.textContent.trim().toUpperCase() !== hour.toUpperCase()) {
      const s = document.createElement('span');
      s.className = 'lv-hour';
      s.textContent = ` · ${hour}`;
      label.appendChild(s);
    }
    const draw = document.createElement('span');
    draw.className = 'lv-draw';
    draw.setAttribute('aria-hidden', 'true');
    head.querySelector('.line').appendChild(draw);
    if (targets.length > 1 && !wide()) {
      const next = targets[(i + 1) % targets.length];
      const down = i + 1 < targets.length;
      const j = document.createElement('button');
      j.type = 'button';
      j.className = 'lv-jump';
      j.textContent = `${roomLabel(next.room)} ${down ? '↓' : '↑'}`;
      j.setAttribute('aria-label', `${hour} at ${roomLabel(next.room)}`);
      j.onclick = () => jumpTo(next.band);
      band.appendChild(j);
    }
    if (animate && !reduced()) {
      draw.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: GROW_MS, easing: EASE_ARRIVE, fill: 'both' });
      const j = band.querySelector('.lv-jump');
      if (j) j.animate([{ opacity: 0, transform: 'translateX(10px)' }, { opacity: 1, transform: 'none' }], { duration: CASCADE_MS, delay: GROW_MS - 60 + STAGGER_MS * i, easing: EASE_ARRIVE, fill: 'both' });
    }
  });
  if (animate && !reduced()) {
    for (const c of block.querySelectorAll('.card.lv-off')) c.animate([{ opacity: 1 }, { opacity: 0.28 }], { duration: OUT_MS, easing: EASE_LEAVE });
  }
}
// The jump travels (a smooth scroll to the next room's answer, the dock's
// rail allowed for) and the arrival redraws that head's line once.
// When the answer is the room's first band, the landing keeps the room's own
// head in view — you arrive knowing where you are ("SUN FOLSOM"), not just when.
export function jumpTo(band, { smooth = true } = {}) {
  const rail = document.querySelector('.day-rail');
  const chrome = rail && rail.offsetParent ? rail.getBoundingClientRect().height : 0;
  const room = band.closest('.room');
  const firstBand = room && room.querySelector('.time-band') === band;
  const anchor = firstBand ? room : band;
  const y = anchor.getBoundingClientRect().top + scrollY - chrome - 12;
  scrollTo({ top: y, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  const d = band.querySelector('.lv-draw');
  if (d && !reduced()) d.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: GROW_MS, delay: 280, easing: EASE_ARRIVE, fill: 'both' });
}

// ---- side by side on a wide screen -----------------------------------------------
// From 1100 the day's rooms stand next to each other and share the hours, so
// every hour is ONE row across the day: its head a single line over all the
// rooms, each room's cards for that hour in its own column. "Sunday at 2" is
// read across a row. The DOM does not move — the rooms, lists and bands
// become `display: contents` and their pieces are placed on the day's grid —
// so a card still sits inside its room (roomOf, the zoom, notes, NOW).
function align(block) {
  block.classList.remove('lv-aligned');
  block.style.gridTemplateColumns = '';
  for (const el of block.querySelectorAll('[data-lv-placed]')) { el.style.gridRow = ''; el.style.gridColumn = ''; el.hidden = false; delete el.dataset.lvPlaced; }
  if (!wide()) return;
  // Columns in the order the rooms BEGIN, the festival's own first: a
  // daytime question keeps its daytime rooms next to each other, and the
  // night's room joins at the right, empty above its first hour — which is
  // the honest shape of "Afters isn't a 2 PM thing". (The DOM keeps the file's
  // order; only the columns move.)
  const firstAt = (r) => Math.min(1e9, ...[...r.querySelectorAll('.time-band')].map((b) => fromOfKey(b.dataset.band)));
  const rooms = [...block.querySelectorAll(':scope > .room')]
    .map((r, i) => ({ r, i, at: r.dataset.room === FEST_ROOM ? -1 : firstAt(r) }))
    .sort((a, b) => a.at - b.at || a.i - b.i).map((x) => x.r);
  if (rooms.length < 2) return;
  const css = getComputedStyle(document.documentElement);
  const colW = parseFloat(css.getPropertyValue('--col-w'));
  const gap = parseFloat(css.getPropertyValue('--col-gap')) || 7;
  const roomGap = 24;
  const W = block.clientWidth;
  // Columns each room asks for: its busiest hour, two at most; the festival
  // room always two (four sets an hour is its rhythm). Narrow the section
  // that asks least until the day fits.
  const most = rooms.map((r) => Math.max(1, ...[...r.querySelectorAll('.band-grid')].map((g) => g.children.length)));
  const cols = rooms.map((r, i) => (r.dataset.room === FEST_ROOM ? 2 : Math.min(2, most[i])));
  const width = () => cols.reduce((s, c) => s + c * colW + (c - 1) * gap, 0) + (cols.length - 1) * roomGap;
  while (width() > W) {
    let k = -1;
    cols.forEach((c, i) => { if (rooms[i].dataset.room !== FEST_ROOM && c > 1 && (k < 0 || most[i] < most[k])) k = i; });
    if (k < 0) break;
    cols[k] -= 1;
  }
  block.classList.add('lv-aligned');
  const rail = document.querySelector('.day-rail');
  block.style.setProperty('--lv-top', `${rail && rail.offsetParent ? Math.round(rail.getBoundingClientRect().height) : 0}px`);
  block.style.gridTemplateColumns = cols.map((c) => `${c * colW + (c - 1) * gap}px`).join(' ');
  block.style.columnGap = `${roomGap}px`;
  const keys = [...new Set([...block.querySelectorAll('.time-band')].map((b) => b.dataset.band))]
    .sort((a, b) => fromOfKey(a) - fromOfKey(b));
  const place = (el, row, col) => { el.dataset.lvPlaced = '1'; el.style.gridRow = String(row); el.style.gridColumn = col; };
  rooms.forEach((room, i) => {
    const col = String(i + 1);
    for (const el of room.children) {
      if (el.classList.contains('room-head')) place(el, 1, col);
      else if (!el.classList.contains('time-list')) place(el, 2, col); // the whisper
    }
    for (const band of room.querySelectorAll('.time-band')) {
      const k = keys.indexOf(band.dataset.band);
      place(band.querySelector('.band-head'), 3 + 2 * k, '1 / -1');
      place(band.querySelector('.band-grid'), 4 + 2 * k, col);
    }
  });
  // One head per hour: the first room's; the others' are the same words.
  for (const k of keys) {
    const heads = [...block.querySelectorAll(`.time-band[data-band="${k}"] > .band-head`)];
    heads.slice(1).forEach((h) => { h.hidden = true; });
  }
}

// ---- rig helpers (frames only) ------------------------------------------------------
export function pinAt(dayKey, from) {
  const block = document.querySelector(`.day-block[data-day="${dayKey}"]`);
  togglePin(block, from);
  return block.querySelectorAll('.lv-at').length;
}
export function freezeAll(at) {
  for (const a of document.getAnimations()) { a.pause(); a.currentTime = at; }
}
