// Notes surfaces (atlas 21e/21g): scope sheets (artist + day), the all-notes
// HOME, and the day/fest sections with personal pins. Pins are device-local
// (fn_pins_v1), never synced. Notes are edited/deleted through the tombstone
// model — an edit overwrites the same note id (author + ts unchanged, order
// stable); a delete writes {deleted:true} — and the server's id-prefix rule
// means you can only ever touch your own (NT-3).
// All doc-derived text renders via textContent (gate rule).
import * as state from '../state.js';
import * as model from './model.js';
import { hslOf, strokeOf } from './palette.js';
import { colorIndexOf } from './wall.js';
import { router } from './router.js';

const LS_PINS = 'fn_pins_v1';

// Sheet dismissals go through history (FLOW-2) so browser back and the
// backdrop agree; the direct close stays as the desync-proof fallback.
const requestSheetClose = () => { if (!router || !router.requestClose()) closeSheet(); };

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

// ---- write helpers (the tombstone model, NT-3) --------------------------------------
function addNote(ctx, scope, target, text) {
  if (!ctx.meName) return;
  const ts = new Date().toISOString();
  const note = { author: ctx.meName, ts, text };
  const id = model.makeNoteId(ctx.meName, ts);
  state.recordNote(ctx.fid, scope, target, id, note);
}

function editNote(ctx, scope, target, note, newText) {
  // Same id, same author, same ts — order stays; only the words change.
  state.recordNote(ctx.fid, scope, target, note.id, { author: note.author, ts: note.ts, text: newText });
}

function deleteNote(ctx, scope, target, note) {
  state.recordNote(ctx.fid, scope, target, note.id, { author: note.author, ts: note.ts, text: '', deleted: true });
}

