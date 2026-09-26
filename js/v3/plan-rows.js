// Our plan's rows (2026-09-26 — Kevin's call #5, the round-three design in
// claude-plans/2026-09-25-portola-live/design/ours-r2, frames Q-* and DT-*).
//
// One row, four columns, the same everywhere it appears — the phone's peek,
// the open day plan, the laptop's corner card and its panel:
//
//   1 the node on the path   the stop's aura (the card's own facts), a ring
//                            for a smaller group; one rail joins them
//   2 what and where         the artist leads (a room: the venue, its
//                            headliners under it); the place is the second
//                            line, with "also …" in the open plan
//   3 when                   NOW over "till …" / NEXT over the start / a quiet
//                            start. The place and this line are ONE style
//                            (Kevin, round three: "same size for place and
//                            time") — a row has two text sizes.
//   4 how many of us         the only number that is not a time
//
// Brand only, never --fest (the accent's four homes). Every fact comes from
// the model (plan.js); this file only draws. The peek is not a copy of a row:
// plan-shelf.js shows this same list through a window (SPEC-ui.md §1).
import * as state from '../state.js';
import { colorIndexOf } from './wall.js';
import { factsFor, sheetCard } from './card-facts.js';
import { hslOf, strokeOf } from './palette.js';
import { forkFor, headlinersOf, tillOf, alsoOf, quietClock } from './plan.js';

export const PLAN_NAME = 'Our plan';

const mk = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// ---- reading a stop ------------------------------------------------------------
const placeOf = (stop) => stop.place || {};
export const kindOf = (stop) => stop.placeKind || placeOf(stop).kind || 'set';
const actsOf = (stop) => stop.acts || placeOf(stop).acts || [];
const whereOf = (stop) => (typeof stop.place === 'string' ? stop.place : placeOf(stop).place) || '';
// A stop's identity across repaints: where and when it starts. The rows'
// FLIP and the peek's window both follow a stop by this.
export const stopKey = (stop) => `${whereOf(stop)}|${stop.from}`;

// The act a node and a grown card speak for: a set's own act; in a room, the
// headliner most of the stop's people picked (else the room's first act).
function actFor(stop, picks) {
  const acts = actsOf(stop);
  if (kindOf(stop) === 'set') return acts[0] || null;
  return headlinersOf(stop, picks)[0] || acts[0] || null;
}

// ---- the pieces ----------------------------------------------------------------
function nodeEl(act, ctx) {
  const n = mk('span', 'plan-node');
  n.setAttribute('aria-hidden', 'true');
  if (act) {
    const f = factsFor(act.name, ctx, act.occ || null);
    n.style.background = f.background;
    if (f.animated) n.classList.add('animated');
  }
  return n;
}

// "also 1:30 AM" (the same night) · "also Thu" (another) · "also Oct 9" (a
// two-weekend fest's other date) — the honest half of "an artist who plays
// twice counts at both" (rule 5).
function alsoText(stop, plan, nightLabelOf) {
  const at = alsoOf(stop, plan) || [];
  if (!at.length) return '';
  const words = at.map((o) => (o.sameNight ? quietClock(o.from) : nightLabelOf(o.nightId)));
  return `also ${[...new Set(words)].join(', ')}`;
}

function whatEl(stop, { ctx, plan, also, nightLabelOf }) {
  const w = mk('span', 'plan-what');
  const room = kindOf(stop) !== 'set';
  const act = actFor(stop, ctx.picks);
  w.append(mk('span', 'nm', room ? whereOf(stop) : (act ? act.name : whereOf(stop))));
  const second = room
    ? headlinersOf(stop, ctx.picks).map((h) => h.name).join(' → ')
    : whereOf(stop);
  const pl = mk('span', 'pl', second);
  if (also) {
    const words = alsoText(stop, plan, nightLabelOf);
    if (words) pl.appendChild(mk('span', 'also', words));
  }
  w.append(pl);
  return w;
}

// The faces on a MOST row (the open plan only): you first, in your colours.
function whoEl(people, ctx) {
  const w = mk('span', 'plan-who');
  w.setAttribute('aria-hidden', 'true');
  const all = state.people();
  for (const n of [...people].sort((a, b) => (b === ctx.meName) - (a === ctx.meName))) {
    const ci = colorIndexOf(n, all[n]);
    const a = mk('span', 'avatar', n.charAt(0).toUpperCase());
    a.style.background = hslOf(ci, 0.5);
    a.style.border = `1px solid ${strokeOf(ci, n === ctx.meName)}`;
    w.appendChild(a);
  }
  return w;
}

