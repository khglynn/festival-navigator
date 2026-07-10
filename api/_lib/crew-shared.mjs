// Shared, DOM-free logic for the crew API: deep-merge + write-time validation.
// Kept pure so node --test can exercise every rule (tests/crew-validate.test.mjs).
//
// Validation philosophy (from the project's data-quality rules): reject
// implausible values at write time so garbage never reaches the stored doc.
// The capability token is the access gate; validation is the shape gate.

export const LIMITS = {
  docBytes: 256 * 1024,   // hard cap on the stored crew document
  activePeople: 24,
  personName: 24,
  artistName: 100,
  crewName: 40,
  festivalId: 64,
  affinitySongs: 99999,
  noteText: 500,
  noteId: 80,
  isoTs: 32,
  colorIndexMax: 23,      // the 24-board (js/v3/palette.js)
  spotifyCount: 999999,
};

export const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;
const COLOR_RE = /^\d{1,3}, \d{1,3}, \d{1,3}$/;
const FESTIVAL_ID_RE = /^[a-z0-9-]{1,64}$/;
const CLIENT_ID_RE = /^[0-9a-fA-F]{32}$/;
// Printable, no angle brackets / quotes / backticks / control chars.
// Person and crew names end up in HTML and in AI prompts — keep them tame.
const SAFE_NAME_RE = /^[^\x00-\x1f<>"'`&\\]{1,}$/;

// Keys that would rebind an object's prototype through the bracket-assign
// merge below. Validators reject them, and the merge skips them anyway
// (defense in depth — never rely on a single layer for pollution).
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function deepMerge(base, overlay) {
  if (overlay === undefined || overlay === null) return base;
  if (typeof overlay !== 'object') return overlay;
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
  for (const k in overlay) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = deepMerge(out[k], overlay[k]);
  }
  return out;
}

export function newCrewDoc(name, createdAt) {
  return {
    v: 4, // v4 semantics from birth: picks 0-4, keyed-object notes
    meta: { name, createdAt },
    spotify: {},
    spotifyStats: {},
    people: {},
    festivals: {},
    affinity: {},
  };
}

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validName(v, max) {
  return typeof v === 'string' && v.length <= max && SAFE_NAME_RE.test(v)
    && v.trim() === v && !FORBIDDEN_KEYS.has(v);
}

function validArtistKey(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= LIMITS.artistName
    && !/[\x00-\x1f]/.test(v) && !FORBIDDEN_KEYS.has(v);
}

function validatePeople(people) {
  if (!isPlainObject(people)) return fail('people must be an object');
  for (const [name, p] of Object.entries(people)) {
    if (!validName(name, LIMITS.personName)) return fail(`invalid person name: ${JSON.stringify(name).slice(0, 60)}`);
    if (!isPlainObject(p)) return fail(`person ${name}: entry must be an object`);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'color') { if (typeof v !== 'string' || !COLOR_RE.test(v)) return fail(`person ${name}: bad color`); }
      else if (k === 'removed') { if (typeof v !== 'boolean') return fail(`person ${name}: removed must be boolean`); }
      else if (k === 'colorIndex') { if (!Number.isInteger(v) || v < 0 || v > LIMITS.colorIndexMax) return fail(`person ${name}: colorIndex must be 0..${LIMITS.colorIndexMax}`); }
      else return fail(`person ${name}: unknown key ${k}`);
    }
  }
  return OK;
}

function validateSelections(selections) {
  if (!isPlainObject(selections)) return fail('selections must be an object');
  for (const [artist, byPerson] of Object.entries(selections)) {
    if (!validArtistKey(artist)) return fail('invalid artist key');
    if (!isPlainObject(byPerson)) return fail(`selections[${artist}] must be an object`);
    for (const [person, level] of Object.entries(byPerson)) {
      if (!validName(person, LIMITS.personName)) return fail(`selections[${artist}]: invalid person`);
      // v4 semantics: 0 tombstone, 1-3 picked (alpha ladder), 4 must.
      // Legacy v3 docs hold 0..3 with 3 meaning "Must See" — readers map
      // 3->4 by doc version (js/v3/model.js); the server accepts the union.
      if (!Number.isInteger(level) || level < 0 || level > 4) return fail(`selections[${artist}][${person}]: level must be 0..4`);
    }
  }
  return OK;
}

