// Wall filters — pure state + helpers. One filter, "tap the thing that is
// already on screen" (design canvas 2026-08-27, option A):
//   people  — tap a member chip: the wall highlights what they picked (tap
//             more chips to combine). It DIMS everything else, everywhere —
//             on the clock and in a stack alike. It never hides a card
//             (Kevin, 2026-09-17: "highlighting picks shouldn't work as a
//             filter"); a dimmed card still takes a tap.
// Per-festival, per-tab, dies with the tab (sessionStorage): a filter that
// survived a reload would read as "where did everyone's picks go?" — and the
// chips make the state visible anyway.

const LS_PEOPLE = (fid) => `fn_filter_people_v1_${fid}`;

// sessionStorage throws on storage-blocked browsers exactly like localStorage
// does (Safari private mode). A filter is a view, so a blocked store must
// not make it unusable: every value is ALSO kept in this module's memory,
// which is the source of truth for the life of the page, and storage is the
// copy that survives a reload when the browser allows one. (Codex gate,
// 2026-08-27: the first cut swallowed the failed write and then re-read
// storage, so a tap on a chip did nothing at all in private mode.)
const memory = new Map();
function read(key) {
  if (memory.has(key)) return memory.get(key);
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  memory.set(key, value);
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch { /* memory-only session */ }
}

export function loadPeopleFilter(fid) {
  try {
    const v = JSON.parse(read(LS_PEOPLE(fid)) || '[]');
    return Array.isArray(v) ? v.filter((n) => typeof n === 'string') : [];
  } catch { return []; }
}
export function savePeopleFilter(fid, names) {
  write(LS_PEOPLE(fid), names && names.length ? JSON.stringify(names) : null);
}
export function togglePerson(names, name) {
  return names.includes(name) ? names.filter((n) => n !== name) : [...names, name];
}

// A card passes the people filter when ANY selected person has a live pick
// on it (level > 0 — a tombstoned 0 is "unpicked", not "picked at 0").
// No selected people = no filter = everything passes.
export function passesPeople(picks, artist, people) {
  if (!people || !people.length) return true;
  const by = (picks || {})[artist] || {};
  return people.some((p) => (by[p] || 0) > 0);
}

// Only members who are still in the crew count; a filter remembered for
// someone who has since been removed would silently blank the wall.
export function pruneToActive(names, activeNames) {
  const live = new Set(activeNames);
  return (names || []).filter((n) => live.has(n));
}

// A stage column is `--col-w` — the ONE card column (§3a.1), the same track the
// venue stacks ride, declared once in v3-tokens.css. It is a fixed width, not a
// fraction, so the grid stops stretching to fill a wide window: it stays a
// horizontal scroller, and a set card is the width of an afters card. The
// columns are the festival's stages and nothing else: under MODEL-V4 §1.3
// anything off the grid is a venue group below it, so there is no
// everything-else column to reserve.
export const COL = 'var(--col-w)';

// The people chips have ONE job: tap to filter. "Pick as" — acting for someone
// else — moved to Settings → You on 2026-08-29 (Kevin: people rarely switch
// who they pick as; a hold + arm + confirm dance on the wall, and a hover door
// on desktop, was machinery for a rare act). The gesture code that lived here
// (HOLD_MS, ARM_MS, chipGesture, armFor, cancelHold) is gone with it.

// ---- the fold (MODEL-V4 §3, 2026-09-16) ------------------------------------------
// A room folds on a tap of its header — the festival's own room (':fest') and
// every section (keyed by its own day label: "Afters", "Folsom"). A folded
// room is folded on EVERY day, and the show menu on the fest name reads and
// writes the same state, so both doors say one thing. Unlike the two filters
// above this one PERSISTS, device-local — a setting you make once ("I'm not
// doing Folsom") and expect to hold — and it is never written to the crew doc
// (a view is viewer-side; law). Memory is the truth for the life of the page;
// localStorage is the copy that survives a reload when the browser allows one.
import { getLS, saveLS, removeLS } from '../util.js';

