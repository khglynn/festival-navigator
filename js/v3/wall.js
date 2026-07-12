// The wall — v3's main screen (atlas 21c/21d, lineup mode). Renders day
// sections of aura cards from the live crew doc, owns the tap cycle with the
// undo toast, search/sort, and the mobile dock's scrollspy.
//
// SECURITY RULE (Codex P2 gate, finding 6): every artist name, person name,
// and note text in this file goes through textContent / createElement — no
// innerHTML interpolation of doc-derived strings, ever.
import * as state from '../state.js';
import * as model from './model.js';
import { LEVEL_LABELS_V4 } from '../parse.js';
import { computeLanes } from '../overlap.js';
import { activityMinutes } from '../time.js';
import { auraBackground, whoCorner, aboutCorner, nameColor, subColor } from './aura.js';
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
  el.className = 'card' + (opts.cell ? ' cell' : '') + (opts.time && !opts.cell ? ' timed' : '');
  el.dataset.artist = artistName;
  // Keyboard-first card (AX-1): real button semantics, the pick level in the
  // accessible name so a screen reader hears state, Enter/Space cycle.
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  const myLevel = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  el.setAttribute('aria-label', `${artistName} — ${myLevel === 4 ? 'must' : (LEVEL_LABELS_V4[myLevel] || 'not picked').toLowerCase()}`);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.onTap(artistName, el); }
  });
  // Stash render opts on the node so refreshCard can reproduce this exact
  // render — a single-card refresh must preserve every invariant the full
  // render established (CORE-1/CORE-3).
  if (opts.time) el.dataset.time = opts.time;
  if (opts.tag) el.dataset.tag = opts.tag;
  if (opts.tag) {
    const tag = document.createElement('span');
    tag.className = 'chip-weekend';
    tag.textContent = opts.tag;
    el.appendChild(tag);
  }
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
  if (opts.time) {
    const t = document.createElement('span');
    t.className = 'time';
    t.style.color = subColor(people);
    t.textContent = opts.time;
    el.appendChild(t);
  }

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

  // Pointer-fine hover affordance (DT-6): notes are reachable without knowing
  // the long-press. ✎, never a music note — that glyph belongs to Spotify.
  if (ctx.onOpenNotes) {
    const pen = document.createElement('button');
    pen.className = 'note-affordance';
    pen.textContent = '✎';
    pen.setAttribute('aria-label', `Notes for ${artistName}`);
    pen.addEventListener('click', (e) => { e.stopPropagation(); ctx.onOpenNotes(artistName); });
    el.appendChild(pen);
  }

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
      // If a poll repaint detached this node mid-press, the new node owns the
      // gesture — a fire from the orphan would open the sheet uninvited.
      pressTimer = setTimeout(() => {
        if (!el.isConnected) return;
        longPressed = true;
        ctx.onOpenNotes(artistName);
      }, 500);
    });
    const cancel = () => clearTimeout(pressTimer);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
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
// The fresh card must land exactly where the old one was: same render opts
// (cell variant, time line) AND the placement the full render computed —
// grid position and lane split live as inline styles on the node (CORE-1).
const PLACEMENT_PROPS = ['grid-column', 'grid-row', 'width', 'margin-left', 'min-height'];
export function refreshCard(el, artistName, ctx) {
  const fresh = renderCard(artistName, ctx, {
    cell: el.classList.contains('cell'),
    time: el.dataset.time || undefined,
    tag: el.dataset.tag || undefined,
  });
  for (const prop of PLACEMENT_PROPS) {
    const v = el.style.getPropertyValue(prop);
    if (v) fresh.style.setProperty(prop, v);
  }
  el.replaceWith(fresh);
  return fresh;
}

// ---- day grouping (lineup mode) -----------------------------------------------
// Split a combined day string ("Saturday & Sunday") into real days. Returns
// null unless EVERY part matches a known day name — an unrecognized part means
// the string isn't a clean combination and stays a literal group (ST-1).
export function splitDays(dayStr, knownDays) {
  if (!dayStr || !knownDays?.length) return null;
  // No comma in the separator set: real combinations use & / + / "and", while
  // commas live inside single-day labels ("Wednesday, Sept 16 (pre-party)").
  const parts = String(dayStr).split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const canon = new Map(knownDays.map((d) => [d.toLowerCase(), d]));
  const mapped = parts.map((p) => canon.get(p.toLowerCase()));
  return mapped.every(Boolean) ? mapped : null;
}