// Notes are keyed objects at EVERY level (never arrays — jsonb_deep_merge
// replaces arrays wholesale, which would eat concurrent notes). A note may be
// tombstoned by its author via deleted:true; text of tombstones may be ''.
const NOTE_ID_RE = /^[A-Za-z0-9|_.-]{8,80}$/;
const NOTE_SCOPES = new Set(['artist', 'day', 'fest']);

function validNoteTs(v) {
  return typeof v === 'string' && v.length <= LIMITS.isoTs && !Number.isNaN(Date.parse(v));
}

function validateNote(note, where) {
  if (!isPlainObject(note)) return fail(`${where}: note must be an object`);
  if (!validName(note.author ?? '', LIMITS.personName)) return fail(`${where}: bad author`);
  if (!validNoteTs(note.ts)) return fail(`${where}: bad ts`);
  for (const [k, v] of Object.entries(note)) {
    if (k === 'author' || k === 'ts') continue;
    else if (k === 'text') {
      if (typeof v !== 'string' || v.length > LIMITS.noteText || /[\x00-\x08\x0b-\x1f]/.test(v)) return fail(`${where}: bad text`);
    } else if (k === 'deleted') {
      if (v !== true) return fail(`${where}: deleted may only be true`);
    } else return fail(`${where}: unknown key ${k}`);
  }
  if (typeof note.text !== 'string') return fail(`${where}: text required`);
  if (note.text.length === 0 && note.deleted !== true) return fail(`${where}: empty text`);
  return OK;
}

// Note ids embed their author (sanitized) as the first dot-segment — the
// server requires the id prefix to match the note's author. Honest limits:
// with one shared capability token there is no per-user auth, so a member
// can still FORGE an author outright (same trust model as person names).
// What this rule does guarantee: a client writing under its own author can
// never accidentally or casually overwrite/tombstone a DIFFERENT author's
// note, because it cannot produce a matching id for them without also
// forging the author field (Codex P2 gate, findings 2 + 8).
export function sanitizeAuthorForId(author) {
  return String(author).replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 20) || 'anon';
}

function validateNoteMap(map, where) {
  if (!isPlainObject(map)) return fail(`${where} must be an object`);
  for (const [noteId, note] of Object.entries(map)) {
    if (!NOTE_ID_RE.test(noteId) || FORBIDDEN_KEYS.has(noteId)) return fail(`${where}: bad note id`);
    const r = validateNote(note, `${where}[${noteId.slice(0, 20)}]`);
    if (!r.ok) return r;
    const prefix = `${sanitizeAuthorForId(note.author)}.`;
    if (!noteId.startsWith(prefix)) return fail(`${where}: note id must begin with its author (${prefix}...)`);
  }
  return OK;
}

function validateNotes(notes, fid) {
  if (!isPlainObject(notes)) return fail(`festivals[${fid}].notes must be an object`);
  for (const [scope, targets] of Object.entries(notes)) {
    if (!NOTE_SCOPES.has(scope)) return fail(`festivals[${fid}].notes: unknown scope ${scope}`);
    if (scope === 'fest') {
      const r = validateNoteMap(targets, `notes.fest`);
      if (!r.ok) return r;
      continue;
    }
    if (!isPlainObject(targets)) return fail(`notes.${scope} must be an object`);
    for (const [target, map] of Object.entries(targets)) {
      if (!validArtistKey(target)) return fail(`notes.${scope}: invalid target key`);
      const r = validateNoteMap(map, `notes.${scope}[${target.slice(0, 30)}]`);
      if (!r.ok) return r;
    }
  }
  return OK;
}

function validateFestivals(festivals) {
  if (!isPlainObject(festivals)) return fail('festivals must be an object');
  for (const [fid, entry] of Object.entries(festivals)) {
    if (!FESTIVAL_ID_RE.test(fid)) return fail(`invalid festival id: ${fid.slice(0, 60)}`);
    if (!isPlainObject(entry)) return fail(`festivals[${fid}] must be an object`);
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'selections') {
        const r = validateSelections(v);
        if (!r.ok) return r;
      } else if (k === 'notes') {
        const r = validateNotes(v, fid);
        if (!r.ok) return r;
      } else return fail(`festivals[${fid}]: unknown key ${k}`);
    }
  }
  return OK;
}

