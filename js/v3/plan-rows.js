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
//   4 how many picked it     the only number that is not a time
//
// Brand only, never --fest (the accent's four homes). Every fact comes from
// the model (plan.js); this file only draws. The peek is not a copy of a row:
// plan-shelf.js shows this same list through a window (SPEC-ui.md §1).
import * as state from '../state.js';
import { colorIndexOf } from './wall.js';
import { factsFor, sheetCard } from './card-facts.js';
import { hslOf, strokeOf } from './palette.js';
import { forkFor, headlinersOf, tillOf, alsoOf, quietClock, hasAny, STEP } from './plan.js';

// What people read (Kevin, 2026-09-26, after a friend's "my picks are what I
// was interested in, not necessarily what I'm planning to go to"): OUR PICKS,
// and a count is "5 picked" — the app's own word, promising no one's evening.
// The code keeps its plan names (plan.js, #plan, .plan-*).
export const PLAN_NAME = 'Our picks';

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
// A stop's identity across repaints: its night, where and when it starts.
// The rows' FLIP and the peek's window both follow a stop by this. (The
// night joined the key in the plan-days round: the open plan now holds every
// day, and one stage at one start on two nights is two stops.)
export const stopKey = (stop) => `${stop.nightId || ''}|${whereOf(stop)}|${stop.from}`;

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
  const who = whoOf(stop.people, plan, ctx.meName);
  if (who) pl.appendChild(withEl(who));
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
  // The tag's line (.tl): the name's line, so the pill sits level with the name (v3.css).
  const line = () => w.appendChild(mk('span', 'tl'));
  if (tag === 'now') { const t = mk('span', 'plan-tag now'); t.append(mk('i'), 'NOW'); line().appendChild(t); }
  if (tag === 'next') line().appendChild(mk('span', 'plan-tag next', 'NEXT'));
  if (text) w.appendChild(mk('span', 't' + (soft ? ' soft' : ''), text));
  return w;
}

// How many a row counts: "5 picked" for the crew; under a highlight of a few
// (rule 10) "2 of 3"; nothing when every stop must hold all of them (one
// person, or a pair at "two is together") — the count would never change.
const countless = (plan) => !!(plan && plan.group && plan.bar >= plan.group.length);
function countEl(n, plan = null) {
  const c = mk('span', 'plan-n');
  const g = plan && plan.group;
  if (countless(plan)) return c;
  if (g) { c.append(mk('b', null, String(n)), `of ${g.length}`); return c; }
  c.append(mk('b', null, String(n)), 'picked');
  return c;
}
const countWords = (n, plan) => {
  const g = plan && plan.group;
  if (countless(plan)) return '';
  return g ? `${n} of ${g.length}` : `${n} picked`;
};
// Rule 10: under a highlight of a few, the rows say WHO — on the place line
// ("Pier Stage · you + Cy"), when some of them are there and not all (all of
// them needs no names; the count says "3 of 3"). Names are the crew's own and
// stay on this screen: the share text never carries them (planText).
function whoOf(people, plan, meName) {
  const g = plan && plan.group;
  if (!g || g.length < 2 || !people || !people.length || people.length >= g.length || people.length > 3) return null;
  return people.map((p) => (p === meName ? 'you' : p)).sort((a, b) => (b === 'you') - (a === 'you'));
}
const withEl = (who) => mk('span', 'with', who.join(' + '));

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
  // A button: in the open plan a stop row grows its card under it — a tap,
  // Enter or Space, and the touch floor's 44px (the Earlier line's form).
  const r = mk('button', `plan-row ${stop.tier}` + (tag === 'now' ? ' live' : ''));
  r.type = 'button';
  r.dataset.stop = stopKey(stop);
  if (tag) r.dataset.tag = tag;
  const start = `${approxOf(stop, ctx.picks) ? '~' : ''}${quietClock(stop.from)}`;
  const text = tag === 'now' ? `till ${quietClock(tillOf(stop))}` : [dayWord, start].filter(Boolean).join(' ');
  const what = whatEl(stop, { ctx, plan, also, nightLabelOf });
  // Under a highlight the place line names who instead (rule 10): a face per
  // row would say it twice, and for a highlight of one it is always them.
  if (faces && stop.tier === 'most' && !grow && !(plan && plan.group)) what.appendChild(whoEl(stop.people || [], ctx));
  r.append(nodeEl(actFor(stop, ctx.picks), ctx), what, whenEl({ tag, text }), countEl(count, plan));
  r.setAttribute('aria-label', rowWords(stop, { ctx, tag, count, text, plan }));
  r.setAttribute('aria-expanded', grow ? 'true' : 'false');
  return r;
}

