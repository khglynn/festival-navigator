// v4 doc semantics — version-aware reads, the one-shot v3->v4 migration
// overlay, and note helpers. Pure functions (node --test: tests/v3-model.test.mjs).
//
// Level semantics:
//   v4 docs: 0 cleared, 1-3 picked (alpha .5/.75/1), 4 must.
//   v3 docs: 0 cleared, 1 Nice, 2 Highlight, 3 "Must See".
// The LABELS carry meaning across versions, not the alphas: legacy 3 IS the
// new must. Read mapping is 1->1, 2->2, 3->4; nothing else changes.
// A v3 doc is upgraded ONCE, SERVER-SIDE (api/crew.js ?op=migrate): one
// atomic UPDATE maps every legacy leaf and stamps v=4 together. Clients
// cannot write v at all — a client-computed overlay could go stale between
// read and merge, and a bare stamp would corrupt legacy musts (Codex P2
// gate, findings 1 + 4). Clients just call the op when they see v3.
//
// LEGACY_MAP passes 4 through: a v4-semantics write can land on a not-yet-
// migrated doc in the migrate-race window, and reading it as 0 would eat
// the pick.

const LEGACY_MAP = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 4 };

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

// True when a client should request the server-side migrate op before its
// first v4-semantics write.
export function needsMigration(doc) {
  return docVersion(doc) !== 4;
}

// The crew's "home" festival by evidence: where the picks live. Used to
// backfill meta.inviteFestId on pre-v3.1 docs (FLOW-1) — links already out
// in group chats predate the stamp, so the app heals its own doc from the
// strongest crew-level signal instead of any one device's view.
export function busiestFestival(doc, knownIds) {
  const known = new Set(knownIds || []);
  let best = null;
  let bestCount = 0;
  for (const fid of Object.keys(doc?.festivals || {})) {
    if (!known.has(fid)) continue;
    const count = Object.keys(picksFor(doc, fid)).length;
    if (count > bestCount) { best = fid; bestCount = count; }
  }
  return best; // null when no fest has picks — caller falls back
}

// One stage-column order for the whole festival: the union of every day's
// stages, in first-appearance order. Each day's stages array is authored
// independently in the festival data, so the same physical stage used to sit
// in a different column on different days — scrolling down a stage silently
// changed stages under you. Days missing a stage render an empty column;
// that's the graceful case, not an error.
export function canonicalStages(fest) {
  const out = [];
  for (const day of Object.keys(fest?.days || {})) {
    for (const s of fest.days[day].stages || []) if (!out.includes(s)) out.push(s);
  }
  return out;
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
