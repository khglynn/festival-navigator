// OURS round two — the design prototype, run INSIDE the real app (2026-09-25).
// Loaded by frames.mjs into a page that booted the production app against the
// made-up crew. It imports the app's own modules by the same URLs the app
// uses, so it shares their state: every grown card is sheetCard's, every node
// wears factsFor's aura, every number is ours-model.mjs's. Nothing here is
// production code; it draws the directions so Kevin can judge them on a phone.
import * as state from '../../../../js/state.js';
import * as model from '../../../../js/v3/model.js';
import { colorIndexOf } from '../../../../js/v3/wall.js';
import { factsFor, sheetCard } from '../../../../js/v3/card-facts.js';
import { auraBackground } from '../../../../js/v3/aura.js';
import { hslOf as hslOfCi, strokeOf as strokeOfCi } from '../../../../js/v3/palette.js';
import { oursModel, oursAt, headlinersOf, shareTextOf, clock as clock0 } from './ours-model.mjs';

const clock = (m) => clock0(m).replace(' ', ' ');
const ME = 'Ana';
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const LONG = { Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const DAYKEY = { Sat: 'Saturday', Sun: 'Sunday', Thu: 'Thursday', Fri: 'Friday' };
const DATE = { Thu: 'Sep 24', Fri: 'Sep 25', Sat: 'Sep 26', Sun: 'Sep 27' };

// The name (round two, Kevin: "Is 'ours' clear?"): the chip and the head.
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
  if (document.getElementById('r2-proto-css')) return;
  const l = document.createElement('link');
  l.id = 'r2-proto-css';
  l.rel = 'stylesheet';
  l.href = new URL('./r2-proto.css', import.meta.url).href;
  const done = new Promise((r) => { l.onload = r; });
  document.head.appendChild(l);
  await done;
}

// ---- one row grammar ------------------------------------------------------------
function actFor(stop) {
  if (stop.place.kind === 'set') return stop.place.acts[0];
  return headlinersOf(stop, E.picks)[0] || stop.place.acts[0];
}
function timeEl(min, approx = false) {
  const [num, ap] = clock0(min).split(' ');
  const t = mk('span', 'p-t');
  if (approx) t.appendChild(mk('span', 'tl', '~'));
  t.append(num);
  t.appendChild(mk('span', 'ap', ap));
  return t;
}
function nodeEl(act) {
  const n = mk('span', 'p-node');
  const f = factsFor(act.name, E.ctx, act.occ);
  n.style.background = f.background;
  if (f.animated) n.classList.add('animated');
  return n;
}
function alsoText(stop, night) {
  if (!stop.alsoAt || !stop.alsoAt.length) return '';
  const words = [...new Set(stop.alsoAt.map((o) => (o.night === night ? clock(o.from) : o.night)))];
  return `also ${words.join(', ')}`;
}
function whatEl(stop, night, { withAlso = true } = {}) {
  const w = mk('span', 'p-what');
  const act = actFor(stop);
  if (stop.place.kind === 'room') {
    w.append(mk('span', 'nm', stop.place.place));
    const heads = headlinersOf(stop, E.picks).map((h) => h.name);
    const pl = mk('span', 'pl', heads.join(' → '));
    const also = withAlso ? alsoText(stop, night) : '';
    if (also) pl.appendChild(mk('span', 'also', also));
    w.append(pl);
  } else {
    w.append(mk('span', 'nm', act.name));
    const pl = mk('span', 'pl', stop.place.place);
    const also = withAlso ? alsoText(stop, night) : '';
    if (also) pl.appendChild(mk('span', 'also', also));
    w.append(pl);
  }
  return w;
}
function whoEl(people) {
  const w = mk('span', 'p-who');
  const all = state.people();
  const ordered = [...people].sort((a, b) => (b === ME) - (a === ME));
  for (const n of ordered) {
    const ci = colorIndexOf(n, all[n]);
    const a = mk('span', 'avatar', n.charAt(0).toUpperCase());
    a.style.background = hslOfCi(ci, 0.5);
    a.style.border = '1px solid ' + strokeOfCi(ci, n === ME);
    a.title = n;
    w.appendChild(a);
  }
  return w;
}
function countEl(n) {
  const c = mk('span', 'p-n');
  c.append(mk('b', null, String(n)), 'of us');
  return c;
}
function forkRow(f, stop, night) {
  const r = mk('div', 'p-row or' + (f.count >= stop.count ? ' even' : ''));
  r.appendChild(mk('span', 'p-t or', 'or'));
  r.appendChild(mk('span', 'p-node'));
  const w = mk('span', 'p-what');
  const name = f.place.kind === 'set' ? f.place.acts[0].name : f.place.place;
  const where = f.place.kind === 'set' ? f.place.place : ((headlinersOf({ place: f.place, people: f.people }, E.picks)[0] || {}).name || f.place.room);
  // Only a fork that forms well after its stop says when; the rest overlap it.
  const when = f.from >= stop.from + 30 ? ` · from ${clock(f.from)}` : '';
  const nm = mk('span', 'nm', name);
  nm.appendChild(mk('span', 'pl-inline', ` · ${where}${when}`));
  w.appendChild(nm);
  r.append(w, countEl(f.count));
  return r;
}
// The fork a plan shows under a stop: a true split first (as many of us, most
// of the stop), else the biggest.
function forkFor(stop, bar, nowMin = null) {
  const fs = stop.forks.filter((f) => f.count >= bar && (nowMin == null || f.to > nowMin));
  const even = fs.find((f) => f.count >= stop.count && (Math.min(f.to, stop.to) - Math.max(f.from, stop.from)) >= 0.6 * (stop.to - stop.from));
  return even || fs.sort((a, b) => b.count - a.count || a.from - b.from)[0] || null;
}

