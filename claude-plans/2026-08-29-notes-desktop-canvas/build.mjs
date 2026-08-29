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
.card:hover, .card.is-hover { overflow: visible; z-index: 20; }
.card:hover .facts, .card.is-hover .facts { display: flex; }
.card:hover .note-affordance, .card.is-hover .note-affordance { opacity: 1; }
.card.is-hover .note-affordance { display: inline-flex; }
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
  border: 1px solid var(--hairline); border-radius: var(--r-card); box-shadow: 0 18px 50px rgba(0, 0, 0, .55);
  background-size: 180% 180%; animation: gradShift 12s ease-in-out infinite; overflow: hidden; }
.mode-expand .card .facts .card-grain { z-index: 0; }
.mode-expand .card .facts > * { z-index: 1; }

/* The expanded card as the notes sheet's header — one component, two homes. */
.sheet-card { position: relative; overflow: hidden; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px;
  padding: 11px 13px 12px; border: 1px solid var(--hairline); border-radius: var(--r-card);
  background-size: 180% 180%; animation: gradShift 12s ease-in-out infinite; }
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
function avatarHtml(name, size = 22, font = 9) {
  const ci = PEOPLE[name].colorIndex;
  return `<span class="avatar" style="width: ${size}px; height: ${size}px; font-size: ${font}px; background: ${hsl(ci, 0.5)}; border: 1px solid ${stroke(ci, false)};">${esc(name.charAt(0).toUpperCase())}</span>`;
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
function board(file, html, size, pos, title) {
  writeFileSync(`${OUT}/${file}`, html);
  boards.push(file);
  layout.push({ file, x: pos.x, y: pos.y, w: size.w, h: size.h, title });
}
function note(id, x, y, w, text) { annotations.push({ id, x, y, w, text }); }

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
note('r1-title', 0, -150, 1180, 'DAY NOTES — where they live without the bars\nToday: every day renders all its notes plus a composer under its grid (the "bars"). The three directions below keep the ✎ count chip on the day rule as the door and change what sits inline. Same rule applies to the festival notes at the wall’s end. Desktop on top, phone underneath — every wall here is rendered by production code (real auras, corners, chips), only the notes treatment differs.');
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
      'Replies stay, under a quiet stub, so “yes — coming from Warehouse” keeps its context. Alternative: promote them to roots — cheaper, but they read as non-sequiturs.'],
    ['Reply lands before its root', 'decided', `<div class="thread"><div class="note-row"><span class="avatar" style="width:22px;height:22px;font-size:9px;background:var(--card);border:1px dashed var(--border-emphasis);"></span><div class="bubble"><span class="stub">…</span></div></div>${noteRowHtml(r2, { reply: true })}</div>`,
      'Sync can deliver a reply a beat before its root. Same stub treatment; the next paint slots it under the root. No data is wrong at any moment.'],
    ['Your own reply', 'decided', `<div class="thread">${noteRowHtml(root)}${noteRowHtml(r1, { reply: true })}</div>`,
      'Edit and Delete work exactly as on a root (same id rule: only your own). No Reply on a reply.'],
    ['Counts', 'decided', `<div style="display:flex;gap:10px;align-items:center;"><span class="chip-notes" style="height:16px;padding:0 8px;font-size:10px;">4</span><span class="cv-cap">card corner</span><span class="notes-chip" style="padding:5px 10px;">Notes <span class="count">8</span></span><span class="cv-cap">toolbar</span></div>`,
      'Every count includes replies: 4 on the Dog Blood card (2 roots + 2 replies), 8 in the toolbar. A reply is a note; the number answers “how much is being said here”.'],
    ['All notes (the home)', 'decided', `<div class="micro-label">Dog Blood</div><div class="thread">${noteRowHtml(root, { pin: false })}${noteRowHtml(r1, { reply: true })}</div>`,
      'The toolbar’s Notes sheet groups by festival / day / artist as today; threads render intact under their roots inside each group.'],
    ['Reply on day and festival notes', 'decided', `<div class="thread">${noteRowHtml(model.notesFor(state.crewDoc, R.FID, 'day', 'Sunday')[0])}${noteRowHtml(model.notesFor(state.crewDoc, R.FID, 'day', 'Sunday')[1], { reply: true })}</div>`,
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

const canvas = { artboards: layout, annotations, launch: { view: 'canvas' } };
writeFileSync(`${OUT}/canvas.json`, JSON.stringify(canvas, null, 2));
console.log('artboards:', layout.map((l) => `${l.file} ${l.w}x${l.h} @${l.x},${l.y}`).join('\n'));
console.log('annotations:', annotations.length);
