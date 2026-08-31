// Builds canvas.html — a static, pixel-true visual of the two Afters/Folsom
// directions. Frames are iframes (srcdoc) so the app's real media queries see
// the FRAME's width, not the browser window's. Reads the real Portola file at
// build time and emits the markup inline; canvas.html itself loads nothing
// but ../../assets/v3-tokens.css, ../../assets/v3.css and the app's fonts.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const fest = JSON.parse(readFileSync(resolve(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

// ---- real data ------------------------------------------------------------
const events = fest.artists
  .filter((a) => /Afters|Folsom/.test(a.day))
  .map((a) => {
    const [night, ...rest] = (a.stage || '').split(' · ');
    return { name: a.name, day: a.day, night, venue: rest.join(' · '), time: a.time || null };
  });
const AFTERS = events.filter((e) => /Afters/.test(e.day));
const FOLSOM = events.filter((e) => /Folsom/.test(e.day));
const NIGHTS = ['Thu', 'Fri', 'Sat', 'Sun'];
const NIGHT_DATE = { Thu: 'SEP 24', Fri: 'SEP 25', Sat: 'SEP 26', Sun: 'SEP 27' };
const NIGHT_LONG = { Thu: 'THURSDAY', Fri: 'FRIDAY', Sat: 'SATURDAY', Sun: 'SUNDAY' };

// ---- the app's own maths (ported verbatim where it matters) ---------------
const AURA_H = [10, 28, 42, 72, 150, 172, 200, 221, 233, 262, 305, 345];
const BOARD = (() => {
  const b = [{ h: 10, s: 90, l: 62 }, { h: 221, s: 90, l: 62 }, { h: 305, s: 90, l: 62 }, { h: 150, s: 70, l: 50 }];
  for (const h of [42, 262, 172, 345, 200, 72, 28, 233]) b.push({ h, s: 90, l: 62 });
  for (const h of AURA_H) { if (b.length >= 24) break; b.push({ h, s: 75, l: 46 }); }
  return b.slice(0, 24);
})();
const hslOf = (i, a) => { const c = BOARD[i % 24]; return a == null ? `hsl(${c.h},${c.s}%,${c.l}%)` : `hsla(${c.h},${c.s}%,${c.l}%,${a})`; };
const strokeOf = (i, you) => { if (you) return '#fff'; const c = BOARD[i % 24]; return `hsl(${c.h},${Math.min(c.s, 85)}%,82%)`; };
const CARD_BASE = '#1C1731';
const PICK_ALPHA = [0.5, 0.75, 1.0];
const ANCHORS = ['20% 120%', '85% -20%', '-15% 30%', '115% 70%'];
const ordered = (ppl) => [...ppl.filter((p) => p.level === 4), ...ppl.filter((p) => p.level >= 1 && p.level <= 3)];
function auraBackground(people) {
  const all = ordered(people);
  if (!all.length) return { background: CARD_BASE, animated: false };
  const layers = all.map((p, i) => {
    const a = p.level === 4 ? 1 : PICK_ALPHA[p.level - 1];
    return `radial-gradient(130% 130% at ${ANCHORS[i % 4]}, ${hslOf(p.colorIndex, a)} 0%, ${hslOf(p.colorIndex, a * 0.5)} 45%, transparent 78%)`;
  });
  return { background: `${layers.join(', ')}, ${CARD_BASE}`, animated: true };
}
const initialFor = (p, ppl) => {
  const first = p.name.charAt(0).toUpperCase();
  return ppl.some((o) => o !== p && o.name.charAt(0).toUpperCase() === first) ? p.name.slice(0, 2).toUpperCase() : first;
};
function whoCorner(people) {
  const all = ordered(people);
  const musts = all.filter((p) => p.level === 4).slice(0, 2);
  const picks = all.filter((p) => p.level < 4).slice(0, 2);
  const overflow = all.length - (musts.length + picks.length);
  const marks = [
    ...musts.map((p) => ({ kind: 'must', width: 24, label: initialFor(p, people), fill: hslOf(p.colorIndex, 0.5), stroke: strokeOf(p.colorIndex, p.isYou) })),
    ...picks.map((p) => ({ kind: 'pick', width: 4, label: '', fill: hslOf(p.colorIndex, 0.5), stroke: strokeOf(p.colorIndex, p.isYou) })),
  ];
  if (overflow > 0) marks.push({ kind: 'ghost', label: `+${overflow}` });
  return marks;
}
const nameColor = (ppl) => (ordered(ppl).length ? '#fff' : '#B9B3CC');
const subColor = (ppl) => (ordered(ppl).length ? 'rgba(255,255,255,.75)' : '#877FA4');