// The stop's real card (sheetCard, the notes sheet's header card) — the NOW
// row's on open, or any row a person taps.
export function grownEl(stop, ctx) {
  const act = actFor(stop, ctx.picks);
  // The stop's tier rides along: a big name is "most of us" (v3.css).
  const g = mk('div', `plan-grow ${stop.tier || 'some'}`);
  g.dataset.stop = `grow|${stopKey(stop)}`;
  if (!act) return g;
  const card = sheetCard(factsFor(act.name, ctx, act.occ || null), { onClose() {}, notesChip: false });
  card.querySelectorAll('.sheet-close').forEach((x) => x.remove());
  g.appendChild(card);
  return g;
}

// What a screen reader hears for a row: the whole row as one sentence.
function rowWords(stop, { ctx, tag, count, text, plan = null }) {
  const room = kindOf(stop) !== 'set';
  const act = actFor(stop, ctx.picks);
  const what = room ? whereOf(stop) : (act ? `${act.name}, ${whereOf(stop)}` : whereOf(stop));
  const lead = tag === 'now' ? 'Now: ' : tag === 'next' ? 'Next: ' : '';
  const who = whoOf(stop.people, plan, ctx.meName);
  return [`${lead}${what}`, text, who ? `with ${who.join(' and ')}` : '', countWords(count, plan)].filter(Boolean).join(', ');
}

export function forkRow(f, stop, { ctx, plan = null }) {
  const r = mk('div', 'plan-row or');
  r.dataset.stop = `or|${stopKey(stop)}`;
  const w = mk('span', 'plan-what');
  const nm = mk('span', 'nm');
  const set = kindOf(f) === 'set';
  const name = set ? (actsOf(f)[0] || {}).name || whereOf(f) : whereOf(f);
  const where = set ? whereOf(f) : ((headlinersOf({ ...f, people: f.people || [] }, ctx.picks)[0] || {}).name || '');
  nm.append(mk('i', null, 'or'), name);
  if (where) nm.appendChild(mk('span', 'pl-inline', ` · ${where}`));
  const fwho = whoOf(f.people, plan, ctx.meName);
  if (fwho) nm.appendChild(withEl(fwho));
  w.appendChild(nm);
  const later = f.from >= stop.from + 30;
  r.append(nodeEl(null, ctx), w, whenEl({ text: later ? quietClock(f.from) : '', soft: true }), countEl(f.count, plan));
  r.setAttribute('aria-label', [`or ${name}${where ? `, ${where}` : ''}`, fwho ? `with ${fwho.join(' and ')}` : '', countWords(f.count, plan)].filter(Boolean).join(', '));
  return r;
}

// A stretch nothing gathers the bar in. Rule 9: where a drop-in room does
// gather it, the stretch says where we drift instead — the same quiet row,
// a truer caption ("Between sets · Despacio"), never a stop.
function scatteredRow(it, plan = null, meName = null) {
  const r = mk('div', 'plan-row scattered' + (it.dropIn ? ' drift' : ''));
  r.dataset.stop = `scattered|${it.nightId || ''}|${it.from}`;
  const w = mk('span', 'plan-what');
  if (it.dropIn) {
    // The next row's time says when it ends; "till" here only truncated it.
    const nm = mk('span', 'nm', 'Between sets');
    nm.append(mk('span', 'pl-inline', ` · ${whereOf(it.dropIn)}`));
    w.appendChild(nm);
    r.append(mk('span', 'plan-node'), w, whenEl({ text: quietClock(it.from), soft: true }), countEl(it.dropIn.count, plan));
    r.setAttribute('aria-label', [`Between sets, ${whereOf(it.dropIn)} from ${quietClock(it.from)}`, countWords(it.dropIn.count, plan)].filter(Boolean).join(', '));
    return r;
  }
  w.appendChild(mk('span', 'nm', `Scattered till ${quietClock(it.to)}`));
  r.append(mk('span', 'plan-node'), w, whenEl({ text: quietClock(it.from), soft: true }), mk('span'));
  return r;
}

