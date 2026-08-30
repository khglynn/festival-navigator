// Assemble the design-canvas artboards from the fidelity rig. Every wall
// slice is production's own render (rig.mjs -> wall.js); the round's new
// pieces (whisper line, facts panel, expanded-card header, threads, chip
// door) are layered on with the same tokens and classes the app uses.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as R from './rig.mjs';

const REPO = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const HERE = new URL('.', import.meta.url).pathname;
const OUT = `${HERE}out`;
mkdirSync(OUT, { recursive: true });

const read = (p) => readFileSync(p, 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

// ---- the real stylesheets + fonts ---------------------------------------------------
const tokensCss = read(`${REPO}/assets/v3-tokens.css`);
const v3Css = read(`${REPO}/assets/v3.css`);
const indexHtml = read(`${REPO}/index.html`);
const shellCss = indexHtml.slice(indexHtml.indexOf('<style>') + 7, indexHtml.indexOf('</style>'));
const anton = readFileSync(`${REPO}/assets/fonts/anton-400-latin.woff2`).toString('base64');
const inter = readFileSync(`${REPO}/assets/fonts/inter-var-latin.woff2`).toString('base64');
const fontCss = `
@font-face { font-family: 'Anton'; font-style: normal; font-weight: 400; src: url(data:font/woff2;base64,${anton}) format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400 800; src: url(data:font/woff2;base64,${inter}) format('woff2'); }`;
const gearSvg = indexHtml.match(/<svg width="19"[\s\S]*?<\/svg>/)[0];
const searchSvg = indexHtml.match(/<svg width="13"[\s\S]*?<\/svg>/)[0];

const FEST = R.portola;
const ACCENT = FEST.accent; // '56, 189, 248'
const { hsl, stroke, PEOPLE, ME, NAMES } = R;
const model = R.lib.model;
const state = R.lib.state;

// ---- canvas-only CSS: the round's new pieces, in the app's vocabulary ----------------
const canvasCss = `
/* The artboard is a fixed viewport onto the app. */
.vp { position: relative; overflow: hidden; background: var(--page); color: var(--text-body); font-family: var(--font-ui); }
.vp .shell { padding-bottom: 0; }
.vp .clip { overflow: hidden; }
.vp .clip > .times-wrap { position: relative; }
/* Nothing scrolls in a frame: let hover panels escape the timetable's scroller (production would portal them). */
.vp .times-scroll { overflow: visible; }
.vp .day-rail { position: relative; margin-top: 0; }
.vp .stage-strip { position: relative; top: 0; }
.vp .dock { position: absolute; }
.vp .sheet-backdrop, .vp .sheet { position: absolute; }

/* B — the whisper: the day's newest note, one line, at the day's door. */
.day-whisper { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0;
  background: none; border: none; padding: 3px 0 1px; margin: -6px 0 0; cursor: pointer; text-align: left;
  color: var(--text-body); font-family: var(--font-ui); font-size: 12px; line-height: 1.35; }
.day-whisper .avatar { width: 18px; height: 18px; font-size: 8px; }
.day-whisper .who { color: var(--text-secondary); font-weight: 700; flex: none; }
.day-whisper .text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.day-whisper .more { color: var(--text-tertiary); font-size: 10.5px; font-weight: 700; flex: none; white-space: nowrap; }

/* A — only your pins stay inline, at the day's door; no composer on the wall. */
.pins-inline { display: flex; flex-direction: column; gap: 6px; margin: -4px 0 2px; }
.pins-inline .note-row .bubble { padding: 7px 10px; }

/* Hover facts — the card says more when a pointer rests on it. */
.card .facts { display: none; position: absolute; z-index: 30; text-align: left; box-sizing: border-box;
  flex-direction: column; gap: 7px; color: var(--text-body); cursor: default; }
.card.is-hover { overflow: visible; z-index: 20; }
.card.is-hover .facts { display: flex; }
.card.is-hover .note-affordance { display: inline-flex; opacity: 1; }
/* Pointer-fine only: a finger never opens this (touch has the long-press). */
@media (hover: hover) and (pointer: fine) {
  .card:hover { overflow: visible; z-index: 20; }
  .card:hover .facts { display: flex; }
}
.f-name { color: #fff; font-weight: 700; font-size: 15px; line-height: 1.2; position: relative; }
.f-sub { color: rgba(255,255,255,.75); font-size: 11px; font-weight: 600; position: relative; margin-top: -3px; }
.f-people { display: flex; flex-wrap: wrap; gap: 4px; position: relative; }
.f-pill { display: inline-flex; align-items: center; gap: 5px; color: #fff; font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: var(--r-pill); line-height: 1.2; }
.f-pill.you { font-weight: 700; }
.f-pill b { font-size: 7.5px; font-weight: 800; letter-spacing: .06em; }
.f-about { display: flex; align-items: center; gap: 7px; min-width: 0; position: relative; }
.f-chip { height: 16px; padding: 0 7px; font-size: 9.5px; gap: 4px; flex: none; }
.f-note { color: var(--text-body); font-size: 11.5px; line-height: 1.3; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.f-none { color: var(--text-tertiary); font-size: 11px; font-weight: 600; }
.f-spot { display: flex; align-items: center; gap: 7px; position: relative; }
/* Option T — a tooltip below the card: app surface, app popover chrome (the sort menu's). */
.mode-tooltip .card .facts { top: calc(100% + 6px); left: 0; width: 296px; padding: 10px 12px;
  background: #141021; border: 1px solid var(--border-emphasis); border-radius: 12px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, .5); }
.mode-tooltip .f-name { color: var(--text-primary); }
.mode-tooltip .f-sub { color: var(--text-secondary); }
/* Option X — the card itself grows: same aura, same corners' language, more room. */
.mode-expand .card .facts { top: -1px; left: -1px; width: 320px; min-height: calc(100% + 2px); padding: 9px 11px 11px;
  border: 1px solid var(--hairline); border-radius: var(--r-card); box-shadow: 0 18px 50px rgba(0, 0, 0, .55); overflow: hidden; }
/* Breathes only when the card would (.animated, from aura.js) — reduced-motion and low-power switch it off as everywhere. */
.mode-expand .card .facts.animated { background-size: 180% 180%; animation: gradShift 12s ease-in-out infinite; }
.mode-expand .card .facts .card-grain { z-index: 0; }
.mode-expand .card .facts > * { z-index: 1; }

/* The expanded card as the notes sheet's header — one component, two homes. */
.sheet-card { position: relative; overflow: hidden; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px;
  padding: 11px 13px 12px; border: 1px solid var(--hairline); border-radius: var(--r-card); }
.sheet-card.animated { background-size: 180% 180%; animation: gradShift 12s ease-in-out infinite; }
.sheet-card .card-grain { z-index: 0; }
.sheet-card > * { z-index: 1; }
.sheet-card .f-name { font-size: 17px; }
.sheet-card .corner-who { position: absolute; }
.sheet-day { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sheet-day .f-sub { color: var(--text-tertiary); margin-top: 0; }

/* Threads: a reply is a note, indented under its root. */
.note-row.reply { margin-left: 31px; }
.note-row.reply .avatar { width: 18px; height: 18px; font-size: 8px; }
.note-row.reply .bubble { padding: 8px 10px; }
.thread { display: flex; flex-direction: column; gap: 6px; }
.thread + .thread, .thread + .note-row, .note-row + .thread { margin-top: 2px; }
.composer.replying { position: relative; }
.composer.replying input { border-color: var(--notes-chip-stroke); }
.composer .cancel { background: none; border: 1px solid var(--border-input); color: var(--text-secondary);
  font-size: 11px; font-weight: 700; border-radius: var(--r-pill); padding: 8px 11px; cursor: pointer; flex: none; }
.reply-to { color: var(--text-tertiary); font-size: 10.5px; font-weight: 700; margin: 0 0 -6px 2px; }
.stub { color: var(--text-tertiary); font-size: 11px; font-weight: 600; font-style: italic; }

/* Desktop chips: hover reveals the door to the second job. */
.chip-wrap { position: relative; display: inline-flex; }
.chip-door { display: none; position: absolute; top: calc(100% + 5px); left: 0; z-index: 35; white-space: nowrap;
  background: #141021; border: 1px solid var(--border-card); border-radius: 8px; padding: 6px 10px;
  color: var(--text-body); font-size: 11.5px; font-weight: 700; box-shadow: 0 12px 34px rgba(0, 0, 0, .5); cursor: pointer; }
.chip-door .chev { color: var(--text-tertiary); margin-left: 4px; }
@media (hover: hover) and (pointer: fine) { .chip-wrap:hover .chip-door { display: inline-flex; } }
.chip-wrap.is-hover .chip-door { display: inline-flex; }

/* Canvas-only labels (never part of the app). */
.cv-label { color: var(--text-tertiary); font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.cv-cap { color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.cv-case { background: var(--card); border: 1px solid var(--border-card); border-radius: var(--r-settings); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.cv-tag { display: inline-flex; align-items: center; font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  padding: 2px 7px; border-radius: var(--r-pill); border: 1px solid var(--border-emphasis); color: var(--text-secondary); }
.cv-tag.call { border-color: rgba(var(--brand), .6); color: var(--tonal-text); }
a { color: var(--tonal-text); } a:hover { color: #fff; }
`;

function wrap(body, { w, h, extraCss = '' }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
${fontCss}
${tokensCss}
${v3Css}
${shellCss}
${canvasCss}
${extraCss}
  </style>
</helmet>
<div class="vp" style="width: ${w}px; height: ${h}px; --fest: ${ACCENT};">
${body}
</div>
</x-dc>
</body>
</html>
`;
}

// ---- app chrome (header / toolbar / rail / dock), built from index.html + app.js ----------
function headerHtml() {
  return `<header class="app-header">
  <button class="back-btn" aria-label="Your crews">‹</button>
  <span class="title"><span>${esc(FEST.name.toUpperCase())}</span><span class="yr">${esc(FEST.year)}</span></span>
  <span class="sub">${esc([FEST.subtitle, FEST.dates].filter(Boolean).join(' · '))}</span>
  <button class="gear-btn" aria-label="Settings">${gearSvg}</button>
</header>`;
}

function chipHtml(name, { selected = false, faded = false, armed = false, hover = false, door = false } = {}) {
  const isMe = name === ME;
  const ci = PEOPLE[name].colorIndex;
  const cls = ['person-chip', isMe ? 'you' : '', selected ? 'selected' : '', faded ? 'faded' : ''].filter(Boolean).join(' ');
  const chip = `<button class="${cls}" style="background: ${hsl(ci, 0.5)}; border: 1px solid ${stroke(ci, isMe)};" aria-pressed="${selected}">${armed ? `Pick as ${esc(name)}?` : esc(name)}</button>`;
  if (!door) return chip;
  return `<span class="chip-wrap${hover ? ' is-hover' : ''}">${chip}<span class="chip-door">Pick as ${esc(name)}<span class="chev">›</span></span></span>`;
}

function toolbarHtml({ filter = [], armed = null, hover = null, doors = false } = {}) {
  const chips = Object.keys(PEOPLE).map((n) => chipHtml(n, {
    selected: filter.includes(n), faded: filter.length > 0 && !filter.includes(n), armed: armed === n, hover: hover === n, door: doors && n !== ME,
  })).join('');
  const everyone = filter.length ? `<button class="person-chip everyone" aria-label="Show everyone’s picks">everyone<span class="x">✕</span></button>` : '';
  const add = `<button class="person-chip add" aria-label="Add someone to the crew">+ Add</button>`;
  const count = model.totalNoteCount(state.crewDoc, R.FID);
  return `<div class="toolbar">
  <span id="person-chips" style="display: inline-flex; gap: 5px; flex-wrap: wrap;">${chips}${everyone}${add}</span>
  <span class="toolbar-divider"></span>
  <span class="search-pill" style="flex: 1; min-width: 140px;">${searchSvg}<input placeholder="Search…" aria-label="Search artists"></span>
  <span class="sort-wrap"><button class="sort-chip" aria-expanded="false">Billing <span class="caret">▾</span></button></span>
  <button class="notes-chip">Notes <span class="count">${count}</span></button>
</div>`;
}

const DAYS = ['Saturday', 'Sunday', 'Afters', 'Folsom'];
function youAvatar() {
  const ci = PEOPLE[ME].colorIndex;
  return `<button class="avatar you you-avatar" style="background: ${hsl(ci, 0.5)};" aria-label="${ME} — jump to top">${ME.charAt(0)}</button>`;
}
function railHtml(active = 'Saturday') {
  const tabs = DAYS.map((d) => {
    const meta = FEST.dayMeta[d] || {};
    const label = meta.wd ? `${meta.wd} ${meta.num || ''}`.trim() : d;
    return `<button class="day-tab${d === active ? ' active' : ''}">${esc(label.toUpperCase())}</button>`;
  }).join('');
  return `<div class="day-rail">${youAvatar()}<span class="rail-days">${tabs}</span>
  <button class="fest-link" aria-label="Open settings"><span class="fest-name">${esc(FEST.name.toUpperCase())}</span><span class="sync-dot"></span></button></div>`;
}
function dockHtml(active = 'Saturday') {
  const tabs = DAYS.map((d) => {
    const meta = FEST.dayMeta[d] || {};
    return `<button class="day-tab${d === active ? ' active' : ''}">${esc(((meta.wd || d).slice(0, 3)).toUpperCase())}</button>`;
  }).join('');
  return `<div class="dock">${youAvatar()}<span class="days">${tabs}</span>
  <button class="fest-link" aria-label="Open settings"><span class="fest-name">${esc(FEST.name.toUpperCase())}</span><span class="sync-dot"></span></button></div>`;
}

// ---- wall parts (production render, sliced) --------------------------------------------
// The wall's children, in order: [stage strip] then per day: rule, grid, notes section.
function wallParts(root) {
  const kids = [...root.children];
  const parts = { strip: null, days: {} };
  let cur = null;
  for (const el of kids) {
    if (el.classList.contains('stage-strip')) { parts.strip = el; continue; }
    if (el.classList.contains('day-rule')) { cur = el.dataset.day || el.querySelector('.day').textContent; parts.days[cur] = { rule: el, body: [], notes: null }; continue; }
    if (!cur) continue;
    if (isNotesSection(el)) parts.days[cur].notes = el; else parts.days[cur].body.push(el);
  }
  return parts;
}
const isNotesSection = (el) => el.tagName === 'DIV' && /flex-direction:\s*column/.test(el.getAttribute('style') || '') && el.querySelector('.note-row, .composer');

const ROW_PITCH = 24; // 20px rows + 4px gap (wall.js ROW_PX + ROW_GAP)
// A window onto a timetable grid: `rowsVisible` rows, ending `fromEnd` rows before the grid's end.
function clipGrid(timesWrap, { rowsVisible, fromStart = null, fromEnd = 0, extraBottom = 0 }) {
  const grid = timesWrap.querySelector('.times-grid');
  const rows = Number(grid.dataset.rows);
  const offsetRows = fromStart != null ? fromStart : Math.max(0, rows - rowsVisible - fromEnd);
  const h = rowsVisible * ROW_PITCH - 4 + extraBottom;
  return `<div class="clip" style="height: ${h}px;"><div style="transform: translateY(-${offsetRows * ROW_PITCH}px);">${timesWrap.outerHTML}</div></div>`;
}

// ---- the round's pieces --------------------------------------------------------------
function avatarHtml(name, size = 22, font = 9, { border = true } = {}) {
  const ci = PEOPLE[name].colorIndex;
  return `<span class="avatar" style="width: ${size}px; height: ${size}px; font-size: ${font}px; background: ${hsl(ci, 0.5)};${border ? ` border: 1px solid ${stroke(ci, false)};` : ''}">${esc(name.charAt(0).toUpperCase())}</span>`;
}

function relTime(ts) {
  const ms = Date.now() - Date.parse(ts);
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function whisperHtml(scope, target, label) {
  const list = model.notesFor(state.crewDoc, R.FID, scope, target);
  if (!list.length) return '';
  const newest = list[list.length - 1];
  const n = list.length;
  return `<button class="day-whisper" aria-label="Notes for ${esc(label)}: ${n} note${n === 1 ? '' : 's'}, newest from ${esc(newest.author)}">
  ${avatarHtml(newest.author, 18, 8)}<span class="who">${newest.author === ME ? 'you' : esc(newest.author)}</span><span class="text">${esc(newest.text)}</span><span class="more">${n} note${n === 1 ? '' : 's'} ›</span></button>`;
}

function timeRange(t) {
  if (!t) return '';
  const [s, e] = t.split(' - ');
  if (!e) return t;
  const ps = s.split(' '), pe = e.split(' ');
  return ps[1] === pe[1] ? `${ps[0]} – ${e}` : `${s} – ${e}`;
}
const PILL_ALPHA = { 1: 0.4, 2: 0.6, 3: 0.8, 4: 0.9 };
const bookmarkSvg = '<svg width="7" height="9" viewBox="0 0 10 13"><path d="M1 1h8v11l-4-3-4 3z" fill="#fff"></path></svg>';

function factsInner(f) {
  const sub = [f.day, f.stage, timeRange(f.time)].filter(Boolean).join(' · ');
  const pills = f.people.map((p) => `<span class="f-pill${p.isYou ? ' you' : ''}${p.level === 4 ? ' must' : ''}" style="background: ${hsl(p.colorIndex, PILL_ALPHA[p.level])}; border: 1px solid ${stroke(p.colorIndex, p.isYou)};">${p.isYou ? 'you' : esc(p.name)}${p.level === 4 ? '<b>MUST</b>' : ''}</span>`).join('');
  const notes = f.noteCount
    ? `<span class="chip-notes f-chip">${f.noteCount} note${f.noteCount === 1 ? '' : 's'}</span><span class="f-note">“${esc(trunc(f.newest.text, 34))}” — ${f.newest.author === ME ? 'you' : esc(f.newest.author)}</span>`
    : `<span class="f-none">No notes yet</span>`;
  let spot = '';
  if (f.spotify && (f.spotify.songs > 0 || f.spotify.followed)) {
    const bits = [];
    if (f.spotify.songs > 0) bits.push(`${f.spotify.songs} liked`);
    if (f.spotify.followed) bits.push(`following ${bookmarkSvg}`);
    spot = `<div class="f-spot"><span class="chip-spotify f-chip">${bits.join(' · ')}</span></div>`;
  }
  return `<div class="f-name">${esc(f.name)}</div><div class="f-sub">${esc(sub)}</div><div class="f-people">${pills || '<span class="f-none">Nobody yet — tap to pick</span>'}</div><div class="f-about">${notes}</div>${spot}`;
}

function injectFacts(gridEl, mode, hoverName) {
  for (const card of gridEl.querySelectorAll('.card.cell')) {
    const f = R.factsFor(card.dataset.artist);
    const facts = R.document_.createElement('div');
    facts.className = 'facts' + (mode === 'expand' && f.animated ? ' animated' : '');
    facts.setAttribute('aria-hidden', 'true');
    if (mode === 'expand') facts.style.background = f.background;
    facts.innerHTML = (mode === 'expand' ? '<span class="card-grain"></span>' : '') + factsInner(f);
    card.appendChild(facts);
    if (card.dataset.artist === hoverName) card.classList.add('is-hover');
  }
}

// One note row, production anatomy (notes.js noteRow) plus the round's Reply / replies actions.
function noteRowHtml(n, { reply = false, pinned = false, pin = true, actions = true, collapsedReplies = 0 } = {}) {
  const mine = n.author === ME;
  const acts = [];
  if (mine && actions) acts.push('<button class="note-action">Edit</button>', '<button class="note-action">Delete</button>');
  if (!reply && actions) {
    if (collapsedReplies) acts.push(`<button class="note-action">${collapsedReplies} repl${collapsedReplies === 1 ? 'y' : 'ies'}</button>`);
    else acts.push('<button class="note-action">Reply</button>');
  }
  const meta = `${mine ? 'you' : esc(n.author)} · ${relTime(n.ts)}${acts.map((a) => ' · ' + a).join('')}`;
  return `<div class="note-row${reply ? ' reply' : ''}">${avatarHtml(n.author, reply ? 18 : 22, reply ? 8 : 9)}
  <div class="bubble${pinned ? ' pinned' : ''}"><span>${esc(n.text)}</span><span class="meta">${meta}</span></div>
  ${!reply && pin ? `<button class="pin-btn${pinned ? ' active' : ''}">${pinned ? 'Unpin' : 'Pin'}</button>` : ''}</div>`;
}

// Threads: roots in time order (pinned first), replies under their root.
// A pinned root shows a count, not its replies (Kevin, 2026-08-28).
function threadsHtml(list, pinnedIds = []) {
  const pinned = new Set(pinnedIds);
  const roots = list.filter((n) => !n.re);
  const byRoot = new Map(roots.map((r) => [r.id, []]));
  const orphans = [];
  for (const n of list) {
    if (!n.re) continue;
    if (byRoot.has(n.re)) byRoot.get(n.re).push(n); else orphans.push(n);
  }
  const ordered = [...roots].sort((a, b) => (pinned.has(a.id) ? 0 : 1) - (pinned.has(b.id) ? 0 : 1) || Date.parse(a.ts) - Date.parse(b.ts));
  let out = '';
  for (const r of ordered) {
    const replies = byRoot.get(r.id);
    const isPinned = pinned.has(r.id);
    if (isPinned || !replies.length) { out += noteRowHtml(r, { pinned: isPinned, collapsedReplies: isPinned ? replies.length : 0 }); continue; }
    out += `<div class="thread">${noteRowHtml(r)}${replies.map((x) => noteRowHtml(x, { reply: true })).join('')}</div>`;
  }
  for (const o of orphans) out += `<div class="thread"><div class="note-row"><span class="avatar" style="width:22px;height:22px;font-size:9px;background:var(--card);border:1px dashed var(--border-emphasis);"></span><div class="bubble"><span class="stub">Note removed</span></div></div>${noteRowHtml(o, { reply: true })}</div>`;
  return out;
}

function composerHtml(placeholder = 'Add a note…', { replyingTo = null } = {}) {
  if (replyingTo) {
    return `<div class="reply-to">Replying to ${esc(replyingTo)}</div><div class="composer replying"><input maxlength="500" placeholder="Reply…" aria-label="Reply to ${esc(replyingTo)}"><button class="cancel" aria-label="Cancel reply">✕</button><button class="btn-tonal" style="font-size: 12px; padding: 9px 15px; flex: none;">Save</button></div>`;
  }
  return `<div class="composer"><input maxlength="500" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"><button class="btn-tonal" style="font-size: 12px; padding: 9px 15px; flex: none;">Save</button></div>`;
}

function sheetCardHtml(f) {
  return `<div class="sheet-card${f.animated ? ' animated' : ''}" style="background: ${f.background};"><span class="card-grain"></span>${factsInner(f)}</div>`;
}

// ---- artboards -------------------------------------------------------------------------
const boards = [];
const layout = [];
const annotations = [];
let PAGE = 'round-1';
function board(file, html, size, pos, title) {
  writeFileSync(`${OUT}/${file}`, html);
  boards.push(file);
  layout.push({ file, x: pos.x, y: pos.y, w: size.w, h: size.h, title, page: PAGE });
}
function note(id, x, y, w, text) { annotations.push({ id, x, y, w, text, page: PAGE }); }

const DESK = 1180, MOB = 390;

// Variant application on a fresh production render.
// variant: 'today' | 'A' (pins at the door) | 'B' (whisper) | 'C' (door only)
function applyVariant(root, variant) {
  const parts = wallParts(root);
  const doc = R.document_;
  for (const [day, p] of Object.entries(parts.days)) {
    const isFest = day.startsWith('NOTES ·');
    const scope = isFest ? 'fest' : 'day';
    const target = isFest ? null : day;
    if (variant === 'today') continue;
    if (p.notes) p.notes.remove();
    if (variant === 'C') { if (isFest) p.rule.remove(); continue; }
    if (variant === 'B') {
      const w = whisperHtml(scope, target, isFest ? FEST.name : day);
      if (w) p.rule.insertAdjacentHTML('afterend', w);
      else if (isFest) p.rule.remove();
      continue;
    }
    if (variant === 'A') {
      const pins = new Set(JSON.parse(localStorage.getItem('fn_pins_v1') || '{}')[R.FID] || []);
      const list = model.notesFor(state.crewDoc, R.FID, scope, target).filter((n) => pins.has(n.id));
      if (!list.length) { if (isFest) p.rule.remove(); continue; }
      const holder = doc.createElement('div');
      holder.className = 'pins-inline';
      holder.innerHTML = `<div class="micro-label">Pinned by you</div>` + list.map((n) => noteRowHtml(n, { pinned: true, actions: false })).join('');
      p.rule.insertAdjacentElement('afterend', holder);
    }
  }
  return wallParts(root);
}

function renderSeam(variant, { mobile }) {
  R.setPins([R.IDS.sunRoot]);
  const root = R.renderWallEl();
  const parts = applyVariant(root, variant);
  // Elements inserted after a rule (whisper / pins) are not in parts.body — capture them by adjacency.
  const after = (rule) => { const out = []; let e = rule.nextElementSibling; while (e && !e.classList.contains('times-wrap') && !e.classList.contains('wall-grid')) { out.push(e.outerHTML); e = e.nextElementSibling; } return out.join(''); };
  const sat = parts.days.Saturday, sun = parts.days.Sunday;
  const grid = (d) => d.body.find((e) => e.classList.contains('times-wrap'));
  const satTail = [...sat.body.filter((e) => e !== grid(sat) && !after(sat.rule).includes(e.outerHTML)), ...(sat.notes ? [sat.notes] : [])].map((e) => e.outerHTML).join('');
  const body = `<div class="shell" style="padding-top: 0;">
  ${mobile ? '' : railHtml('Saturday')}
  ${parts.strip.outerHTML}
  <div class="wall-wrap" style="margin-top: 8px;">
    ${clipGrid(grid(sat), { rowsVisible: mobile ? 7 : 9 })}${satTail}
    ${sun.rule.outerHTML}${after(sun.rule)}
    ${clipGrid(grid(sun), { rowsVisible: 20, fromStart: 0 })}
  </div>
</div>${mobile ? dockHtml('Saturday') : ''}`;
  return body;
}

// ---- Row 0 + Row 1: today and the three day-notes directions ---------------------------
const ROW1_Y = 0;
note('r1-title', 0, -150, 1180, 'DAY NOTES — where they live without the bars\nToday: every day renders all its notes plus a composer under its grid (the "bars"). The three directions below keep the ✎ count chip on the day rule as the door and change what sits inline. The festival notes at the wall’s end get the same treatment (not sliced here). Desktop on top, phone underneath — every wall here is rendered by production code (real auras, corners, chips), only the notes treatment differs.');
{
  const size = { w: DESK, h: 760 };
  const variants = [
    ['Today', 'today', 'Today (production) — the bars'],
    ['DayNotesA', 'A', 'A — pins at the door'],
    ['Main', 'B', 'B — the whisper (recommended)'],
    ['DayNotesC', 'C', 'C — door only'],
  ];
  variants.forEach(([file, v, title], i) => {
    board(`${file}.dc.html`, wrap(renderSeam(v, { mobile: false }), size), size, { x: i * (DESK + 100), y: ROW1_Y }, title);
    const m = { w: MOB, h: 844 };
    board(`${file === 'Main' ? 'DayNotesB' : file}Phone.dc.html`, wrap(renderSeam(v, { mobile: true }), m), m, { x: i * (DESK + 100), y: ROW1_Y + size.h + 140 }, `${title} · phone`);
  });
}
note('r1-a', DESK + 100, -110, 520, 'A — PINS AT THE DOOR\nOnly notes YOU pinned stay on the wall, right under the day name; everything else lives in the sheet. Why: the wall shows what you chose to keep in view. Tradeoff: a day with no pins shows nothing, so new notes from others are invisible until you open the sheet.');
note('r1-b', 2 * (DESK + 100), -110, 520, 'B — THE WHISPER (recommended)\nOne line under the day name: who said the newest thing, and how many notes there are. Tap it to open the day’s notes. Why: ambient awareness with no chrome — the same move the filters made (things already on screen gain a job). Tradeoff: one line can only carry one note.');
note('r1-c', 3 * (DESK + 100), -110, 520, 'C — DOOR ONLY\nNothing inline. The ✎ chip on the rule (with its count) and the toolbar Notes chip are the doors. Why: the cleanest wall. Tradeoff: you have to open a sheet to learn anything was said.');

// ---- Row 2: hover facts (desktop only) ------------------------------------------------
const ROW2_Y = ROW1_Y + 760 + 140 + 844 + 220;
note('r2-title', 0, ROW2_Y - 150, 1180, 'HOVER FACTS — the card says more when a pointer rests on it (desktop only)\nBoth options carry the same facts: name, day · stage · set time, who is going and at what level (pill brightness = taps, white stroke = you, MUST tag), notes count + newest note, Spotify liked / following. Move your mouse over any card in these two frames — the hover is live. Dog Blood is frozen in its hover state so it also exports.');
{
  const size = { w: DESK, h: 600 };
  const mk = (mode) => {
    const root = R.renderWallEl();
    const parts = applyVariant(root, 'B');
    const sat = parts.days.Saturday;
    const grid = sat.body.find((e) => e.classList.contains('times-wrap'));
    injectFacts(grid, mode, NAMES.dogBlood);
    return `<div class="shell" style="padding-top: 0;">${railHtml('Saturday')}${parts.strip.outerHTML}
<div class="wall-wrap mode-${mode}" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: 18, extraBottom: 220 })}</div></div>`;
  };
  board('HoverTooltip.dc.html', wrap(mk('tooltip'), size), size, { x: 0, y: ROW2_Y }, 'Hover option 1 — tooltip');
  board('HoverExpand.dc.html', wrap(mk('expand'), size), size, { x: DESK + 100, y: ROW2_Y }, 'Hover option 2 — the card expands');
}
note('r2-t', 0, ROW2_Y + 620, 560, 'OPTION 1 — TOOLTIP\nA panel below the card, in the app’s popover chrome (the sort menu’s). Why: familiar, never covers the card you are reading, cheap. Tradeoff: one more surface; the facts feel attached to the pointer, not the card.');
note('r2-x', DESK + 100, ROW2_Y + 620, 560, 'OPTION 2 — THE CARD EXPANDS\nThe card itself grows over its neighbours, keeping its aura (breathing) and its corner language. Why: one object, more room — and this exact block is the notes sheet’s header below, so hover and sheet read as the same thing. Tradeoff: it covers neighbouring cards while open; needs a ~250 ms delay so scanning the grid doesn’t flicker.');

// ---- Row 3: the notes sheet — expanded-card header + threads -----------------------------
const ROW3_Y = ROW2_Y + 600 + 260;
note('r3-title', 0, ROW3_Y - 150, 1180, 'INSIDE NOTES — the sheet opens with the card, then the conversation\nThe header is the expanded card (aura breathing behind the name — off under reduced-motion and low-power, as everywhere). Below: threads. A reply is a note with one extra key (re: <root id>), one level deep; replies indent under their root; Reply lives in the root’s meta line; counts include replies. Pinned roots show a reply COUNT, not the thread (your call).');
{
  R.setPins([]);
  const artistList = model.notesFor(state.crewDoc, R.FID, 'artist', NAMES.dogBlood);
  const f = R.factsFor(NAMES.dogBlood);
  const sheetInner = (mobile) => `${mobile ? '<div class="grabber"></div>' : ''}
  <div style="display: flex; align-items: flex-start; gap: 9px;">${sheetCardHtml(f)}<button class="sheet-close" aria-label="Close">✕</button></div>
  <div style="display: flex; flex-direction: column; gap: 8px;">${threadsHtml(artistList)}</div>
  ${composerHtml('Add a note…')}`;
  const backWall = (mobile) => {
    const root = R.renderWallEl();
    const parts = applyVariant(root, 'B');
    const sat = parts.days.Saturday;
    const grid = sat.body.find((e) => e.classList.contains('times-wrap'));
    return `<div class="shell" style="padding-top: 0;">${mobile ? '' : railHtml('Saturday')}${parts.strip.outerHTML}
<div class="wall-wrap" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: mobile ? 30 : 28 })}</div></div>${mobile ? dockHtml('Saturday') : ''}`;
  };
  const m = { w: MOB, h: 844 };
  board('SheetPhone.dc.html', wrap(`${backWall(true)}<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Dog Blood">${sheetInner(true)}</div>`, m), m, { x: 0, y: ROW3_Y }, 'Artist notes · phone');
  const d = { w: DESK, h: 820 };
  board('SheetDesktop.dc.html', wrap(`${backWall(false)}<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Dog Blood">${sheetInner(false)}</div>`, d), d, { x: MOB + 100, y: ROW3_Y }, 'Artist notes · desktop dialog');

  // Day sheet, mid-reply.
  const satList = model.notesFor(state.crewDoc, R.FID, 'day', 'Sunday');
  const meta = FEST.dayMeta.Sunday;
  const dayHead = `<div class="sheet-day"><span class="sheet-title">SUNDAY</span><div class="f-sub">${esc(`${meta.wd} · ${meta.date} · doors 1 PM`)} · ${satList.length} notes</div></div>`;
  const daySheet = `<div class="grabber"></div>
  <div style="display: flex; align-items: flex-start; gap: 9px;">${dayHead}<button class="sheet-close" aria-label="Close">✕</button></div>
  <div style="display: flex; flex-direction: column; gap: 8px;">${threadsHtml(satList)}</div>
  ${composerHtml('Add a note…', { replyingTo: 'Ben' })}`;
  board('SheetDayPhone.dc.html', wrap(`${backWall(true)}<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Sunday">${daySheet}</div>`, m), m, { x: MOB + 100 + DESK + 100, y: ROW3_Y }, 'Day notes · phone, mid-reply');
}

// ---- Row 4: thread edge cases ------------------------------------------------------------
const ROW4_Y = ROW3_Y + 844 + 220;
note('r4-title', 0, ROW4_Y - 150, 1180, 'THREADS — the edge cases, each with a call\n"Decided" = follows from the model and needs no answer. "Your call" = a taste decision; the default shown is my recommendation.');
{
  const L = model.notesFor(state.crewDoc, R.FID, 'artist', NAMES.dogBlood);
  const root = L.find((n) => n.id === R.IDS.dbRoot);
  const r1 = L.find((n) => n.id === R.IDS.dbR1);
  const r2 = L.find((n) => n.id === R.IDS.dbR2);
  const root2 = L.find((n) => n.id === R.IDS.dbRoot2);
  const cases = [
    ['A reply to a reply', 'decided', `<div class="thread">${noteRowHtml(root)}${noteRowHtml(r1, { reply: true })}${noteRowHtml(r2, { reply: true })}</div>`,
      'One level deep. Replying to Ben’s reply attaches to Cleo’s root (re points at the root). Threads at a festival are short; a second level would cost indent on a phone and buy nothing.'],
    ['Pinned root', 'call', `${noteRowHtml(root, { pinned: true, collapsedReplies: 2 })}${noteRowHtml(root2)}`,
      'A pinned root sorts to the top and shows “2 replies”, never the thread (your rule). Tapping the count expands it in place. Pins stay device-local; a reply never changes pin state.'],
    ['Root deleted, replies alive', 'call', `<div class="thread"><div class="note-row"><span class="avatar" style="width:22px;height:22px;font-size:9px;background:var(--card);border:1px dashed var(--border-emphasis);"></span><div class="bubble"><span class="stub">Cleo removed this note</span></div></div>${noteRowHtml(r1, { reply: true })}${noteRowHtml(r2, { reply: true })}</div>`,
      'Replies stay, under a quiet stub, so “yes — coming straight from Warehouse” keeps its context. Alternative: promote them to roots — cheaper, but they read as non-sequiturs.'],
    ['Reply lands before its root', 'decided', `<div class="thread"><div class="note-row"><span class="avatar" style="width:22px;height:22px;font-size:9px;background:var(--card);border:1px dashed var(--border-emphasis);"></span><div class="bubble"><span class="stub">…</span></div></div>${noteRowHtml(r2, { reply: true })}</div>`,
      'Sync can deliver a reply a beat before its root. Same stub treatment; the next paint slots it under the root. No data is wrong at any moment.'],
    ['Your own reply', 'decided', `<div class="thread">${noteRowHtml(root)}${noteRowHtml(r1, { reply: true })}</div>`,
      'Edit and Delete work exactly as on a root (same id rule: only your own). No Reply on a reply.'],
    ['Counts', 'decided', `<div style="display:flex;gap:10px;align-items:center;"><span class="chip-notes" style="height:16px;padding:0 8px;font-size:10px;">${L.length}</span><span class="cv-cap">card corner</span><span class="notes-chip" style="padding:5px 10px;">Notes <span class="count">${model.totalNoteCount(state.crewDoc, R.FID)}</span></span><span class="cv-cap">toolbar</span></div>`,
      `Every count includes replies: ${L.length} on the Dog Blood card (${L.filter((n) => !n.re).length} roots + ${L.filter((n) => n.re).length} replies), ${model.totalNoteCount(state.crewDoc, R.FID)} in the toolbar. A reply is a note; the number answers “how much is being said here”.`],
    ['All notes (the home)', 'decided', `<div class="micro-label">Dog Blood</div><div class="thread">${noteRowHtml(root, { pin: false })}${noteRowHtml(r1, { reply: true })}</div>`,
      'The toolbar’s Notes sheet groups by festival / day / artist as today; threads render intact under their roots inside each group.'],
    ['Reply on day and festival notes', 'decided', `<div class="micro-label">Sunday</div><div class="thread">${noteRowHtml(model.notesFor(state.crewDoc, R.FID, 'day', 'Sunday')[0])}${noteRowHtml(model.notesFor(state.crewDoc, R.FID, 'day', 'Sunday')[1], { reply: true })}</div><div class="micro-label">This festival</div><div class="thread">${noteRowHtml(model.notesFor(state.crewDoc, R.FID, 'fest', null)[0])}${noteRowHtml(model.notesFor(state.crewDoc, R.FID, 'fest', null)[1], { reply: true })}</div>`,
      'Same component at every scope. Nothing about a thread knows whether it hangs off an artist, a day, or the festival.'],
    ['The whisper and threads', 'decided', whisperHtml('day', 'Sunday', 'Sunday'),
      'The whisper shows the NEWEST note — root or reply. Above: Cleo’s reply is the latest thing said on Sunday, so it is the line.'],
    ['Offline / conflict', 'decided', `<div class="cv-cap">No new state. A reply is one more leaf in the notes map; the merge handles it like any note. Two people replying at once both land.</div>`,
      'Additive and merge-safe: no migration, old clients ignore the re key and show replies as plain notes (in time order, still readable).'],
  ];
  const cells = cases.map(([title, tag, snippet, cap]) => `<div class="cv-case"><div style="display:flex;align-items:center;gap:8px;"><span class="cv-label">${esc(title)}</span><span class="cv-tag${tag === 'call' ? ' call' : ''}">${tag === 'call' ? 'Your call' : 'Decided'}</span></div><div style="display:flex;flex-direction:column;gap:8px;">${snippet}</div><div class="cv-cap">${esc(cap)}</div></div>`).join('');
  const size = { w: 1180, h: 1300 };
  board('ThreadCases.dc.html', wrap(`<div style="padding: 24px 28px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">${cells}</div>`, size), size, { x: 0, y: ROW4_Y }, 'Thread edge cases');
}

// ---- Row 5: desktop chips ---------------------------------------------------------------
const ROW5_Y = ROW4_Y + 1300 + 220;
note('r5-title', 0, ROW5_Y - 150, 1180, 'DESKTOP CHIPS — one grammar on both surfaces\nClick = filter (as on a phone: tap). Hold = pick as them — a mouse press-and-hold already arms the chip today, the code never checks pointer type. New: on a pointer-fine device, hovering a chip reveals the door to that second job, so nobody has to know the hold. Click the door to arm; the armed chip asks “Pick as Ben?”; a click confirms, 3 s later it relaxes.');
{
  const rows = [
    ['Rest', toolbarHtml({ doors: true })],
    ['Hover on Ben — the door appears', toolbarHtml({ doors: true, hover: 'Ben' })],
    ['Armed (after a hold or the door) — “Pick as Ben?”, a click confirms', toolbarHtml({ doors: true, armed: 'Ben' })],
    ['Filtering Ben (a plain click) — Ben ringed, the rest step back, “everyone ✕” clears', toolbarHtml({ doors: true, filter: ['Ben'] })],
  ];
  const body = `<div class="shell" style="padding-top: 6px; display: flex; flex-direction: column; gap: 46px;">${rows.map(([l, t]) => `<div style="display:flex;flex-direction:column;gap:6px;"><div class="cv-label">${esc(l)}</div>${t}</div>`).join('')}</div>`;
  const size = { w: DESK, h: 480 };
  board('ChipsDesktop.dc.html', wrap(body, size), size, { x: 0, y: ROW5_Y }, 'People chips on desktop — four states');
}

// ---- Row 6: copy ----------------------------------------------------------------------
const ROW6_Y = ROW5_Y + 480 + 220;
note('r6-title', 0, ROW6_Y - 150, 900, 'SHARE COPY — shorter, still friendly\nShare sheet: “Anyone who opens it lands in Portola 26 — no accounts, no setup.” → “Opens straight into Portola 26. No accounts needed.”\nAdd-member success: “Pick for Kat by switching to them in Settings → You. Or send them their own link — opening it puts your picks in their hands:” → “Send Eli this link. Opening it makes the picks theirs.” (the Settings sentence goes — hold-to-pick-as is the taught path now; “their”, never a guessed pronoun). Titles and buttons unchanged.');
{
  const linkRow = (label, value) => `<div style="display: flex; gap: 8px; align-items: center;"><input readonly value="${esc(value)}" aria-label="${esc(label)}" style="flex: 1; min-width: 0; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: var(--text-body); font-size: 12px; font-family: var(--font-ui);"><button class="btn-tonal" style="font-size: 12px; padding: 9px 15px; flex: none;">Copy</button></div>`;
  const actions = (primary, secondary) => `<div style="display: flex; gap: 8px;"><button class="btn-tonal" style="flex: 1; font-size: 13px; padding: 11px;">${esc(primary)}</button><button class="btn-ghost" style="font-size: 12px; padding: 11px 16px;">${esc(secondary)}</button></div>`;
  const chrome = (title) => `<div class="grabber"></div><div style="display: flex; align-items: center; gap: 9px;"><span class="sheet-title" style="flex: 1;">${esc(title)}</span><button class="sheet-close" aria-label="Close">✕</button></div>`;
  const backWall = () => {
    const root = R.renderWallEl();
    const parts = applyVariant(root, 'B');
    const sat = parts.days.Saturday;
    const grid = sat.body.find((e) => e.classList.contains('times-wrap'));
    return `<div class="shell" style="padding-top: 12px;">${headerHtml()}${toolbarHtml()}${parts.strip.outerHTML}<div class="wall-wrap" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: 16, fromStart: 0 })}</div></div>${dockHtml('Saturday')}`;
  };
  const share = `${chrome('ONE LINK MAKES IT A CREW')}
  <div style="color: var(--text-secondary); font-size: 12.5px; line-height: 1.55;">Opens straight into Portola 26. No accounts needed.</div>
  ${linkRow('Crew invite link', 'https://fest.kevinhg.com/#g=…&f=portola-2026')}${actions('Share the link', 'Later')}`;
  const added = `${chrome('ELI IS IN')}
  <div style="color: var(--text-secondary); font-size: 12.5px; line-height: 1.55;">Send Eli this link. Opening it makes the picks theirs.</div>
  ${linkRow('Eli’s personal invite link', 'https://fest.kevinhg.com/#g=…&f=portola-2026&me=Eli')}${actions('Share Eli’s link', 'Done')}`;
  const m = { w: MOB, h: 700 };
  board('CopyShare.dc.html', wrap(`${backWall()}<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Share your crew link">${share}</div>`, m), m, { x: 0, y: ROW6_Y }, 'Share sheet — new copy');
  board('CopyAdded.dc.html', wrap(`${backWall()}<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Eli is in">${added}</div>`, m), m, { x: MOB + 100, y: ROW6_Y }, 'Added someone — new copy');
}


// =====================================================================================
// ROUND 2 — the notes surface, three vibes. Kevin (2026-08-29): the ideas hold, the
// execution is boxy — too many stacked shapes and colors, threads chopped into bubbles
// with gaps, a close button bolted on. Keep flow, mix, motion. So: no boxes, the ✕
// lives in the card, the header is four lines of type, threads flow, and every sheet
// animates on open. Three genuinely different axes: INK (typography and a thread
// rail), AURA (each voice as a colour wash), SCRIPT (the site's display face as a
// transcript).
// =====================================================================================
PAGE = 'round-2';

const r2Css = `
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
@keyframes draw { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0); } }
@keyframes drift { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }

/* Shared by all three: the card is the header, full-bleed, the ✕ in its corner. */
.r2 .sheet { gap: 0; }
.r2 .sheet-card { margin: 0 -16px; padding: 18px 16px 20px; border: none; border-radius: 0; gap: 6px; }
.r2 .sheet-card .sheet-close { position: absolute; top: 10px; right: 12px; z-index: 2; width: 26px; height: 26px; font-size: 11px;
  background: rgba(10, 8, 18, .55); border: 1px solid rgba(255, 255, 255, .22); color: #fff; }
.r2 .grabber { margin-bottom: 8px; }
@media (min-width: 720px) { .r2 .sheet-card { margin: -16px -16px 0; border-radius: 20px 20px 0 0; padding: 20px 20px 22px; } }
.r2 .f-name { font-size: 19px; }
.r2 .f-who { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; position: relative; margin-top: 2px; }
.r2 .f-who .w { display: inline-flex; align-items: baseline; gap: 6px; color: #fff; font-size: 12.5px; font-weight: 600; }
.r2 .f-who .w.you { font-weight: 800; }
.r2 .f-who .w b { font-size: 8.5px; font-weight: 800; letter-spacing: .1em; opacity: .9; }
.r2 .f-who .dot { width: 7px; height: 7px; border-radius: 999px; flex: none; }
.r2 .f-line { color: rgba(255, 255, 255, .78); font-size: 11.5px; font-weight: 600; position: relative; }
.r2 .f-line b { color: #fff; font-weight: 700; }
.r2 .n-list { display: flex; flex-direction: column; padding-top: 14px; }
.r2 .n-note { animation: rise .45s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i) * 55ms); }
.r2 .n-text { color: var(--text-primary); font-size: 13.5px; line-height: 1.45; overflow-wrap: anywhere; }
.r2 .n-meta { color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; }
.r2 .n-meta .act { color: var(--text-secondary); font-weight: 700; }
.r2 .composer { margin-top: 16px; align-items: center; }
.r2 .composer .me { width: 18px; height: 18px; font-size: 8px; flex: none; }

/* INK — words on the dark, a thread rail in the root's colour. */
.d-ink .sheet-card { mask-image: linear-gradient(#000 80%, transparent); -webkit-mask-image: linear-gradient(#000 80%, transparent); padding-bottom: 40px; }
.d-ink .n-who, .d-ink .n-time { display: none; }
.d-ink .n-list { gap: 0; margin-top: -8px; }
.d-ink .n-thread { display: flex; flex-direction: column; gap: 7px; }
.d-ink .n-thread + .n-thread { margin-top: 16px; }
.d-ink .n-note { display: grid; grid-template-columns: 14px 1fr; column-gap: 8px; align-items: start; }
.d-ink .n-dot { width: 8px; height: 8px; border-radius: 999px; justify-self: center; margin-top: 6px; font-size: 0; color: transparent; }
.d-ink .n-reply .n-dot { width: 6px; height: 6px; margin-top: 7px; }
.d-ink .n-meta { margin-top: 2px; }
.d-ink .n-replies { margin-left: 6px; padding-left: 15px; border-left: 1px solid var(--rail); display: flex; flex-direction: column; gap: 7px;
  animation: draw .55s ease both; animation-delay: .2s; }
.d-ink .composer { gap: 10px; border-bottom: 1px solid var(--border-input); padding-bottom: 8px; }
.d-ink .composer input { background: none; border: none; border-radius: 0; padding: 8px 0; font-size: 13.5px; }
.d-ink .composer .btn-tonal { background: none; color: var(--tonal-text); padding: 0 2px; font-size: 12.5px; }

/* AURA — every voice is a colour; a thread is a braid of washes. */
.d-aura .n-list { gap: 0; }
.d-aura .n-time, .d-aura .n-meta .m-who { display: none; }
.d-aura .n-note > .n-who { display: none; }
.d-aura .n-body .n-who { color: #fff; font-weight: 700; font-size: 13.5px; margin-right: 6px; }
.d-aura .n-body { flex: 1; min-width: 0; }
.d-aura .n-text { display: inline; }
.d-aura .n-thread { display: flex; flex-direction: column; gap: 2px; }
.d-aura .n-thread + .n-thread { margin-top: 10px; }
.d-aura .n-note { display: flex; gap: 9px; align-items: flex-start; padding: 8px 12px 7px 10px; border-radius: 12px;
  background: radial-gradient(140% 180% at 0% 50%, var(--wash) 0%, transparent 70%); background-size: 160% 100%;
  animation: rise .45s cubic-bezier(.2, .7, .2, 1) both, drift 9s ease-in-out infinite alternate; animation-delay: calc(var(--i) * 55ms), 0s; }
.d-aura .n-reply { margin-left: 26px; padding: 6px 12px 6px 10px; }
.d-aura .n-dot { width: 18px; height: 18px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 8px; font-weight: 800; margin-top: 1px; }
.d-aura .n-reply .n-dot { width: 14px; height: 14px; font-size: 7px; margin-top: 2px; }
.d-aura .n-meta { margin-top: 1px; color: var(--text-secondary); }
.d-aura .f-who .w { background: var(--wash); padding: 3px 10px 3px 8px; border-radius: 999px; }
.d-aura .f-who .dot { display: none; }
.d-aura .composer { gap: 10px; }
.d-aura .composer input { border: none; background: radial-gradient(140% 180% at 0% 50%, var(--mywash) 0%, var(--card) 70%); border-radius: 12px; }

/* SCRIPT — the site's display face runs the conversation like a transcript. */
.d-script .f-name { font-family: var(--font-display); font-weight: 400; font-size: 26px; letter-spacing: .04em; text-transform: uppercase; line-height: 1; }
.d-script .f-who .w { font-family: var(--font-display); font-weight: 400; font-size: 11.5px; letter-spacing: .09em; text-transform: uppercase; color: var(--who); }
.d-script .f-who .w b { color: #fff; }
.d-script .f-who .dot { display: none; }
.d-script .n-list { gap: 0; }
.d-script .n-thread { display: flex; flex-direction: column; gap: 5px; padding: 11px 0; border-top: 1px solid var(--hairline); }
.d-script .n-thread:first-child { border-top: none; padding-top: 2px; }
.d-script .n-note { display: grid; grid-template-columns: 58px 1fr auto; column-gap: 10px; align-items: baseline; }
.d-script .n-who { font-family: var(--font-display); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--who); text-align: right; white-space: nowrap; }
.d-script .n-reply .n-who { font-size: 10px; opacity: .8; }
.d-script .n-reply .n-text { border-left: 1px solid var(--rail); padding-left: 10px; }
.d-script .n-time { color: var(--text-tertiary); font-size: 10px; font-weight: 600; white-space: nowrap; }
.d-script .n-time .act { color: var(--text-secondary); font-weight: 700; }
.d-script .n-meta, .d-script .n-dot, .d-script .n-body .n-who { display: none; }
.d-script .composer { gap: 10px; }
.d-script .composer input { background: none; border: none; border-bottom: 1px solid var(--border-input); border-radius: 0; padding: 8px 0; font-size: 13.5px; }
.d-script .composer .btn-tonal { background: none; color: var(--tonal-text); font-family: var(--font-display); font-weight: 400; letter-spacing: .08em; text-transform: uppercase; font-size: 11.5px; padding: 0 2px; }
`;

const hueOf = (name) => R.lib.palette.BOARD[PEOPLE[name].colorIndex];
const washOf = (name, a) => hsl(PEOPLE[name].colorIndex, a);
const whoOf = (name) => (name === ME ? '#fff' : stroke(PEOPLE[name].colorIndex, false));

function r2Header(f) {
  const who = f.people.map((p) => `<span class="w${p.isYou ? ' you' : ''}" style="--wash: ${washOf(p.name, .38)}; --who: ${whoOf(p.name)};"><i class="dot" style="background: ${hsl(p.colorIndex)};"></i>${p.isYou ? 'You' : esc(p.name)}${p.level === 4 ? '<b>MUST</b>' : ''}</span>`).join('');
  const sub = [f.day, f.stage, timeRange(f.time)].filter(Boolean).join(' · ');
  const bits = [];
  if (f.noteCount) bits.push(`<b>${f.noteCount} notes</b>`);
  if (f.spotify) { if (f.spotify.songs) bits.push(`${f.spotify.songs} liked`); if (f.spotify.followed) bits.push('following'); }
  return `<div class="sheet-card${f.animated ? ' animated' : ''}" style="background: ${f.background};"><span class="card-grain"></span>
  <button class="sheet-close" aria-label="Close">✕</button>
  <div class="f-name">${esc(f.name)}</div><div class="f-sub">${esc(sub)}</div>
  <div class="f-who">${who}</div>
  ${bits.length ? `<div class="f-line">${bits.join(' · ')}</div>` : ''}</div>`;
}

let r2i = 0;
function r2Note(n, { reply = false } = {}) {
  const mine = n.author === ME;
  const who = mine ? 'you' : esc(n.author);
  const acts = [];
  if (mine) acts.push('<span class="act">Edit</span>');
  if (!reply) acts.push('<span class="act">Reply</span>');
  const meta = `<span class="m-who">${who} · </span>${relTime(n.ts).replace(' ago', '')}${acts.map((a) => ' · ' + a).join('')}`;
  const time = `${relTime(n.ts).replace(' ago', '')}${acts.map((a) => ' · ' + a).join('')}`;
  return `<div class="n-note${reply ? ' n-reply' : ''}" style="--i: ${r2i++}; --wash: ${washOf(n.author, .24)}; --who: ${whoOf(n.author)};">
    <span class="n-dot" style="background: ${hsl(PEOPLE[n.author].colorIndex, .9)};">${esc(n.author.charAt(0))}</span>
    <span class="n-who">${who}</span>
    <div class="n-body"><span class="n-who">${who}</span><div class="n-text">${esc(n.text)}</div><div class="n-meta">${meta}</div></div>
    <span class="n-time">${time}</span>
  </div>`;
}
function r2Threads(list) {
  r2i = 0;
  const roots = list.filter((n) => !n.re);
  const byRoot = new Map(roots.map((r) => [r.id, list.filter((n) => n.re === r.id)]));
  return roots.map((r) => {
    const replies = byRoot.get(r.id);
    return `<div class="n-thread" style="--rail: ${washOf(r.author, .45)};">${r2Note(r)}${replies.length ? `<div class="n-replies">${replies.map((x) => r2Note(x, { reply: true })).join('')}</div>` : ''}</div>`;
  }).join('');
}
function r2Composer(dir) {
  const me = `<span class="avatar me" style="background: ${hsl(PEOPLE[ME].colorIndex, .5)}; border: 1px solid #fff;">${ME.charAt(0)}</span>`;
  return `<div class="composer" style="--mywash: ${washOf(ME, .22)};">${dir === 'aura' ? '' : me}<input maxlength="500" placeholder="Add a note…" aria-label="Add a note"><button class="btn-tonal" style="font-size: 12px; padding: 9px 15px; flex: none;">Save</button></div>`;
}

{
  const list = model.notesFor(state.crewDoc, R.FID, 'artist', NAMES.dogBlood);
  const f = R.factsFor(NAMES.dogBlood);
  const dirs = [
    ['Ink', 'ink', 'INK — words on the dark\nNo bubbles. A note is text with a coloured dot; a thread is a rail in the root’s colour that draws itself when the sheet opens. The card fades into the conversation. Why: the wall’s own typography, nothing added. Tradeoff: the quietest of the three — a busy thread leans on the rails alone.'],
    ['Aura', 'aura', 'AURA — every voice is a colour\nEach note sits on a wash of its author’s hue, no border, and the washes drift like the cards do; a thread reads as a braid. Why: the aura language carried from the wall into the words. Tradeoff: colour does a lot of work — a five-person thread gets loud.'],
    ['Script', 'script', 'SCRIPT — the site’s display face runs the conversation\nNames set in Anton in each person’s tint, the words beside them, a hairline between threads, replies hung off a thin rule. The card title goes full display. Why: the same voice as the day rules and the stage heads. Tradeoff: reads more like a transcript than a chat — less cosy, more Portola poster.'],
  ];
  const sheetInner = (dir, mobile) => `${mobile ? '<div class="grabber"></div>' : ''}${r2Header(f)}<div class="n-list">${r2Threads(list)}</div>${r2Composer(dir)}`;
  const backWall = (mobile) => {
    const root = R.renderWallEl();
    const parts = applyVariant(root, 'B');
    const sat = parts.days.Saturday;
    const grid = sat.body.find((e) => e.classList.contains('times-wrap'));
    return `<div class="shell" style="padding-top: 0;">${mobile ? '' : railHtml('Saturday')}${parts.strip.outerHTML}
<div class="wall-wrap" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: mobile ? 30 : 28 })}</div></div>${mobile ? dockHtml('Saturday') : ''}`;
  };
  note('v2-title', 0, -190, 1180, 'ROUND 2 — the notes surface, three vibes\nSame ideas as round 1 (the card as the header, threads one level deep, Reply in the meta line), redone for feel: no boxes, the ✕ lives in the card’s corner, the header is four lines of type instead of three rows of pills, and every sheet animates on open — reload a frame to see the notes rise in. Phone on top, the desktop dialog beneath. The hover panel on the wall takes the same header treatment as whichever you pick.');
  dirs.forEach(([name, dir, text], i) => {
    const x = i * 1280;
    const m = { w: MOB, h: 844 };
    board(`Notes${name}Phone.dc.html`, wrap(`<div class="r2 d-${dir}" style="position:absolute;inset:0;">${backWall(true)}<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Dog Blood">${sheetInner(dir, true)}</div></div>`, { ...m, extraCss: r2Css }), m, { x, y: 0 }, `${name} · phone`);
    const d = { w: DESK, h: 820 };
    board(`Notes${name}Desktop.dc.html`, wrap(`<div class="r2 d-${dir}" style="position:absolute;inset:0;">${backWall(false)}<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Dog Blood">${sheetInner(dir, false)}</div></div>`, { ...d, extraCss: r2Css }), d, { x, y: 844 + 140 }, `${name} · desktop dialog`);
    note(`v2-${dir}`, x + MOB + 60, 0, 640, text);
  });
}


// =====================================================================================
// ROUND 3 — Aura, everywhere. Kevin picked Aura (2026-08-29 18:01) and asked for
// alignment, clearer name-vs-text, and options for MUST; and for the round-1 calls
// (day notes A/B/C, tooltip vs expand, the thread cases) redone in this vibe so the
// choice is between things that already look right.
// =====================================================================================
PAGE = 'round-3';

const a3Css = `
${r2Css}
/* Aura, refined: one gutter, name above text, tighter rhythm. */
.a3 .n-note { display: grid; grid-template-columns: 20px 1fr; column-gap: 10px; align-items: start;
  padding: 9px 12px 9px 10px; border-radius: 12px;
  background: radial-gradient(150% 200% at 0% 40%, var(--wash) 0%, transparent 68%); background-size: 160% 100%;
  animation: rise .45s cubic-bezier(.2, .7, .2, 1) both, drift 9s ease-in-out infinite alternate; animation-delay: calc(var(--i) * 55ms), 0s; }
.a3 .n-dot { width: 20px; height: 20px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 8.5px; font-weight: 800; margin-top: 1px; }
.a3 .n-body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.a3 .n-head { display: flex; align-items: baseline; gap: 7px; color: var(--text-secondary); font-size: 10.5px; font-weight: 600; }
.a3 .n-head .n-who { color: #fff; font-weight: 700; font-size: 12.5px; }
.a3 .n-head .act { color: var(--text-secondary); font-weight: 700; }
.a3 .n-head .act.on { color: var(--tonal-text); }
.a3 .n-text { color: var(--text-primary); font-size: 13.5px; line-height: 1.42; }
.a3 .n-thread { display: flex; flex-direction: column; gap: 3px; }
.a3 .n-thread + .n-thread { margin-top: 12px; }
.a3 .n-replies { display: flex; flex-direction: column; gap: 3px; margin-left: 30px; }
.a3 .n-reply { margin-left: 0; padding: 7px 12px 7px 10px; grid-template-columns: 16px 1fr; }
.a3 .n-reply .n-dot { width: 16px; height: 16px; font-size: 7.5px; margin-top: 2px; }
.a3 .n-note.pinned { --wash: var(--washpin); }
.a3 .n-note.stub { background: var(--card); }
.a3 .n-note.stub .n-dot { background: none; border: 1px dashed var(--border-emphasis); }
.a3 .n-note.stub .n-text { color: var(--text-tertiary); font-style: italic; font-size: 12px; }
.a3 .n-list { padding-top: 12px; }
.a3 .sheet-card .sheet-close { top: 16px; right: 16px; }
@media (min-width: 720px) { .a3 .sheet-card .sheet-close { top: 20px; right: 20px; } }
.a3 .composer { gap: 10px; margin-top: 14px; }
.a3 .composer input { border: none; background: radial-gradient(150% 200% at 0% 50%, var(--mywash) 0%, var(--card) 70%); border-radius: 12px; }
/* header: pills are washes; four ways to say MUST (the artboard beside the sheet shows them) */
.a3 .f-who { gap: 5px 6px; }
.a3 .f-who .w { background: var(--wash); padding: 4px 11px 4px 9px; border-radius: 999px; font-size: 12.5px; }
.a3 .f-who .dot { display: none; }
.a3.must-tag .f-who .w b { display: inline; }
.a3.must-ring .f-who .w b, .a3.must-bright .f-who .w b, .a3.must-both .f-who .w b { display: none; }
.a3.must-ring .f-who .w.must, .a3.must-both .f-who .w.must { box-shadow: 0 0 0 1px var(--ring); }
.a3.must-bright .f-who .w, .a3.must-both .f-who .w { background: var(--washlvl); }
/* day notes in aura: the whisper is a wash; pins are aura notes */
.a3 .day-whisper { margin: -4px 0 2px; padding: 7px 12px 7px 10px; border-radius: 12px; gap: 9px;
  background: radial-gradient(150% 200% at 0% 50%, var(--wash) 0%, transparent 68%); }
.a3 .day-whisper .avatar { width: 18px; height: 18px; font-size: 8px; }
.a3 .day-whisper .who { color: #fff; }
.a3 .day-whisper .text { color: var(--text-body); }
.a3 .pins-inline { gap: 3px; margin: -4px 0 4px; }
.a3 .pins-inline .micro-label { margin: 0 0 3px 2px; }
/* hover facts in aura */
.a3 .card .facts { gap: 6px; }
.a3.mode-tooltip .card .facts .f-who .w { background: var(--wash); }
.a3 .cv-strip { display: flex; flex-direction: column; gap: 14px; padding: 22px 24px; }
.a3 .cv-strip .sheet-card { margin: 0; border-radius: var(--r-card); padding: 14px 16px 16px; }
`;

const LVL_ALPHA = { 1: 0.16, 2: 0.3, 3: 0.5, 4: 0.85 };
function a3Header(f) {
  const who = f.people.map((p) => `<span class="w${p.isYou ? ' you' : ''}${p.level === 4 ? ' must' : ''}" style="--wash: ${washOf(p.name, .42)}; --washlvl: ${washOf(p.name, LVL_ALPHA[p.level])}; --ring: ${stroke(p.colorIndex, p.isYou)};">${p.isYou ? 'You' : esc(p.name)}${p.level === 4 ? '<b>MUST</b>' : ''}</span>`).join('');
  const sub = [f.day, f.stage, timeRange(f.time)].filter(Boolean).join(' · ');
  const bits = [];
  if (f.noteCount) bits.push(`<b>${f.noteCount} notes</b>`);
  if (f.spotify) { if (f.spotify.songs) bits.push(`${f.spotify.songs} liked`); if (f.spotify.followed) bits.push('following'); }
  return `<div class="f-name">${esc(f.name)}</div><div class="f-sub">${esc(sub)}</div><div class="f-who">${who}</div>${bits.length ? `<div class="f-line">${bits.join(' · ')}</div>` : ''}`;
}
function a3Card(f, { close = true } = {}) {
  return `<div class="sheet-card${f.animated ? ' animated' : ''}" style="background: ${f.background};"><span class="card-grain"></span>${close ? '<button class="sheet-close" aria-label="Close">✕</button>' : ''}${a3Header(f)}</div>`;
}
let a3i = 0;
function a3Note(n, { reply = false, pinned = false, collapsedReplies = 0, stub = null, actions = true } = {}) {
  const mine = n && n.author === ME;
  if (stub) return `<div class="n-note stub" style="--i: ${a3i++};"><span class="n-dot"></span><div class="n-body"><div class="n-text">${esc(stub)}</div></div></div>`;
  const acts = [];
  if (mine && actions) acts.push('<span class="act">Edit</span>');
  if (!reply && actions) acts.push(collapsedReplies ? `<span class="act on">${collapsedReplies} repl${collapsedReplies === 1 ? 'y' : 'ies'}</span>` : '<span class="act">Reply</span>');
  if (pinned) acts.push('<span class="act on">Pinned</span>');
  return `<div class="n-note${reply ? ' n-reply' : ''}${pinned ? ' pinned' : ''}" style="--i: ${a3i++}; --wash: ${washOf(n.author, reply ? .2 : .26)}; --washpin: ${washOf(n.author, .46)};">
    <span class="n-dot" style="background: ${hsl(PEOPLE[n.author].colorIndex, .9)};">${esc(n.author.charAt(0))}</span>
    <div class="n-body"><div class="n-head"><span class="n-who">${mine ? 'you' : esc(n.author)}</span><span>${relTime(n.ts).replace(' ago', '')}</span>${acts.map((a) => `<span>·</span>${a}`).join('')}</div><div class="n-text">${esc(n.text)}</div></div>
  </div>`;
}
function a3Threads(list, pinnedIds = []) {
  a3i = 0;
  const pinned = new Set(pinnedIds);
  const roots = list.filter((n) => !n.re).sort((a, b) => (pinned.has(a.id) ? 0 : 1) - (pinned.has(b.id) ? 0 : 1) || Date.parse(a.ts) - Date.parse(b.ts));
  const byRoot = new Map(roots.map((r) => [r.id, list.filter((n) => n.re === r.id)]));
  const orphans = list.filter((n) => n.re && !byRoot.has(n.re));
  let out = roots.map((r) => {
    const replies = byRoot.get(r.id);
    if (pinned.has(r.id)) return `<div class="n-thread">${a3Note(r, { pinned: true, collapsedReplies: replies.length })}</div>`;
    return `<div class="n-thread">${a3Note(r)}${replies.length ? `<div class="n-replies">${replies.map((x) => a3Note(x, { reply: true })).join('')}</div>` : ''}</div>`;
  }).join('');
  for (const o of orphans) out += `<div class="n-thread">${a3Note(null, { stub: 'Note removed' })}<div class="n-replies">${a3Note(o, { reply: true })}</div></div>`;
  return out;
}
function a3Composer() {
  return `<div class="composer" style="--mywash: ${washOf(ME, .22)};"><input maxlength="500" placeholder="Add a note…" aria-label="Add a note"><button class="btn-tonal" style="font-size: 12px; padding: 9px 15px; flex: none;">Save</button></div>`;
}
function a3Whisper(scope, target, label) {
  const list = model.notesFor(state.crewDoc, R.FID, scope, target);
  if (!list.length) return '';
  const newest = list[list.length - 1];
  const n = list.length;
  return `<button class="day-whisper" style="--wash: ${washOf(newest.author, .26)};" aria-label="Notes for ${esc(label)}: ${n} note${n === 1 ? '' : 's'}, newest from ${esc(newest.author)}">
  ${avatarHtml(newest.author, 18, 8, { border: false })}<span class="who">${newest.author === ME ? 'you' : esc(newest.author)}</span><span class="text">${esc(newest.text)}</span><span class="more">${n} note${n === 1 ? '' : 's'} ›</span></button>`;
}
function a3Pins(list) {
  a3i = 0;
  return `<div class="micro-label">Pinned by you</div>` + list.map((n) => a3Note(n, { pinned: true, actions: false })).join('');
}

// applyVariant, aura-flavoured: same variants, this vibe's whisper and pins.
function applyVariantAura(root, variant) {
  const parts = wallParts(root);
  const doc = R.document_;
  for (const [day, p] of Object.entries(parts.days)) {
    const isFest = day.startsWith('NOTES ·');
    const scope = isFest ? 'fest' : 'day';
    const target = isFest ? null : day;
    if (p.notes) p.notes.remove();
    if (variant === 'C') { if (isFest) p.rule.remove(); continue; }
    if (variant === 'B') {
      const w = a3Whisper(scope, target, isFest ? FEST.name : day);
      if (w) p.rule.insertAdjacentHTML('afterend', w); else if (isFest) p.rule.remove();
      continue;
    }
    if (variant === 'A') {
      const pins = new Set(JSON.parse(localStorage.getItem('fn_pins_v1') || '{}')[R.FID] || []);
      const list = model.notesFor(state.crewDoc, R.FID, scope, target).filter((n) => pins.has(n.id));
      if (!list.length) { if (isFest) p.rule.remove(); continue; }
      const holder = doc.createElement('div');
      holder.className = 'pins-inline';
      holder.innerHTML = a3Pins(list);
      p.rule.insertAdjacentElement('afterend', holder);
    }
  }
  return wallParts(root);
}
function renderSeamAura(variant, { mobile }) {
  R.setPins([R.IDS.sunRoot]);
  const root = R.renderWallEl();
  const parts = applyVariantAura(root, variant);
  const after = (rule) => { const out = []; let e = rule.nextElementSibling; while (e && !e.classList.contains('times-wrap') && !e.classList.contains('wall-grid')) { out.push(e.outerHTML); e = e.nextElementSibling; } return out.join(''); };
  const sat = parts.days.Saturday, sun = parts.days.Sunday;
  const grid = (d) => d.body.find((e) => e.classList.contains('times-wrap'));
  return `<div class="a3" style="position:absolute;inset:0;"><div class="shell" style="padding-top: 0;">
  ${mobile ? '' : railHtml('Saturday')}
  ${parts.strip.outerHTML}
  <div class="wall-wrap" style="margin-top: 8px;">
    ${clipGrid(grid(sat), { rowsVisible: mobile ? 7 : 9 })}
    ${sun.rule.outerHTML}${after(sun.rule)}
    ${clipGrid(grid(sun), { rowsVisible: 20, fromStart: 0 })}
  </div>
</div>${mobile ? dockHtml('Saturday') : ''}</div>`;
}
function injectFactsAura(gridEl, mode, hoverName) {
  for (const card of gridEl.querySelectorAll('.card.cell')) {
    const f = R.factsFor(card.dataset.artist);
    const facts = R.document_.createElement('div');
    facts.className = 'facts' + (mode === 'expand' && f.animated ? ' animated' : '');
    facts.setAttribute('aria-hidden', 'true');
    if (mode === 'expand') facts.style.background = f.background;
    facts.innerHTML = (mode === 'expand' ? '<span class="card-grain"></span>' : '') + a3Header(f);
    card.appendChild(facts);
    if (card.dataset.artist === hoverName) card.classList.add('is-hover');
  }
}

{
  const list = model.notesFor(state.crewDoc, R.FID, 'artist', NAMES.dogBlood);
  const f = R.factsFor(NAMES.dogBlood);
  const backWall = (mobile, variant = 'B') => {
    const root = R.renderWallEl();
    const parts = applyVariantAura(root, variant);
    const sat = parts.days.Saturday;
    const grid = sat.body.find((e) => e.classList.contains('times-wrap'));
    return `<div class="shell" style="padding-top: 0;">${mobile ? '' : railHtml('Saturday')}${parts.strip.outerHTML}
<div class="wall-wrap" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: mobile ? 30 : 28 })}</div></div>${mobile ? dockHtml('Saturday') : ''}`;
  };
  const sheet = (mobile) => `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Dog Blood">${mobile ? '<div class="grabber"></div>' : ''}${a3Card(f)}<div class="n-list">${a3Threads(list)}</div>${a3Composer()}</div>`;
  const W = (html, size) => wrap(html, { ...size, extraCss: a3Css });

  // Row 0 — the refined sheet + the MUST options
  note('v3-title', 0, -190, 1180, 'ROUND 3 — AURA, EVERYWHERE\nThe Aura vibe refined (name above the words, one left gutter for every note, replies nested one gutter in, 3 px inside a thread and 12 px between), then the same vibe carried into the open decisions so each is a choice between finished things. Beside the sheet: four ways to say MUST in the header. Reload a frame to see the notes rise in.');
  const m = { w: MOB, h: 844 }, d = { w: DESK, h: 820 };
  board('AuraPhone.dc.html', W(`<div class="a3 must-tag r2 d-aura" style="position:absolute;inset:0;">${backWall(true)}${sheet(true)}</div>`, m), m, { x: 0, y: 0 }, 'Aura · phone');
  board('AuraDesktop.dc.html', W(`<div class="a3 must-tag r2 d-aura" style="position:absolute;inset:0;">${backWall(false)}${sheet(false)}</div>`, d), d, { x: MOB + 100, y: 0 }, 'Aura · desktop dialog');
  const mustOpts = [
    ['must-tag', 'A — the word', 'A small MUST after the name. Says it outright; adds a second thing to read.'],
    ['must-ring', 'B — the ring', 'A ring on the pill in the wall’s corner-pill stroke: your tint, white only when it is you (white already means you everywhere). No extra word. Quiet; you have to know the language.'],
    ['must-bright', 'C — brightness', 'Pills get brighter with taps and MUST is the brightest — exactly how the auras work. Nothing to read; relative, so one person alone is hard to place.'],
    ['must-both', 'D — ring + brightness', 'Brightness for taps, the ring for must. Two signals that never fight.'],
  ];
  const strip = mustOpts.map(([cls, title, cap]) => `<div class="a3 ${cls} r2" style="display:flex;flex-direction:column;gap:6px;"><div class="cv-label">${esc(title)}</div>${a3Card(f, { close: false })}<div class="cv-cap">${esc(cap)}</div></div>`).join('');
  const s = { w: 600, h: 1080 };
  board('MustOptions.dc.html', W(`<div class="a3 cv-strip" style="position:absolute;inset:0;">${strip}</div>`, s), s, { x: MOB + 100 + DESK + 100, y: 0 }, 'MUST — four ways');

  // Row 1 — day notes, aura
  const Y1 = 1080 + 160;
  note('v3-r1', 0, Y1 - 150, 1180, 'DAY NOTES — DECIDED: THE WHISPER\nKevin (2026-08-29 18:04): nothing shown until there is a note; then the most recent note as one line at the top of the day, with the add affordance beside it. Here in Aura: the newest note as a soft wash under the day name (tap it to open the day’s notes); the ✎ chip on the rule stays the door and carries the count. Desktop, then phone.');
  [['B', 'The whisper — decided']].forEach(([v, title], i) => {
    const size = { w: DESK, h: 760 };
    board(`AuraDay${v}.dc.html`, W(renderSeamAura(v, { mobile: false }), size), size, { x: i * (DESK + 100), y: Y1 }, title);
    board(`AuraDay${v}Phone.dc.html`, W(renderSeamAura(v, { mobile: true }), m), m, { x: i * (DESK + 100), y: Y1 + 760 + 140 }, `${title} · phone`);
  });

  // Row 2 — hover, aura
  const Y2 = Y1 + 760 + 140 + 844 + 220;
  note('v3-r2', 0, Y2 - 150, 1180, 'HOVER FACTS, IN AURA (desktop only)\nThe same four-line header as the sheet. Option 1: a panel below the card. Option 2: the card grows in place with its aura. Hover any card in either frame; Dog Blood is frozen open.');
  const mkHover = (mode) => {
    const root = R.renderWallEl();
    const parts = applyVariantAura(root, 'B');
    const grid = parts.days.Saturday.body.find((e) => e.classList.contains('times-wrap'));
    injectFactsAura(grid, mode, NAMES.dogBlood);
    return `<div class="a3 must-tag r2 mode-${mode}" style="position:absolute;inset:0;"><div class="shell" style="padding-top: 0;">${railHtml('Saturday')}${parts.strip.outerHTML}
<div class="wall-wrap" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: 18, extraBottom: 220 })}</div></div></div>`;
  };
  const hs = { w: DESK, h: 600 };
  board('AuraHoverTooltip.dc.html', W(mkHover('tooltip'), hs), hs, { x: 0, y: Y2 }, 'Hover 1 — panel below');
  board('AuraHoverExpand.dc.html', W(mkHover('expand'), hs), hs, { x: DESK + 100, y: Y2 }, 'Hover 2 — the card grows');

  // Row 3 — thread cases, aura
  const Y3 = Y2 + 600 + 220;
  note('v3-r3', 0, Y3 - 150, 1180, 'THREAD CASES, IN AURA\nThe calls from round 1, redrawn. “Decided” follows from the model; “Your call” is taste, with my default shown.');
  const L = list;
  const root = L.find((n) => n.id === R.IDS.dbRoot), r1 = L.find((n) => n.id === R.IDS.dbR1), r2 = L.find((n) => n.id === R.IDS.dbR2), root2 = L.find((n) => n.id === R.IDS.dbRoot2);
  const T = (html) => { a3i = 0; return html(); };
  const cases = [
    ['A reply to a reply', 'decided', T(() => `<div class="n-thread">${a3Note(root)}<div class="n-replies">${a3Note(r1, { reply: true })}${a3Note(r2, { reply: true })}</div></div>`), 'One level deep: replying to Ben’s reply attaches to Cleo’s root. Threads at a festival are short; a second level costs indent on a phone and buys nothing.'],
    ['Pinned root', 'call', T(() => `<div class="n-thread">${a3Note(root, { pinned: true, collapsedReplies: 2 })}</div><div class="n-thread">${a3Note(root2)}</div>`), 'A pinned root sorts to the top and shows “2 replies”, never the thread (your rule); tapping the count opens it in place. Pins stay on your device.'],
    ['Root deleted, replies alive', 'call', T(() => `<div class="n-thread">${a3Note(null, { stub: 'Cleo removed this note' })}<div class="n-replies">${a3Note(r1, { reply: true })}${a3Note(r2, { reply: true })}</div></div>`), 'Replies stay under a quiet stub so they keep their context. Alternative: promote them to roots — cheaper, but they read as non-sequiturs.'],
    ['Reply lands before its root', 'decided', T(() => `<div class="n-thread">${a3Note(null, { stub: '…' })}<div class="n-replies">${a3Note(r2, { reply: true })}</div></div>`), 'Sync can deliver a reply a beat before its root. Same stub; the next paint slots it under the root.'],
    ['Your own reply', 'decided', T(() => `<div class="n-thread">${a3Note(root)}<div class="n-replies">${a3Note(r1, { reply: true })}</div></div>`), 'Edit works exactly as on a root (only your own). No Reply on a reply.'],
    ['Counts', 'decided', `<div style="display:flex;gap:10px;align-items:center;"><span class="chip-notes" style="height:16px;padding:0 8px;font-size:10px;">${L.length}</span><span class="cv-cap">card corner</span><span class="notes-chip" style="padding:5px 10px;">Notes <span class="count">${model.totalNoteCount(state.crewDoc, R.FID)}</span></span><span class="cv-cap">toolbar</span></div>`, `Every count includes replies: ${L.length} on the Dog Blood card, ${model.totalNoteCount(state.crewDoc, R.FID)} in the toolbar. A reply is a note.`],
    ['All notes (the home)', 'decided', T(() => `<div class="micro-label">Dog Blood</div><div class="n-thread">${a3Note(root)}<div class="n-replies">${a3Note(r1, { reply: true })}</div></div>`), 'The toolbar’s Notes sheet groups by festival / day / artist as today; threads render intact inside each group.'],
    ['Reply on day and festival notes', 'decided', T(() => `<div class="micro-label">Sunday</div><div class="n-thread">${a3Note(model.notesFor(state.crewDoc, R.FID, 'day', 'Sunday')[0])}<div class="n-replies">${a3Note(model.notesFor(state.crewDoc, R.FID, 'day', 'Sunday')[1], { reply: true })}</div></div><div class="micro-label">This festival</div><div class="n-thread">${a3Note(model.notesFor(state.crewDoc, R.FID, 'fest', null)[0])}<div class="n-replies">${a3Note(model.notesFor(state.crewDoc, R.FID, 'fest', null)[1], { reply: true })}</div></div>`), 'Same component at every scope; nothing about a thread knows what it hangs off.'],
    ['The whisper and threads', 'decided', a3Whisper('day', 'Sunday', 'Sunday'), 'The whisper shows the NEWEST note, root or reply — Cleo’s reply is the latest thing said on Sunday, so it is the line.'],
    ['Offline / conflict', 'decided', `<div class="cv-cap">No new state: a reply is one more leaf in the notes map and the merge handles it like any note. Two people replying at once both land.</div>`, 'Additive and merge-safe; old clients ignore the re key and show replies as plain notes in time order.'],
  ];
  const cells = cases.map(([title, tag, snippet, cap]) => `<div class="cv-case"><div style="display:flex;align-items:center;gap:8px;"><span class="cv-label">${esc(title)}</span><span class="cv-tag${tag === 'call' ? ' call' : ''}">${tag === 'call' ? 'Your call' : 'Decided'}</span></div><div style="display:flex;flex-direction:column;gap:6px;">${snippet}</div><div class="cv-cap">${esc(cap)}</div></div>`).join('');
  const ts = { w: 1180, h: 1300 };
  board('AuraThreadCases.dc.html', W(`<div class="a3 r2" style="position:absolute;inset:0;padding: 24px 28px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; box-sizing: border-box; overflow: hidden;">${cells}</div>`, ts), ts, { x: 0, y: Y3 }, 'Thread cases · aura');
}


// =====================================================================================
// ROUND 4 — Kevin's notes on round 3 (2026-08-29 18:16–18:22):
//  · hover: in-place wins, but the card must BECOME the bigger card — name stays put,
//    the corner marks unfold into names, notes/Spotify grow into words — and then that
//    card becomes the sheet header (the selected state). Live morph, tweakable.
//  · threads: less indent, a little more air between notes; tweak chips so he can dial it.
//  · header card: rounded corners like the other cards; sub line = time · short day · place;
//    "12 liked songs · following" (12 likes read as 12 people).
//  · afters cards on the wall: day/time on one line, venue on the next.
// =====================================================================================
PAGE = 'round-4';

const a4Css = `
${a3Css}
/* dials (tweak chips set these on the frame) */
.a4 .n-replies { margin-left: var(--indent, 22px); }
.a4 .n-thread { gap: var(--note-gap, 6px); }
.a4 .n-replies { gap: var(--note-gap, 6px); }
.a4 .n-thread + .n-thread { margin-top: var(--thread-gap, 16px); }
.a4 .n-note { border-radius: var(--note-radius, 12px); }
.a4 .sheet-card { margin: 0; border-radius: var(--header-radius, 12px); padding: 16px 16px 17px; align-items: center; text-align: center; }
.a4 .sheet-card .f-who { justify-content: center; }
.a4 .f-who .w { background: var(--wash); }
.a4 .f-chips { display: flex; justify-content: center; align-items: center; gap: 6px; position: relative; }
.a4 .f-chips .chip { display: inline-flex; align-items: center; height: 17px; padding: 0 8px; font-size: 10px; font-weight: 800; color: #fff; border-radius: 999px; line-height: 1; }
.a4 .f-chips .chip.notes { border-radius: var(--r-bubble); background: rgba(108, 91, 212, .62); }
.a4 .f-chips .chip.spot { background: rgba(18, 138, 62, .6); }
.a4 .sheet-card .f-line, .a4 .sheet-card .f-sub { text-align: center; }
@media (min-width: 720px) { .a4 .sheet-card { margin: 0; border-radius: var(--header-radius, 12px); padding: 18px 18px 19px; } }
.a4 .sheet-card .sheet-close { top: 12px; right: 12px; }
.a4 .sheet { gap: 0; }
.a4 .grabber { margin-bottom: 10px; }
.a4 .n-list { padding-top: var(--thread-gap, 16px); }

/* the morph: everything on the resting card grows into its expanded form on hover */
.morph { --ms: var(--morph-ms, 320ms); --ease: cubic-bezier(.2, .7, .2, 1); }
.morph .m { position: absolute; transition: all var(--ms) var(--ease); }
.morph .m-name { left: 8px; right: 8px; top: 50%; transform: translateY(-62%); text-align: center; color: #fff; font-weight: 700; font-size: 12px; line-height: 1.15; }
.morph .m-time { left: 8px; right: 8px; top: calc(50% + 7px); text-align: center; color: rgba(255,255,255,.75); font-size: 9px; font-weight: 600; }
.morph .m-sub { left: 8px; right: 8px; top: 37px; text-align: center; opacity: 0; color: rgba(255,255,255,.78); font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; transition: opacity calc(var(--ms) * .7) var(--ease) calc(var(--ms) * .3); }
.morph .m-who { right: 4px; bottom: 3px; display: flex; align-items: center; gap: 3px; }
.morph .pill { position: relative; display: inline-flex; align-items: baseline; justify-content: center; height: 12px; border-radius: 999px; color: #fff;
  font-size: 7.5px; font-weight: 800; overflow: hidden; white-space: nowrap; background: var(--prest); border: 1px solid var(--stroke); transition: all var(--ms) var(--ease); }
.morph .pill .ini { align-self: center; }
.morph .pill.must { width: 24px; }
.morph .pill.tick { width: 4px; }
.morph .pill .full { position: absolute; left: 10px; opacity: 0; font-size: 11px; font-weight: 600; transition: opacity calc(var(--ms) * .6) var(--ease); display: inline-flex; gap: 5px; align-items: baseline; }
.morph .pill .full b { font-size: 8.5px; font-weight: 800; letter-spacing: .1em; opacity: .9; }
.morph .m-about { left: 5px; bottom: 3px; display: flex; align-items: center; gap: 3px; }
.morph .chip { display: inline-flex; align-items: center; gap: 3px; height: 12px; padding: 0 5px; font-size: 8px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; line-height: 1; transition: all var(--ms) var(--ease); }
.morph .chip.notes { border-radius: var(--r-bubble); background: var(--notes-fill); border: 1px solid var(--notes-stroke); }
.morph .chip.spot { border-radius: 999px; background: var(--spotify-fill); border: 1px solid var(--spotify-stroke); }
.morph .chip .more { max-width: 0; opacity: 0; overflow: hidden; transition: all var(--ms) var(--ease); }
/* hovered / frozen */
.morph.is-hover, .morph:hover { width: var(--ew, 340px); margin-left: var(--shift, 0px); min-height: var(--expand-h, 132px) !important; z-index: 30; overflow: visible; box-shadow: 0 18px 50px rgba(0, 0, 0, .55); }
.morph.is-hover .m-name, .morph:hover .m-name { top: 13px; transform: none; font-size: 15px; }
.morph.is-hover .m-time, .morph:hover .m-time { opacity: 0; }
.morph.is-hover .m-sub, .morph:hover .m-sub { opacity: 1; }
.morph { transition: width var(--ms) var(--ease), margin-left var(--ms) var(--ease), min-height var(--ms) var(--ease), box-shadow var(--ms) var(--ease); }
.morph.is-hover .m-who, .morph:hover .m-who { left: 8px; right: 8px; bottom: 34px; justify-content: center; gap: 4px; }
.morph.is-hover .pill, .morph:hover .pill { height: 22px; width: auto; min-width: 0; padding: 0 10px; background: var(--pwash); border-color: transparent; }
.morph.is-hover .pill.must, .morph:hover .pill.must { width: auto; }
.morph.is-hover .pill.tick, .morph:hover .pill.tick { width: auto; }
.morph.is-hover .pill .ini, .morph:hover .pill .ini { opacity: 0; }
.morph.is-hover .pill .full, .morph:hover .pill .full { position: static; opacity: 1; }
.morph.is-hover .m-about, .morph:hover .m-about { left: 8px; right: 8px; bottom: 10px; justify-content: center; gap: 6px; }
.morph.is-hover .chip, .morph:hover .chip { height: 16px; padding: 0 7px; font-size: 9.5px; border-color: transparent; }
.morph.is-hover .chip.notes, .morph:hover .chip.notes { background: rgba(108, 91, 212, .62); }
.morph.is-hover .chip.spot, .morph:hover .chip.spot { background: rgba(18, 138, 62, .6); }
.morph.is-hover .chip .more, .morph:hover .chip .more { max-width: 200px; opacity: 1; }
@media (hover: none) { .morph:hover { width: auto; min-height: 0 !important; box-shadow: none; } }

/* afters cards: day · time, then the venue */
.a4 .card.timed .time { display: flex; flex-direction: column; gap: 1px; }
.a4 .card.timed .time .venue { font-weight: 600; opacity: .85; }

/* three states of one card, side by side */
.a4.states, .a4 .states { display: flex; align-items: flex-start; gap: 34px; padding: 26px 28px; }
.a4.states .st, .a4 .states .st { display: flex; flex-direction: column; gap: 10px; }
.a4.states .arrow, .a4 .states .arrow { align-self: center; color: var(--text-tertiary); font-size: 22px; padding-top: 30px; }
`;

const shortDay = (d) => (FEST.dayMeta[d] && FEST.dayMeta[d].wd) || d;
function a4Sub(f) { return [timeRange(f.time), shortDay(f.day), f.stage].filter(Boolean).join(' · '); }
function a4Spot(f) {
  if (!f.spotify || (!f.spotify.songs && !f.spotify.followed)) return '';
  const bits = [];
  if (f.spotify.songs) bits.push(`${f.spotify.songs} liked song${f.spotify.songs === 1 ? '' : 's'}`);
  if (f.spotify.followed) bits.push('following');
  return bits.join(' · ');
}
function a4Header(f) {
  const who = f.people.map((p) => `<span class="w${p.isYou ? ' you' : ''}${p.level === 4 ? ' must' : ''}" style="--wash: ${washOf(p.name, .42)}; --washlvl: ${washOf(p.name, LVL_ALPHA[p.level])}; --ring: ${stroke(p.colorIndex, p.isYou)};">${p.isYou ? 'You' : esc(p.name)}${p.level === 4 ? '<b>MUST</b>' : ''}</span>`).join('');
  const chips = [];
  if (f.noteCount) chips.push(`<span class="chip notes">${f.noteCount}&nbsp;notes</span>`);
  const sp = a4Spot(f); if (sp) chips.push(`<span class="chip spot">${f.spotify && f.spotify.songs ? `${f.spotify.songs} liked song${f.spotify.songs === 1 ? '' : 's'}` : ''}${f.spotify && f.spotify.songs && f.spotify.followed ? ' · ' : ''}${f.spotify && f.spotify.followed ? bookmarkSvg + ' following' : ''}</span>`);
  return `<div class="f-name">${esc(f.name)}</div><div class="f-sub">${esc(a4Sub(f))}</div><div class="f-who">${who}</div>${chips.length ? `<div class="f-chips">${chips.join('')}</div>` : ''}`;
}
function a4Card(f, { close = true } = {}) {
  return `<div class="sheet-card${f.animated ? ' animated' : ''}" style="background: ${f.background};"><span class="card-grain"></span>${close ? '<button class="sheet-close" aria-label="Close">✕</button>' : ''}${a4Header(f)}</div>`;
}

// A production cell, rebuilt so every piece can grow: the name, the corner marks, the chips.
function morphCell(cardEl) {
  const name = cardEl.dataset.artist;
  const f = R.factsFor(name);
  const marks = R.lib.aura.whoCorner(f.people.map((p) => ({ ...p })));
  const time = cardEl.querySelector('.time') ? cardEl.querySelector('.time').textContent : '';
  const pills = f.people.slice(0, 4).map((p) => {
    const must = p.level === 4;
    const mark = marks.find((m) => m.kind !== 'ghost' && m.label === R.lib.aura.initialFor(p, f.people)) || {};
    return `<span class="pill ${must ? 'must' : 'tick'}" style="--prest: ${hsl(p.colorIndex, .5)}; --pwash: ${washOf(p.name, .42)}; --stroke: ${stroke(p.colorIndex, p.isYou)};"><span class="ini">${must ? esc(R.lib.aura.initialFor(p, f.people)) : ''}</span><span class="full">${p.isYou ? 'You' : esc(p.name)}${must ? '<b>MUST</b>' : ''}</span></span>`;
  }).join('');
  const chips = [];
  if (f.noteCount) chips.push(`<span class="chip notes">${f.noteCount}<span class="more">&nbsp;notes</span></span>`);
  if (f.spotify && (f.spotify.songs || f.spotify.followed)) chips.push(`<span class="chip spot">${f.spotify.songs || ''}<span class="more">&nbsp;liked song${f.spotify.songs === 1 ? '' : 's'}${f.spotify.followed ? ' ·&nbsp;' : ''}</span>${f.spotify.followed ? bookmarkSvg : ''}${f.spotify.followed ? '<span class="more">&nbsp;following</span>' : ''}</span>`);
  // content-hugging width: the widest of the four centred rows, clamped, plus an edge
  // clamp so column 1 grows rightward and the last column leftward (tooltip physics).
  const sub = a4Sub(f);
  const pillsW = f.people.slice(0, 4).reduce((w, p) => w + (p.isYou ? 3 : p.name.length) * 6.1 + 20 + (p.level === 4 ? 34 : 0) + 4, 0);
  const chipsW = (f.noteCount ? String(f.noteCount).length * 5.2 + 40 : 0) + (f.spotify && (f.spotify.songs || f.spotify.followed) ? 34 * 5.2 + 30 : 0);
  const ew = Math.round(Math.min(360, Math.max(216, Math.max(name.length * 8.4 + 40, sub.length * 5.7 + 28, pillsW + 20, chipsW + 20))));
  const CELL = 197, GAP = 4;
  const growth = Math.max(0, ew - CELL);
  const col = parseInt(cardEl.style.gridColumn, 10) || 1;
  let shift = -growth / 2;
  if (col <= 1) shift = -GAP;
  if (col >= 5) shift = -(growth - GAP);
  cardEl.style.setProperty('--ew', `${ew}px`);
  cardEl.style.setProperty('--shift', `${Math.round(shift)}px`);
  // keep the production node (aura, grain, placement, classes); swap its children for the morph anatomy
  const keep = [...cardEl.children].filter((c) => c.classList.contains('card-grain')).map((c) => c.outerHTML).join('');
  cardEl.classList.add('morph');
  cardEl.innerHTML = `${keep}<span class="m m-name">${esc(name)}</span><span class="m m-time">${esc(time)}</span><span class="m m-sub">${esc(a4Sub(f))}</span><span class="m m-who">${pills}</span><span class="m m-about">${chips.join('')}</span>`;
}

{
  const list = model.notesFor(state.crewDoc, R.FID, 'artist', NAMES.dogBlood);
  const f = R.factsFor(NAMES.dogBlood);
  const backWall = (mobile) => {
    const root = R.renderWallEl();
    const parts = applyVariantAura(root, 'B');
    const grid = parts.days.Saturday.body.find((e) => e.classList.contains('times-wrap'));
    return `<div class="shell" style="padding-top: 0;">${mobile ? '' : railHtml('Saturday')}${parts.strip.outerHTML}
<div class="wall-wrap" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: mobile ? 30 : 28 })}</div></div>${mobile ? dockHtml('Saturday') : ''}`;
  };
  const sheet = (mobile) => `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-label="Dog Blood">${mobile ? '<div class="grabber"></div>' : ''}${a4Card(f)}<div class="n-list">${a3Threads(list)}</div>${a3Composer()}</div>`;

  // Tweak chips: the dials Kevin asked for. Section groups them in the panel.
  const threadProps = {
    indent: { editor: 'int', default: 22, min: 0, max: 48, unit: 'px', section: 'Threads' },
    noteGap: { editor: 'int', default: 6, min: 0, max: 20, unit: 'px', section: 'Threads' },
    threadGap: { editor: 'int', default: 16, min: 4, max: 40, unit: 'px', section: 'Threads' },
    noteRadius: { editor: 'int', default: 12, min: 0, max: 24, unit: 'px', section: 'Threads' },
    headerRadius: { editor: 'int', default: 12, min: 0, max: 24, unit: 'px', section: 'Header' },
  };
  const threadVars = { 'indent': 'v_indent + "px"', 'note-gap': 'v_noteGap + "px"', 'thread-gap': 'v_threadGap + "px"', 'note-radius': 'v_noteRadius + "px"', 'header-radius': 'v_headerRadius + "px"' };
  // the {{holes}} above bind to renderVals keys named after the expressions; simpler: name the keys directly
  const threadVarsSimple = { 'indent': 'indentPx', 'note-gap': 'noteGapPx', 'thread-gap': 'threadGapPx', 'note-radius': 'noteRadiusPx', 'header-radius': 'headerRadiusPx' };
  const wrapT = (body, size) => {
    const propsJson = JSON.stringify(threadProps).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
    const varStyle = Object.entries(threadVarsSimple).map(([k, v]) => `--${k}: {{${v}}};`).join(' ');
    const logic = `class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    const px = (k, d) => (p[k] ?? d) + 'px';
    return { indentPx: px('indent', 22), noteGapPx: px('noteGap', 6), threadGapPx: px('threadGap', 16), noteRadiusPx: px('noteRadius', 12), headerRadiusPx: px('headerRadius', 12) };
  }
}`;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
${fontCss}
${tokensCss}
${v3Css}
${shellCss}
${canvasCss}
${a4Css}
  </style>
</helmet>
<div class="vp" style="width: ${size.w}px; height: ${size.h}px; --fest: ${ACCENT}; ${varStyle}">
${body}
</div>
</x-dc>
<script data-dc-script data-props='${propsJson}'>
${logic}
</script>
</body>
</html>
`;
  };

  note('v4-title', 0, -190, 1180, 'ROUND 4 — YOUR NOTES\nThreads: less indent, more air — and the dials are yours now: the chips above each sheet set reply indent, the gap inside a thread, the gap between threads, note corners, header corners. Header: rounded like the other cards; time first, then the short day, then the place; “12 liked songs · following”. Hover: the card BECOMES the bigger card — the name stays, the corner marks unfold into names, the chips grow into words — then that same card is the sheet header. Move your mouse over the grid; the morph is live and its speed and size are dials too.');
  const m = { w: MOB, h: 844 }, d = { w: DESK, h: 820 };
  board('TweakPhone.dc.html', wrapT(`<div class="a4 a3 must-tag r2 d-aura" style="position:absolute;inset:0;">${backWall(true)}${sheet(true)}</div>`, m), m, { x: 0, y: 0 }, 'Sheet · phone (dials)');
  board('TweakDesktop.dc.html', wrapT(`<div class="a4 a3 must-tag r2 d-aura" style="position:absolute;inset:0;">${backWall(false)}${sheet(false)}</div>`, d), d, { x: MOB + 100, y: 0 }, 'Sheet · desktop (dials)');

  // The morph, live, with dials.
  const morphProps = {
    morphMs: { editor: 'int', default: 320, min: 80, max: 1200, unit: 'ms', section: 'Morph' },
    expandH: { editor: 'int', default: 132, min: 110, max: 220, unit: 'px', section: 'Morph' },
  };
  const wrapM = (body, size) => {
    const propsJson = JSON.stringify(morphProps).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
    const logic = `class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    return { ms: (p.morphMs ?? 320) + 'ms', eh: (p.expandH ?? 132) + 'px' };
  }
}`;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
${fontCss}
${tokensCss}
${v3Css}
${shellCss}
${canvasCss}
${a4Css}
  </style>
</helmet>
<div class="vp" style="width: ${size.w}px; height: ${size.h}px; --fest: ${ACCENT}; --morph-ms: {{ms}}; --expand-h: {{eh}};">
${body}
</div>
</x-dc>
<script data-dc-script data-props='${propsJson}'>
${logic}
</script>
</body>
</html>
`;
  };
  {
    const root = R.renderWallEl();
    const parts = applyVariantAura(root, 'B');
    const grid = parts.days.Saturday.body.find((e) => e.classList.contains('times-wrap'));
    for (const card of grid.querySelectorAll('.card.cell')) morphCell(card);
    grid.querySelector(`.card[data-artist="${NAMES.dogBlood}"]`).classList.add('is-hover');
    const hs = { w: DESK, h: 600 };
    board('HoverMorph.dc.html', wrapM(`<div class="a4 a3 r2" style="position:absolute;inset:0;"><div class="shell" style="padding-top: 0;">${railHtml('Saturday')}${parts.strip.outerHTML}
<div class="wall-wrap" style="margin-top: 8px;">${clipGrid(grid, { rowsVisible: 18, extraBottom: 220 })}</div></div></div>`, hs), hs, { x: 0, y: 844 + 160 }, 'Hover — the card becomes the card (live)');
  }
  note('v4-morph', DESK + 80, 844 + 160, 560, 'HOW THE MORPH WORKS\nThe hovered card is a small version of the open header — one continuous journey. The card grows around its own centre; the name never leaves the middle, with time · day · place centred beneath it. The corner marks travel into a centred who-row, widening into named pills in the same colours and order; the notes and Spotify chips grow their words into a centred line beneath. Rest → hover → open is the same stack at three sizes, so the sheet’s header (View Transitions) is the same element still travelling. At the grid’s edges the growth clamps instead of centring, like any tooltip.');

  // Three states of one card, side by side.
  {
    const root = R.renderWallEl();
    const parts = applyVariantAura(root, 'B');
    const grid = parts.days.Saturday.body.find((e) => e.classList.contains('times-wrap'));
    const cell = grid.querySelector(`.card[data-artist="${NAMES.dogBlood}"]`);
    const rest = cell.cloneNode(true);
    rest.style.gridColumn = ''; rest.style.gridRow = ''; rest.style.width = '196px'; rest.style.height = '120px'; rest.style.minHeight = '0';
    const hov = cell.cloneNode(true); morphCell(hov); hov.classList.add('is-hover');
    hov.style.gridColumn = ''; hov.style.gridRow = ''; hov.style.height = '132px'; hov.style.minHeight = '0'; hov.style.width = hov.style.getPropertyValue('--ew'); hov.style.setProperty('--shift', '0px'); hov.style.transition = 'none';
    const restM = cell.cloneNode(true); morphCell(restM);
    restM.style.gridColumn = ''; restM.style.gridRow = ''; restM.style.width = '196px'; restM.style.height = '120px'; restM.style.minHeight = '0';
    const open = `<div style="width: 420px;">${a4Card(f)}</div>`;
    const st = (label, html, cap) => `<div class="st"><div class="cv-label">${esc(label)}</div>${html}<div class="cv-cap" style="max-width: 300px;">${esc(cap)}</div></div>`;
    const body = `<div class="a4 a3 must-tag r2 states" style="position:absolute;inset:0;">
      ${st('Rest — production', rest.outerHTML, 'The card as it is today: name centred, time under it, marks and chips in the corners.')}
      <div class="arrow">→</div>
      ${st('Rest — morph anatomy', restM.outerHTML, 'The same card rebuilt so each piece can grow. Pixel-identical at rest; hover it.')}
      <div class="arrow">→</div>
      ${st('Hover', hov.outerHTML, 'Wider and taller over its neighbours; every piece grown into its long form. Frozen here; live on the grid frame.')}
      <div class="arrow">→</div>
      ${st('Open — the sheet header', open, 'The selected state: the same card, larger, pills as washes. Hover → open carries the element across (View Transitions).')}
    </div>`;
    const ss = { w: 1180 + 420, h: 330 };
    board('MorphStates.dc.html', wrap(body, { ...ss, extraCss: a4Css }), ss, { x: 0, y: 844 + 160 + 600 + 140 }, 'Rest → hover → open');
  }

  // Afters cards on the wall: day · time, then the venue.
  {
    const root = R.renderWallEl();
    const parts = applyVariantAura(root, 'B');
    const aft = parts.days.Afters;
    for (const t of aft.rule.parentNode.querySelectorAll('.card.timed .time')) {
      const bits = t.textContent.split(' · ');
      if (bits.length >= 3) { const time = bits.pop(); const day = bits.shift(); t.innerHTML = `<span>${esc(`${day} · ${time}`)}</span><span class="venue">${esc(bits.join(' · '))}</span>`; }
      else if (bits.length === 2) { t.innerHTML = `<span>${esc(bits[1])}</span><span class="venue">${esc(bits[0])}</span>`; }
    }
    const gridHtml = aft.body.map((e) => e.outerHTML).join('');
    const as = { w: DESK, h: 420 };
    board('AftersCards.dc.html', wrap(`<div class="a4 a3 r2" style="position:absolute;inset:0;"><div class="shell" style="padding-top: 0;">${railHtml('Afters')}<div class="wall-wrap" style="margin-top: 8px;">${aft.rule.outerHTML}${gridHtml}</div></div></div>`, { ...as, extraCss: a4Css }), as, { x: 0, y: 844 + 160 + 600 + 140 + 330 + 140 }, 'Afters cards — two-line sub-label');
  }
}

const canvas = { pages: [{ id: 'round-4', name: 'Round 4 — your notes' }, { id: 'round-3', name: 'Round 3 — Aura, everywhere' }, { id: 'round-2', name: 'Round 2 — three vibes' }, { id: 'round-1', name: 'Round 1 — all six asks' }], artboards: layout, annotations, launch: { view: 'canvas', page: 'round-4' } };
writeFileSync(`${OUT}/canvas.json`, JSON.stringify(canvas, null, 2));
console.log('artboards:', layout.map((l) => `${l.file} ${l.w}x${l.h} @${l.x},${l.y}`).join('\n'));
console.log('annotations:', annotations.length);