// The festival's real days, in intended order: dayMeta keys when curated,
// else the atomic (non-combined) day values in first-appearance order.
export function knownDaysOf(fest) {
  const meta = Object.keys(fest.dayMeta || {});
  if (meta.length) return meta;
  const days = [];
  for (const a of fest.artists || []) {
    if (!a.day || /[&+/]|\s+and\s+/i.test(a.day)) continue;
    if (!days.includes(a.day)) days.push(a.day);
  }
  return days;
}

// Artists keep billing order inside each group. Groups follow known-day order
// first, then first appearance; artists with no day form THE LINEUP block.
// A multi-day artist appears under EACH of its days (spec F4), never as a
// combined "Day X & Day Y" section.
export function groupByDay(artists, knownDays = []) {
  const groups = new Map();
  const add = (key, a) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  };
  for (const a of artists) {
    const split = splitDays(a.day, knownDays);
    if (split) for (const d of split) add(d, a);
    else add(a.day || '', a);
  }
  if (!knownDays.length) return groups;
  const ordered = new Map();
  if (groups.has('')) ordered.set('', groups.get(''));
  for (const d of knownDays) if (groups.has(d)) ordered.set(d, groups.get(d));
  for (const [k, v] of groups) if (!ordered.has(k)) ordered.set(k, v);
  return ordered;
}

function dayHeader(label, sub, opts = {}) {
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
  // Day notes live at the day's front door (NT-2), not three scrolls past it.
  if (opts.onOpenNotes) {
    const chip = document.createElement('button');
    chip.className = 'chip-notes';
    chip.style.cssText = 'height: 17px; cursor: pointer; flex: none;';
    chip.textContent = opts.noteCount ? `${opts.noteCount} ✎` : '+ ✎';
    chip.setAttribute('aria-label', `Notes for ${label}`);
    chip.addEventListener('click', opts.onOpenNotes);
    rule.appendChild(chip);
  }
  return rule;
}

// The day rule's subtitle: real dates beat internal numbering (ST-4).
function dayRuleSub(meta) {
  if (!meta) return '';
  return [meta.wd, meta.date || (meta.num ? `Day ${meta.num}` : '')].filter(Boolean).join(' · ');
}

// ---- search / sort / weekend -----------------------------------------------------
export function applyFilter(artists, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return artists;
  return artists.filter((a) => a.name.toLowerCase().includes(q));
}

