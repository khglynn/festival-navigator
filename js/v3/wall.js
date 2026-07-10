// The wall — v3's main screen (atlas 21c/21d, lineup mode). Renders day
// sections of aura cards from the live crew doc, owns the tap cycle with the
// undo toast, search/sort, and the mobile dock's scrollspy.
//
// SECURITY RULE (Codex P2 gate, finding 6): every artist name, person name,
// and note text in this file goes through textContent / createElement — no
// innerHTML interpolation of doc-derived strings, ever.
import * as state from '../state.js';
import * as model from './model.js';
import { auraBackground, whoCorner, aboutCorner, nameColor } from './aura.js';
import { BOARD } from './palette.js';
import { notesSection } from './notes.js'; // runtime-only cycle with this module (colorIndexOf) — safe

// ---- person -> board color ---------------------------------------------------
// v4 people carry colorIndex. Legacy people carry a "R, G, B" string from the
// old 12-color palette; map its palette position onto the board (both are
// hue-spread, positions correspond) — deterministic on every device, no
// writes needed. Unknown strings hash the name (stable, collision-tolerable).
export function colorIndexOf(name, personObj) {
  if (Number.isInteger(personObj?.colorIndex)) return personObj.colorIndex;
  const legacyIdx = state.COLOR_PALETTE.indexOf(personObj?.color);
  if (legacyIdx >= 0) return legacyIdx % BOARD.length;
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % BOARD.length;
}

// ---- card data ----------------------------------------------------------------
function cardPeople(artist, picks, meName) {
  const byPerson = picks[artist] || {};
  const peopleObj = state.people();
  const out = [];
  for (const [person, level] of Object.entries(byPerson)) {
    const p = peopleObj[person];
    if (!state.isActivePerson(p)) continue;
    out.push({ name: person, colorIndex: colorIndexOf(person, p), isYou: person === meName, level });
  }
  return out;
}

const BOOKMARK_PATH = 'M1 1h8v11l-4-3-4 3z';

function svgBookmark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '7'); svg.setAttribute('height', '9'); svg.setAttribute('viewBox', '0 0 10 13');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', BOOKMARK_PATH); path.setAttribute('fill', '#fff');
  svg.appendChild(path);
  return svg;
}

export function renderCard(artistName, ctx, opts = {}) {
  const people = cardPeople(artistName, ctx.picks, ctx.meName);
  const el = document.createElement('div');
  el.className = 'card' + (opts.cell ? ' cell' : '');
  el.dataset.artist = artistName;
  const { background, animated } = auraBackground(people);
  el.style.background = background;
  if (animated && !ctx.lowPower) {
    el.classList.add('animated');
    const grain = document.createElement('span');
    grain.className = 'card-grain';
    el.appendChild(grain);
  }
  const nm = document.createElement('span');
  nm.className = 'name';
  nm.style.color = nameColor(people);
  nm.textContent = artistName;
  el.appendChild(nm);

  const about = document.createElement('span');
  about.className = 'corner-about';
  const noteN = model.noteCount(state.crewDoc, ctx.fid, 'artist', artistName);
  const aff = ctx.affinity ? ctx.affinity[artistName.toLowerCase()] : null;
  for (const chip of aboutCorner({ noteCount: noteN, spotify: aff ? { songs: aff.songs || 0, followed: !!aff.followed } : null })) {
    const c = document.createElement('span');
    c.className = chip.kind === 'notes' ? 'chip-notes' : 'chip-spotify';
    c.textContent = chip.label;
    if (chip.kind === 'spotify' && chip.followed) c.appendChild(svgBookmark());
    if (chip.kind === 'notes' && ctx.onOpenNotes) {
      c.style.cursor = 'pointer';
      c.addEventListener('click', (e) => { e.stopPropagation(); ctx.onOpenNotes(artistName); });
    }
    about.appendChild(c);
  }
  el.appendChild(about);

  // Long-press (mobile) opens the artist notes sheet (~500ms, atlas 21g).
  // Digitizer jitter fires pointermove even on a still finger, so cancel only
  // past a real movement threshold (10px) — a genuine scroll-drag cancels,
  // a held finger does not (Codex P3 trail, finding 1).
  if (ctx.onOpenNotes) {
    let pressTimer = null;
    let longPressed = false;
    let startX = 0, startY = 0;
    el.addEventListener('pointerdown', (e) => {
      longPressed = false;
      startX = e.clientX; startY = e.clientY;
      pressTimer = setTimeout(() => { longPressed = true; ctx.onOpenNotes(artistName); }, 500);
    });
    const cancel = () => clearTimeout(pressTimer);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
    });
    el.addEventListener('click', (e) => { if (longPressed) { e.stopImmediatePropagation(); longPressed = false; } }, true);
  }

  const who = document.createElement('span');
  who.className = 'corner-who';
  for (const m of whoCorner(people)) {
    const s = document.createElement('span');
    s.className = 'mark' + (m.kind === 'ghost' ? ' ghost' : '');
    if (m.kind !== 'ghost') {
      s.style.width = m.width + 'px';
      s.style.background = m.fill;
      s.style.border = '1px solid ' + m.stroke;
      s.style.fontSize = m.kind === 'must' ? '7.5px' : '0px';
    }
    s.textContent = m.label;
    who.appendChild(s);
  }
  el.appendChild(who);

  el.addEventListener('click', () => ctx.onTap(artistName, el));
  return el;
}

