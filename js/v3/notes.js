// Notes surfaces (reshaped 2026-08-29): scope sheets (artist + day), the
// all-notes HOME, and the newest-note whisper on the wall (used for a day rule
// AND for the festival — scope-neutral despite the name; wall.js imports it).
// The sheet opens with the card (card-facts.js) and reads as a conversation —
// no boxes, a note is text on a wash of its author's hue, replies indent one
// gutter under their root.
// Pins are device-local (fn_pins_v1), never synced. Notes are edited/deleted
// through the tombstone model — an edit overwrites the same note id (author +
// ts unchanged, order stable); a delete writes {deleted:true} — and the
// server's id-prefix rule means you can only ever touch your own (NT-3).
// A reply is a note with one extra key: re = its root's id (threadsFor).
// All doc-derived text renders via textContent (gate rule).
//
// Direction A (2026-08-30, comment-thread redesign). At rest a note is a name,
// a time and words — nothing else. Hover (mouse), press-and-hold (touch) or
// keyboard focus fades in ONE line of plain words under the words:
// `Reply · Pin`, or `Edit · Reply · Pin` on your own. Reply opens a composer
// INLINE at the foot of that thread; replying to a reply pre-fills `@Name` and
// still posts flat (one level, `re = replyTo.re || replyTo.id`). Edit turns the
// words editable in place and the same line becomes `Save · Cancel · Delete` —
// delete has no other door. The sheet's bottom composer is for NEW roots only.
//
// The cue line RESERVES its height and only its contents fade. A line that
// appeared would push every note below it down each time the cursor crossed a
// note — the list would shove itself under your mouse. The row earns its keep
// on threaded roots, where the reply count (information, not an action) lives
// in it at rest.
import * as state from '../state.js';
import { dayLabelParts } from '../time.js';
import * as model from './model.js';
import { hslOf, strokeOf } from './palette.js';
import { colorIndexOf } from './wall.js';
import { factsFor, sheetCard } from './card-facts.js';
import { router } from './router.js';
import { loadJSON, saveLS } from '../util.js';

const LS_PINS = 'fn_pins_v1';
const NOTE_MAX = 500;
const COUNTER_FROM = 60;   // the counter stays out of the way until the cap is near
const HOLD_MS = 350;       // press-and-hold to reveal, on touch
const HOLD_SLOP = 8;       // px of travel that still counts as a press, not a scroll
const ARM_MS = 3000;       // "Sure?" stays armed this long
const DOOR_H = 44;         // the open door's height — also the touch floor