// ---- note row ------------------------------------------------------------------------
// opts: { pinned, onPinToggle, onEdit(note, text), onDelete(note) }
function noteRow(note, ctx, opts = {}) {
  const row = document.createElement('div');
  row.className = 'note-row';
  row.appendChild(avatarFor(note.author));
  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (opts.pinned ? ' pinned' : '');
  const text = document.createElement('span');
  text.textContent = note.text;
  bubble.appendChild(text);
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${note.author === ctx.meName ? 'you' : note.author} · ${relTime(note.ts)}`;
  bubble.appendChild(meta);

  // Your notes stay yours to change (NT-3) — quiet actions in the meta line.
  if (note.author === ctx.meName && (opts.onEdit || opts.onDelete)) {
    const mkAction = (label) => {
      const b = document.createElement('button');
      b.className = 'note-action';
      b.textContent = label;
      return b;
    };
    if (opts.onEdit) {
      const edit = mkAction('Edit');
      edit.addEventListener('click', () => {
        bubble.textContent = '';
        const editor = document.createElement('div');
        editor.className = 'composer';
        const input = document.createElement('input');
        input.maxLength = 500;
        input.value = note.text;
        input.setAttribute('aria-label', 'Edit your note');
        const save = document.createElement('button');
        save.className = 'btn-tonal';
        save.style.cssText = 'font-size: 11.5px; padding: 8px 13px; flex: none;';
        save.textContent = 'Save';
        const doSave = () => {
          const v = input.value.trim();
          if (!v) return;
          opts.onEdit(note, v);
        };
        save.addEventListener('click', doSave);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
        editor.append(input, save);
        bubble.appendChild(editor);
        input.focus();
      });
      meta.append(' · ', edit);
    }
    if (opts.onDelete) {
      const del = mkAction('Delete');
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          del.textContent = 'Sure?';
          setTimeout(() => { armed = false; del.textContent = 'Delete'; }, 3000);
          return;
        }
        opts.onDelete(note);
      });
      meta.append(' · ', del);
    }
  }

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
  input.setAttribute('aria-label', placeholder);
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

// ---- sheet chrome: grabber (with a real swipe), title, a real close (NT-5) ----------
function sheetChrome(sheet, titleText) {
  const grabber = document.createElement('div');
  grabber.className = 'grabber';
  // The grabber advertises a swipe — so it swipes. Drag down past 70px closes.
  let startY = null;
  grabber.addEventListener('pointerdown', (e) => { startY = e.clientY; grabber.setPointerCapture(e.pointerId); });
  grabber.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    const dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const release = (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    sheet.style.transform = '';
    if (dy > 70) requestSheetClose();
  };
  grabber.addEventListener('pointerup', release);
  grabber.addEventListener('pointercancel', () => { startY = null; sheet.style.transform = ''; });

  const head = document.createElement('div');
  head.style.cssText = 'display: flex; align-items: center; gap: 9px;';
  const title = document.createElement('span');
  title.className = 'sheet-title';
  title.style.flex = '1';
  title.textContent = titleText;
  const close = document.createElement('button');
  close.className = 'sheet-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  close.addEventListener('click', requestSheetClose);
  head.append(title, close);
  sheet.append(grabber, head);
  return head;
}

// The open sheet's repaint hook: remote syncs call refreshOpenSheet() so a
// sheet someone is reading picks up the crew's new notes live (CORE-16).
let activeSheetRepaint = null;
export function refreshOpenSheet() {
  if (activeSheetRepaint) activeSheetRepaint();
}

// Dialog semantics + focus management (AX-4): the sheet is a modal — it takes
// focus on open, Tab cycles inside it, and focus returns where it was on close.
let restoreFocusTo = null;
function dialogize(sheet, label) {
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', label);
  sheet.tabIndex = -1;
  restoreFocusTo = document.activeElement;
  requestAnimationFrame(() => sheet.focus());
  sheet.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...sheet.querySelectorAll('button, input, textarea, [tabindex="0"]')].filter((n) => !n.disabled);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

// ---- scope sheet (artist or day) — one surface, two scopes (21g / NT-2) -------------
function openScopeSheet(scope, target, titleText, ctx, onChange) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', requestSheetClose);
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet';
  sheetChrome(sheet, titleText);

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const paint = () => {
    list.textContent = '';
    const pins = loadPins();
    const pinnedIds = new Set(pins[ctx.fid] || []);
    const notes = model.sortWithPins(model.notesFor(state.crewDoc, ctx.fid, scope, target), [...pinnedIds]);
    if (!notes.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 10px 0;';
      empty.textContent = ctx.meName ? 'No notes yet — say the first thing.' : 'No notes yet.';
      list.appendChild(empty);
      return;
    }
    for (const n of notes) {
      list.appendChild(noteRow(n, ctx, {
        pinned: pinnedIds.has(n.id),
        onPinToggle: () => { savePins(model.togglePin(loadPins(), ctx.fid, n.id)); paint(); },
        onEdit: (note, text) => { editNote(ctx, scope, target, note, text); paint(); onChange(); },
        onDelete: (note) => { deleteNote(ctx, scope, target, note); paint(); onChange(); },
      }));
    }
  };
  paint();
  sheet.appendChild(list);
  if (ctx.meName) {
    sheet.appendChild(composer('Add a note…', (text) => {
      addNote(ctx, scope, target, text);
      paint();
      onChange();
    }));
  }
  document.body.append(backdrop, sheet);
  dialogize(sheet, titleText);
  activeSheetRepaint = paint;
}

export function openArtistSheet(artistName, ctx, onChange) {
  openScopeSheet('artist', artistName, artistName.toUpperCase(), ctx, onChange);
}

export function openDayNotes(day, ctx, onChange) {
  openScopeSheet('day', day, day.toUpperCase(), ctx, onChange);
}

export function closeSheet() {
  const wasOpen = document.getElementById('artist-sheet');
  document.getElementById('sheet-backdrop')?.remove();
  document.getElementById('artist-sheet')?.remove();
  activeSheetRepaint = null;
  if (wasOpen && restoreFocusTo && restoreFocusTo.isConnected) restoreFocusTo.focus();
  restoreFocusTo = null;
}

// ---- all-notes: the notes HOME (spec F8 / NT-1) --------------------------------------
// You can always ADD a festival note right here — composer first, then the
// scope sections. The empty state is an invitation, never a redirect.
export function openAllNotes(ctx) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', requestSheetClose);
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet';
  sheetChrome(sheet, 'ALL NOTES');

  const body = document.createElement('div');
  body.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
  sheet.appendChild(body);

  const paint = () => {
    body.textContent = '';
    if (ctx.meName) {
      body.appendChild(composer('Add a festival note…', (text) => {
        addNote(ctx, 'fest', null, text);
        paint();
        ctx.onNotesChange();
      }));
    }
    const pins = loadPins();
    const pinnedIds = new Set(pins[ctx.fid] || []);
    const notes = state.crewDoc?.festivals?.[ctx.fid]?.notes || {};
    let any = false;
    const section = (label, scope, target) => {
      const list = model.sortWithPins(model.notesFor(state.crewDoc, ctx.fid, scope, target), [...pinnedIds]);
      if (!list.length) return;
      any = true;
      const lbl = document.createElement('div');
      lbl.className = 'micro-label';
      lbl.textContent = label;
      body.appendChild(lbl);
      for (const n of list) {
        body.appendChild(noteRow(n, ctx, {
          pinned: pinnedIds.has(n.id),
          onPinToggle: () => { savePins(model.togglePin(loadPins(), ctx.fid, n.id)); paint(); },
          onEdit: (note, text) => { editNote(ctx, scope, target, note, text); paint(); ctx.onNotesChange(); },
          onDelete: (note) => { deleteNote(ctx, scope, target, note); paint(); ctx.onNotesChange(); },
        }));
      }
    };
    section('This festival', 'fest', null);
    for (const day of Object.keys(notes.day || {})) section(day, 'day', day);
    for (const artist of Object.keys(notes.artist || {})) section(artist, 'artist', artist);
    if (!any) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 12px 0;';
      empty.textContent = ctx.meName
        ? 'No notes yet — add the first above, or long-press any artist.'
        : 'No notes yet.';
      body.appendChild(empty);
    }
  };
  paint();
  document.body.append(backdrop, sheet);
  dialogize(sheet, 'All notes');
  activeSheetRepaint = paint;
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
      onEdit: (note, text) => { editNote(ctx, scope, target, note, text); onChange(); },
      onDelete: (note) => { deleteNote(ctx, scope, target, note); onChange(); },
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
