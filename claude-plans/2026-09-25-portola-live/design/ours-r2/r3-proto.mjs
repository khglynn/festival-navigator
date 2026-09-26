// OURS round three — the prototype, run INSIDE the real app (2026-09-25, late).
// R3's peek that grows into R1's plan, with Kevin's round-two notes applied:
// the artist leads on the left, NOW / NEXT sits on the right just left of the
// count, times are quiet. Plus desktop (the corner card and its panel, the
// corner stack, the join dialog) and the zoom's − · note · + as ghost buttons.
// Every card is the app's own (sheetCard, zoomCard); every number is the model's.
import * as state from '../../../../js/state.js';
import * as model from '../../../../js/v3/model.js';
import { colorIndexOf } from '../../../../js/v3/wall.js';
import { factsFor, sheetCard, zoomCard } from '../../../../js/v3/card-facts.js';
import { hslOf, strokeOf } from '../../../../js/v3/palette.js';
import { oursModel, oursAt, headlinersOf, clock as clock0 } from './ours-model.mjs';

const clock = (m) => clock0(m).replace(' ', ' ');
const ME = 'Ana';
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const DATE = { Thu: 'Sep 24', Fri: 'Sep 25', Sat: 'Sep 26', Sun: 'Sep 27' };
export const NAME = { chip: 'Our plan', head: 'OUR PLAN' };

let E = null;
export function env({ folded = [] } = {}) {
  const fest = state.fest();
  const picks = model.picksFor(state.crewDoc, state.activeFestivalId);
  const members = state.activePeople().map(([n]) => n);
  const ctx = { fid: state.activeFestivalId, meName: ME, picks, affinity: {}, lowPower: false, filterPeople: [], weekend: 'all', onTap() {}, onOpenNotes: null };
  E = { fest, picks, ctx, M: oursModel(fest, picks, members, { folded }) };
  return E;
}
export async function ensureCss() {
  if (document.getElementById('r3-proto-css')) return;
  const l = document.createElement('link');
  l.id = 'r3-proto-css';
  l.rel = 'stylesheet';
  l.href = new URL('./r3-proto.css', import.meta.url).href;
  const done = new Promise((r) => { l.onload = r; });
  document.head.appendChild(l);
  await done;
}

// ---- the row -------------------------------------------------------------------
function actFor(stop) {
  if (stop.place.kind === 'set') return stop.place.acts[0];
  return headlinersOf(stop, E.picks)[0] || stop.place.acts[0];
}
function nodeEl(act) {
  const n = mk('span', 'q-node');
  if (act) {
    const f = factsFor(act.name, E.ctx, act.occ);
    n.style.background = f.background;
    if (f.animated) n.classList.add('animated');
  }
  return n;
}
function alsoText(stop, night) {
  if (!stop.alsoAt || !stop.alsoAt.length) return '';
  return `also ${[...new Set(stop.alsoAt.map((o) => (o.night === night ? clock(o.from) : o.night)))].join(', ')}`;
}
function whatEl(stop, night) {
  const w = mk('span', 'q-what');
  const act = actFor(stop);
  const room = stop.place.kind === 'room';
  w.append(mk('span', 'nm', room ? stop.place.place : act.name));
  const pl = mk('span', 'pl', room ? headlinersOf(stop, E.picks).map((h) => h.name).join(' → ') : stop.place.place);
  const also = alsoText(stop, night);
  if (also) pl.appendChild(mk('span', 'also', also));
  w.append(pl);
  return w;
}
function whoEl(people) {
  const w = mk('span', 'q-who');
  const all = state.people();
  for (const n of [...people].sort((a, b) => (b === ME) - (a === ME))) {
    const ci = colorIndexOf(n, all[n]);
    const a = mk('span', 'avatar', n.charAt(0).toUpperCase());
    a.style.background = hslOf(ci, 0.5);
    a.style.border = '1px solid ' + strokeOf(ci, n === ME);
    w.appendChild(a);
  }
  return w;
}
const approxOf = (stop) => stop.place.kind === 'room' && actFor(stop).approx;
const tillOf = (stop) => (stop.place.kind === 'set' ? actFor(stop).to : stop.to);
function whenEl({ tag = null, text, soft = false }) {
  const w = mk('span', 'q-when');
  if (tag === 'now') { const t = mk('span', 'q-tag now'); t.append(mk('i'), 'NOW'); w.appendChild(t); }
  if (tag === 'next') w.appendChild(mk('span', 'q-tag next', 'NEXT'));
  if (text) w.appendChild(mk('span', 't' + (soft ? ' soft' : ''), text));
  return w;
}
function countEl(n) { const c = mk('span', 'q-n'); c.append(mk('b', null, String(n)), 'of us'); return c; }