// Motion, the way the rest of the app moves: transforms and opacity, a beat of
// overshoot on the way in, quick and plain on the way out. Low Power and
// reduced-motion make every one of these instant, never broken.
const ARRIVE_MS = 260, UNFOLD_MS = 220, LEAVE_MS = 180;
const EASE_ARRIVE = 'cubic-bezier(.2, 1.15, .35, 1)';
const EASE_LEAVE = 'cubic-bezier(.4, 0, 1, 1)';
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// A deliberate twin of card-facts.js's gate — that module does not export it,
// and it is not this round's file to change. If a third copy is ever wanted,
// that is the moment to lift both into a shared motion module instead.
const canAnimate = (node, ctx) => typeof node.animate === 'function' && !reduced() && !(ctx && ctx.lowPower);

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
// Returns the new note's id so the caller can let it arrive (grow in) rather
// than simply be there on the next repaint.
function addNote(ctx, scope, target, text, re = null) {
  if (!ctx.meName) return null;
  const ts = new Date().toISOString();
  const note = re ? { author: ctx.meName, ts, text, re } : { author: ctx.meName, ts, text };
  const id = model.makeNoteId(ctx.meName, ts);
  state.recordNote(ctx.fid, scope, target, id, note);
  return id;
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

// ---- the small motion vocabulary ----------------------------------------------------
// Things grow from where they are and travel to where they are going.
function arriveIn(el, ctx) {
  if (!canAnimate(el, ctx)) return;
  el.animate(
    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
    { duration: ARRIVE_MS, easing: EASE_ARRIVE },
  );
}

// The way out is quick and plain: the row thins, then the write lands.
function thinOut(el, ctx, done) {
  if (!el || !el.isConnected || !canAnimate(el, ctx)) { done(); return; }
  const h = el.getBoundingClientRect().height;
  const a = el.animate(
    [{ opacity: 1, maxHeight: `${h}px` }, { opacity: 0, maxHeight: '0px' }],
    { duration: LEAVE_MS, easing: EASE_LEAVE, fill: 'forwards' },
  );
  let fired = false;
  const go = () => { if (!fired) { fired = true; done(); } };
  a.addEventListener('finish', go);
  setTimeout(go, LEAVE_MS + 60);  // a cancelled animation must never strand the write
}

// The door unfolds INTO the composer: it grows from exactly the height the door
// was standing at, so the composer arrives from where the door already was
// rather than appearing over it.
function unfold(el, ctx, from = DOOR_H) {
  if (!canAnimate(el, ctx)) return;
  const h = el.getBoundingClientRect().height;
  if (!h || h <= from) return;
  el.animate(
    [{ height: `${from}px`, opacity: .6 }, { height: `${h}px`, opacity: 1 }],
    { duration: UNFOLD_MS, easing: EASE_ARRIVE },
  );
}

// ---- shared text field: one auto-growing textarea, one quiet counter -----------------
// 500 characters used to go into a single-line <input> with no wrap, no counter
// and no cue when the browser stopped accepting them (survey, 2026-08-30).
function growingField(value, label, { onInput, onEnter }) {
  const ta = document.createElement('textarea');
  ta.className = 'n-field';
  ta.rows = 1;
  ta.maxLength = NOTE_MAX;
  ta.value = value;
  ta.setAttribute('aria-label', label);
  const counter = document.createElement('span');
  counter.className = 'n-left';
  const grow = () => {
    // jsdom has no layout: scrollHeight is 0 there, and writing that back would
    // collapse the field. Only ever grow from a real measurement.
    ta.style.height = 'auto';
    const h = ta.scrollHeight;
    if (h) ta.style.height = `${Math.min(h, 132)}px`;
    const left = NOTE_MAX - ta.value.length;
    counter.textContent = left <= COUNTER_FROM ? `${left} left` : '';
    counter.classList.toggle('at-cap', left <= 0);
  };
  ta.addEventListener('input', () => { grow(); if (onInput) onInput(ta.value); });
  ta.addEventListener('keydown', (e) => {
    // Enter sends, Shift+Enter is a new line — the grammar every chat field has.
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (onEnter) onEnter(); }
  });
  grow();
  return { ta, counter, grow };
}

const caretToEnd = (el) => {
  el.focus();
  try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* type quirks */ }
};

