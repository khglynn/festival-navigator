// OURS — the design prototype, run INSIDE the real app (2026-09-25).
// Loaded by frames.mjs into a page that booted the production app against a
// made-up crew. It imports the app's own modules by the same URLs the app
// uses, so it shares their state: every card here is renderCard's, every
// grown card is sheetCard's, every number is ours-model.mjs's.
import * as state from '../../../../js/state.js';
import * as model from '../../../../js/v3/model.js';
import { renderCard, colorIndexOf } from '../../../../js/v3/wall.js';
import { factsFor, sheetCard, timeRange } from '../../../../js/v3/card-facts.js';
import { hslOf, strokeOf } from '../../../../js/v3/palette.js';
import { auraBackground } from '../../../../js/v3/aura.js';
import { oursModel, oursAt, headlinersOf, clock as clock0 } from './ours-model.mjs';
const clock = (m) => clock0(m).replace(' ', '\u00a0');

const ME = 'Ana';
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const DAYKEY = { Sat: 'Saturday', Sun: 'Sunday' };
const LONG = { Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

export function env() {
  const fest = state.fest();
  const picks = model.picksFor(state.crewDoc, state.activeFestivalId);
  const members = state.activePeople().map(([n]) => n);
  const ctx = { fid: state.activeFestivalId, meName: ME, picks, affinity: {}, lowPower: false, filterPeople: [], weekend: 'all', onTap() {}, onOpenNotes: null };
  PICKS = picks;
  return { fest, picks, ctx, M: oursModel(fest, picks, members) };
}

function ensureCss() {
  if (document.getElementById('ours-proto-css')) return;
  const l = document.createElement('link');
  l.id = 'ours-proto-css';
  l.rel = 'stylesheet';
  l.href = new URL('./ours-proto.css', import.meta.url).href;
  document.head.appendChild(l);
  return new Promise((r) => { l.onload = r; });
}

// ---- small pieces -----------------------------------------------------------
function avatar(name) {
  const people = state.people();
  const ci = colorIndexOf(name, people[name]);
  const a = mk('span', 'avatar', name.charAt(0).toUpperCase());
  a.style.background = hslOf(ci, 0.5);
  a.style.border = '1px solid ' + strokeOf(ci, name === ME);
  return a;
}
function cluster(names, max = 5) {
  const c = mk('span', 'avatar-cluster');
  // You first when you are there (you are the one looking), then crew order.
  const ordered = [...names].sort((a, b) => (b === ME) - (a === ME));
  for (const n of ordered.slice(0, max)) c.appendChild(avatar(n));
  if (names.length > max) { const m = mk('span', 'avatar', `+${names.length - max}`); m.style.background = 'rgba(255,255,255,.08)'; c.appendChild(m); }
  return c;
}
function crowd(people, { avatars = 5 } = {}) {
  const w = mk('span', 'o-crowd');
  if (avatars) w.appendChild(cluster(people, avatars));
  w.appendChild(mk('span', 'n', String(people.length)));
  w.appendChild(mk('span', 'of', 'of us'));
  return w;
}
const split12 = (min, approx = false) => {
  const s = clock0(min);
  const [num, ap] = s.split(' ');
  return { num: (approx ? '~' : '') + num, ap };
};
function timeEl(min, approx) {
  const { num, ap } = split12(min, approx);
  const t = mk('span', 't', num);
  t.appendChild(mk('span', 'ap', ap));
  return t;
}
const whereOf = (place) => (place.kind === 'set' ? place.place : `${place.place} · ${place.room}`);
function actFor(stop, picks) {
  if (stop.place.kind === 'set') return stop.place.acts[0];
  const heads = headlinersOf(stop, picks);
  return heads[0] || stop.place.acts[0];
}
function cardFor(act, ctx) {
  const time = act.time && act.time.includes(' - ') ? timeRange(act.time) : (act.time ? `${act.approx ? '~' : ''}${act.time}` : undefined);
  return renderCard(act.name, ctx, { time, occ: act.occ });
}
let PICKS = {};
function forkLine(f, stop = null) {
  const d = mk('div', 'o-fork');
  d.innerHTML = '<svg width="20" height="18" aria-hidden="true"><path d="M0 0 C0 10 4 13 16 13" fill="none" stroke="rgba(192,132,252,.45)" stroke-width="1.5"/></svg>';
  d.appendChild(mk('span', 'or', 'or'));
  d.appendChild(mk('b', null, `${f.count} at ${f.place.kind === 'set' ? f.place.acts[0].name : f.place.place}`));
  const when = stop && f.from <= stop.from ? `till ${clock(f.to)}` : `from ${clock(f.from)}`;
  const what = f.place.kind === 'set' ? f.place.place : (headlinersOf({ place: f.place, people: f.people }, PICKS)[0] || {}).name || f.place.room;
  d.appendChild(mk('span', 'pl', `${what} · ${when}`));
  d.appendChild(cluster(f.people, 3));
  return d;
}
const splitFork = (stop, bar) => stop.forks.find((f) => f.count >= bar && f.count >= Math.ceil(stop.count * 0.75)
  && (Math.min(f.to, stop.to) - Math.max(f.from, stop.from)) >= 0.6 * (stop.to - stop.from)) || null;

// The three people at the day's biggest stop: the door's three dots.
function doorHues(M, night) {
  const n = M.nights.find((x) => x.night === night) || M.nights.find((x) => x.stops) || null;
  const stops = n ? n.items.filter((i) => i.kind === 'stop') : [];
  const big = stops.sort((a, b) => b.count - a.count)[0];
  const people = state.people();
  return (big ? big.people : Object.keys(people)).slice(0, 3).map((p) => hslOf(colorIndexOf(p, people[p]), 1));
}
export function addOursTab(M, night, { on = false } = {}) {
  document.querySelectorAll('.ours-tab').forEach((e) => e.remove());
  const b = mk('button', 'ours-tab' + (on ? ' on' : ''));
  b.type = 'button';
  b.setAttribute('aria-label', 'Where most of us are');
  const dots = mk('span', 'crowd');
  for (const h of doorHues(M, night)) { const i = mk('i'); i.style.background = h; dots.appendChild(i); }
  b.append(dots, mk('span', 'word', 'OURS'));
  const days = document.getElementById('dock-days');
  days.after(b);
  const now = document.getElementById('dock-now');
  if (now && !now.hidden && innerWidth < 420) now.classList.add('compact');
  return b;
}
export function quietDays() {
  document.querySelectorAll('#dock-days .day-tab.active').forEach((t) => t.classList.remove('active'));
}

// ---- O1: the route ------------------------------------------------------------
function roomHead(wd, label, sub) {
  const h = mk('div', 'room-head');
  const name = mk('span', 'name');
  name.append(mk('span', 'wd', wd.toUpperCase()), ' ', mk('span', 'label', label));
  h.append(name, mk('span', 'sub', sub), mk('span', 'line'));
  return h;
}
function routeOf(night, { M, picks, ctx }, { nowMin = null } = {}) {
  const route = mk('div', 'o-route');
  const rows = [];
  const items = night.items;
  items.forEach((it, i) => {
    if (it.kind === 'scattered') {
      const r = mk('div', 'o-row gap');
      r.style.gridTemplateColumns = '1fr';
      r.appendChild(mk('div', 'o-gapnote', `scattered · ${clock(it.from)} – ${clock(it.to)}`));
      rows.push({ r, it });
      return;
    }
    const sf = splitFork(it, M.bar);
    const act = actFor(it, picks);
    const approx = it.place.kind === 'room' && act.approx;
    if (sf) {
      const r = mk('div', 'o-row split');
      r.appendChild(mk('span', 'o-node'));
      const w = mk('div', 'o-when');
      w.append(timeEl(Math.max(it.from, sf.from), approx), mk('span', 'where', 'split'));
      r.appendChild(w);
      for (const side of [{ place: it.place, people: it.people, stop: it }, { place: sf.place, people: sf.people, stop: { ...sf, place: sf.place, people: sf.people } }]) {
        const cell = mk('div');
        const a = actFor(side.stop, picks);
        cell.appendChild(cardFor(a, ctx));
        const cap = mk('div', 'o-split-cap');
        cap.append(crowd(side.people, { avatars: 4 }), mk('span', 'pl', whereOf(side.place)));
        cell.appendChild(cap);
        r.appendChild(cell);
      }
      rows.push({ r, it });
      return;
    }
    if (it.tier === 'most') {
      const r = mk('div', 'o-row most');
      r.appendChild(mk('span', 'o-node'));
      const w = mk('div', 'o-when');
      w.append(timeEl(it.from, approx), mk('span', 'where', whereOf(it.place)), crowd(it.people));
      if (it.place.kind === 'room') {
        const heads = headlinersOf(it, picks).filter((a) => a.name !== act.name);
        const then = mk('span', 'then');
        if (heads.length) { then.append('then '); heads.forEach((h, k) => { if (k) then.append(', '); then.appendChild(mk('b', null, h.name)); if (h.from != null) then.append(` ${h.approx ? '~' : ''}${clock(h.from)}`); }); then.append(' · '); }
        then.append(`till ${it.place.approx ? '~' : ''}${clock(it.to)}`);
        w.appendChild(then);
      }
      r.appendChild(w);
      const c = cardFor(act, ctx);
      r.appendChild(c);
      for (const f of it.forks.filter((f) => f.count >= M.bar).slice(0, 1)) r.appendChild(forkLine(f, it));
      rows.push({ r, it, card: c, w });
      return;
    }
    const r = mk('div', 'o-row some');
    r.appendChild(mk('span', 'o-node'));
    const line = mk('div', 'o-line');
    const txt = mk('span', 'txt');
    txt.append(mk('span', 'nm', it.place.kind === 'set' ? act.name : `${act.name}`), mk('span', 'pl', whereOf(it.place)));
    line.append(mk('span', 't', clock(it.from)), txt);
    line.appendChild(crowd(it.people, { avatars: 3 }));
    r.appendChild(line);
    const big = it.forks.filter((f) => f.count >= M.bar).sort((a, b) => b.count - a.count)[0];
    if (big) r.appendChild(forkLine(big, it));
    rows.push({ r, it });
  });
  rows.forEach(({ r, it, card, w }, k) => {
    if (k === 0) r.classList.add('first');
    if (k === rows.length - 1) r.classList.add('last');
    if (nowMin != null) {
      if (it.to <= nowMin) r.classList.add('past');
      else if (it.from <= nowMin && nowMin < it.to && it.kind === 'stop') {
        r.classList.add('now');
        if (card) card.classList.add('now');
        if (w) w.insertBefore(mk('span', 'o-nowpill', `NOW · ${clock(nowMin)}`), w.children[1]);
      }
    }
    route.appendChild(r);
  });
  return route;
}

export async function buildO1({ nights = null, nowNight = null, nowMin = null } = {}) {
  await ensureCss();
  const E = env();
  document.querySelectorAll('[data-day="ours"]').forEach((e) => e.remove());
  const block = mk('div', 'day-block');
  block.dataset.day = 'ours';
  const iso = { Thu: 'Sep 24', Fri: 'Sep 25', Sat: 'Sep 26', Sun: 'Sep 27' };
  for (const n of E.M.nights) {
    if (nights && !nights.includes(n.night)) continue;
    const room = mk('div', 'room');
    room.dataset.room = `ours-${n.night}`;
    room.appendChild(roomHead(n.night, 'OURS', `${iso[n.night]} · ${E.M.us.length} of us picking`));
    if (!n.stops) {
      const next = E.M.nights.find((x) => x.stops && ['Thu', 'Fri', 'Sat', 'Sun'].indexOf(x.night) > ['Thu', 'Fri', 'Sat', 'Sun'].indexOf(n.night));
      const first = next ? next.items.find((i) => i.kind === 'stop') : null;
      const p = mk('div', 'o-empty');
      p.append(`Nothing has ${E.M.bar} of us on ${LONG[n.night]}.`);
      if (first) { p.append(' '); p.appendChild(mk('b', null, `${LONG[next.night]} does`)); p.append(`, from ${clock(first.from)}.`); }
      room.appendChild(p);
    } else {
      room.appendChild(routeOf(n, E, { nowMin: nowNight === n.night ? nowMin : null }));
    }
    block.appendChild(room);
  }
  const days = [...document.querySelectorAll('#wall-root > .day-block')];
  days[days.length - 1].after(block);
  addOursTab(E.M, nowNight || 'Sat', { on: true });
  document.querySelectorAll('#dock-days .day-tab.active').forEach((t) => t.classList.remove('active'));
  return E.M;
}

// ---- O2: the crew's highlight, in place --------------------------------------------
// Which card is lit: the place is matched by its occurrence (data-occ), so an
// artist who plays twice lights only where the crew is.
function litMap(M, picks) {
  const lit = new Map(); // key -> count
  const most = new Set();
  const keyOf = (night, place, name) => `${night}|${place}|${name}`;
  for (const n of M.nights) {
    for (const it of n.items) {
      if (it.kind !== 'stop') continue;
      const sides = [{ stop: it }, ...it.forks.filter((f) => f.count >= M.bar).map((f) => ({ stop: { ...f } }))];
      for (const { stop } of sides) {
        const acts = stop.place.kind === 'set' ? stop.place.acts : headlinersOf(stop, picks);
        for (const a of acts) {
          const k = keyOf(n.night, stop.place.place, a.name);
          lit.set(k, Math.max(lit.get(k) || 0, stop.count || stop.people.length));
          if ((stop.count || stop.people.length) * 2 > M.us.length) most.add(k);
        }
      }
    }
  }
  return { lit, keyOf, most };
}
function cardKey(card) {
  let occ = {};
  try { occ = JSON.parse(card.dataset.occ || '{}'); } catch { /* none */ }
  const name = card.dataset.artist;
  if (occ.venue || (occ.stage && occ.stage.includes(' · '))) {
    const [night, venue] = occ.stage && occ.stage.includes(' · ') ? occ.stage.split(' · ') : [null, occ.venue];
    return { night, place: occ.venue || venue, name };
  }
  const wd = { Saturday: 'Sat', Sunday: 'Sun' }[occ.day] || null;
  return { night: wd, place: occ.stage, name };
}
export async function buildO2({ toast = null } = {}) {
  await ensureCss();
  const E = env();
  const { lit, keyOf, most } = litMap(E.M, E.picks);
  // The door: first in the people row, everyone's colour at once.
  const row = document.getElementById('person-chips');
  row.querySelectorAll('.ours, .everyone').forEach((e) => e.remove());
  const chip = mk('button', 'person-chip ours selected');
  const everyone = E.M.us.map((n) => ({ name: n, level: 2, colorIndex: colorIndexOf(n, state.people()[n]), isYou: n === ME }));
  chip.style.background = auraBackground(everyone).background;
  chip.style.backgroundSize = '180% 180%';
  chip.append(mk('span', 'card-grain'), mk('span', null, 'Ours'));
  row.prepend(chip);
  row.querySelectorAll('.person-chip:not(.ours):not(.add)').forEach((c) => c.classList.add('faded'));
  const all = mk('button', 'person-chip everyone');
  all.append('everyone', mk('span', 'x', '✕'));
  row.querySelector('.person-chip.add').before(all);
  // The wall: lit or dim.
  for (const card of document.querySelectorAll('#wall-root .card')) {
    const k = cardKey(card);
    const n = lit.get(keyOf(k.night, k.place, k.name));
    card.querySelectorAll('.o-badge').forEach((b) => b.remove());
    if (n) {
      card.classList.remove('dim');
      const b = mk('span', 'o-badge' + (most.has(keyOf(k.night, k.place, k.name)) ? '' : ' some'));
      b.append(mk('span', 'n', String(n)), card.classList.contains('cell') && card.getBoundingClientRect().width < 120 ? '' : 'of us');
      card.appendChild(b);
    } else card.classList.add('dim');
  }
  if (toast) {
    const root = document.getElementById('toast-root');
    root.textContent = '';
    const t = mk('div', 'undo-toast');
    t.appendChild(mk('span', null, toast));
    root.appendChild(t);
  }
  return E.M;
}
// Edge pills for lit cells scrolled off the side of a grid (call after scrolling).
export function edgePills() {
  document.querySelectorAll('.o-edge').forEach((e) => e.remove());
  for (const scroller of document.querySelectorAll('.times-scroll')) {
    const box = scroller.getBoundingClientRect();
    const host = scroller.parentElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const hostBox = host.getBoundingClientRect();
    for (const cell of scroller.querySelectorAll('.card.cell:not(.dim)')) {
      const r = cell.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      if (r.left >= box.right - 8) {
        const badge = cell.querySelector('.o-badge .n');
        const p = mk('button', 'o-edge');
        p.type = 'button';
        p.setAttribute('aria-label', `${badge ? badge.textContent : ''} of us at ${cell.dataset.artist}, to the right`);
        p.append(mk('span', 'n', badge ? badge.textContent : ''), mk('span', 'chev', '›'));
        p.style.top = `${r.top - hostBox.top + 2}px`;
        host.appendChild(p);
      }
    }
  }
}

// ---- O3: find us, a sheet from the door --------------------------------------------
function nextRow(it, E) {
  const act = actFor(it, E.picks);
  const facts = factsFor(act.name, E.ctx, act.occ);
  const r = mk('div', 'o-next-row' + (it.tier === 'some' ? ' some' : ''));
  const approx = it.place.kind === 'room' && act.approx;
  const t = timeEl(it.from, approx);
  const sw = mk('span', 'sw' + (facts.animated ? ' animated' : ''));
  sw.style.background = facts.background;
  if (facts.animated) sw.style.backgroundSize = '180% 180%';
  r.appendChild(mk('span', 'o-rail'));
  const txt = mk('span', 'txt');
  if (it.place.kind === 'room') {
    const heads = headlinersOf(it, E.picks).map((h) => h.name);
    txt.append(mk('span', 'nm', it.place.place), mk('span', 'pl', `${it.place.room} · ${heads.join(' → ')}`));
  } else {
    txt.append(mk('span', 'nm', act.name), mk('span', 'pl', it.place.place));
  }
  r.append(t, sw, txt, crowd(it.people, { avatars: 0 }));
  return r;
}
function sendBlock() {
  const s = mk('div', 'o-send');
  const b = mk('button', 'btn-tonal', 'Tell a friend where we’ll be');
  s.append(b, mk('div', 'hint', 'Sends places and times — never names, never the crew link.'));
  return s;
}
export async function buildO3({ night, nowMin, dayLabel }) {
  await ensureCss();
  const E = env();
  addOursTab(E.M, night, { on: true });
  document.querySelectorAll('.o-sheet, #o-backdrop').forEach((e) => e.remove());
  const backdrop = mk('div', 'sheet-backdrop');
  backdrop.id = 'o-backdrop';
  const sheet = mk('div', 'sheet o-sheet');
  sheet.appendChild(mk('div', 'grabber'));
  const at = oursAt(E.M, night, nowMin);
  const top = mk('div', 'o-top');
  top.append(mk('span', 'o-live'), mk('span', 'o-kicker', 'Right now'), mk('span', 'o-clock', `· ${dayLabel} ${clock(nowMin)}`));
  sheet.appendChild(top);
  const cur = at.current;
  const sf = cur ? cur.forks.find((f) => f.from <= nowMin && nowMin < f.to && f.count >= E.M.bar) : null;
  if (cur && sf && sf.count >= Math.ceil(cur.count * 0.6)) {
    // Split: two places, both real crowds, side by side on the one column track.
    const a = mk('div', 'o-answer');
    a.append('WE’RE SPLIT ', mk('span', 'soft', `${cur.count} + ${sf.count}`));
    sheet.appendChild(a);
    const grid = mk('div', 'o-split');
    for (const side of [cur, { ...sf, tier: 'some' }]) {
      const cell = mk('div');
      const act = actFor(side, E.picks);
      cell.appendChild(cardFor(act, E.ctx));
      const cap = mk('div', 'o-split-cap');
      cap.append(crowd(side.people, { avatars: 4 }), mk('span', 'pl', side.place.place));
      cell.appendChild(cap);
      grid.appendChild(cell);
    }
    sheet.appendChild(grid);
  } else if (cur) {
    const a = mk('div', 'o-answer');
    const hereN = (at.here || cur.people).length;
    a.append(mk('span', 'n', `${hereN} OF US`), ` AT ${cur.place.place.toUpperCase()}`);
    sheet.appendChild(a);
    const act = actFor(cur, E.picks);
    const till = cur.place.kind === 'set' ? act.to : cur.to;
    sheet.appendChild(mk('div', 'o-sub', `${act.name} · till ${clock(till)}`));
    sheet.appendChild(sheetCard(factsFor(act.name, E.ctx, act.occ), { onClose() {}, notesChip: false }));
    for (const f of cur.forks.filter((f) => f.count >= E.M.bar && f.to > nowMin).slice(0, 1)) {
      const d = forkLine(f, cur);
      d.querySelector('.pl').textContent = `${f.place.kind === 'set' ? f.place.place : f.place.room} · from ${clock(Math.max(f.from, nowMin))}`;
      sheet.appendChild(d);
    }
  } else {
    const a = mk('div', 'o-answer');
    a.append('WE’RE ', mk('span', 'soft', 'SCATTERED'));
    sheet.appendChild(a);
    sheet.appendChild(mk('div', 'o-quiet', at.night && !at.night.stops
      ? `Nothing has ${E.M.bar} of us on ${LONG[night]}.`
      : `Nothing has ${E.M.bar} of us right now.`));
  }
  // Then: the next stops tonight — or, if tonight has none left, the next time most of us meet.
  let later = at.next ? [at.next, ...at.later] : [];
  let head = 'Then';
  if (!later.length) {
    const order = ['Thu', 'Fri', 'Sat', 'Sun'];
    const nx = E.M.nights.find((x) => x.stops && order.indexOf(x.night) > order.indexOf(night));
    if (nx) { later = nx.items.filter((i) => i.kind === 'stop'); head = `Next · ${LONG[nx.night]}`; }
  }
  if (later.length) {
    sheet.appendChild(mk('div', 'micro-label', head));
    if (!cur) {
      // Nothing now: the next meeting IS the answer, grown.
      const first = later[0];
      const act = actFor(first, E.picks);
      const a2 = mk('div', 'o-answer o-answer-sm');
      a2.append(mk('span', 'n', `${first.count} OF US`), ` AT ${first.place.place.toUpperCase()}`);
      sheet.appendChild(a2);
      sheet.appendChild(mk('div', 'o-sub', `from ${clock(first.from)}`));
      sheet.appendChild(sheetCard(factsFor(act.name, E.ctx, act.occ), { onClose() {}, notesChip: false }));
      const fk = splitFork(first, E.M.bar) || first.forks.find((f) => f.count >= E.M.bar);
      if (fk) sheet.appendChild(forkLine(fk, first));
    } else {
      const list = mk('div', 'o-next');
      for (const it of later.slice(0, 3)) list.appendChild(nextRow(it, E));
      sheet.appendChild(list);
    }
  }
  sheet.appendChild(sendBlock());
  const dock = document.getElementById('dock');
  const dockH = dock ? Math.round(dock.getBoundingClientRect().height) : 0;
  sheet.style.bottom = `${dockH}px`;
  backdrop.style.bottom = `${dockH}px`;
  document.body.append(backdrop, sheet);
  if (dock) { dock.style.zIndex = '42'; }
  return E.M;
}

// What "Tell a friend" sends (navigator.share text; the clipboard where there is no share sheet).
export function shareText(M, fest, night, nowMin) {
  const n = M.nights.find((x) => x.night === night);
  if (!n) return '';
  const stops = n.items.filter((i) => i.kind === 'stop');
  const lines = [`${fest.name}, ${LONG[night]}: where most of us will be`];
  for (const s of stops) {
    if (s.to <= nowMin) continue;
    const now = s.from <= nowMin;
    if (!now && s.tier !== 'most') continue;
    const what = s.place.kind === 'set' ? `${s.place.acts[0].name}, ${s.place.place}` : `${s.place.place} (${headlinersOf(s, state.selections ? model.picksFor(state.crewDoc, state.activeFestivalId) : {}).map((h) => h.name).join(', then ')})`;
    lines.push(now ? `Now: ${what}, till ${clock(s.to)}` : `${clock(s.from)}: ${what}`);
  }
  return lines.join('\n');
}
