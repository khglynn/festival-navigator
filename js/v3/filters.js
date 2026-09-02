// Wall filters — pure state + helpers. Two filters, both "tap the thing that
// is already on screen" (design canvas 2026-08-27, options A + D):
//   people  — tap a member chip: the wall shows only what they picked (tap
//             more chips to combine). On the timetable, non-matching cards
//             DIM rather than hide, so the clock keeps its shape; on the
//             lineup lists (afters, Folsom, a lineup-only fest) they hide.
//   solo    — tap a stage name in the sticky strip: that column goes wide and
//             the others fold to slim rails (the phone case, where five
//             columns never fit). Tap the head again to restore.
// Both are per-festival, per-tab, and die with the tab (sessionStorage):
// a filter that survived a reload would read as "where did everyone's picks
// go?" — and the chips make the state visible anyway.

const LS_PEOPLE = (fid) => `fn_filter_people_v1_${fid}`;
const LS_SOLO = (fid) => `fn_solo_stage_v1_${fid}`;

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

export function loadSolo(fid) { return read(LS_SOLO(fid)) || null; }
export function saveSolo(fid, stage) { write(LS_SOLO(fid), stage || null); }

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

// What a folded stage's rail says. A rail is 34px wide and one strip row
// tall with a scroller that clips both axes, so the label is bounded to
// four characters of the first word — "Pier", "Cran", "Ware". When two
// stages share those four ("Bud Light" / "Bud Light Backyard"), initials
// tell them apart instead ("BL" / "BLB"); if even those clash ("Bud Light"
// / "Bud Lite"), a digit does ("BL" / "BL2") — two rails never read the
// same. The full name stays in the head's title and aria-label, and shows
// whole the moment the rail is tapped.
export function railLabels(stages) {
  const words = (s) => String(s).trim().split(/\s+/).filter(Boolean);
  const first = (s) => (words(s)[0] || '').slice(0, 4);
  const initials = (s) => words(s).map((w) => Array.from(w)[0]).join('').slice(0, 4).toUpperCase();
  const counts = {};
  for (const s of stages) counts[first(s)] = (counts[first(s)] || 0) + 1;
  const out = {};
  const used = {};
  for (const s of stages) {
    let label = counts[first(s)] > 1 ? initials(s) : first(s);
    if (used[label]) label = `${label.slice(0, 3)}${used[label] + 1}`;
    used[label] = (used[label] || 0) + 1;
    out[s] = label;
  }
  return out;
}

// The rail width for a folded stage column. Wide enough for a vertical
// stage name at 9px and a tap; narrow enough that four rails plus the wide
// column fit a 390px phone with the hour rail.
export const SOLO_RAIL = '34px';

// The timetable's column template, with a soloed stage wide and every other
// column (stages AND the everything-else column) folded to a rail. No solo =
// the everyday template. Unknown solo (a stage that no longer exists) = no
// solo, so a remembered stage name from a renamed grid can't blank the wall.
export function columnsTemplate(stages, hasEE, solo) {
  const active = solo && stages.includes(solo) ? solo : null;
  const cols = stages.map((s) => (active && s !== active ? SOLO_RAIL : 'minmax(150px, 1fr)'));
  if (hasEE) cols.push(active ? SOLO_RAIL : 'minmax(150px, 1fr)');
  return { template: cols.join(' '), solo: active };
}

// The people chips have ONE job: tap to filter. "Pick as" — acting for someone
// else — moved to Settings → You on 2026-08-29 (Kevin: people rarely switch
// who they pick as; a hold + arm + confirm dance on the wall, and a hover door
// on desktop, was machinery for a rare act). The gesture code that lived here
// (HOLD_MS, ARM_MS, chipGesture, armFor, cancelHold) is gone with it.

// ---- the bucket filter (MODEL-V3 §3, 2026-09-01) ---------------------------------
// One chip per room the fest has — the festival itself (':fest'), then each
// events section (keyed by its own day label: "Afters", "Folsom"). Toggling
// a bucket off hides that room on EVERY day. Unlike the two filters above
// this one PERSISTS, device-local like the weekend view (`fn_weekend_v1_`)
// — a filter you would set once ("I'm not doing Folsom") and expect to hold
// — and it is never written to the crew doc (a view is viewer-side; law).
// Memory is the truth for the life of the page; localStorage is the copy
// that survives a reload when the browser allows one.
import { getLS, saveLS, removeLS } from '../util.js';

const LS_BUCKETS = (fid) => `fn_buckets_v1_${fid}`;
const bucketMemory = new Map();
// Fests whose last write did not land (storage full, a blocked store): the
// stored value is OLDER than memory there, so memory wins until a write
// lands again — or a reload would quietly resurrect the previous setting.
const memoryWins = new Set();
const cleanKeys = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === 'string' && k) : []);

export function loadHiddenBuckets(fid) {
  if (memoryWins.has(fid) && bucketMemory.has(fid)) return bucketMemory.get(fid);
  const raw = getLS(LS_BUCKETS(fid));
  if (raw != null) {
    let keys = [];
    try { keys = cleanKeys(JSON.parse(raw)); } catch { keys = []; }
    bucketMemory.set(fid, keys);
    return keys;
  }
  return bucketMemory.get(fid) || [];
}
export function saveHiddenBuckets(fid, keys) {
  const clean = cleanKeys(keys);
  bucketMemory.set(fid, clean);
  let landed;
  if (clean.length) landed = saveLS(LS_BUCKETS(fid), JSON.stringify(clean)) !== false;
  else { removeLS(LS_BUCKETS(fid)); landed = getLS(LS_BUCKETS(fid)) == null; }
  if (landed) memoryWins.delete(fid); else memoryWins.add(fid);
}
export function toggleBucket(keys, key) {
  const list = cleanKeys(keys);
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}
// One tap, applied at once: the setting lands in memory and storage BEFORE
// anything animates, so a second tap inside the first one's fade reads the
// first (two chips tapped in 130 ms used to lose the first — review round,
// 2026-09-01). Returns what changed so the caller can move the room.
export function applyBucketToggle(fid, current, key) {
  const next = toggleBucket(current, key);
  saveHiddenBuckets(fid, next);
  return { next, hiding: !cleanKeys(current).includes(key) };
}
