// v4 doc semantics — version-aware reads, the one-shot v3->v4 migration
// overlay, and note helpers. Pure functions (node --test: tests/v3-model.test.mjs).
//
// Level semantics:
//   v4 docs: 0 cleared, 1-3 picked (alpha .5/.75/1), 4 must.
//   v3 docs: 0 cleared, 1 Nice, 2 Highlight, 3 "Must See".
// The LABELS carry meaning across versions, not the alphas: legacy 3 IS the
// new must. Read mapping is 1->1, 2->2, 3->4; nothing else changes.
// A v3 doc is upgraded ONCE by the first v4 writer: migrationOverlay() sends
// every mapped selection leaf plus {v: 4} in a single atomic merge, so a doc
// is never half-migrated and the mapping never runs twice (readers trust v).

const LEGACY_MAP = { 0: 0, 1: 1, 2: 2, 3: 4 };

export function docVersion(doc) {
  return doc && doc.v === 4 ? 4 : 3;
}

export function readLevel(doc, raw) {
  if (!Number.isInteger(raw)) return 0;
  return docVersion(doc) === 4 ? raw : (LEGACY_MAP[raw] ?? 0);
}

// Normalized picks for a festival: {artist: {person: level}} in v4 semantics,
// zero-level tombstones dropped.
export function picksFor(doc, fid) {
  const sels = doc?.festivals?.[fid]?.selections || {};
  const out = {};
  for (const [artist, byPerson] of Object.entries(sels)) {
    for (const [person, raw] of Object.entries(byPerson)) {
      const level = readLevel(doc, raw);
      if (level < 1) continue;
      (out[artist] = out[artist] || {})[person] = level;
    }
  }
  return out;
}

// The one-shot upgrade overlay for a v3 doc; null when nothing to do.
// Includes EVERY selection leaf (mapped) so the stamped doc reads correctly
// as v4, including leaves whose value is unchanged (idempotent by value).
export function migrationOverlay(doc) {
  if (docVersion(doc) === 4) return null;
  const festivals = {};
  for (const [fid, entry] of Object.entries(doc?.festivals || {})) {
    const sels = entry?.selections || {};
    for (const [artist, byPerson] of Object.entries(sels)) {
      for (const [person, raw] of Object.entries(byPerson)) {
        const mapped = LEGACY_MAP[raw];
        if (mapped === undefined) continue; // implausible value: leave, do not invent
        festivals[fid] = festivals[fid] || { selections: {} };
        festivals[fid].selections[artist] = festivals[fid].selections[artist] || {};
        festivals[fid].selections[artist][person] = mapped;
      }
    }
  }
  return Object.keys(festivals).length ? { v: 4, festivals } : { v: 4 };
}

// The tap cycle: 0 -> 1 -> 2 -> 3 -> 4(must) -> 0 (the 5th tap clears; the
// UI wraps this in an undo toast — design open question 1, decided).
export function nextTapLevel(current) {
  const c = Number.isInteger(current) ? current : 0;
  return c >= 4 ? 0 : c + 1;
}

// ---- notes ---------------------------------------------------------------------
// Storage: festivals[fid].notes[scope][targetId][noteId] = {author, ts, text,
// deleted?} for scope 'artist'|'day'; scope 'fest' skips targetId.

export function makeNoteId(author, ts, nonce) {
  const n = nonce ?? Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  // Keep within NOTE_ID_RE: letters, digits, |_.- only.
  const safeAuthor = String(author).replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 20) || 'anon';
  const safeTs = String(Date.parse(ts) || 0);
  return `${safeAuthor}.${safeTs}.${n}`;
}

function noteMap(doc, fid, scope, target) {
  const notes = doc?.festivals?.[fid]?.notes?.[scope];
  if (!notes) return {};
  return (scope === 'fest' ? notes : notes[target]) || {};
}

// Sorted oldest-first (conversation order); tombstones dropped.
export function notesFor(doc, fid, scope, target) {
  return Object.entries(noteMap(doc, fid, scope, target))
    .filter(([, n]) => n && n.deleted !== true && typeof n.text === 'string')
    .map(([id, n]) => ({ id, ...n }))
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

export function noteCount(doc, fid, scope, target) {
  return notesFor(doc, fid, scope, target).length;
}

// Total across all scopes for the wall's Notes chip.
export function totalNoteCount(doc, fid) {
  const notes = doc?.festivals?.[fid]?.notes || {};
  let n = notesFor(doc, fid, 'fest').length;
  for (const scope of ['artist', 'day']) {
    for (const target of Object.keys(notes[scope] || {})) n += notesFor(doc, fid, scope, target).length;
  }
  return n;
}

// Merge payload for adding one note.
export function noteOverlay(fid, scope, target, note, id) {
  const noteId = id ?? makeNoteId(note.author, note.ts);
  const leaf = { [noteId]: note };
  const scoped = scope === 'fest' ? leaf : { [target]: leaf };
  return { festivals: { [fid]: { notes: { [scope]: scoped } } } };
}

// ---- pins (device-local, never synced) -------------------------------------------
// pins[fid] = [noteId, ...] in localStorage key fn_pins_v1.

export function togglePin(pins, fid, noteId) {
  const list = new Set(pins?.[fid] || []);
  if (list.has(noteId)) list.delete(noteId);
  else list.add(noteId);
  return { ...pins, [fid]: [...list] };
}

export function sortWithPins(notes, pinnedIds) {
  const pinned = new Set(pinnedIds || []);
  return [...notes].sort((a, b) => {
    const pa = pinned.has(a.id) ? 0 : 1;
    const pb = pinned.has(b.id) ? 0 : 1;
    return pa - pb || Date.parse(a.ts) - Date.parse(b.ts);
  });
}