function stopRow(stop, night, { live = false, nowMin = null, grow = false, faces = true } = {}) {
  const act = actFor(stop);
  const approx = stop.place.kind === 'room' && act.approx;
  const r = mk('div', `p-row ${stop.tier}` + (live ? ' live' : ''));
  if (live) {
    const now = mk('span', 'p-now');
    const pill = mk('span', 'pill');
    pill.append(mk('i'), 'NOW');
    now.append(pill, mk('span', 'at', clock(nowMin)));
    r.appendChild(now);
  } else r.appendChild(timeEl(stop.from, approx));
  const w = whatEl(stop, night);
  if (stop.tier === 'most' && !grow && faces) w.appendChild(whoEl(stop.people));
  r.append(nodeEl(act), w, countEl(stop.count));
  if (grow) {
    const g = mk('div', 'p-grow');
    g.appendChild(sheetCard(factsFor(act.name, E.ctx, act.occ), { onClose() {}, notesChip: false }));
    g.querySelectorAll('.sheet-close').forEach((x) => x.remove());
    r.appendChild(g);
  }
  return r;
}

// The plan for one night as rows on the grid.
//   nowMin      the festival clock; past stops step back, the live one says NOW
//   grow        'live' grows the live stop into its card; a stop id grows that one
//   foldEarlier folds the stops already over into one sentence line
//   spine       only the stops where MOST of us are (or every stop, on a night with none)
export function planRows(night, { nowMin = null, grow = 'live', foldEarlier = false, spine = false, forks = true, faces = true } = {}) {
  const n = E.M.nights.find((x) => x.night === night);
  const wrap = mk('div', 'p-plan');
  if (!n) return wrap;
  let items = n.items;
  if (spine) {
    const most = items.filter((i) => i.kind === 'stop' && i.tier === 'most');
    items = most.length ? most : items.filter((i) => i.kind === 'stop');
  }
  const rows = [];
  if (foldEarlier && nowMin != null) {
    const over = items.filter((i) => i.kind === 'stop' && i.to <= nowMin);
    if (over.length > 1) {
      const r = mk('div', 'p-row earlier');
      r.appendChild(timeEl(over[0].from));
      r.appendChild(mk('span', 'p-node'));
      const w = mk('span', 'p-what');
      const nm = mk('span', 'nm');
      nm.append('Earlier today: ', mk('b', null, `${over.length} stops`));
      w.appendChild(nm);
      r.append(w, mk('span', 'chev', '⌄'));
      rows.push(r);
      items = items.filter((i) => !over.includes(i) && !(i.kind === 'scattered' && i.to <= nowMin));
    }
  }
  for (const it of items) {
    if (it.kind === 'scattered') {
      const r = mk('div', 'p-row scattered');
      r.append(timeEl(it.from), mk('span', 'p-node'));
      const w = mk('span', 'p-what');
      w.appendChild(mk('span', 'nm', `Scattered till ${clock(it.to)}`));
      r.append(w, mk('span'));
      rows.push(r);
      continue;
    }
    const live = nowMin != null && it.from <= nowMin && nowMin < it.to;
    const growIt = (grow === 'live' && live) || grow === it;
    const r = stopRow(it, night, { live, nowMin, grow: growIt, faces });
    if (nowMin != null && it.to <= nowMin) r.classList.add('past');
    rows.push(r);
    if (forks) {
      const f = forkFor(it, E.M.bar, live ? nowMin : null);
      if (f) { const fr = forkRow(f, it, night); if (nowMin != null && it.to <= nowMin) fr.classList.add('past'); rows.push(fr); }
    }
  }
  rows.forEach((r, k) => { if (k === 0) r.classList.add('first'); if (k === rows.length - 1) r.classList.add('last'); wrap.appendChild(r); });
  return wrap;
}