// The festival's own room. A leading colon keeps this key out of the space a
// data file's day labels live in, so no section can ever collide with it.
export const FEST_ROOM = ':fest';

const LS_FOLD = (fid) => `fn_fold_v1_${fid}`;
const foldMemory = new Map();
// Fests whose last write did not land (storage full, a blocked store): the
// stored value is OLDER than memory there, so memory wins until a write
// lands again — or a reload would quietly resurrect the previous setting.
const memoryWins = new Set();
const cleanKeys = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === 'string' && k) : []);

export function loadFolded(fid) {
  if (memoryWins.has(fid) && foldMemory.has(fid)) return foldMemory.get(fid);
  const raw = getLS(LS_FOLD(fid));
  if (raw != null) {
    let keys = [];
    try { keys = cleanKeys(JSON.parse(raw)); } catch { keys = []; }
    foldMemory.set(fid, keys);
    return keys;
  }
  return foldMemory.get(fid) || [];
}
export function saveFolded(fid, keys) {
  const clean = cleanKeys(keys);
  foldMemory.set(fid, clean);
  let landed;
  if (clean.length) landed = saveLS(LS_FOLD(fid), JSON.stringify(clean)) !== false;
  else { removeLS(LS_FOLD(fid)); landed = getLS(LS_FOLD(fid)) == null; }
  if (landed) memoryWins.delete(fid); else memoryWins.add(fid);
}
export function toggleFold(keys, key) {
  const list = cleanKeys(keys);
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}
// One tap, applied at once: the setting lands in memory and storage BEFORE
// anything animates, so a second tap inside the first one's fade reads the
// first (two rooms tapped in 130 ms used to lose the first — review round,
// 2026-09-01). Returns what changed so the caller can move the room.
export function applyFoldToggle(fid, current, key) {
  const next = toggleFold(current, key);
  saveFolded(fid, next);
  return { next, folding: !cleanKeys(current).includes(key) };
}