// Multi-weekend fests (ST-3): 'all' shows everyone; W1/W2 shows that
// weekend's lineup (artists playing both always stay).
export function applyWeekend(artists, weekend) {
  if (!weekend || weekend === 'all') return artists;
  return artists.filter((a) => !a.weekends || a.weekends === 'both' || a.weekends === weekend);
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
  root.appendChild(dayHeader(day, dayRuleSub(meta), {
    noteCount: model.noteCount(state.crewDoc, ctx.fid, 'day', day),
    onOpenNotes: ctx.onOpenDayNotes ? () => ctx.onOpenDayNotes(day) : null,
  }));

  const dayStart = Math.min(...computed.map((a) => a.startMin));
  const dayEnd = Math.max(...computed.map((a) => a.endMin ?? a.startMin + 60));
  const startRow = Math.floor(dayStart / 15);
  const rows = Math.ceil(dayEnd / 15) - startRow;

  // Rail and grid are siblings sharing one rows template: the hour axis stays
  // pinned at the left while stage columns scroll (CORE-2). The 32px header
  // row is fixed (not auto) so the rail's empty first row aligns exactly.
  const rowsTemplate = `32px repeat(${rows}, 20px)`;
  const wrap = document.createElement('div');
  wrap.className = 'times-wrap';
  const rail = document.createElement('div');
  rail.className = 'times-rail';
  rail.style.gridTemplateRows = rowsTemplate;
  const scroll = document.createElement('div');
  scroll.className = 'times-scroll';
  const grid = document.createElement('div');
  grid.className = 'times-grid';
  grid.style.gridTemplateColumns = `repeat(${stages.length}, minmax(150px, 1fr))`;
  grid.style.gridTemplateRows = rowsTemplate;

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
    label.style.gridRow = String(r - startRow + 2);
    label.textContent = `${hr % 12 === 0 ? 12 : hr % 12} ${hr < 12 ? 'AM' : 'PM'}`;
    rail.appendChild(label);
  }
  // Everything that isn't a stage set lives in ONE far-right column (ST-2):
  // activities (workshops, ceremonies) and any set whose stage isn't a known
  // column — which the old code silently DROPPED. Anything with stage+time
  // stays on the clock; the old below-grid list is gone.
  const acts = (fest.activities || {})[day] || [];
  const strays = computed.filter((a) => stages.indexOf(a.stage) === -1);
  const hasEE = acts.length > 0 || strays.length > 0;
  grid.style.gridTemplateColumns = `repeat(${stages.length + (hasEE ? 1 : 0)}, minmax(150px, 1fr))`;
  if (hasEE) {
    const h = document.createElement('div');
    h.className = 'stage-head';
    h.style.color = 'var(--text-secondary)'; // neutral tint — not a stage
    h.textContent = 'EVERYTHING ELSE';
    grid.appendChild(h);
  }

  // Same-stage overlaps split their column into side-by-side lanes (the old
  // grid's fix, dropped in the first v3 pass — the Codex P6 sweep surfaced
  // that EF genuinely has these; js/overlap.js is very much alive).
  const lanes = computeLanes(computed);
  for (const a of computed) {
    const col = stages.indexOf(a.stage);
    if (col === -1) continue; // strays render in the everything-else column
    const cell = renderCard(a.name, ctx, { cell: true, time: a.startStr });
    cell.style.gridColumn = String(col + 1);
    const row = Math.floor(a.startMin / 15) - startRow + 2;
    const span = Math.max(1, Math.ceil(((a.endMin ?? a.startMin + 60) - a.startMin) / 15));
    cell.style.gridRow = `${row} / span ${span}`;
    cell.style.minHeight = '0';
    const lane = lanes.get(a);
    if (lane && lane.lanes > 1) {
      cell.style.width = `calc(${(100 / lane.lanes).toFixed(3)}% - 2px)`;
      cell.style.marginLeft = `${((lane.lane * 100) / lane.lanes).toFixed(3)}%`;
    }
    grid.appendChild(cell);
  }

  if (hasEE) {
    const col = document.createElement('div');
    col.className = 'ee-col';
    col.style.gridColumn = String(stages.length + 1);
    col.style.gridRow = `2 / span ${rows}`;
    const entries = [
      ...strays.map((a) => ({ min: a.startMin, artist: a })),
      ...acts.map((a) => ({ min: activityMinutes((a.time || '').split(' - ')[0] || '12:00 PM'), act: a })),
    ].sort((x, y) => x.min - y.min);
    for (const e of entries) {
      if (e.artist) {
        col.appendChild(renderCard(e.artist.name, ctx, { cell: true, time: e.artist.startStr }));
      } else {
        const rowEl = document.createElement('div');
        rowEl.className = 'ee-item';
        const t = document.createElement('span');
        t.className = 'ee-time';
        t.textContent = e.act.time || '';
        const n = document.createElement('span');
        n.className = 'ee-name';
        n.textContent = e.act.name;
        const v = document.createElement('span');
        v.className = 'ee-venue';
        v.textContent = e.act.venue || '';
        rowEl.append(t, n, v);
        col.appendChild(rowEl);
      }
    }
    grid.appendChild(col);
  }
  scroll.appendChild(grid);
  wrap.append(rail, scroll);
  root.appendChild(wrap);

  if (ctx.onNotesChange) root.appendChild(notesSection('day', day, day, ctx, ctx.onNotesChange));
}