// ---- one note, the aura way ---------------------------------------------------------
// opts: { reply, pinned, collapsedReplies, onToggleReplies, onPinToggle,
//         onEdit(note, text), onDelete(note, row), onBeginEdit, onCancelEdit,
//         editing, ui }
// `editing` is the sheet's per-open draft map (id -> {value, focus, armed}):
// the inline editor lives INSIDE the repainted list, so a remote sync used to
// eat a half-typed edit (Codex gate, 2026-08-29). The draft persists here and
// the editor re-renders from it, caret at the end — and since 2026-08-30 the
// Delete arm ("Sure?") rides in the same map, so a repaint landing inside its
// three seconds no longer silently disarms it.
//
// There is no Reply here, on purpose (Kevin, 2026-08-30). Replying happens at
// the thread's open door — see doorRow.
function noteRow(note, ctx, opts = {}) {
  const ui = opts.ui;
  const row = document.createElement('div');
  row.className = 'n-note' + (opts.reply ? ' n-reply' : '');
  row.dataset.note = note.id;
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

  const text = document.createElement('div');
  text.className = 'n-text';
  text.textContent = note.text;

  const mkAction = (label, cls = '') => {
    const b = document.createElement('button');
    b.className = 'note-action' + (cls ? ` ${cls}` : '');
    b.textContent = label;
    return b;
  };

  // The reply count is a FACT about the note, not an action — it sits with the
  // name and the time and never hides. It is also the door to the fold.
  if (opts.collapsedReplies) {
    const n = opts.collapsedReplies;
    const open = mkAction(`${n} repl${n === 1 ? 'y' : 'ies'}`, 'n-count');
    open.addEventListener('click', opts.onToggleReplies);
    head.append(' · ', open);
  }

  // Actions live at the head line's trailing edge and are revealed by hover, a
  // press-and-hold, or keyboard focus — two quiet words at most (Kevin,
  // 2026-08-30). The head row already spans the note, so nothing has to be
  // reserved and nothing below ever moves.
  const acts = document.createElement('span');
  acts.className = 'n-acts';
  const addAct = (btn) => { if (acts.childNodes.length) acts.append(' · '); acts.append(btn); };

  const editing = opts.editing;
  const isEditing = !!(editing && editing.has(note.id));

  if (isEditing) {
    // Editing is a MODE: the words become a field in place, the head line holds
    // the two safe actions, and Delete waits in the opposite corner below —
    // never a neighbour of Save.
    const draft = editing.get(note.id);
    const doSave = () => {
      const v = field.ta.value.trim();
      if (!v) return;
      editing.delete(note.id);
      opts.onEdit(note, v);
    };
    const field = growingField(draft.value, 'Edit your note', {
      onInput: (v) => { draft.value = v; },
      onEnter: doSave,
    });
    const { ta, counter } = field;
    ta.dataset.editing = note.id;
    ta.addEventListener('focus', () => { draft.focus = true; if (ui) ui.focusOwner = `edit:${note.id}`; });
    ta.addEventListener('blur', () => { draft.focus = false; });
    text.replaceChildren(ta);
    // Focus is restored by renderThreads once the row is CONNECTED — a
    // focus() on a detached node is a no-op (Codex gate, 2026-08-29).

    const save = mkAction('Save', 'on');
    save.addEventListener('click', doSave);
    addAct(save);
    const cancel = mkAction('Cancel');
    cancel.addEventListener('click', () => { editing.delete(note.id); opts.onCancelEdit(); });
    addAct(cancel);
    acts.classList.add('open');   // a mode is not a hover state
    head.append(acts);

    const bar = document.createElement('div');
    bar.className = 'n-fieldbar';
    if (opts.onDelete) {
      const del = mkAction(draft.armed ? 'Sure?' : 'Delete', 'n-del');
      // The label changes meaning under a screen-reader user's focus, so say so.
      del.setAttribute('aria-live', 'polite');
      del.addEventListener('click', () => {
        if (!draft.armed) {
          draft.armed = true;
          del.textContent = 'Sure?';
          setTimeout(() => {
            if (!editing.has(note.id)) return;
            draft.armed = false;
            if (del.isConnected) del.textContent = 'Delete';
          }, ARM_MS);
          return;
        }
        editing.delete(note.id);
        opts.onDelete(note, row);
      });
      bar.append(del);
    }
    bar.append(counter);
    body.append(head, text, bar);
    row.appendChild(body);
    return row;
  }

  if (note.author === ctx.meName && opts.onEdit && editing) {
    const edit = mkAction('Edit');
    edit.addEventListener('click', () => {
      editing.set(note.id, { value: note.text, focus: true, armed: false });
      if (ui) ui.focusOwner = `edit:${note.id}`;
      opts.onBeginEdit();
    });
    addAct(edit);
  }
  if (opts.onPinToggle) {
    const pin = mkAction(opts.pinned ? 'Unpin' : 'Pin', opts.pinned ? 'on' : '');
    pin.addEventListener('click', opts.onPinToggle);
    addAct(pin);
  }
  if (acts.childNodes.length) {
    head.append(acts);
    wireReveal(row, note.id, ui);
  }

  body.append(head, text);
  row.appendChild(body);
  return row;
}