// Rule 9's quiet line, once a night: a drop-in room, its whole window, and
// how many picked it. Not a stop — no node on the path, never the peek's row,
// never grown — the room the afternoon happens around ("drop in till 9:45 PM").
// "3:30 – 10:30 PM", "11 AM – 3 PM": the start drops its AM/PM when the end shares it.
function spanStart(from, to) {
  const a = quietClock(from);
  const b = quietClock(to);
  const tail = (t) => (t.match(/\s?[AP]M$/) || [''])[0];
  return tail(a) && tail(a) === tail(b) ? a.slice(0, -tail(a).length) : a;
}
function dropInRow(d, { ctx, plan, nowMin = null }) {
  const r = mk('div', 'plan-row dropin');
  r.dataset.stop = `dropin|${stopKey(d)}`;
  const w = mk('span', 'plan-what');
  const act = actsOf(d)[0] || null;
  const name = act ? act.name : whereOf(d);
  // One line, the or line's size: the room's name, then what it is — you drop
  // in until it closes (a room at a venue says the venue after the name).
  // It is the day's, not a time in the day's order: its window rides on the
  // line ("drop in 3:30 – 10:30 PM", once open "drop in till 9:45 PM") and the
  // time column stays empty, so a line leading the day never reads as a row
  // sorted out of order above an 11 AM stop.
  const nm = mk('span', 'nm', name);
  const where = kindOf(d) === 'set' || whereOf(d) === name ? '' : ` · ${whereOf(d)}`;
  const open = Number.isFinite(nowMin) && nowMin >= d.from; // a past night (Infinity) keeps its window
  const span = open ? `till ${quietClock(d.to)}` : `${spanStart(d.from, d.to)} – ${quietClock(d.to)}`;
  nm.append(mk('span', 'pl-inline', ` · drop in ${span}${where}`));
  w.append(nm);
  const node = mk('span', 'plan-node');
  node.setAttribute('aria-hidden', 'true');
  if (act) {
    const f = factsFor(act.name, ctx, act.occ || null);
    node.style.setProperty('--drop-bg', f.background);
  }
  r.append(node, w, countEl(d.count, plan)); // the words take the time column too (v3.css)
  r.setAttribute('aria-label', [`${name}, drop in ${quietClock(d.from)} till ${quietClock(d.to)}${where ? `, ${whereOf(d)}` : ''}`, countWords(d.count, plan)].filter(Boolean).join(', '));
  return r;
}

// The lighter touch's repeat (the rejected alternative, for frames): the
// route going back to a drop-in room it already stopped at.
function backRow(it, { plan }) {
  const r = mk('div', 'plan-row back');
  r.dataset.stop = `back|${stopKey(it)}`;
  const w = mk('span', 'plan-what');
  const nm = mk('span', 'nm');
  nm.append(mk('i', null, 'back to'), whereOf(it));
  w.appendChild(nm);
  r.append(mk('span', 'plan-node'), w, whenEl({ text: quietClock(it.from), soft: true }), countEl(it.count, plan));
  return r;
}

