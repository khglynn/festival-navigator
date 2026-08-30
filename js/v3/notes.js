// Notes surfaces (reshaped 2026-08-29): scope sheets (artist + day), the
// all-notes HOME, and the day whisper on the wall. The sheet opens with the
// card (card-facts.js) and reads as a conversation — no boxes, a note is text
// on a wash of its author's hue, replies indent one gutter under their root.
// Pins are device-local (fn_pins_v1), never synced. Notes are edited/deleted
// through the tombstone model — an edit overwrites the same note id (author +
// ts unchanged, order stable); a delete writes {deleted:true} — and the
// server's id-prefix rule means you can only ever touch your own (NT-3).
// A reply is a note with one extra key: re = its root's id (threadsFor).
// All doc-derived text renders via textContent (gate rule).
import * as state from '../state.js';
import { dayLabelParts } from '../time.js';
import * as model from './model.js';
import { hslOf, strokeOf } from './palette.js';
import { colorIndexOf } from './wall.js';
import { factsFor, sheetCard } from './card-facts.js';
import { router } from './router.js';
import { loadJSON, saveLS } from '../util.js';

const LS_PINS = 'fn_pins_v1';

// Sheet dismissals go through history (FLOW-2) so browser back and the
// backdrop agree; the direct close stays as the desync-proof fallback.
const requestSheetClose = () => { if (!router || !router.requestClose()) closeSheet(); };

const loadPins = () => loadJSON(LS_PINS, {});
const savePins = (pins) => saveLS(LS_PINS, JSON.stringify(pins));