// One stop as a row. tag: 'now' (the time says till when) or 'next' (the
// time says from when); otherwise the quiet start time.
function stopRow(stop, night, { tag = null, count = stop.count, grow = false, faces = true } = {}) {
  const r = mk('div', `q-row ${stop.tier}` + (tag === 'now' ? ' live' : ''));
  const start = `${approxOf(stop) ? '~' : ''}${clock(stop.from)}`;
  const text = tag === 'now' ? `till ${clock(tillOf(stop))}` : start;
  const w = whatEl(stop, night);
  if (stop.tier === 'most' && faces && !grow) w.appendChild(whoEl(stop.people));
  r.append(nodeEl(actFor(stop)), w, whenEl({ tag, text }), countEl(count));
  if (grow) {
    const act = actFor(stop);
    const g = mk('div', 'q-grow');
    g.appendChild(sheetCard(factsFor(act.name, E.ctx, act.occ), { onClose() {}, notesChip: false }));
    g.querySelectorAll('.sheet-close').forEach((x) => x.remove());
    r.appendChild(g);
  }
  return r;
}
function forkRow(f, stop) {
  const r = mk('div', 'q-row or');
  const w = mk('span', 'q-what');
  const nm = mk('span', 'nm');
  const name = f.place.kind === 'set' ? f.place.acts[0].name : f.place.place;
  const where = f.place.kind === 'set' ? f.place.place : ((headlinersOf({ place: f.place, people: f.people }, E.picks)[0] || {}).name || f.place.room);
  nm.append(mk('i', null, 'or'), name, mk('span', 'pl-inline', ` · ${where}`));
  w.appendChild(nm);
  const later = f.from >= stop.from + 30;
  r.append(nodeEl(null), w, whenEl({ text: later ? clock(f.from) : '', soft: true }), countEl(f.count));
  return r;
}
function forkFor(stop, bar, nowMin = null) {
  const fs = stop.forks.filter((f) => f.count >= bar && (nowMin == null || f.to > nowMin));
  const even = fs.find((f) => f.count >= stop.count && (Math.min(f.to, stop.to) - Math.max(f.from, stop.from)) >= 0.6 * (stop.to - stop.from));
  return even || fs.sort((a, b) => b.count - a.count || a.from - b.from)[0] || null;
}
// What the peek shows, and which row of the plan wears its tag: the stop the
// clock is in (NOW), else the next time MOST of us meet (NEXT), else the next stop.
export function peekOf(night, nowMin) {
  const at = oursAt(E.M, night, nowMin);
  if (at.current) return { stop: at.current, tag: 'now', count: (at.here || at.current.people).length };
  const up = [at.next, ...at.later].filter(Boolean);
  const s = up.find((x) => x.tier === 'most') || up[0] || null;
  return s ? { stop: s, tag: 'next', count: s.count } : null;
}

