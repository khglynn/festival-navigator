// Notes surfaces (atlas 21e/21g): artist bottom sheet, day notes with
// personal pins, fest-wide notes. Pins are device-local (fn_pins_v1), never
// synced. All doc-derived text renders via textContent (gate rule).
import * as state from '../state.js';
import * as model from './model.js';
import { hslOf, strokeOf } from './palette.js';
import { colorIndexOf } from './wall.js';

const LS_PINS = 'fn_pins_v1';

function loadPins() {
  try { return JSON.parse(localStorage.getItem(LS_PINS)) || {}; }
  catch { return {}; }
}
function savePins(pins) { localStorage.setItem(LS_PINS, JSON.stringify(pins)); }

function relTime(ts) {
  const ms = Date.now() - Date.parse(ts);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function avatarFor(name) {
  const p = state.people()[name];
  const av = document.createElement('span');
  av.className = 'avatar';
  av.style.width = '22px'; av.style.height = '22px'; av.style.fontSize = '9px';
  const ci = colorIndexOf(name, p);
  av.style.background = hslOf(ci, 0.5);
  av.style.border = '1px solid ' + strokeOf(ci, false);
  av.textContent = (name || '?').charAt(0).toUpperCase();
  return av;
}

function noteRow(note, ctx, opts = {}) {
  const row = document.createElement('div');
  row.className = 'note-row';
  row.appendChild(avatarFor(note.author));
  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (opts.pinned ? ' pinned' : '');
  bubble.textContent = note.text;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${note.author === ctx.meName ? 'you' : note.author} · ${relTime(note.ts)}`;
  bubble.appendChild(meta);
  row.appendChild(bubble);
  if (opts.onPinToggle) {
    const pin = document.createElement('button');
    pin.className = 'pin-btn' + (opts.pinned ? ' active' : '');
    pin.textContent = opts.pinned ? 'Unpin' : 'Pin';
    pin.addEventListener('click', opts.onPinToggle);
    row.appendChild(pin);
  }
  return row;
}

function composer(placeholder, onSave) {
  const wrap = document.createElement('div');
  wrap.className = 'composer';
  const input = document.createElement('input');
  input.maxLength = 500;
  input.placeholder = placeholder;
  const btn = document.createElement('button');
  btn.className = 'btn-tonal';
  btn.style.cssText = 'font-size: 12px; padding: 9px 15px; flex: none;';
  btn.textContent = 'Save';
  const save = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    onSave(text);
  };
  btn.addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  wrap.append(input, btn);
  return wrap;
}

function addNote(ctx, scope, target, text) {
  if (!ctx.meName) return;
  const ts = new Date().toISOString();
  const note = { author: ctx.meName, ts, text };
  const id = model.makeNoteId(ctx.meName, ts);
  state.recordNote(ctx.fid, scope, target, id, note);
}

// ---- artist notes bottom sheet (21g) --------------------------------------------
export function openArtistSheet(artistName, ctx, onChange) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', closeSheet);
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet';

  const grabber = document.createElement('div');
  grabber.className = 'grabber';
  const head = document.createElement('div');
  head.style.cssText = 'display: flex; align-items: baseline; gap: 9px;';
  const title = document.createElement('span');
  title.className = 'sheet-title';
  title.textContent = artistName.toUpperCase();
  head.appendChild(title);
  sheet.append(grabber, head);

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const paint = () => {
    list.textContent = '';
    for (const n of model.notesFor(state.crewDoc, ctx.fid, 'artist', artistName)) {
      list.appendChild(noteRow(n, ctx));
    }
  };
  paint();
  sheet.appendChild(list);
  sheet.appendChild(composer('Add a note…', (text) => {
    addNote(ctx, 'artist', artistName, text);
    paint();
    onChange();
  }));
  document.body.append(backdrop, sheet);
}

export function closeSheet() {
  document.getElementById('sheet-backdrop')?.remove();
  document.getElementById('artist-sheet')?.remove();
}

// ---- all-notes view (the wall's Notes chip) ----------------------------------------
export function openAllNotes(ctx) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', closeSheet);
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet';
  const grabber = document.createElement('div');
  grabber.className = 'grabber';
  const title = document.createElement('span');
  title.className = 'sheet-title';
  title.textContent = 'ALL NOTES';
  sheet.append(grabber, title);

  const notes = state.crewDoc?.festivals?.[ctx.fid]?.notes || {};
  const section = (label, scope, target) => {
    const list = model.notesFor(state.crewDoc, ctx.fid, scope, target);
    if (!list.length) return;
    const lbl = document.createElement('div');
    lbl.className = 'micro-label';
    lbl.textContent = label;
    sheet.appendChild(lbl);
    for (const n of list) sheet.appendChild(noteRow(n, ctx));
  };
  section('This festival', 'fest', null);
  for (const day of Object.keys(notes.day || {})) section(day, 'day', day);
  for (const artist of Object.keys(notes.artist || {})) section(artist, 'artist', artist);
  if (sheet.children.length === 2) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 16px 0;';
    empty.textContent = 'No notes yet — long-press an artist or write under a day.';
    sheet.appendChild(empty);
  }
  document.body.append(backdrop, sheet);
}

// ---- day + fest note sections (21e) ----------------------------------------------
// Renders under a day's cards (scope 'day') or at the wall's end (scope 'fest').
export function notesSection(scope, target, label, ctx, onChange) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin: 2px 0 6px;';
  const pins = loadPins();
  const pinnedIds = new Set(pins[ctx.fid] || []);
  const notes = model.sortWithPins(
    model.notesFor(state.crewDoc, ctx.fid, scope, target), [...pinnedIds]);
  if (!notes.length && !ctx.meName) return wrap;

  if (notes.some((n) => pinnedIds.has(n.id))) {
    const lbl = document.createElement('div');
    lbl.className = 'micro-label';
    lbl.textContent = 'Pinned by you';
    wrap.appendChild(lbl);
  }
  for (const n of notes) {
    const pinned = pinnedIds.has(n.id);
    wrap.appendChild(noteRow(n, ctx, {
      pinned,
      onPinToggle: () => {
        savePins(model.togglePin(loadPins(), ctx.fid, n.id));
        onChange();
      },
    }));
  }
  if (ctx.meName) {
    wrap.appendChild(composer(`Add a note${label ? ` for ${label}` : ''}…`, (text) => {
      addNote(ctx, scope, target, text);
      onChange();
    }));
  }
  return wrap;
}