// Two or more stops over fold into one line — the List's grammar for the
// past (`EARLIER · N STOPS ⌄`). It is a button: it opens in place.
function earlierRow(n, open, onToggle, days = []) {
  const r = mk('button', 'plan-row earlier');
  r.type = 'button';
  r.dataset.stop = 'earlier';
  r.setAttribute('aria-expanded', open ? 'true' : 'false');
  const w = mk('span', 'plan-what');
  const nm = mk('span', 'nm');
  // The wall's own words (wall.js pastLine): "Earlier · Thu · Fri", and the
  // same line once open reads "Hide earlier". Today's stops over ride along
  // as a count after the days they follow.
  if (open && days.length) nm.append('Hide earlier');
  else {
    nm.append('Earlier');
    for (const d of days) nm.append(mk('span', 'dot', ' · '), mk('b', null, d));
    if (n) nm.append(mk('span', 'dot', ' · '), mk('b', null, `${n} ${n === 1 ? 'stop' : 'stops'}`));
  }
  w.appendChild(nm);
  const chev = mk('span', 'chev');
  chev.setAttribute('aria-hidden', 'true');
  r.append(mk('span', 'plan-node'), w, mk('span'), chev);
  r.addEventListener('click', onToggle);
  return r;
}

// ---- what the rows show ------------------------------------------------------------
// Two rules the open plan's rows and the Share both read, so the Share never
// names a line the Full rundown does not draw (Sol, round two on the Share's
// release head, 2026-09-26). A stop is over once the route has left it (the
// Earlier fold); a stop's row shows one or-line, forkFor's, and for the NOW
// row only one still to come.
const overAt = (stop, nowMin) => nowMin != null && stop.to <= nowMin;
function orLineOf(stop, { plan, peek, nowMin }) {
  const now = !!(peek && peek.tag === 'now' && peek.stop) && stopKey(peek.stop) === stopKey(stop);
  return forkFor(stop, plan.bar, now ? nowMin : null);
}
// What those two rules give each item of the route at this minute, as one
// string (plan-shelf.js's signature): a minute that folds a stop or moves a
// row's or-line on draws the rows again. Saturday 6:00 PM moves the NOW row's
// or-line from Groove Armada's set to DJ Shadow's and changes nothing else,
// and an open plan kept Groove Armada until the next pick (Sol, round three,
// 2026-09-26).
export function rowsKey(route, { plan, peek = null, nowMin = null } = {}) {
  if (!route) return '';
  return route.items.map((i) => {
    const f = i.kind === 'stop' ? orLineOf(i, { plan, peek, nowMin }) : null;
    return [i.kind, `${i.from}-${i.to}`, i.count || '', i.tier || '', overAt(i, nowMin) ? 'over' : '',
      f ? `${f.place.id}@${f.from}:${f.count}` : ''].join(':');
  }).join(',');
}

// ---- the whole day ---------------------------------------------------------------
// One night's rows: its stops (a grown card under a tapped one), their or
// lines, the scattered stretches, and rule 9's quiet line merged in at its
// start. `route` is plan.night(id); `peek` is peekOf's answer (its stop is
// tagged when it is on this night); `nowMin` is the clock on this night's
// axis (null for a night that is not tonight) — what is over is `.past`;
// `highlight` dims the rows none of them is in (today's model; under rule 10
// the route is already theirs and nothing dims). Returns an array of rows.
function dayRows(route, { ctx, plan, peek = null, nowMin = null, grown = new Set(), nightLabelOf = () => '', dayWord = '', highlight = [], skip = null } = {}) {
  const rows = [];
  if (!route) return rows;
  const tagged = peek && peek.stop ? stopKey(peek.stop) : null;
  // Rule 9's quiet line leads its day: it is the room the day happens around,
  // not a moment in it (sorted in by its start, it landed after a long stop's
  // or line — "or SG Lewis 4:30 PM", then "Despacio 3:30 PM").
  const items = [...(route.dropIns || []), ...route.items];
  for (const it of items) {
    if (skip && skip(it)) continue;
    const past = overAt(it, nowMin);
    if (it.kind === 'scattered') { const r = scatteredRow({ ...it, nightId: route.id }, plan, ctx.meName); if (past) r.classList.add('past'); rows.push(r); continue; }
    if (it.kind === 'dropin') { const r = dropInRow(it, { ctx, plan, nowMin }); if (past) r.classList.add('past'); rows.push(r); continue; }
    if (it.kind === 'back') { const r = backRow(it, { plan }); if (past) r.classList.add('past'); rows.push(r); continue; }
    const key = stopKey(it);
    const tag = key === tagged ? peek.tag : null;
    const r = stopRow(it, {
      ctx, plan, tag, count: tag ? peek.count : it.count, faces: true, also: true,
      grow: grown.has(key), nightLabelOf, dayWord: tag === 'next' ? dayWord : '',
    });
    const dim = !hasAny(it, highlight);
    if (past) r.classList.add('past');
    if (dim) r.classList.add('dim');
    rows.push(r);
    if (grown.has(key)) {
      const g = grownEl(it, ctx);
      if (dim) g.classList.add('dim');
      rows.push(g);
    }
    const f = orLineOf(it, { plan, peek, nowMin });
    if (f) {
      const fr = forkRow(f, it, { ctx, plan });
      if (past) fr.classList.add('past');
      if (!hasAny(f, highlight)) fr.classList.add('dim');
      rows.push(fr);
    }
  }
  return rows;
}