function roomHeadEl(wd, label, sub, tag = 'div') {
  const h = mk(tag, 'room-head');
  if (tag === 'button') h.type = 'button';
  const name = mk('span', 'name');
  name.append(mk('span', 'wd', wd.toUpperCase()), ' ', mk('span', 'label', label));
  h.append(name, mk('span', 'sub', sub), mk('span', 'line'));
  return h;
}
function sendBlock() {
  const s = mk('div', 'p-send');
  s.append(mk('button', 'btn-tonal', 'Tell a friend where we’ll be'), mk('div', 'hint', 'Places and times only. No names, no crew link.'));
  return s;
}
function closeBtn() { const x = mk('button', 'sheet-close', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); return x; }

// ---- the shelf -----------------------------------------------------------------
// Planning (nothing live): the day's head, then the whole day on the grid.
// Live: the loved NOW answer on top, then the plan from the live stop on (the
// live stop grown into its card), the stops already over folded to one line.
export async function buildShelf({ night, nowMin = null, clockLabel = null, bottom = null, grow = 'live' } = {}) {
  await ensureCss();
  document.querySelectorAll('.p-sheet, #p-backdrop').forEach((e) => e.remove());
  const n = E.M.nights.find((x) => x.night === night);
  const at = nowMin != null ? oursAt(E.M, night, nowMin) : { current: null };
  const backdrop = mk('div', 'sheet-backdrop');
  backdrop.id = 'p-backdrop';
  const sheet = mk('div', 'sheet p-sheet');
  sheet.appendChild(mk('div', 'grabber'));
  const cur = at.current;
  if (cur) {
    const top = mk('div', 'p-head');
    const kick = mk('div', 'p-kick');
    kick.append(mk('span', 'live'), mk('span', 'k', 'Right now'), mk('span', 'c', `· ${night} ${clockLabel || clock(nowMin)}`));
    top.append(kick, mk('span', null));
    top.lastChild.style.flex = '1';
    top.appendChild(closeBtn());
    sheet.appendChild(top);
    const hereN = (at.here || cur.people).length;
    const a = mk('div', 'p-answer');
    // A true split (as many of us at a second place, right now) says both
    // places, in words: never "4 + 4".
    const even = cur.forks.find((f) => f.from <= nowMin && nowMin < f.to && f.count >= hereN);
    if (even) {
      a.append(mk('span', 'n', `${hereN} AT ${cur.place.place.toUpperCase()}`), mk('span', 'soft', ' · '), mk('span', 'n', `${even.count} AT ${even.place.place.toUpperCase()}`));
    } else a.append(mk('span', 'n', `${hereN} OF US`), ` AT ${cur.place.place.toUpperCase()}`);
    sheet.appendChild(a);
    // A true split grows neither place: both are equal answers, the headline
    // names both, and a tap grows whichever one you are heading to.
    sheet.appendChild(planRows(night, { nowMin, grow: even ? null : grow, foldEarlier: true }));
  } else {
    const top = mk('div', 'p-head');
    top.append(roomHeadEl(night, NAME.head, `${DATE[night]} · ${E.M.us.length} of us picking`), closeBtn());
    sheet.appendChild(top);
    if (!n || !n.stops) {
      const order = ['Thu', 'Fri', 'Sat', 'Sun'];
      const nx = E.M.nights.find((x) => x.stops && order.indexOf(x.night) > order.indexOf(night));
      const p = mk('div', 'p-empty');
      p.append(`Nothing has ${E.M.bar} of us on ${LONG[night]}.`);
      if (nx) { const f = nx.items.find((i) => i.kind === 'stop'); p.append(' '); p.appendChild(mk('b', null, `${LONG[nx.night]} does`)); p.append(`, from ${clock(f.from)}.`); }
      sheet.appendChild(p);
    } else sheet.appendChild(planRows(night, { nowMin, grow }));
  }
  sheet.appendChild(sendBlock());
  const dock = document.getElementById('dock');
  const b = bottom != null ? bottom : (dock ? Math.round(dock.getBoundingClientRect().height) : 0);
  sheet.style.bottom = `${b}px`;
  backdrop.style.bottom = `${b}px`;
  document.body.append(backdrop, sheet);
  if (dock) dock.style.zIndex = '42';
  return sheet;
}

