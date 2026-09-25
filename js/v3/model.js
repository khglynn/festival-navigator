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

// The artists `person` picked at any OTHER festival in this crew, lowercased
// — half of what makes a season's show "yours" (the other half is Spotify;
// events.js seasonModelOf). Read from the one crew doc on screen, so it is
// only ever this person's own picks where this crew can already see them:
// nothing reaches across circles (CLAUDE.md, the model's first law).
export function pickedElsewhere(doc, person, exceptFid) {
  const out = new Set();
  if (!person) return out;
  for (const fid of Object.keys(doc?.festivals || {})) {
    if (fid === exceptFid) continue;
    for (const [artist, by] of Object.entries(picksFor(doc, fid))) {
      if ((by[person] || 0) >= 1) out.add(artist.toLowerCase());
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

// Merge payload for adding one note. Consumed by the merge-safety tests
// (tests/v3-model.test.mjs) as the canonical note-write shape; the live
// write path (state.recordNote) builds the same shape against two roots.
export function noteOverlay(fid, scope, target, note, id) {
  const noteId = id ?? makeNoteId(note.author, note.ts);
  const leaf = { [noteId]: note };
  const scoped = scope === 'fest' ? leaf : { [target]: leaf };
  return { festivals: { [fid]: { notes: { [scope]: scoped } } } };
}

// ---- day notes are keyed by the date (MODEL-V4 §4) ----------------------------------
// A day note used to be keyed by the day LABEL the file happens to use
// ("Saturday", "Day 3"). A two-weekend festival has two Saturdays, so one
// thread served both — and a section label ("Afters") was a note target of its
// own. Both go: a day note is keyed by its ISO date, and sections have no
// notes at all.
//
// Nothing is renamed and nothing is migrated. The old keys are still read,
// mapped to dates at READ time through dayMeta, and the pick-key freeze is
// untouched. New notes only ever land on a date.

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Every date one dayMeta entry stands for: one for a single-weekend fest
// (`iso`), both for a two-weekend one (`isos: {W1, W2}`).
export function isosOfDayMeta(meta) {
  const out = [];
  if (!meta) return out;
  if (typeof meta.iso === 'string' && ISO_DATE_RE.test(meta.iso)) out.push(meta.iso);
  for (const v of Object.values(meta.isos || {})) {
    if (typeof v === 'string' && ISO_DATE_RE.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

// The weekday a date falls on, in the long form the wall used as a day key.
// Read in UTC: an ISO date is a calendar day, not an instant, and reading it
// locally moves it a day west of the date line.
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weekdayNameOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : WEEKDAYS_LONG[d.getUTCDay()];
}

// The legacy weekday-keyed day notes that render under `iso`. On a two-weekend
// fest "Friday" maps to BOTH Fridays — which is what a note written against
// the label always meant, since there was only ever one of it.
//
// Two ways in, because the wall had two ways of naming a day. A GRID day took
// its name from the file, so dayMeta is what says which dates "Saturday"
// stood for. A SECTION's night was never in dayMeta at all — the wall
// synthesised it from the entries' `night` and keyed its notes by the long
// weekday (events.js, LONG[wd]) — so Portola's afters, half its wall, would
// have no way back to their notes if dayMeta were the only door. A weekday
// label is therefore a legacy key for any date whose weekday it names,
// whether or not the file lists that date.
export function legacyDayKeysFor(fest, iso) {
  if (!ISO_DATE_RE.test(String(iso))) return [];
  const meta = (fest && fest.dayMeta) || {};
  const out = [];
  const wd = weekdayNameOf(iso);
  if (wd) out.push(wd);
  for (const k of Object.keys(meta)) {
    if (ISO_DATE_RE.test(k) || out.includes(k)) continue;
    if (isosOfDayMeta(meta[k]).includes(iso)) out.push(k);
  }
  return out;
}

// ---- a section on a date (MODEL-V4 §3a.3, 2026-09-17) -------------------------------
// "Folsom, on Friday" is its own conversation: you wrote it standing on that
// night's Folsom, and it belongs to that night. The key is the date and the
// section label with a pipe between them — `2026-09-25|Folsom` — which is
// additive (nothing reads it today) and unambiguous, because a date cannot
// hold a pipe and a section label that did would not be a day key either.
// Nothing rolls up: this key is read by exactly one door and listed under
// exactly one label.
const SECTION_DATE_RE = /^(\d{4}-\d{2}-\d{2})\|(.+)$/;
export const sectionDateKey = (iso, section) => `${iso}|${section}`;
export function parseSectionDateKey(key) {
  const m = SECTION_DATE_RE.exec(String(key || ''));
  return m ? { iso: m[1], section: m[2] } : null;
}

// The keys one target's conversation reads from, oldest convention first. The
// LAST one is the target itself, and it is the only key anything new is written
// to — so `dayNoteKeysFor(...).at(-1)` is always the write target. A section on
// a date has no older convention to read: it is new, so it reads only itself.
export function dayNoteKeysFor(fest, iso) {
  if (parseSectionDateKey(iso)) return [iso];
  return [...legacyDayKeysFor(fest, iso), iso];
}

// Every section-on-a-date key a crew has written, grouped by date. The sheet
// lists them under their date; the wall reads one at a time.
export function sectionDateKeysOn(doc, fid, iso) {
  return Object.keys(doc?.festivals?.[fid]?.notes?.day || {})
    .map((k) => ({ key: k, parsed: parseSectionDateKey(k) }))
    .filter(({ key, parsed }) => parsed && parsed.iso === iso && noteCount(doc, fid, 'day', key))
    .sort((a, b) => a.parsed.section.localeCompare(b.parsed.section))
    .map(({ key, parsed }) => ({ key, section: parsed.section }));
}

// What is left in notes.day once every date has taken its own key, the weekday
// labels those dates claim, and the sections on those dates: the bare section
// labels ("Afters", "Folsom") written before §3a.3, plus any date the festival
// no longer has. Readable, never written to again.
export function sectionNoteKeys(doc, fid, fest, dates) {
  const isos = [...new Set(dates || [])];
  const claimed = new Set(isos);
  for (const iso of isos) for (const k of legacyDayKeysFor(fest, iso)) claimed.add(k);
  return Object.keys(doc?.festivals?.[fid]?.notes?.day || {})
    .filter((k) => !claimed.has(k) && !parseSectionDateKey(k));
}

// ---- threads (2026-08-29) ----------------------------------------------------------
// A reply is a note with one extra key: re = its root note's id. One level
// deep by construction: the reply composer always passes the ROOT's id, so
// replying to a reply attaches to the root. Returns render-ready threads:
// roots oldest-first (pinned first when pinnedIds is given), each with its
// live replies oldest-first. A reply whose root is missing or tombstoned
// keeps its context under a stub thread (root: null; stubAuthor names the
// deleted root's author when the tombstone is still readable).
export function threadsFor(doc, fid, scope, target, pinnedIds = []) {
  const live = notesFor(doc, fid, scope, target);
  const raw = doc?.festivals?.[fid]?.notes?.[scope];
  const map = (scope === 'fest' ? raw : raw?.[target]) || {};
  const pinned = new Set(pinnedIds);
  const roots = live.filter((n) => !n.re);
  const rootIds = new Set(roots.map((r) => r.id));
  const threads = roots
    .sort((a, b) => (pinned.has(a.id) ? 0 : 1) - (pinned.has(b.id) ? 0 : 1) || Date.parse(a.ts) - Date.parse(b.ts))
    .map((root) => ({ root, stubAuthor: null, replies: [] }));
  const byRoot = new Map(threads.map((t) => [t.root.id, t]));
  const stubs = new Map();
  for (const n of live) {
    if (!n.re) continue;
    if (rootIds.has(n.re)) { byRoot.get(n.re).replies.push(n); continue; }
    if (!stubs.has(n.re)) {
      const gone = map[n.re];
      const t = { root: null, stubAuthor: (gone && gone.author) || null, replies: [] };
      stubs.set(n.re, t); threads.push(t);
    }
    stubs.get(n.re).replies.push(n);
  }
  for (const t of threads) t.replies.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return threads;
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

// ---- fests × circles × you (2026-07-14) -------------------------------------------
// The landing lists FESTIVALS, not crews: every (crew, fest) pair the device
// knows becomes one row, ordered by the festival index (curated ≈ date
// order). Two circles at one fest = two rows — honest, unfused until the
// merged-board arc. A crew whose doc was never cached can't name its fests
// and falls back to a single crew-named row (fid null).

export function landingPairs(crews, docFor, festIndex) {
  // Date order, not index order (Kevin, 2026-07-14: "sort by and show dates").
  // Upcoming fests soonest-first; archived ones sink below, most recent
  // first, muted by the renderer. startsOn is an ISO string, so plain string
  // comparison sorts it — no Date parsing, no clock needed (archived status,
  // not "today", decides what counts as past).
  const meta = new Map(festIndex.map((f) => [f.id, f]));
  const sortKey = (fid) => {
    const m = fid ? meta.get(fid) : null;
    if (!m || !m.startsOn) return { past: 2, key: '' };           // uncached / custom: last
    if (m.status === 'archived') return { past: 1, key: m.startsOn }; // past, recent first
    return { past: 0, key: m.startsOn };                          // upcoming, soonest first
  };
  const pairs = [];
  for (const c of crews) {
    const doc = docFor(c.token);
    const fids = doc ? Object.keys(doc.festivals || {}) : [];
    const people = doc
      ? Object.entries(doc.people || {}).filter(([, p]) => p && !p.removed).map(([n, p]) => ({ name: n, p }))
      : [];
    if (!fids.length) { pairs.push({ token: c.token, fid: null, crewName: c.name || '', people, past: false }); continue; }
    for (const fid of fids) {
      pairs.push({ token: c.token, fid, crewName: c.name || '', people, past: (meta.get(fid) || {}).status === 'archived' });
    }
  }
  return pairs.sort((a, b) => {
    const ka = sortKey(a.fid);
    const kb = sortKey(b.fid);
    if (ka.past !== kb.past) return ka.past - kb.past;
    if (ka.past === 1) return kb.key.localeCompare(ka.key); // past: most recent first
    return ka.key.localeCompare(kb.key);
  });
}

// Label a fest id the landing may not have metadata for: catalog fests come
// from the index; crew-private (AI-added) fests only load inside their crew,
// so their id prettifies ("amish-acl-2026" -> "Amish Acl 2026") rather than
// rendering as a slug.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function festLabelFor(fid, festIndex) {
  const meta = festIndex.find((f) => f.id === fid);
  if (meta) {
    // "Sep '26" beside the name — "I just want to know WHEN when looking at
    // lists" (Kevin, 2026-07-14). Month from startsOn, year as already styled.
    const month = meta.startsOn ? MONTHS[Number(meta.startsOn.slice(5, 7)) - 1] : '';
    const year = [month, meta.year || ''].filter(Boolean).join(' ');
    return { name: meta.name, year, accent: meta.accent || null };
  }
  const pretty = String(fid).split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
  return { name: pretty, year: '', accent: null };
}

// The + Add sheet's one-tap picker: active people from every OTHER crew this
// device knows — your recurring humans (Drew, Pega, Rosten) one tap away
// instead of retyped. Deduped case-insensitively; excludes people already
// active here and yourself. First-seen order.
export function otherFestPeople(currentToken, crews, docFor, currentPeople, meName) {
  const here = new Set(Object.entries(currentPeople || {})
    .filter(([, p]) => p && !p.removed).map(([n]) => n.toLowerCase()));
  if (meName) here.add(String(meName).toLowerCase());
  const seen = new Set();
  const out = [];
  for (const c of crews) {
    if (c.token === currentToken) continue;
    const doc = docFor(c.token);
    for (const [n, p] of Object.entries((doc && doc.people) || {})) {
      if (!p || p.removed) continue;
      const key = n.toLowerCase();
      if (here.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ name: n, fromCrew: c.name || '' });
    }
  }
  return out;
}