// ---- a starting view in a share link (v92, 2026-09-25) -----------------------------
// A share link can say which rooms it opens on — `&show=fest,afters` in the
// hash beside `g=` (crew.js). The list is POSITIVE (Kevin's ask was "just
// Portola", "just Folsom"), and it names rooms by a slug a person could read
// in a chat: `fest` for the festival's own room, any other room its label,
// lowercased, accents off, anything else a dash. A slug is matched against
// the rooms the RECEIVING phone's festival file offers, so a room one build
// knows and another does not is simply ignored.
//
// It is a view, so it follows the fold's law: it seeds THIS phone's fold,
// once, and is never written to the crew doc. The rules for when (a phone
// that has never shown this festival, a fold of its own untouched) live in
// app.js; the words for what a link opens on live here beside the slugs.
export function roomSlug(room) {
  if (!room) return '';
  if (room.key === FEST_ROOM) return 'fest';
  return String(room.label || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// What a link sent from here should say: the slugs of the rooms this phone is
// SHOWING, or null when it shows them all (a link with no `show` opens on
// everything, which is also what an old build does with any link). A room
// whose label leaves no slug cannot be named; if one of those is showing,
// the link says nothing rather than hide it on the other end.
export function showOf(rooms, folded) {
  const hidden = new Set(cleanKeys(folded));
  const list = rooms || [];
  const showing = list.filter((r) => !hidden.has(r.key));
  if (!showing.length || showing.length === list.length) return null;
  const slugs = showing.map(roomSlug);
  if (slugs.some((s) => !s)) return null;
  return [...new Set(slugs)];
}

// The other end: which rooms to fold for a link's `show`. Null when the link
// names no room this festival has (a typo, another build's room) or would
// leave nothing to hide — and never a list that hides every room: a link
// must not open onto an empty week.
export function foldFromShow(rooms, slugs) {
  const wanted = new Set(Array.isArray(slugs) ? slugs : []);
  const list = rooms || [];
  if (!wanted.size || list.length < 2) return null;
  const showing = list.filter((r) => wanted.has(roomSlug(r)));
  if (!showing.length || showing.length === list.length) return null;
  return list.filter((r) => !showing.includes(r)).map((r) => r.key);
}

// "Portola + Afters": the rooms a view shows, by the names the show menu uses.
export function showLabel(rooms, folded) {
  const hidden = new Set(cleanKeys(folded));
  return (rooms || []).filter((r) => !hidden.has(r.key)).map((r) => r.label).join(' + ');
}

// Has this phone made a choice about this festival's rooms? A stored fold is
// one; so is a fold set this page that storage refused. Showing everything by
// choice removes the stored key, which is indistinguishable from never having
// chosen — app.js also asks whether the phone has shown the festival before.
export function foldIsSet(fid) {
  return getLS(LS_FOLD(fid)) != null || (memoryWins.has(fid) && (foldMemory.get(fid) || []).length > 0);
}

// Seeded once per festival per phone: a second link with a different `show`
// never re-folds a wall the first one already set up. Memory backs a store
// that refuses the write, so one visit is never seeded twice. The marker is a
// raw guarded write, not saveLS: a refused marker is not a lost pick, and
// must not raise the "storage is full" toast that exists for those.
const LS_SEEDED = (fid) => `fn_fold_seeded_v1_${fid}`;
const seededHere = new Set();
export function showSeeded(fid) {
  return seededHere.has(fid) || getLS(LS_SEEDED(fid)) != null;
}
export function rememberShowSeeded(fid) {
  seededHere.add(fid);
  try { localStorage.setItem(LS_SEEDED(fid), '1'); } catch { /* memory holds it for this visit */ }
}

// ---- the view: Board or List (Phase 1, 2026-09-26) ----------------------------------
// Kevin, from Portola: "our menu that holds the locations 'show' options gets
// … view as list vs board (share and reload saves that selection)". Board is
// the wall as it has always been — stage columns on a clock, stacks under
// their venues; List reads every room by time, one card to a row. Which one
// is a VIEWER's choice, so it follows the fold's law exactly: per phone, per
// festival (a view is a view OF a festival — someone can keep Portola as a
// list while it is live and still plan ACL on its board), memory the truth
// for the life of the page, localStorage the copy, never the crew doc.
// Board is the default and stores nothing: choosing it removes the key.
//
// The write is a raw guarded one, not saveLS: a refused view is not a lost
// pick, and must not raise the "storage is full, picks can't be saved" toast
// that exists for those (the seeded marker's rule, below).
export const BOARD = 'board';
export const LIST = 'list';
const LS_VIEW = (fid) => `fn_view_v1_${fid}`;
const viewMemory = new Map();
const viewMemoryWins = new Set(); // the fold's memoryWins, for the view
const asView = (v) => (v === LIST ? LIST : BOARD);

export function loadView(fid) {
  if (viewMemoryWins.has(fid) && viewMemory.has(fid)) return viewMemory.get(fid);
  const raw = getLS(LS_VIEW(fid));
  if (raw != null) {
    const v = asView(raw);
    viewMemory.set(fid, v);
    return v;
  }
  return viewMemory.get(fid) || BOARD;
}
export function saveView(fid, view) {
  const v = asView(view);
  viewMemory.set(fid, v);
  try {
    if (v === LIST) localStorage.setItem(LS_VIEW(fid), LIST);
    else localStorage.removeItem(LS_VIEW(fid));
  } catch { /* memory holds it for this visit */ }
  const landed = v === LIST ? getLS(LS_VIEW(fid)) === LIST : getLS(LS_VIEW(fid)) == null;
  if (landed) viewMemoryWins.delete(fid); else viewMemoryWins.add(fid);
}
// Has this phone chosen a view of this festival? A stored List is a choice;
// Board stores nothing, which reads the same as never having chosen — the
// seeding below asks this, and the phone-has-shown-it test in app.js covers
// the rest (the fold's own reasoning, foldIsSet).
export function viewIsSet(fid) {
  return getLS(LS_VIEW(fid)) != null || (viewMemoryWins.has(fid) && viewMemory.get(fid) === LIST);
}