// ---- the open door (Kevin's pick, 2026-08-30) ----------------------------------------
// Every thread ends with this: a quiet, ALWAYS-VISIBLE full-width row in the
// current viewer's own colour at a whisper, with their avatar and the word
// "Reply…". It is the whole reply affordance — there is no Reply on any note.
//
// That is what makes "reply to a reply" a non-question. The old design put a
// Reply on every row and then had to explain, with an @mention, that your words
// would land somewhere other than where you pressed. One door per thread, at the
// place the note will actually appear, says the same thing structurally and says
// it before you type instead of after. One level deep stays law, and now the UI
// cannot even ask for anything else.
function doorRow(ctx, onOpen) {
  const b = document.createElement('button');
  b.className = 'n-door';
  const ci = colorIndexOf(ctx.meName, state.people()[ctx.meName]);
  b.style.setProperty('--wash', hslOf(ci, 0.08));
  b.appendChild(avatarFor(ctx.meName, 16, 7.5));
  const label = document.createElement('span');
  label.className = 'n-door-label';
  label.textContent = 'Reply…';
  b.append(label);
  b.setAttribute('aria-label', 'Reply to this thread');
  b.addEventListener('click', onOpen);
  return b;
}

// Hover is the mouse's trigger and lives in CSS; focus-within is the keyboard's
// and lives in CSS too. Touch has neither, so a press-and-hold marks ONE note
// revealed at a time (kept in per-open UI state so a repaint does not lose it).
// The hold is timing-only — it never calls preventDefault, so the browser's own
// press-to-select-text gesture still works; at worst both happen, which is
// harmless. Verified with real pointer input before promoting.
function wireReveal(row, noteId, ui) {
  if (!ui) return;
  if (ui.revealed === noteId) row.classList.add('revealed');
  let timer = null, from = null;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } from = null; };
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;   // the mouse has hover
    from = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = null;
      // A repaint can tear this row out mid-press. A detached row's closest()
      // finds no sheet, and clearing `.revealed` from the LIVE list to mark a
      // row nobody can see would take the reveal off the note under the finger.
      if (!row.isConnected) return;
      ui.revealed = noteId;
      // One note revealed at a time — the sheet is never noisy.
      const scope = row.closest('.sheet') || row.ownerDocument;
      for (const other of scope.querySelectorAll('.n-note.revealed')) other.classList.remove('revealed');
      row.classList.add('revealed');
    }, HOLD_MS);
  });
  row.addEventListener('pointermove', (e) => {
    if (!from) return;
    if (Math.abs(e.clientX - from.x) > HOLD_SLOP || Math.abs(e.clientY - from.y) > HOLD_SLOP) clear();
  });
  row.addEventListener('pointerup', clear);
  row.addEventListener('pointercancel', clear);
}

// A root that is gone (tombstoned, or not yet synced) — its replies keep their
// context under this quiet stub. It carries no control of its own: the thread's
// open door sits below the replies and answers it like any other thread, so a
// conversation does not end because someone removed the first thing said in it.
function stubRow(author, ctx) {
  const row = document.createElement('div');
  row.className = 'n-note stub';
  const av = document.createElement('span');
  av.className = 'avatar stub-avatar';
  const body = document.createElement('div');
  body.className = 'n-body';
  const text = document.createElement('div');
  text.className = 'n-text';
  const who = author === ctx.meName ? 'you' : author;
  text.textContent = who ? `${who} removed this note` : '…';
  body.appendChild(text);
  row.append(av, body);
  return row;
}