// The path's ends are rows' nodes; a grown card after the last row carries
// no path of its own (v3.css). One path per day: a day head ends it.
function markEnds(rows) {
  let run = [];
  const flush = () => {
    const ends = run.filter((r) => r.classList.contains('plan-row') && !r.classList.contains('dropin'));
    if (ends.length) { ends[0].classList.add('first'); ends[ends.length - 1].classList.add('last'); }
    run = [];
  };
  for (const r of rows) { if (r.classList.contains('plan-day')) flush(); else run.push(r); }
  flush();
}

// The single day (the peek's night) with its own Earlier fold — the model
// before the plan-days round, kept for the tests that read one night.
export function planList(route, { ctx, plan, peek = null, nowMin = null, grown = new Set(),
  earlierOpen = false, onEarlier = () => {}, nightLabelOf = () => '', dayWord = '', highlight = [] } = {}) {
  const list = mk('div', 'plan-list');
  if (!route) return list;
  const rows = [];
  const over = nowMin == null ? [] : route.items.filter((i) => i.kind === 'stop' && i.to <= nowMin);
  const folding = over.length > 1 && !earlierOpen;
  if (over.length > 1) rows.push(earlierRow(over.length, earlierOpen, onEarlier));
  rows.push(...dayRows(route, { ctx, plan, peek, nowMin, grown, nightLabelOf, dayWord, highlight,
    skip: folding ? (i) => i.kind !== 'dropin' && i.to <= nowMin : null }));
  markEnds(rows);
  rows.forEach((r) => list.appendChild(r));
  return list;
}