// ---- a plausible crew so the frames are not a wall of flat cards ----------
// Kevin (you, slot 0), Nhu (1), Kat (2), Ross (3) — the crew from the
// 2026-08-27 set-times drop. Levels: 1-3 picked, 4 must.
const CREW = { Kevin: { colorIndex: 0, isYou: true }, Nhu: { colorIndex: 1 }, Kat: { colorIndex: 2 }, Ross: { colorIndex: 3 } };
const PICKS = {
  Soulwax: { Kevin: 4, Nhu: 3 },
  '2manydjs': { Kevin: 4, Kat: 4, Nhu: 2 },
  Despacio: { Kevin: 3, Ross: 2 },
  'Channel Tres': { Nhu: 4, Kat: 2 },
  Jyoty: { Kat: 1 },
  'Horse Meat Disco': { Kevin: 4, Nhu: 4, Kat: 3, Ross: 2 },
  Overmono: { Kevin: 4, Kat: 4 },
  'Ben UFO': { Kevin: 2 },
  'Two Shell': { Nhu: 3, Ross: 3 },
  'Fatboy Slim': { Kevin: 4, Nhu: 1, Kat: 1, Ross: 4 },
  'SG Lewis': { Kat: 2 },
  horsegiirL: { Nhu: 2 },
  Parcels: { Kevin: 3, Nhu: 3 },
  'Groove Armada': { Ross: 4 },
  'Chloé Caillet': { Kat: 3 },
  'Black Rave Culture': { Ross: 1 },
  'Neil Frances': { Kevin: 1 },
  'Six Sex': { Nhu: 2 },
  'Ranger Trucco': { Kat: 2, Ross: 1 },
  VTSS: { Kevin: 2, Nhu: 1 },
  'Folsom Street Fair': { Kevin: 4, Nhu: 4, Kat: 4, Ross: 3 },
  'Real Bad 37': { Kevin: 3, Ross: 3 },
  DEVIANTS: { Nhu: 2 },
  'PERVERT XXL': { Kat: 4 },
  Magnitude: { Kevin: 1 },
};
const NOTES = { Soulwax: 3, 'Horse Meat Disco': 2, 'Fatboy Slim': 1, 'Folsom Street Fair': 4, Despacio: 1 };
const SPOTIFY = new Set(['Soulwax', '2manydjs', 'Overmono', 'Fatboy Slim', 'Parcels', 'Channel Tres', 'Horse Meat Disco', 'SG Lewis', 'Groove Armada']);
const HOT = new Set(['Soulwax', 'Overmono', 'Fatboy Slim']);

function peopleFor(name) {
  const p = PICKS[name] || {};
  return Object.entries(p).map(([who, level]) => ({ name: who, level, ...CREW[who] }));
}