// ---- threads, rendered --------------------------------------------------------------
// A pinned root sorts to the top and shows a reply COUNT, never its thread
// (Kevin's rule, 2026-08-28); the count expands it in place for this open.
// `ui` is the sheet's per-open, never-synced state — see openScopeSheet.
// The inline composer for a thread renders at that thread's FOOT, which is
// where the note will actually land: a note always appends at the end of its
// thread, so a field opened above three existing replies would promise a place
// it cannot keep. For a root with no replies the foot IS directly under the
// note you pressed, which is the common case.
function renderThreads(host, scope, target, ctx, { onChange, expandedPinned, editing, ui }) {
  host.textContent = '';
  const pins = loadPins();
  const pinnedIds = new Set(pins[ctx.fid] || []);
  const threads = model.threadsFor(state.crewDoc, ctx.fid, scope, target, [...pinnedIds]);
  // A draft for a note a remote sync just tombstoned has nowhere to land.
  if (editing && editing.size) {
    const live = new Set(model.notesFor(state.crewDoc, ctx.fid, scope, target).map((n) => n.id));
    for (const id of [...editing.keys()]) if (!live.has(id)) editing.delete(id);
  }
  // Exactly ONE field may claim the caret after a repaint. You can be editing
  // note A while a reply composer is open on thread B, and a restore that
  // simply focused the first live draft would yank the caret out of whichever
  // one you were actually typing in. `ui.focusOwner` records the last field
  // you touched; its own focus flag records whether you are still in it.
  const restoreFocus = () => {
    if (ui.focusOwner === 'reply') {
      const ta = ui.replyFocused && host.querySelector('.n-inline textarea');
      if (ta) { caretToEnd(ta); return; }
    }
    if (!editing) return;
    for (const field of host.querySelectorAll('textarea[data-editing]')) {
      const draft = editing.get(field.dataset.editing);
      if (draft && draft.focus) { caretToEnd(field); return; }
    }
  };
  if (!threads.length) {
    const empty = document.createElement('div');
    empty.className = 'n-empty';
    empty.textContent = ctx.meName ? 'No notes yet — say the first thing.' : 'No notes yet.';
    host.appendChild(empty);
    return;
  }

  const sameScope = (r) => r && r.scope === scope && r.target === target;
  const canWrite = !!ctx.meName;
  const noteOps = {
    onEdit: (note, text) => { editNote(ctx, scope, target, note, text); onChange(); },
    onDelete: (note, row) => {
      thinOut(row, ctx, () => { deleteNote(ctx, scope, target, note); onChange(); });
    },
    onBeginEdit: () => onChange({ localOnly: true }),
    onCancelEdit: () => onChange({ localOnly: true }),
  };
  // Opening a door: the row you tapped becomes the composer, in place. No
  // @Name to pre-fill — the door already sits under the thread it answers.
  const openDoor = (threadKey) => {
    ui.reply = { scope, target, threadKey, draft: '' };
    ui.focusOwner = 'reply';
    ui.replyFocused = true;
    ui.unfold = true;
    onChange({ localOnly: true });
  };

  for (const t of threads) {
    const threadKey = t.root ? t.root.id : (t.replies[0] && t.replies[0].re);
    const block = document.createElement('div');
    block.className = 'n-thread';
    const replying = canWrite && sameScope(ui.reply) && ui.reply.threadKey === threadKey;
    if (t.root) {
      const pinned = pinnedIds.has(t.root.id);
      const collapsed = pinned && t.replies.length && !expandedPinned.has(t.root.id);
      block.appendChild(noteRow(t.root, ctx, {
        ...noteOps,
        ui,
        pinned,
        editing,
        collapsedReplies: collapsed ? t.replies.length : 0,
        onToggleReplies: () => { expandedPinned.add(t.root.id); onChange({ localOnly: true }); },
        onPinToggle: () => { savePins(model.togglePin(loadPins(), ctx.fid, t.root.id)); onChange({ localOnly: true }); },
      }));
      // A folded pinned root shows its count and nothing else — no door until
      // the fold is open, so the count stays the one way in.
      if (collapsed) { host.appendChild(block); continue; }
    } else {
      block.appendChild(stubRow(t.stubAuthor, ctx));
    }
    if (t.replies.length || canWrite) {
      const replies = document.createElement('div');
      replies.className = 'n-replies';
      for (const n of t.replies) {
        replies.appendChild(noteRow(n, ctx, { ...noteOps, ui, reply: true, editing }));
      }
      // The door, or the composer it became.
      if (replying) replies.appendChild(inlineComposer(scope, target, threadKey, ctx, ui, onChange));
      else if (canWrite) replies.appendChild(doorRow(ctx, () => openDoor(threadKey)));
      block.appendChild(replies);
    }
    host.appendChild(block);
  }
  restoreFocus();
  if (ui.justAdded) {
    // Not a selector: a note id may hold `.` and `|`, and CSS.escape is not
    // everywhere jsdom goes.
    const fresh = [...host.querySelectorAll('.n-note')].find((n) => n.dataset.note === ui.justAdded);
    if (fresh) { arriveIn(fresh, ctx); ui.justAdded = null; }
  }
  if (ui.unfold && ui.reply && sameScope(ui.reply)) {
    const box = host.querySelector('.n-inline');
    if (box) { unfold(box, ctx); ui.unfold = false; }
  }
}

