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
// does (Safari private mode) — every read and write is guarded, and a filter
// that can't persist simply resets on the next reload.
function read(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
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
