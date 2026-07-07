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
    v: 3,
    meta: { name, createdAt },
    spotify: {},
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
      if (!Number.isInteger(level) || level < 0 || level > 3) return fail(`selections[${artist}][${person}]: level must be 0..3`);
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
      if (k !== 'selections') return fail(`festivals[${fid}]: unknown key ${k}`);
      const r = validateSelections(v);
      if (!r.ok) return r;
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

const SECTION_VALIDATORS = {
  people: validatePeople,
  festivals: validateFestivals,
  affinity: validateAffinity,
  spotify: validateSpotify,
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