// The composer that opens where you pressed. Its draft lives in `ui`, not in
// the DOM, so a remote repaint mid-sentence cannot eat it (audit 1.2).
function inlineComposer(scope, target, threadKey, ctx, ui, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'n-inline';
  // Your avatar stays exactly where the door's was, and the field opens where
  // the word "Reply…" stood: the door BECOMES the composer rather than being
  // replaced by one.
  wrap.appendChild(avatarFor(ctx.meName, 16, 7.5));
  const inner = document.createElement('div');
  inner.className = 'n-inline-body';
  const send = () => {
    const text = field.ta.value.trim();
    if (!text) return;
    const id = addNote(ctx, scope, target, text, threadKey);
    ui.reply = null;
    ui.justAdded = id;
    onChange();
  };
  const field = growingField(ui.reply.draft, 'Write a reply', {
    onInput: (v) => { if (ui.reply) ui.reply.draft = v; },
    onEnter: send,
  });
  field.ta.placeholder = 'Reply…';
  field.ta.addEventListener('focus', () => { ui.focusOwner = 'reply'; ui.replyFocused = true; });
  field.ta.addEventListener('blur', () => { ui.replyFocused = false; });
  const bar = document.createElement('div');
  bar.className = 'n-fieldbar';
  const post = document.createElement('button');
  post.className = 'note-action on';
  post.textContent = 'Save';
  post.addEventListener('click', send);
  const cancel = document.createElement('button');
  cancel.className = 'note-action';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => { ui.reply = null; onChange({ localOnly: true }); });
  bar.append(post, ' · ', cancel, field.counter);
  inner.append(field.ta, bar);
  wrap.appendChild(inner);
  return wrap;
}

// The sheet's bottom composer writes NEW ROOT notes, and only those. Its reply
// state retired 2026-08-30 — replying now happens inline, at the thread you
// pressed, so this box can no longer silently re-aim an already-typed draft at
// a root you have scrolled away from.
function composer(placeholder, onSave) {
  const wrap = document.createElement('div');
  wrap.className = 'composer-wrap';
  const row = document.createElement('div');
  row.className = 'composer';
  const save = () => {
    const text = field.ta.value.trim();
    if (!text) return;
    field.ta.value = '';
    field.grow();
    onSave(text);
  };
  const field = growingField('', placeholder, { onEnter: save });
  field.ta.placeholder = placeholder;
  const btn = document.createElement('button');
  btn.className = 'btn-tonal';
  btn.style.cssText = 'font-size: 12px; padding: 9px 15px; flex: none;';
  btn.textContent = 'Save';
  btn.addEventListener('click', save);
  row.append(field.ta, btn);
  wrap.append(row, field.counter);
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
  const editing = new Map(); // note id -> { value, focus, armed } — inline edit drafts
  // revealed: the held note's id (touch only — hover and focus live in CSS).
  // reply:    where the inline composer sits, and its draft, kept OUT of the DOM.
  const ui = { revealed: null, reply: null, justAdded: null, unfold: false, focusOwner: null, replyFocused: false };

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
  const box = ctx.meName ? composer('Add a note…', (text) => {
    ui.justAdded = addNote(ctx, scope, target, text);
    paint();
    onChange();
  }) : null;

  const paint = () => {
    paintHeader();
    renderThreads(list, scope, target, ctx, {
      onChange: (o = {}) => { paint(); if (!o.localOnly) onChange(); },
      expandedPinned,
      editing,
      ui,
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
  const editing = new Map(); // note id -> { value, focus, armed } — inline edit drafts
  // One `ui` across every section: the inline composer names its own scope +
  // target, so replying works here for artist and day threads too — it used to
  // be fest-only because the one shared composer could only aim at one scope.
  const ui = { revealed: null, reply: null, justAdded: null, unfold: false, focusOwner: null, replyFocused: false };

  // The composer lives OUTSIDE paint() — a remote sync repainting the list
  // must never eat a half-typed festival note (audit 1.2, same discipline as
  // the scope sheet).
  const box = ctx.meName ? composer('Add a festival note…', (text) => {
    ui.justAdded = addNote(ctx, 'fest', null, text);
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
        expandedPinned,
        editing,
        ui,
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