// ---- the wall ------------------------------------------------------------------
export function renderWall(root, ctx) {
  root.textContent = '';
  const fest = state.fest();
  const scheduled = fest.days && Object.keys(fest.days).length;

  if (scheduled && !ctx.query) {
    for (const day of Object.keys(fest.days)) renderScheduledDay(root, day, ctx);
    if (ctx.onNotesChange) {
      root.appendChild(dayHeader(`NOTES · ${fest.name.toUpperCase()}`, ''));
      root.appendChild(notesSection('fest', null, '', ctx, ctx.onNotesChange));
    }
    return;
  }

  // Searching a scheduled fest must still answer "where and when" (CORE-4):
  // matches render per day, chronological, each card carrying stage · time.
  if (scheduled) {
    const q = ctx.query.trim().toLowerCase();
    const scheduledNames = new Set();
    let any = false;
    for (const day of Object.keys(fest.days)) {
      const computed = state.getDayArtists(day);
      computed.forEach((a) => scheduledNames.add(a.name));
      const matches = computed.filter((a) => a.name.toLowerCase().includes(q))
        .sort((x, y) => x.startMin - y.startMin);
      if (!matches.length) continue;
      any = true;
      const meta = (fest.dayMeta || {})[day];
      root.appendChild(dayHeader(day, meta ? `${meta.wd || ''} ${meta.num || ''}`.trim() : ''));
      const grid = document.createElement('div');
      grid.className = 'wall-grid';
      for (const a of matches) grid.appendChild(renderCard(a.name, ctx, { time: `${a.stage} · ${a.startStr}` }));
      root.appendChild(grid);
    }
    // Lineup entries with no set time yet still deserve to be findable.
    const extra = applyFilter((fest.artists || []).filter((a) => !scheduledNames.has(a.name)), ctx.query);
    if (extra.length) {
      any = true;
      root.appendChild(dayHeader('EVERYTHING ELSE', 'NO SET TIME YET'));
      const grid = document.createElement('div');
      grid.className = 'wall-grid';
      for (const a of extra) grid.appendChild(renderCard(a.name, ctx));
      root.appendChild(grid);
    }
    if (!any) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 30px 0;';
      empty.textContent = 'No artists match.';
      root.appendChild(empty);
    }
    return;
  }

  const artists = applySort(applyFilter(applyWeekend(fest.artists || [], ctx.weekend), ctx.query), ctx.sort, ctx);

  if (!artists.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 30px 0;';
    empty.textContent = ctx.query ? 'No artists match.' : 'Lineup coming soon — notes work now. Leave the first one below.';
    root.appendChild(empty);
    if (ctx.query) return;
    // An empty lineup is when planning notes matter MOST (CORE-10) — the
    // festival composer stays.
    if (ctx.onNotesChange) {
      root.appendChild(dayHeader(`NOTES · ${fest.name.toUpperCase()}`, ''));
      root.appendChild(notesSection('fest', null, '', ctx, ctx.onNotesChange));
    }
    return;
  }

  const grouped = ctx.sort === 'billing' || ctx.sort === 'day'
    ? groupByDay(artists, knownDaysOf(fest))
    : new Map([['', artists]]);
  for (const [day, list] of grouped) {
    const meta = (fest.dayMeta || {})[day];
    root.appendChild(dayHeader(
      day || 'THE LINEUP',
      day ? dayRuleSub(meta) : (ctx.sort === 'billing' ? 'BILLING ORDER' : ''),
      day && ctx.onOpenDayNotes ? {
        noteCount: model.noteCount(state.crewDoc, ctx.fid, 'day', day),
        onOpenNotes: () => ctx.onOpenDayNotes(day),
      } : {},
    ));
    const grid = document.createElement('div');
    grid.className = 'wall-grid';
    const showTags = !ctx.weekend || ctx.weekend === 'all';
    for (const a of list) {
      const tag = showTags && (a.weekends === 'W1' || a.weekends === 'W2') ? a.weekends : undefined;
      grid.appendChild(renderCard(a.name, ctx, { tag }));
    }
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

let toastTimer = null;

// A toast with no action — for states the user can't undo (migration gate,
// offline explanations). Never render a button that does nothing (CORE-17).
export function showToast(container, message, ms = 4000) {
  container.textContent = '';
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);
  container.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { container.textContent = ''; }, ms);
}

// ---- undo toast (design open question 1: tap-5 clears via undo window) ---------
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

// ---- day-nav scrollspy ------------------------------------------------------------
// One observer drives every tab container (mobile dock + desktop rail): the
// active day is a single fact rendered in two places.
export function wireScrollspy(containers, wallRoot) {
  const list = Array.isArray(containers) ? containers : [containers];
  const tabs = list.flatMap((c) => [...c.querySelectorAll('.day-tab')]);
  if (!tabs.length) return () => {};
  const headers = [...wallRoot.querySelectorAll('.day-rule[data-day]')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const day = e.target.dataset.day;
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.day === day));
    }
  }, { rootMargin: '-10% 0px -80% 0px' });
  headers.forEach((h) => io.observe(h));
  return () => io.disconnect();
}