function validateAffinity(affinity) {
  if (!isPlainObject(affinity)) return fail('affinity must be an object');
  for (const [person, byArtist] of Object.entries(affinity)) {
    if (!validName(person, LIMITS.personName)) return fail('affinity: invalid person name');
    if (!isPlainObject(byArtist)) return fail(`affinity[${person}] must be an object`);
    for (const [artist, aff] of Object.entries(byArtist)) {
      if (!validArtistKey(artist)) return fail('affinity: invalid artist key');
      if (!isPlainObject(aff)) return fail(`affinity[${person}][${artist}] must be an object`);
      for (const [k, v] of Object.entries(aff)) {
        if (k === 'songs') { if (!Number.isInteger(v) || v < 0 || v > LIMITS.affinitySongs) return fail('affinity: bad songs count'); }
        else if (k === 'followed') { if (typeof v !== 'boolean') return fail('affinity: followed must be boolean'); }
        else return fail(`affinity: unknown key ${k}`);
      }
    }
  }
  return OK;
}

function validateSpotify(spotify) {
  if (!isPlainObject(spotify)) return fail('spotify must be an object');
  for (const [k, v] of Object.entries(spotify)) {
    if (k !== 'clientId') return fail(`spotify: unknown key ${k}`);
    // Empty string allowed: it is how a crew clears its client ID.
    if (typeof v !== 'string' || (v !== '' && !CLIENT_ID_RE.test(v))) return fail('spotify.clientId must be a 32-hex-char Spotify Client ID');
  }
  return OK;
}

function validateMeta(meta) {
  if (!isPlainObject(meta)) return fail('meta must be an object');
  for (const [k, v] of Object.entries(meta)) {
    if (k !== 'name') return fail(`meta: only name may be written (got ${k})`);
    if (!validName(v, LIMITS.crewName)) return fail('meta.name invalid');
  }
  return OK;
}

// Per-person Spotify glance stats (Settings shows state; the drill page acts).
// Badges themselves stay in `affinity` — this is display metadata only.
function validateSpotifyStats(stats) {
  if (!isPlainObject(stats)) return fail('spotifyStats must be an object');
  for (const [person, s] of Object.entries(stats)) {
    if (!validName(person, LIMITS.personName)) return fail('spotifyStats: invalid person');
    if (!isPlainObject(s)) return fail(`spotifyStats[${person}] must be an object`);
    for (const [k, v] of Object.entries(s)) {
      if (k === 'likedCount' || k === 'artistCount') {
        if (!Number.isInteger(v) || v < 0 || v > LIMITS.spotifyCount) return fail(`spotifyStats[${person}]: bad ${k}`);
      } else if (k === 'lastSynced') {
        if (!validNoteTs(v)) return fail(`spotifyStats[${person}]: bad lastSynced`);
      } else if (k === 'user') {
        if (!validName(v, 64)) return fail(`spotifyStats[${person}]: bad user`);
      } else return fail(`spotifyStats[${person}]: unknown key ${k}`);
    }
  }
  return OK;
}

// Doc schema version is NOT client-writable. The v3 -> v4 upgrade happens
// ONLY through the server-side migrate op (api/crew.js ?op=migrate): one
// atomic UPDATE that maps every legacy selection leaf (3 -> 4) and stamps
// v=4 together — a bare {v:4} stamp that skipped conversion would silently
// downgrade every legacy "Must See" to picked-x3 (Codex P2 gate, finding 1).
const SECTION_VALIDATORS = {
  people: validatePeople,
  festivals: validateFestivals,
  affinity: validateAffinity,
  spotify: validateSpotify,
  spotifyStats: validateSpotifyStats,
  meta: validateMeta,
};

// Validate an incoming merge overlay (client-sent partial crew doc).
export function validateIncoming(data) {
  if (!isPlainObject(data)) return fail('data must be an object');
  for (const [section, value] of Object.entries(data)) {
    const validator = SECTION_VALIDATORS[section];
    if (!validator) return fail(`unknown section: ${section}`);
    const r = validator(value);
    if (!r.ok) return r;
  }
  return OK;
}

// Post-merge invariants that only make sense on the whole doc.
// NOTE: in production these are enforced INSIDE api/crew.js's atomic UPDATE
// (same limits, SQL-side) so there is no check-then-write gap. This JS twin
// is the readable reference implementation, exercised by the test suite.
export function validateMergedDoc(doc) {
  const active = Object.values(doc.people || {}).filter(p => p && !p.removed).length;
  if (active > LIMITS.activePeople) return fail(`too many active people (max ${LIMITS.activePeople})`);
  const bytes = Buffer.byteLength(JSON.stringify(doc), 'utf8');
  if (bytes > LIMITS.docBytes) return fail(`crew document too large (${bytes} bytes, max ${LIMITS.docBytes})`);
  return OK;
}