// ---- R1: the people line, pinned, OURS first --------------------------------------
function oursChip({ on = false } = {}) {
  const chip = mk('button', 'person-chip ours' + (on ? ' on' : ''));
  chip.type = 'button';
  chip.setAttribute('aria-label', `${NAME.chip}: where most of us will be today`);
  chip.append(mk('span', null, NAME.chip), mk('span', 'chev', '›'));
  return chip;
}
// The plus rule, applied to today's UI: the people row's add says what it adds
// (Settings already says "+ Add someone"), and the crew corner's "+n" loses
// the dashed ring that makes it look like an add.
export function plusFix() {
  document.body.classList.add('p-plusfix');
  document.querySelectorAll('#person-chips .person-chip.add').forEach((a) => { a.textContent = '+ Add someone'; });
}
// Today's wrapping row, with OURS leading it (the width test's first half).
export async function oursInToolbar({ on = false } = {}) {
  await ensureCss();
  const row = document.getElementById('person-chips');
  row.querySelectorAll('.ours').forEach((e) => e.remove());
  row.prepend(oursChip({ on }));
  plusFix();
}
// The row pinned as one sideways line at the top of the screen; the stage
// strip pins under it (the same --rail-h the desktop rail uses).
export async function pinPeople({ on = false } = {}) {
  await ensureCss();
  document.querySelectorAll('.p-people').forEach((e) => e.remove());
  plusFix();
  const bar = mk('div', 'p-people');
  bar.appendChild(oursChip({ on }));
  bar.appendChild(mk('span', 'sep'));
  for (const c of document.querySelectorAll('#person-chips .person-chip:not(.ours)')) bar.appendChild(c.cloneNode(true));
  document.body.appendChild(bar);
  document.documentElement.style.setProperty('--rail-h', '44px');
  return bar;
}

// ---- R2: the plan is the day's first room ---------------------------------------------
export async function planRoom({ night, nowMin = null, spine = true } = {}) {
  await ensureCss();
  document.querySelectorAll('.p-room').forEach((e) => e.remove());
  const block = document.querySelector(`#wall-root .day-block[data-day="${DAYKEY[night]}"]`);
  if (!block) throw new Error(`no day block for ${night}`);
  const room = mk('div', 'room p-room');
  room.dataset.room = 'ours';
  const n = E.M.nights.find((x) => x.night === night);
  const stops = n ? n.items.filter((i) => i.kind === 'stop') : [];
  room.appendChild(roomHeadEl(night, NAME.head, `${DATE[night]} · ${E.M.us.length} of us picking`, 'button'));
  room.appendChild(planRows(night, { nowMin, grow: null, spine, forks: false, faces: false }));
  const shown = spine ? stops.filter((s) => s.tier === 'most').length || stops.length : stops.length;
  if (stops.length > shown) {
    const more = mk('div', 'p-more');
    more.appendChild(mk('span'));
    more.appendChild(mk('span'));
    more.appendChild(mk('button', 'lnk', 'The whole day ›'));
    room.appendChild(more);
  }
  block.prepend(room);
  return room;
}