// ---- time parsing (the events shape: "8 PM", "10 PM - 2 AM") --------------
function toMin(str) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(str.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}
// A night runs into the next morning: anything before 5 AM belongs to the
// night before, so it sorts AFTER 11 PM rather than at the top.
const nightMin = (min) => (min < 5 * 60 ? min + 24 * 60 : min);
function parseTime(time) {
  if (!time) return null;
  const [a, b] = time.split(' - ');
  const start = nightMin(toMin(a));
  let end = b ? nightMin(toMin(b)) : null;
  if (end != null && end <= start) end += 24 * 60;
  return { start, end: end ?? start + 60, startStr: a.trim(), endStr: b ? b.trim() : null, open: !b };
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hourLabel = (mins) => { const h = Math.floor(mins / 60) % 24; return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`; };

// ---- the app's card, as markup -------------------------------------------
function card(name, { cell = false, time = null, tall = false, until = null, style = '', venue = null } = {}) {
  const people = peopleFor(name);
  const { background, animated } = auraBackground(people);
  const cls = 'card' + (cell ? ' cell' : '') + (time && !cell ? ' timed' : '') + (tall ? ' tall' : '');
  const bits = [];
  if (animated) bits.push('<span class="card-grain"></span>');
  bits.push(`<span class="name" style="color:${nameColor(people)}">${esc(name)}</span>`);
  if (time) bits.push(`<span class="time" style="color:${subColor(people)}">${esc(time)}</span>`);
  if (tall && until) bits.push(`<span class="until" style="color:${subColor(people)}">until ${esc(until)}</span>`);
  if (venue) bits.push(hasDoorLate(venue)
    ? `<a class="fest-place time" href="#" style="color:${subColor(people)};font-size:9px;font-weight:600">${PIN}${esc(venue)}</a>`
    : `<span class="time" style="color:${subColor(people)}">${esc(venue)}</span>`);
  if (HOT.has(name)) bits.push('<span class="spot-glow" aria-hidden="true"></span>');
  const chips = [];
  if (NOTES[name]) chips.push(`<button class="chip-notes">${NOTES[name]}</button>`);
  if (SPOTIFY.has(name)) chips.push('<span class="chip-spotify">♫</span>');
  bits.push(`<span class="corner-about">${chips.join('')}</span>`);
  bits.push(`<span class="corner-who">${whoCorner(people).map((m) => (m.kind === 'ghost'
    ? `<span class="mark ghost">${esc(m.label)}</span>`
    : `<span class="mark" style="width:${m.width}px;background:${m.fill};border:1px solid ${m.stroke};font-size:${m.kind === 'must' ? '7.5px' : '0px'}">${esc(m.label)}</span>`)).join('')}</span>`);
  return `<div class="${cls}" style="${style}background:${background}" role="button" tabindex="0">${bits.join('')}</div>`;
}

const PIN = '<svg class="pin" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const hasDoor = (venue) => Boolean((fest.venues || {})[venue]);
function hasDoorLate(v) { return Boolean((fest.venues || {})[v]); }
const dayRule = (head, sub, noteCount = null) => `<div class="day-rule"><span class="day">${esc(head)}</span><span class="date">${esc(sub || '')}</span><span class="line"></span>${noteCount === null ? '' : `<button class="chip-notes" style="height:17px;cursor:pointer;flex:none">${noteCount ? `${noteCount} ✎` : '+ ✎'}</button>`}</div>`;

export { events, AFTERS, FOLSOM, NIGHTS, NIGHT_DATE, NIGHT_LONG, card, dayRule, parseTime, hourLabel, esc, PIN, hasDoor, fest };

// ---- FRAME A — venue columns, one timetable per night ---------------------
// The exact grammar of the Sat/Sun grid: sticky stage strip, 15-minute rows
// at 20px, hour rail on the left, .card.cell in the columns. Venues take the
// stage columns. An open-ended set ("8 PM", no end) draws the app's default
// hour; the timeless six sit in a quiet TIME TBA row under their night.
function nightTimetable(night, list) {
  const timed = list.filter((e) => e.time).map((e) => ({ ...e, t: parseTime(e.time) }));
  const tba = list.filter((e) => !e.time);
  const venues = [];
  for (const e of timed) if (!venues.includes(e.venue)) venues.push(e.venue);
  const out = [dayRule(NIGHT_LONG[night], NIGHT_DATE[night], 0)];
  if (timed.length) {
    const drawn = timed.map((e) => ({ ...e, endMin: Math.max(e.t.end, e.t.start + 30) }));
    const startRow = Math.floor(Math.min(...drawn.map((e) => e.t.start)) / 15);
    const rows = Math.ceil(Math.max(...drawn.map((e) => e.endMin)) / 15) - startRow;
    const rowsTpl = `repeat(${rows}, 20px)`;
    const colsTpl = `repeat(${venues.length}, minmax(150px, 1fr))`;
    out.push(`<div class="stage-strip times-wrap" style="position:static"><div class="strip-rail"></div><div class="times-scroll"><div class="times-grid" style="grid-template-columns:${colsTpl};grid-template-rows:32px">${
      venues.map((v) => `<div class="stage-head"><span class="label">${esc(v)}</span></div>`).join('')}</div></div></div>`);
    const labels = [];
    for (let r = startRow; r < startRow + rows; r++) {
      if (r % 4 === 0) labels.push(`<div class="hour-label" style="grid-row:${r - startRow + 1}">${hourLabel(r * 15)}</div>`);
    }
    // Same-venue overlaps split the column into lanes, exactly as the grid does.
    const lanes = new Map();
    for (const v of venues) {
      const groups = [];
      for (const e of drawn.filter((x) => x.venue === v).sort((a, b) => a.t.start - b.t.start)) {
        const g = groups.find((gr) => gr.some((o) => e.t.start < o.endMin && o.t.start < e.endMin));
        if (g) g.push(e); else groups.push([e]);
      }
      for (const g of groups) g.forEach((e, i) => lanes.set(e, { lane: i, lanes: g.length }));
    }
    const cells = drawn.map((e) => {
      const col = venues.indexOf(e.venue) + 1;
      const row = Math.floor(e.t.start / 15) - startRow + 1;
      const span = Math.max(1, Math.ceil((e.endMin - e.t.start) / 15));
      const ln = lanes.get(e);
      const lane = ln && ln.lanes > 1 ? `width:calc(${(100 / ln.lanes).toFixed(3)}% - 2px);margin-left:${((ln.lane * 100) / ln.lanes).toFixed(3)}%;` : '';
      return card(e.name, {
        cell: true, tall: span >= 12, until: span >= 12 ? e.t.endStr : null, time: e.t.startStr,
        style: `grid-column:${col};grid-row:${row} / span ${span};min-height:0;${lane}`,
      });
    });
    out.push(`<div class="times-wrap"><div class="times-rail" style="grid-template-rows:${rowsTpl}">${labels.join('')}</div><div class="times-scroll"><div class="times-grid" style="grid-template-columns:${colsTpl};grid-template-rows:${rowsTpl}">${cells.join('')}</div></div></div>`);
  }
  if (tba.length) {
    out.push(`<div class="tba"><div class="tba-label">TIME TBA</div><div class="wall-grid">${
      tba.map((e) => card(e.name, { time: `${e.night}\n${e.venue}` })).join('')}</div></div>`);
  }
  return out.join('\n');
}
const frameA = () => NIGHTS.map((n) => nightTimetable(n, AFTERS.filter((e) => e.night === n))).join('\n<div class="gap"></div>\n');

// ---- FRAME B — the written proposal: night-grouped, time-sorted cards -----
// renderLineupGroup as it stands today, plus the two things the proposal adds:
// night sub-headers in the day-rule vocabulary, and a real sort inside a night
// (the file is unsorted today). The venue is a map door where venues[venue]
// exists — the same door the zoom's WHERE line opens.
function eventCard(e) {
  const line1 = [e.night, e.time || 'time TBA'].filter(Boolean).join(' · ');
  return card(e.name, { time: line1, venue: e.venue });
}

const byTime = (a, b) => {
  const ta = a.time ? parseTime(a.time).start : Infinity;
  const tb = b.time ? parseTime(b.time).start : Infinity;
  return ta - tb || a.name.localeCompare(b.name);
};
function nightList(night, list) {
  const sorted = [...list].sort(byTime);
  return `${dayRule(NIGHT_LONG[night], NIGHT_DATE[night], 0)}
<div class="wall-grid">${sorted.map(eventCard).join('')}</div>`;
}
const frameB = () => NIGHTS.map((n) => nightList(n, AFTERS.filter((e) => e.night === n))).join('\n<div class="gap"></div>\n');

// ---- FRAME C — venue swim-lanes (a third honest option) ------------------
// Per night, one compact row per venue: the venue name where a stage head
// would be, its sets laid left-to-right in time order. No empty clock to
// scroll past, but the times stay comparable across venues by reading down.
function nightLanes(night, list) {
  const venues = [];
  for (const e of list) if (!venues.includes(e.venue)) venues.push(e.venue);
  const rows = venues.map((v) => {
    const sets = list.filter((e) => e.venue === v).sort(byTime);
    return `<div class="lane"><div class="lane-head"><span class="stage-head" style="background:none;padding:0;height:auto;line-height:1.2;text-align:left;white-space:normal">${esc(v)}</span>${
      hasDoor(v) ? `<a class="fest-place" href="#" style="color:var(--text-tertiary);font-size:9.5px;font-weight:600">${PIN}map</a>` : ''}</div><div class="lane-sets">${
      sets.map((e) => card(e.name, { time: e.time || 'time TBA', style: 'min-height:56px;' })).join('')}</div></div>`;
  });
  return `${dayRule(NIGHT_LONG[night], NIGHT_DATE[night], 0)}<div class="lanes">${rows.join('')}</div>`;
}
const frameC = () => NIGHTS.map((n) => nightLanes(n, AFTERS.filter((e) => e.night === n))).join('\n<div class="gap"></div>\n');

// ---- FOLSOM — the lineup wall's sort control, two sorts -------------------
// Options are the wall's own (js/v3/sort-control.js): Billing / A → Z /
// My picks / Most picked. An events section needs two more — By time, By
// venue — which is the whole question this frame asks.
function sortChip(label, options, selected) {
  return `<span class="sort-wrap"><button class="sort-chip" aria-expanded="true"><span>${esc(label)}</span><span class="caret">▾</span></button>
<ul class="sort-pop" role="listbox" style="display:block;position:static;margin-top:6px">${
    options.map((o) => `<li role="option" aria-selected="${o === selected}"><span class="check">${o === selected ? '✓' : ''}</span><span>${esc(o)}</span></li>`).join('')}</ul></span>`;
}
const FOLSOM_SORTS = ['By time', 'By venue', 'Billing', 'A → Z', 'My picks', 'Most picked'];
function folsomFrame(sort) {
  const list = [...FOLSOM];
  let groups;
  if (sort === 'By time') {
    groups = NIGHTS.filter((n) => list.some((e) => e.night === n))
      .map((n) => ({ head: NIGHT_LONG[n], sub: NIGHT_DATE[n], items: list.filter((e) => e.night === n).sort(byTime) }));
  } else {
    const venues = [...new Set(list.map((e) => e.venue))].sort((a, b) => a.localeCompare(b));
    groups = venues.map((v) => ({ head: v.toUpperCase(), sub: hasDoor(v) ? 'MAP' : '', items: list.filter((e) => e.venue === v).sort(byTime) }));
  }
  return `<div class="toolbar"><span class="search-pill" style="flex:1"><span>⌕</span><input placeholder="Search Folsom" disabled></span>${sortChip(sort, FOLSOM_SORTS, sort)}</div>
${groups.map((g) => `${dayRule(g.head, g.sub, null)}<div class="wall-grid">${g.items.map(eventCard).join('')}</div>`).join('\n')}`;
}

// ---- the page -------------------------------------------------------------
// Every frame is an iframe so the app's real media queries (720px, 1100px)
// evaluate against the FRAME's width, not the browser window's — a 390 phone
// frame in a 1400px window would otherwise render every desktop rule.
const FRAME_CSS = `
  body { margin: 0; background: var(--page); color: var(--text-body);
         font-family: var(--font-ui); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  .sh { max-width: var(--shell-max); margin: 0 auto; padding: 16px var(--sp-gutter) 34px; }
  .day-rule { margin: 20px 0 9px; }
  .gap { height: 10px; }
  /* TIME TBA: the quiet row the timeless six land in. Uses the section
     micro-label vocabulary, nothing new. */
  .tba { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--hairline); }
  .tba-label { color: var(--text-tertiary); font-size: 11px; font-weight: 800;
               letter-spacing: var(--track-label); margin-bottom: 8px; }
  /* Frame C only — swim lanes. */
  .lanes { display: flex; flex-direction: column; gap: 10px; }
  .lane { display: grid; grid-template-columns: 132px 1fr; gap: 10px; align-items: start; }
  .lane-head { display: flex; flex-direction: column; gap: 2px; padding-top: 6px; }
  .lane-sets { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
  .lane-sets .card { flex: none; width: 168px; }
  @media (max-width: 719.98px) { .lane { grid-template-columns: 1fr; gap: 4px; } }
  .toolbar { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 6px; }
  /* Canvas-only: the popover is drawn OPEN and in flow so both states are
     visible at once, so the wrap stacks instead of stretching the chip. */
  .toolbar .sort-wrap { flex-direction: column; align-items: flex-end; flex: none; }
`;
function frameDoc(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../assets/fonts/fonts.css">
<link rel="stylesheet" href="../../assets/v3-tokens.css">
<link rel="stylesheet" href="../../assets/v3.css">
<style>:root { --fest: ${fest.accent}; }${FRAME_CSS}</style></head>
<body><div class="sh">${body}</div></body></html>`;
}
const FRAMES = [];
const addFrame = (id, title, w, caption, body) => FRAMES.push({ id, title, w, caption, body });

addFrame('a-desktop', 'AFTERS · A — venue columns (Kevin\'s picture)', 1440,
  'The main grid\'s exact grammar, one timetable per night, venues as columns. Thursday is two venues wide and mostly air; Sunday runs seven columns and reads like the real thing.',
  frameA());
addFrame('a-phone', 'AFTERS · A — venue columns, phone', 390,
  'Columns hold their 150px floor, so a seven-venue night scrolls sideways under a sticky strip — the same gesture as the Sat/Sun grid, on a night that may only hold one show.',
  frameA());
addFrame('b-desktop', 'AFTERS · B — night-grouped list (the written proposal)', 1440,
  'Night sub-headers in the day-rule vocabulary, time-sorted inside a night, the venue a map door. Every card is the same size whether a night has one show or twelve.',
  frameB());
addFrame('b-phone', 'AFTERS · B — night-grouped list, phone', 390,
  'Two columns, thumb-scroll, nothing sideways. What you lose is "what overlaps what" — the list says when each show starts, never how they stack.',
  frameB());
addFrame('c-desktop', 'AFTERS · C — venue swim-lanes', 1440,
  'Per night, one row per venue, sets left-to-right in time order. No empty clock to scroll past, and a venue with one show costs one row instead of one column.',
  frameC());
addFrame('c-phone', 'AFTERS · C — venue swim-lanes, phone', 390,
  'Below 720 the lane head stacks over its sets and each lane scrolls its own short row — closer to a list than a grid, which is what a one-show venue deserves.',
  frameC());
addFrame('folsom-time', 'FOLSOM — sorted by time', 1440,
  'The lineup wall\'s own sort chip and popover, with two options an events section needs. Grouped by night, then chronological: the Street Fair sits at the top of Sunday where it belongs.',
  folsomFrame('By time'));
addFrame('folsom-venue', 'FOLSOM — sorted by venue', 1440,
  'The same eight cards, grouped by venue instead. Answers "what is on at SVN West" in one glance and loses the night\'s shape — which is why time is the honest default.',
  folsomFrame('By venue'));

const PAGE_CSS = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #08060F; color: var(--text-body); font-family: var(--font-ui); }
  header { max-width: 900px; margin: 0 auto; padding: 40px 24px 8px; }
  h1 { font-family: var(--font-display); letter-spacing: var(--track-display);
       font-size: var(--fs-screen); color: #fff; margin: 0 0 6px; font-weight: 400; }
  .lede { color: var(--text-secondary); font-size: 13.5px; line-height: 1.55; margin: 0 0 20px; }
  .calls { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
  .call { display: flex; gap: 10px; align-items: baseline; background: var(--card);
          border: 1px solid var(--border-card); border-radius: var(--r-settings); padding: 12px 14px; }
  .call b { color: rgb(var(--brand)); font-size: 11px; font-weight: 800;
            letter-spacing: var(--track-label); flex: none; }
  .call span { color: var(--text-body); font-size: 13px; line-height: 1.5; }
  section { max-width: 100%; padding: 26px 24px 0; }
  .fh { max-width: 900px; margin: 0 auto 10px; }
  .fh h2 { font-family: var(--font-display); letter-spacing: var(--track-display);
           font-size: var(--fs-day); color: var(--text-header); margin: 0 0 4px; font-weight: 400; }
  .fh p { color: var(--text-tertiary); font-size: 12.5px; line-height: 1.5; margin: 0; max-width: 76ch; }
  .fh .w { color: var(--text-secondary); font-size: 10.5px; font-weight: 800;
           letter-spacing: var(--track-label); }
  .hold { overflow-x: auto; padding: 12px 0 20px; }
  iframe { border: 1px solid var(--border-card); border-radius: var(--r-settings);
           background: var(--page); display: block; }
  .jump { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 2px; }
  .jump a { color: var(--text-secondary); font-size: 11px; font-weight: 700; text-decoration: none;
            background: var(--card); border: 1px solid var(--border-card);
            border-radius: var(--r-pill); padding: 6px 11px; }
  .jump a:hover { color: #fff; border-color: var(--border-emphasis); }
  section { scroll-margin-top: 12px; }
  footer { max-width: 900px; margin: 0 auto; padding: 10px 24px 60px; color: var(--text-tertiary);
           font-size: 12px; line-height: 1.6; }
`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Afters + Folsom — how events could look (2026-08-31)</title>
<link rel="stylesheet" href="../../assets/fonts/fonts.css">
<link rel="stylesheet" href="../../assets/v3-tokens.css">
<link rel="stylesheet" href="../../assets/v3.css">
<style>:root { --fest: ${fest.accent}; }${PAGE_CSS}</style></head>
<body>
<header>
  <h1>AFTERS + FOLSOM</h1>
  <p class="lede">Real Portola data — all 45 event entries, the real crew colours, the real card. Every frame below is the app's own CSS at the width named on it; nothing here is a mockup of a mockup.</p>
  <div class="calls">
    <div class="call"><b>CALL 1</b><span>Afters: <strong>venue columns on a clock</strong> (A / C) or a <strong>night-grouped, time-sorted list</strong> (B) — the proposal says list, you pictured columns.</span></div>
    <div class="call"><b>CALL 2</b><span>Folsom: the Street Fair lives in the section like everything else, sorted by a <strong>sort control</strong> — and which sort is the default, time or venue?</span></div>
  </div>
  <nav class="jump">${FRAMES.map((f) => `<a href="#${f.id}">${esc(f.title.split(' — ')[0])}${f.w === 390 ? ' · phone' : ''}</a>`).join('')}</nav>
</header>
${FRAMES.map((f) => `<section id="${f.id}">
  <div class="fh"><h2>${esc(f.title)}</h2><p><span class="w">${f.w}px</span> · ${esc(f.caption)}</p></div>
  <div class="hold"><iframe title="${esc(f.title)}" width="${f.w}" height="900" srcdoc="${esc(frameDoc(f.body))}"></iframe></div>
</section>`).join('\n')}
<footer>Frames are iframes so the app's 720px / 1100px breakpoints see the frame's width. Heights are set from each frame's own content on load; without JS they stay at 900px and scroll.</footer>
<script>
  // Size every frame to its own content. Runs on each frame's load, again on
  // window load, and once more a beat later — a frame that finished before
  // this script attached would otherwise sit at its 900px fallback forever.
  const fit = () => {
    for (const f of document.querySelectorAll('iframe')) {
      try {
        const h = f.contentDocument && f.contentDocument.body.scrollHeight;
        if (h) f.style.height = (h + 8) + 'px';
      } catch (e) { /* frame not ready */ }
    }
  };
  for (const f of document.querySelectorAll('iframe')) f.addEventListener('load', fit);
  window.addEventListener('load', () => { fit(); setTimeout(fit, 400); });
  fit();
</script>
</body></html>
`;
writeFileSync(resolve(HERE, 'canvas.html'), html);
console.log('canvas.html', (html.length / 1024).toFixed(1) + ' KB', FRAMES.length, 'frames');