export function planRows(night, { nowMin = null, grow = true, foldEarlier = true } = {}) {
  const n = E.M.nights.find((x) => x.night === night);
  const wrap = mk('div', 'q-plan');
  if (!n) return wrap;
  const pk = nowMin != null ? peekOf(night, nowMin) : null;
  let items = n.items;
  const rows = [];
  if (foldEarlier && nowMin != null) {
    const over = items.filter((i) => i.kind === 'stop' && i.to <= nowMin);
    if (over.length > 1) {
      const r = mk('div', 'q-row earlier');
      const w = mk('span', 'q-what');
      const nm = mk('span', 'nm');
      nm.append('Earlier today: ', mk('b', null, `${over.length} stops`));
      w.appendChild(nm);
      r.append(nodeEl(null), w, mk('span'), mk('span', 'chev', '⌄'));
      rows.push(r);
      items = items.filter((i) => !over.includes(i) && !(i.kind === 'scattered' && i.to <= nowMin));
    }
  }
  for (const it of items) {
    if (it.kind === 'scattered') {
      const r = mk('div', 'q-row scattered');
      const w = mk('span', 'q-what');
      w.appendChild(mk('span', 'nm', `Scattered till ${clock(it.to)}`));
      r.append(nodeEl(null), w, whenEl({ text: clock(it.from), soft: true }), mk('span'));
      rows.push(r);
      continue;
    }
    const tag = pk && pk.stop === it ? pk.tag : null;
    const r = stopRow(it, night, { tag, count: tag ? pk.count : it.count, grow: grow && tag === 'now' });
    if (nowMin != null && it.to <= nowMin) r.classList.add('past');
    rows.push(r);
    const f = forkFor(it, E.M.bar, tag === 'now' ? nowMin : null);
    if (f) { const fr = forkRow(f, it); if (r.classList.contains('past')) fr.classList.add('past'); rows.push(fr); }
  }
  rows.forEach((r, k) => { if (k === 0) r.classList.add('first'); if (k === rows.length - 1) r.classList.add('last'); wrap.appendChild(r); });
  return wrap;
}