// ---- R3: the plan bar on the dock's top edge -------------------------------------------
export async function planBar({ night, nowMin }) {
  await ensureCss();
  document.querySelectorAll('.p-bar').forEach((e) => e.remove());
  const at = oursAt(E.M, night, nowMin);
  // During a stop: that stop, NOW. Between stops: the next time MOST of us
  // are together (the plan's next meet-up), else the next stop of any size.
  const upcoming = [at.next, ...at.later].filter(Boolean);
  const stop = at.current || upcoming.find((s) => s.tier === 'most') || upcoming[0];
  if (!stop) return null;
  const bar = mk('div', 'p-bar');
  bar.appendChild(mk('div', 'grabber'));
  const r = mk('div', `p-row ${stop.tier}`);
  const k = mk('span', 'p-now');
  const pill = mk('span', 'pill' + (at.current ? '' : ' next'));
  if (at.current) pill.append(mk('i'), 'NOW');
  else pill.append('NEXT');
  k.append(pill, mk('span', 'at', at.current ? clock(nowMin) : clock(stop.from)));
  const act = actFor(stop);
  const w = whatEl(stop, night, { withAlso: false });
  const till = stop.place.kind === 'set' ? act.to : stop.to;
  w.querySelector('.pl').textContent = at.current ? `${stop.place.place} · till ${clock(till)}` : stop.place.place;
  const hereN = at.current ? (at.here || stop.people).length : stop.count;
  r.append(k, nodeEl(act), w, countEl(hereN));
  bar.appendChild(r);
  const dock = document.getElementById('dock');
  bar.style.bottom = `${Math.round(dock.getBoundingClientRect().height) - 1}px`;
  document.body.appendChild(bar);
  return bar;
}
// The next MOST stop (for the bar before doors: the first time most of us meet).
export function firstMost(night) {
  const n = E.M.nights.find((x) => x.night === night);
  return n ? n.items.find((i) => i.kind === 'stop' && i.tier === 'most') : null;
}

// ---- the dock options -----------------------------------------------------------------
// The day row's rule in every option: no tab is ever shown as a sliver. After
// centring, a tab cut by the left edge is scrolled fully out; if that cuts
// one at the right, the row goes to whichever end keeps the active day (and
// NOW, in D1) whole. The fades still say there is more.
function snapRow(days, keep) {
  const row = days.getBoundingClientRect();
  const W = days.clientWidth;
  const max = days.scrollWidth - W;
  const fade = parseFloat(getComputedStyle(days).getPropertyValue('--row-fade')) || 0;
  const tabs = [...days.children].filter((t) => !t.hidden).map((t) => {
    const q = t.getBoundingClientRect();
    const l = q.left - row.left + days.scrollLeft;
    return { t, l, r: l + q.width };
  });
  const want = days.scrollLeft; // the centred position the caller chose
  const cands = new Set([0, max]);
  for (const x of tabs) { cands.add(x.l); cands.add(x.r - W); }
  let best = null;
  for (let c of cands) {
    c = Math.max(0, Math.min(max, c));
    const shown = (x) => Math.max(0, Math.min(x.r, c + W) - Math.max(x.l, c));
    if (!keep.every((k) => { const x = tabs.find((y) => y.t === k); return x && shown(x) >= (x.r - x.l) - 0.5; })) continue;
    // A sliver: part of a tab showing beyond what the edge fade hides.
    const slivers = tabs.filter((x) => { const v = shown(x); return v > fade && v < (x.r - x.l) - 0.5; }).length;
    const score = slivers * 10000 + Math.abs(c - want);
    if (!best || score < best.score) best = { c, score };
  }
  if (best) days.scrollLeft = best.c;
  const over = days.scrollWidth > days.clientWidth + 1;
  days.classList.toggle('overflowing', over);
  days.classList.toggle('more-left', over && days.scrollLeft > 1);
  days.classList.toggle('more-right', over && days.scrollLeft < days.scrollWidth - days.clientWidth - 1);
}
// D1: NOW is a tab in the scrolling day row, right after the day that is live,
// and the row keeps that pair in view.
export function dockD1({ day = 'SAT' } = {}) {
  const now = document.getElementById('dock-now');
  const days = document.getElementById('dock-days');
  const tab = [...days.querySelectorAll('.day-tab')].find((t) => t.textContent.trim().startsWith(day));
  now.hidden = false;
  now.classList.remove('compact');
  now.classList.add('in-row');
  document.getElementById('dock').classList.remove('squeezed');
  days.style.minWidth = '';
  tab.after(now);
  // Keep the live day and NOW together in view (centre the pair).
  const r = days.getBoundingClientRect();
  const a = tab.getBoundingClientRect();
  const b = now.getBoundingClientRect();
  days.scrollLeft += ((a.left + b.right) / 2) - (r.left + r.width / 2);
  snapRow(days, [tab, now]);
}
// R3: the plan bar carries now, so the dock has no NOW tab at all.
export function dockNoNow() {
  const now = document.getElementById('dock-now');
  now.hidden = true;
  document.getElementById('dock').classList.remove('squeezed');
  const days = document.getElementById('dock-days');
  days.style.minWidth = '';
  const act = days.querySelector('.day-tab.active');
  if (act) { const r = days.getBoundingClientRect(); const a = act.getBoundingClientRect(); days.scrollLeft += (a.left + a.width / 2) - (r.left + r.width / 2); }
  snapRow(days, act ? [act] : []);
}
// D2: NOW leaves the dock and floats just above it, centred, while live.
export function dockD2({ label = null } = {}) {
  const now = document.getElementById('dock-now');
  now.hidden = true;
  document.getElementById('dock').classList.remove('squeezed');
  const days = document.getElementById('dock-days');
  days.style.minWidth = '';
  document.querySelectorAll('.p-nowfloat').forEach((e) => e.remove());
  const f = mk('button', 'p-nowfloat');
  f.type = 'button';
  f.append(mk('span', 'live'), 'NOW');
  if (label) f.append(mk('span', 't', label));
  const dock = document.getElementById('dock');
  f.style.bottom = `${Math.round(dock.getBoundingClientRect().height) + 12}px`;
  document.body.appendChild(f);
  // The row gets NOW's room back; re-centre the active day like wall.js does.
  const act = days.querySelector('.day-tab.active');
  if (act) { const r = days.getBoundingClientRect(); const a = act.getBoundingClientRect(); days.scrollLeft += (a.left + a.width / 2) - (r.left + r.width / 2); }
  snapRow(days, act ? [act] : []);
}