function relTime(ts) {
  const ms = Date.now() - Date.parse(ts);
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function avatarFor(name, size = 20, font = 8.5) {
  const p = state.people()[name];
  const av = document.createElement('span');
  av.className = 'avatar';
  av.style.width = `${size}px`; av.style.height = `${size}px`; av.style.fontSize = `${font}px`;
  const ci = colorIndexOf(name, p);
  av.style.background = hslOf(ci, 0.5);
  av.style.border = '1px solid ' + strokeOf(ci, false);
  av.textContent = (name || '?').charAt(0).toUpperCase();
  return av;
}

// ---- write helpers (the tombstone model, NT-3) --------------------------------------
function addNote(ctx, scope, target, text, re = null) {
  if (!ctx.meName) return;
  const ts = new Date().toISOString();
  const note = re ? { author: ctx.meName, ts, text, re } : { author: ctx.meName, ts, text };
  const id = model.makeNoteId(ctx.meName, ts);
  state.recordNote(ctx.fid, scope, target, id, note);
}

function editNote(ctx, scope, target, note, newText) {
  // Same id, same author, same ts (and same re) — order stays; only the words change.
  const next = { author: note.author, ts: note.ts, text: newText };
  if (note.re) next.re = note.re;
  state.recordNote(ctx.fid, scope, target, note.id, next);
}

function deleteNote(ctx, scope, target, note) {
  const gone = { author: note.author, ts: note.ts, text: '', deleted: true };
  if (note.re) gone.re = note.re;
  state.recordNote(ctx.fid, scope, target, note.id, gone);
}

// ---- one note, the aura way ---------------------------------------------------------
// opts: { reply, pinned, collapsedReplies, onToggleReplies, onPinToggle,
//         onReply, onEdit(note, text), onDelete(note), editing }
// `editing` is the sheet's per-open draft map (id -> {value, focus}): the
// inline editor lives INSIDE the repainted list, so a remote sync used to
// eat a half-typed edit (Codex gate, 2026-08-29). The draft persists here
// and the editor re-renders from it, caret at the end.
function noteRow(note, ctx, opts = {}) {
  const row = document.createElement('div');
  row.className = 'n-note' + (opts.reply ? ' n-reply' : '') + (opts.pinned ? ' pinned' : '');
  const ci = colorIndexOf(note.author, state.people()[note.author]);
  row.style.setProperty('--wash', hslOf(ci, opts.pinned ? 0.46 : (opts.reply ? 0.2 : 0.26)));
  row.appendChild(avatarFor(note.author, opts.reply ? 16 : 20, opts.reply ? 7.5 : 8.5));

  const body = document.createElement('div');
  body.className = 'n-body';
  const head = document.createElement('div');
  head.className = 'n-head';
  const who = document.createElement('span');
  who.className = 'n-who';
  who.textContent = note.author === ctx.meName ? 'you' : note.author;
  head.append(who, relTime(note.ts));

  const mkAction = (label, cls = '') => {
    const b = document.createElement('button');
    b.className = 'note-action' + (cls ? ` ${cls}` : '');
    b.textContent = label;
    return b;
  };
  const dot = () => head.append(' · ');

  const text = document.createElement('div');
  text.className = 'n-text';
  text.textContent = note.text;

  // Your notes stay yours to change (NT-3) — quiet actions in the head line.
  const editing = opts.editing;
  const mountEditor = () => {
    const draft = editing.get(note.id);
    const editor = document.createElement('div');
    editor.className = 'composer';
    const input = document.createElement('input');
    input.maxLength = 500;
    input.value = draft.value;
    input.setAttribute('aria-label', 'Edit your note');
    input.addEventListener('input', () => { draft.value = input.value; });
    input.addEventListener('focus', () => { draft.focus = true; });
    input.addEventListener('blur', () => { draft.focus = false; });
    const save = document.createElement('button');
    save.className = 'btn-tonal';
    save.style.cssText = 'font-size: 11.5px; padding: 8px 13px; flex: none;';
    save.textContent = 'Save';
    const doSave = () => {
      const v = input.value.trim();
      if (!v) return;
      editing.delete(note.id);
      opts.onEdit(note, v);
    };
    save.addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
    editor.append(input, save);
    text.replaceChildren(editor);
    input.dataset.editing = note.id;
    // Focus is restored by renderThreads once the row is CONNECTED — a
    // focus() on a detached node is a no-op (Codex gate, 2026-08-29).
  };
  if (note.author === ctx.meName && opts.onEdit && editing) {
    if (editing.has(note.id)) mountEditor();
    const edit = mkAction('Edit');
    edit.addEventListener('click', () => {
      editing.set(note.id, { value: note.text, focus: true });
      mountEditor();
      const input = text.querySelector('input[data-editing]');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
    dot(); head.append(edit);
  }
  if (note.author === ctx.meName && opts.onDelete) {
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
    dot(); head.append(del);
  }
  if (opts.onReply) {
    const reply = mkAction('Reply');
    reply.addEventListener('click', () => opts.onReply(note));
    dot(); head.append(reply);
  }
  if (opts.collapsedReplies) {
    const n = opts.collapsedReplies;
    const open = mkAction(`${n} repl${n === 1 ? 'y' : 'ies'}`, 'on');
    open.addEventListener('click', opts.onToggleReplies);
    dot(); head.append(open);
  }
  if (opts.onPinToggle) {
    const pin = mkAction(opts.pinned ? 'Unpin' : 'Pin', opts.pinned ? 'on' : '');
    pin.addEventListener('click', opts.onPinToggle);
    dot(); head.append(pin);
  }

  body.append(head, text);
  row.appendChild(body);
  return row;
}

// A root that is gone (tombstoned, or not yet synced) — its replies keep
// their context under this quiet stub.
function stubRow(author) {
  const row = document.createElement('div');
  row.className = 'n-note stub';
  const av = document.createElement('span');
  av.className = 'avatar stub-avatar';
  const body = document.createElement('div');
  body.className = 'n-body';
  const text = document.createElement('div');
  text.className = 'n-text';
  text.textContent = author ? `${author} removed this note` : '…';
  body.appendChild(text);
  row.append(av, body);
  return row;
}

// ---- threads, rendered --------------------------------------------------------------
// A pinned root sorts to the top and shows a reply COUNT, never its thread
// (Kevin's rule, 2026-08-28); the count expands it in place for this open.
function renderThreads(host, scope, target, ctx, { onChange, onReply, expandedPinned, editing }) {
  host.textContent = '';
  const pins = loadPins();
  const pinnedIds = new Set(pins[ctx.fid] || []);
  const threads = model.threadsFor(state.crewDoc, ctx.fid, scope, target, [...pinnedIds]);
  // A draft for a note a remote sync just tombstoned has nowhere to land.
  if (editing && editing.size) {
    const live = new Set(model.notesFor(state.crewDoc, ctx.fid, scope, target).map((n) => n.id));
    for (const id of [...editing.keys()]) if (!live.has(id)) editing.delete(id);
  }
  const restoreEditFocus = () => {
    if (!editing) return;
    for (const input of host.querySelectorAll('input[data-editing]')) {
      const draft = editing.get(input.dataset.editing);
      if (draft && draft.focus) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
    }
  };
  if (!threads.length) {
    const empty = document.createElement('div');
    empty.className = 'n-empty';
    empty.textContent = ctx.meName ? 'No notes yet — say the first thing.' : 'No notes yet.';
    host.appendChild(empty);
    return;
  }
  for (const t of threads) {
    const block = document.createElement('div');
    block.className = 'n-thread';
    if (t.root) {
      const pinned = pinnedIds.has(t.root.id);
      const collapsed = pinned && t.replies.length && !expandedPinned.has(t.root.id);
      block.appendChild(noteRow(t.root, ctx, {
        pinned,
        editing,
        collapsedReplies: collapsed ? t.replies.length : 0,
        onToggleReplies: () => { expandedPinned.add(t.root.id); onChange({ localOnly: true }); },
        onPinToggle: () => { savePins(model.togglePin(loadPins(), ctx.fid, t.root.id)); onChange({ localOnly: true }); },
        onReply: onReply ? () => onReply(t.root) : null,
        onEdit: (note, text) => { editNote(ctx, scope, target, note, text); onChange(); },
        onDelete: (note) => { deleteNote(ctx, scope, target, note); onChange(); },
      }));
      if (collapsed) { host.appendChild(block); continue; }
    } else {
      block.appendChild(stubRow(t.stubAuthor));
    }
    if (t.replies.length) {
      const replies = document.createElement('div');
      replies.className = 'n-replies';
      for (const n of t.replies) {
        replies.appendChild(noteRow(n, ctx, {
          reply: true,
          editing,
          onEdit: (note, text) => { editNote(ctx, scope, target, note, text); onChange(); },
          onDelete: (note) => { deleteNote(ctx, scope, target, note); onChange(); },
        }));
      }
      block.appendChild(replies);
    }
    host.appendChild(block);
  }
  restoreEditFocus();
}

// The composer, with a reply state: replying keeps whatever was typed and
// only changes where it will land; ✕ returns to a plain note.
function composer(placeholder, onSave, draftKey) {
  const wrap = document.createElement('div');
  wrap.className = 'composer-wrap';
  const replyLabel = document.createElement('div');
  replyLabel.className = 'reply-to';
  replyLabel.hidden = true;
  const row = document.createElement('div');
  row.className = 'composer';
  const input = document.createElement('input');
  input.maxLength = 500;
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);
  // Keyed composers survive the wall repaint: renderWall harvests drafts by
  // this key before teardown and restores value/focus/caret after (audit 1.2).
  if (draftKey) input.dataset.draftKey = draftKey;
  let replyTo = null;
  const cancel = document.createElement('button');
  cancel.className = 'cancel';
  cancel.textContent = '✕';
  cancel.setAttribute('aria-label', 'Cancel reply');
  cancel.hidden = true;
  const setReply = (note) => {
    replyTo = note;
    replyLabel.hidden = !note;
    cancel.hidden = !note;
    input.placeholder = note ? 'Reply…' : placeholder;
    input.setAttribute('aria-label', note ? `Reply to ${note.author === undefined ? '' : note.author}` : placeholder);
    if (note) {
      replyLabel.textContent = `Replying to ${note.author}`;
      input.focus();
    }
  };
  cancel.addEventListener('click', () => setReply(null));
  const btn = document.createElement('button');
  btn.className = 'btn-tonal';
  btn.style.cssText = 'font-size: 12px; padding: 9px 15px; flex: none;';
  btn.textContent = 'Save';
  const save = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const to = replyTo;
    setReply(null);
    onSave(text, to);
  };
  btn.addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  row.append(input, cancel, btn);
  wrap.append(replyLabel, row);
  wrap.setReply = setReply;
  return wrap;
}

export function sheetChrome(sheet, titleText) {
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

// A bare grabber for sheets whose header is the card itself (the ✕ lives in
// the card's corner there — Kevin's alignment note, 2026-08-29).
function grabberOnly(sheet) {
  const probe = document.createElement('div');
  sheetChrome(probe, '');
  const grabber = probe.querySelector('.grabber');
  sheet.appendChild(grabber);
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

// Whoever opened the sheet — captured ONCE, and deliberately not re-captured.
//
// Adding or deleting a note tears the sheet down and rebuilds it. The rebuild
// used to re-capture document.activeElement, which at that moment is the Delete
// button inside the sheet that is about to be destroyed — so on close, focus had
// nowhere to go and fell through to <body>. A keyboard user had to tab from the
// top of the page to find their place again, but only after they had actually
// USED the sheet (finish pass, 2026-07-12).
export function rememberOpener() {
  if (!document.getElementById('sheet-backdrop')) restoreFocusTo = document.activeElement;
}

// Remove the sheet WITHOUT touching focus — this is the re-render path.
// closeSheet() is the "we are really done here" path, and it restores.
function teardownSheet() {
  document.getElementById('sheet-backdrop')?.remove();
  document.getElementById('artist-sheet')?.remove();
  activeSheetRepaint = null;
}

export function dialogize(sheet, label) {
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', label);
  sheet.tabIndex = -1;
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
function openScopeSheet(scope, target, ctx, onChange, occ = null) {
  rememberOpener();  // no-op on a re-render — the original opener is kept
  teardownSheet();   // NOT closeSheet(): a re-render must not restore focus
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', requestSheetClose);
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet';

  // Per-open UI state that must survive live repaints (never synced).
  const expandedPinned = new Set();
  const editing = new Map(); // note id -> { value, focus } — inline edit drafts

  let paintHeader = () => {};
  if (scope === 'artist') {
    // The header IS the card, grown once more; the ✕ lives in its corner.
    grabberOnly(sheet);
    const headerHost = document.createElement('div');
    sheet.appendChild(headerHost);
    paintHeader = () => {
      headerHost.replaceChildren(sheetCard(factsFor(target, ctx, occ), { onClose: requestSheetClose }));
    };
    paintHeader();
  } else {
    // A day key can be verbose; the sheet shows its weekday and moves the
    // aside to the sub line, like the wall's day rule (time.js dayLabelParts).
    const parts = scope === 'day' ? dayLabelParts(target) : null;
    const head = sheetChrome(sheet, scope === 'fest' ? state.fest().name.toUpperCase() : (parts ? parts.head : target).toUpperCase());
    const meta = (state.fest().dayMeta || {})[target];
    if (scope === 'day' && (meta || parts.aside)) {
      const sub = document.createElement('div');
      sub.className = 'f-sub day-sub';
      sub.textContent = [meta && meta.wd, meta && meta.date, parts.aside].filter(Boolean).join(' · ');
      head.insertAdjacentElement('afterend', sub);
    }
  }

  const list = document.createElement('div');
  list.className = 'n-list';
  sheet.appendChild(list);

  // The composer lives OUTSIDE paint() — a remote sync repainting the list
  // must never eat a half-typed note (audit 1.2). localOnly changes (a pin,
  // expanding a pinned thread) repaint without pushing anything.
  const box = ctx.meName ? composer('Add a note…', (text, replyTo) => {
    addNote(ctx, scope, target, text, replyTo ? (replyTo.re || replyTo.id) : null);
    paint();
    onChange();
  }) : null;

  const paint = () => {
    paintHeader();
    renderThreads(list, scope, target, ctx, {
      onChange: (o = {}) => { paint(); if (!o.localOnly) onChange(); },
      onReply: box ? (root) => box.setReply(root) : null,
      expandedPinned,
      editing,
    });
  };
  paint();
  if (box) sheet.appendChild(box);
  document.body.append(backdrop, sheet);
  dialogize(sheet, scope === 'artist' ? target : `${target || state.fest().name} notes`);
  activeSheetRepaint = paint;
}

export function openArtistSheet(artistName, ctx, onChange, occ = null) {
  openScopeSheet('artist', artistName, ctx, onChange, occ);
}

export function openDayNotes(day, ctx, onChange) {
  openScopeSheet('day', day, ctx, onChange);
}

export function openFestNotes(ctx, onChange) {
  openScopeSheet('fest', null, ctx, onChange);
}

export function closeSheet() {
  const wasOpen = document.getElementById('artist-sheet');
  teardownSheet();
  // Nothing was open, so there is nothing to restore — and crucially, nothing to
  // FORGET either. Callers open a sheet with `rememberOpener(); closeSheet();`
  // (belt-and-braces against a sheet already being up), and an unconditional
  // `restoreFocusTo = null` here threw the opener away a moment after it was
  // captured. Caught on staging: the ✕ closed the sheet and focus fell to <body>
  // even though every piece of the fix was in place (finish pass, 2026-07-12).
  if (!wasOpen) return;
  if (restoreFocusTo && restoreFocusTo.isConnected) restoreFocusTo.focus();
  restoreFocusTo = null;
}

// ---- all-notes: the notes HOME (spec F8 / NT-1) --------------------------------------
// You can always ADD a festival note right here — composer first, then the
// scope sections. The empty state is an invitation, never a redirect.
export function openAllNotes(ctx) {
  rememberOpener();
  teardownSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', requestSheetClose);
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet';
  sheetChrome(sheet, 'ALL NOTES');

  const expandedPinned = new Set();
  const editing = new Map(); // note id -> { value, focus } — inline edit drafts

  // The composer lives OUTSIDE paint() — a remote sync repainting the list
  // must never eat a half-typed festival note (audit 1.2, same discipline as
  // the scope sheet).
  const box = ctx.meName ? composer('Add a festival note…', (text, replyTo) => {
    addNote(ctx, 'fest', null, text, replyTo ? (replyTo.re || replyTo.id) : null);
    paint();
    ctx.onNotesChange();
  }) : null;
  if (box) sheet.appendChild(box);
  const body = document.createElement('div');
  body.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
  sheet.appendChild(body);

  const paint = () => {
    body.textContent = '';
    const notes = state.crewDoc?.festivals?.[ctx.fid]?.notes || {};
    let any = false;
    const section = (label, scope, target) => {
      if (!model.noteCount(state.crewDoc, ctx.fid, scope, target)) return;
      any = true;
      const lbl = document.createElement('div');
      lbl.className = 'micro-label';
      lbl.textContent = label;
      body.appendChild(lbl);
      const host = document.createElement('div');
      host.className = 'n-list grouped';
      renderThreads(host, scope, target, ctx, {
        onChange: (o = {}) => { paint(); if (!o.localOnly) ctx.onNotesChange(); },
        onReply: box && scope === 'fest' ? (root) => box.setReply(root) : null,
        expandedPinned,
        editing,
      });
      body.appendChild(host);
    };
    section('This festival', 'fest', null);
    for (const day of Object.keys(notes.day || {})) section(day, 'day', day);
    for (const artist of Object.keys(notes.artist || {})) section(artist, 'artist', artist);
    if (!any) {
      const empty = document.createElement('div');
      empty.className = 'n-empty';
      // The gesture hint matches the device (audit 11.2): hold is the touch
      // idiom; pointer-fine users get the hover zoom's note chip.
      const fine = typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      empty.textContent = ctx.meName
        ? `No notes yet — add the first above, or ${fine ? 'hover any artist and tap its note chip' : 'hold any artist'}.`
        : 'No notes yet.';
      body.appendChild(empty);
    }
  };
  paint();
  document.body.append(backdrop, sheet);
  dialogize(sheet, 'All notes');
  activeSheetRepaint = paint;
}

// ---- the day whisper (2026-08-29, replaces the inline bars) --------------------------
// Nothing until someone writes; then the NEWEST note (root or reply) as one
// soft wash under the day's rule — Kevin's call, 2026-08-29. Tapping it opens
// the day's notes; the ✎ chip on the rule stays the add door and the count.
export function dayWhisper(scope, target, ctx, onOpen) {
  const list = model.notesFor(state.crewDoc, ctx.fid, scope, target);
  if (!list.length) return null;
  const newest = list[list.length - 1];
  const btn = document.createElement('button');
  btn.className = 'day-whisper';
  const ci = colorIndexOf(newest.author, state.people()[newest.author]);
  btn.style.setProperty('--wash', hslOf(ci, 0.26));
  btn.setAttribute('aria-label',
    `Notes${target ? ` for ${target}` : ''}: ${list.length} note${list.length === 1 ? '' : 's'}. Newest — ${newest.author}: ${newest.text.slice(0, 80)}`);
  btn.appendChild(avatarFor(newest.author, 18, 8));
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = newest.author === ctx.meName ? 'you' : newest.author;
  const text = document.createElement('span');
  text.className = 'text';
  text.textContent = newest.text;
  const more = document.createElement('span');
  more.className = 'more';
  more.textContent = `${list.length} note${list.length === 1 ? '' : 's'} ›`;
  btn.append(who, text, more);
  btn.addEventListener('click', onOpen);
  return btn;
}