// ---- every day (the plan-days round, 2026-09-26) ---------------------------------
// Kevin: "yes focus on today but scroll to all future days and include our
// expand past days show option." The open plan lands on the peek's night and
// keeps going: each later night under its own day head, in date order. What
// is before it — the nights already lived and the peek night's stops over —
// folds behind ONE line at the top, in the wall's words ("Earlier · Thu ·
// Fri · 2 stops", open: "Hide earlier"). The peek night's own head is the
// shelf's head while its rows lead the list; once the past is open above it,
// it gets an in-list head like every other day.
//   `plan`, `peek`: as planList; `from`: the night id the list lands on (the
//   peek's); `nowMin`: the clock on that night (null when it is not tonight);
//   `dayOf(id)` → { weekday, sub } for a night's head; `emptyWords(route)` →
//   the line a night with no stop shows.
// Every row carries `data-night`, which is how the shelf knows which day is
// at the top of the view (its head and its Share follow it).
export function planDays(plan, { ctx, peek = null, from = null, nowMin = null, grown = new Set(), earlierOpen = false,
  onEarlier = () => {}, nightLabelOf = () => '', dayWord = '', dayOf = () => ({}), emptyWords = () => '' } = {}) {
  const list = mk('div', 'plan-list days');
  if (!plan || !plan.nights || !plan.nights.length) return list;
  const ids = plan.nights.map((n) => n.id);
  const at = Math.max(0, ids.indexOf(from));
  const before = ids.slice(0, at);
  const route0 = plan.night(ids[at]);
  const overToday = nowMin == null || !route0 ? [] : route0.items.filter((i) => i.kind === 'stop' && i.to <= nowMin);
  const rows = [];
  const tag = (els, id) => { for (const e of els) e.dataset.night = id; return els; };
  const hasPast = before.length > 0 || overToday.length > 0;
  // More than three nights behind (ACL's second weekend has nine): the
  // line names the span, not every night — "Earlier · Sep 29 – Oct 9".
  const pastWords = before.length > 3
    ? [`${(dayOf(before[0]) || {}).date || nightLabelOf(before[0])} – ${(dayOf(before[before.length - 1]) || {}).date || nightLabelOf(before[before.length - 1])}`]
    : before.map((id) => nightLabelOf(id));
  if (hasPast) rows.push(tag([earlierRow(overToday.length, earlierOpen, onEarlier, pastWords)], before[0] || ids[at])[0]);
  const dayHead = (id, { quietPast = false } = {}) => {
    const d = dayOf(id) || {};
    const h = mk('div', 'plan-day room-head');
    const name = mk('span', 'name');
    name.append(mk('span', 'wd', d.weekday || ''));
    h.append(name, mk('span', 'sub', d.date || ''), mk('span', 'line'));
    if (quietPast) h.classList.add('past');
    h.dataset.stop = `day|${id}`;
    return h;
  };
  const emptyRow = (route) => {
    const r = mk('div', 'plan-row empty');
    r.dataset.stop = `empty|${route.id}`;
    const w = mk('span', 'plan-what');
    w.appendChild(mk('span', 'nm', emptyWords(route)));
    r.append(mk('span', 'plan-node'), w, mk('span'), mk('span'));
    return r;
  };
  const night = (id, { head, past = false, clock = null, fold = false }) => {
    const route = plan.night(id);
    if (!route) return;
    const out = [];
    if (head) out.push(dayHead(id, { quietPast: past }));
    const body = dayRows(route, { ctx, plan, peek, nowMin: past ? Infinity : clock, grown, nightLabelOf, dayWord,
      skip: fold ? (i) => i.to <= clock : null });
    if (past) body.forEach((r) => r.classList.add('past'));
    if (!route.stops) {
      const e = emptyRow(route);
      if (past) e.classList.add('past');
      // The quiet drop-in line (if any) stays; the empty line says why there
      // is no stop.
      body.push(e);
    }
    out.push(...body);
    rows.push(...tag(out, id));
  };
  // Nights after the landing one. A run of nights with nothing to show and
  // the same reason (ACL's Mon and Tue between weekends) is ONE head and one
  // line — "MON · TUE  OCT 5 – 6", "Nothing picked yet" — not a ladder of
  // empty days.
  const bare = (id) => { const r = plan.night(id); return r && !r.stops && !(r.dropIns || []).length ? r.why : null; };
  const emptyRun = (run) => {
    const first = dayOf(run[0]) || {};
    const last = dayOf(run[run.length - 1]) || {};
    const h = mk('div', 'plan-day room-head');
    const name = mk('span', 'name');
    name.append(mk('span', 'wd', run.map((id) => (dayOf(id) || {}).weekday || '').join(' · ')));
    // "Oct 5 – 6"; across a month, "Sep 30 – Oct 1".
    const [m1] = (first.date || '').split(' ');
    const [m2, d2] = (last.date || '').split(' ');
    const span = first.date && last.date ? `${first.date} – ${m1 === m2 ? d2 : last.date}` : '';
    h.append(name, mk('span', 'sub', span), mk('span', 'line'));
    h.dataset.stop = `day|${run[0]}`;
    const e = emptyRow(plan.night(run[0]));
    rows.push(...tag([h, e], run[0]));
    for (const id of run.slice(1)) tag([], id);
  };
  if (earlierOpen) for (const id of before) night(id, { head: true, past: true });
  night(ids[at], { head: earlierOpen && before.length > 0, clock: nowMin, fold: !earlierOpen && overToday.length > 0 });
  const later = ids.slice(at + 1);
  for (let i = 0; i < later.length; i++) {
    const why = bare(later[i]);
    let j = i;
    while (why && j + 1 < later.length && bare(later[j + 1]) === why) j++;
    if (j > i) { emptyRun(later.slice(i, j + 1)); i = j; continue; }
    night(later[i], { head: true });
  }
  markEnds(rows);
  rows.forEach((r) => list.appendChild(r));
  return list;
}