function roomHeadEl(wd, label, sub) {
  const h = mk('div', 'room-head');
  const name = mk('span', 'name');
  name.append(mk('span', 'wd', wd.toUpperCase()), ' ', mk('span', 'label', label));
  h.append(name, mk('span', 'sub', sub), mk('span', 'line'));
  return h;
}
// Retired in round three (Kevin: with v92 a friend opens the crew link and
// looks around as a guest, so the plan itself is what gets shared).
function sendBlock() {
  const s = mk('div', 'q-send');
  s.append(mk('button', 'btn-tonal', 'Tell a friend where we’ll be'), mk('div', 'hint', 'Places and times only. No names, no crew link.'));
  return s;
}
const chevron = (up = true) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', '11'); s.setAttribute('height', '11'); s.setAttribute('viewBox', '0 0 12 12');
  s.innerHTML = `<path d="${up ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5'}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
  return s;
};
const clear = (sel) => document.querySelectorAll(sel).forEach((e) => e.remove());
const dockH = () => { const d = document.getElementById('dock'); return d && getComputedStyle(d).display !== 'none' ? Math.round(d.getBoundingClientRect().height) : 0; };

// ---- phone -----------------------------------------------------------------------
// NOW lives in the peek (R3), so the dock has none; the day row re-centres.
export function dockWithoutNow() {
  for (const id of ['dock-now', 'rail-now']) { const n = document.getElementById(id); if (n) n.hidden = true; }
  const dock = document.getElementById('dock');
  if (dock) dock.classList.remove('squeezed');
  const days = document.getElementById('dock-days');
  if (!days) return;
  days.style.minWidth = '';
  const act = days.querySelector('.day-tab.active');
  if (act) { const r = days.getBoundingClientRect(); const a = act.getBoundingClientRect(); days.scrollLeft += (a.left + a.width / 2) - (r.left + r.width / 2); }
  const over = days.scrollWidth > days.clientWidth + 1;
  days.classList.toggle('overflowing', over);
  days.classList.toggle('more-left', over && days.scrollLeft > 1);
  days.classList.toggle('more-right', over && days.scrollLeft < days.scrollWidth - days.clientWidth - 1);
}
export async function peekPhone({ night, nowMin }) {
  await ensureCss();
  clear('.q-bar');
  const pk = peekOf(night, nowMin);
  if (!pk) return null;
  const bar = mk('div', 'q-bar');
  bar.appendChild(mk('div', 'grabber'));
  const r = stopRow(pk.stop, night, { tag: pk.tag, count: pk.count, faces: false });
  r.querySelectorAll('.also').forEach((a) => a.remove());
  bar.appendChild(r);
  bar.style.bottom = `${dockH() - 1}px`;
  document.body.appendChild(bar);
  return bar;
}
// Dragged up, the peek is the plan: its row is the plan's tagged row, in place.
export async function shelfPhone({ night, nowMin }) {
  await ensureCss();
  clear('.q-sheet, #q-backdrop, .q-bar');
  const backdrop = mk('div', 'sheet-backdrop');
  backdrop.id = 'q-backdrop';
  const sheet = mk('div', 'sheet q-sheet');
  sheet.appendChild(mk('div', 'grabber'));
  const head = mk('div', 'q-head');
  const x = mk('button', 'sheet-close', '✕');
  head.append(roomHeadEl(night, NAME.head, `${DATE[night]} · ${E.M.us.length} of us picking`), x);
  sheet.appendChild(head);
  sheet.appendChild(planRows(night, { nowMin }));
  const b = dockH();
  sheet.style.bottom = `${b}px`;
  backdrop.style.bottom = `${b}px`;
  document.body.append(backdrop, sheet);
  const dock = document.getElementById('dock');
  if (dock) dock.style.zIndex = '42';
  return sheet;
}

// ---- desktop --------------------------------------------------------------------
function cornerPeek(night, nowMin, { hover = false } = {}) {
  const pk = peekOf(night, nowMin);
  const card = mk('div', 'q-corner' + (hover ? ' hover' : ''));
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${NAME.chip}: open the day's plan`);
  const ch = mk('div', 'q-ch');
  const open = mk('button', 'q-open');
  open.append('Open', chevron(true));
  ch.append(mk('span', 'k', NAME.chip), mk('span', 'c', `· ${night} · ${E.M.us.length} of us`), open);
  card.appendChild(ch);
  if (pk) {
    const r = stopRow(pk.stop, night, { tag: pk.tag, count: pk.count, faces: false });
    r.querySelectorAll('.also').forEach((a) => a.remove());
    card.appendChild(r);
  }
  if (hover) card.appendChild(mk('div', 'q-tip', 'The whole day ⌃'));
  return card;
}
function welcomeCard() {
  const w = mk('div', 'q-welcome');
  const crew = mk('div', 'crew');
  const cl = mk('span', 'avatar-cluster');
  const all = state.people();
  for (const [n] of state.activePeople().slice(0, 6)) {
    const ci = colorIndexOf(n, all[n]);
    const a = mk('span', 'avatar', n.charAt(0).toUpperCase());
    a.style.background = hslOf(ci, 0.5);
    a.style.border = '1px solid ' + strokeOf(ci, false);
    cl.appendChild(a);
  }
  crew.append(cl, mk('span', 'nm', (state.crewDoc && state.crewDoc.meta && state.crewDoc.meta.name) || 'The crew'));
  const p = mk('p');
  p.append('Every friend has a color — the more color on a card, the more of us want to go. ');
  const more = mk('a', null, 'More info');
  more.href = '#';
  p.appendChild(more);
  const two = mk('div', 'q-two');
  two.append(mk('button', 'ghost', 'Look around'), mk('button', 'tonal', 'Pick shows'));
  w.append(crew, mk('h3', null, `This is the crew’s plan for ${E.fest.name}.`), p, two);
  return w;
}
export async function cornerStack({ night, nowMin, hover = false, welcome = false }) {
  await ensureCss();
  clear('.q-stack, .q-panel');
  dockWithoutNow();
  const stack = mk('div', 'q-stack');
  if (welcome) stack.appendChild(welcomeCard());
  stack.appendChild(cornerPeek(night, nowMin, { hover }));
  document.body.appendChild(stack);
  return stack;
}
// The corner card, grown up into a companion panel under the rail.
export async function panel({ night, nowMin }) {
  await ensureCss();
  clear('.q-stack, .q-panel');
  dockWithoutNow();
  const rail = document.getElementById('day-rail');
  const top = rail ? Math.max(0, Math.round(rail.getBoundingClientRect().bottom)) : 0;
  const p = mk('div', 'q-panel');
  p.style.top = `${top}px`;
  const head = mk('div', 'q-head');
  const shut = mk('button', 'q-shut');
  shut.append('Close', chevron(false));
  head.append(roomHeadEl(night, NAME.head, `${DATE[night]} · ${E.M.us.length} of us picking`), shut);
  p.append(head, planRows(night, { nowMin }));
  document.body.appendChild(p);
  return p;
}
// A question stays the centred dialog (.sheet at 720+): the join shelf.
export async function joinDialog({ artist = null } = {}) {
  await ensureCss();
  clear('.q-join, #q-jb');
  const backdrop = mk('div', 'sheet-backdrop');
  backdrop.id = 'q-jb';
  const s = mk('div', 'sheet q-join');
  const h = mk('h3');
  h.append('Pick ', mk('span', null, artist || 'shows'), ' as…');
  s.append(h, mk('div', 'sub', 'Click your name, or add yourself.'));
  const names = mk('div', 'names');
  const all = state.people();
  for (const [n] of state.activePeople()) {
    const ci = colorIndexOf(n, all[n]);
    const c = mk('button', 'person-chip', n);
    c.style.background = hslOf(ci, 0.5);
    c.style.border = '1px solid ' + strokeOf(ci, false);
    names.appendChild(c);
  }
  const input = mk('input');
  input.placeholder = 'New here? Your name';
  const two = mk('div', 'q-two');
  const join = mk('button', 'tonal', 'Join');
  join.style.opacity = '.5';
  two.append(mk('button', 'ghost', 'Look around'), join);
  s.append(names, input, two);
  document.body.append(backdrop, s);
  return s;
}
// A drawn mouse pointer, for frames that show a hover.
export function cursorAt({ x, y }) {
  clear('.q-cursor');
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  c.setAttribute('class', 'q-cursor');
  c.setAttribute('viewBox', '0 0 18 18');
  c.innerHTML = '<path d="M2 1.5v13.2l3.4-3.1 2.3 5 2.2-1-2.2-4.9 4.6-.3z" fill="#fff" stroke="#0C0A14" stroke-width="1.2" stroke-linejoin="round"/>';
  c.style.left = `${x}px`; c.style.top = `${y}px`;
  document.body.appendChild(c);
}