// The dock's day the frame is looking at (the scrollspy reads the page's top
// line, which a pinned people row now covers).
export function activeDay(day) {
  for (const t of document.querySelectorAll('#dock-days .day-tab')) t.classList.toggle('active', t.textContent.trim().startsWith(day));
}
export function label(text) {
  document.querySelectorAll('.p-label').forEach((e) => e.remove());
  if (text) document.body.appendChild(mk('div', 'p-label', text));
}
export const share = (night, min) => shareTextOf(E.M, E.fest, E.picks, night, min);

// ---- naming (Kevin: "Is 'ours' clear?") -------------------------------------------
// A board inside the real app: each candidate as the chip leading the people
// line and as the day's head, in production classes at the frame's width.
export async function namingBoard({ labels }) {
  await ensureCss();
  document.querySelectorAll('.p-names').forEach((e) => e.remove());
  const board = mk('div', 'p-names');
  board.appendChild(mk('div', 'micro-label', 'What do we call it?'));
  const people = [...document.querySelectorAll('#person-chips .person-chip:not(.ours):not(.add):not(.everyone)')].slice(0, 6);
  for (const L of labels) {
    const blk = mk('div', 'p-name' + (L.pick ? ' pick' : ''));
    const cap = mk('div', 'cap');
    cap.append(mk('b', null, L.chip), mk('span', null, L.note));
    blk.appendChild(cap);
    const line = mk('div', 'line');
    const chip = mk('button', 'person-chip ours');
    chip.append(mk('span', null, L.chip), mk('span', 'chev', '›'));
    line.appendChild(chip);
    line.appendChild(mk('span', 'sep'));
    people.forEach((p, i) => {
      const c = p.cloneNode(true);
      if (L.collide && i === 1) c.classList.add('selected');
      else if (L.collide) c.classList.add('faded');
      line.appendChild(c);
    });
    if (L.collide) {
      const all = mk('button', 'person-chip everyone');
      all.append('everyone', mk('span', 'x', '✕'));
      line.insertBefore(all, line.children[3]);
    }
    blk.appendChild(line);
    blk.appendChild(roomHeadEl('Sat', L.head, `Sep 26 · 9 of us picking`));
    board.appendChild(blk);
  }
  document.body.appendChild(board);
  return board;
}