// ---- the day as words (the Share, 2026-09-26) --------------------------------------
// What the open plan's Share hands the share sheet (plan-shelf.js), in Kevin's
// shape (his comment on the design round's review page):
//
//   Our crew's main picks for Sat Portola, now till end of day
//
//   Pier Stage for Dog Blood @ now till 10:15pm
//   Ship Tent for Jamie xx @ 10:30pm
//
//   Full rundown: https://fest.kevinhg.com/f/portola-2026#g=…&plan=2026-09-26
//
// At most five: "our top picks overall across all locations based on applied
// filters". The candidates are the rows the open plan is showing — its stops
// the route has not left, and the one or-line each row draws (a fork is a
// real second door: it clears the bar too) — so the text is a digest of the
// Full rundown and never names a line it lacks; the rooms the Show menu hides
// are already left out (the plan's rule 8). A line leaves once what it is for
// is over, and "now" means who is there now. With a highlight on, only the
// highlighted people's. The five with the most of us are kept and read in
// time order. Times as people type them
// ("5:40pm", "~1:30am") and plain punctuation (Kevin: "those en dashes … we
// can type simpler"). Artists, places and times only: no one's name leaves
// the phone, and no count either (his shape has none).
const typed = (min) => quietClock(min).replace(' ', '').toLowerCase();
const andList = (names) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// A stop or a fork as "Location for Title", and the acts it names: a set's
// (or a party's) act; a room's headliners among `people` (whoever of us is
// there — with a highlight on, only the highlighted), unless the room is
// named for the one act in it.
function placeForTitle(stop, picks, people) {
  const where = whereOf(stop);
  if (kindOf(stop) !== 'room') {
    const act = actsOf(stop)[0];
    return { title: act && act.name !== where ? `${where} for ${act.name}` : where, acts: act ? [act.name] : [] };
  }
  const acts = headlinersOf({ ...stop, people }, picks).map((h) => h.name);
  return { title: !acts.length || (acts.length === 1 && acts[0] === where) ? where : `${where} for ${andList(acts)}`, acts };
}

// When a line stops being true: the route moves on (its `to`), or what it is
// for is over — a set's or a party's act (tillOf), a room's close — whichever
// comes first. The route can outrun its act: a blip too short to be a stop
// folds into the stop before it (plan.js routeOf), so Sunday's Zara Larsson
// stop runs to 8:15 on a set that ends at 8:05.
const endOf = (s) => Math.min(...[s.to, tillOf(s), s.place.end].filter((t) => t != null));
// The "till" a live line says: its act's end, a room's stop end, never past
// the place's own end.
const tillText = (s) => { const t = tillOf(s); return t != null && s.place.end != null ? Math.min(t, s.place.end) : t ?? s.place.end ?? null; };
// Who is at a stop or a fork at the minute `now`: its five-minute slice's
// crowd (a stop's timeline, a fork's crowds), never who was there earlier.
const crowdAt = (s, now) => ((s.timeline || s.crowds || []).find((c) => c.t <= now && now < c.t + STEP) || { people: [] }).people;

// Who of us is at a stop or a fork, and how many at once: its crowd — or,
// with a highlight on, only the highlighted people in it (Sol, on the
// release head: the Share named the whole crowd's acts and ranked by the
// whole crew under a highlight). A line on NOW counts the crowd at this
// minute (round two: at 7:15 Ben had left Robyn for Kettama, and a Ben-only
// Share still said Robyn "now"); one still to come reads a stop's timeline, a
// fork's peak crowd, as hasAny does. A person is only ever seated at their
// own picks (plan.js rule 3), so every act this names is one they picked —
// the List's question, filters.js passesPeople.
function whoAt(s, highlight, nowMin) {
  const theirs = (list) => (list || []).filter((p) => !highlight.length || highlight.includes(p));
  if (nowMin != null && s.from <= nowMin) { const people = theirs(crowdAt(s, nowMin)); return { people, count: people.length }; }
  if (!highlight.length) return { people: s.people || [], count: s.count };
  if (!s.timeline) { const people = theirs(s.people); return { people, count: people.length }; }
  const all = new Set();
  let count = 0;
  for (const x of s.timeline) {
    const here = theirs(x.people);
    here.forEach((p) => all.add(p));
    count = Math.max(count, here.length);
  }
  return { people: [...all], count };
}