// Re-render one card in place after a pick change (no full-wall repaint).
export function refreshCard(el, artistName, ctx) {
  const fresh = renderCard(artistName, ctx, { cell: el.classList.contains('cell') });
  el.replaceWith(fresh);
  return fresh;
}

// ---- day grouping (lineup mode) -----------------------------------------------
// Artists keep billing order inside each group. Groups follow first-appearance
// order of their day; artists with no day form THE LINEUP block (first).
export function groupByDay(artists) {
  const groups = new Map();
  for (const a of artists) {
    const key = a.day || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  return groups;
}

function dayHeader(label, sub) {
  const rule = document.createElement('div');
  rule.className = 'day-rule';
  rule.dataset.day = label;
  const d = document.createElement('span');
  d.className = 'day';
  d.textContent = label.toUpperCase();
  const dt = document.createElement('span');
  dt.className = 'date';
  dt.textContent = sub || '';
  const line = document.createElement('span');
  line.className = 'line';
  rule.append(d, dt, line);
  return rule;
}

// ---- search / sort -------------------------------------------------------------
export function applyFilter(artists, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return artists;
  return artists.filter((a) => a.name.toLowerCase().includes(q));
}

export function applySort(artists, mode, ctx) {
  const arr = [...artists];
  const myLevel = (a) => (ctx.picks[a.name] || {})[ctx.meName] || 0;
  const crewHeat = (a) => Object.values(ctx.picks[a.name] || {}).reduce((s, l) => s + l, 0);
  if (mode === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === 'mine') arr.sort((a, b) => myLevel(b) - myLevel(a));
  else if (mode === 'crew') arr.sort((a, b) => crewHeat(b) - crewHeat(a));
  return arr; // 'billing' and 'day' keep source order; day grouping handles days
}

// ---- set-times grid (atlas 21d: the same cards, on a clock) ---------------------
// One vertical page: every day gets a rule + a clock grid. Mobile shows ~2
// stages and swipes (scroll-snap inside .times-scroll); desktop fits them all.
function renderScheduledDay(root, day, ctx) {
  const fest = state.fest();
  const dayData = fest.days[day];
  const computed = state.getDayArtists(day);
  const stages = dayData.stages || [];
  const meta = (fest.dayMeta || {})[day];
  root.appendChild(dayHeader(day, meta ? `${meta.wd || ''} ${meta.num || ''}`.trim() : ''));

  const dayStart = Math.min(...computed.map((a) => a.startMin));
  const dayEnd = Math.max(...computed.map((a) => a.endMin ?? a.startMin + 60));
  const startRow = Math.floor(dayStart / 15);
  const rows = Math.ceil(dayEnd / 15) - startRow;

  const scroll = document.createElement('div');
  scroll.className = 'times-scroll';
  const grid = document.createElement('div');
  grid.className = 'times-grid';
  grid.style.gridTemplateColumns = `40px repeat(${stages.length}, minmax(150px, 1fr))`;
  grid.style.gridTemplateRows = `auto repeat(${rows}, 20px)`;

  grid.appendChild(document.createElement('div'));
  for (const s of stages) {
    const h = document.createElement('div');
    h.className = 'stage-head';
    h.textContent = s;
    grid.appendChild(h);
  }
  for (let r = startRow; r < startRow + rows; r++) {
    if (r % 4 !== 0) continue; // hour marks only
    const mins = r * 15;
    const hr = Math.floor(mins / 60) % 24;
    const label = document.createElement('div');
    label.className = 'hour-label';
    label.style.gridColumn = '1';
    label.style.gridRow = String(r - startRow + 2);
    label.textContent = `${hr % 12 === 0 ? 12 : hr % 12} ${hr < 12 ? 'AM' : 'PM'}`;
    grid.appendChild(label);
  }
  for (const a of computed) {
    const col = stages.indexOf(a.stage);
    if (col === -1) continue;
    const cell = renderCard(a.name, ctx, { cell: true, time: a.startStr });
    cell.style.gridColumn = String(col + 2);
    const row = Math.floor(a.startMin / 15) - startRow + 2;
    const span = Math.max(1, Math.ceil(((a.endMin ?? a.startMin + 60) - a.startMin) / 15));
    cell.style.gridRow = `${row} / span ${span}`;
    cell.style.minHeight = '0';
    grid.appendChild(cell);
  }
  scroll.appendChild(grid);
  root.appendChild(scroll);

  // Non-stage programming (workshops, silent disco) — data-driven list under
  // the grid, kept from the old model (docs/add-a-festival.md activities{}).
  const acts = (fest.activities || {})[day];
  if (Array.isArray(acts) && acts.length) {
    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    for (const a of acts) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; gap: 10px; align-items: baseline; font-size: 11.5px;';
      const t = document.createElement('span');
      t.style.cssText = 'color: var(--text-tertiary); font-weight: 600; flex: none; width: 130px;';
      t.textContent = a.time;
      const n = document.createElement('span');
      n.style.cssText = 'color: var(--text-body); font-weight: 600;';
      n.textContent = a.name;
      const v = document.createElement('span');
      v.style.cssText = 'color: var(--text-tertiary); font-weight: 600; margin-left: auto;';
      v.textContent = a.venue;
      row.append(t, n, v);
      list.appendChild(row);
    }
    root.appendChild(list);
  }
  if (ctx.onNotesChange) root.appendChild(notesSection('day', day, day, ctx, ctx.onNotesChange));
}

