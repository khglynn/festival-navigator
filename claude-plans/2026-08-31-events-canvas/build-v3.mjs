// Round 3 — DAY-FIRST (2026-08-31). Kevin's direction after picking round-2's
// venue columns: "It's weird to go fri sat sun fri sat sun fri sat sun.
// Should be friday: portola, afters, folsom" — plus venue filters that
// persist, an answer for four shows stacked in one time slot, and a rule
// that adapts to any event/location/timing shape instead of a snowflake.
// Imports round 2's machinery (real card markup, aura math, time parsing).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AFTERS, FOLSOM, NIGHT_DATE, card, parseTime, hourLabel, esc, PIN, hasDoor, fest } from './build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const lostlands = JSON.parse(readFileSync(resolve(ROOT, 'data/festivals/lost-lands-2026.json'), 'utf8'));

// INLINE=1: embed the app's CSS + fonts so the page is self-contained (for
// publishing as an artifact — the deploy never serves claude-plans/, found
// the hard way 2026-08-31). OUT overrides the output path.
const INLINE = process.env.INLINE === '1';
let INLINED_CSS = '';
if (INLINE) {
  const b64 = (path) => readFileSync(resolve(ROOT, path)).toString('base64');
  let fontsCss = readFileSync(resolve(ROOT, 'assets/fonts/fonts.css'), 'utf8')
    .replace(/url\(['"]?([^'")]+\.woff2)['"]?\)/g, (_, f) => { const rel = f.replace(/^\//, '').replace(/^\.\//, ''); return `url(data:font/woff2;base64,${b64(rel.startsWith('assets/') ? rel : 'assets/fonts/' + rel)})`; });
  INLINED_CSS = fontsCss + '\n' + readFileSync(resolve(ROOT, 'assets/v3-tokens.css'), 'utf8') + '\n' + readFileSync(resolve(ROOT, 'assets/v3.css'), 'utf8');
}
const HEAD_ASSETS = INLINE
  ? `<style>${INLINED_CSS}</style>`
  : `<link rel="stylesheet" href="../../assets/fonts/fonts.css">\n<link rel="stylesheet" href="../../assets/v3-tokens.css">\n<link rel="stylesheet" href="../../assets/v3.css">`;


// ---- THE RULE (MODEL-V3.md states it; this computes it) --------------------
// Per day, per section: venue COLUMNS on a clock only where the clock pays —
// enough timed shows (E>=5), venues that repeat (E/V>=1.5), and most shows
// timed (>=60%). Otherwise TILES, time-sorted. The data decides; festival
// files never declare a layout.
function heuristic(list) {
  const timed = list.filter((e) => e.time);
  const E = timed.length;
  const venues = new Set(timed.map((e) => e.venue));
  const V = Math.max(1, venues.size);
  const R = E / V;
  const T = list.length ? timed.length / list.length : 0;
  const mode = E >= 5 && R >= 1.5 && T >= 0.6 ? 'columns' : 'tiles';
  return { mode, E: list.length, V: new Set(list.map((e) => e.venue)).size, R: R.toFixed(1), T: Math.round(T * 100) };
}

// ---- day tabs (canvas chrome, drawn in the app's tab vocabulary) ----------
const dayTabs = (days, active) => `<div class="v3-tabs">${days.map((d) => `<span class="v3-tab${d === active ? ' on' : ''}">${esc(d)}</span>`).join('')}<span class="v3-tab-fest">${esc(fest.name.toUpperCase())} '26 <i></i></span></div>`;

// ---- section header: sub-rule + the venues chip ---------------------------
function sectionHead(label, sub, { chip = null } = {}) {
  return `<div class="sec-head"><span class="sec-label">${esc(label)}</span><span class="sec-sub">${esc(sub || '')}</span><span class="sec-line"></span>${chip || ''}</div>`;
}


// ---- tiles: time-sorted event cards (timeless sink to the end) ------------
const byTime = (a, b) => {
  const ta = a.time ? parseTime(a.time).start : Infinity;
  const tb = b.time ? parseTime(b.time).start : Infinity;
  return ta - tb || a.name.localeCompare(b.name);
};
// Resting tiles stay CLEAN (Kevin, 2026-08-31): name + time when there is
// one, nothing else — the venue, its map door and any TBA talk live in the
// hold/hover zoom, exactly like the wall's cards.
const eventCard = (e, extra = '') => card(e.name, { time: e.time || null, style: extra });
const tiles = (list) => `<div class="wall-grid">${[...list].sort(byTime).map((e) => eventCard(e)).join('')}</div>`;

// ---- columns: the round-2 night timetable + THE DECK ----------------------
// Three or more sets sharing one venue-slot no longer split into unreadable
// slivers (Kevin's screenshot: names crushed to two letters). They stack as
// ONE deck — the earliest card on top, the rest peeking behind, a count pill
// naming the hour. A tap grows the deck the way every card grows here: in
// place, into a panel holding the full cards (drawn expanded in its frame).
function deckCell(group, col, row, span) {
  const top = group[0];
  const pill = `<span class="deck-pill">${group.length} · ${esc(top.t.startStr)}</span>`;
  return `<div class="deck" style="grid-column:${col};grid-row:${row} / span ${span};">
    <span class="deck-ghost g2"></span><span class="deck-ghost g1"></span>
    ${card(top.name, { cell: true, time: top.t.startStr, style: 'position:relative;min-height:0;height:100%;' })}${pill}</div>`;
}
function columns(list, { deckAt = 3 } = {}) {
  const timed = list.filter((e) => e.time).map((e) => ({ ...e, t: parseTime(e.time) }));
  const tba = list.filter((e) => !e.time);
  const venues = [];
  for (const e of timed) if (!venues.includes(e.venue)) venues.push(e.venue);
  const drawn = timed.map((e) => ({ ...e, endMin: Math.max(e.t.end, e.t.start + 30) }));
  const startRow = Math.floor(Math.min(...drawn.map((e) => e.t.start)) / 15);
  const rows = Math.ceil(Math.max(...drawn.map((e) => e.endMin)) / 15) - startRow;
  const rowsTpl = `repeat(${rows}, 20px)`;
  const colsTpl = `repeat(${venues.length}, minmax(150px, 1fr))`;
  const out = [];
  out.push(`<div class="stage-strip times-wrap" style="position:static"><div class="strip-rail"></div><div class="times-scroll"><div class="times-grid" style="grid-template-columns:${colsTpl};grid-template-rows:32px">${venues.map((v) => `<div class="stage-head"><span class="label">${esc(v)}</span></div>`).join('')}</div></div></div>`);
  const labels = [];
  for (let r = startRow; r < startRow + rows; r++) if (r % 4 === 0) labels.push(`<div class="hour-label" style="grid-row:${r - startRow + 1}">${hourLabel(r * 15)}</div>`);
  // Overlap groups per venue; >= deckAt simultaneous becomes a deck.
  const cells = [];
  for (const v of venues) {
    const mine = drawn.filter((x) => x.venue === v).sort((a, b) => a.t.start - b.t.start);
    const groups = [];
    for (const e of mine) {
      const g = groups.find((gr) => gr.some((o) => e.t.start < o.endMin && o.t.start < e.endMin));
      if (g) g.push(e); else groups.push([e]);
    }
    const col = venues.indexOf(v) + 1;
    for (const g of groups) {
      if (g.length >= deckAt) {
        const row = Math.floor(Math.min(...g.map((e) => e.t.start)) / 15) - startRow + 1;
        const span = Math.max(2, Math.ceil((Math.max(...g.map((e) => e.endMin)) - Math.min(...g.map((e) => e.t.start))) / 15));
        cells.push(deckCell(g, col, row, span));
      } else {
        g.forEach((e, i) => {
          const row = Math.floor(e.t.start / 15) - startRow + 1;
          const span = Math.max(1, Math.ceil((e.endMin - e.t.start) / 15));
          const lane = g.length > 1 ? `width:calc(${(100 / g.length).toFixed(3)}% - 2px);margin-left:${((i * 100) / g.length).toFixed(3)}%;` : '';
          cells.push(card(e.name, { cell: true, tall: span >= 12, until: span >= 12 ? e.t.endStr : null, time: e.t.startStr, style: `grid-column:${col};grid-row:${row} / span ${span};min-height:0;${lane}` }));
        });
      }
    }
  }
  out.push(`<div class="times-wrap"><div class="times-rail" style="grid-template-rows:${rowsTpl}">${labels.join('')}</div><div class="times-scroll"><div class="times-grid" style="grid-template-columns:${colsTpl};grid-template-rows:${rowsTpl}">${cells.join('')}</div></div></div>`);
  if (tba.length) out.push(`<div class="tba"><div class="tba-label">TIME TBA</div><div class="wall-grid">${tba.map((e) => eventCard(e)).join('')}</div></div>`);
  return out.join('\n');
}

// ---- a section, laid out by the rule --------------------------------------
function section(label, list, { chip = null, forceNote = true } = {}) {
  if (!list.length) return '';
  const h = heuristic(list);
  const why = `${h.E} shows · ${h.V} venue${h.V === 1 ? '' : 's'} → ${h.mode}`;
  const body = h.mode === 'columns' ? columns(list) : tiles(list);
  return `${sectionHead(label, forceNote ? why : '', { chip })}\n${body}`;
}

// ---- the main grid, as a SLICE (Saturday evening, the real five stages) ---
function gridSlice(day, fromHour, toHour) {
  const sets = (fest.days[day].artists || [])
    .map((a) => ({ name: a.name, venue: a.stage, time: a.time }))
    .filter((e) => { const t = parseTime(e.time); return t.end > fromHour * 60 && t.start < toHour * 60; });
  // keep the printed stage order, not first-seen order
  const order = fest.days[day].stages;
  sets.sort((a, b) => order.indexOf(a.venue) - order.indexOf(b.venue) || byTime(a, b));
  return columns(sets, { deckAt: 99 }); // the main grid never decks — lanes are rare and real there
}

// ---- frames ---------------------------------------------------------------
const A = (n) => AFTERS.filter((e) => e.night === n);
const F = (n) => FOLSOM.filter((e) => e.night === n);
const TABS = ['THU', 'FRI', 'SAT', 'SUN'];

const fridayFrame = () => `
${dayTabs(TABS, 'FRI')}
<div class="day-rule"><span class="day">FRIDAY</span><span class="date">${NIGHT_DATE.Fri} · NO MAIN STAGES TODAY — PORTOLA WEEK RUNS ALL OVER TOWN</span><span class="line"></span><button class="chip-notes" style="height:17px;flex:none">+ ✎</button></div>
${section('AFTERS', A('Fri'))}
<div class="gap"></div>
${section('FOLSOM', F('Fri'))}`;

const saturdayFrame = () => `
${dayTabs(TABS, 'SAT')}
<div class="day-rule"><span class="day">SATURDAY</span><span class="date">${NIGHT_DATE.Sat} · PIER 80 DOORS 1 PM</span><span class="line"></span><button class="chip-notes" style="height:17px;flex:none">1 ✎</button></div>
${sectionHead('PORTOLA — PIER 80', 'THE MAIN GRID (7–11 PM SLICE SHOWN)')}
${gridSlice('Saturday', 19, 23)}
<div class="gap"></div>
${section('AFTERS', A('Sat'))}
<div class="gap"></div>
${section('FOLSOM', F('Sat'))}`;

// The BUCKET filter (round-3 correction — Kevin: "hide or focus on big
// buckets when we have them like 'afters' 'folsom' or 'portola'"). One chip
// per room the fest has; toggling off hides that room across every day,
// saved per fest on this device. Venue-level filtering was my overreach.
const bucketChip = (label, on) => `<button class="bucket-chip${on ? ' on' : ''}"><span class="bc-check">${on ? '✓' : ''}</span>${esc(label)}</button>`;
const filterFrame = () => `
${dayTabs(TABS, 'SAT')}
<div class="day-rule"><span class="day">SATURDAY</span><span class="date">${NIGHT_DATE.Sat}</span><span class="line"></span></div>
<div class="bucket-row">${bucketChip('PORTOLA', true)}${bucketChip('AFTERS', true)}${bucketChip('FOLSOM', false)}<span class="bucket-note">saved on this device, per fest</span></div>
${sectionHead('PORTOLA — PIER 80', 'THE MAIN GRID (7–11 PM SLICE SHOWN)')}
${gridSlice('Saturday', 19, 23)}
<div class="gap"></div>
${section('AFTERS', A('Sat'))}
<div class="whisper-hidden">Folsom is hidden — tap its chip to bring it back.</div>`;

// The deck: Sunday's Midway pile at rest, and grown into its panel.
const deckFrame = () => {
  const sun = A('Sun');
  const midway = sun.filter((e) => e.venue === 'The Midway' && e.time).map((e) => ({ ...e, t: parseTime(e.time) }));
  return `
${dayTabs(TABS, 'SUN')}
<div class="day-rule"><span class="day">SUNDAY</span><span class="date">${NIGHT_DATE.Sun} · THE 10 PM PILE, SOLVED TWICE</span><span class="line"></span></div>
${sectionHead('AT REST', 'THREE-PLUS SIMULTANEOUS SETS STACK AS ONE DECK — NO MORE TWO-LETTER SLIVERS')}
${columns(sun)}
<div class="gap"></div>
${sectionHead('GROWN', 'A TAP GROWS THE DECK IN PLACE — THE ZOOM’S OWN GESTURE — INTO EVERY CARD, EACH PICKABLE')}
<div class="deck-open-demo">
  <div class="zoom-slot shown" style="position:relative;width:max-content;pointer-events:auto"><div class="deck-panel">
    <div class="deck-panel-head">THE MIDWAY · 10 PM<span class="deck-close">✕</span></div>
    <div class="deck-panel-grid">${midway.map((e) => card(e.name, { time: e.t.startStr + (e.t.endStr ? ` – ${e.t.endStr}` : ''), style: 'min-height:72px;' })).join('')}</div>
  </div></div>
</div>`;
};

// Generalization: Lost Lands' pre-party Wednesday — one venue, no times.
const llFrame = () => {
  const wedKey = 'Wednesday, Sept 16 (Early Arrival Pre-Party)';
  const wed = lostlands.artists.filter((a) => a.day === wedKey).map((a) => ({ name: a.name, venue: 'Legend Valley', time: a.time || null, night: 'Wed' }));
  return `
<div class="v3-tabs"><span class="v3-tab on">WED</span><span class="v3-tab">THU</span><span class="v3-tab">FRI</span><span class="v3-tab">SAT</span><span class="v3-tab">SUN</span><span class="v3-tab-fest">LOST LANDS '26 <i></i></span></div>
<div class="day-rule"><span class="day">WEDNESDAY</span><span class="date">SEP 16 · EARLY ARRIVAL PRE-PARTY</span><span class="line"></span><button class="chip-notes" style="height:17px;flex:none">+ ✎</button></div>
${section('PRE-PARTY', wed)}`;
};

// ---- the page -------------------------------------------------------------
const V3_CSS = `
  body { margin: 0; background: var(--page); color: var(--text-body); font-family: var(--font-ui); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  .sh { max-width: var(--shell-max); margin: 0 auto; padding: 16px var(--sp-gutter) 34px; }
  .day-rule { margin: 18px 0 10px; }
  .gap { height: 16px; }
  .tba { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--hairline); }
  .tba-label { color: var(--text-tertiary); font-size: 11px; font-weight: 800; letter-spacing: var(--track-label); margin-bottom: 8px; }
  /* day tabs — the rail's vocabulary, drawn as canvas chrome */
  .v3-tabs { display: flex; align-items: center; gap: 20px; padding: 8px 0 12px; border-bottom: 1px solid var(--hairline); margin-bottom: 4px; }
  .v3-tab { font-family: var(--font-display); letter-spacing: .06em; font-size: 13px; color: var(--text-tertiary); }
  .v3-tab.on { color: rgb(var(--fest)); box-shadow: 0 2px 0 rgb(var(--fest)); padding-bottom: 3px; }
  .v3-tab-fest { margin-left: auto; font-family: var(--font-display); letter-spacing: .04em; font-size: 12px; color: rgb(var(--fest)); }
  .v3-tab-fest i { display: inline-block; width: 6px; height: 6px; border-radius: 99px; background: var(--sync-ok); }
  /* section heads — the day-rule's quieter sibling */
  .sec-head { display: flex; align-items: baseline; gap: 9px; margin: 14px 0 8px; }
  .sec-label { font-family: var(--font-display); letter-spacing: .07em; font-size: 12.5px; color: var(--text-header); }
  .sec-sub { color: var(--text-tertiary); font-size: 9.5px; font-weight: 700; letter-spacing: .08em; }
  .sec-line { flex: 1; height: 1px; background: var(--hairline); }
  /* the bucket filter — one chip per room, the people-chip vocabulary */
  .bucket-row { display: flex; align-items: center; gap: 7px; margin: 4px 0 12px; }
  .bucket-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 12px; border-radius: var(--r-pill); font: inherit; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; cursor: pointer; background: rgba(var(--fest), .14); border: 1px solid rgba(var(--fest), .55); color: #fff; }
  .bucket-chip .bc-check { font-size: 9px; color: rgb(var(--fest)); }
  .bucket-chip:not(.on) { background: transparent; border-style: dashed; border-color: var(--border-emphasis); color: var(--text-tertiary); }
  .bucket-note { color: var(--text-tertiary); font-size: 10px; font-weight: 600; margin-left: 4px; }
  .whisper-hidden { margin-top: 14px; color: var(--text-tertiary); font-size: 11px; font-weight: 600; }
  /* the deck */
  .deck { position: relative; }
  .deck .card { box-shadow: 0 1px 0 rgba(0,0,0,.3); }
  .deck-ghost { position: absolute; inset: 0; border-radius: var(--r-card); background: var(--card); border: 1px solid var(--hairline); }
  .deck-ghost.g1 { transform: translate(3px, 3px); }
  .deck-ghost.g2 { transform: translate(6px, 6px); opacity: .7; }
  .deck-pill { position: absolute; right: 6px; top: 6px; z-index: 2; background: rgba(var(--brand), .9); color: var(--page); font-size: 8.5px; font-weight: 800; letter-spacing: .04em; border-radius: 999px; padding: 2px 7px; }
  .deck-open-demo { display: flex; justify-content: center; padding: 8px 0 4px; }
  .deck-panel { background: var(--card); border: 1px solid var(--border-emphasis); border-radius: var(--r-card); padding: 10px 12px 12px; box-shadow: 0 10px 28px rgba(0,0,0,.38); }
  .deck-panel-head { display: flex; align-items: center; gap: 14px; justify-content: space-between; font-family: var(--font-display); letter-spacing: .06em; font-size: 11.5px; color: rgb(var(--fest)); margin-bottom: 9px; }
  .deck-close { color: var(--text-tertiary); font-size: 11px; }
  .deck-panel-grid { display: grid; grid-template-columns: repeat(2, 180px); gap: 7px; }
  @media (max-width: 719.98px) { .deck-panel-grid { grid-template-columns: repeat(2, 140px); } }
`;
function frameDoc(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
${HEAD_ASSETS}
<style>:root { --fest: ${fest.accent}; }${V3_CSS}</style></head>
<body><div class="sh">${body}</div></body></html>`;
}

const FRAMES = [];
const addFrame = (id, title, w, caption, body) => FRAMES.push({ id, title, w, caption, body });

addFrame('fri-desktop', 'PORTOLA · FRIDAY — a day holds everything (desktop)', 1440,
  'Day-first: no more fri-sat-sun three times over. Friday has no main stages, so the day is AFTERS then FOLSOM, each laid out by the rule — Friday’s afters earn columns, Folsom lands on tiles. Resting cards stay clean: venue and map door live in the hold/hover zoom, and a missing time simply doesn’t show.',
  fridayFrame());
addFrame('fri-phone', 'PORTOLA · FRIDAY — phone', 390,
  'The same day at 390px: the columns keep the grid’s sideways swipe, the tiles stay vertical. Sections keep their names.',
  fridayFrame());
addFrame('sat-desktop', 'PORTOLA · SATURDAY — grid day + around town (desktop)', 1440,
  'A grid day stacks its rooms: the Pier 80 timetable first (7–11 PM slice shown), then that NIGHT’s afters and Folsom under it. One day, one scroll, everything happening.',
  saturdayFrame());
addFrame('sat-phone', 'PORTOLA · SATURDAY — phone', 390,
  'The grid keeps its sideways swipe (stages are 200 m apart); the around-town sections below it stay vertical.',
  saturdayFrame());
addFrame('filter', 'THE BUCKET FILTER — Folsom toggled off', 1440,
  'One chip per room the fest has — Portola, Afters, Folsom. Toggle a bucket off and it disappears from every day, saved on this device per fest. The whisper is the way back.',
  filterFrame());
addFrame('deck', 'THE DECK — the 10 PM pile at rest and grown', 1440,
  'Sunday’s Midway pile: 3+ simultaneous sets stack as one deck with a count pill instead of two-letter slivers. A tap grows it in place — the zoom’s own gesture — into full, pickable cards.',
  deckFrame());
addFrame('lostlands', 'LOST LANDS · WEDNESDAY — the rule generalizes', 1440,
  'A pre-party day at a single venue with no set times: the heuristic’s floor. One section, tiles, time TBA — no venue columns, no snowflake code. Every fest file lands somewhere sane.',
  llFrame());

const PAGE_CSS = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #08060F; color: var(--text-body); font-family: var(--font-ui); }
  header { max-width: 900px; margin: 0 auto; padding: 40px 24px 8px; }
  h1 { font-family: var(--font-display); letter-spacing: var(--track-display); font-size: var(--fs-screen); color: #fff; margin: 0 0 6px; font-weight: 400; }
  .lede { color: var(--text-secondary); font-size: 13.5px; line-height: 1.55; margin: 0 0 20px; }
  .calls { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
  .call { display: flex; gap: 10px; align-items: baseline; background: var(--card); border: 1px solid var(--border-card); border-radius: var(--r-settings); padding: 12px 14px; }
  .call b { color: rgb(var(--brand)); font-size: 11px; font-weight: 800; letter-spacing: var(--track-label); flex: none; }
  .call span { color: var(--text-body); font-size: 13px; line-height: 1.5; }
  section { max-width: 100%; padding: 26px 24px 0; scroll-margin-top: 12px; }
  .fh { max-width: 900px; margin: 0 auto 10px; }
  .fh h2 { font-family: var(--font-display); letter-spacing: var(--track-display); font-size: var(--fs-day); color: var(--text-header); margin: 0 0 4px; font-weight: 400; }
  .fh p { color: var(--text-tertiary); font-size: 12.5px; line-height: 1.5; margin: 0; max-width: 76ch; }
  .fh .w { color: var(--text-secondary); font-size: 10.5px; font-weight: 800; letter-spacing: var(--track-label); }
  .hold { overflow-x: auto; padding: 12px 0 20px; }
  iframe { border: 1px solid var(--border-card); border-radius: var(--r-settings); background: var(--page); display: block; }
  .jump { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 2px; }
  .jump a { color: var(--text-secondary); font-size: 11px; font-weight: 700; text-decoration: none; background: var(--card); border: 1px solid var(--border-card); border-radius: var(--r-pill); padding: 6px 11px; }
  .jump a:hover { color: #fff; border-color: var(--border-emphasis); }
  footer { max-width: 900px; margin: 0 auto; padding: 10px 24px 60px; color: var(--text-tertiary); font-size: 12px; line-height: 1.6; }
`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Day-First</title>
${HEAD_ASSETS}
<style>:root { --fest: ${fest.accent}; }${PAGE_CSS}</style></head>
<body>
<header>
  <h1>DAY-FIRST</h1>
  <p class="lede">Round 3, from your notes on round 2: one FRIDAY holds Portola, afters and Folsom; the layout inside each section is chosen by the DATA (your columns where venues repeat, tiles where they don’t); venues filter and stay filtered; and the 10 PM pile becomes a deck. Real Portola + Lost Lands data throughout.</p>
  <div class="calls">
    <div class="call"><b>THE RULE</b><span>Per day, per section: <strong>venue columns on a clock</strong> only when the clock pays — 5+ timed shows, venues repeating (≥ 1.5 shows per venue), most shows timed. Otherwise <strong>time-sorted tiles</strong>. Files never declare layouts; the numbers decide (each section header shows its math).</span></div>
    <div class="call"><b>YOUR CALLS</b><span>1 — Does day-first read right on the mixed days? 2 — The deck for the stacked slot: yes/no? 3 — Venue filter placement and the saved-on-device behavior: as drawn?</span></div>
  </div>
  <nav class="jump">${FRAMES.map((f) => `<a href="#${f.id}">${esc(f.title.split(' — ')[0])}${f.w === 390 ? ' · phone' : ''}</a>`).join('')}</nav>
</header>
${FRAMES.map((f) => `<section id="${f.id}">
  <div class="fh"><h2>${esc(f.title)}</h2><p><span class="w">${f.w}px</span> · ${esc(f.caption)}</p></div>
  <div class="hold"><iframe title="${esc(f.title)}" width="${f.w}" height="900" srcdoc="${esc(frameDoc(f.body))}"></iframe></div>
</section>`).join('\n')}
<footer>Frames are iframes so the app’s breakpoints see the frame’s width. Nothing here is built — it is the picture for the three calls above. MODEL-V3.md beside this file carries the rule, the filter’s persistence, and the build sizing.</footer>
<script>
  const fit = () => { for (const f of document.querySelectorAll('iframe')) { try { const h = f.contentDocument && f.contentDocument.body.scrollHeight; if (h) f.style.height = (h + 8) + 'px'; } catch (e) {} } };
  for (const f of document.querySelectorAll('iframe')) f.addEventListener('load', fit);
  window.addEventListener('load', () => { fit(); setTimeout(fit, 400); });
  fit();
</script>
</body></html>
`;
writeFileSync(process.env.OUT || resolve(HERE, 'canvas-v3.html'), html);
console.log('canvas-v3.html', (html.length / 1024).toFixed(1) + ' KB', FRAMES.length, 'frames');
