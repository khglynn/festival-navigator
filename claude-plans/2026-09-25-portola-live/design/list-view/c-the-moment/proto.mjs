// The moment — the prototype, run INSIDE the real v95 app (list-view round,
// direction c, 2026-09-26). Imports the app's own modules by absolute path, so
// every card here is renderCard (the one card), every avatar the notes
// avatar's recipe, every window the stacks' own now window (timeBandsOf).
// Nothing is written anywhere: the rig refuses writes and this file makes none.
//
//   list(dayKey)                every room of the day as a time list (hourly
//                               bands; a band's label is the moment's door)
//   open({ dayKey, min, from }) the moment at `min` (festival-day minutes, the
//                               axis events.js uses) — a fork, one branch a room
//   step(dMin)                  − / + : the moment moves, the fork re-reads
//   freeze(ms)                  pause every running animation at `ms` (frames)
import * as state from '/js/state.js';
import * as model from '/js/v3/model.js';
import { renderCard, colorIndexOf, positionNowMarks } from '/js/v3/wall.js';
import { hslOf, strokeOf } from '/js/v3/palette.js';
import { parseEventTime, occOf, timeBandsOf, nightOf, areaOf, hourLabelOf } from '/js/v3/events.js';

const FID = 'portola-2026';
const ME = 'Ana';
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export async function ensureCss() {
  if (document.getElementById('mo-css')) return;
  const l = document.createElement('link');
  l.id = 'mo-css'; l.rel = 'stylesheet'; l.href = new URL('./proto.css', import.meta.url).href;
  const done = new Promise((r) => { l.onload = r; });
  document.head.appendChild(l);
  await done;
}

// The view context a card needs (app.js keeps its own private; this is its
// shape, read-only: taps do nothing in a frame).
const noop = () => {};
function cardCtx() {
  return { fid: FID, meName: ME, picks: model.picksFor(state.crewDoc, FID), affinity: null, query: '', sort: 'billing', lowPower: false,
    migrationPending: false, filterPeople: [], folded: [], now: null, onTap: noop, onOpenNotes: noop, onOpenDayNotes: noop,
    onOpenFestNotes: noop, onNotesChange: noop, onJoin: noop, onStep: noop, onGuestAsk: noop };
}