function whenEl({ tag = null, text = '', soft = false }) {
  const w = mk('span', 'plan-when');
  if (tag === 'now') { const t = mk('span', 'plan-tag now'); t.append(mk('i'), 'NOW'); w.appendChild(t); }
  if (tag === 'next') w.appendChild(mk('span', 'plan-tag next', 'NEXT'));
  if (text) w.appendChild(mk('span', 't' + (soft ? ' soft' : ''), text));
  return w;
}

function countEl(n) {
  const c = mk('span', 'plan-n');
  c.append(mk('b', null, String(n)), 'of us');
  return c;
}

const approxOf = (stop, picks) => {
  if (kindOf(stop) === 'set') return false;
  const act = actFor(stop, picks);
  return !!(act && act.approx);
};

// ---- a stop as a row ---------------------------------------------------------------
// tag 'now': the time says till when, the count is the count at this minute.
// tag 'next': the time says from when (with the weekday when the stop is not
// tonight's). Otherwise the quiet start. `grow` says the stop's real card is
// grown under it (planList puts it there as the row's next sibling, so the
// row stays one row tall — the peek's window is exactly the row); a grown
// stop's faces are on its card, not repeated on the row.
export function stopRow(stop, opts) {
  const { ctx, plan, tag = null, count = stop.count, faces = false, also = false, grow = false,
    dayWord = '', nightLabelOf = () => '' } = opts;
  const r = mk('div', `plan-row ${stop.tier}` + (tag === 'now' ? ' live' : ''));
  r.dataset.stop = stopKey(stop);
  if (tag) r.dataset.tag = tag;
  const start = `${approxOf(stop, ctx.picks) ? '~' : ''}${quietClock(stop.from)}`;
  const text = tag === 'now' ? `till ${quietClock(tillOf(stop))}` : [dayWord, start].filter(Boolean).join(' ');
  const what = whatEl(stop, { ctx, plan, also, nightLabelOf });
  if (faces && stop.tier === 'most' && !grow) what.appendChild(whoEl(stop.people || [], ctx));
  r.append(nodeEl(actFor(stop, ctx.picks), ctx), what, whenEl({ tag, text }), countEl(count));
  r.setAttribute('aria-label', rowWords(stop, { ctx, tag, count, text }));
  return r;
}

// The stop's real card (sheetCard, the notes sheet's header card) — the NOW
// row's on open, or any row a person taps.
export function grownEl(stop, ctx) {
  const act = actFor(stop, ctx.picks);
  const g = mk('div', 'plan-grow');
  g.dataset.stop = `grow|${stopKey(stop)}`;
  if (!act) return g;
  const card = sheetCard(factsFor(act.name, ctx, act.occ || null), { onClose() {}, notesChip: false });
  card.querySelectorAll('.sheet-close').forEach((x) => x.remove());
  g.appendChild(card);
  return g;
}

// What a screen reader hears for a row: the whole row as one sentence.
function rowWords(stop, { ctx, tag, count, text }) {
  const room = kindOf(stop) !== 'set';
  const act = actFor(stop, ctx.picks);
  const what = room ? whereOf(stop) : (act ? `${act.name}, ${whereOf(stop)}` : whereOf(stop));
  const lead = tag === 'now' ? 'Now: ' : tag === 'next' ? 'Next: ' : '';
  return `${lead}${what}, ${text}, ${count} of us`;
}

export function forkRow(f, stop, { ctx }) {
  const r = mk('div', 'plan-row or');
  r.dataset.stop = `or|${stopKey(stop)}`;
  const w = mk('span', 'plan-what');
  const nm = mk('span', 'nm');
  const set = kindOf(f) === 'set';
  const name = set ? (actsOf(f)[0] || {}).name || whereOf(f) : whereOf(f);
  const where = set ? whereOf(f) : ((headlinersOf({ ...f, people: f.people || [] }, ctx.picks)[0] || {}).name || '');
  nm.append(mk('i', null, 'or'), name);
  if (where) nm.appendChild(mk('span', 'pl-inline', ` · ${where}`));
  w.appendChild(nm);
  const later = f.from >= stop.from + 30;
  r.append(nodeEl(null, ctx), w, whenEl({ text: later ? quietClock(f.from) : '', soft: true }), countEl(f.count));
  r.setAttribute('aria-label', `or ${name}${where ? `, ${where}` : ''}, ${f.count} of us`);
  return r;
}