// ---- the wall ------------------------------------------------------------------
export function renderWall(root, ctx) {
  root.textContent = '';
  const fest = state.fest();

  // Scheduled fests (days{} with set times) render the clock view; search
  // falls back to the flat lineup so filtering stays usable.
  if (fest.days && Object.keys(fest.days).length && !ctx.query) {
    for (const day of Object.keys(fest.days)) renderScheduledDay(root, day, ctx);
    if (ctx.onNotesChange) {
      root.appendChild(dayHeader(`NOTES · ${fest.name.toUpperCase()}`, ''));
      root.appendChild(notesSection('fest', null, '', ctx, ctx.onNotesChange));
    }
    return;
  }

  const artists = applySort(applyFilter(fest.artists || [], ctx.query), ctx.sort, ctx);

  if (!artists.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 30px 0;';
    empty.textContent = ctx.query ? 'No artists match.' : 'Lineup coming soon.';
    root.appendChild(empty);
    return;
  }

  const grouped = ctx.sort === 'billing' || ctx.sort === 'day' ? groupByDay(artists) : new Map([['', artists]]);
  for (const [day, list] of grouped) {
    const meta = (fest.dayMeta || {})[day];
    root.appendChild(dayHeader(
      day || 'THE LINEUP',
      day ? (meta ? `${meta.wd || ''} ${meta.num || ''}`.trim() : '') : (ctx.sort === 'billing' ? 'BILLING ORDER' : ''),
    ));
    const grid = document.createElement('div');
    grid.className = 'wall-grid';
    for (const a of list) grid.appendChild(renderCard(a.name, ctx));
    root.appendChild(grid);
    // Day notes with personal pins live under each real day's cards (21e).
    if (day && ctx.onNotesChange) {
      root.appendChild(notesSection('day', day, day, ctx, ctx.onNotesChange));
    }
  }

  // Fest-wide notes close the wall (21c bottom).
  if (ctx.onNotesChange) {
    root.appendChild(dayHeader(`NOTES · ${fest.name.toUpperCase()}`, ''));
    root.appendChild(notesSection('fest', null, '', ctx, ctx.onNotesChange));
  }
}

// ---- undo toast (design open question 1: tap-5 clears via undo window) ---------
let toastTimer = null;
export function showUndoToast(container, message, onUndo) {
  container.textContent = '';
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  const msg = document.createElement('span');
  msg.textContent = message;
  const btn = document.createElement('button');
  btn.className = 'undo-btn';
  btn.textContent = 'Undo';
  btn.addEventListener('click', () => { clearTimeout(toastTimer); container.textContent = ''; onUndo(); });
  toast.append(msg, btn);
  container.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { container.textContent = ''; }, 5000);
}

// ---- dock scrollspy -------------------------------------------------------------
export function wireScrollspy(dockDays, wallRoot) {
  const tabs = [...dockDays.querySelectorAll('.day-tab')];
  if (!tabs.length) return () => {};
  const headers = [...wallRoot.querySelectorAll('.day-rule[data-day]')];
  const byDay = new Map(tabs.map((t) => [t.dataset.day, t]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const day = e.target.dataset.day;
      tabs.forEach((t) => t.classList.toggle('active', t === byDay.get(day)));
    }
  }, { rootMargin: '-10% 0px -80% 0px' });
  headers.forEach((h) => io.observe(h));
  return () => io.disconnect();
}