// ---- the zoom's − · note · + as ghost buttons -------------------------------------
// Opens the real zoom on a real card (the phone's is the long-press's grown
// card; a desktop frame hovers it for real), then draws the stepper row the
// guest-shelf round designed, restyled as ghosts.
export async function openZoom({ artist }) {
  await ensureCss();
  const el = document.querySelector(`#wall-root .card[data-artist="${CSS.escape(artist)}"]`);
  if (!el) throw new Error(`no card ${artist}`);
  let occ = null;
  try { occ = JSON.parse(el.dataset.occ || 'null'); } catch { occ = null; }
  zoomCard(el, artist, { ...E.ctx, onOpenNotes: () => {} }, { source: 'mouse', occ, instant: true, onOpenNotes: () => {} });
}
export async function ghostStepper({ hover = null } = {}) {
  await ensureCss();
  const zc = document.querySelector('#zoom-layer .zoom-card');
  if (!zc) throw new Error('no zoom');
  const row = zc.querySelector('.f-chips');
  if (!row) throw new Error('no chips row');
  let notes = row.querySelector('.f-chip.notes');
  if (!notes) { notes = mk('span', 'f-chip notes', '+ note'); }
  row.textContent = '';
  row.classList.add('q-step-row');
  const side = (dir) => {
    const b = mk('button', `q-step ${dir < 0 ? 'minus' : 'plus'}` + (hover === (dir < 0 ? 'minus' : 'plus') ? ' hover' : ''));
    b.setAttribute('aria-label', dir < 0 ? 'Less' : 'More');
    b.appendChild(mk('span', 'dot', dir < 0 ? '−' : '+'));
    return b;
  };
  row.append(side(-1), notes, side(1));
  return zc.getBoundingClientRect().toJSON();
}