function scatteredRow(it) {
  const r = mk('div', 'plan-row scattered');
  r.dataset.stop = `scattered|${it.from}`;
  const w = mk('span', 'plan-what');
  w.appendChild(mk('span', 'nm', `Scattered till ${quietClock(it.to)}`));
  r.append(mk('span', 'plan-node'), w, whenEl({ text: quietClock(it.from), soft: true }), mk('span'));
  return r;
}

// Two or more stops over fold into one line — the List's grammar for the
// past (`EARLIER · N STOPS ⌄`). It is a button: it opens in place.
function earlierRow(n, open, onToggle) {
  const r = mk('button', 'plan-row earlier');
  r.type = 'button';
  r.dataset.stop = 'earlier';
  r.setAttribute('aria-expanded', open ? 'true' : 'false');
  const w = mk('span', 'plan-what');
  const nm = mk('span', 'nm');
  nm.append('Earlier', mk('span', 'dot', ' · '), mk('b', null, `${n} ${n === 1 ? 'stop' : 'stops'}`));
  w.appendChild(nm);
  const chev = mk('span', 'chev');
  chev.setAttribute('aria-hidden', 'true');
  r.append(mk('span', 'plan-node'), w, mk('span'), chev);
  r.addEventListener('click', onToggle);
  return r;
}

// ---- the whole day ---------------------------------------------------------------
// `route` is plan.night(id); `peek` is peekOf's answer for this night (or
// null); `nowMin` is the clock on this night's axis (null for a night that is
// not tonight); `grown` is the set of stop keys whose cards are grown under
// their rows. Returns the list element; each row carries data-stop.
export function planList(route, { ctx, plan, peek = null, nowMin = null, grown = new Set(),
  earlierOpen = false, onEarlier = () => {}, nightLabelOf = () => '', dayWord = '' } = {}) {
  const list = mk('div', 'plan-list');
  if (!route) return list;
  let items = route.items;
  const rows = [];
  const over = nowMin == null ? [] : items.filter((i) => i.kind === 'stop' && i.to <= nowMin);
  if (over.length > 1) {
    rows.push(earlierRow(over.length, earlierOpen, onEarlier));
    if (!earlierOpen) items = items.filter((i) => !over.includes(i) && !(i.kind === 'scattered' && i.to <= nowMin));
  }
  const tagged = peek && peek.stop ? stopKey(peek.stop) : null;
  for (const it of items) {
    if (it.kind === 'scattered') { rows.push(scatteredRow(it)); continue; }
    const key = stopKey(it);
    const tag = key === tagged ? peek.tag : null;
    const r = stopRow(it, {
      ctx, plan, tag, count: tag ? peek.count : it.count, faces: true, also: true,
      grow: grown.has(key), nightLabelOf, dayWord: tag === 'next' ? dayWord : '',
    });
    const past = nowMin != null && it.to <= nowMin;
    if (past) r.classList.add('past');
    rows.push(r);
    if (grown.has(key)) rows.push(grownEl(it, ctx));
    const f = forkFor(it, plan.bar, tag === 'now' ? nowMin : null);
    if (f) {
      const fr = forkRow(f, it, { ctx });
      if (past) fr.classList.add('past');
      rows.push(fr);
    }
  }
  // The path's ends are rows' nodes; a grown card after the last row carries
  // no path of its own (v3.css).
  const ends = rows.filter((r) => r.classList.contains('plan-row'));
  if (ends.length) { ends[0].classList.add('first'); ends[ends.length - 1].classList.add('last'); }
  rows.forEach((r) => list.appendChild(r));
  return list;
}

// The open plan's head, in the wall's head grammar: `SAT OUR PLAN`, then its
// sub. (The wall's roomHead is private to wall.js and is a door to notes;
// this one opens nothing, so it is the div form of the same look.)
export function planHead({ weekday, sub }) {
  const h = mk('div', 'room-head');
  const name = mk('span', 'name');
  if (weekday) name.append(mk('span', 'wd', weekday), ' ');
  name.append(mk('span', 'label', PLAN_NAME.toUpperCase()));
  h.append(name, mk('span', 'sub', sub || ''), mk('span', 'line'));
  return h;
}