// The five (`limit`), in time order: { line, from, count, acts, stop } each
// (`stop`: the stop or or-line the line reads). `peek` is the one the rows
// were drawn with — it picks the NOW row's or-line. With a highlight on, a
// count is how many of THEM, and the most of them win, then the earliest (the
// crew's MOST is the rest of the crew's say, not theirs).
export function planPicks(route, { ctx, plan, peek = null, nowMin = null, highlight = [], limit = 5 } = {}) {
  if (!route) return [];
  const hl = highlight || [];
  // One line a place (a set, a room on its night, a party): a room the route
  // comes back to, or that is another stop's or-line later on, is still the
  // one room, at the first time it is ours, counted at its biggest.
  const byPlace = new Map();
  const add = (s) => {
    if (nowMin != null && endOf(s) <= nowMin) return;
    const who = whoAt(s, hl, nowMin);
    if (!who.count) return;
    const key = (s.place && s.place.id) || stopKey(s);
    const had = byPlace.get(key);
    if (!had) { byPlace.set(key, { stop: s, count: who.count, people: new Set(who.people), most: s.tier === 'most' }); return; }
    if (s.from < had.stop.from) { had.stop = s; if (!hl.length) had.people = new Set(who.people); }
    if (hl.length) who.people.forEach((p) => had.people.add(p));
    had.count = Math.max(had.count, who.count);
    had.most = had.most || s.tier === 'most';
  };
  for (const it of route.items) {
    if (it.kind !== 'stop' || overAt(it, nowMin)) continue;
    add(it);
    const f = orLineOf(it, { plan, peek, nowMin });
    if (f) add(f);
  }
  return [...byPlace.values()]
    .sort((a, b) => b.count - a.count || (hl.length ? 0 : b.most - a.most) || a.stop.from - b.stop.from)
    .slice(0, limit)
    .sort((a, b) => a.stop.from - b.stop.from)
    .map(({ stop, count, people }) => {
      const live = nowMin != null && stop.from <= nowMin;
      const till = live ? tillText(stop) : null;
      const when = live ? `now${till != null ? ` till ${typed(till)}` : ''}` : `${approxOf(stop, ctx.picks) ? '~' : ''}${typed(stop.from)}`;
      const { title, acts } = placeForTitle(stop, ctx.picks, [...people]);
      return { line: `${title} @ ${when}`, from: stop.from, count, acts, stop };
    });
}

// `day`: the night as the head names it ("Sat", or "Sat Oct 4" where two
// nights share a weekday); `today`: the plan is tonight's, so the list runs
// from now; `link`: the crew link that opens on the plan.
export function planText(route, { ctx, plan, peek = null, nowMin = null, highlight = [], fest = '', day = '', today = false, link = '' } = {}) {
  // Under a highlight (rule 10) the lines are those people's, and still no
  // name leaves the phone: "our" is whoever is sharing with whom.
  // A highlight of one shares that one person's day, still unnamed: "Picks".
  const whose = plan && plan.group ? (plan.group.length === 1 ? 'Picks' : 'Our picks') : "Our crew's main picks";
  const head = `${whose} for ${[day, fest].filter(Boolean).join(' ')}${today ? ', now till end of day' : ''}`;
  const parts = [head];
  const picks = planPicks(route, { ctx, plan, peek, nowMin, highlight });
  if (picks.length) parts.push(picks.map((x) => x.line).join('\n'));
  if (link) parts.push(`Full rundown: ${link}`);
  return parts.join('\n\n');
}

// The open plan's head, in the wall's head grammar: `SAT OUR PICKS`, then its
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