// ---- time words ------------------------------------------------------------------
const CLOCK = /^(\d{1,2})(?::(\d{2}))? (AM|PM)$/i;
const split = (s) => { const m = CLOCK.exec(String(s || '').trim()); return m ? { h: m[1], mm: m[2] || null, ap: m[3].toUpperCase() } : null; };
const say = (p, withAp = true) => `${p.h}${p.mm ? `:${p.mm}` : ''}${withAp ? ` ${p.ap}` : ''}`;
// "1:30 PM - 2:20 PM" → "1:30 – 2:20 PM"; "11 AM - 6 PM" stays two meridiems.
function rangeWords(time) {
  const [a, b] = String(time || '').split(' - ');
  const s = split(a); const e = split(b);
  if (!s) return undefined;
  if (!e) return say(s);
  // One meridiem only when both ends sit in the same half-day, in order —
  // "10 AM - 12 AM" is ten in the morning to midnight, never "10 – 12 AM".
  const h24 = (p) => (Number(p.h) % 12) * 60 + Number(p.mm || 0);
  const same = s.ap === e.ap && h24(s) < h24(e);
  return `${say(s, !same)} – ${say(e)}`;
}
// The time line a by-time card says (wall.js byTimeWhen's rule, restated).
function whenOf(m) {
  const e = m.e;
  const close = typeof e.close === 'string' && e.close ? `${e.closeApprox === true ? '~' : ''}${e.close}` : null;
  const t = parseEventTime(e.time);
  if (t && t.endStr) return rangeWords(e.time);
  if (t) return [`${e.approx === true ? '~' : ''}${say(split(t.startStr))}`, close].filter(Boolean).join(' – ');
  if (e.doors) return [`Doors ${e.doors}`, close].filter(Boolean).join(' · ');
  return undefined;
}
const minWords = (min) => { const h = Math.floor(min / 60) % 24; const m = min % 60; return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const shortMin = (min) => { const h = Math.floor(min / 60) % 24; const m = min % 60; return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`; };

// ---- the day's rooms, read off the festival file -----------------------------------
// Each item: { name, from, to, time, place, occ } on the festival-day axis.
const WHERE = { ':fest': 'Pier 80', Afters: 'Around town', Folsom: 'SoMa' };
export function roomsOf(dayKey) {
  const fest = state.fest();
  const meta = fest.dayMeta[dayKey];
  const wd = meta.wd;
  const rooms = [];
  const grid = fest.days && fest.days[dayKey];
  if (grid) {
    rooms.push({ key: ':fest', name: String(fest.name || '').toUpperCase(), where: WHERE[':fest'], items: grid.artists.map((a) => {
      const t = parseEventTime(a.time);
      return { name: a.name, from: t ? t.startMin : null, to: t ? t.endMin : null, time: rangeWords(a.time), place: [a.stage], occ: { day: dayKey, stage: a.stage, time: a.time, weekend: null } };
    }) });
  }
  for (const sec of ['Afters', 'Folsom']) {
    const entries = fest.artists.filter((e) => String(e.day || '').split(' & ').includes(sec) && nightOf(e) === wd);
    if (!entries.length) continue;
    const items = [];
    for (const band of timeBandsOf(entries)) {
      for (const m of band.members) {
        items.push({ name: m.e.name, from: m.startMin ?? m.nowFrom ?? null, to: m.nowTo ?? null, time: whenOf(m), place: [m.venue, areaOf(m.e)].filter(Boolean), occ: occOf(m.e), area: areaOf(m.e) });
      }
    }
    rooms.push({ key: sec, name: sec.toUpperCase(), where: WHERE[sec], items });
  }
  return { iso: meta.iso, wd: meta.wd, tz: fest.timezone, rooms };
}

// ---- the list ------------------------------------------------------------------------
// Every room of the day as a time list, one band an hour; the band's label is
// a door to the moment at that hour (and the band NOW is in says NOW).
export async function list(dayKey, { nowMin = null } = {}) {
  await ensureCss();
  const day = roomsOf(dayKey);
  const ctx = cardCtx();
  const block = document.querySelector(`#wall-root .day-block[data-day="${dayKey}"]`);
  for (const room of day.rooms) {
    const host = block.querySelector(`.room[data-room="${CSS.escape(room.key)}"]`);
    if (!host) continue;
    for (const c of [...host.children]) if (!c.classList.contains('room-head')) c.remove();
    const tl = mk('div', 'time-list');
    tl.dataset.iso = day.iso; tl.dataset.tz = day.tz;
    const bands = new Map();
    for (const it of [...room.items].sort((a, b) => (a.from ?? 1e9) - (b.from ?? 1e9))) {
      const h = it.from == null ? 'tba' : Math.floor(it.from / 60);
      if (!bands.has(h)) bands.set(h, []);
      bands.get(h).push(it);
    }
    for (const [h, items] of bands) {
      const band = mk('div', 'time-band');
      band.dataset.band = String(h);
      const head = mk('div', 'band-head');
      const door = mk('button', 'label band-door', h === 'tba' ? 'Time TBA' : hourLabelOf(h * 60));
      door.type = 'button';
      if (h !== 'tba') { door.dataset.min = String(h * 60); door.setAttribute('aria-label', `What's on at ${hourLabelOf(h * 60)}, every room`); }
      if (nowMin != null && h !== 'tba' && Math.floor(nowMin / 60) === h) {
        door.classList.add('is-now');
        door.textContent = 'Now';
        door.appendChild(mk('span', 'at', minWords(nowMin)));
      }
      head.append(door, mk('span', 'line'));
      const g = mk('div', 'band-grid');
      for (const it of items) {
        const card = renderCard(it.name, ctx, { time: it.time, place: it.place, occ: it.occ });
        if (it.from != null && it.to != null) { card.dataset.nowFrom = String(it.from); card.dataset.nowTo = String(it.to); }
        g.appendChild(card);
      }
      band.append(head, g);
      tl.appendChild(band);
    }
    host.appendChild(tl);
  }
  positionNowMarks(document.getElementById('wall-root'), new Date());
  return day.rooms.map((r) => `${r.key}:${r.items.length}`).join(' ');
}

// ---- the moment ----------------------------------------------------------------------
const pickers = (picks, name) => Object.entries(picks[name] || {}).filter(([n, l]) => l >= 1 && state.isActivePerson(state.people()[n])).map(([n, l]) => ({ n, l }));
const weight = (ps) => ps.reduce((s, p) => s + p.l, 0);
function avatar(name, size = 18, font = 8) {
  const p = state.people()[name];
  const ci = colorIndexOf(name, p);
  const av = mk('span', 'avatar', (name || '?').charAt(0).toUpperCase());
  av.style.width = `${size}px`; av.style.height = `${size}px`; av.style.fontSize = `${font}px`;
  av.style.background = hslOf(ci, name === ME ? 1 : 0.5);
  av.style.border = `1px solid ${strokeOf(ci, name === ME)}`;
  av.title = name === ME ? `${name} (you)` : name;
  return av;
}
function cluster(names, { max = 6, size, font } = {}) {
  const c = mk('span', 'avatar-cluster');
  const shown = names.slice(0, names.length > max ? max - 1 : max);
  for (const n of shown) c.appendChild(avatar(n, size, font));
  if (names.length > shown.length) { const more = avatar('+', size, font); more.textContent = `+${names.length - shown.length}`; more.style.background = 'var(--card)'; more.style.border = '1px dashed var(--border-emphasis)'; c.appendChild(more); }
  return c;
}
// You first, then by how much each person wants what's on here.
const orderPeople = (map) => [...map.entries()].sort((a, b) => (b[0] === ME) - (a[0] === ME) || b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);

// The branches at `min`: every room with anything on, `from` first (where you
// are), then by how many of us are there. Pure — the frames and the scrub read it.
export function forkAt(dayKey, min, from) {
  const day = roomsOf(dayKey);
  const picks = model.picksFor(state.crewDoc, FID);
  const branches = [];
  for (const room of day.rooms) {
    const on = room.items.filter((it) => it.from != null && it.to != null && it.from <= min && min < it.to);
    if (!on.length) continue;
    const who = new Map();
    const scored = on.map((it) => { const ps = pickers(picks, it.name); for (const p of ps) who.set(p.n, Math.max(who.get(p.n) || 0, p.l)); return { it, ps, w: weight(ps) }; })
      .sort((a, b) => b.w - a.w || b.ps.length - a.ps.length || a.it.from - b.it.from);
    const then = room.items.filter((it) => it.from != null && it.from > min)
      .map((it) => ({ it, ps: pickers(picks, it.name) })).filter((x) => x.ps.length)
      .sort((a, b) => a.it.from - b.it.from).slice(0, 3);
    // Where this branch is: the room's place, sharpened by what's on (a
    // section's parties say their own area — SoMa for most of Folsom).
    const areas = on.map((x) => x.area).filter(Boolean);
    const topArea = areas.sort((a, b) => areas.filter((x) => x === b).length - areas.filter((x) => x === a).length)[0];
    branches.push({ key: room.key, name: room.name, where: topArea || room.where, on: scored, who, then });
  }
  const here = branches.find((b) => b.key === from);
  const rest = branches.filter((b) => b !== here).sort((a, b) => b.who.size - a.who.size);
  const out = here ? [here, ...rest] : rest;
  const top = Math.max(0, ...out.map((b) => b.who.size));
  const most = out.filter((b) => b.who.size === top);
  for (const b of out) { b.here = b === here; b.most = top >= 2 && most.length === 1 && most[0] === b; }
  return { day, min, branches: out };
}

let live = null; // { dayKey, min, from, el, backdrop }

function branchEl(b, i, ctx, prev) {
  const el = mk('div', 'mo-branch');
  el.style.setProperty('--b', String(i));
  el.dataset.room = b.key;
  const head = mk('button', 'mo-bhead');
  head.type = 'button';
  head.setAttribute('aria-label', `${b.name}, ${b.where}${b.here ? '' : ', across town'} — go there`);
  head.append(mk('span', 'name', b.name), mk('span', 'sub', b.here || /around town/i.test(b.where) ? b.where : `${b.where} · across town`));
  const who = mk('div', 'mo-who');
  const names = orderPeople(b.who);
  if (names.length) {
    who.appendChild(cluster(names));
    const others = names.filter((n) => n !== ME).length;
    const count = mk('span', 'count' + (b.most ? ' most' : ''), names.includes(ME) ? (others ? `you + ${others}` : 'just you') : `${names.length} of us`);
    who.appendChild(count);
  } else who.appendChild(mk('span', 'none', 'none of us yet'));
  const cards = mk('div', 'mo-cards');
  const shown = b.on.slice(0, 2);
  for (const { it } of shown) {
    const c = renderCard(it.name, ctx, { time: it.time, place: it.place, occ: it.occ });
    if (prev && !prev.has(`${b.key}|${it.name}`)) c.classList.add('arrive');
    cards.appendChild(c);
  }
  const kids = [head, who, cards];
  if (b.on.length > shown.length) kids.push(mk('div', 'mo-more', `+${b.on.length - shown.length} more on`));
  const then = mk('div', 'mo-then');
  const th = mk('div', 'band-head');
  th.append(mk('span', 'label', 'Then'), mk('span', 'line'));
  then.appendChild(th);
  if (b.then.length) {
    const ol = mk('ol');
    for (const { it, ps } of b.then) {
      const li = mk('li', ps.some((p) => p.n === ME) ? 'mine' : null);
      if (prev && !prev.has(`then|${b.key}|${it.name}`)) li.classList.add('arrive');
      li.append(mk('span', 't', shortMin(it.from)), mk('span', 'n', it.name), cluster(orderPeople(new Map(ps.map((p) => [p.n, p.l]))), { max: 4, size: 13, font: 6.5 }));
      ol.appendChild(li);
    }
    then.appendChild(ol);
  } else then.appendChild(mk('div', 'quiet', 'Nothing else picked today'));
  kids.push(then);
  kids.forEach((k, j) => k.style.setProperty('--k', String(j)));
  el.append(...kids);
  return el;
}

// Draw the fork: a stem from the head's centre, one curve down to each branch head.
function drawFork(el, fork) {
  const svg = fork.querySelector('svg.mo-lines');
  const box = fork.getBoundingClientRect();
  const when = el.querySelector('.mo-head .when').getBoundingClientRect();
  const cx = Math.min(Math.max(when.left + when.width / 2 - box.left, 0), box.width);
  const H = 26;
  svg.setAttribute('width', String(box.width)); svg.setAttribute('height', String(H + 2));
  svg.textContent = '';
  const ns = 'http://www.w3.org/2000/svg';
  for (const br of fork.querySelectorAll('.mo-branch')) {
    const r = br.querySelector('.mo-bhead .name').getBoundingClientRect();
    const bx = r.left + r.width / 2 - box.left;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', `M ${cx} 0 C ${cx} ${H * 0.55}, ${bx} ${H * 0.35}, ${bx} ${H}`);
    if (br.dataset.away === '1') p.classList.add('away');
    if (br.dataset.most === '1') p.classList.add('most');
    svg.appendChild(p);
    const len = p.getTotalLength();
    p.style.setProperty('--len', String(Math.ceil(len)));
  }
}

function paint(el, f, { prev = null } = {}) {
  const ctx = cardCtx();
  const when = el.querySelector('.mo-head .when');
  when.textContent = '';
  when.append(mk('span', 'wd', f.day.wd.toUpperCase()), mk('span', 't' + (prev ? ' roll-in' : ''), minWords(f.min)));
  const fork = el.querySelector('.mo-fork');
  fork.textContent = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('mo-lines');
  svg.setAttribute('aria-hidden', 'true');
  fork.appendChild(svg);
  f.branches.forEach((b, i) => {
    const be = branchEl(b, i, ctx, prev);
    be.dataset.away = b.here ? '0' : '1';
    be.dataset.most = b.most ? '1' : '0';
    fork.appendChild(be);
  });
  if (!f.branches.length) fork.appendChild(mk('div', 'mo-more', 'Nothing on at this minute'));
  drawFork(el, fork);
}
const seen = (f) => new Set(f.branches.flatMap((b) => [...b.on.slice(0, 2).map(({ it }) => `${b.key}|${it.name}`), ...b.then.map(({ it }) => `then|${b.key}|${it.name}`)]));

export async function open({ dayKey, min, from = ':fest', instant = false } = {}) {
  await ensureCss();
  close({ instant: true });
  const door = doorAt(dayKey, from, min);
  if (door) door.closest('.band-head').classList.add('open');
  const backdrop = mk('div', 'mo-backdrop' + (instant ? '' : ' enter'));
  const el = mk('section', 'moment' + (instant ? '' : ' enter'));
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'The moment: what is on across every room');
  const grab = mk('div', 'grabber');
  const head = mk('div', 'mo-head');
  const minus = mk('button', 'step', '−'); minus.type = 'button'; minus.setAttribute('aria-label', '15 minutes earlier');
  const plus = mk('button', 'step', '+'); plus.type = 'button'; plus.setAttribute('aria-label', '15 minutes later');
  head.append(minus, mk('div', 'when'), plus);
  const scroll = mk('div', 'mo-scroll');
  scroll.appendChild(mk('div', 'mo-fork'));
  el.append(grab, head, scroll);
  // Desktop: the lens grows from the band it was opened on.
  if (door && window.innerWidth >= 720) {
    const r = door.getBoundingClientRect();
    el.style.setProperty('--mo-x', `${Math.max(24, r.left - 24)}px`);
    el.style.setProperty('--mo-y', `${Math.max(16, r.bottom + 10)}px`);
    el.style.setProperty('--mo-tx', '0 0');
  }
  document.body.append(backdrop, el);
  const f = forkAt(dayKey, min, from);
  paint(el, f);
  live = { dayKey, min, from, el, backdrop, f };
  if (instant) return describe(f);
  await new Promise((r) => setTimeout(r, 30));
  return describe(f);
}
export function step(dMin) {
  if (!live) return null;
  const prev = seen(live.f);
  live.min += dMin;
  live.el.classList.remove('enter'); live.backdrop.classList.remove('enter');
  const f = forkAt(live.dayKey, live.min, live.from);
  paint(live.el, f, { prev });
  live.f = f;
  return describe(f);
}
export function close({ instant = false } = {}) {
  document.querySelectorAll('.band-head.open').forEach((h) => h.classList.remove('open'));
  document.querySelectorAll('.moment, .mo-backdrop').forEach((e) => e.remove());
  live = null;
}
// A frame mid-motion: pause every animation in the document at `ms`.
export function freeze(ms) {
  for (const a of document.getAnimations()) {
    const t = a.effect && a.effect.target;
    if (!t || !t.closest || !t.closest('.moment, .mo-backdrop')) continue; // the app's own (scroll-driven) animations stay theirs
    a.pause(); a.currentTime = ms;
  }
}
export function caption(text) { document.querySelectorAll('.mo-cap').forEach((e) => e.remove()); if (text) document.body.appendChild(mk('div', 'mo-cap', text)); }
const describe = (f) => f.branches.map((b) => `${b.name}${b.here ? '*' : ''}${b.most ? '^' : ''}[${[...b.who.keys()].join(',')}] on:${b.on.map((x) => x.it.name).join('/')} then:${b.then.map((x) => x.it.name).join('/')}`).join('  ||  ');

// Scroll so a room's band sits `y` px below the top of the window.
// The band a minute falls in: the last band in the room that starts at or
// before it (a room with no band starting at 10 PM still has the 9 PM one).
function doorAt(dayKey, room, min) {
  const doors = [...document.querySelectorAll(`#wall-root .day-block[data-day="${dayKey}"] .room[data-room="${CSS.escape(room)}"] .band-door[data-min]`)];
  return doors.filter((d) => Number(d.dataset.min) <= min).pop() || null;
}
export function bandTop(dayKey, room, min, y = 80) {
  const door = doorAt(dayKey, room, min)
    || document.querySelector(`#wall-root .day-block[data-day="${dayKey}"] .room[data-room="${CSS.escape(room)}"] .room-head`);
  window.scrollTo(0, door.getBoundingClientRect().top + window.scrollY - y);
}
export function headTop(dayKey, room, y = 60) {
  const h = document.querySelector(`#wall-root .day-block[data-day="${dayKey}"] .room[data-room="${CSS.escape(room)}"] .room-head`);
  window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - y);
}
